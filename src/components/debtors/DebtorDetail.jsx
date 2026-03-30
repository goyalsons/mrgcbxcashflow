import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN, daysUntilDue } from '@/lib/utils/currency';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Phone, Mail, MoreHorizontal, Pencil, Trash2, FileText, MessageSquare, CreditCard, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import StatusBadge from '@/components/shared/StatusBadge';
import InvoiceForm from './InvoiceForm';
import PaymentForm from './PaymentForm';
import FollowUpForm from './FollowUpForm';

const FOLLOWUP_ICONS = { call: '📞', email: '📧', whatsapp: '💬', visit: '🏢', sms: '📱', note: '📝' };
const OUTCOME_COLORS = {
  promised_payment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial_commitment: 'bg-amber-50 text-amber-700 border-amber-200',
  disputed: 'bg-red-50 text-red-700 border-red-200',
  no_response: 'bg-gray-50 text-gray-700 border-gray-200',
  resolved: 'bg-blue-50 text-blue-700 border-blue-200',
  other: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function DebtorDetail({ debtor, open, onClose, onEditDebtor }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', debtor?.id],
    queryFn: () => base44.entities.Invoice.filter({ debtor_id: debtor.id }, '-invoice_date'),
    enabled: !!debtor?.id && open,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', debtor?.id],
    queryFn: () => base44.entities.Payment.filter({ debtor_id: debtor.id }, '-payment_date'),
    enabled: !!debtor?.id && open,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ['followUps', debtor?.id],
    queryFn: () => base44.entities.FollowUp.filter({ debtor_id: debtor.id }, '-follow_up_date'),
    enabled: !!debtor?.id && open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices', debtor?.id] });
    queryClient.invalidateQueries({ queryKey: ['payments', debtor?.id] });
    queryClient.invalidateQueries({ queryKey: ['followUps', debtor?.id] });
    queryClient.invalidateQueries({ queryKey: ['debtors'] });
  };

  const recalcDebtor = async (newInvoices, newPayments) => {
    const totalInvoiced = newInvoices.reduce((s, i) => s + (i.amount || 0), 0);
    const totalReceived = newPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalReceived);
    await base44.entities.Debtor.update(debtor.id, { total_invoiced: totalInvoiced, total_received: totalReceived, total_outstanding: totalOutstanding });
  };

  const createInvoiceMut = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: async (newInv) => {
      const allInvoices = [...invoices, newInv];
      await recalcDebtor(allInvoices, payments);
      invalidate();
      setShowInvoiceForm(false);
      setEditingInvoice(null);
      toast({ title: 'Invoice added' });
    },
  });

  const updateInvoiceMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: async (updated) => {
      const allInvoices = invoices.map(i => i.id === updated.id ? updated : i);
      await recalcDebtor(allInvoices, payments);
      invalidate();
      setShowInvoiceForm(false);
      setEditingInvoice(null);
      toast({ title: 'Invoice updated' });
    },
  });

  const deleteInvoiceMut = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: async (_, id) => {
      const allInvoices = invoices.filter(i => i.id !== id);
      await recalcDebtor(allInvoices, payments);
      invalidate();
      toast({ title: 'Invoice deleted' });
    },
  });

  const createPaymentMut = useMutation({
    mutationFn: async (data) => {
      const payment = await base44.entities.Payment.create(data);
      if (data.invoice_id) {
        const inv = invoices.find(i => i.id === data.invoice_id);
        if (inv) {
          const newPaid = (inv.amount_paid || 0) + data.amount;
          const status = newPaid >= inv.amount ? 'paid' : 'partial';
          await base44.entities.Invoice.update(data.invoice_id, { amount_paid: newPaid, status });
        }
      }
      return payment;
    },
    onSuccess: async (newPayment) => {
      const allPayments = [...payments, newPayment];
      const allInvoices = newPayment.invoice_id
        ? invoices.map(i => {
            if (i.id !== newPayment.invoice_id) return i;
            const newPaid = (i.amount_paid || 0) + newPayment.amount;
            return { ...i, amount_paid: newPaid, status: newPaid >= i.amount ? 'paid' : 'partial' };
          })
        : invoices;
      await recalcDebtor(allInvoices, allPayments);
      invalidate();
      setShowPaymentForm(false);
      toast({ title: 'Payment recorded' });
    },
  });

  const createFollowUpMut = useMutation({
    mutationFn: (data) => base44.entities.FollowUp.create(data),
    onSuccess: () => { invalidate(); setShowFollowUpForm(false); toast({ title: 'Follow-up logged' }); },
  });

  const handleInvoiceSave = (data) => {
    if (editingInvoice) updateInvoiceMut.mutate({ id: editingInvoice.id, data });
    else createInvoiceMut.mutate(data);
  };

  if (!debtor) return null;

  const outstanding = debtor.total_outstanding || 0;
  const invoiced = debtor.total_invoiced || 0;
  const received = debtor.total_received || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between pr-8">
              <div>
                <DialogTitle className="text-xl">{debtor.name}</DialogTitle>
                <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                  {debtor.contact_person && <span className="flex items-center gap-1"><span>{debtor.contact_person}</span></span>}
                  {debtor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{debtor.phone}</span>}
                  {debtor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{debtor.email}</span>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={onEditDebtor}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            </div>
          </DialogHeader>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-3 text-center">
                <div className="text-xs text-blue-600 font-medium mb-0.5">Total Invoiced</div>
                <div className="text-lg font-bold text-blue-700">{formatINR(invoiced)}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="p-3 text-center">
                <div className="text-xs text-emerald-600 font-medium mb-0.5">Total Received</div>
                <div className="text-lg font-bold text-emerald-700">{formatINR(received)}</div>
              </CardContent>
            </Card>
            <Card className={`border ${outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <CardContent className="p-3 text-center">
                <div className={`text-xs font-medium mb-0.5 ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Outstanding</div>
                <div className={`text-lg font-bold ${outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatINR(outstanding)}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="invoices" className="mt-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="invoices" className="gap-1"><FileText className="w-3.5 h-3.5" />Invoices ({invoices.length})</TabsTrigger>
              <TabsTrigger value="payments" className="gap-1"><CreditCard className="w-3.5 h-3.5" />Payments ({payments.length})</TabsTrigger>
              <TabsTrigger value="followups" className="gap-1"><MessageSquare className="w-3.5 h-3.5" />Follow-Ups ({followUps.length})</TabsTrigger>
            </TabsList>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="mt-3">
              <div className="flex justify-end mb-3">
                <Button size="sm" onClick={() => { setEditingInvoice(null); setShowInvoiceForm(true); }} className="gap-1">
                  <Plus className="w-4 h-4" /> Add Invoice
                </Button>
              </div>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No invoices yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(inv => {
                      const bal = (inv.amount || 0) - (inv.amount_paid || 0);
                      const days = daysUntilDue(inv.due_date);
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoice_number || '-'}</TableCell>
                          <TableCell>{formatDateIN(inv.invoice_date)}</TableCell>
                          <TableCell>
                            <div>{formatDateIN(inv.due_date)}</div>
                            {days !== null && days < 0 && inv.status !== 'paid' && (
                              <div className="text-xs text-red-500">{Math.abs(days)}d overdue</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatINR(inv.amount)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatINR(inv.amount_paid)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatINR(bal)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              inv.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              inv.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }>
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingInvoice(inv); setShowInvoiceForm(true); }}>
                                  <Pencil className="w-4 h-4 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete invoice?')) deleteInvoiceMut.mutate(inv.id); }}>
                                  <Trash2 className="w-4 h-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments" className="mt-3">
              <div className="flex justify-end mb-3">
                <Button size="sm" onClick={() => setShowPaymentForm(true)} className="gap-1">
                  <Plus className="w-4 h-4" /> Record Payment
                </Button>
              </div>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No payments recorded</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDateIN(p.payment_date)}</TableCell>
                        <TableCell>{p.invoice_number || <span className="text-muted-foreground text-xs">Unallocated</span>}</TableCell>
                        <TableCell className="capitalize">{p.payment_mode?.replace('_', ' ')}</TableCell>
                        <TableCell>{p.reference_number || '-'}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">{formatINR(p.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Follow-Ups Tab */}
            <TabsContent value="followups" className="mt-3">
              <div className="flex justify-end mb-3">
                <Button size="sm" onClick={() => setShowFollowUpForm(true)} className="gap-1">
                  <Plus className="w-4 h-4" /> Log Follow-Up
                </Button>
              </div>
              {followUps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No follow-ups logged</div>
              ) : (
                <div className="space-y-3">
                  {followUps.map(f => (
                    <div key={f.id} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="text-xl mt-0.5">{FOLLOWUP_ICONS[f.type] || '📝'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">{f.type}</span>
                          <span className="text-xs text-muted-foreground">{formatDateIN(f.follow_up_date)}</span>
                          {f.outcome && (
                            <Badge variant="outline" className={`text-xs ${OUTCOME_COLORS[f.outcome] || ''}`}>
                              {f.outcome.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1 text-foreground">{f.notes}</p>
                        {f.promise_date && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            Promise: {formatINR(f.promise_amount)} by {formatDateIN(f.promise_date)}
                          </p>
                        )}
                        {f.next_follow_up_date && (
                          <p className="text-xs text-blue-600 mt-0.5">Next follow-up: {formatDateIN(f.next_follow_up_date)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <InvoiceForm
        open={showInvoiceForm}
        onClose={() => { setShowInvoiceForm(false); setEditingInvoice(null); }}
        onSave={handleInvoiceSave}
        editData={editingInvoice}
        debtorId={debtor?.id}
        debtorName={debtor?.name}
        debtor={debtor}
      />
      <PaymentForm
        open={showPaymentForm}
        onClose={() => setShowPaymentForm(false)}
        onSave={(data) => createPaymentMut.mutate(data)}
        debtorId={debtor?.id}
        debtorName={debtor?.name}
        invoices={invoices}
      />
      <FollowUpForm
        open={showFollowUpForm}
        onClose={() => setShowFollowUpForm(false)}
        onSave={(data) => createFollowUpMut.mutate(data)}
        debtorId={debtor?.id}
        debtorName={debtor?.name}
      />
    </>
  );
}