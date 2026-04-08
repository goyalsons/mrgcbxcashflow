import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pencil } from 'lucide-react';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${abs.toLocaleString('en-IN')}`;
};

export default function SimTable({ weeklyData, bankAccounts }) {
  const openingBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const totals = weeklyData.reduce((acc, w) => ({
    baseInflow: acc.baseInflow + w.baseInflow,
    simInflow:  acc.simInflow  + w.simInflow,
    baseOutflow: acc.baseOutflow + w.baseOutflow,
    simOutflow:  acc.simOutflow  + w.simOutflow,
    baseNet:  acc.baseNet  + w.baseNet,
    simNet:   acc.simNet   + w.simNet,
    delta:    acc.delta    + (w.simNet - w.baseNet),
  }), { baseInflow: 0, simInflow: 0, baseOutflow: 0, simOutflow: 0, baseNet: 0, simNet: 0, delta: 0 });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Weekly Comparison</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Week</TableHead>
                <TableHead className="text-right text-emerald-700 text-xs">Base In</TableHead>
                <TableHead className="text-right text-emerald-600 text-xs">Sim In</TableHead>
                <TableHead className="text-right text-red-700 text-xs">Base Out</TableHead>
                <TableHead className="text-right text-red-600 text-xs">Sim Out</TableHead>
                <TableHead className="text-right text-blue-700 text-xs font-bold">Base Net</TableHead>
                <TableHead className="text-right text-indigo-700 text-xs font-bold">Sim Net</TableHead>
                <TableHead className="text-right text-xs">Δ Change</TableHead>
                <TableHead className="text-right text-xs">Sim Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TooltipProvider>
                {weeklyData.map((w, i) => {
                  const delta = w.simNet - w.baseNet;
                  const hasAdj = w.simItems.length > 0;
                  const deltaCls = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground';
                  const hasHypo = w.simItems.some(s => s.hypo);
                  return (
                    <TableRow key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}
                      className={w.isCurrentWeek ? 'ring-1 ring-inset ring-indigo-200' : ''}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          {w.label}
                          {w.isCurrentWeek && <span className="text-indigo-400">•</span>}
                          {hasAdj && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Pencil className="w-3 h-3 text-amber-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs max-w-xs">
                                {w.simItems.map((s, j) => (
                                  <p key={j}>{s.split ? '⑂ ' : ''}{s.label} {s.type === 'inflow' ? '↑' : '↓'} {INR(s.amount)}{s.hypo ? ' (sim)' : ''}</p>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 text-xs">{INR(w.baseInflow)}</TableCell>
                      <TableCell className="text-right text-emerald-600 text-xs">
                        {w.simItems.some(s => s.type === 'inflow' && s.split) ? <span title="contains split">⑂ </span> : ''}
                        <span className={hasHypo && w.simItems.some(s => s.hypo && s.type === 'inflow') ? 'italic' : ''}>{INR(w.simInflow)}</span>
                      </TableCell>
                      <TableCell className="text-right text-red-700 text-xs">{INR(w.baseOutflow)}</TableCell>
                      <TableCell className="text-right text-red-600 text-xs">
                        {w.simItems.some(s => s.type === 'outflow' && s.split) ? <span title="contains split">⑂ </span> : ''}
                        {INR(w.simOutflow)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold text-xs ${w.baseNet >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{INR(w.baseNet)}</TableCell>
                      <TableCell className={`text-right font-semibold text-xs ${w.simNet >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{INR(w.simNet)}</TableCell>
                      <TableCell className={`text-right font-bold text-xs ${deltaCls}`}>
                        {delta === 0 ? '—' : `${delta > 0 ? '▲' : '▼'} ${INR(Math.abs(delta))}`}
                      </TableCell>
                      <TableCell className={`text-right font-bold text-xs ${w.simClosing >= 0 ? 'text-foreground' : 'text-red-600'}`}>{INR(w.simClosing)}</TableCell>
                    </TableRow>
                  );
                })}
              </TooltipProvider>
            </TableBody>
            <tfoot>
              <tr className="border-t bg-secondary font-semibold text-xs">
                <td className="p-2 pl-4">Totals</td>
                <td className="p-2 text-right text-emerald-700">{INR(totals.baseInflow)}</td>
                <td className="p-2 text-right text-emerald-600">{INR(totals.simInflow)}</td>
                <td className="p-2 text-right text-red-700">{INR(totals.baseOutflow)}</td>
                <td className="p-2 text-right text-red-600">{INR(totals.simOutflow)}</td>
                <td className={`p-2 text-right font-bold ${totals.baseNet >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{INR(totals.baseNet)}</td>
                <td className={`p-2 text-right font-bold ${totals.simNet >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{INR(totals.simNet)}</td>
                <td className={`p-2 text-right font-bold ${totals.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{totals.delta === 0 ? '—' : `${totals.delta > 0 ? '▲' : '▼'} ${INR(Math.abs(totals.delta))}`}</td>
                <td className="p-2" />
              </tr>
            </tfoot>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}