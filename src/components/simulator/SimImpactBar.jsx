import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${abs.toLocaleString('en-IN')}`;
};

export default function SimImpactBar({ baseNet, simNet, improvement, onReset }) {
  const improved = improvement > 0;
  const worsened = improvement < 0;
  const impColor = improved ? 'text-emerald-600' : worsened ? 'text-red-600' : 'text-muted-foreground';
  const impIcon  = improved ? <TrendingUp className="w-3.5 h-3.5" /> : worsened ? <TrendingDown className="w-3.5 h-3.5" /> : null;

  return (
    <div className="sticky top-0 z-20 bg-card border border-border rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Baseline Net 12W:</span>
        <span className="text-sm font-bold text-foreground">{INR(baseNet)}</span>
      </div>
      <div className="w-px h-5 bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Simulated Net 12W:</span>
        <span className="text-sm font-bold text-primary">{INR(simNet)}</span>
      </div>
      <div className="w-px h-5 bg-border" />
      <div className={`flex items-center gap-1 ${impColor}`}>
        {impIcon}
        <span className="text-sm font-bold">
          {improvement === 0 ? '— No change' : `${improved ? '▲' : '▼'} ${INR(improvement)}`}
        </span>
        {improvement !== 0 && <span className="text-xs">improvement</span>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onReset}>
          <RotateCcw className="w-3 h-3" />Reset All
        </Button>
      </div>
    </div>
  );
}