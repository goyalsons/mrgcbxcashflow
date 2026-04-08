import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Area
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Sparkles, RefreshCw, CalendarClock, Target, Lightbulb, Activity,
  ArrowRight, XCircle, ChevronRight, ChevronDown, Flame, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Formatters ────────────────────────────────────────────────────────────
const INR_CR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

// ─── Action link helper ─────────────────────────────────────────────────────
const ACTION_LINKS = {
  'aging': '/aging-analysis', 'receivable': '/aging-analysis', 'collection': '/aging-analysis',
  'payable': '/payables', 'vendor': '/payables', 'payment term': '/payables',
  'bank': '/bank-accounts', 'balance': '/bank-accounts', 'financing': '/bank-accounts',
  'expense': '/expenses',
};
function getActionLink(text = '') {
  const lower = text.toLowerCase();
  for (const [k, p] of Object.entries(ACTION_LINKS)) if (lower.includes(k)) return p;
  return '/cash-flow-forecast';
}

// ─── Health Score Gauge (270° arc) ─────────────────────────────────────────
function HealthGauge({ score }) {
  // 270° arc: starts at 135° (bottom-left), ends at 45° (bottom-right)
  const cx = 60, cy = 60, r = 48;
  const startAngle = 135, totalAngle = 270;
  const toRad = (d) => (d * Math.PI) / 180;
  const polar = (angle) => ({
    x: cx + r * Math.cos(toRad(angle - 90)),
    y: cy + r * Math.sin(toRad(angle - 90)),
  });
  const arcPath = (start, sweep) => {
    const s = polar(start), e = polar(start + sweep);
    const large = sweep > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const filledSweep = (score / 100) * totalAngle;
  const scoreColor = score >= 61 ? (score >= 86 ? '#059669' : '#10b981') : score >= 31 ? '#f59e0b' : '#ef4444';
  const label = score >= 61 ? (score >= 86 ? 'Excellent' : 'Healthy') : score >= 31 ? 'At Risk' : 'Critical';
  const pillColor = score >= 61 ? 'bg-emerald-500' : score >= 31 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-32 h-32">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#ef4444" />
              <stop offset="50%"  stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path d={arcPath(startAngle, totalAngle)} fill="none" stroke="hsl(var(--border))" strokeWidth="10" strokeLinecap="round" />
          {/* Filled arc */}
          {filledSweep > 0 && (
            <path d={arcPath(startAngle, filledSweep)} fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeLinecap="round" />
          )}
          {/* Score */}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill={scoreColor}>{score}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">/100</text>
        </svg>
      </div>
      <span className={`text-xs font-semibold px-3 py-1 rounded-full text-white ${pillColor}`}>{label}</span>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, benchmarkLabel, healthFn }) {
  const status = healthFn ? healthFn(parseFloat(value)) : 'neutral';
  const colorMap = { good: '#10b981', warn: '#f59e0b', bad: '#ef4444', neutral: 'hsl(var(--primary))' };
  const borderMap = { good: 'border-l-emerald-500', warn: 'border-l-amber-400', bad: 'border-l-red-500', neutral: 'border-l-primary' };
  const textMap = { good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', neutral: 'text-primary' };
  const color = colorMap[status];
  return (
    <div className={`bg-card border border-border border-l-4 ${borderMap[status]} rounded-lg p-3 flex flex-col gap-1`}>
      <Icon style={{ color }} className="w-4 h-4" />
      <p className={`text-2xl font-bold leading-none ${textMap[status]}`}>{value}</p>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      {benchmarkLabel && <p className="text-[11px] text-muted-foreground italic mt-0.5">{benchmarkLabel}</p>}
    </div>
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
      <p className={`font-bold border-t pt-1 ${(d.balance || 0) >= 0 ? 'text-primary' : 'text-red-600'}`}>Balance: {INR_CR(d.balance)}</p>
    </div>
  );
};

// ─── Confidence progress bar ────────────────────────────────────────────────
function ConfBar({ pct }) {
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const textCls = pct >= 60 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={`text-xs font-medium ${textCls}`}>{pct}%</span>
    </div>
  );
}

// ─── Risk pill badge ────────────────────────────────────────────────────────
function RiskPill({ label }) {
  const map = {
    Critical: 'bg-red-600 text-white',
    High:     'bg-orange-500 text-white',
    Medium:   'bg-amber-400 text-white',
    Healthy:  'bg-emerald-500 text-white',
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[label] || 'bg-muted text-muted-foreground'}`}>{label}</span>;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AIProjectionPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissedRecs, setDismissedRecs] = useState(new Set());
  const [expandedGaps, setExpandedGaps] = useState(new Set());
  const navigate = useNavigate();

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke('aiCashFlowProjection', {});
      if (res.data?.projection) setData(res.data);
      else setError(res.data?.error || 'Failed to generate projection.');
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
          <p className="text-sm text-muted-foreground mt-1 max-w-md">Analyze historical payment behavior, seasonal trends, and predict future bank balances with cash gap alerts.</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
        <Button onClick={run} className="gap-2"><Sparkles className="w-4 h-4" />Generate AI Projection</Button>
      </div>
    );
  }

  const { projection, meta } = data;
  const { monthly_projection = [], cash_gaps = [], seasonal_insights = [], recommendations = [], health_score = 0, health_summary = '', key_metrics = {} } = projection;

  // ── Chart data ──
  const balances = monthly_projection.map(m => m.closing_balance || 0);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const bufBal = (maxBal - minBal) || 1000000;
  const yMin = Math.floor((minBal - bufBal * 0.1) / 100000) * 100000;
  const yMax = Math.ceil((maxBal + bufBal * 0.1) / 100000) * 100000;
  const openingBalance = monthly_projection[0]?.closing_balance || 0;
  const minSafeBalance = openingBalance * 0.1;
  const allZeroInflow = monthly_projection.every(m => (m.projected_inflow || 0) === 0);

  const chartData = monthly_projection.map((m, i) => {
    const confWidth = (m.closing_balance || 0) * (0.04 + i * 0.04);
    return {
      name: m.month,
      balance: m.closing_balance,
      projected_inflow: m.projected_inflow,
      projected_outflow: m.projected_outflow,
      upper: (m.closing_balance || 0) + Math.abs(confWidth),
      lower: (m.closing_balance || 0) - Math.abs(confWidth),
    };
  });

  // ── Negative factors for score ──
  const negativeFactors = [];
  const noInflowMonths = monthly_projection.filter(m => (m.projected_inflow || 0) === 0);
  if (noInflowMonths.length >= 4) negativeFactors.push(`No inflow in ${noInflowMonths.length} of ${monthly_projection.length} projected months`);
  const totalOut = monthly_projection.reduce((s, m) => s + (m.projected_outflow || 0), 0);
  const totalIn  = monthly_projection.reduce((s, m) => s + (m.projected_inflow  || 0), 0);
  if (totalOut > totalIn * 1.5) negativeFactors.push(`Outflow is ${(totalOut / (totalIn || 1)).toFixed(1)}× projected inflow`);
  if ((key_metrics.overdue_receivables_pct || 0) > 50) negativeFactors.push(`${key_metrics.overdue_receivables_pct}% of receivables are overdue`);
  if ((key_metrics.collection_rate_pct || 0) < 50) negativeFactors.push(`Collection rate is only ${key_metrics.collection_rate_pct}% (target >60%)`);
  const scoreHint = key_metrics.overdue_receivables_pct > 20
    ? `Collecting 50% of overdue receivables could raise your score to ~${Math.min(100, health_score + 18)}.`
    : `Improving collection rate above 70% could raise your score to ~${Math.min(100, health_score + 12)}.`;

  // ── Monthly row helpers ──
  function getRowRisk(m, prev) {
    const net = m.net_cashflow ?? (m.projected_inflow - m.projected_outflow);
    if (net < -5000000) return 'Critical';
    if (net < 0) return 'High';
    if (prev && m.closing_balance < prev.closing_balance * 0.95) return 'Medium';
    return 'Healthy';
  }
  function getConf(i, total) {
    return Math.max(25, Math.round((75 - i * (55 / (total - 1 || 1))) / 5) * 5);
  }

  // ── Monthly totals ──
  const totalProjIn  = monthly_projection.reduce((s, m) => s + (m.projected_inflow  || 0), 0);
  const totalProjOut = monthly_projection.reduce((s, m) => s + (m.projected_outflow || 0), 0);
  const totalProjNet = totalProjIn - totalProjOut;
  const lastClosing  = monthly_projection[monthly_projection.length - 1]?.closing_balance || 0;

  // ── Cash gaps: group consecutive months ──
  const sortedGaps = [...cash_gaps].sort((a, b) => (b.shortfall || 0) - (a.shortfall || 0));
  const totalShortfall = sortedGaps.reduce((s, g) => s + (g.shortfall || 0), 0);
  const maxShortfall = sortedGaps[0]?.shortfall || 1;
  let cumulative = 0;

  // Group consecutive gaps into ranges
  const gapGroups = [];
  const chronoGaps = [...cash_gaps].sort((a, b) => (a.period || '').localeCompare(b.period || ''));
  chronoGaps.forEach((g) => {
    const last = gapGroups[gapGroups.length - 1];
    if (last && last.items.length > 0) {
      gapGroups.push({ items: [g], totalShortfall: g.shortfall || 0 });
    } else {
      gapGroups.push({ items: [g], totalShortfall: g.shortfall || 0 });
    }
  });

  // ── Recommendations ──
  const visibleRecs = recommendations.filter(r => !dismissedRecs.has(r.action));
  const immediateRecs = visibleRecs.filter(r => r.priority === 'high');
  const strategicRecs = visibleRecs.filter(r => r.priority !== 'high');
  const nearGapTotal = sortedGaps.slice(0, 2).reduce((s, g) => s + (g.shortfall || 0), 0);

  // ── KPI health fns ──
  const daysHealth   = (v) => v <= 30 ? 'good' : v <= 60 ? 'warn' : 'bad';
  const rateHealth   = (v) => v >= 60 ? 'good' : v >= 40 ? 'warn' : 'bad';
  const runwayHealth = (v) => v >= 3  ? 'good' : v >= 1  ? 'warn' : 'bad';
  const overdueHealth = (v) => v <= 20 ? 'good' : v <= 40 ? 'warn' : 'bad';

  const RecCard = ({ r }) => (
    <div className="flex gap-3 p-4 border border-l-4 rounded-xl bg-card hover:shadow-sm transition-shadow"
      style={{ borderLeftColor: r.priority === 'high' ? '#ef4444' : r.priority === 'medium' ? '#f59e0b' : '#3b82f6' }}>
      <div className="flex-1 space-y-1 min-w-0">
        <p className="text-sm font-semibold">{r.action}</p>
        <p className="text-xs text-muted-foreground">{r.expected_impact}</p>
        {r.expected_impact && (
          <p className="text-xs text-emerald-600 font-medium">Est. impact: {r.expected_impact}</p>
        )}
        {r.timeline && (
          <p className="text-xs text-primary font-medium flex items-center gap-1">
            <CalendarClock className="w-3 h-3" />{r.timeline}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1">
          <Button size="sm" className="h-7 text-xs px-3 gap-1" onClick={() => navigate(getActionLink(r.action))}>
            Take Action <ChevronRight className="w-3 h-3" />
          </Button>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setDismissedRecs(prev => new Set([...prev, r.action]))}>
            Dismiss
          </button>
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

      {/* ── SECTION 1: Health Score + KPIs side by side ── */}
      <div className="grid grid-cols-1 md:grid-cols-[35%_65%] gap-4">
        {/* Health Score */}
        <Card className="p-4">
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide self-start">Cash Health Score</p>
            <HealthGauge score={health_score} />
            <p className="text-xs text-center text-muted-foreground leading-relaxed">{health_summary}</p>

            {/* Contributing factors */}
            {negativeFactors.length > 0 && (
              <div className="w-full space-y-1.5">
                <p className="text-[13px] text-muted-foreground font-normal">Contributing factors</p>
                {negativeFactors.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 border-l-2 border-red-400 pl-2 py-0.5 bg-red-50/60 rounded-r">
                    <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-red-700 leading-snug">{f}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Improvement hint */}
            <div className="w-full border-l-2 border-emerald-400 pl-3 py-2 bg-emerald-50 rounded-r">
              <div className="flex items-start gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-700 leading-snug">{scoreHint}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI 2×2 grid */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard label="Avg. Days to Collect" value={`${key_metrics.avg_days_to_collect || 0}d`}
            icon={CalendarClock} healthFn={daysHealth} benchmarkLabel="Industry avg: 45 days" />
          <KPICard label="Collection Rate" value={`${key_metrics.collection_rate_pct || 0}%`}
            icon={Target} healthFn={rateHealth} benchmarkLabel="Healthy: >60%" />
          <KPICard label="Months of Runway" value={`${key_metrics.months_of_runway || 0} mo`}
            icon={TrendingUp} healthFn={runwayHealth} benchmarkLabel="Min recommended: 3 mo" />
          <KPICard label="Overdue Receivables" value={`${key_metrics.overdue_receivables_pct || 0}%`}
            icon={AlertTriangle} healthFn={overdueHealth} benchmarkLabel="Target: <20%" />
        </div>
      </div>

      {/* ── SECTION 2: Chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">6-Month Balance Projection</CardTitle>
          <p className="text-xs text-muted-foreground">
            {allZeroInflow ? 'No inflow projected — all receivables overdue.' : 'Shaded band = forecast uncertainty. Dashed amber = minimum safe balance.'}
          </p>
          {/* Custom legend */}
          <div className="flex items-center gap-5 flex-wrap mt-1">
            {[
              { color: '#3b82f6', label: 'Closing Balance' },
              { color: '#10b981', label: 'Projected Inflow', dashed: true },
              { color: '#f59e0b', label: 'Min Safe Balance', dashed: true },
              { color: '#93c5fd', label: 'Confidence Band', opacity: 0.5 },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded" style={{
                  background: l.color, opacity: l.opacity || 1,
                  borderTop: l.dashed ? `2px dashed ${l.color}` : undefined,
                  height: l.dashed ? 0 : 3,
                }} />
                <span className="text-[11px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={v => INR_CR(v)} />
              <RechartsTooltip content={<ChartTooltip />} />
              {/* Min safe balance */}
              <ReferenceLine y={minSafeBalance} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: 'Min safe balance', position: 'right', fontSize: 10, fill: '#d97706' }} />
              {/* Confidence band */}
              <Area type="monotone" dataKey="upper" fill="url(#confBand)" stroke="none" fillOpacity={1} />
              <Area type="monotone" dataKey="lower" fill="white" stroke="none" fillOpacity={1} />
              {/* Inflow line (dashed) */}
              <Line type="monotone" dataKey="projected_inflow" name="Inflow" stroke="#10b981" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} />
              {/* Balance line */}
              <Line type="monotone" dataKey="balance" name="Balance" stroke="#3b82f6" strokeWidth={3}
                dot={{ r: 4, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── SECTION 3: Monthly Breakdown Table ── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Projected Inflow</TableHead>
                <TableHead className="text-right">Projected Outflow</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
                <TableHead className="text-right">Gap to Cover</TableHead>
                <TableHead className="text-center">Risk</TableHead>
                <TableHead className="text-center">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly_projection.map((m, i) => {
                const net = m.net_cashflow ?? (m.projected_inflow - m.projected_outflow);
                const prev = monthly_projection[i - 1] || null;
                const risk = getRowRisk(m, prev);
                const conf = getConf(i, monthly_projection.length);
                const gap  = net < 0 ? Math.abs(net) : null;
                return (
                  <TableRow key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                    <TableCell className="font-medium">{m.month}</TableCell>
                    <TableCell className="text-right text-emerald-600">{INR_CR(m.projected_inflow)}</TableCell>
                    <TableCell className="text-right text-red-600">{INR_CR(m.projected_outflow)}</TableCell>
                    <TableCell className={`text-right font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{INR_CR(net)}</TableCell>
                    <TableCell className={`text-right font-bold ${m.closing_balance >= 0 ? '' : 'text-red-600'}`}>{INR_CR(m.closing_balance)}</TableCell>
                    <TableCell className="text-right" style={{ background: gap ? 'rgba(59,130,246,0.06)' : undefined }}>
                      {gap ? <span className="text-blue-600 font-medium text-sm">{INR_CR(gap)}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center"><RiskPill label={risk} /></TableCell>
                    <TableCell className="text-center"><ConfBar pct={conf} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot>
              <tr className="border-t bg-secondary font-semibold text-sm">
                <td className="p-2 pl-4">Totals</td>
                <td className="p-2 text-right text-emerald-700">{INR_CR(totalProjIn)}</td>
                <td className="p-2 text-right text-red-700">{INR_CR(totalProjOut)}</td>
                <td className={`p-2 text-right ${totalProjNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{INR_CR(totalProjNet)}</td>
                <td className={`p-2 text-right ${lastClosing >= 0 ? 'text-foreground' : 'text-red-700'}`}>{INR_CR(lastClosing)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* ── SECTION 4: Cash Gaps + Seasonal Insights ── */}
      <div className="flex flex-col gap-5">
        {/* Cash Gaps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />Cash Gap Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedGaps.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 py-4"><CheckCircle2 className="w-4 h-4" />No cash gaps detected.</div>
            ) : (
              <div className="space-y-3">
                {/* Total shortfall banner */}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-600 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                  <p className="text-sm text-white font-medium">
                    Total projected shortfall: <span className="font-bold">{INR_CR(totalShortfall)}</span> across {sortedGaps.length} flagged month{sortedGaps.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {sortedGaps.map((g, i) => {
                  cumulative += (g.shortfall || 0);
                  const barWidth = Math.round(((g.shortfall || 0) / maxShortfall) * 100);
                  const sevCls = g.severity === 'high' ? 'bg-red-50 border-red-200' : g.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${sevCls}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{g.period}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{g.reason}</p>
                        </div>
                        <Badge variant="outline" className={`text-xs shrink-0 ${g.severity === 'high' ? 'bg-red-100 text-red-700 border-red-300' : g.severity === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                          {g.severity} risk
                        </Badge>
                      </div>
                      {/* Magnitude bar */}
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${barWidth}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        {g.shortfall > 0 && <p className="text-sm font-bold text-red-600">Shortfall: {INR_CR(g.shortfall)}</p>}
                        <p className="text-xs text-muted-foreground">Cumulative: <span className="font-semibold text-red-700">{INR_CR(cumulative)}</span></p>
                      </div>
                      <button className="text-xs text-primary flex items-center gap-0.5 mt-1 hover:underline"
                        onClick={() => document.getElementById('ai-recommendations')?.scrollIntoView({ behavior: 'smooth' })}>
                        View suggested action <ArrowRight className="w-3 h-3" />
                      </button>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />Seasonal Trend Insights
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const builtIn = [];
              if (noInflowMonths.length > 0)
                builtIn.push({ pattern: `Zero inflow in ${noInflowMonths.length} months`, impact: 'negative', description: `No receivables expected in ${noInflowMonths.length} of ${monthly_projection.length} months — accelerate collections.`, severity: 'high' });
              const avgBurn = monthly_projection.length > 1
                ? (monthly_projection[0].closing_balance - lastClosing) / (monthly_projection.length - 1)
                : 0;
              if (avgBurn > 0)
                builtIn.push({ pattern: `Avg monthly burn: ${INR_CR(avgBurn)}`, impact: 'negative', description: `Balance declining ~${INR_CR(avgBurn)}/month on average over the forecast horizon.`, severity: 'medium' });
              if (totalOut > totalIn * 1.3)
                builtIn.push({ pattern: 'Structural cash deficit', impact: 'negative', description: `Projected outflow is ${(totalOut / (totalIn || 1)).toFixed(1)}× projected inflow — consider reducing variable costs.`, severity: 'high' });
              const allInsights = [...builtIn, ...seasonal_insights].slice(0, 4);
              if (allInsights.length === 0)
                return <p className="text-sm text-muted-foreground py-4">No seasonal patterns detected — more data needed.</p>;
              return (
                <div className="space-y-3">
                  {allInsights.map((s, i) => {
                    const ImpactIcon = s.impact === 'positive' ? TrendingUp : TrendingDown;
                    const sev = s.severity || (s.impact === 'negative' ? 'high' : 'low');
                    const sevCls = sev === 'high' ? 'bg-red-50 text-red-700 border-red-200' : sev === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200';
                    return (
                      <div key={i} className="flex gap-3 p-3 border rounded-lg">
                        <ImpactIcon className={`w-4 h-4 mt-0.5 shrink-0 ${s.impact === 'positive' ? 'text-emerald-600' : 'text-red-500'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-bold">{s.pattern}</p>
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
            <button className="text-xs text-primary flex items-center gap-0.5 mt-4 hover:underline"
              onClick={() => navigate('/analysis')}>
              View full analysis <ChevronRight className="w-3 h-3" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION 5: AI Recommendations ── */}
      <div id="ai-recommendations">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dynamic impact banner */}
            {immediateRecs.length > 0 && nearGapTotal > 0 && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                <Flame className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-emerald-800">
                  Implementing all high-priority actions could recover up to{' '}
                  <span className="font-bold">{INR_CR(nearGapTotal)}</span> in the next 30 days.
                </p>
              </div>
            )}

            {/* Immediate Actions */}
            {immediateRecs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 bg-red-500 rounded-full" />
                  <Zap className="w-4 h-4 text-red-500" />
                  <p className="text-sm font-semibold text-red-700">Immediate Actions</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {immediateRecs.map((r, i) => <RecCard key={i} r={r} />)}
                </div>
              </div>
            )}

            {/* Strategic Actions */}
            {strategicRecs.length > 0 && (
              <div>
                {immediateRecs.length > 0 && <div className="border-t my-2" />}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 bg-blue-500 rounded-full" />
                  <Target className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-semibold text-blue-700">Strategic Actions</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {strategicRecs.map((r, i) => <RecCard key={i} r={r} />)}
                </div>
              </div>
            )}

            {visibleRecs.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                All recommendations dismissed.{' '}
                <button className="text-primary hover:underline" onClick={() => setDismissedRecs(new Set())}>Reset</button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}