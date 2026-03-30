import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Send, ArrowUpDown, AlertTriangle, Phone, Mail, MessageSquare, MapPin, StickyNote } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';

const TYPE_ICONS = { call: Phone, email: Mail, whatsapp: MessageSquare, visit: MapPin, sms: MessageSquare, note: StickyNote };

const FOLLOW_UP_TYPES = ['call', 'email', 'whatsapp', 'visit', 'sms', 'note'];

function Sparkline({ data }) {
  if (!data || data.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <ResponsiveContainer width={80} height={28}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="count" stroke="#3b4cca" strokeWidth={1.5} dot={false} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="text-xs bg-popover border rounded px-2 py-1 shadow">
                {label}: {payload[0].value}
              </div>
            ) : null
          }
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function ManagerActivityReport() {
  const { toast } = useToast();
  const today = new Date();
  const defaultFrom = new Date(today); defaultFrom.setDate(today.getDate() - 6);
  const [dateFrom, setDateFrom] = useState(defaultFrom.toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(today.toISOString().split('T')[0]);
  const [sortKey, setSortKey] = useState('collected');
  const [sortDir, setSortDir] = useState('desc');
  const [sending, setSending] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  const { data: followUps = [] } = useQuery({ queryKey: ['followUps'], queryFn: () => base44.entities.FollowUp.list() });
  const { data: debtors = [] } = useQuery({ queryKey: ['debtors'], queryFn: () => base44.entities.Debtor.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: targets = [] } = useQuery({ queryKey: ['collectionTargets'], queryFn: () => base44.entities.CollectionTarget.list() });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list() });

  const report = useMemo(() => {
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0);

    // Collect unique managers from debtors
    const managerEmails = [...new Set(debtors.map(d => d.assigned_manager).filter(Boolean))];

    return managerEmails.map(email => {
      const user = users.find(u => u.email === email);
      const name = user?.full_name || email.split('@')[0];

      // Debtors assigned to this manager
      const myDebtors = debtors.filter(d => d.assigned_manager === email);
      const myDebtorIds = new Set(myDebtors.map(d => d.id));

      // Follow-ups in date range by this manager
      const myFollowUps = followUps.filter(f => {
        const d = new Date(f.follow_up_date);
        return f.created_by === email && d >= from && d <= to;
      });

      // Breakdown by type
      const typeBreakdown = {};
      FOLLOW_UP_TYPES.forEach(t => { typeBreakdown[t] = 0; });
      myFollowUps.forEach(f => { if (f.type) typeBreakdown[f.type] = (typeBreakdown[f.type] || 0) + 1; });

      // Unique debtors contacted
      const uniqueDebtorsContacted = new Set(myFollowUps.map(f => f.debtor_id).filter(Boolean)).size;

      // Promised payment value (promise_to_pay outcome follow-ups in range)
      const promisedValue = myFollowUps
        .filter(f => f.outcome === 'promised_payment' && f.promise_amount)
        .reduce((s, f) => s + (f.promise_amount || 0), 0);

      // Actual collections in range from assigned debtors
      const collected = payments
        .filter(p => {
          const d = new Date(p.payment_date);
          return myDebtorIds.has(p.debtor_id) && d >= from && d <= to;
        })
        .reduce((s, p) => s + (p.amount || 0), 0);

      // Collection target for current month
      const now = new Date();
      const myTarget = targets.find(t =>
        t.manager_email === email &&
        t.period_month === now.getMonth() + 1 &&
        t.period_year === now.getFullYear()
      );
      const targetAmount = myTarget?.target_amount || 0;
      const targetPct = targetAmount > 0 ? Math.min(Math.round((collected / targetAmount) * 100), 999) : null;

      // Accountability flag: overdue accounts with zero follow-up in last 7 days
      const overdueDebtorIds = new Set(
        invoices
          .filter(i => {
            const d = new Date(i.due_date);
            return myDebtorIds.has(i.debtor_id) && d < new Date() && i.status !== 'paid' && i.status !== 'written_off';
          })
          .map(i => i.debtor_id)
      );
      const recentlyContactedDebtorIds = new Set(
        followUps
          .filter(f => {
            const d = new Date(f.follow_up_date);
            return f.created_by === email && d >= sevenDaysAgo;
          })
          .map(f => f.debtor_id)
      );
      const noFollowUpOverdue = [...overdueDebtorIds].filter(id => !recentlyContactedDebtorIds.has(id)).length;

      // Daily sparkline data
      const days = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        days.push({
          date: dateStr,
          count: myFollowUps.filter(f => f.follow_up_date === dateStr).length,
        });
      }

      return {
        email, name,
        totalFollowUps: myFollowUps.length,
        typeBreakdown,
        uniqueDebtorsContacted,
        promisedValue,
        collected,
        targetAmount,
        targetPct,
        noFollowUpOverdue,
        sparkline: days,
        myDebtors: myDebtors.length,
      };
    });
  }, [followUps, debtors, payments, invoices, targets, users, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    return [...report].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [report, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHeader = ({ label, k }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      </span>
    </TableHead>
  );

  const exportCSV = () => {
    const headers = ['Manager', 'Email', 'Debtors Assigned', 'Total Follow-Ups', 'Calls', 'Emails', 'WhatsApp', 'Visits', 'Unique Debtors Contacted', 'Promised Value (₹)', 'Collected (₹)', 'Target (₹)', 'Target %', 'Overdue w/ No Follow-Up'];
    const rows = sorted.map(r => [
      r.name, r.email, r.myDebtors, r.totalFollowUps,
      r.typeBreakdown.call, r.typeBreakdown.email, r.typeBreakdown.whatsapp, r.typeBreakdown.visit,
      r.uniqueDebtorsContacted, r.promisedValue, r.collected,
      r.targetAmount, r.targetPct ?? 'N/A', r.noFollowUpOverdue,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `manager_activity_${dateFrom}_to_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const sendEmail = async () => {
    if (!emailTo) { toast({ title: 'Enter email address', variant: 'destructive' }); return; }
    setSending(true);
    try {
      await base44.functions.invoke('sendManagerActivityReport', { to: emailTo, dateFrom, dateTo });
      toast({ title: 'Report sent!', description: `Emailed to ${emailTo}` });
    } catch (e) {
      toast({ title: 'Failed to send', description: e.message, variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="flex-1 min-w-40 space-y-1">
              <Label className="text-xs">Email Report To</Label>
              <Input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="owner@company.com" className="h-8 text-sm" />
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={sendEmail} disabled={sending} className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> {sending ? 'Sending...' : 'Email Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Managers Tracked</p>
          <p className="text-2xl font-bold mt-1">{report.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Follow-Ups</p>
          <p className="text-2xl font-bold mt-1">{report.reduce((s, r) => s + r.totalFollowUps, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Collected</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{formatINR(report.reduce((s, r) => s + r.collected, 0))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Accountability Flags</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{report.reduce((s, r) => s + r.noFollowUpOverdue, 0)}</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Manager Performance — {dateFrom} to {dateTo}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">No account managers with assigned debtors found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="pl-4">Manager</TableHead>
                    <SortHeader label="Follow-Ups" k="totalFollowUps" />
                    <TableHead className="text-xs">Breakdown</TableHead>
                    <SortHeader label="Debtors Contacted" k="uniqueDebtorsContacted" />
                    <SortHeader label="Promised (₹)" k="promisedValue" />
                    <SortHeader label="Collected (₹)" k="collected" />
                    <SortHeader label="Target %" k="targetPct" />
                    <SortHeader label="⚠ No Follow-Up" k="noFollowUpOverdue" />
                    <TableHead>Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(row => (
                    <TableRow key={row.email}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-sm">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.myDebtors} debtors</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{row.totalFollowUps}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {FOLLOW_UP_TYPES.filter(t => row.typeBreakdown[t] > 0).map(t => {
                            const Icon = TYPE_ICONS[t];
                            return (
                              <span key={t} className="inline-flex items-center gap-0.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                                <Icon className="w-2.5 h-2.5" />{row.typeBreakdown[t]}
                              </span>
                            );
                          })}
                          {FOLLOW_UP_TYPES.every(t => !row.typeBreakdown[t]) && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>{row.uniqueDebtorsContacted}</TableCell>
                      <TableCell className="font-medium">{formatINR(row.promisedValue)}</TableCell>
                      <TableCell className="font-semibold text-emerald-700">{formatINR(row.collected)}</TableCell>
                      <TableCell>
                        {row.targetPct === null ? (
                          <span className="text-xs text-muted-foreground">No target</span>
                        ) : (
                          <Badge className={row.targetPct >= 100 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : row.targetPct >= 70 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'}>
                            {row.targetPct}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.noFollowUpOverdue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium">
                            <AlertTriangle className="w-3 h-3" />{row.noFollowUpOverdue}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600">✓ All covered</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Sparkline data={row.sparkline} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ⚠ "No Follow-Up" flag = overdue accounts assigned to this manager with zero follow-up in the last 7 days (regardless of selected date range).
      </p>
    </div>
  );
}