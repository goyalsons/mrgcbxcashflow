import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area
} from 'recharts';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${abs.toLocaleString('en-IN')}`;
};

const SimTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  const delta = d.simNet - d.baseNet;
  const fundingImpact = (d.fundingInflow || 0) - (d.repaymentOutflow || 0);
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold border-b pb-1">{label}</p>
      <p className="text-blue-600">Baseline Net: {INR(d.baseNet)}</p>
      <p className="text-emerald-600">Sim (Scheduled): {INR(d.simNet)}</p>
      {d.simNetWithFunding !== undefined && <p className="text-purple-600">Sim (With Funding): {INR(d.simNetWithFunding)}</p>}
      <p className={`font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Δ Schedule: {delta >= 0 ? '+' : ''}{INR(delta)}</p>
      {fundingImpact !== 0 && <p className="text-purple-600">Funding net: {fundingImpact >= 0 ? '+' : ''}{INR(fundingImpact)}</p>}
      {d.simItems?.length > 0 && (
        <div className="border-t pt-1 space-y-0.5">
          {d.simItems.slice(0, 5).map((item, i) => (
            <p key={i} className={`${item.funding ? 'text-purple-600' : item.repayment ? 'text-red-600' : 'text-muted-foreground'}`}>
              {item.split ? '⑂ ' : ''}{item.label} {item.type === 'inflow' ? '↑' : '↓'} {INR(item.amount)}
              {item.hypo ? <span className="text-blue-500 ml-1">sim</span> : ''}
              {item.funding ? <span className="ml-1">💰</span> : ''}
            </p>
          ))}
          {d.simItems.length > 5 && <p className="text-muted-foreground">+{d.simItems.length - 5} more…</p>}
        </div>
      )}
    </div>
  );
};

export default function SimChart({ weeklyData }) {
  const chartData = weeklyData.map((w, idx) => {
    const simNetWithFunding = w.simNet; // simNet already includes funding
    return {
      name: w.label,
      baseNet: w.baseNet,
      simNet: w.simNet,
      simNetWithFunding,
      fundingInflow: w.fundingInflow || 0,
      repaymentOutflow: w.repaymentOutflow || 0,
      simItems: w.simItems,
    };
  });

  const hasFunding = weeklyData.some(w => (w.fundingInflow || 0) + (w.repaymentOutflow || 0) > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Net Cash Flow — Baseline vs Simulated</CardTitle>
        {/* Custom legend */}
        <div className="flex items-center gap-5 mt-1 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-4 rounded" style={{ height: 3, background: '#3b82f6' }} /><span className="text-[11px] text-muted-foreground">Baseline</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 rounded" style={{ height: 2, borderTop: '2px dashed #10b981' }} /><span className="text-[11px] text-muted-foreground">Scheduled only</span></div>
          {hasFunding && <div className="flex items-center gap-1.5"><div className="w-4 rounded" style={{ height: 3, background: '#9333ea' }} /><span className="text-[11px] text-muted-foreground">With funding &amp; levers</span></div>}
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-200 opacity-70" /><span className="text-[11px] text-muted-foreground">Improvement</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-200 opacity-70" /><span className="text-[11px] text-muted-foreground">Worsening</span></div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Funding markers */}
        {hasFunding && (
          <div className="flex flex-wrap gap-1 mb-2 px-1">
            {weeklyData.map((w, i) => {
              const hasF = (w.fundingInflow || 0) > 0;
              const hasR = (w.repaymentOutflow || 0) > 0;
              if (!hasF && !hasR) return null;
              return (
                <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${hasF ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                  {w.label.split(' ')[0]} {hasF ? '▲ funding' : '▼ repay'}
                </span>
              );
            })}
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.02} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => INR(v)} stroke="hsl(var(--muted-foreground))" />
            <Tooltip content={<SimTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: 'Break-even', position: 'right', fontSize: 10, fill: '#ef4444' }} />
            <Area type="monotone" dataKey="simNet" fill="url(#posGrad)" stroke="none" />
            <Area type="monotone" dataKey="baseNet" fill="url(#negGrad)" stroke="none" />
            <Line type="monotone" dataKey="baseNet" name="Baseline" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="simNet" name="Scheduled only" stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" dot={false} />
            {hasFunding && (
              <Line type="monotone" dataKey="simNetWithFunding" name="With funding" stroke="#9333ea" strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if ((payload.fundingInflow || 0) > 0) return <polygon key={cx} points={`${cx},${cy-6} ${cx-5},${cy+4} ${cx+5},${cy+4}`} fill="#9333ea" />;
                  if ((payload.repaymentOutflow || 0) > 0) return <polygon key={cx} points={`${cx},${cy+6} ${cx-5},${cy-4} ${cx+5},${cy-4}`} fill="#b91c1c" />;
                  return <circle key={cx} cx={cx} cy={cy} r={2} fill="#9333ea" />;
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}