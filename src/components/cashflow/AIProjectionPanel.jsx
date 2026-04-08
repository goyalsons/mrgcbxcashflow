import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Line
} from 'recharts';
import { formatINR } from '@/lib/utils/currency';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Sparkles, RefreshCw, CalendarClock, Target, Lightbulb, Activity,
  ArrowRight, XCircle, ChevronRight, Flame, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Formatters ────────────────────────────────────────────────────────────
const INR_CR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

// ─── Constants ─────────────────────────────────────────────────────────────
const RISK_COLORS = {
  safe:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  caution: 'bg-amber-50 text-amber-700 border-amber-200',
  danger:  'bg-red-50 text-red-700 border-red-200',
};
const PRIORITY_COLORS = {
  high:   'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-blue-50 text-blue-700 border-blue-200',
};
const ACTION_LINKS = {
  'aging': '/aging-analysis',
  'receivable': '/aging-analysis',
  'collection': '/aging-analysis',
  'payable': '/payables',
  'vendor': '/payables',
  'payment term': '/payables',
  'bank': '/bank-accounts',
  'balance': '/bank-accounts',
  'financing': '/bank-accounts',
  'expense': '/expenses',
};

function getActionLink(text = '') {
  const lower = text.toLowerCase();
  for (const [keyword, path] of Object.entries(ACTION_LINKS)) {
    if (lower.includes(keyword)) return path;
  }
  return '/cash-flow-forecast';
}

// ─── Health Score Ring ──────────────────────────────────────────────────────
function HealthScoreRing({ score }) {
  const color  = score >= 61 ? (score >= 86 ? '#059669' : '#10b981') : score >= 31 ? '#f59e0b' : '#ef4444';
  const label  = score >= 61 ? 'Healthy' : score >= 31 ? 'At Risk' : 'Critical';
  const riskCls = score >= 61 ? RISK_COLORS.safe : score >= 31 ? RISK_COLORS.caution : RISK_COLORS.danger;

  // Bands: 0-30 red, 31-60 amber, 61-85 green, 86-100 dark green
  const bands = [
    { from: 0,  to: 30,  color: '#ef4444' },
    { from: 30, to: 60,  color: '#f59e0b' },
    { from: 60, to: 85,  color: '#10b981' },
    { from: 85, to: 100, color: '#059669' },
  ];
  const r = 15.9;
  const circ = 2 * Math.PI * r; // ~99.9

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
          {/* Background track */}
          <circle cx="18" cy="18" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
          {/* Color bands */}
          {bands.map((b, i) => {
            const len = ((b.to - b.from) / 100) * circ;
            const offset = ((100 - b.from) / 100) * circ;
            return (
              <circle key={i} cx="18" cy="18" r={r} fill="none"
                stroke={b.color} strokeWidth="2.5" strokeOpacity="0.25"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-((b.from / 100) * circ)}
              />
            );
          })}
          {/* Score arc */}
          <circle cx="18" cy="18" r={r} fill="none"
            stroke={color} strokeWidth="2.5"
            strokeDasharray={`${(score / 100) * circ} ${circ - (score / 100) * circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <Badge variant="outline" className={riskCls}>{label}</Badge>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, benchmark, benchmarkLabel, healthFn, trend }) {
  const status = healthFn ? healthFn(value) : 'neutral';
  const colorMap = { good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', neutral: 'text-primary' };
  const cls = colorMap[status] || 'text-primary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${cls}`} />
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className={`text-xl font-bold ${cls}`}>{value}</p>
          {trend !== undefined && (
            trend > 0
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              : trend < 0
                ? <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                : null
          )}
        </div>
        {benchmarkLabel && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{benchmarkLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Custom Chart Tooltip ───────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold">{label}</p>
      <p className="text-emerald-600">Inflow: {INR_CR(d.projected_inflow)}</p>
      <p className="text-red-600">Outflow: {INR_CR(d.projected_outflow)}</p>
      <p className={`font-bold border-t pt-1 ${(d['Balance'] || 0) >= 0 ? 'text-primary' : 'text-red-600'}`}>
        Balance: {INR_CR(d['Balance'])}
      </p>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AIProjectionPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissedRecs, setDismissedRecs] = useState(new Set());
  const navigate = useNavigate();

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('aiCashFlowProjection', {});
      if (res.data?.projection) {
        setData(res.data);
      } else {
        setError(res.data?.error || 'Failed to generate projection. Please try again.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to generate projection.');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <Brain className="w-6 h-6 text-primary animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-primary">AI is analyzing your financial data...</p>
            <p className="text-xs text-muted-foreground">Examining payment history, seasonal trends, and risk factors</p>
          </div>
        </div>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Brain className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">AI Cash Flow Projection</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Analyze your historical payment behavior, seasonal trends, and predict future bank balances with potential cash gap alerts.
          </p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
        <Button onClick={run} className="gap-2">
          <Sparkles className="w-4 h-4" />
          Generate AI Projection
        </Button>
      </div>
    );
  }

  const { projection, meta } = data;
  const {
    monthly_projection = [],
    cash_gaps = [],
    seasonal_insights = [],
    recommendations = [],
    health_score = 0,
    health_summary = '',
    key_metrics = {},
  } = projection;

  // ── Derived data ──
  const openingBalance = monthly_projection[0]?.closing_balance || 0;
  const minSafeBalance = openingBalance * 0.1;

  const chartData = monthly_projection.map(m => ({
    name: m.month,
    'Projected Inflow': m.projected_inflow,
    'Balance': m.closing_balance,
    projected_inflow: m.projected_inflow,
    projected_outflow: m.projected_outflow,
    upper: m.closing_balance * 1.1,
    lower: m.closing_balance * 0.9,
  }));

  // Health score factors (synthesized from data)
  const negativeFactors = [];
  const overdueRows = monthly_projection.filter(m => m.net_cashflow < 0 || (m.projected_inflow || 0) === 0);
  if (overdueRows.length >= 4) negativeFactors.push(`No or near-zero inflow in ${overdueRows.length} of ${monthly_projection.length} months`);
  const totalOut = monthly_projection.reduce((s, m) => s + (m.projected_outflow || 0), 0);
  const totalIn  = monthly_projection.reduce((s, m) => s + (m.projected_inflow  || 0), 0);
  if (totalOut > totalIn * 1.5) negativeFactors.push(`Outflow exceeds inflow by ${(totalOut / (totalIn || 1)).toFixed(1)}x`);
  if ((key_metrics.overdue_receivables_pct || 0) > 50) negativeFactors.push(`${key_metrics.overdue_receivables_pct}% of receivables are overdue`);
  if ((key_metrics.collection_rate_pct || 0) < 50) negativeFactors.push(`Collection rate is only ${key_metrics.collection_rate_pct}% (target: >60%)`);
  const scoreImprovementHint = key_metrics.overdue_receivables_pct > 20
    ? `Collecting 50% of overdue receivables could raise your score to ~${Math.min(100, health_score + 18)}.`
    : `Improving collection rate to 70%+ could raise your score to ~${Math.min(100, health_score + 12)}.`;

  // Monthly risk logic
  function getRowRisk(m, prev) {
    const net = m.net_cashflow ?? (m.projected_inflow - m.projected_outflow);
    if (net < -5000000) return { label: 'Critical', cls: 'bg-red-100 text-red-800 border-red-300' };
    if (net < 0)        return { label: 'High',     cls: 'bg-red-50 text-red-700 border-red-200' };
    if (prev && m.closing_balance < prev.closing_balance * 0.95) return { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  function getConfidence(i, total) {
    const base = 75;
    const pct = Math.max(25, base - i * (base - 20) / (total - 1 || 1));
    const rounded = Math.round(pct / 5) * 5;
    const cls = rounded >= 60 ? 'text-emerald-600' : rounded >= 40 ? 'text-amber-600' : 'text-red-600';
    return { pct: rounded, cls };
  }

  // Monthly table totals
  const totalProjIn  = monthly_projection.reduce((s, m) => s + (m.projected_inflow  || 0), 0);
  const totalProjOut = monthly_projection.reduce((s, m) => s + (m.projected_outflow || 0), 0);
  const totalProjNet = totalProjIn - totalProjOut;
  const lastClosing  = monthly_projection[monthly_projection.length - 1]?.closing_balance || 0;

  // Cash gaps sorted by shortfall desc + cumulative
  const sortedGaps = [...cash_gaps].sort((a, b) => (b.shortfall || 0) - (a.shortfall || 0));
  const totalShortfall = sortedGaps.reduce((s, g) => s + (g.shortfall || 0), 0);
  let cumulative = 0;

  // Recommendations split
  const visibleRecs = recommendations.filter(r => !dismissedRecs.has(r.action));
  const immediateRecs = visibleRecs.filter(r => r.priority === 'high');
  const strategicRecs = visibleRecs.filter(r => r.priority !== 'high');
  const totalPotentialImpact = visibleRecs.reduce((s, r) => {
    const match = (r.expected_impact || '').match(/[\d,]+/);
    return s + (match ? parseInt(match[0].replace(/,/g, '')) : 0);
  }, 0);

  // KPI health functions
  const daysHealth  = (v) => v <= 30 ? 'good' : v <= 60 ? 'warn' : 'bad';
  const rateHealth  = (v) => v >= 60 ? 'good' : v >= 40 ? 'warn' : 'bad';
  const runwayHealth = (v) => v >= 3  ? 'good' : v >= 1  ? 'warn' : 'bad';
  const overdueHealth = (v) => v <= 20 ? 'good' : v <= 40 ? 'warn' : 'bad';

  const RecCard = ({ r, index }) => (
    <div className="flex gap-3 p-4 border rounded-xl bg-card hover:shadow-sm transition-shadow">
      <Badge variant="outline" className={`text-xs h-fit shrink-0 mt-0.5 ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</Badge>
      <div className="flex-1 space-y-1 min-w-0">
        <p className="text-sm font-semibold">{r.action}</p>
        <p className="text-xs text-muted-foreground">{r.expected_impact}</p>
        {r.timeline && (
          <p className="text-xs text-primary font-medium flex items-center gap-1">
            <CalendarClock className="w-3 h-3" />{r.timeline}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
            onClick={() => navigate(getActionLink(r.action))}>
            Take Action <ChevronRight className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-muted-foreground"
            onClick={() => setDismissedRecs(prev => new Set([...prev, r.action]))}>
            <XCircle className="w-3 h-3 mr-1" /> Dismiss
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="w-4 h-4" />
          <span>Generated {new Date(meta.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{meta.data_points.payments} payments analyzed</span>
        </div>
        <Button variant="outline" size="sm" onClick={run} className="gap-1.5 h-8 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </Button>
      </div>

      {/* ── SECTION 1: Health Score + KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {/* Health score card */}
        <Card className="md:col-span-1 p-5">
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cash Health Score</p>
            <HealthScoreRing score={health_score} />
            <p className="text-xs text-center text-muted-foreground mt-1 leading-relaxed">{health_summary}</p>
            {negativeFactors.length > 0 && (
              <div className="w-full mt-2 space-y-1 border-t pt-2">
                <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">What's dragging the score down?</p>
                {negativeFactors.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-red-700 leading-tight">{f}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="w-full mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-[10px] text-emerald-700 leading-snug">
                <span className="font-semibold">💡 </span>{scoreImprovementHint}
              </p>
            </div>
          </div>
        </Card>

        {/* KPI cards */}
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard label="Avg. Days to Collect" value={`${key_metrics.avg_days_to_collect || 0}d`}
            icon={CalendarClock} healthFn={daysHealth}
            benchmarkLabel="Industry avg: 45 days" />
          <KPICard label="Collection Rate" value={`${key_metrics.collection_rate_pct || 0}%`}
            icon={Target} healthFn={rateHealth}
            benchmarkLabel="Healthy: >60%" />
          <KPICard label="Months of Runway" value={`${key_metrics.months_of_runway || 0} mo`}
            icon={TrendingUp} healthFn={runwayHealth}
            benchmarkLabel="Min recommended: 3 mo" />
          <KPICard label="Overdue Receivables" value={`${key_metrics.overdue_receivables_pct || 0}%`}
            icon={AlertTriangle} healthFn={overdueHealth}
            benchmarkLabel="Target: <20%" />
        </div>
      </div>

      {/* ── SECTION 2: Balance Projection Chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">6-Month Balance Projection</CardTitle>
          <p className="text-xs text-muted-foreground">Shaded band shows forecast uncertainty range. Dashed amber = minimum safe balance.</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={v => INR_CR(v)} />
              <RechartsTooltip content={<ChartTooltip />} />
              {/* Danger zone below min safe */}
              <Area type="monotone" dataKey={() => minSafeBalance} fill="url(#dangerGrad)" stroke="none" />
              {/* Min safe balance reference line */}
              <ReferenceLine y={minSafeBalance} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: 'Min Safe', position: 'right', fontSize: 10, fill: '#d97706' }} />
              {/* Zero line */}
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1} />
              {/* Confidence band */}
              <Area type="monotone" dataKey="upper" fill="url(#confGrad)" stroke="none" />
              <Area type="monotone" dataKey="lower" fill="#fff" stroke="none" fillOpacity={1} />
              {/* Lines */}
              <Line type="monotone" dataKey="Projected Inflow" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Balance" stroke="hsl(var(--primary))" strokeWidth={2.5}
                dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /><span className="text-xs text-muted-foreground">Projected Inflow</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary" /><span className="text-xs text-muted-foreground">Closing Balance</span></div>
            <div className="flex items-center gap-1.5"><div className="w-8 h-0.5 border-t-2 border-dashed border-amber-500" /><span className="text-xs text-muted-foreground">Min Safe Balance</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-200 opacity-70" /><span className="text-xs text-muted-foreground">Confidence Band</span></div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 3: Monthly Breakdown Table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Projected Inflow</TableHead>
                <TableHead className="text-right">Projected Outflow</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
                <TableHead className="text-right text-blue-600">Gap to Cover</TableHead>
                <TableHead className="text-center">Risk</TableHead>
                <TableHead className="text-center">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly_projection.map((m, i) => {
                const net = m.net_cashflow ?? (m.projected_inflow - m.projected_outflow);
                const prev = monthly_projection[i - 1] || null;
                const risk = getRowRisk(m, prev);
                const conf = getConfidence(i, monthly_projection.length);
                const gap  = net < 0 ? Math.abs(net) : null;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.month}</TableCell>
                    <TableCell className="text-right text-emerald-600">{INR_CR(m.projected_inflow)}</TableCell>
                    <TableCell className="text-right text-red-600">{INR_CR(m.projected_outflow)}</TableCell>
                    <TableCell className={`text-right font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{INR_CR(net)}</TableCell>
                    <TableCell className={`text-right font-bold ${m.closing_balance >= 0 ? '' : 'text-red-600'}`}>{INR_CR(m.closing_balance)}</TableCell>
                    <TableCell className="text-right text-blue-600 text-sm font-medium">
                      {gap ? INR_CR(gap) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${risk.cls}`}>{risk.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-medium ${conf.cls}`}>{conf.pct}%</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {/* Summary footer */}
            <tfoot>
              <tr className="border-t bg-muted/50 font-medium text-sm">
                <td className="p-2 pl-4 font-bold">Totals</td>
                <td className="p-2 text-right text-emerald-700 font-bold">{INR_CR(totalProjIn)}</td>
                <td className="p-2 text-right text-red-700 font-bold">{INR_CR(totalProjOut)}</td>
                <td className={`p-2 text-right font-bold ${totalProjNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{INR_CR(totalProjNet)}</td>
                <td className={`p-2 text-right font-bold ${lastClosing >= 0 ? 'text-foreground' : 'text-red-700'}`}>{INR_CR(lastClosing)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* ── SECTION 4: Cash Gaps + Seasonal Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cash Gaps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Cash Gap Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedGaps.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 py-4">
                <CheckCircle2 className="w-4 h-4" />No cash gaps detected.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Total shortfall banner */}
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  Total projected shortfall across all flagged months: <span className="font-bold">{INR_CR(totalShortfall)}</span>
                </div>
                {sortedGaps.map((g, i) => {
                  cumulative += (g.shortfall || 0);
                  const sevCls = g.severity === 'high'
                    ? 'bg-red-50 border-red-200'
                    : g.severity === 'medium'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200';
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${sevCls}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{g.period}</p>
                        <Badge variant="outline" className={`text-xs shrink-0 ${g.severity === 'high' ? 'bg-red-100 text-red-700 border-red-300' : g.severity === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                          {g.severity} risk
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{g.reason}</p>
                      {g.shortfall > 0 && (
                        <p className="text-sm font-bold text-red-600 mt-1">Shortfall: {INR_CR(g.shortfall)}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Cumulative to date: <span className="font-semibold text-red-700">{INR_CR(cumulative)}</span>
                      </p>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-primary px-0 mt-1 gap-0.5"
                        onClick={() => document.getElementById('ai-recommendations')?.scrollIntoView({ behavior: 'smooth' })}>
                        View suggested action <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seasonal Insights */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Seasonal Trend Insights</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate('/analysis')}>
                View full analysis <ChevronRight className="w-3 h-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Build 3-4 insights from data + AI insights
              const builtIn = [];
              if (overdueRows.length > 0)
                builtIn.push({ pattern: `Zero inflow in ${overdueRows.length} months`, impact: 'negative', description: `No receivables are expected in ${overdueRows.length} of the next ${monthly_projection.length} months — accelerate collections.`, severity: 'high' });
              const avgBurn = monthly_projection.length > 0
                ? (monthly_projection[0].closing_balance - lastClosing) / monthly_projection.length
                : 0;
              if (avgBurn > 0)
                builtIn.push({ pattern: `Avg monthly burn: ${INR_CR(avgBurn)}`, impact: 'negative', description: `Balance declining ~${INR_CR(avgBurn)}/month on average over the forecast horizon.`, severity: 'medium' });
              if (totalOut > totalIn * 1.3)
                builtIn.push({ pattern: 'Outflow structurally exceeds inflow', impact: 'negative', description: `Total projected outflow is ${(totalOut / (totalIn || 1)).toFixed(1)}x total projected inflow — structural cash deficit.`, severity: 'high' });
              const allInsights = [...builtIn, ...seasonal_insights].slice(0, 4);
              if (allInsights.length === 0)
                return <p className="text-sm text-muted-foreground py-4">No seasonal patterns detected — more historical data needed.</p>;
              return (
                <div className="space-y-3">
                  {allInsights.map((s, i) => {
                    const ImpactIcon = s.impact === 'positive' ? TrendingUp : s.impact === 'negative' ? TrendingDown : Activity;
                    const sev = s.severity || (s.impact === 'negative' ? 'high' : 'low');
                    const sevCls = sev === 'high' ? 'bg-red-50 text-red-700 border-red-200' : sev === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200';
                    return (
                      <div key={i} className="flex gap-3 p-3 bg-muted/40 rounded-lg">
                        <ImpactIcon className={`w-4 h-4 mt-0.5 shrink-0 ${s.impact === 'positive' ? 'text-emerald-600' : s.impact === 'negative' ? 'text-red-600' : 'text-muted-foreground'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold">{s.pattern}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sevCls}`}>{sev}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION 5: AI Recommendations ── */}
      <div id="ai-recommendations">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Impact banner */}
            {immediateRecs.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                <Flame className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-emerald-800">
                  Implementing all high-priority recommendations could meaningfully improve your cash position.
                  {totalPotentialImpact > 0 && <span className="font-bold"> Estimated impact: +{INR_CR(totalPotentialImpact)}.</span>}
                </p>
              </div>
            )}

            {/* Immediate Actions */}
            {immediateRecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">⚡ Immediate Actions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {immediateRecs.map((r, i) => <RecCard key={i} r={r} />)}
                </div>
              </div>
            )}

            {/* Strategic Actions */}
            {strategicRecs.length > 0 && (
              <div>
                {immediateRecs.length > 0 && <div className="border-t my-2" />}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">📋 Strategic Actions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {strategicRecs.map((r, i) => <RecCard key={i} r={r} />)}
                </div>
              </div>
            )}

            {visibleRecs.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                All recommendations dismissed. <Button variant="link" className="px-1 h-auto text-sm" onClick={() => setDismissedRecs(new Set())}>Reset</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}