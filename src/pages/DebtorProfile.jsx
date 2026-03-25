import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN, daysUntilDue } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, FileText, CreditCard,
  MessageSquare, Upload, Plus, Pencil, Trash2, MoreHorizontal,
  TrendingUp, AlertCircle, CheckCircle, Clock, Award, Filter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import InvoiceForm from '@/components/debtors/InvoiceForm';
import PaymentForm from '@/components/debtors/PaymentForm';
import FollowUpForm from '@/components/debtors/FollowUpForm';
import DebtorForm from '@/components/debtors/DebtorForm';
import PaymentReceiptModal from '@/components/debtors/PaymentReceiptModal';

const FOLLOWUP_ICONS = { call: '📞', email: '📧', whatsapp: '💬', visit: '🏢', sms: '📱', note: '📝' };
const OUTCOME_COLORS = {
  promised_payment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial_commitment: 'bg-amber-50 text-amber-700 border-amber-200',
  disputed: 'bg-red-50 text-red-700 border-red-200',
  no_response: 'bg-gray-50 text-gray-700 border-gray-200',
  resolved: 'bg-blue-50 text-blue-700 border-blue-200',
  other: 'bg-purple-50 text-purple-700 border-purple-200',
};

function PaymentHealthScore({ invoices }) {
  const score = useMemo(() => {
    if (!invoices.length) return null;
    const total = invoices.length;
    const paid = invoices.filter(i => i.status === 'paid').length;
    const overdue = invoices.filter(i => {
      const days = daysUntilDue(i.due_date);
      return days !== null && days < 0 && i.status !== 'paid';
    }).length;
    const onTime = invoices.filter(i => {
      const days = daysUntilDue(i.due_date);
      return i.status === 'paid' && (days === null || days >= 0);
    }).length;

    const baseScore = Math.round((paid / total) * 60 + (onTime / Math.max(total, 1)) * 40);
    const penalty = Math.min(overdue * 8, 40);
    return Math.max(0, Math.min(100, baseScore - penalty));
  }, [invoices]);

  if (score === null) return null;

  const color = score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  const bg = score >= 75 ? 'bg-emerald-50 border-emerald-200' : score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const label = score >= 75 ? 'Excellent' : score >= 50 ? 'Fair' : 'Poor';
  const barColor = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Card className={`border ${bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Award className={`w-8 h-8 ${color}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-muted-foreground">Payment Health Score</span>
              <span className={`text-xl font-bold ${color}`}>{score}/100</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full">
              <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
            </div>
            <div className={`text-xs mt-1 font-medium ${color}`}>{label} — Based on payment timeliness & completion</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityTimeline({ payments, followUps, invoices }) {
  const events = useMemo(() => {
    const items = [
      ...payments.map(p => ({ type: 'payment', date: p.payment_date, data: p })),
      ...followUps.map(f => ({ type: 'followup', date: f.follow_up_date, data: f })),
      ...invoices.map(i => ({ type: 'invoice', date: i.invoice_date || i.created_date, data: i })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    return items;
  }, [payments, followUps, invoices]);

  if (!events.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">No activity yet</div>
  );

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-4 pl-12">
        {events.map((evt, idx) => {
          if (evt.type === 'payment') {
            const p = evt.data;
            return (
              <div key={`pay-${p.id}`} className="relative">
                <div className="absolute -left-[2.35rem] w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-3 h-3 text-emerald-600" />
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-700">Payment Received</span>
                    <span className="text-xs text-muted-foreground">{formatDateIN(p.payment_date)}</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-700">{formatINR(p.amount)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.payment_mode?.replace('_', ' ').toUpperCase()} {p.reference_number ? `· Ref: ${p.reference_number}` : ''}
                    {p.invoice_number ? ` · ${p.invoice_number}` : ' · Unallocated'}
                  </div>
                  {p.notes && <div className="text-xs text-foreground mt-1">{p.notes}</div>}
                </div>
              </div>
            );
          }
          if (evt.type === 'followup') {
            const f = evt.data;
            return (
              <div key={`fu-${f.id}`} className="relative">
                <div className="absolute -left-[2.35rem] w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center">
                  <MessageSquare className="w-3 h-3 text-blue-600" />
                </div>
                <div className="bg-muted/40 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{FOLLOWUP_ICONS[f.type] || '📝'}</span>
                      <span className="text-sm font-semibold capitalize">{f.type} Follow-Up</span>
                      {f.outcome && (
                        <Badge variant="outline" className={`text-xs ${OUTCOME_COLORS[f.outcome] || ''}`}>
                          {f.outcome.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateIN(f.follow_up_date)}</span>
                  </div>
                  {f.notes && <p className="text-sm mt-1">{f.notes}</p>}
                  {f.promise_date && (
                    <p className="text-xs text-amber-600 mt-1">
                      Promised {formatINR(f.promise_amount)} by {formatDateIN(f.promise_date)}
                    </p>
                  )}
                  {f.next_follow_up_date && (
                    <p className="text-xs text-blue-600 mt-0.5">Next: {formatDateIN(f.next_follow_up_date)}</p>
                  )}
                </div>
              </div>
            );
          }
          if (evt.type === 'invoice') {
            const inv = evt.data;
            return (
              <div key={`inv-${inv.id}`} className="relative">
                <div className="absolute -left-[2.35rem] w-6 h-6 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
                  <FileText className="w-3 h-3 text-purple-600" />
                </div>
                <div className="bg-muted/30 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Invoice {inv.invoice_number || 'Added'}</span>
                    <span className="text-xs text-muted-foreground">{formatDateIN(inv.invoice_date || inv.created_date)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{formatINR(inv.amount)} · Due {formatDateIN(inv.due_date)}</div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default function DebtorProfile({ debtorId, onBack }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showEditDebtor, setShowEditDebtor] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Invoice filters
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [paidMin, setPaidMin] = useState('');
  const [paidMax, setPaidMax] = useState('');
  // Payment/FollowUp filters
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState('all');
  const [followUpOutcomeFilter, setFollowUpOutcomeFilter] = useState('all');

  const { data: debtor, isLoading: loadingDebtor } = useQuery({
    queryKey: ['debtor', debtorId],
    queryFn: () => base44.entities.Debtor.filter({ id: debtorId }).then(r => r[0]),
    enabled: !!debtorId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', debtorId],
    queryFn: () => base44.entities.Invoice.filter({ debtor_id: debtorId }, '-invoice_date'),
    enabled: !!debtorId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', debtorId],
    queryFn: () => base44.entities.Payment.filter({ debtor_id: debtorId }, '-payment_date'),
    enabled: !!debtorId,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ['followUps', debtorId],
    queryFn: () => base44.entities.FollowUp.filter({ debtor_id: debtorId }, '-follow_up_date'),
    enabled: !!debtorId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices', debtorId] });
    queryClient.invalidateQueries({ queryKey: ['payments', debtorId] });
    queryClient.invalidateQueries({ queryKey: ['followUps', debtorId] });
    queryClient.invalidateQueries({ queryKey: ['debtor', debtorId] });
    queryClient.invalidateQueries({ queryKey: ['debtors'] });
  };

  const recalcDebtor = async (allInvoices, allPayments) => {
    const totalInvoiced = allInvoices.reduce((s, i) => s + (i.amount || 0), 0);
    const totalReceived = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalReceived);
    const newStatus = totalOutstanding <= 0 && totalInvoiced > 0 ? 'paid' : 'active';
    await base44.entities.Debtor.update(debtorId, { total_invoiced: totalInvoiced, total_received: totalReceived, total_outstanding: totalOutstanding, status: newStatus });
  };

  const createInvoiceMut = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: async (newInv) => {
      await recalcDebtor([...invoices, newInv], payments);
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
      setShowPaymentReceipt(false);
      toast({ title: 'Payment recorded successfully' });
    },
  });

  const createFollowUpMut = useMutation({
    mutationFn: (data) => base44.entities.FollowUp.create(data),
    onSuccess: () => { invalidate(); setShowFollowUpForm(false); toast({ title: 'Follow-up logged' }); },
  });

  const updateDebtorMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Debtor.update(id, data),
    onSuccess: () => { invalidate(); setShowEditDebtor(false); toast({ title: 'Debtor updated' }); },
  });

  const filteredInvoices = useMemo(() => invoices.filter(i => {
    if (invoiceStatusFilter !== 'all' && i.status !== invoiceStatusFilter) return false;
    if (invoiceSearch && !(i.invoice_number || '').toLowerCase().includes(invoiceSearch.toLowerCase())) return false;
    if (invoiceDateFrom && (i.invoice_date || '') < invoiceDateFrom) return false;
    if (invoiceDateTo && (i.invoice_date || '') > invoiceDateTo) return false;
    if (dueDateFrom && (i.due_date || '') < dueDateFrom) return false;
    if (dueDateTo && (i.due_date || '') > dueDateTo) return false;
    if (amountMin !== '' && (i.amount || 0) < Number(amountMin)) return false;
    if (amountMax !== '' && (i.amount || 0) > Number(amountMax)) return false;
    if (paidMin !== '' && (i.amount_paid || 0) < Number(paidMin)) return false;
    if (paidMax !== '' && (i.amount_paid || 0) > Number(paidMax)) return false;
    return true;
  }), [invoices, invoiceStatusFilter, invoiceSearch, invoiceDateFrom, invoiceDateTo, dueDateFrom, dueDateTo, amountMin, amountMax, paidMin, paidMax]);

  const filteredPayments = useMemo(() =>
    paymentModeFilter === 'all' ? payments : payments.filter(p => p.payment_mode === paymentModeFilter),
    [payments, paymentModeFilter]
  );

  const filteredFollowUps = useMemo(() => followUps.filter(f => {
    const typeMatch = followUpTypeFilter === 'all' || f.type === followUpTypeFilter;
    const outcomeMatch = followUpOutcomeFilter === 'all' || f.outcome === followUpOutcomeFilter;
    return typeMatch && outcomeMatch;
  }), [followUps, followUpTypeFilter, followUpOutcomeFilter]);

  if (loadingDebtor) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-32 bg-muted animate-pulse rounded-xl" />
    </div>
  );

  if (!debtor) return (
    <div className="text-center py-16 text-muted-foreground">Debtor not found</div>
  );

  const outstanding = debtor.total_outstanding || 0;
  const invoiced = debtor.total_invoiced || 0;
  const received = debtor.total_received || 0;
  const collectionPct = invoiced > 0 ? Math.round((received / invoiced) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{debtor.name}</h1>
            <Badge variant="outline" className={
              outstanding > 0 && received === 0 ? 'bg-red-50 text-red-700 border-red-200' :
              outstanding > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }>
              {outstanding > 0 && received === 0 ? 'Unpaid' : outstanding > 0 ? 'Partial' : 'Paid'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
            {debtor.contact_person && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{debtor.contact_person}</span>}
            {debtor.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{debtor.phone}</span>}
            {debtor.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{debtor.email}</span>}
            {debtor.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{debtor.address}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowEditDebtor(true)}>
          <Pencil className="w-4 h-4 mr-1" /> Edit
        </Button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-blue-600 font-medium mb-1">Total Invoiced</div>
            <div className="text-xl font-bold text-blue-700">{formatINR(invoiced)}</div>
            <div className="text-xs text-blue-500 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-emerald-600 font-medium mb-1">Total Received</div>
            <div className="text-xl font-bold text-emerald-700">{formatINR(received)}</div>
            <div className="text-xs text-emerald-500 mt-0.5">{payments.length} payment{payments.length !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>
        <Card className={outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}>
          <CardContent className="p-4 text-center">
            <div className={`text-xs font-medium mb-1 ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Outstanding</div>
            <div className={`text-xl font-bold ${outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatINR(outstanding)}</div>
            <div className={`text-xs mt-0.5 ${outstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{100 - collectionPct}% remaining</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-purple-600 font-medium mb-1">Collection Rate</div>
            <div className="text-xl font-bold text-purple-700">{collectionPct}%</div>
            <Progress value={collectionPct} className="h-1.5 mt-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Payment Health Score */}
      <PaymentHealthScore invoices={invoices} />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowPaymentReceipt(true)} className="gap-2">
          <CreditCard className="w-4 h-4" /> Record Payment
        </Button>
        <Button variant="outline" onClick={() => { setEditingInvoice(null); setShowInvoiceForm(true); }} className="gap-2">
          <FileText className="w-4 h-4" /> Add Invoice
        </Button>
        <Button variant="outline" onClick={() => setShowFollowUpForm(true)} className="gap-2">
          <MessageSquare className="w-4 h-4" /> Log Follow-Up
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline" className="gap-1"><Clock className="w-3.5 h-3.5" />Timeline</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1"><FileText className="w-3.5 h-3.5" />Invoices ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><CreditCard className="w-3.5 h-3.5" />Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="followups" className="gap-1"><MessageSquare className="w-3.5 h-3.5" />Follow-Ups ({followUps.length})</TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <ActivityTimeline payments={payments} followUps={followUps} invoices={invoices} />
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="mt-4">
          {invoices.length > 0 && (
            <div className="border rounded-lg p-3 bg-muted/30 mb-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                <Filter className="w-3.5 h-3.5" /> Filters
                {filteredInvoices.length !== invoices.length && (
                  <span className="ml-auto text-primary font-semibold">{filteredInvoices.length} of {invoices.length} shown</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* Invoice # search */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Invoice #</div>
                  <Input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="Search..." className="h-7 text-xs" />
                </div>
                {/* Status */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="written_off">Written Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Invoice Date */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Invoice Date From</div>
                  <Input type="date" value={invoiceDateFrom} onChange={e => setInvoiceDateFrom(e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Invoice Date To</div>
                  <Input type="date" value={invoiceDateTo} onChange={e => setInvoiceDateTo(e.target.value)} className="h-7 text-xs" />
                </div>
                {/* Due Date */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Due Date From</div>
                  <Input type="date" value={dueDateFrom} onChange={e => setDueDateFrom(e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Due Date To</div>
                  <Input type="date" value={dueDateTo} onChange={e => setDueDateTo(e.target.value)} className="h-7 text-xs" />
                </div>
                {/* Amount */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Amount (Min)</div>
                  <Input type="number" value={amountMin} onChange={e => setAmountMin(e.target.value)} placeholder="₹ Min" className="h-7 text-xs" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Amount (Max)</div>
                  <Input type="number" value={amountMax} onChange={e => setAmountMax(e.target.value)} placeholder="₹ Max" className="h-7 text-xs" />
                </div>
                {/* Paid */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Paid (Min)</div>
                  <Input type="number" value={paidMin} onChange={e => setPaidMin(e.target.value)} placeholder="₹ Min" className="h-7 text-xs" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Paid (Max)</div>
                  <Input type="number" value={paidMax} onChange={e => setPaidMax(e.target.value)} placeholder="₹ Max" className="h-7 text-xs" />
                </div>
              </div>
              {(invoiceSearch || invoiceStatusFilter !== 'all' || invoiceDateFrom || invoiceDateTo || dueDateFrom || dueDateTo || amountMin || amountMax || paidMin || paidMax) && (
                <button onClick={() => { setInvoiceSearch(''); setInvoiceStatusFilter('all'); setInvoiceDateFrom(''); setInvoiceDateTo(''); setDueDateFrom(''); setDueDateTo(''); setAmountMin(''); setAmountMax(''); setPaidMin(''); setPaidMax(''); }} className="text-xs text-primary hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          )}
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No invoices yet</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No invoices match this filter</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(inv => {
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
                        }>{inv.status}</Badge>
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

        {/* Payments */}
        <TabsContent value="payments" className="mt-4">
          {payments.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Payment Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="imps">IMPS</SelectItem>
                </SelectContent>
              </Select>
              {paymentModeFilter !== 'all' && (
                <span className="text-xs text-muted-foreground">{filteredPayments.length} of {payments.length}</span>
              )}
            </div>
          )}
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No payments recorded</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No payments match this filter</div>
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
                {filteredPayments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateIN(p.payment_date)}</TableCell>
                    <TableCell>{p.invoice_number || <span className="text-muted-foreground text-xs">Unallocated</span>}</TableCell>
                    <TableCell className="capitalize">{p.payment_mode?.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{p.reference_number || '-'}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{formatINR(p.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Follow-Ups */}
        <TabsContent value="followups" className="mt-4">
          {followUps.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={followUpTypeFilter} onValueChange={setFollowUpTypeFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="visit">Visit</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
              <Select value={followUpOutcomeFilter} onValueChange={setFollowUpOutcomeFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="promised_payment">Promised Payment</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                  <SelectItem value="partial_commitment">Partial Commitment</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {(followUpTypeFilter !== 'all' || followUpOutcomeFilter !== 'all') && (
                <span className="text-xs text-muted-foreground">{filteredFollowUps.length} of {followUps.length}</span>
              )}
            </div>
          )}
          {followUps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No follow-ups logged</div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No follow-ups match this filter</div>
          ) : (
            <div className="space-y-3">
              {filteredFollowUps.map(f => (
                <div key={f.id} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="text-xl mt-0.5">{FOLLOWUP_ICONS[f.type] || '📝'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{f.type}</span>
                      <span className="text-xs text-muted-foreground">{formatDateIN(f.follow_up_date)}</span>
                      {f.outcome && (
                        <Badge variant="outline" className={`text-xs ${OUTCOME_COLORS[f.outcome] || ''}`}>
                          {f.outcome.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1">{f.notes}</p>
                    {f.promise_date && <p className="text-xs text-amber-600 mt-0.5">Promise: {formatINR(f.promise_amount)} by {formatDateIN(f.promise_date)}</p>}
                    {f.next_follow_up_date && <p className="text-xs text-blue-600 mt-0.5">Next follow-up: {formatDateIN(f.next_follow_up_date)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Forms */}
      <InvoiceForm
        open={showInvoiceForm}
        onClose={() => { setShowInvoiceForm(false); setEditingInvoice(null); }}
        onSave={(data) => editingInvoice ? updateInvoiceMut.mutate({ id: editingInvoice.id, data }) : createInvoiceMut.mutate(data)}
        editData={editingInvoice}
        debtorId={debtorId}
        debtorName={debtor?.name}
      />
      <PaymentReceiptModal
        open={showPaymentReceipt}
        onClose={() => setShowPaymentReceipt(false)}
        onSave={(data) => createPaymentMut.mutate(data)}
        debtorId={debtorId}
        debtorName={debtor?.name}
        invoices={invoices}
        outstanding={outstanding}
      />
      <FollowUpForm
        open={showFollowUpForm}
        onClose={() => setShowFollowUpForm(false)}
        onSave={(data) => createFollowUpMut.mutate(data)}
        debtorId={debtorId}
        debtorName={debtor?.name}
      />
      <DebtorForm
        open={showEditDebtor}
        onClose={() => setShowEditDebtor(false)}
        onSave={(data) => updateDebtorMut.mutate({ id: debtor.id, data })}
        editData={debtor}
      />
    </div>
  );
}