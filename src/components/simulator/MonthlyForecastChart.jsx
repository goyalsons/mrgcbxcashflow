import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ReferenceArea, ReferenceLine
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const INR_FMT = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

const NetDot = (props) => {
  const { cx, cy, payload } = props;
  if (!payload || payload.net >= 0) return <circle cx={cx} cy={cy} r={5} fill="#1d4ed8" stroke="#fff" strokeWidth={1.5} />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight="600">{INR_FMT(payload.net)}</text>
    </g>
  );
};

const MonthlyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 min-w-[240px]">
      <p className="font-semibold text-sm mb-2 border-b pb-1">{label}</p>
      <p className="font-medium text-emerald-700 mb-1">Inflows</p>
      <div className="flex justify-between"><span className="text-emerald-600">Receivables</span><span>{INR_FMT(d.inflowReceivables || 0)}</span></div>
      <div className="flex justify-between"><span className="text-emerald-500">Invoices</span><span>{INR_FMT(d.inflowInvoices || 0)}</span></div>
      <div className="flex justify-between"><span className="text-teal-600">Coll. Targets</span><span>{INR_FMT(d.inflowTargets || 0)}</span></div>
      <p className="font-medium text-red-700 mt-2 mb-1">Outflows</p>
      <div className="flex justify-between"><span className="text-red-600">Payables</span><span>{INR_FMT(d.payablesOut || 0)}</span></div>
      {EXPENSE_GROUPS.map(g => (d[g] || 0) > 0 && (
        <div key={g} className="flex justify-between"><span className="text-slate-500">{g}</span><span>{INR_FMT(d[g] || 0)}</span></div>
      ))}
      <div className={`border-t pt-1 mt-1 flex justify-between font-bold ${(d.net || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
        <span>Net</span><span>{INR_FMT(d.net || 0)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Closing Balance</span><span className="font-medium">{INR_FMT(d.closing || 0)}</span>
      </div>
    </div>
  );
};

export default function MonthlyForecastChart({ monthlyData }) {
  const [collapsed, setCollapsed]   = useState(false);
  const [tableOpen, setTableOpen]   = useState(false);
  const [showExpDetail, setShowExpDetail] = useState(false);

  const chartData = monthlyData.map(m => ({
    label: m.label,
    inflow:  Math.round(m.simInflow  || 0),
    outflow: Math.round(m.simOutflow || 0),
    net:     Math.round(m.simNet     || 0),
    closing: Math.round(m.simClosing || 0),
    isCurrentMonth: m.isCurrentMonth,
    inflowReceivables: Math.round(m.inflowReceivables || 0),
    inflowInvoices:    Math.round(m.inflowInvoices    || 0),
    inflowTargets:     Math.round(m.inflowTargets     || 0),
    payablesOut:       Math.round(m.payablesOut       || 0),
    ...Object.fromEntries(EXPENSE_GROUPS.map(g => [g, Math.round(m[g] || 0)])),
  }));

  const currentMonthLabel = chartData[0]?.label;

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-semibold">Monthly Inflow, Outflow &amp; Net Cash Flow (6 Months)</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t">
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Stacked bars show category breakdown. Line = net monthly cash flow.</p>
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <ReferenceArea y1={-9999999999} y2={0} fill="#ef4444" fillOpacity={0.07} />
                <ReferenceLine x={currentMonthLabel} stroke="#6366f1" strokeDasharray="4 2" strokeWidth={2}
                  label={{ value: 'Now', position: 'top', fontSize: 10, fill: '#6366f1' }} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 10 }} />
                <Tooltip content={<MonthlyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inflowReceivables" name="↑ Receivables"   stackId="in"  fill="#10b981" />
                <Bar dataKey="inflowInvoices"    name="↑ Invoices"      stackId="in"  fill="#34d399" />
                <Bar dataKey="inflowTargets"     name="↑ Coll. Targets" stackId="in"  fill="#6ee7b7" radius={[3,3,0,0]} />
                <Bar dataKey="payablesOut"       name="Payables"        stackId="out" fill="#ef4444" />
                <Bar dataKey="Salary"            name="Salary"          stackId="out" fill="#f97316" />
                <Bar dataKey="Rent/Utilities"    name="Rent/Utilities"  stackId="out" fill="#a855f7" />
                <Bar dataKey="Travel"            name="Travel"          stackId="out" fill="#3b82f6" />
                <Bar dataKey="Marketing"         name="Marketing"       stackId="out" fill="#ec4899" />
                <Bar dataKey="Software"          name="Software"        stackId="out" fill="#14b8a6" />
                <Bar dataKey="Maintenance"       name="Maintenance"     stackId="out" fill="#84cc16" />
                <Bar dataKey="Office & Other"    name="Office & Other"  stackId="out" fill="#94a3b8" radius={[3,3,0,0]} />
                <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#1d4ed8" strokeWidth={2.5} dot={<NetDot />} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="border-t">
            <button
              onClick={() => setTableOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <span>Monthly Breakdown Detail</span>
              {tableOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {tableOpen && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Month</TableHead>
                      <TableHead className="text-right text-emerald-700 bg-emerald-50 whitespace-nowrap">Inflow</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => setShowExpDetail(v => !v)}>
                        <span className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          {showExpDetail ? '◀' : '▶'} <span className="text-xs">Expense Detail</span>
                        </span>
                      </TableHead>
                      {showExpDetail && <>
                        <TableHead className="text-right text-red-700 bg-amber-50 whitespace-nowrap">Payables</TableHead>
                        <TableHead className="text-right text-orange-600 bg-amber-50 whitespace-nowrap">Salary</TableHead>
                        <TableHead className="text-right text-purple-600 bg-amber-50 whitespace-nowrap">Rent/Util</TableHead>
                        <TableHead className="text-right text-blue-600 bg-amber-50 whitespace-nowrap">Travel</TableHead>
                        <TableHead className="text-right text-pink-600 bg-amber-50 whitespace-nowrap">Mktg</TableHead>
                        <TableHead className="text-right text-teal-600 bg-amber-50 whitespace-nowrap">Software</TableHead>
                        <TableHead className="text-right text-slate-600 bg-amber-50 whitespace-nowrap">Other</TableHead>
                      </>}
                      <TableHead className="text-right font-bold">Total Out</TableHead>
                      <TableHead className="text-right font-bold text-indigo-700 bg-indigo-50">Net</TableHead>
                      <TableHead className="text-right font-bold">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((m, i) => (
                      <TableRow key={i} className={`${m.simNet < 0 ? 'bg-red-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-muted/20'} ${m.isCurrentMonth ? 'ring-1 ring-inset ring-indigo-300' : ''}`}>
                        <TableCell className="font-medium text-xs whitespace-nowrap">
                          {m.label}{m.isCurrentMonth && <span className="ml-1 text-indigo-500">•</span>}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium text-xs bg-emerald-50/40">
                          ₹{Math.round(m.simInflow || 0).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground cursor-pointer" onClick={() => setShowExpDetail(v => !v)}>
                          {showExpDetail ? '▲' : '▼'}
                        </TableCell>
                        {showExpDetail && <>
                          <TableCell className="text-right text-red-600 text-xs bg-amber-50/40">₹{Math.round(m.payablesOut || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-orange-600 text-xs bg-amber-50/40">₹{Math.round(m['Salary'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-purple-600 text-xs bg-amber-50/40">₹{Math.round(m['Rent/Utilities'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-blue-600 text-xs bg-amber-50/40">₹{Math.round(m['Travel'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-pink-600 text-xs bg-amber-50/40">₹{Math.round(m['Marketing'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-teal-600 text-xs bg-amber-50/40">₹{Math.round(m['Software'] || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-slate-600 text-xs bg-amber-50/40">₹{Math.round(m['Office & Other'] || 0).toLocaleString('en-IN')}</TableCell>
                        </>}
                        <TableCell className="text-right text-red-700 font-semibold text-xs">₹{Math.round(m.simOutflow || 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className={`text-right font-bold text-xs bg-indigo-50 ${(m.simNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {(m.simNet || 0) >= 0 ? '▲' : '▼'} ₹{Math.abs(Math.round(m.simNet || 0)).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className={`text-right font-bold text-xs ${(m.simClosing || 0) >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                          ₹{Math.abs(Math.round(m.simClosing || 0)).toLocaleString('en-IN')}
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