import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Search, Filter } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(abs / 1000).toFixed(0)}K`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const today = new Date(); today.setHours(0, 0, 0, 0);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
const weekStart = (i) => addDays(today, i * 7);
const weekLabel = (i) => {
  const d = weekStart(i);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function dueDateToWeek(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - today) / 86400000);
  if (diff < 0) return 0;
  return Math.min(Math.floor(diff / 7), 11);
}

function getWeekColors(w) {
  if ((w.simNet || 0) > 0) return { dot: 'bg-emerald-500', text: 'text-emerald-700', header: 'bg-emerald-50 border-emerald-200' };
  if ((w.simNet || 0) < 0) return { dot: 'bg-red-500', text: 'text-red-700', header: 'bg-red-50 border-red-200' };
  return { dot: 'bg-amber-500', text: 'text-amber-700', header: 'bg-amber-50 border-amber-200' };
}

const CARD_STYLES = {
  receivable: { border: 'border-l-emerald-500', movedBg: 'bg-emerald-100 border-emerald-400' },
  payable:    { border: 'border-l-red-500',     movedBg: 'bg-red-100 border-red-400' },
  expense:    { border: 'border-l-orange-500',  movedBg: 'bg-orange-100 border-orange-400' },
  recurring:  { border: 'border-l-yellow-600',  movedBg: 'bg-yellow-100 border-yellow-500' },
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

function DraggableCard({ draggableId, index, item, cardType, isAdjusted, origWeek, curWeek, nameField, subField, amtFn }) {
  const style = CARD_STYLES[cardType];
  const moved = isAdjusted && origWeek !== curWeek;
  const overdue = item.due_date && new Date(item.due_date) < today;

  return (
    <Draggable draggableId={draggableId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`border border-l-4 rounded text-xs p-1.5 flex items-start gap-1 select-none transition-colors
            ${moved ? style.movedBg : `${style.border} bg-card hover:bg-muted/30`}
            ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/50 opacity-95 z-50' : ''}
          `}
          style={{ ...provided.draggableProps.style, minHeight: 42 }}
        >
          <div
            {...provided.dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 mt-0.5 touch-none"
          >
            <GripVertical className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-[11px] leading-tight">
              {nameField(item)}
              {overdue && cardType !== 'expense' && cardType !== 'recurring' &&
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" />}
            </p>
            <p className="text-[9px] text-muted-foreground truncate">{subField(item)}</p>
            {moved && (
              <p className="text-[9px] font-semibold text-primary/80 mt-0.5">
                Moved from W{origWeek + 1}
              </p>
            )}
          </div>
          <p className="font-bold text-[11px] shrink-0 mt-0.5">{INR(amtFn(item))}</p>
        </div>
      )}
    </Draggable>
  );
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'receivable', label: 'Recv' },
  { key: 'payable', label: 'Pay' },
  { key: 'expense', label: 'Exp' },
  { key: 'recurring', label: 'Rec' },
];

export default function SimTimelineBoard({
  receivables, invoices, payables, expenses, recurringExpenses,
  recAdj, setRecAdj, payAdj, setPayAdj,
  weeklyData, minAmount: minAmountProp, history, setHistory,
}) {
  const weekColumnRefs = useRef([]);

  // Local filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [minAmount, setMinAmount] = useState(minAmountProp || 0);
  const [minAmountInput, setMinAmountInput] = useState(minAmountProp || 0);

  useEffect(() => { setMinAmount(minAmountProp || 0); setMinAmountInput(minAmountProp || 0); }, [minAmountProp]);

  const allRec = useMemo(() =>
    [...receivables, ...invoices].filter(r =>
      ['pending', 'overdue', 'partially_paid', 'partial'].includes(r.status) &&
      (r.amount || 0) - (r.amount_received || r.amount_paid || 0) >= minAmount
    ),
    [receivables, invoices, minAmount]
  );

  const allPay = useMemo(() =>
    payables.filter(p =>
      ['pending', 'partially_paid', 'overdue'].includes(p.status) &&
      (p.amount || 0) - (p.amount_paid || 0) >= minAmount
    ),
    [payables, minAmount]
  );

  const allExp = useMemo(() =>
    (expenses || []).filter(e => (!e.recurrence_type || e.recurrence_type === 'none') && (e.amount || 0) >= minAmount),
    [expenses, minAmount]
  );

  const allRecur = useMemo(() =>
    (recurringExpenses || []).filter(e => (e.amount || 0) >= minAmount),
    [recurringExpenses, minAmount]
  );

  // Local assignments Map<draggableId, weekIndex>
  const [assignments, setAssignments] = useState(() => {
    const m = new Map();
    return m;
  });

  // Initialise / sync assignments when data loads
  useEffect(() => {
    setAssignments(prev => {
      const m = new Map(prev);
      allRec.forEach(r => {
        const key = `rec-${r.id}`;
        if (!m.has(key)) m.set(key, dueDateToWeek(recAdj.get(r.id)?.tranches?.[0]?.date || r.due_date));
      });
      allPay.forEach(p => {
        const key = `pay-${p.id}`;
        if (!m.has(key)) m.set(key, dueDateToWeek(payAdj.get(p.id)?.tranches?.[0]?.date || p.due_date));
      });
      allExp.forEach(e => {
        const key = `exp-${e.id}`;
        if (!m.has(key)) m.set(key, dueDateToWeek(e.expense_date));
      });
      allRecur.forEach(e => {
        const key = `recur-${e.id}`;
        if (!m.has(key)) m.set(key, dueDateToWeek(e.expense_date));
      });
      return m;
    });
  }, [allRec, allPay, allExp, allRecur]); // eslint-disable-line

  // Search filter helper
  const matchSearch = (name) => !search || (name || '').toLowerCase().includes(search.toLowerCase());

  // Build weekItems from assignments
  const weekItems = useMemo(() => {
    const show = typeFilter;
    return Array.from({ length: 12 }, (_, i) => ({
      recs:  (show === 'all' || show === 'receivable') ? allRec.filter(r => assignments.get(`rec-${r.id}`) === i && matchSearch(r.customer_name || r.debtor_name)) : [],
      pays:  (show === 'all' || show === 'payable')    ? allPay.filter(p => assignments.get(`pay-${p.id}`) === i && matchSearch(p.vendor_name)) : [],
      exps:  (show === 'all' || show === 'expense')    ? allExp.filter(e => assignments.get(`exp-${e.id}`) === i && matchSearch(e.description)) : [],
      recur: (show === 'all' || show === 'recurring')  ? allRecur.filter(e => assignments.get(`recur-${e.id}`) === i && matchSearch(e.description)) : [],
    }));
  }, [allRec, allPay, allExp, allRecur, assignments, typeFilter, search]);

  const onDragEnd = useCallback(({ source, destination, draggableId }) => {
    if (!destination) return;
    const srcWeek = parseInt(source.droppableId.replace('week-', ''));
    const dstWeek = parseInt(destination.droppableId.replace('week-', ''));
    if (srcWeek === dstWeek) return;

    const isRec   = draggableId.startsWith('rec-');
    const isPay   = draggableId.startsWith('pay-');
    const isExp   = draggableId.startsWith('exp-');
    const isRecur = draggableId.startsWith('recur-');
    const itemId  = draggableId.replace(/^(rec|pay|exp|recur)-/, '');

    const item = isRec ? allRec.find(r => r.id === itemId)
               : isPay ? allPay.find(p => p.id === itemId)
               : isExp ? allExp.find(e => e.id === itemId)
               : allRecur.find(e => e.id === itemId);
    if (!item) return;

    const prevRecAdj = new Map(recAdj);
    const prevPayAdj = new Map(payAdj);

    // Update local assignment immediately
    setAssignments(prev => { const m = new Map(prev); m.set(draggableId, dstWeek); return m; });

    const newDate = toDateStr(weekStart(dstWeek));

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
    // Expense moves are visual only (affect timeline display but not sim calc for now)

    const name = isRec ? (item.customer_name || item.debtor_name)
               : isPay ? item.vendor_name
               : item.description;
    toast({ title: `Moved "${name}" → W${dstWeek + 1}`, duration: 2000 });
    setHistory(h => [...h, { prevRecAdj, prevPayAdj }]);
  }, [allRec, allPay, allExp, allRecur, recAdj, payAdj, setRecAdj, setPayAdj, setHistory]);

  const scrollToWeek = useCallback((i) => {
    weekColumnRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  const totalBaseNet = weeklyData.reduce((s, w) => s + (w.baseNet || 0), 0);
  const totalSimNet  = weeklyData.reduce((s, w) => s + (w.simNet  || 0), 0);
  const improved = totalSimNet - totalBaseNet;

  return (
    <div className="border rounded-lg overflow-hidden bg-background flex flex-col" style={{ height: 'calc(100vh - 340px)', minHeight: 480 }}>

      {/* ── Board toolbar ── */}
      <div className="border-b bg-card px-3 py-2 flex flex-col gap-2 shrink-0">
        {/* Net summary row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Base 12W Net</span>
            <span className={`text-lg font-bold ${totalBaseNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {totalBaseNet < 0 ? '-' : ''}{INR(Math.abs(totalBaseNet))}
            </span>
          </div>
          <span className="text-muted-foreground text-sm">→</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Simulated</span>
            <span className={`text-xl font-extrabold ${totalSimNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {totalSimNet < 0 ? '-' : ''}{INR(Math.abs(totalSimNet))}
            </span>
          </div>
          {improved !== 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${improved > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {improved > 0 ? '+' : ''}{INR(improved)}
            </span>
          )}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              className="h-7 pl-6 pr-2 text-xs rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring w-40"
              placeholder="Search company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`h-7 px-2.5 text-xs rounded-md font-medium transition-colors border
                  ${typeFilter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-foreground hover:bg-muted'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Min amount */}
          <div className="flex items-center gap-1 ml-auto">
            <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">Min ₹</span>
            <input
              type="number"
              className="h-7 w-20 px-2 text-xs rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
              value={minAmountInput}
              min={0}
              onChange={e => setMinAmountInput(Number(e.target.value) || 0)}
              onBlur={() => setMinAmount(minAmountInput)}
              onKeyDown={e => e.key === 'Enter' && setMinAmount(minAmountInput)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* ── Minimap ── */}
      <div className="flex border-b h-4 shrink-0 cursor-pointer">
        {weeklyData.map((w, i) => (
          <div
            key={i}
            title={`W${i + 1}: ${INR(w.simNet)}`}
            onClick={() => scrollToWeek(i)}
            className="flex-1 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: (w.simNet || 0) > 0 ? '#10b981' : (w.simNet || 0) < 0 ? '#ef4444' : '#f59e0b', opacity: 0.6 }}
          />
        ))}
      </div>

      {/* ── Week columns ── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-1 overflow-x-auto overflow-y-hidden">
          {Array.from({ length: 12 }, (_, i) => {
            const w = weeklyData[i] || { simNet: 0, baseNet: 0 };
            const { dot, text, header } = getWeekColors(w);
            const { recs, pays, exps, recur } = weekItems[i];

            const totalRec  = recs.reduce((s, r)  => s + (r.amount || 0) - (r.amount_received || r.amount_paid || 0), 0);
            const totalPay  = pays.reduce((s, p)  => s + (p.amount || 0) - (p.amount_paid || 0), 0);
            const totalExp  = exps.reduce((s, e)  => s + (e.amount || 0), 0);
            const totalRec2 = recur.reduce((s, e) => s + (e.amount || 0), 0);

            const parts = [];
            if (totalRec  > 0) parts.push(<span key="r"  className="text-emerald-700">↑{INR(totalRec)}({recs.length})</span>);
            if (totalPay  > 0) parts.push(<span key="p"  className="text-red-700">↓{INR(totalPay)}({pays.length})</span>);
            if (totalExp  > 0) parts.push(<span key="e"  className="text-orange-600">E:{INR(totalExp)}({exps.length})</span>);
            if (totalRec2 > 0) parts.push(<span key="rc" className="text-yellow-700">R:{INR(totalRec2)}({recur.length})</span>);

            let draggableIndex = 0;

            return (
              <Droppable key={i} droppableId={`week-${i}`} type="CARD">
                {(provided, snapshot) => (
                  <div
                    ref={el => { weekColumnRefs.current[i] = el; }}
                    className={`border-r flex flex-col shrink-0 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/70' : ''}`}
                    style={{ width: 172 }}
                  >
                    {/* Column header */}
                    <div className={`px-2 pt-1.5 pb-1 border-b ${header} shrink-0`} style={{ minHeight: 82 }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="text-xs font-bold">W{i + 1}</span>
                        <span className="text-[9px] text-muted-foreground">{weekLabel(i)}</span>
                      </div>
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <p className={`text-base font-extrabold leading-tight ${text}`}>
                          {(w.simNet || 0) < 0 ? '-' : ''}{INR(Math.abs(w.simNet || 0))}
                        </p>
                        {w.baseNet !== w.simNet && (
                          <p className="text-[9px] text-muted-foreground line-through">
                            {(w.baseNet || 0) < 0 ? '-' : ''}{INR(Math.abs(w.baseNet || 0))}
                          </p>
                        )}
                      </div>
                      {parts.length > 0 && (
                        <div className="flex flex-wrap gap-x-1.5 text-[9px] leading-tight mt-0.5">
                          {parts}
                        </div>
                      )}
                    </div>

                    {/* Droppable content */}
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 overflow-y-auto p-1 space-y-0.5"
                      style={{ minHeight: 60 }}
                    >
                      {/* Receivables */}
                      {recs.length > 0 && (
                        <>
                          <SectionSep label="Receivables" color="text-emerald-600" />
                          {recs.map(item => {
                            const origWeek = dueDateToWeek(item.due_date);
                            const curWeek  = assignments.get(`rec-${item.id}`) ?? origWeek;
                            const idx = draggableIndex++;
                            return (
                              <DraggableCard
                                key={`rec-${item.id}`}
                                draggableId={`rec-${item.id}`}
                                index={idx}
                                item={item}
                                cardType="receivable"
                                isAdjusted={recAdj.has(item.id)}
                                origWeek={origWeek}
                                curWeek={curWeek}
                                nameField={r => r.customer_name || r.debtor_name || '—'}
                                subField={r => r.invoice_number || '—'}
                                amtFn={r => (r.amount || 0) - (r.amount_received || r.amount_paid || 0)}
                              />
                            );
                          })}
                        </>
                      )}

                      {/* Payables */}
                      {pays.length > 0 && (
                        <>
                          <SectionSep label="Payables" color="text-red-600" />
                          {pays.map(item => {
                            const origWeek = dueDateToWeek(item.due_date);
                            const curWeek  = assignments.get(`pay-${item.id}`) ?? origWeek;
                            const idx = draggableIndex++;
                            return (
                              <DraggableCard
                                key={`pay-${item.id}`}
                                draggableId={`pay-${item.id}`}
                                index={idx}
                                item={item}
                                cardType="payable"
                                isAdjusted={payAdj.has(item.id)}
                                origWeek={origWeek}
                                curWeek={curWeek}
                                nameField={p => p.vendor_name || '—'}
                                subField={p => p.bill_number || '—'}
                                amtFn={p => (p.amount || 0) - (p.amount_paid || 0)}
                              />
                            );
                          })}
                        </>
                      )}

                      {provided.placeholder}

                      {/* Expenses */}
                      {exps.length > 0 && (
                        <>
                          <SectionSep label="Expenses" color="text-orange-500" />
                          {exps.map(item => {
                            const origWeek = dueDateToWeek(item.expense_date);
                            const curWeek  = assignments.get(`exp-${item.id}`) ?? origWeek;
                            const idx = draggableIndex++;
                            return (
                              <DraggableCard
                                key={`exp-${item.id}`}
                                draggableId={`exp-${item.id}`}
                                index={idx}
                                item={item}
                                cardType="expense"
                                isAdjusted={curWeek !== origWeek}
                                origWeek={origWeek}
                                curWeek={curWeek}
                                nameField={e => e.description || '—'}
                                subField={e => e.category || 'Expense'}
                                amtFn={e => e.amount || 0}
                              />
                            );
                          })}
                        </>
                      )}

                      {/* Recurring */}
                      {recur.length > 0 && (
                        <>
                          <SectionSep label="Recurring" color="text-yellow-600" />
                          {recur.map(item => {
                            const origWeek = dueDateToWeek(item.expense_date);
                            const curWeek  = assignments.get(`recur-${item.id}`) ?? origWeek;
                            const idx = draggableIndex++;
                            return (
                              <DraggableCard
                                key={`recur-${item.id}`}
                                draggableId={`recur-${item.id}`}
                                index={idx}
                                item={item}
                                cardType="recurring"
                                isAdjusted={curWeek !== origWeek}
                                origWeek={origWeek}
                                curWeek={curWeek}
                                nameField={e => e.description || '—'}
                                subField={e => e.category || 'Recurring'}
                                amtFn={e => e.amount || 0}
                              />
                            );
                          })}
                        </>
                      )}

                      {recs.length === 0 && pays.length === 0 && exps.length === 0 && recur.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex items-center justify-center text-[10px] text-muted-foreground border border-dashed rounded mx-1 my-2 py-3">
                          Drop here
                        </div>
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
  );
}