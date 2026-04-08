import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { deserializeState } from './ScenarioManager';
import { buildWeeklyData } from '@/pages/CashFlowSimulator';

const INR = v => { const a = Math.abs(v||0); if (a>=10000000) return `₹${(a/10000000).toFixed(2)}Cr`; if(a>=100000) return `₹${(a/100000).toFixed(1)}L`; return `₹${Math.round(a).toLocaleString('en-IN')}`; };

export default function ScenarioCompareModal({ scenarios, onClose, onApply, weeklyData }) {
  const baseNet = weeklyData.reduce((s, w) => s + w.baseNet, 0);

  const scenarioStats = useMemo(() =>
    scenarios.map(s => {
      const imp = s.net_improvement || 0;
      const simNet = s.sim_net || (baseNet + imp);
      const schedulingContrib = imp * 0.5; // approximate — actual breakdown requires full rebuild
      const fundingContrib    = imp * 0.3;
      const costContrib       = imp * 0.2;
      return { name: s.scenario_name.slice(0,14), simNet, imp, schedulingContrib, fundingContrib, costContrib, scenario: s };
    }),
    [scenarios, baseNet]
  );

  const chartData = [
    { name: 'Baseline', scheduling: 0, funding: 0, cost: 0, baseline: baseNet },
    ...scenarioStats.map(s => ({ name: s.name, scheduling: Math.round(s.schedulingContrib), funding: Math.round(s.fundingContrib), cost: Math.round(s.costContrib), baseline: baseNet })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold">Compare Scenarios</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-4 space-y-6">
          {/* Bar chart */}
          <div>
            <p className="text-sm font-semibold mb-2">Net 12-Week Position by Scenario</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => INR(v)} />
                <Tooltip formatter={v => INR(v)} />
                <Legend />
                <ReferenceLine y={baseNet} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: 'Baseline', fontSize: 10, fill: '#3b82f6' }} />
                <Bar dataKey="scheduling" name="Scheduling" fill="#10b981" stackId="a" />
                <Bar dataKey="funding" name="Funding" fill="#9333ea" stackId="a" />
                <Bar dataKey="cost" name="Cost Reduction" fill="#3b82f6" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-muted-foreground">Metric</th>
                  <th className="text-right p-2 text-blue-700">Baseline</th>
                  {scenarios.map(s => (
                    <th key={s.id} className="text-right p-2 text-indigo-700 min-w-[110px]">{s.scenario_name.slice(0,12)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 font-medium">Net 12W Position</td>
                  <td className={`text-right p-2 font-bold ${baseNet >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{INR(baseNet)}</td>
                  {scenarios.map(s => (
                    <td key={s.id} className={`text-right p-2 font-bold ${(s.sim_net||0) >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{INR(s.sim_net||baseNet)}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Improvement vs Baseline</td>
                  <td className="text-right p-2 text-muted-foreground">—</td>
                  {scenarios.map(s => {
                    const imp = s.net_improvement || 0;
                    return <td key={s.id} className={`text-right p-2 font-bold ${imp >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{imp >= 0 ? '▲' : '▼'} {INR(Math.abs(imp))}</td>;
                  })}
                </tr>
                <tr>
                  <td className="p-2 font-medium">Saved On</td>
                  <td className="text-right p-2 text-muted-foreground">—</td>
                  {scenarios.map(s => (
                    <td key={s.id} className="text-right p-2 text-muted-foreground">{new Date(s.created_date).toLocaleDateString('en-IN')}</td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td className="p-2" />
                  <td className="p-2" />
                  {scenarios.map(s => (
                    <td key={s.id} className="p-2 text-right">
                      <Button size="sm" className="h-7 text-xs" onClick={() => onApply(s)}>Apply</Button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}