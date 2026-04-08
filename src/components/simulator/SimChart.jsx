import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area
} from 'recharts';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${abs.toLocaleString('en-IN')}`;
};

const SimTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  const delta = d.simNet - d.baseNet;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold border-b pb-1">{label}</p>
      <p className="text-blue-600">Baseline Net: {INR(d.baseNet)}</p>
      <p className="text-emerald-600">Simulated Net: {INR(d.simNet)}</p>
      <p className={`font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Δ {delta >= 0 ? '+' : ''}{INR(delta)}</p>
      {d.simItems?.length > 0 && (
        <div className="border-t pt-1 space-y-0.5">
          {d.simItems.slice(0, 4).map((item, i) => (
            <p key={i} className="text-muted-foreground">
              {item.split ? '⑂ ' : ''}{item.label} {item.type === 'inflow' ? '↑' : '↓'} {INR(item.amount)}
              {item.hypo ? <span className="text-blue-500 ml-1">sim</span> : ''}
            </p>
          ))}
          {d.simItems.length > 4 && <p className="text-muted-foreground">+{d.simItems.length - 4} more…</p>}
        </div>
      )}
    </div>
  );
};

export default function SimChart({ weeklyData }) {
  const chartData = weeklyData.map(w => ({
    name: w.label, baseNet: w.baseNet, simNet: w.simNet,
    diff: w.simNet - w.baseNet,
    fillPos: w.simNet > w.baseNet ? w.simNet : w.baseNet,
    fillNeg: w.simNet < w.baseNet ? w.simNet : w.baseNet,
    simItems: w.simItems,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Net Cash Flow — Baseline vs Simulated</CardTitle>
        {/* Custom legend */}
        <div className="flex items-center gap-5 mt-1 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-blue-600 rounded" style={{ height: 3 }} /><span className="text-[11px] text-muted-foreground">Baseline</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 rounded" style={{ height: 2, borderTop: '2px dashed #10b981' }} /><span className="text-[11px] text-muted-foreground">Simulated</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-200 opacity-70" /><span className="text-[11px] text-muted-foreground">Improvement</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-200 opacity-70" /><span className="text-[11px] text-muted-foreground">Worsening</span></div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.02} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => INR(v)} stroke="hsl(var(--muted-foreground))" />
            <Tooltip content={<SimTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: 'Break-even', position: 'right', fontSize: 10, fill: '#ef4444' }} />
            {/* Shaded diff areas */}
            <Area type="monotone" dataKey="fillPos" fill="url(#posGrad)" stroke="none" />
            <Area type="monotone" dataKey="fillNeg" fill="url(#negGrad)" stroke="none" />
            {/* Lines */}
            <Line type="monotone" dataKey="baseNet" name="Baseline" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="simNet" name="Simulated" stroke="#10b981" strokeWidth={2} strokeDasharray="6 3"
              dot={(props) => {
                const { cx, cy, payload } = props;
                const prev = chartData[chartData.indexOf(payload) - 1];
                const crossesPositive = prev && prev.simNet < 0 && payload.simNet >= 0;
                if (!crossesPositive) return <circle cx={cx} cy={cy} r={3} fill="#10b981" />;
                return (
                  <g key={cx}>
                    <circle cx={cx} cy={cy} r={6} fill="#10b981" />
                    <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fill="#10b981" fontWeight="600">Turns +</text>
                  </g>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}