import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Phone, Mail, CreditCard, MessageSquare, FileText, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import PaymentReceiptModal from '@/components/debtors/PaymentReceiptModal';
import FollowUpForm from '@/components/debtors/FollowUpForm';
import InvoiceForm from '@/components/debtors/InvoiceForm';

const FOLLOWUP_ICONS = { call: '📞', email: '📧', whatsapp: '💬', visit: '🏢', sms: '📱', note: '📝' };

function DebtorRow({ debtor, onRecordPayment, onLogFollowUp, onAddInvoice }) {
  const [expanded, setExpanded] = useState(false);
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', debtor.id],
    queryFn: () => base44.entities.Invoice.filter({ debtor_id: debtor.id }, '-invoice_date'),
    enabled: expanded,
  });
  const { data: followUps = [] } = useQuery({
    queryKey: ['followUps', debtor.id],
    queryFn: () => base44.entities.FollowUp.filter({ debtor_id: debtor.id }, '-follow_up_date'),
    enabled: expanded,
  });

  const outstanding = debtor.total_outstanding || 0;
  const invoiced = debtor.total_invoiced || 0;
  const received = debtor.total_received || 0;
  const pct = invoiced > 0 ? Math.round((received / invoiced) * 100) : 0;
  const statusColor = outstanding > 0 && received === 0 ? 'bg-red-50 text-red-700 border-red-200' :
    outstanding > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-emerald-50 text-emerald-700 border-emerald-200';
  const statusLabel = outstanding > 0 && received === 0 ? 'Unpaid' : outstanding > 0 ? 'Partial' : 'Paid';

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{debtor.name}</span>
            <Badge variant="outline" className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
          </div>
          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {debtor.contact_person && <span>{debtor.contact_person}</span>}
            {debtor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{debtor.phone}</span>}
            {debtor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{debtor.email}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-red-600">{formatINR(outstanding)}</div>
          <div className="text-xs text-muted-foreground">outstanding</div>
        </div>
        <div className="hidden md:block w-32 shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Collected</span><span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => onRecordPayment(debtor)} className="text-xs h-7 px-2">
            <CreditCard className="w-3 h-3 mr-1" />Pay
          </Button>
          <Button size="sm" variant="outline" onClick={() => onLogFollowUp(debtor)} className="text-xs h-7 px-2">
            <MessageSquare className="w-3 h-3 mr-1" />Log
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/10 p-4">
          <Tabs defaultValue="invoices">
            <TabsList className="h-8">
              <TabsTrigger value="invoices" className="text-xs h-7">Invoices ({invoices.length})</TabsTrigger>
              <TabsTrigger value="followups" className="text-xs h-7">Follow-Ups ({followUps.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="mt-3">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onAddInvoice(debtor)}>
                  <FileText className="w-3 h-3" /> Add Invoice
                </Button>
              </div>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No invoices yet</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => {
                    const bal = (inv.amount || 0) - (inv.amount_paid || 0);
                    return (
                      <div key={inv.id} className="flex items-center justify-between p-2 rounded border bg-background text-sm">
                        <div>
                          <span className="font-medium">{inv.invoice_number || 'No #'}</span>
                          <span className="text-muted-foreground ml-2">Due {formatDateIN(inv.due_date)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{formatINR(inv.amount)}</span>
                          <span className="text-emerald-600">Paid: {formatINR(inv.amount_paid)}</span>
                          <span className="font-semibold text-red-600">Bal: {formatINR(bal)}</span>
                          <Badge variant="outline" className={
                            inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs' :
                            inv.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200 text-xs' :
                            'bg-gray-50 text-gray-700 border-gray-200 text-xs'
                          }>{inv.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="followups" className="mt-3">
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No follow-ups yet</p>
              ) : (
                <div className="space-y-2">
                  {followUps.slice(0, 5).map(f => (
                    <div key={f.id} className="flex gap-3 p-2 rounded border bg-background text-sm">
                      <span className="text-base">{FOLLOWUP_ICONS[f.type] || '📝'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{f.type}</span>
                          <span className="text-xs text-muted-foreground">{formatDateIN(f.follow_up_date)}</span>
                        </div>
                        <p className="text-muted-foreground">{f.notes}</p>
                        {f.next_follow_up_date && (
                          <p className="text-xs text-blue-600 mt-0.5">Next: {formatDateIN(f.next_follow_up_date)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Card>
  );
}

export default function MyCollections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [paymentTarget, setPaymentTarget] = useState(null); // debtor
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [invoiceTarget, setInvoiceTarget] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: debtors = [], isLoading } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list('-created_date'),
  });

  const { data: myTarget } = useQuery({
    queryKey: ['collectionTargets', currentUser?.email],
    queryFn: async () => {
      const now = new Date();
      const results = await base44.entities.CollectionTarget.filter({ manager_email: currentUser.email });
      return results.find(t => t.period_month === now.getMonth() + 1 && t.period_year === now.getFullYear()) || null;
    },
    enabled: !!currentUser?.email,
  });

  const myDebtors = useMemo(() => {
    if (!currentUser?.email) return [];
    return debtors.filter(d => d.assigned_manager === currentUser.email);
  }, [debtors, currentUser]);

  const filtered = useMemo(() => {
    if (!search) return myDebtors;
    const q = search.toLowerCase();
    return myDebtors.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.contact_person || '').toLowerCase().includes(q)
    );
  }, [myDebtors, search]);

  const activeDebtors = filtered.filter(d => (d.total_outstanding || 0) > 0);
  const collectedDebtors = filtered.filter(d => (d.total_outstanding || 0) <= 0 && (d.total_invoiced || 0) > 0);
  const totalOutstanding = myDebtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);
  const totalCollected = myDebtors.reduce((s, d) => s + (d.total_received || 0), 0);

  const { data: paymentTargetInvoices = [] } = useQuery({
    queryKey: ['invoices', paymentTarget?.id],
    queryFn: () => base44.entities.Invoice.filter({ debtor_id: paymentTarget.id }, '-invoice_date'),
    enabled: !!paymentTarget?.id,
  });

  const createPaymentMut = useMutation({
    mutationFn: async (data) => {
      const payment = await base44.entities.Payment.create(data);
      if (data.invoice_id) {
        const inv = paymentTargetInvoices.find(i => i.id === data.invoice_id);
        if (inv) {
          const newPaid = (inv.amount_paid || 0) + data.amount;
          const status = newPaid >= inv.amount ? 'paid' : 'partial';
          await base44.entities.Invoice.update(data.invoice_id, { amount_paid: newPaid, status });
        }
      }
      const allPayments = await base44.entities.Payment.filter({ debtor_id: data.debtor_id });
      const allInvoices = await base44.entities.Invoice.filter({ debtor_id: data.debtor_id });
      const totalInvoiced = allInvoices.reduce((s, i) => s + (i.amount || 0), 0);
      const totalReceived = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const totalOutstanding = Math.max(0, totalInvoiced - totalReceived);
      const newStatus = totalOutstanding <= 0 && totalInvoiced > 0 ? 'paid' : 'active';
      await base44.entities.Debtor.update(data.debtor_id, { total_invoiced: totalInvoiced, total_received: totalReceived, total_outstanding: totalOutstanding, status: newStatus });
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', paymentTarget?.id] });
      queryClient.invalidateQueries({ queryKey: ['payments', paymentTarget?.id] });
      setPaymentTarget(null);
      toast({ title: 'Payment recorded' });
    },
  });

  const createFollowUpMut = useMutation({
    mutationFn: (data) => base44.entities.FollowUp.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followUps', followUpTarget?.id] });
      setFollowUpTarget(null);
      toast({ title: 'Follow-up logged' });
    },
  });

  const createInvoiceMut = useMutation({
    mutationFn: async (data) => {
      const inv = await base44.entities.Invoice.create(data);
      const allInvoices = await base44.entities.Invoice.filter({ debtor_id: data.debtor_id });
      const allPayments = await base44.entities.Payment.filter({ debtor_id: data.debtor_id });
      const totalInvoiced = allInvoices.reduce((s, i) => s + (i.amount || 0), 0);
      const totalReceived = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
      await base44.entities.Debtor.update(data.debtor_id, { total_invoiced: totalInvoiced, total_received: totalReceived, total_outstanding: Math.max(0, totalInvoiced - totalReceived) });
      return inv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', invoiceTarget?.id] });
      setInvoiceTarget(null);
      toast({ title: 'Invoice added' });
    },
  });

  const targetAmount = myTarget?.target_amount || 0;
  const targetPct = targetAmount > 0 ? Math.min(100, Math.round((totalCollected / targetAmount) * 100)) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Collections"
        subtitle={`${myDebtors.length} assigned debtors · ${formatINR(totalOutstanding)} outstanding`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4">
            <div className="text-xs text-red-600 font-medium">Outstanding</div>
            <div className="text-xl font-bold text-red-700 mt-0.5">{formatINR(totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-600 font-medium">Collected</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{formatINR(totalCollected)}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="text-xs text-blue-600 font-medium">Active Debtors</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{activeDebtors.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4">
            <div className="text-xs text-amber-600 font-medium">Monthly Target</div>
            {targetAmount > 0 ? (
              <>
                <div className="text-xl font-bold text-amber-700 mt-0.5">{targetPct}%</div>
                <Progress value={targetPct} className="h-1.5 mt-1" />
                <div className="text-xs text-amber-600 mt-0.5">{formatINR(totalCollected)} / {formatINR(targetAmount)}</div>
              </>
            ) : (
              <div className="text-sm text-amber-600 mt-0.5">No target set</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search debtors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : myDebtors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-semibold">No debtors assigned to you</p>
          <p className="text-sm mt-1">Ask your admin to assign debtors to your account</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeDebtors.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-3">
                Active — {activeDebtors.length}
              </h2>
              <div className="space-y-2">
                {activeDebtors.map(d => (
                  <DebtorRow
                    key={d.id}
                    debtor={d}
                    onRecordPayment={setPaymentTarget}
                    onLogFollowUp={setFollowUpTarget}
                    onAddInvoice={setInvoiceTarget}
                  />
                ))}
              </div>
            </div>
          )}
          {collectedDebtors.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-3">
                Collected — {collectedDebtors.length}
              </h2>
              <div className="space-y-2">
                {collectedDebtors.map(d => (
                  <DebtorRow
                    key={d.id}
                    debtor={d}
                    onRecordPayment={setPaymentTarget}
                    onLogFollowUp={setFollowUpTarget}
                    onAddInvoice={setInvoiceTarget}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PaymentReceiptModal
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSave={(data) => createPaymentMut.mutate(data)}
        debtorId={paymentTarget?.id}
        debtorName={paymentTarget?.name}
        invoices={paymentTargetInvoices}
        outstanding={paymentTarget?.total_outstanding || 0}
      />
      <FollowUpForm
        open={!!followUpTarget}
        onClose={() => setFollowUpTarget(null)}
        onSave={(data) => createFollowUpMut.mutate(data)}
        debtorId={followUpTarget?.id}
        debtorName={followUpTarget?.name}
      />
      <InvoiceForm
        open={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        onSave={(data) => createInvoiceMut.mutate(data)}
        debtorId={invoiceTarget?.id}
        debtorName={invoiceTarget?.name}
      />
    </div>
  );
}