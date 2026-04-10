import React, { useState, useMemo, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const today = new Date(); today.setHours(0,0,0,0);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
const weekStart = (i) => addDays(today, i * 7);
const weekLabel = (i) => {
  const d = weekStart(i);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
};

function getItemWeekIndex(item, recAdj, payAdj, isReceivable) {
  const adjMap = isReceivable ? recAdj : payAdj;
  const adj = adjMap.get(item.id);
  const dateStr = adj?.tranches?.[0]?.date || item.due_date;
  if (!dateStr) return -1;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const diff = Math.floor((d - today) / 86400000);
  if (diff < 0) return 0;
  return Math.min(Math.floor(diff / 7), 11);
}

function getWeekNetColor(w) {
  if (w.simNet > 0) return { dot: 'bg-emerald-500', text: 'text-emerald-700', header: 'bg-emerald-50' };
  if (w.simNet < 0) return { dot: 'bg-red-500', text: 'text-red-700', header: 'bg-red-50' };
  return { dot: 'bg-amber-500', text: 'text-amber-700', header: 'bg-amber-50' };
}

// card border colors by type
const CARD_BORDER = {
  receivable: 'border-l-emerald-500',
  payable: 'border-l-red-500',
  expense: 'border-l-orange-500',
  recurring: 'border-l-yellow-600',
};

function ItemCard({ item, isReceivable, isAdjusted, weekIndex, provided, isDragging }) {
  const amt = isReceivable
    ? (item.amount || 0) - (item.amount_received || item.amount_paid || 0)
    : (item.amount || 0) - (item.amount_paid || 0);
  const overdue = item.due_date && new Date(item.due_date) < today;
  const originalWeek = (() => {
    if (!item.due_date) return -1;
    const d = new Date(item.due_date); d.setHours(0,0,0,0);
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
      style={{ ...provided.draggableProps.style, height: 40 }}
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
      style={{ height: 40 }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-[11px] leading-tight">{item.description || '—'}</p>
        <p className="text-[9px] text-muted-foreground truncate">{cardType === 'recurring' ? 'Recurring Expense' : 'Expense'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[11px]">{INR(amt)}</p>
      </div>
    </div>
  );
}

function SourceSection({ title, items, isReceivable, recAdj, payAdj, color }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold ${color} border-b`}
      >
        <span>{title} ({items.length})</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && (
        <div className="px-1 py-1 space-y-1">
          {items.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">None</p>}
          {items.map((item, idx) => (
            <Draggable key={item.id} draggableId={`${isReceivable ? 'rec' : 'pay'}-${item.id}`} index={idx}>
              {(provided, snapshot) => (
                <ItemCard
                  item={item}
                  isReceivable={isReceivable}
                  isAdjusted={(isReceivable ? recAdj : payAdj).has(item.id)}
                  weekIndex={getItemWeekIndex(item, recAdj, payAdj, isReceivable)}
                  provided={provided}
                  isDragging={snapshot.isDragging}
                />
              )}
            </Draggable>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SimTimelineBoard({ receivables, invoices, payables, expenses, recurringExpenses, recAdj, setRecAdj, payAdj, setPayAdj, weeklyData, minAmount, history, setHistory }) {
  const weekColumnRefs = useRef([]);
  const boardScrollRef = useRef(null);

  const allReceivables = useMemo(() =>
    [...receivables, ...invoices].filter(r =>
      ['pending','overdue','partially_paid','partial'].includes(r.status) &&
      (r.amount || 0) - (r.amount_received || r.amount_paid || 0) >= (minAmount || 0)
    ),
    [receivables, invoices, minAmount]
  );
  const allPayables = useMemo(() =>
    payables.filter(p =>
      ['pending','partially_paid','overdue'].includes(p.status) &&
      (p.amount || 0) - (p.amount_paid || 0) >= (minAmount || 0)
    ),
    [payables, minAmount]
  );

  const weekBoundary = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    start: addDays(today, i * 7),
    end: addDays(today, (i + 1) * 7 - 1),
  })), []);

  const inWeek = (dateStr, wb) => {
    if (!dateStr) return false;
    const d = new Date(dateStr); d.setHours(0,0,0,0);
    return d >= wb.start && d <= wb.end;
  };

  const weekItems = useMemo(() => {
    const nonRecurring = (expenses || []).filter(e => !e.recurrence_type || e.recurrence_type === 'none');
    return Array.from({ length: 12 }, (_, i) => {
      const wb = weekBoundary[i];
      const recs = allReceivables.filter(r => getItemWeekIndex(r, recAdj, payAdj, true) === i);
      const pays = allPayables.filter(p => getItemWeekIndex(p, recAdj, payAdj, false) === i);
      const exps = nonRecurring.filter(e => inWeek(e.expense_date, wb) && (e.amount || 0) >= (minAmount || 0));
      const recs2 = (recurringExpenses || []).filter(e => inWeek(e.expense_date, wb) && (e.amount || 0) >= (minAmount || 0));
      return { recs, pays, exps, recurring: recs2 };
    });
  }, [allReceivables, allPayables, recAdj, payAdj, expenses, recurringExpenses, weekBoundary, minAmount]);

  const onDragEnd = useCallback((result) => {
    const { destination, draggableId } = result;
    if (!destination) return;

    const isRec = draggableId.startsWith('rec-');
    const itemId = draggableId.replace(/^(rec|pay)-/, '');
    const item = isRec
      ? allReceivables.find(r => r.id === itemId)
      : allPayables.find(p => p.id === itemId);
    if (!item) return;

    const prevRecAdj = new Map(recAdj);
    const prevPayAdj = new Map(payAdj);

    if (destination.droppableId === 'source') {
      if (isRec) { const next = new Map(recAdj); next.delete(itemId); setRecAdj(next); }
      else { const next = new Map(payAdj); next.delete(itemId); setPayAdj(next); }
      toast({ title: 'Reverted to original date', duration: 3000 });
      setHistory(h => [...h, { prevRecAdj, prevPayAdj }]);
      return;
    }

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
    toast({ title: `Moved ${name} → W${weekIdx + 1}`, duration: 3000 });
    setHistory(h => [...h, { prevRecAdj, prevPayAdj }]);
  }, [allReceivables, allPayables, recAdj, payAdj, setRecAdj, setPayAdj, setHistory]);

  const scrollToWeek = useCallback((i) => {
    const el = weekColumnRefs.current[i];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex border rounded-lg overflow-hidden bg-background" style={{ height: 'calc(100vh - 400px)', minHeight: 420 }}>
        {/* Source panel */}
        <Droppable droppableId="source">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`border-r flex flex-col shrink-0 overflow-y-auto ${snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-muted/10'}`}
              style={{ width: 240 }}
            >
              <div className="sticky top-0 z-10 bg-card border-b p-2">
                <span className="text-xs font-bold">All Items</span>
              </div>
              <SourceSection title="Receivables" items={allReceivables} isReceivable={true} recAdj={recAdj} payAdj={payAdj} color="text-emerald-700 bg-emerald-50" />
              <SourceSection title="Payables" items={allPayables} isReceivable={false} recAdj={recAdj} payAdj={payAdj} color="text-red-700 bg-red-50" />
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Timeline area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Minimap */}
          <div className="flex border-b h-5 shrink-0 cursor-pointer">
            {weeklyData.map((w, i) => (
              <div
                key={i}
                title={`W${i+1}: ${INR(w.simNet)}`}
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
              const { recs, pays, exps, recurring } = weekItems[i] || { recs: [], pays: [], exps: [], recurring: [] };

              return (
                <Droppable key={i} droppableId={`week-${i}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={el => { weekColumnRefs.current[i] = el; }}
                      className={`border-r flex flex-col shrink-0 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50 border-blue-300' : ''}`}
                      style={{ width: 160 }}
                    >
                      <div className={`sticky top-0 z-10 px-2 py-1.5 border-b ${header} shrink-0`}>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                          <span className="text-xs font-bold">W{i+1}</span>
                          <span className="text-[9px] text-muted-foreground">{weekLabel(i)}</span>
                        </div>
                        <p className={`text-[10px] font-semibold ${text}`}>
                          Net: {w.simNet >= 0 ? '' : '-'}{INR(Math.abs(w.simNet || 0))}
                        </p>
                      </div>

                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto p-1 space-y-1 min-h-[60px]"
                      >
                        {recs.map((item, idx) => (
                          <Draggable key={item.id} draggableId={`rec-${item.id}`} index={idx}>
                            {(dp, ds) => (
                              <ItemCard item={item} isReceivable={true} isAdjusted={recAdj.has(item.id)} weekIndex={i} provided={dp} isDragging={ds.isDragging} />
                            )}
                          </Draggable>
                        ))}
                        {pays.map((item, idx) => (
                          <Draggable key={item.id} draggableId={`pay-${item.id}`} index={recs.length + idx}>
                            {(dp, ds) => (
                              <ItemCard item={item} isReceivable={false} isAdjusted={payAdj.has(item.id)} weekIndex={i} provided={dp} isDragging={ds.isDragging} />
                            )}
                          </Draggable>
                        ))}
                        {exps.map((item) => (
                          <ExpenseCard key={item.id} item={item} cardType="expense" />
                        ))}
                        {recurring.map((item) => (
                          <ExpenseCard key={item.id} item={item} cardType="recurring" />
                        ))}
                        {provided.placeholder}
                        {recs.length === 0 && pays.length === 0 && exps.length === 0 && recurring.length === 0 && !snapshot.isDraggingOver && (
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
      </div>
    </DragDropContext>
  );
}