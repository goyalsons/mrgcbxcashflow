import React from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 100000) return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};
const toDateStr = d => d ? new Date(d).toISOString().split('T')[0] : '';

export default function SimAdjustmentDrawer({
  open, onToggle,
  recAdj, setRecAdj, payAdj, setPayAdj,
  hypotheticals, setHypo,
  fundingSources, setFunding,
  levers, setLevers,
  taxItems, setTaxItems,
  receivables, payables,
  count,
}) {
  if (count === 0) return null;

  const removeRec = id => { const m = new Map(recAdj); m.delete(id); setRecAdj(m); };
  const removePay = id => { const m = new Map(payAdj); m.delete(id); setPayAdj(m); };
  const removeHypo = id => setHypo(p => p.filter(h => h.id !== id));
  const removeFunding = id => setFunding(p => p.filter(f => f.id !== id));
  const removeLever = id => setLevers(p => p.filter(l => l.id !== id));
  const removeTax = id => setTaxItems(p => p.filter(t => t.id !== id));

  // Net impact per group
  const schedRecImpact  = [...recAdj.values()].reduce((s, a) => s + a.tranches.reduce((x, t) => x + Number(t.amount||0), 0), 0);
  const schedPayImpact  = [...payAdj.values()].reduce((s, a) => s + a.tranches.reduce((x, t) => x + Number(t.amount||0), 0), 0);
  const fundingImpact   = fundingSources.reduce((s, f) => s + Number(f.amount||f.drawAmt||0), 0);
  const leverImpact     = levers.reduce((s, l) => s + (Number(l.amount||0)), 0);

  const Section = ({ title, color, items, onRemove, renderItem }) => items.length === 0 ? null : (
    <div className="p-3 space-y-1.5">
      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${color}`}>{title}</p>
      {items.map(item => (
        <div key={item[0] || item.id} className="flex items-start justify-between gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
          <p className="flex-1 truncate">{renderItem(item)}</p>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onRemove(item[0] || item.id)}><X className="w-3 h-3" /></Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors" onClick={onToggle}>
        <span className="text-sm font-semibold">Adjustments Made ({count})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="divide-y text-xs">
          {/* Scheduling */}
          {(recAdj.size > 0 || payAdj.size > 0 || hypotheticals.length > 0) && (
            <div className="p-3">
              <div className="flex justify-between mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Scheduling Changes</p>
                <span className="text-[10px] text-emerald-700 font-medium">+{INR(schedRecImpact)} inflow · -{INR(schedPayImpact)} outflow</span>
              </div>
              {[...recAdj.entries()].map(([id, adj]) => {
                const item = receivables.find(r => r.id === id);
                if (!item) return null;
                const origAmt = (item.amount||0)-(item.amount_received||item.amount_paid||0);
                return (
                  <div key={id} className="flex items-start justify-between gap-2 bg-muted/30 rounded px-2 py-1.5 mb-1">
                    <p className="flex-1 truncate">
                      {adj.tranches.length === 1 && adj.remainder === 0
                        ? `Invoice ${item.invoice_number||'—'} · ${item.customer_name||item.debtor_name} · ${INR(origAmt)} → ${adj.tranches[0].date}`
                        : `Invoice ${item.invoice_number||'—'} · ${item.customer_name||item.debtor_name} · split: ${adj.tranches.map(t=>`${INR(t.amount)} on ${t.date}`).join(' / ')}`}
                    </p>
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeRec(id)}><X className="w-3 h-3" /></Button>
                  </div>
                );
              })}
              {[...payAdj.entries()].map(([id, adj]) => {
                const item = payables.find(p => p.id === id);
                if (!item) return null;
                const origAmt = (item.amount||0)-(item.amount_paid||0);
                return (
                  <div key={id} className="flex items-start justify-between gap-2 bg-muted/30 rounded px-2 py-1.5 mb-1">
                    <p className="flex-1 truncate">Bill {item.bill_number||'—'} · {item.vendor_name} · {INR(origAmt)} → {adj.tranches[0]?.date}</p>
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removePay(id)}><X className="w-3 h-3" /></Button>
                  </div>
                );
              })}
              {hypotheticals.map(h => (
                <div key={h.id} className="flex items-start justify-between gap-2 bg-muted/30 rounded px-2 py-1.5 mb-1">
                  <p className="flex-1 truncate italic">{h.label} · {h.type} · {INR(h.amount)} <span className="text-blue-600">sim</span></p>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeHypo(h.id)}><X className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}

          {/* External Funding */}
          {fundingSources.length > 0 && (
            <div className="p-3">
              <div className="flex justify-between mb-2">
                <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">External Funding</p>
                <span className="text-[10px] text-purple-700 font-medium">+{INR(fundingImpact)} injected</span>
              </div>
              {fundingSources.map(f => (
                <div key={f.id} className="flex items-start justify-between gap-2 bg-muted/30 rounded px-2 py-1.5 mb-1">
                  <p className="flex-1 truncate">{f.type} · {INR(f.amount||f.drawAmt||0)}</p>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeFunding(f.id)}><X className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}

          {/* Cost Reductions */}
          {(levers.length > 0 || taxItems.length > 0) && (
            <div className="p-3">
              <p className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide mb-2">Cost Reductions &amp; Tax</p>
              {levers.map(l => (
                <div key={l.id} className="flex items-start justify-between gap-2 bg-muted/30 rounded px-2 py-1.5 mb-1">
                  <p className="flex-1 truncate">{l.type} · {l.deferPct ? `${l.deferPct}%` : l.amount ? INR(l.amount) : ''}</p>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeLever(l.id)}><X className="w-3 h-3" /></Button>
                </div>
              ))}
              {taxItems.map(t => (
                <div key={t.id} className="flex items-start justify-between gap-2 bg-muted/30 rounded px-2 py-1.5 mb-1">
                  <p className="flex-1 truncate">{t.type} · {INR(t.amount)}</p>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeTax(t.id)}><X className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}