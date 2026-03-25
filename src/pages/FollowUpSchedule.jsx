import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Phone, Mail, Building2, MessageSquare, CalendarClock,
  AlertTriangle, CheckCircle2, Clock, ChevronRight, Filter
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import FollowUpForm from '@/components/debtors/FollowUpForm';
import { useNavigate } from 'react-router-dom';

const TODAY = new Date().toISOString().split('T')[0];

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const diff = Math.round((new Date(dateStr) - new Date(TODAY)) / 86400000);
  return diff;
}

const FOLLOWUP_ICONS = { call: '📞', email: '📧', whatsapp: '💬', visit: '🏢', sms: '📱', note: '📝' };
const OUTCOME_COLORS = {
  promised_payment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial_commitment: 'bg-amber-50 text-amber-700 border-amber-200',
  disputed: 'bg-red-50 text-red-700 border-red-200',
  no_response: 'bg-gray-50 text-gray-700 border-gray-200',
  resolved: 'bg-blue-50 text-blue-700 border-blue-200',
  other: 'bg-purple-50 text-purple-700 border-purple-200',
};

function UrgencyBadge({ days, label }) {
  if (days === null) return null;
  if (days < 0) return <span className="text-xs font-semibold text-red-600">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="text-xs font-semibold text-orange-600">Today</span>;
  if (days <= 3) return <span className="text-xs font-semibold text-amber-600">In {days}d</span>;
  return <span className="text-xs text-muted-foreground">In {days}d</span>;
}

function FollowUpCard({ item, onLogFollowUp, onViewDebtor }) {
  const { debtor, latestFollowUp, overdueInvoices, totalOutstanding } = item;
  const nextDate = latestFollowUp?.next_follow_up_date;
  const nextDays = daysDiff(nextDate);

  const urgencyBg =
    nextDays !== null && nextDays < 0 ? 'border-l-4 border-l-red-500 bg-red-50/30' :
    nextDays !== null && nextDays === 0 ? 'border-l-4 border-l-orange-500 bg-orange-50/30' :
    nextDays !== null && nextDays <= 3 ? 'border-l-4 border-l-amber-400 bg-amber-50/20' :
    'border-l-4 border-l-border';

  return (
    <Card className={`${urgencyBg}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: debtor info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onViewDebtor}
                className="text-base font-semibold hover:text-primary hover:underline truncate"
              >
                {debtor.name}
              </button>
              {debtor.assigned_manager && (
                <span className="text-xs text-muted-foreground">· {debtor.assigned_manager}</span>
              )}
            </div>

            {/* Contact */}
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
              {debtor.contact_person && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{debtor.contact_person}</span>}
              {debtor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{debtor.phone}</span>}
              {debtor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{debtor.email}</span>}
            </div>

            {/* Outstanding + Overdue invoices */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-sm font-bold text-red-600">{formatINR(totalOutstanding)} outstanding</span>
              {overdueInvoices.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertTriangle className="w-3 h-3" />
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}
                  &nbsp;·&nbsp;oldest due {formatDateIN(overdueInvoices[0].due_date)}
                </span>
              )}
            </div>

            {/* Overdue invoice details (compact) */}
            {overdueInvoices.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {overdueInvoices.slice(0, 4).map(inv => (
                  <span key={inv.id} className="inline-flex items-center gap-1 text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded-full">
                    {inv.invoice_number || 'INV'} · {formatINR((inv.amount || 0) - (inv.amount_paid || 0))}
                    <span className="text-red-400">({Math.abs(daysDiff(inv.due_date))}d overdue)</span>
                  </span>
                ))}
                {overdueInvoices.length > 4 && (
                  <span className="text-xs text-muted-foreground">+{overdueInvoices.length - 4} more</span>
                )}
              </div>
            )}

            {/* Last follow-up */}
            {latestFollowUp && (
              <div className="mt-2 p-2 rounded-md bg-muted/40 border text-xs">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span>{FOLLOWUP_ICONS[latestFollowUp.type] || '📝'}</span>
                  <span className="font-medium capitalize">{latestFollowUp.type}</span>
                  <span className="text-muted-foreground">on {formatDateIN(latestFollowUp.follow_up_date)}</span>
                  {latestFollowUp.outcome && (
                    <Badge variant="outline" className={`text-xs py-0 ${OUTCOME_COLORS[latestFollowUp.outcome] || ''}`}>
                      {latestFollowUp.outcome.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
                {latestFollowUp.notes && <p className="text-muted-foreground line-clamp-1">{latestFollowUp.notes}</p>}
                {latestFollowUp.promise_date && (
                  <p className="text-amber-600 mt-0.5">
                    Promised {formatINR(latestFollowUp.promise_amount)} by {formatDateIN(latestFollowUp.promise_date)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: next follow-up date + action */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {nextDate ? (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Next Follow-Up</div>
                <div className="text-sm font-semibold">{formatDateIN(nextDate)}</div>
                <UrgencyBadge days={nextDays} />
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">No follow-up scheduled</div>
              </div>
            )}
            <Button size="sm" className="gap-1 h-7 text-xs" onClick={onLogFollowUp}>
              <MessageSquare className="w-3 h-3" /> Log
            </Button>
            <button onClick={onViewDebtor} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FollowUpSchedule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('upcoming');
  const [managerFilter, setManagerFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpFormDebtor, setFollowUpFormDebtor] = useState(null);

  const { data: debtors = [], isLoading: loadingDebtors } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list(),
  });

  const { data: followUps = [], isLoading: loadingFollowUps } = useQuery({
    queryKey: ['allFollowUps'],
    queryFn: () => base44.entities.FollowUp.list('-follow_up_date'),
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['allInvoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const createFollowUpMut = useMutation({
    mutationFn: (data) => base44.entities.FollowUp.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allFollowUps'] });
      setFollowUpFormDebtor(null);
      toast({ title: 'Follow-up logged' });
    },
  });

  // Build per-debtor aggregated items
  const debtorItems = useMemo(() => {
    const followUpsByDebtor = {};
    followUps.forEach(f => {
      if (!followUpsByDebtor[f.debtor_id]) followUpsByDebtor[f.debtor_id] = [];
      followUpsByDebtor[f.debtor_id].push(f);
    });

    const invoicesByDebtor = {};
    invoices.forEach(inv => {
      if (!invoicesByDebtor[inv.debtor_id]) invoicesByDebtor[inv.debtor_id] = [];
      invoicesByDebtor[inv.debtor_id].push(inv);
    });

    return debtors
      .filter(d => (d.total_outstanding || 0) > 0)
      .map(debtor => {
        const dFollowUps = (followUpsByDebtor[debtor.id] || [])
          .sort((a, b) => new Date(b.follow_up_date) - new Date(a.follow_up_date));
        const latestFollowUp = dFollowUps[0] || null;

        const dInvoices = invoicesByDebtor[debtor.id] || [];
        const overdueInvoices = dInvoices
          .filter(i => i.status !== 'paid' && i.status !== 'written_off' && i.due_date && i.due_date < TODAY)
          .sort((a, b) => a.due_date.localeCompare(b.due_date));

        const nextDate = latestFollowUp?.next_follow_up_date || null;
        const nextDays = daysDiff(nextDate);

        return {
          debtor,
          latestFollowUp,
          overdueInvoices,
          totalOutstanding: debtor.total_outstanding || 0,
          nextDate,
          nextDays,
        };
      });
  }, [debtors, followUps, invoices]);

  const managers = useMemo(() => {
    const set = new Set(debtors.map(d => d.assigned_manager).filter(Boolean));
    return [...set];
  }, [debtors]);

  const filtered = useMemo(() => {
    let items = debtorItems;

    if (managerFilter !== 'all') {
      items = items.filter(i => i.debtor.assigned_manager === managerFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.debtor.name.toLowerCase().includes(q) ||
        (i.debtor.contact_person || '').toLowerCase().includes(q)
      );
    }

    if (activeTab === 'overdue') {
      // Next follow-up is overdue (past due) or no follow-up scheduled but has overdue invoices
      items = items.filter(i => (i.nextDays !== null && i.nextDays < 0) || (!i.nextDate && i.overdueInvoices.length > 0));
      items.sort((a, b) => (a.nextDays ?? 9999) - (b.nextDays ?? 9999));
    } else if (activeTab === 'today') {
      items = items.filter(i => i.nextDays === 0);
    } else if (activeTab === 'upcoming') {
      items = items.filter(i => i.nextDays !== null && i.nextDays > 0);
      items.sort((a, b) => (a.nextDays ?? 9999) - (b.nextDays ?? 9999));
    } else if (activeTab === 'unscheduled') {
      items = items.filter(i => !i.nextDate);
      items.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    } else {
      // All — sort: overdue first, then today, then upcoming, then unscheduled
      items.sort((a, b) => {
        const aScore = a.nextDays === null ? 999 : a.nextDays;
        const bScore = b.nextDays === null ? 999 : b.nextDays;
        return aScore - bScore;
      });
    }

    return items;
  }, [debtorItems, activeTab, managerFilter, searchQuery]);

  const counts = useMemo(() => ({
    overdue: debtorItems.filter(i => (i.nextDays !== null && i.nextDays < 0) || (!i.nextDate && i.overdueInvoices.length > 0)).length,
    today: debtorItems.filter(i => i.nextDays === 0).length,
    upcoming: debtorItems.filter(i => i.nextDays !== null && i.nextDays > 0).length,
    unscheduled: debtorItems.filter(i => !i.nextDate).length,
  }), [debtorItems]);

  const isLoading = loadingDebtors || loadingFollowUps || loadingInvoices;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-5 border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">Follow-Up Schedule</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All debtors with outstanding dues, sorted by urgency of next follow-up</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-red-50 border-red-100 p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{counts.overdue}</div>
          <div className="text-xs text-red-500 mt-0.5 font-medium">Overdue Follow-Ups</div>
        </div>
        <div className="rounded-lg border bg-orange-50 border-orange-100 p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{counts.today}</div>
          <div className="text-xs text-orange-500 mt-0.5 font-medium">Due Today</div>
        </div>
        <div className="rounded-lg border bg-amber-50 border-amber-100 p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{counts.upcoming}</div>
          <div className="text-xs text-amber-500 mt-0.5 font-medium">Upcoming</div>
        </div>
        <div className="rounded-lg border bg-gray-50 border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-600">{counts.unscheduled}</div>
          <div className="text-xs text-gray-500 mt-0.5 font-medium">Not Scheduled</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search debtor..."
          className="w-44 h-8 text-sm"
        />
        {managers.length > 0 && (
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="All Managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              {managers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({debtorItems.length})</TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            Overdue ({counts.overdue})
          </TabsTrigger>
          <TabsTrigger value="today" className="gap-1">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            Today ({counts.today})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1">
            <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
            Upcoming ({counts.upcoming})
          </TabsTrigger>
          <TabsTrigger value="unscheduled" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
            Not Scheduled ({counts.unscheduled})
          </TabsTrigger>
        </TabsList>

        {['all', 'overdue', 'today', 'upcoming', 'unscheduled'].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No debtors in this category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(item => (
                  <FollowUpCard
                    key={item.debtor.id}
                    item={item}
                    onLogFollowUp={() => setFollowUpFormDebtor(item.debtor)}
                    onViewDebtor={() => navigate(`/debtors?profile=${item.debtor.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Follow-Up Form */}
      <FollowUpForm
        open={!!followUpFormDebtor}
        onClose={() => setFollowUpFormDebtor(null)}
        onSave={(data) => createFollowUpMut.mutate(data)}
        debtorId={followUpFormDebtor?.id}
        debtorName={followUpFormDebtor?.name}
      />
    </div>
  );
}