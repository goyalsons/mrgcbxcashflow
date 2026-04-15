import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Search, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { buildSourceFlows } from '@/components/simulator/SimSectionD';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(1)}Cr`;
  if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`;
  if (abs >= 1000)     return `₹${(abs/1000).toFixed(0)}K`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const toDateStr = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};

function getTodayNormalized() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

// Returns which month index (0-5) a date falls into, relative to current month
function dateToMonthIndex(dateStr, today) {
  if (!dateStr || !today) return 0;
  const d = new Date(dateStr);
  d.setHours(12, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const diff = (d.getFullYear() - thisMonth.getFullYear()) * 12 + (d.getMonth() - thisMonth.getMonth());
  if (diff < 0) return 0;
  if (diff > 5) return 5;
  return diff;
}

// Returns first day of the nth month from today
function monthStartStr(idx, today) {
  const d = new Date(today.getFullYear(), today.getMonth() + idx, 1);
  return toDateStr(d);
}

const CARD_STYLES = {
  receivable: { border: 'border-l-emerald-500', movedBg: 'bg-emerald-100 border-emerald-400', typeLabelCls: 'bg-emerald-100 text-emerald-700', typeLabel: 'REC' },
  payable:    { border: 'border-l-red-500',     movedBg: 'bg-red-100 border-red-400',         typeLabelCls: 'bg-red-100 text-red-700',         typeLabel: 'PAY' },
  expense:    { border: 'border-l-orange-500',  movedBg: 'bg-orange-100 border-orange-400',   typeLabelCls: 'bg-orange-100 text-orange-700',   typeLabel: 'EXP' },
  hypo_in:    { border: 'border-l-blue-500',    movedBg: 'bg-blue-50 border-blue-300',        typeLabelCls: 'bg-blue-100 text-blue-700',       typeLabel: 'HYP↑' },
  hypo_out:   { border: 'border-l-purple-500',  movedBg: 'bg-purple-50 border-purple-300',    typeLabelCls: 'bg-purple-100 text-purple-700',   typeLabel: 'HYP↓' },
  funding:    { border: 'border-l-teal-500',    movedBg: 'bg-teal-50 border-teal-300',        typeLabelCls: 'bg-teal-100 text-teal-700',       typeLabel: 'FUND' },
};

function SectionSep({ label, color }) {
  return (
    <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${color} px-0.5 mt-1`}>
      <div className="flex-1 h-px bg-current opacity-30" />
      <span className="shrink-0">{label}</span>
      <div className="flex-1 h-px bg-current opacity-30" />
    </div>
  );
}

function DraggableCard({ draggableId, index, item, cardType, moved, nameField, subField, amtFn }) {
  const style = CARD_STYLES[cardType] || CARD_STYLES.hypo_in;
  return (
    <Draggable draggableId={draggableId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`border border-l-4 rounded text-xs p-1.5 flex items-start gap-1 select-none transition-colors
            ${moved ? style.movedBg : `${style.border} bg-card hover:bg-muted/30`}
            ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/50 opacity-95 z-50' : ''}`}
          style={{ ...provided.draggableProps.style, minHeight: 42 }}
        >
          <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 mt-0.5 touch-none">
            <GripVertical className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-[11px] leading-tight">{nameField(item)}</p>
            <p className="text-[9px] text-muted-foreground truncate">{subField(item)}</p>
            {moved && <p className="text-[9px] font-semibold text-primary/80 mt-0.5">↔ Rescheduled</p>}
          </div>
          <p className="font-bold text-[11px] shrink-0 mt-0.5">{INR(amtFn(item))}</p>
        </div>
      )}
    </Draggable>
  );
}

function ConfirmResetDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-card border rounded-lg shadow-xl p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-sm">Reset Simulation?</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">This will clear all adjustments. Cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="h-8 px-3 text-xs rounded-md border border-input bg-background hover:bg-muted font-medium">Cancel</button>
          <button onClick={onConfirm} className="h-8 px-3 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium">Reset All</button>
        </div>
      </div>
    </div>
  );
}

export default function MonthlyTimelineBoard({
  receivables, invoices, payables, expenses,
  hypotheticals = [], fundingSources = [],
  setHypotheticals, setFundingSources,
  recAdj, setRecAdj, payAdj, setPayAdj,
  monthlyData, history, setHistory, onReset, onUndo, onRedo,
}) {
  const [search, setSearch] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [assignments, setAssignments] = useState(() => new Map());
  const [minAmount, setMinAmount] = useState(() => {
    const saved = localStorage.getItem('monthlyTimelineMinAmount');
    return saved ? Number(saved) : 0;
  });
  const [minAmountInput, setMinAmountInput] = useState(() => {
    const saved = localStorage.getItem('monthlyTimelineMinAmount');
    return saved ? Number(saved) : 0;
  });

  // Memoize today as noon UTC to ensure consistent month calculations
  const today = useMemo(() => getTodayNormalized(), []);

  useEffect(() => {
    localStorage.setItem('monthlyTimelineMinAmount', String(minAmount));
  }, [minAmount]);

  const allRec = useMemo(() =>
    [...receivables, ...invoices].filter(r => 
      ['pending','overdue','partially_paid','partial'].includes(r.status) &&
      (r.amount || 0) - (r.amount_received || r.amount_paid || 0) >= minAmount
    ),
    [receivables, invoices, minAmount, today]
  );
  const allPay = useMemo(() =>
    payables.filter(p => 
      ['pending','partially_paid','overdue'].includes(p.status) &&
      (p.amount || 0) - (p.amount_paid || 0) >= minAmount
    ),
    [payables, minAmount, today]
  );

  // Sync assignments from current adj state
  useEffect(() => {
    setAssignments(prev => {
      const m = new Map(prev);
      allRec.forEach(r => {
        const adjDate = recAdj.get(r.id)?.tranches?.[0]?.date;
        m.set(`rec-${r.id}`, dateToMonthIndex(adjDate || r.due_date, today));
      });
      allPay.forEach(p => {
        const adjDate = payAdj.get(p.id)?.tranches?.[0]?.date;
        m.set(`pay-${p.id}`, dateToMonthIndex(adjDate || p.due_date, today));
      });
      hypotheticals.forEach(h => m.set(`hypo-${h.id}`, dateToMonthIndex(h.tranches?.[0]?.date, today)));
      fundingSources.forEach(f => m.set(`fund-${f.id}`, dateToMonthIndex(f.date || f.drawDate || f.disburseDate, today)));
      return m;
    });
  }, [allRec, allPay, recAdj, payAdj, hypotheticals, fundingSources, today]);

  const matchSearch = (name) => !search || (name || '').toLowerCase().includes(search.toLowerCase());

  const monthItems = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      recs:    allRec.filter(r  => assignments.get(`rec-${r.id}`) === i && matchSearch(r.customer_name || r.debtor_name)),
      pays:    allPay.filter(p  => assignments.get(`pay-${p.id}`) === i && matchSearch(p.vendor_name)),
      hypos:   hypotheticals.filter(h => assignments.get(`hypo-${h.id}`) === i && matchSearch(h.label)),
      funding: fundingSources.filter(f => assignments.get(`fund-${f.id}`) === i && matchSearch(f.lender || f.bank || f.customer || f.asset || 'Funding')),
    })),
    [allRec, allPay, hypotheticals, fundingSources, assignments, search]
  );

  const onDragEnd = useCallback(({ source, destination, draggableId }) => {
    if (!destination) return;
    const srcIdx = parseInt(source.droppableId.replace('month-', ''));
    const dstIdx = parseInt(destination.droppableId.replace('month-', ''));
    if (srcIdx === dstIdx) return;

    const isRec  = draggableId.startsWith('rec-');
    const isPay  = draggableId.startsWith('pay-');
    const isHypo = draggableId.startsWith('hypo-');
    const isFund = draggableId.startsWith('fund-');
    const itemId = draggableId.replace(/^(rec|pay|hypo|fund)-/, '');
    const newDate = monthStartStr(dstIdx, today);

    setAssignments(prev => { const m = new Map(prev); m.set(draggableId, dstIdx); return m; });
    const prevRecAdj = new Map(recAdj);
    const prevPayAdj = new Map(payAdj);

    if (isHypo) {
      setHypotheticals(prev => prev.map(h => h.id !== itemId ? h : { ...h, tranches: h.tranches.map(t => ({ ...t, date: newDate })) }));
      toast({ title: `Moved to ${MONTH_NAMES[new Date(newDate).getMonth()]}`, duration: 2000 });
      setHistory({ prevRecAdj, prevPayAdj, prevHypo: hypotheticals, prevFunding: fundingSources });
      return;
    }
    if (isFund) {
      setFundingSources(prev => prev.map(f => f.id !== itemId ? f : { ...f, date: newDate, drawDate: newDate, disburseDate: newDate }));
      toast({ title: `Moved to ${MONTH_NAMES[new Date(newDate).getMonth()]}`, duration: 2000 });
      setHistory({ prevRecAdj, prevPayAdj, prevHypo: hypotheticals, prevFunding: fundingSources });
      return;
    }

    const item = isRec ? allRec.find(r => r.id === itemId) : allPay.find(p => p.id === itemId);
    if (!item) return;

    if (isRec) {
      const amt = (item.amount || 0) - (item.amount_received || item.amount_paid || 0);
      const next = new Map(recAdj);
      next.set(itemId, { tranches: [{ amount: amt, date: newDate }], remainder: 0 });
      setRecAdj(next);
    } else if (isPay) {
      const amt = (item.amount || 0) - (item.amount_paid || 0);
      const next = new Map(payAdj);
      next.set(itemId, { tranches: [{ amount: amt, date: newDate }], remainder: 0 });
      setPayAdj(next);
    }

    const name = isRec ? (item.customer_name || item.debtor_name) : item.vendor_name;
    toast({ title: `Moved "${name}" → ${MONTH_NAMES[new Date(newDate).getMonth()]}`, duration: 2000 });
    setHistory({ prevRecAdj, prevPayAdj, prevHypo: hypotheticals, prevFunding: fundingSources });
  }, [allRec, allPay, hypotheticals, fundingSources, recAdj, payAdj, setRecAdj, setPayAdj, setHypotheticals, setFundingSources, setHistory]);

  const handleReset = useCallback(() => {
    setShowResetConfirm(false);
    setAssignments(new Map());
    if (onReset) onReset();
  }, [onReset]);

  return (
    <>
      {showResetConfirm && <ConfirmResetDialog onConfirm={handleReset} onCancel={() => setShowResetConfirm(false)} />}

      <div className="border rounded-lg overflow-hidden bg-background flex flex-col" style={{ minHeight: 500 }}>
        {/* Toolbar */}
        <div className="border-b bg-card px-3 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              className="h-7 pl-6 pr-2 text-xs rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring w-36"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-input bg-background hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors font-medium"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          {history && history.length > 0 && (
            <button onClick={onUndo} className="flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-input bg-background hover:bg-muted font-medium">↩ Undo</button>
          )}
          {onRedo && (
            <button onClick={onRedo} className="flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-input bg-background hover:bg-muted font-medium">↪ Redo</button>
          )}
          <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input bg-background">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Min ₹</span>
            <input
              type="number"
              className="w-16 px-1 text-xs rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
              value={minAmountInput}
              min={0}
              onChange={e => setMinAmountInput(Number(e.target.value) || 0)}
              onBlur={() => setMinAmount(minAmountInput)}
              onKeyDown={e => e.key === 'Enter' && setMinAmount(minAmountInput)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Minimap */}
        <div className="flex border-b h-4 shrink-0">
          {monthlyData.map((m, i) => (
            <div
              key={i}
              title={`${m.label}: ${INR(m.simNet)}`}
              className="flex-1"
              style={{ backgroundColor: (m.simNet || 0) > 0 ? '#10b981' : (m.simNet || 0) < 0 ? '#ef4444' : '#f59e0b', opacity: 0.65 }}
            />
          ))}
        </div>

        {/* Month columns */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 overflow-x-auto">
            {Array.from({ length: 6 }, (_, i) => {
              const m = monthlyData[i] || { simNet: 0, baseNet: 0 };
              const isNeg = (m.simClosing || 0) < 0;
              const isPos = (m.simNet || 0) > 0;
              const headerCls = isNeg ? 'bg-red-50 border-red-200' : isPos ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200';
              const dotCls    = isNeg ? 'bg-red-500' : isPos ? 'bg-emerald-500' : 'bg-amber-500';
              const { recs, pays, hypos, funding } = monthItems[i];
              let dragIdx = 0;
              return (
                <Droppable key={i} droppableId={`month-${i}`} type="CARD">
                  {(provided, snapshot) => (
                    <div
                      className={`border-r flex flex-col shrink-0 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/70' : ''}`}
                      style={{ minWidth: 200, flex: 1 }}
                    >
                      {/* Column header */}
                      <div className={`px-2 pt-2 pb-2 border-b ${headerCls} shrink-0`}>
                        <div className="flex items-center gap-1 mb-1.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                          <span className="text-xs font-bold">{m.label}</span>
                          {m.isCurrentMonth && <span className="text-[9px] text-indigo-500 font-semibold">← Now</span>}
                        </div>
                        <p className="text-[8px] text-muted-foreground uppercase font-bold mb-0.5">Closing Balance</p>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className={`text-[10px] font-semibold ${(m.baseClosing || 0) >= 0 ? 'text-slate-600' : 'text-red-600'}`}>{INR(m.baseClosing || 0)}</span>
                          <span className="text-[8px] text-muted-foreground mx-0.5">|</span>
                          <span className={`text-[10px] font-bold ${(m.simClosing || 0) >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{INR(m.simClosing || 0)}</span>
                        </div>
                        <p className="text-[8px] text-muted-foreground uppercase font-bold mb-0.5">Monthly Net</p>
                        <div className="flex justify-between items-baseline">
                          <span className={`text-[10px] font-semibold ${(m.baseNet || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {(m.baseNet || 0) >= 0 ? '+' : ''}{INR(m.baseNet || 0)}
                          </span>
                          <span className="text-[8px] text-muted-foreground mx-0.5">|</span>
                          <span className={`text-[10px] font-bold ${(m.simNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {(m.simNet || 0) >= 0 ? '+' : ''}{INR(m.simNet || 0)}
                          </span>
                        </div>
                      </div>

                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto p-1 space-y-0.5"
                        style={{ minHeight: 80 }}
                      >
                        {recs.length > 0 && (
                          <>
                            <SectionSep label="Receivables" color="text-emerald-600" />
                            {recs.map(item => (
                              <DraggableCard
                                key={`rec-${item.id}`}
                                draggableId={`rec-${item.id}`}
                                index={dragIdx++}
                                item={item}
                                cardType="receivable"
                                moved={recAdj.has(item.id)}
                                nameField={r => r.customer_name || r.debtor_name || '—'}
                                subField={r => r.invoice_number || '—'}
                                amtFn={r => (r.amount || 0) - (r.amount_received || r.amount_paid || 0)}
                              />
                            ))}
                          </>
                        )}
                        {pays.length > 0 && (
                          <>
                            <SectionSep label="Payables" color="text-red-600" />
                            {pays.map(item => (
                              <DraggableCard
                                key={`pay-${item.id}`}
                                draggableId={`pay-${item.id}`}
                                index={dragIdx++}
                                item={item}
                                cardType="payable"
                                moved={payAdj.has(item.id)}
                                nameField={p => p.vendor_name || '—'}
                                subField={p => p.bill_number || '—'}
                                amtFn={p => (p.amount || 0) - (p.amount_paid || 0)}
                              />
                            ))}
                          </>
                        )}
                        {provided.placeholder}
                        {hypos.length > 0 && (
                          <>
                            <SectionSep label="Hypothetical" color="text-blue-600" />
                            {hypos.map(h => (
                              <DraggableCard
                                key={`hypo-${h.id}`}
                                draggableId={`hypo-${h.id}`}
                                index={dragIdx++}
                                item={h}
                                cardType={h.type === 'inflow' ? 'hypo_in' : 'hypo_out'}
                                moved={false}
                                nameField={h => h.label || '—'}
                                subField={h => h.type === 'inflow' ? 'Hypo inflow' : 'Hypo outflow'}
                                amtFn={h => h.tranches?.reduce((s, t) => s + Number(t.amount || 0), 0) || 0}
                              />
                            ))}
                          </>
                        )}
                        {funding.length > 0 && (
                          <>
                            <SectionSep label="Funding" color="text-teal-600" />
                            {funding.map(f => (
                              <DraggableCard
                                key={`fund-${f.id}`}
                                draggableId={`fund-${f.id}`}
                                index={dragIdx++}
                                item={f}
                                cardType="funding"
                                moved={false}
                                nameField={f => f.lender || f.bank || f.customer || f.asset || 'Funding'}
                                subField={f => f.type || 'Funding'}
                                amtFn={f => Number(f.amount || f.drawAmt || 0)}
                              />
                            ))}
                          </>
                        )}
                        {recs.length === 0 && pays.length === 0 && hypos.length === 0 && funding.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center text-[10px] text-muted-foreground border border-dashed rounded mx-1 my-2 py-4">Drop here</div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </>
  );
}