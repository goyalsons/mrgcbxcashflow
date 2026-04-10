import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SimChart from './SimChart';

const INR_FMT = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(1)}Cr`;
  if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

function Sparkline({ weeklyData }) {
  const nets = weeklyData.map(w => w.simNet);
  if (!nets.length) return null;
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  const range = max - min || 1;
  const W = 360, H = 32;
  const pts = nets.map((n, i) => {
    const x = (i / (nets.length - 1)) * W;
    const y = H - ((n - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  const baseNets = weeklyData.map(w => w.baseNet);
  const bPts = baseNets.map((n, i) => {
    const x = (i / (baseNets.length - 1)) * W;
    const y = H - ((n - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={bPts} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,2" />
      <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" />
    </svg>
  );
}

export default function SimZone1Chart({ weeklyData, hasAdjustments, bankAccounts = [] }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-b bg-card transition-all duration-300">
      {collapsed ? (
        <div className="flex items-center gap-4 px-4 h-12">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Net Cash Flow</span>
          <div className="flex-1 flex justify-center min-w-0">
            <Sparkline weeklyData={weeklyData} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {weeklyData.map((w, i) => (
              <div
                key={i}
                title={`W${i+1}: ${INR_FMT(w.simNet)}`}
                className={`w-3 h-3 rounded-full flex-shrink-0 ${w.simNet > 0 ? 'bg-emerald-500' : w.simNet < -Math.abs(w.simNet) * 0.1 ? 'bg-red-500' : 'bg-amber-500'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0 px-2 py-1 rounded hover:bg-muted"
          >
            <ChevronDown className="w-4 h-4" /> Expand
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setCollapsed(true)}
            className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
          >
            <ChevronUp className="w-4 h-4" /> Collapse
          </button>
          <SimChart weeklyData={weeklyData} hasAdjustments={hasAdjustments} bankAccounts={bankAccounts} />
        </div>
      )}
    </div>
  );
}