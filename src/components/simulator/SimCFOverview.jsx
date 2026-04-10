import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const INR_K = (v) => `₹${(Math.abs(v || 0) / 1000).toFixed(0)}K`;

const CFTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold border-b pb-1">{label}</p>
      <p className="text-emerald-600">Sim Inflow: {INR(d.simInflow)}</p>
      <p className="text-red-600">Sim Outflow: {INR(d.simOutflow)}</p>
      <p className={`font-bold ${(d.simNet || 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
        Net: {INR(d.simNet)}
      </p>
      <p className={`${(d.simClosing || 0) >= 0 ? 'text-slate-600' : 'text-red-600'}`}>
        Closing: {INR(d.simClosing)}
      </p>
    </div>
  );
};

export default function SimCFOverview({ weeklyData }) {
  const [chartCollapsed, setChartCollapsed] = useState(false);
  const [tableCollapsed, setTableCollapsed] = useState(true);

  const chartData = weeklyData.map(w => ({
    name: w.label,
    simInflow: Math.round(w.simInflow),
    simOutflow: Math.round(w.simOutflow),
    simNet: Math.round(w.simNet),
    simClosing: Math.round(w.simClosing),
  }));

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Chart section */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <span className="text-sm font-semibold">Weekly Inflow, Outflow & Net Cash Flow (Simulated)</span>
        <button
          onClick={() => setChartCollapsed(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
        >
          {chartCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          {chartCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!chartCollapsed && (
        <div className="p-3">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={INR_K} />
              <Tooltip content={<CFTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="simInflow"  name="Sim Inflow"  fill="#10b981" radius={[3,3,0,0]} stackId="a" />
              <Bar dataKey="simOutflow" name="Sim Outflow" fill="#ef4444" radius={[3,3,0,0]} stackId="b" />
              <Line type="monotone" dataKey="simNet" name="Net Cash Flow" stroke="#1d4ed8" strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return <circle key={cx} cx={cx} cy={cy} r={payload.simNet < 0 ? 5 : 3}
                    fill={payload.simNet < 0 ? '#ef4444' : '#1d4ed8'} stroke="#fff" strokeWidth={1} />;
                }}
              />
              <Line type="monotone" dataKey="simClosing" name="Closing Balance" stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly breakdown table */}
      <div className="border-t">
        <button
          onClick={() => setTableCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <span>Weekly Breakdown Detail</span>
          {tableCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {!tableCollapsed && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap">Week</TableHead>
                  <TableHead className="text-right text-emerald-700 text-xs">Sim Inflow</TableHead>
                  <TableHead className="text-right text-red-700 text-xs">Sim Outflow</TableHead>
                  <TableHead className="text-right text-blue-700 text-xs font-bold">Sim Net</TableHead>
                  <TableHead className="text-right text-xs">Sim Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyData.map((w, i) => (
                  <TableRow key={i} className={w.simClosing < 0 ? 'bg-red-50/50' : i % 2 === 0 ? '' : 'bg-muted/20'}>
                    <TableCell className="text-xs font-medium whitespace-nowrap">{w.label}</TableCell>
                    <TableCell className="text-right text-emerald-600 text-xs">{INR(w.simInflow)}</TableCell>
                    <TableCell className="text-right text-red-600 text-xs">{INR(w.simOutflow)}</TableCell>
                    <TableCell className={`text-right font-semibold text-xs ${w.simNet >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {w.simNet >= 0 ? '▲' : '▼'} {INR(Math.abs(w.simNet))}
                    </TableCell>
                    <TableCell className={`text-right font-bold text-xs ${w.simClosing >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                      {INR(w.simClosing)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}