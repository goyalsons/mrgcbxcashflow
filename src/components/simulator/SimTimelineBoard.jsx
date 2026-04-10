import React, { useState, useMemo, useRef, useCallback } from 'react';
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

const CARD_BORDER = {
  receivable: 'border-l-emerald-500',
  payable: 'border-l-red-500',
  expense: 'border-l-orange-500',
  recurring: 'border-l-yellow-600',
};

function getItemWeekIndex(item, recAdj, payAdj, isReceivable) {
  const adjMap = isReceivable ? recAdj : payAdj;
  const adj = adjMap.get(item.id);
  const dateStr = adj?.tranches?.[0]?.date || item.due_date;
  if (!dateStr) return -1;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - today) / 86400000);
  if (diff < 0) return 0;
  return Math.min(Math.floor(diff / 7), 11);
}

function getWeekNetColor(w) {
  if (w.simNet > 0) return { dot: 'bg-emerald-500', text: 'text-emerald-700', header: 'bg-emerald-50' };
  if (w.simNet < 0) return { dot: 'bg-red-500', text: 'text-red-700', header: 'bg-red-50' };
  return { dot: 'bg-amber-500', text: 'text-amber-700', header: 'bg-amber-50' };
}

function SectionSeparator({ label, color }) {
  return (
    <div className={`flex items-center gap-1 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${color}`}>
      <div className="flex-1 h-px bg-current opacity-30" />
      <span>{label}</span>
      <div className="flex-1 h-px bg-current opacity-30" />
    </div>
  );
}

function RecPayCard({ item, isReceivable, isAdjusted, weekIndex, provided, isDragging }) {
  const amt = isReceivable
    ? (item.amount || 0) - (item.amount_received || item.amount_paid || 0)
    : (item.amount || 0) - (item.amount_paid || 0);
  const overdue = item.due_date && new Date(item.due_date) < today;
  const originalWeek = (() => {
    if (!item.due_date) return -1;
    const d = new Date(item.due_date); d.setHours(0, 0, 0, 0);
    const diff = Math.floor((d - today) / 86400000);
    if (diff < 0) return 0;
    return Math.min(Math.floor(diff / 7), 11);
  })();
  const moved = isAdjusted && weekIndex !== originalWeek;
  const movedEarlier = moved && weekIndex < originalWeek;
  const movedLater = moved && weekIndex > originalWeek;
  const borderColor = isReceivable ? CARD_BORDER.receivable : CARD_BORDER.payable;

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`border border-l-4 ${borderColor} rounded bg-card text-xs p-1.5 flex items-center gap-1.5 select-none
        ${isDragging ? 'shadow-lg ring-2 ring-primary opacity-90' : 'hover:bg-muted/30'}
        ${overdue ? 'ring-1 ring-red-300' : ''}`}
      style={{ ...provided.draggableProps.style, minHeight: 40 }}
    >
      <div {...provided.dragHandleProps} className="cursor-grab text-muted-foreground shrink-0">
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
        {movedEarlier && <span className="text-emerald-600 text-[9px]">▲ earlier</span>}
        {movedLater && <span className="text-amber-600 text-[9px]">▼ later</span>}
      </div>
    </div>
  );
}

function ExpenseCard({ item, cardType }) {
  const amt = item.amount || 0;
  const borderColor = CARD_BORDER[cardType] || 'border-l-gray-400';
  return (
    <div
      className={`border border-l-4 ${borderColor} rounded bg-card text-xs p-1.5 flex items-center gap-1.5`}
      style={{ minHeight: 40 }}
    >
      <div className="text-muted-foreground/40 shrink-0">
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-[11px] leading-tight">{item.description || '—'}</p>
        <p className="text-[9px] text-muted-foreground truncate">{item.category || (cardType === 'recurring' ? 'Recurring' : 'Expense')}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[11px]">{INR(amt)}</p>
      </div>
    </div>
  );
}

export default function SimTimelineBoard({
  receivables, invoices, payables, expenses, recurringExpenses,
  recAdj, setRecAdj, payAdj, setPayAdj,
  weeklyData, minAmount, history, setHistory,
}) {
  const weekColumnRefs = useRef([]);
  const boardScrollRef = useRef(null);

  const allReceivables = useMemo(() =>
    [...receivables, ...invoices].filter(r =>
      ['pending', 'overdue', 'partially_paid', 'partial'].includes(r.status) &&
      (r.amount || 0) - (r.amount_received || r.amount_paid || 0) >= (minAmount || 0)
    ),
    [receivables, invoices, minAmount]
  );

  const allPayables = useMemo(() =>
    payables.filter(p =>
      ['pending', 'partially_paid', 'overdue'].includes(p.status) &&
      (p.amount || 0) - (p.amount_paid || 0) >= (minAmount || 0)
    ),
    [payables, minAmount]
  );

  const weekBoundary = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    start: addDays(today, i * 7),
    end: addDays(today, (i + 1) * 7 - 1),
  })), []);

  const inWeek = useCallback((dateStr, wb) => {
    if (!dateStr) return false;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    return d >= wb.start && d <= wb.end;
  }, []);

  const weekItems = useMemo(() => {
    const nonRecurring = (expenses || []).filter(e => !e.recurrence_type || e.recurrence_type === 'none');
    return Array.from({ length: 12 }, (_, i) => {
      const wb = weekBoundary[i];
      const recs = allReceivables.filter(r => getItemWeekIndex(r, recAdj, payAdj, true) === i);
      const pays = allPayables.filter(p => getItemWeekIndex(p, recAdj, payAdj, false) === i);
      const exps = nonRecurring.filter(e => inWeek(e.expense_date, wb) && (e.amount || 0) >= (minAmount || 0));
      const recur = (recurringExpenses || []).filter(e => inWeek(e.expense_date, wb) && (e.amount || 0) >= (minAmount || 0));
      return { recs, pays, exps, recur };
    });
  }, [allReceivables, allPayables, recAdj, payAdj, expenses, recurringExpenses, weekBoundary, minAmount, inWeek]);

  const onDragEnd = useCallback((result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const isRec = draggableId.startsWith('rec-');
    const itemId = draggableId.replace(/^(rec|pay)-/, '');
    const item = isRec
      ? allReceivables.find(r => r.id === itemId)
      : allPayables.find(p => p.id === itemId);
    if (!item) return;

    const prevRecAdj = new Map(recAdj);
    const prevPayAdj = new Map(payAdj);

    const weekIdx = parseInt(destination.droppableId.replace('week-', ''));
    const newDate = toDateStr(weekStart(weekIdx));
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
    toast({ title: `Moved ${name} → W${weekIdx + 1}`, duration: 2000 });
    setHistory(h => [...h, { prevRecAdj, prevPayAdj }]);
  }, [allReceivables, allPayables, recAdj, payAdj, setRecAdj, setPayAdj, setHistory]);

  const scrollToWeek = useCallback((i) => {
    const el = weekColumnRefs.current[i];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
        <div ref={boardScrollRef} className="flex flex-1 overflow-x-auto overflow-y-hidden">
          {Array.from({ length: 12 }, (_, i) => {
            const w = weeklyData[i] || { simNet: 0 };
            const { dot, text, header } = getWeekNetColor(w);
            const { recs, pays, exps, recur } = weekItems[i] || { recs: [], pays: [], exps: [], recur: [] };
            const totalRec = recs.reduce((s, r) => s + (r.amount || 0) - (r.amount_received || r.amount_paid || 0), 0);
            const totalPay = pays.reduce((s, p) => s + (p.amount || 0) - (p.amount_paid || 0), 0);
            const totalExp = exps.reduce((s, e) => s + (e.amount || 0), 0);
            const totalRec2 = recur.reduce((s, e) => s + (e.amount || 0), 0);

            return (
              <Droppable key={i} droppableId={`week-${i}`}>
                {(provided, snapshot) => (
                  <div
                    ref={el => { weekColumnRefs.current[i] = el; }}
                    className={`border-r flex flex-col shrink-0 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50 border-blue-300' : ''}`}
                    style={{ width: 168 }}
                  >
                    {/* Week header */}
                    <div className={`sticky top-0 z-10 px-2 py-1.5 border-b ${header} shrink-0`}>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="text-xs font-bold">W{i + 1}</span>
                        <span className="text-[9px] text-muted-foreground">{weekLabel(i)}</span>
                      </div>
                      <p className={`text-[10px] font-semibold ${text}`}>
                        Net: {w.simNet >= 0 ? '' : '-'}{INR(Math.abs(w.simNet || 0))}
                      </p>
                      <div className="text-[9px] text-muted-foreground mt-0.5 space-y-0.5">
                        {totalRec > 0 && <div className="text-emerald-700">↑ {INR(totalRec)} ({recs.length})</div>}
                        {totalPay > 0 && <div className="text-red-700">↓ {INR(totalPay)} ({pays.length})</div>}
                        {totalExp > 0 && <div className="text-orange-600">Exp {INR(totalExp)} ({exps.length})</div>}
                        {totalRec2 > 0 && <div className="text-yellow-700">Rec {INR(totalRec2)} ({recur.length})</div>}
                      </div>
                    </div>

                    {/* Droppable content */}
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 overflow-y-auto p-1 space-y-1 min-h-[60px]"
                    >
                      {/* Receivables */}
                      {recs.length > 0 && (
                        <>
                          <SectionSeparator label="Receivables" color="text-emerald-700" />
                          {recs.map((item, idx) => (
                            <Draggable key={`rec-${item.id}`} draggableId={`rec-${item.id}`} index={idx}>
                              {(dp, ds) => (
                                <RecPayCard
                                  item={item}
                                  isReceivable={true}
                                  isAdjusted={recAdj.has(item.id)}
                                  weekIndex={i}
                                  provided={dp}
                                  isDragging={ds.isDragging}
                                />
                              )}
                            </Draggable>
                          ))}
                        </>
                      )}

                      {/* Payables */}
                      {pays.length > 0 && (
                        <>
                          <SectionSeparator label="Payables" color="text-red-700" />
                          {pays.map((item, idx) => (
                            <Draggable key={`pay-${item.id}`} draggableId={`pay-${item.id}`} index={recs.length + idx}>
                              {(dp, ds) => (
                                <RecPayCard
                                  item={item}
                                  isReceivable={false}
                                  isAdjusted={payAdj.has(item.id)}
                                  weekIndex={i}
                                  provided={dp}
                                  isDragging={ds.isDragging}
                                />
                              )}
                            </Draggable>
                          ))}
                        </>
                      )}

                      {provided.placeholder}

                      {/* Expenses (non-draggable) */}
                      {exps.length > 0 && (
                        <>
                          <SectionSeparator label="Expenses" color="text-orange-600" />
                          {exps.map((item) => (
                            <ExpenseCard key={item.id} item={item} cardType="expense" />
                          ))}
                        </>
                      )}

                      {/* Recurring */}
                      {recur.length > 0 && (
                        <>
                          <SectionSeparator label="Recurring" color="text-yellow-700" />
                          {recur.map((item) => (
                            <ExpenseCard key={item.id} item={item} cardType="recurring" />
                          ))}
                        </>
                      )}

                      {recs.length === 0 && pays.length === 0 && exps.length === 0 && recur.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex items-center justify-center h-10 text-[10px] text-muted-foreground border border-dashed rounded m-1">
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