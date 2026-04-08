import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpRight, Search, AlertTriangle } from 'lucide-react';
import SplitBuilder from './SplitBuilder';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${abs.toLocaleString('en-IN')}`;
};
const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
const today = new Date(); today.setHours(0,0,0,0);
const isOverdue = (d) => d && new Date(d) < today;
const daysDiff = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

export default function SimSectionB({ payables, adjustments, setAdjustments }) {
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [expanded, setExpanded]   = useState(new Set());
  const [bulkDays, setBulkDays]   = useState('');
  const [splitMode, setSplitMode] = useState(new Map());

  const allItems = useMemo(() =>
    payables.filter(p => ['pending','partially_paid','overdue'].includes(p.status)),
    [payables]
  );

  const filtered = useMemo(() => {
    let items = allItems;
    if (search) items = items.filter(p => (p.vendor_name||'').toLowerCase().includes(search.toLowerCase()) || (p.bill_number||'').toLowerCase().includes(search.toLowerCase()));
    if (filter === 'overdue')    items = items.filter(p => isOverdue(p.due_date));
    if (filter === 'this_week') {
      const end = new Date(today); end.setDate(today.getDate() + 7);
      items = items.filter(p => { const d = new Date(p.due_date); return d >= today && d <= end; });
    }
    return items;
  }, [allItems, search, filter]);

  const checked = useMemo(() => new Set([...adjustments.keys()].filter(id => allItems.find(p => p.id === id))), [adjustments, allItems]);

  const toggle = (item) => {
    const id = item.id;
    if (checked.has(id)) {
      const next = new Map(adjustments); next.delete(id);
      setAdjustments(next);
      setExpanded(prev => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      const amt = (item.amount || 0) - (item.amount_paid || 0);
      const next = new Map(adjustments);
      next.set(id, { tranches: [{ amount: amt, date: toDateStr(item.due_date) }], remainder: 0 });
      setAdjustments(next);
      setExpanded(prev => new Set([...prev, id]));
    }
  };

  const selectAllOverdue = () => {
    const next = new Map(adjustments);
    allItems.filter(p => isOverdue(p.due_date)).forEach(item => {
      if (!next.has(item.id)) {
        const amt = (item.amount || 0) - (item.amount_paid || 0);
        next.set(item.id, { tranches: [{ amount: amt, date: toDateStr(item.due_date) }], remainder: 0 });
      }
    });
    setAdjustments(next);
  };

  const selectAllThisWeek = () => {
    const end = new Date(today); end.setDate(today.getDate() + 7);
    const next = new Map(adjustments);
    allItems.filter(p => { const d = new Date(p.due_date); return d >= today && d <= end; }).forEach(item => {
      if (!next.has(item.id)) {
        const amt = (item.amount || 0) - (item.amount_paid || 0);
        next.set(item.id, { tranches: [{ amount: amt, date: toDateStr(item.due_date) }], remainder: 0 });
      }
    });
    setAdjustments(next);
  };

  const applyBulk = () => {
    if (!bulkDays) return;
    const next = new Map(adjustments);
    [...checked].forEach(id => {
      const item = allItems.find(p => p.id === id);
      if (!item) return;
      const adj = next.get(id);
      if (adj?.tranches?.length === 1) {
        const newDate = new Date(item.due_date);
        newDate.setDate(newDate.getDate() + parseInt(bulkDays));
        next.set(id, { ...adj, tranches: [{ ...adj.tranches[0], date: toDateStr(newDate) }] });
      }
    });
    setAdjustments(next);
  };

  const updateAdj = (id, item, tranches) => {
    const total = (item.amount || 0) - (item.amount_paid || 0);
    const allocated = tranches.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const remainder = Math.max(0, total - allocated);
    const next = new Map(adjustments); next.set(id, { tranches, remainder });
    setAdjustments(next);
  };

  const selectedAmt = [...checked].reduce((s, id) => {
    const item = allItems.find(p => p.id === id);
    return s + ((item?.amount || 0) - (item?.amount_paid || 0));
  }, 0);

  const FILTERS = [{ key: 'all', label: 'All' }, { key: 'overdue', label: 'Overdue' }, { key: 'this_week', label: 'This Week' }];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-red-500" />
          Section B — Defer Payables
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllThisWeek}>Select Due This Week</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllOverdue}>Select All Overdue</Button>
          <div className="flex items-center gap-1.5">
            <Input type="number" placeholder="Days" className="h-7 w-16 text-xs" value={bulkDays} onChange={e => setBulkDays(e.target.value)} />
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={applyBulk}>Bulk defer</Button>
          </div>
        </div>
        {checked.size > 0 && (
          <p className="text-[11px] text-muted-foreground">{checked.size} selected · {INR(selectedAmt)} being deferred</p>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-muted-foreground" />
            <Input placeholder="Search vendor / bill…" className="h-7 text-xs pl-7" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground'}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">No payables match this filter.</p>}
          {filtered.map(item => {
            const id = item.id;
            const isChecked = checked.has(id);
            const adj = adjustments.get(id);
            const amt = (item.amount || 0) - (item.amount_paid || 0);
            const overdue = isOverdue(item.due_date);
            const isExpanded = expanded.has(id);
            const mode = splitMode.get(id) || 'full';

            let border = '';
            if (isChecked) {
              if (adj?.tranches?.length > 1) border = 'border-l-blue-500';
              else if (overdue) border = 'border-l-red-500';
              else border = 'border-l-amber-400';
            }

            return (
              <div key={id} className={`border border-l-4 rounded-lg overflow-hidden ${border || 'border-l-transparent'}`}>
                <div className="flex items-start gap-2 p-2 cursor-pointer hover:bg-muted/30" onClick={() => { if (!isChecked) toggle(item); else setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); }}>
                  <Checkbox checked={isChecked} onCheckedChange={() => toggle(item)} onClick={e => e.stopPropagation()} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.vendor_name || 'Unknown Vendor'}</p>
                    <p className="text-[10px] text-muted-foreground">{item.bill_number || '—'} · {item.due_date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold">{INR(amt)}</p>
                    <Badge variant="outline" className={`text-[9px] px-1 ${overdue ? 'text-red-600 border-red-200' : 'text-amber-600 border-amber-200'}`}>
                      {overdue ? 'overdue' : item.status}
                    </Badge>
                  </div>
                </div>

                {isChecked && isExpanded && (
                  <div className="px-3 pb-3 bg-muted/20 border-t space-y-2">
                    {overdue && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Already overdue by {Math.abs(daysDiff(item.due_date, today))}d — deferring further may affect vendor relationship.
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      {['full', 'split'].map(m => (
                        <button key={m} onClick={() => {
                          setSplitMode(prev => new Map(prev).set(id, m));
                          if (m === 'full') {
                            const next = new Map(adjustments);
                            next.set(id, { tranches: [{ amount: amt, date: toDateStr(item.due_date) }], remainder: 0 });
                            setAdjustments(next);
                          } else {
                            const next = new Map(adjustments);
                            next.set(id, { tranches: [{ amount: Math.floor(amt / 2), date: toDateStr(item.due_date) }], remainder: Math.ceil(amt / 2) });
                            setAdjustments(next);
                          }
                        }} className={`text-xs px-2.5 py-0.5 rounded-full border ${mode === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                          {m === 'full' ? 'Full amount' : 'Partial split'}
                        </button>
                      ))}
                    </div>

                    {mode === 'full' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground shrink-0">Pay {INR(amt)} on:</span>
                        <Input type="date" className="h-7 text-xs flex-1"
                          value={adj?.tranches?.[0]?.date || toDateStr(item.due_date)}
                          onChange={e => {
                            const newDate = e.target.value;
                            const origDate = toDateStr(item.due_date);
                            const daysLate = daysDiff(newDate, origDate);
                            updateAdj(id, item, [{ amount: amt, date: newDate }]);
                            if (daysLate > 60) alert('This date is 60+ days past the original due date — high risk of vendor penalty.');
                          }} />
                      </div>
                    ) : (
                      <SplitBuilder
                        totalAmount={amt}
                        tranches={adj?.tranches || [{ amount: amt, date: toDateStr(item.due_date) }]}
                        onChange={(t) => updateAdj(id, item, t)}
                        originalDate={toDateStr(item.due_date)}
                        mode="defer"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}