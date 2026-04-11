import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SimTable from '@/components/simulator/SimTable';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ReferenceArea
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
  const fundingImpact = (d.fundingInflow || 0) - (d.repaymentOutflow || 0);
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold border-b pb-1">{label}</p>
      <p className="text-emerald-600">Inflow: {INR(d.simInflow)}</p>
      <p className="text-red-600">Outflow: {INR(d.simOutflow)}</p>
      <p className="text-indigo-700 font-semibold">Weekly Cashflow: {INR(d.simNet)}</p>
      <p className="text-teal-600">Closing: {INR(d.simClosing)}</p>
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

export default function SimChart({ weeklyData, hasAdjustments = true, bankAccounts = [] }) {
  const hasFunding = weeklyData.some(w => (w.fundingInflow || 0) + (w.repaymentOutflow || 0) > 0);
  const [tableOpen, setTableOpen] = useState(false);

  const chartData = weeklyData.map(w => ({
    name: w.label,
    simInflow: Math.round(w.simInflow),
    simOutflow: Math.round(w.simOutflow),
    simNet: w.simNet,
    simNetWithFunding: w.simNet,
    simClosing: w.simClosing,
    baseNet: w.baseNet,
    baseClosing: w.baseClosing,
    fundingInflow: w.fundingInflow || 0,
    repaymentOutflow: w.repaymentOutflow || 0,
    simItems: w.simItems,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Simulated Cash Flow</CardTitle>
        <div className="flex items-center gap-5 mt-1 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-400" /><span className="text-[11px] text-muted-foreground">Inflow</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-400" /><span className="text-[11px] text-muted-foreground">Outflow</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 rounded" style={{ height: 2, background: '#1d4ed8' }} /><span className="text-[11px] text-muted-foreground">Weekly Cashflow</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 rounded" style={{ height: 2, background: '#15803d' }} /><span className="text-[11px] text-muted-foreground">Closing</span></div>
          {hasFunding && <div className="flex items-center gap-1.5"><div className="w-4 rounded" style={{ height: 3, background: '#9333ea' }} /><span className="text-[11px] text-muted-foreground">With funding</span></div>}
        </div>
      </CardHeader>
      <CardContent>
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
        <div className="relative">
          {!hasAdjustments && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="bg-card/80 border rounded-xl px-4 py-2.5 text-sm text-muted-foreground text-center shadow">
                Make adjustments on the left to see the simulated impact here.
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 1" stroke="hsl(var(--border))" strokeOpacity={0.7} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => INR(v)} stroke="hsl(var(--muted-foreground))" tickCount={10} />
              <Tooltip content={<SimTooltip />} />
              {chartData.map((d, i) => d.simNet < 0 && (
                <ReferenceArea key={`sim-neg-${i}`} x1={d.name} x2={d.name} fill="#ef444415" />
              ))}
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: 'Break-even', position: 'insideRight', fontSize: 10, fill: '#ef4444' }} />
              <Bar dataKey="simInflow" name="Inflow" fill="#10b981" opacity={0.65} radius={[3,3,0,0]} />
              <Bar dataKey="simOutflow" name="Outflow" fill="#ef4444" opacity={0.65} radius={[3,3,0,0]} />
              <Area type="monotone" dataKey="simNet" fill="url(#posGrad)" stroke="none" />
              <Line type="monotone" dataKey="simNet" name="Weekly Cashflow" stroke="#1d4ed8" strokeWidth={2.5} isAnimationActive={true} animationDuration={400}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.simNet < 0) return <circle key={`sd-${cx}`} cx={cx} cy={cy} r={5} fill="#f97316" stroke="#fff" strokeWidth={1.5} />;
                  return <circle key={`sd-${cx}`} cx={cx} cy={cy} r={2.5} fill="#1d4ed8" />;
                }}
              />
              {hasFunding && (
                <Line type="monotone" dataKey="simNetWithFunding" name="With funding" stroke="#9333ea" strokeWidth={2.5} isAnimationActive={true} animationDuration={400}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if ((payload.fundingInflow || 0) > 0) return <polygon key={cx} points={`${cx},${cy-6} ${cx-5},${cy+4} ${cx+5},${cy+4}`} fill="#9333ea" />;
                    if ((payload.repaymentOutflow || 0) > 0) return <polygon key={cx} points={`${cx},${cy+6} ${cx-5},${cy-4} ${cx+5},${cy-4}`} fill="#b91c1c" />;
                    return <circle key={cx} cx={cx} cy={cy} r={2} fill="#9333ea" />;
                  }}
                />
              )}
              <Line type="monotone" dataKey="simClosing" name="Closing" stroke="#15803d" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Collapsible Weekly Comparison Table */}
        <div className="mt-3 border rounded-lg overflow-hidden">
          <button
            onClick={() => setTableOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 bg-muted/10 transition-colors"
          >
            <span>Weekly Comparison Table</span>
            {tableOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {tableOpen && <SimTable weeklyData={weeklyData} bankAccounts={bankAccounts} />}
        </div>
      </CardContent>
    </Card>
  );
}