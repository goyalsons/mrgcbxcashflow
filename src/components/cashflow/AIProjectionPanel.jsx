import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { formatINR } from '@/lib/utils/currency';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Sparkles, RefreshCw, CalendarClock, Target, Lightbulb, Activity
} from 'lucide-react';

const RISK_COLORS = {
  safe: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  caution: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
};
const RISK_ICONS = {
  safe: CheckCircle2,
  caution: AlertTriangle,
  danger: AlertTriangle,
};
const PRIORITY_COLORS = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};
const IMPACT_COLORS = {
  positive: 'text-emerald-600',
  negative: 'text-red-600',
  neutral: 'text-muted-foreground',
};

function HealthScoreRing({ score }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'Healthy' : score >= 45 ? 'At Risk' : 'Critical';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="2.5"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <Badge variant="outline" className={score >= 70 ? RISK_COLORS.safe : score >= 45 ? RISK_COLORS.caution : RISK_COLORS.danger}>
        {label}
      </Badge>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatINR(p.value)}</p>
      ))}
    </div>
  );
};

export default function AIProjectionPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('aiCashFlowProjection', {});
    if (res.data?.projection) {
      setData(res.data);
    } else {
      setError('Failed to generate projection. Please try again.');
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
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
  const { monthly_projection = [], cash_gaps = [], seasonal_insights = [], recommendations = [], health_score, health_summary, key_metrics = {} } = projection;

  const chartData = monthly_projection.map(m => ({
    name: m.month,
    'Projected Inflow': m.projected_inflow,
    'Projected Outflow': m.projected_outflow,
    'Balance': m.closing_balance,
    risk: m.risk_level,
  }));

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="w-4 h-4" />
          <span>Generated {new Date(meta.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{meta.data_points.payments} payments analyzed</span>
        </div>
        <Button variant="outline" size="sm" onClick={run} className="gap-1.5 h-8 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Health score + Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        <Card className="md:col-span-1 flex items-center justify-center p-5">
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cash Health Score</p>
            <HealthScoreRing score={health_score} />
            <p className="text-xs text-center text-muted-foreground mt-1 leading-relaxed">{health_summary}</p>
          </div>
        </Card>
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Avg. Days to Collect', value: `${key_metrics.avg_days_to_collect || 0} days`, icon: CalendarClock, color: 'text-blue-600' },
            { label: 'Collection Rate', value: `${key_metrics.collection_rate_pct || 0}%`, icon: Target, color: 'text-emerald-600' },
            { label: 'Months of Runway', value: `${key_metrics.months_of_runway || 0} mo`, icon: TrendingUp, color: 'text-primary' },
            { label: 'Overdue Receivables', value: `${key_metrics.overdue_receivables_pct || 0}%`, icon: AlertTriangle, color: 'text-amber-600' },
          ].map((m, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 6-Month Balance Projection Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">6-Month Balance Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(234, 89%, 56%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(234, 89%, 56%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Projected Inflow" stroke="hsl(160, 84%, 39%)" fill="url(#inflowGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Balance" stroke="hsl(234, 89%, 56%)" fill="url(#balanceGrad)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(234, 89%, 56%)' }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /><span className="text-xs text-muted-foreground">Projected Inflow</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary" /><span className="text-xs text-muted-foreground">Closing Balance</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Projection Table */}
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
                <TableHead className="text-center">Risk</TableHead>
                <TableHead className="text-center">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly_projection.map((m, i) => {
                const net = m.net_cashflow ?? (m.projected_inflow - m.projected_outflow);
                const RiskIcon = RISK_ICONS[m.risk_level] || CheckCircle2;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.month}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatINR(m.projected_inflow)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatINR(m.projected_outflow)}</TableCell>
                    <TableCell className={`text-right font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatINR(net)}</TableCell>
                    <TableCell className={`text-right font-bold ${m.closing_balance >= 0 ? '' : 'text-red-600'}`}>{formatINR(m.closing_balance)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs gap-1 ${RISK_COLORS[m.risk_level]}`}>
                        <RiskIcon className="w-3 h-3" />
                        {m.risk_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground capitalize">{m.confidence}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cash Gaps + Seasonal Insights */}
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
            {cash_gaps.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 py-4">
                <CheckCircle2 className="w-4 h-4" />
                No cash gaps detected in the projection period.
              </div>
            ) : (
              <div className="space-y-3">
                {cash_gaps.map((g, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${g.severity === 'high' ? 'bg-red-50 border-red-200' : g.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{g.period}</p>
                      <Badge variant="outline" className={`text-xs shrink-0 ${g.severity === 'high' ? 'bg-red-100 text-red-700 border-red-300' : g.severity === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                        {g.severity} risk
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.reason}</p>
                    {g.shortfall > 0 && (
                      <p className="text-sm font-bold text-red-600 mt-1">Shortfall: {formatINR(g.shortfall)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seasonal Insights */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Seasonal Trend Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seasonal_insights.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No seasonal patterns detected — more historical data needed.</p>
            ) : (
              <div className="space-y-3">
                {seasonal_insights.map((s, i) => {
                  const ImpactIcon = s.impact === 'positive' ? TrendingUp : s.impact === 'negative' ? TrendingDown : Activity;
                  return (
                    <div key={i} className="flex gap-3 p-3 bg-muted/40 rounded-lg">
                      <ImpactIcon className={`w-4 h-4 mt-0.5 shrink-0 ${IMPACT_COLORS[s.impact]}`} />
                      <div>
                        <p className="text-sm font-semibold">{s.pattern}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.map((r, i) => (
              <div key={i} className="flex gap-3 p-4 border rounded-xl bg-card hover:shadow-sm transition-shadow">
                <Badge variant="outline" className={`text-xs h-fit shrink-0 mt-0.5 ${PRIORITY_COLORS[r.priority]}`}>
                  {r.priority}
                </Badge>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{r.action}</p>
                  <p className="text-xs text-muted-foreground">{r.expected_impact}</p>
                  {r.timeline && (
                    <p className="text-xs text-primary font-medium flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {r.timeline}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}