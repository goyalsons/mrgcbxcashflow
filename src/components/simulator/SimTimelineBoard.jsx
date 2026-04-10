import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
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
  if (w.simNet > 0) return { dot: 'bg-emerald-500', text: 'text-emerald-700', header: 'bg-emerald-50' };
  if (w.simNet < 0) return { dot: 'bg-red-500', text: 'text-red-700', header: 'bg-red-50' };
  return { dot: 'bg-amber-500', text: 'text-amber-700', header: 'bg-amber-50' };
}

const BORDER = {
  receivable: 'border-l-emerald-500',
  payable: 'border-l-red-500',
  expense: 'border-l-orange-500',
  recurring: 'border-l-yellow-600',
};

function SectionSep({ label, color }) {
  return (
    <div className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide ${color} px-0.5`}>
      <div className="flex-1 h-px bg-current opacity-25" />
      <span className="shrink-0">{label}</span>
      <div className="flex-1 h-px bg-current opacity-25" />
    </div>
  );
}

function RecPayCard({ item, isReceivable, isAdjusted, origWeek, curWeek, provided, isDragging }) {
  const amt = isReceivable
    ? (item.amount || 0) - (item.amount_received || item.amount_paid || 0)
    : (item.amount || 0) - (item.amount_paid || 0);
  const overdue = item.due_date && new Date(item.due_date) < today;
  const moved = isAdjusted && curWeek !== origWeek;

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`border border-l-4 ${isReceivable ? BORDER.receivable : BORDER.payable} rounded bg-card text-xs p-1.5 flex items-center gap-1 select-none
        ${isDragging ? 'shadow-lg ring-2 ring-primary/60 opacity-90 z-50' : 'hover:bg-muted/30'}`}
      style={{ ...provided.draggableProps.style, minHeight: 38 }}
    >
      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 touch-none">
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-[11px] leading-tight">
          {isReceivable ? (item.customer_name || item.debtor_name) : item.vendor_name}
          {overdue && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" />}
        </p>
        <p className="text-[9px] text-muted-foreground truncate">{item.invoice_number || item.bill_number || '—'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[11px]">{INR(amt)}</p>
        {moved && curWeek < origWeek && <p className="text-emerald-600 text-[8px]">▲ earlier</p>}
        {moved && curWeek > origWeek && <p className="text-amber-600 text-[8px]">▼ later</p>}
      </div>
    </div>
  );
}

function ExpCard({ item, cardType }) {
  return (
    <div
      className={`border border-l-4 ${BORDER[cardType]} rounded bg-card text-xs p-1.5 flex items-center gap-1`}
      style={{ minHeight: 38 }}
    >
      <div className="text-muted-foreground/30 shrink-0 cursor-default">
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-[11px] leading-tight">{item.description || '—'}</p>
        <p className="text-[9px] text-muted-foreground truncate">{item.category || (cardType === 'recurring' ? 'Recurring' : 'Expense')}</p>
      </div>
      <p className="font-bold text-[11px] shrink-0">{INR(item.amount || 0)}</p>
    </div>
  );
}

export default function SimTimelineBoard({
  receivables, invoices, payables, expenses, recurringExpenses,
  recAdj, setRecAdj, payAdj, setPayAdj,
  weeklyData, minAmount, history, setHistory,
}) {
  const weekColumnRefs = useRef([]);

  // Flat lists filtered by status & minAmount
  const allRec = useMemo(() =>
    [...receivables, ...invoices].filter(r =>
      ['pending', 'overdue', 'partially_paid', 'partial'].includes(r.status) &&
      (r.amount || 0) - (r.amount_received || r.amount_paid || 0) >= (minAmount || 0)
    ),
    [receivables, invoices, minAmount]
  );

  const allPay = useMemo(() =>
    payables.filter(p =>
      ['pending', 'partially_paid', 'overdue'].includes(p.status) &&
      (p.amount || 0) - (p.amount_paid || 0) >= (minAmount || 0)
    ),
    [payables, minAmount]
  );

  // LOCAL assignment state: Map<"rec-id" | "pay-id", weekIndex>
  // This is the source of truth for rendering — avoids stale closure issues with DnD
  const [assignments, setAssignments] = useState(() => {
    const m = new Map();
    [...allRec].forEach(r => m.set(`rec-${r.id}`, dueDateToWeek(recAdj.get(r.id)?.tranches?.[0]?.date || r.due_date)));
    [...allPay].forEach(p => m.set(`pay-${p.id}`, dueDateToWeek(payAdj.get(p.id)?.tranches?.[0]?.date || p.due_date)));
    return m;
  });

  // Sync assignments when allRec/allPay change (initial load or new data)
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
      return m;
    });
  }, [allRec, allPay]); // eslint-disable-line

  // Build week items from local assignment state
  const weekBounds = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({ start: addDays(today, i * 7), end: addDays(today, (i + 1) * 7 - 1) })),
    []
  );

  const inWeek = (dateStr, wb) => {
    if (!dateStr) return false;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    return d >= wb.start && d <= wb.end;
  };

  const weekItems = useMemo(() => {
    const nonRecurring = (expenses || []).filter(e => !e.recurrence_type || e.recurrence_type === 'none');
    return Array.from({ length: 12 }, (_, i) => {
      const wb = weekBounds[i];
      const recs = allRec.filter(r => assignments.get(`rec-${r.id}`) === i);
      const pays = allPay.filter(p => assignments.get(`pay-${p.id}`) === i);
      const exps = nonRecurring.filter(e => inWeek(e.expense_date, wb) && (e.amount || 0) >= (minAmount || 0));
      const recur = (recurringExpenses || []).filter(e => inWeek(e.expense_date, wb) && (e.amount || 0) >= (minAmount || 0));
      return { recs, pays, exps, recur };
    });
  }, [allRec, allPay, assignments, expenses, recurringExpenses, weekBounds, minAmount]);

  const onDragEnd = useCallback(({ source, destination, draggableId }) => {
    if (!destination) return;
    const srcWeek = parseInt(source.droppableId.replace('week-', ''));
    const dstWeek = parseInt(destination.droppableId.replace('week-', ''));
    if (srcWeek === dstWeek) return;

    const isRec = draggableId.startsWith('rec-');
    const itemId = draggableId.replace(/^(rec|pay)-/, '');
    const item = isRec ? allRec.find(r => r.id === itemId) : allPay.find(p => p.id === itemId);
    if (!item) return;

    // Save undo snapshot
    const prevRecAdj = new Map(recAdj);
    const prevPayAdj = new Map(payAdj);

    // Update local assignment immediately (for smooth DnD render)
    setAssignments(prev => { const m = new Map(prev); m.set(draggableId, dstWeek); return m; });

    // Sync to parent adj maps
    const newDate = toDateStr(weekStart(dstWeek));
    const amt = isRec
      ? (item.amount || 0) - (item.amount_received || item.amount_paid || 0)
      : (item.amount || 0) - (item.amount_paid || 0);

    if (isRec) {
      const next = new Map(recAdj);
      next.set(itemId, { tranches: [{ amount: amt, date: newDate }], remainder: 0 });
      setRecAdj(next);
    } else {
      const next = new Map(payAdj);
      next.set(itemId, { tranches: [{ amount: amt, date: newDate }], remainder: 0 });
      setPayAdj(next);
    }

    const name = isRec ? (item.customer_name || item.debtor_name) : item.vendor_name;
    toast({ title: `Moved ${name} → W${dstWeek + 1}`, duration: 2000 });
    setHistory(h => [...h, { prevRecAdj, prevPayAdj }]);
  }, [allRec, allPay, recAdj, payAdj, setRecAdj, setPayAdj, setHistory]);

  const scrollToWeek = useCallback((i) => {
    weekColumnRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="border rounded-lg overflow-hidden bg-background flex flex-col" style={{ height: 'calc(100vh - 380px)', minHeight: 440 }}>
        {/* Minimap */}
        <div className="flex border-b h-5 shrink-0 cursor-pointer">
          {weeklyData.map((w, i) => (
            <div
              key={i}
              title={`W${i + 1}: ${INR(w.simNet)}`}
              onClick={() => scrollToWeek(i)}
              className="flex-1 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: w.simNet > 0 ? '#10b981' : w.simNet < 0 ? '#ef4444' : '#f59e0b', opacity: 0.65 }}
            />
          ))}
        </div>

        {/* Week columns */}
        <div className="flex flex-1 overflow-x-auto overflow-y-hidden">
          {Array.from({ length: 12 }, (_, i) => {
            const w = weeklyData[i] || { simNet: 0 };
            const { dot, text, header } = getWeekColors(w);
            const { recs, pays, exps, recur } = weekItems[i];

            const totalRec = recs.reduce((s, r) => s + (r.amount || 0) - (r.amount_received || r.amount_paid || 0), 0);
            const totalPay = pays.reduce((s, p) => s + (p.amount || 0) - (p.amount_paid || 0), 0);
            const totalExp = exps.reduce((s, e) => s + (e.amount || 0), 0);
            const totalRec2 = recur.reduce((s, e) => s + (e.amount || 0), 0);

            const summaryParts = [];
            if (totalRec > 0) summaryParts.push(<span key="r" className="text-emerald-700">↑{INR(totalRec)}({recs.length})</span>);
            if (totalPay > 0) summaryParts.push(<span key="p" className="text-red-700">↓{INR(totalPay)}({pays.length})</span>);
            if (totalExp > 0) summaryParts.push(<span key="e" className="text-orange-600">Exp {INR(totalExp)}({exps.length})</span>);
            if (totalRec2 > 0) summaryParts.push(<span key="rc" className="text-yellow-700">Rec {INR(totalRec2)}({recur.length})</span>);

            return (
              <Droppable key={i} droppableId={`week-${i}`} type="CARD">
                {(provided, snapshot) => (
                  <div
                    ref={el => { weekColumnRefs.current[i] = el; }}
                    className={`border-r flex flex-col shrink-0 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/60 border-blue-300' : ''}`}
                    style={{ width: 168 }}
                  >
                    {/* Fixed-height header */}
                    <div className={`px-2 py-1.5 border-b ${header} shrink-0`} style={{ minHeight: 72 }}>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="text-xs font-bold">W{i + 1}</span>
                        <span className="text-[9px] text-muted-foreground">{weekLabel(i)}</span>
                      </div>
                      <p className={`text-[10px] font-semibold ${text}`}>
                        Net: {w.simNet >= 0 ? '' : '-'}{INR(Math.abs(w.simNet || 0))}
                      </p>
                      {summaryParts.length > 0 && (
                        <div className="flex flex-wrap gap-x-1.5 gap-y-0 text-[9px] mt-0.5 leading-tight">
                          {summaryParts}
                        </div>
                      )}
                    </div>

                    {/* Droppable area */}
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 overflow-y-auto p-1 space-y-1"
                      style={{ minHeight: 60 }}
                    >
                      {/* Receivables */}
                      {recs.length > 0 && (
                        <>
                          <SectionSep label="Receivables" color="text-emerald-600" />
                          {recs.map((item, idx) => {
                            const origWeek = dueDateToWeek(item.due_date);
                            const curWeek = assignments.get(`rec-${item.id}`) ?? origWeek;
                            return (
                              <Draggable key={`rec-${item.id}`} draggableId={`rec-${item.id}`} index={idx}>
                                {(dp, ds) => (
                                  <RecPayCard
                                    item={item}
                                    isReceivable={true}
                                    isAdjusted={recAdj.has(item.id)}
                                    origWeek={origWeek}
                                    curWeek={curWeek}
                                    provided={dp}
                                    isDragging={ds.isDragging}
                                  />
                                )}
                              </Draggable>
                            );
                          })}
                        </>
                      )}

                      {/* Payables */}
                      {pays.length > 0 && (
                        <>
                          <SectionSep label="Payables" color="text-red-600" />
                          {pays.map((item, idx) => {
                            const origWeek = dueDateToWeek(item.due_date);
                            const curWeek = assignments.get(`pay-${item.id}`) ?? origWeek;
                            return (
                              <Draggable key={`pay-${item.id}`} draggableId={`pay-${item.id}`} index={recs.length + idx}>
                                {(dp, ds) => (
                                  <RecPayCard
                                    item={item}
                                    isReceivable={false}
                                    isAdjusted={payAdj.has(item.id)}
                                    origWeek={origWeek}
                                    curWeek={curWeek}
                                    provided={dp}
                                    isDragging={ds.isDragging}
                                  />
                                )}
                              </Draggable>
                            );
                          })}
                        </>
                      )}

                      {provided.placeholder}

                      {/* Expenses (non-draggable) */}
                      {exps.length > 0 && (
                        <>
                          <SectionSep label="Expenses" color="text-orange-500" />
                          {exps.map(item => <ExpCard key={item.id} item={item} cardType="expense" />)}
                        </>
                      )}

                      {/* Recurring */}
                      {recur.length > 0 && (
                        <>
                          <SectionSep label="Recurring" color="text-yellow-600" />
                          {recur.map(item => <ExpCard key={item.id} item={item} cardType="recurring" />)}
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
      </div>
    </DragDropContext>
  );
}