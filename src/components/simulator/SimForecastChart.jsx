import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

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
  const totalOut = data.outflow || 0;
  const net = data.net || 0;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 min-w-[220px]">
      <p className="font-semibold text-sm mb-2 border-b pb-1">{label}</p>
      <div className="space-y-0.5">
        <p className="font-medium text-emerald-700 mb-1">Inflows</p>
        <div className="flex justify-between"><span className="text-emerald-600">Receivables</span><span className="font-medium">{INR_FMT(data.inflowReceivables || 0)}</span></div>
      </div>
      <div className="border-t my-1 pt-1 space-y-0.5">
        <p className="font-medium text-red-700 mb-1">Outflows</p>
        <div className="flex justify-between"><span className="text-red-600">Payables</span><span className="font-medium">{INR_FMT(data.payablesOut || 0)}</span></div>
        {EXPENSE_GROUPS.map(g => (data[g] || 0) > 0 && (
          <div key={g} className="flex justify-between"><span className="text-slate-500">{g}</span><span className="font-medium">{INR_FMT(data[g] || 0)}</span></div>
        ))}
      </div>
      <div className={`border-t pt-1 flex justify-between font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
        <span>Net</span><span>{INR_FMT(net)}</span>
      </div>
    </div>
  );
};

export default function SimForecastChart({ weeklyData }) {
  const [collapsed, setCollapsed] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);

  const chartData = weeklyData.map(w => ({
    label: w.label,
    inflow: Math.round(w.baseInflow || 0),
    outflow: Math.round(w.baseOutflow || 0),
    net: Math.round(w.baseNet || 0),
    closing: Math.round(w.baseClosing || 0),
    isCurrentWeek: w.isCurrentWeek,
    // stacked breakdown
    inflowReceivables: Math.round(w.inflowReceivables || 0),
    payablesOut: Math.round(w.payablesOut || 0),
    ...Object.fromEntries(EXPENSE_GROUPS.map(g => [g, Math.round(w[g] || 0)])),
  }));

  const currentWeekLabel = chartData[0]?.label;

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Collapsible header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-semibold">Actual Cash Flow</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t">
          {/* Chart */}
          <div className="p-4 overflow-x-auto">
            <p className="text-xs text-muted-foreground mb-3">Stacked bars show breakdown by type. Line shows net cash flow.</p>
            <ResponsiveContainer width="100%" height={380} minWidth={620}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <ReferenceArea y1={-9999999999} y2={0} fill="#ef4444" fillOpacity={0.07} />
                <ReferenceLine x={currentWeekLabel} stroke="#6366f1" strokeDasharray="4 2" strokeWidth={2}
                  label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#6366f1' }} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 10 }} />
                <Tooltip content={<WeeklyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* Inflow stacked */}
                <Bar dataKey="inflowReceivables" name="↑ Inflow" stackId="in" fill="#10b981" radius={[3,3,0,0]} />
                {/* Outflow stacked */}
                <Bar dataKey="payablesOut"       name="Payables"       stackId="out" fill="#ef4444" />
                <Bar dataKey="Salary"            name="Salary"         stackId="out" fill="#f97316" />
                <Bar dataKey="Rent/Utilities"    name="Rent/Utilities" stackId="out" fill="#a855f7" />
                <Bar dataKey="Travel"            name="Travel"         stackId="out" fill="#3b82f6" />
                <Bar dataKey="Marketing"         name="Marketing"      stackId="out" fill="#ec4899" />
                <Bar dataKey="Software"          name="Software"       stackId="out" fill="#14b8a6" />
                <Bar dataKey="Maintenance"       name="Maintenance"    stackId="out" fill="#84cc16" />
                <Bar dataKey="Office & Other"    name="Office & Other" stackId="out" fill="#94a3b8" radius={[3,3,0,0]} />
                <Line type="monotone" dataKey="net" name="Weekly Cash Flow" stroke="#1d4ed8" strokeWidth={2.5} dot={<NetDotWithLabel />} />
                <Line type="monotone" dataKey="closing" name="Closing Balance" stroke="#15803d" strokeWidth={2.5} dot={false} isAnimationActive={false} />
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
                      <TableHead
                        className="sticky top-0 bg-card z-10 text-right cursor-pointer select-none"
                        onClick={() => setShowExpenseDetail(v => !v)}
                      >
                        <span className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                          {showExpenseDetail ? '◀' : '▶'}
                          <span className="text-xs font-medium">Expense Detail</span>
                        </span>
                      </TableHead>
                      {showExpenseDetail && <>
                        <TableHead className="sticky top-0 bg-amber-50 z-10 text-right text-red-700 whitespace-nowrap">Payables</TableHead>
                        <TableHead className="sticky top-0 bg-amber-50 z-10 text-right text-orange-600 whitespace-nowrap">Salary</TableHead>
                        <TableHead className="sticky top-0 bg-amber-50 z-10 text-right text-purple-600 whitespace-nowrap">Rent/Util</TableHead>
                        <TableHead className="sticky top-0 bg-amber-50 z-10 text-right text-blue-600 whitespace-nowrap">Travel</TableHead>
                        <TableHead className="sticky top-0 bg-amber-50 z-10 text-right text-pink-600 whitespace-nowrap">Mktg</TableHead>
                        <TableHead className="sticky top-0 bg-amber-50 z-10 text-right text-teal-600 whitespace-nowrap">Software</TableHead>
                        <TableHead className="sticky top-0 bg-amber-50 z-10 text-right text-slate-600 whitespace-nowrap">Other</TableHead>
                      </>}
                      <TableHead className="sticky top-0 bg-card z-10 text-right font-bold">Total Out</TableHead>
                      <TableHead className="sticky top-0 bg-indigo-50 z-10 text-right font-bold text-indigo-700">Net</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right font-bold">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData.map((w, i) => (
                      <TableRow
                         key={i}
                         className={`${w.baseNet < 0 ? 'bg-red-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-muted/20'} ${w.isCurrentWeek ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                       >
                        <TableCell className="font-medium text-xs whitespace-nowrap">
                          {w.label}{w.isCurrentWeek && <span className="ml-1 text-indigo-500 text-xs">•</span>}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 text-xs bg-emerald-50/40 font-medium">
                          ₹{Math.round(w.baseInflow || 0).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground cursor-pointer" onClick={() => setShowExpenseDetail(v => !v)}>
                          {showExpenseDetail ? '▲ hide' : '▼ show'}
                        </TableCell>
                        {showExpenseDetail && <>
                          <TableCell className="text-right text-red-600 text-xs bg-amber-50/40">₹{Math.round(w.payablesOut || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-orange-600 text-xs bg-amber-50/40">₹{Math.round(w['Salary'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-purple-600 text-xs bg-amber-50/40">₹{Math.round(w['Rent/Utilities'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-blue-600 text-xs bg-amber-50/40">₹{Math.round(w['Travel'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-pink-600 text-xs bg-amber-50/40">₹{Math.round(w['Marketing'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-teal-600 text-xs bg-amber-50/40">₹{Math.round(w['Software'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-slate-600 text-xs bg-amber-50/40">₹{Math.round(w['Office & Other'] || 0).toLocaleString('en-IN')}</TableCell>
                        </>}
                        <TableCell className="text-right text-red-700 font-semibold text-xs">
                          ₹{Math.round(w.baseOutflow || 0).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className={`text-right font-bold text-xs bg-indigo-50 ${(w.baseNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {(w.baseNet || 0) >= 0 ? '▲' : '▼'} ₹{Math.abs(Math.round(w.baseNet || 0)).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className={`text-right font-bold text-xs ${(w.baseClosing || 0) >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                          ₹{Math.abs(Math.round(w.baseClosing || 0)).toLocaleString('en-IN')}
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