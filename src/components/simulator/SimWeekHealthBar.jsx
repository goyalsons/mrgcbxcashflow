import React, { useState } from 'react';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(abs/100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(abs/1000).toFixed(0)}K`;
  return `₹${Math.round(abs)}`;
};

function getColor(simNet, baseNet) {
  const ratio = baseNet !== 0 ? simNet / Math.abs(baseNet) : 0;
  if (simNet > 0) return { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-700' };
  if (simNet < 0 && Math.abs(simNet) < Math.abs(baseNet || simNet) * 0.1) return { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' };
  if (simNet < 0) return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' };
  return { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' };
}

function WeekPopover({ w, weekIndex, onClose }) {
  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-52 bg-card border border-border rounded-lg shadow-xl p-3 text-xs"
      style={{ pointerEvents: 'auto' }}>
      <p className="font-semibold text-sm mb-2">W{weekIndex + 1} Details</p>
      <div className="space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Base In</span><span className="font-medium text-emerald-600">{INR(w.baseInflow)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Sim In</span><span className="font-medium text-emerald-700">{INR(w.simInflow)}</span></div>
        <div className="border-t my-1" />
        <div className="flex justify-between"><span className="text-muted-foreground">Base Out</span><span className="font-medium text-red-600">{INR(w.baseOutflow)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Sim Out</span><span className="font-medium text-red-700">{INR(w.simOutflow)}</span></div>
        <div className="border-t my-1" />
        <div className="flex justify-between font-bold">
          <span>Base Net</span>
          <span className={w.baseNet >= 0 ? 'text-emerald-700' : 'text-red-700'}>{INR(w.baseNet)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Sim Net</span>
          <span className={w.simNet >= 0 ? 'text-emerald-700' : 'text-red-700'}>{INR(w.simNet)}</span>
        </div>
        {w.simNet !== w.baseNet && (
          <div className="flex justify-between text-primary font-semibold">
            <span>Δ</span>
            <span>{w.simNet - w.baseNet >= 0 ? '+' : ''}{INR(w.simNet - w.baseNet)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SimWeekHealthBar({ weeklyData, onScrollToWeek }) {
  const [hoveredWeek, setHoveredWeek] = useState(null);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-sm shadow-lg" style={{ height: 56 }}>
      <div className="flex h-full items-stretch px-2 gap-1">
        {weeklyData.map((w, i) => {
          const { bg, text, border } = getColor(w.simNet, w.baseNet);
          const delta = w.simNet - w.baseNet;
          return (
            <div
              key={i}
              className="relative flex-1 flex flex-col items-center justify-center cursor-pointer"
              onMouseEnter={() => setHoveredWeek(i)}
              onMouseLeave={() => setHoveredWeek(null)}
              onClick={() => onScrollToWeek?.(i)}
            >
              {hoveredWeek === i && <WeekPopover w={w} weekIndex={i} onClose={() => setHoveredWeek(null)} />}
              <div className={`w-full flex flex-col items-center justify-center rounded px-0.5 py-1 ${bg} ${text} ${border} border`} style={{ height: 44 }}>
                <span className="text-[10px] font-bold leading-none">W{i + 1}</span>
                <span className="text-[9px] leading-none mt-0.5 opacity-90 hidden sm:block">
                  {w.simNet >= 0 ? '' : '-'}{INR(Math.abs(w.simNet))}
                </span>
                {delta !== 0 && (
                  <span className="text-[8px] leading-none opacity-75 hidden md:block">
                    {delta > 0 ? '▲' : '▼'}{INR(Math.abs(delta))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}