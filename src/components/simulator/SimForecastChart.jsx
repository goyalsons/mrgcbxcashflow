import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ReferenceArea, ReferenceLine
} from 'recharts';

const INR_FMT = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const NetDotWithLabel = (props) => {
  const { cx, cy, payload } = props;
  if (!payload || payload.net >= 0) return <circle cx={cx} cy={cy} r={4} fill="#1d4ed8" />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight="600">
        {INR_FMT(payload.net)}
      </text>
    </g>
  );
};

const WeeklyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload || {};
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold text-sm mb-2 border-b pb-1">{label}</p>
      <div className="flex justify-between"><span className="text-emerald-600">Inflow</span><span className="font-medium">{INR_FMT(data.inflow || 0)}</span></div>
      <div className="flex justify-between"><span className="text-red-600">Outflow</span><span className="font-medium">{INR_FMT(data.outflow || 0)}</span></div>
      <div className={`border-t pt-1 flex justify-between font-bold ${(data.net || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
        <span>Net</span><span>{INR_FMT(data.net || 0)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground"><span>Closing</span><span>{INR_FMT(data.closing || 0)}</span></div>
    </div>
  );
};

export default function SimForecastChart({ weeklyData }) {
  const [collapsed, setCollapsed] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);

  const chartData = weeklyData.map(w => ({
    label: w.label,
    inflow: Math.round(w.simInflow || 0),
    outflow: Math.round(w.simOutflow || 0),
    net: Math.round(w.simNet || 0),
    closing: Math.round(w.simClosing || 0),
    isCurrentWeek: w.isCurrentWeek,
  }));

  const currentWeekLabel = chartData[0]?.label;

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Collapsible header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-semibold">Weekly Inflow, Outflow &amp; Net Cash Flow</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t">
          {/* Chart */}
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Bars show weekly inflow/outflow. Line shows net cash flow.</p>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <ReferenceArea y1={-9999999999} y2={0} fill="#ef4444" fillOpacity={0.07} />
                <ReferenceLine x={currentWeekLabel} stroke="#6366f1" strokeDasharray="4 2" strokeWidth={2}
                  label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#6366f1' }} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 10 }} />
                <Tooltip content={<WeeklyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inflow" name="↑ Inflow" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outflow" name="↓ Outflow" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#1d4ed8" strokeWidth={2.5} dot={<NetDotWithLabel />} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Collapsible weekly breakdown table */}
          <div className="border-t">
            <button
              onClick={() => setTableOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <span>Weekly Breakdown Detail</span>
              {tableOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {tableOpen && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-card z-10 whitespace-nowrap">Week</TableHead>
                      <TableHead className="sticky top-0 bg-emerald-50 z-10 text-right text-emerald-700 whitespace-nowrap font-semibold">Inflow</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right font-bold text-red-700">Outflow</TableHead>
                      <TableHead className="sticky top-0 bg-indigo-50 z-10 text-right font-bold text-indigo-700">Net</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right font-bold">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.map((w, i) => (
                      <TableRow
                        key={i}
                        className={`${w.net < 0 ? 'bg-red-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-muted/20'} ${w.isCurrentWeek ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                      >
                        <TableCell className="font-medium text-xs whitespace-nowrap">
                          {w.label}{w.isCurrentWeek && <span className="ml-1 text-indigo-500 text-xs">•</span>}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 text-xs bg-emerald-50/40 font-medium">{INR_FMT(w.inflow)}</TableCell>
                        <TableCell className="text-right text-red-700 font-semibold text-xs">{INR_FMT(w.outflow)}</TableCell>
                        <TableCell className={`text-right font-bold text-xs bg-indigo-50 ${w.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {w.net >= 0 ? '▲' : '▼'} {INR_FMT(Math.abs(w.net))}
                        </TableCell>
                        <TableCell className={`text-right font-bold text-xs ${w.closing >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                          {INR_FMT(Math.abs(w.closing))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}