import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Scissors, AlertTriangle, Trash2, Plus } from 'lucide-react';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 100000) return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};
const todayStr = new Date().toISOString().split('T')[0];

const LEVER_TYPES = [
  { key: 'salary_defer',   label: 'Salary Deferral' },
  { key: 'rent_defer',     label: 'Rent/Utilities Deferral' },
  { key: 'tax_defer',      label: 'GST / TDS / Tax Deferral' },
  { key: 'recurring_pause', label: 'Recurring Expense Pause' },
  { key: 'early_pay_disc', label: 'Early Payment Discount' },
  { key: 'owner_drawings', label: 'Reduce Owner Drawings' },
];

function LeverForm({ onSave, onCancel, initial, recurringExpenses = [], payables = [], expByGroup = {} }) {
  const [f, setF] = useState(initial || { type: 'salary_defer', weeks: '4', deferPct: '50', resumeDate: todayStr });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const weeklySalary = Math.round((expByGroup['Salary'] || 0));
  const weeklyRent   = Math.round((expByGroup['Rent/Utilities'] || 0));

  let preview = null;
  if (f.type === 'salary_defer' && weeklySalary > 0) {
    const saved = Math.round(weeklySalary * (Number(f.deferPct)||0) / 100 * (Number(f.weeks)||0));
    preview = `Defer ₹${INR(saved)} across ${f.weeks} weeks → moves to ${f.resumeDate}`;
  }
  if (f.type === 'rent_defer') {
    const saved = Math.round((Number(f.monthlyAmt)||weeklyRent*4) * (Number(f.deferMonths)||1));
    preview = `Defer ${INR(saved)} for ${f.deferMonths||1} month(s)`;
  }
  if (f.type === 'tax_defer' && f.amount) {
    const days = Math.max(0, Math.round((new Date(f.newDate||todayStr) - new Date(f.origDate||todayStr)) / 86400000));
    const rate  = f.taxType === 'TDS' ? 0.01 * 30 : 18; // GST 18% p.a., TDS 1%/mo
    const penalty = f.taxType === 'TDS'
      ? Math.round(Number(f.amount) * 0.01 * Math.ceil(days / 30))
      : Math.round(Number(f.amount) * 0.18 / 365 * days);
    preview = `Est. penalty/interest: ${INR(penalty)}`;
  }

  return (
    <div className="border rounded-lg p-3 space-y-2.5 bg-muted/20">
      <div>
        <label className="text-[11px] text-muted-foreground">Lever Type</label>
        <select className="w-full h-7 text-xs border rounded px-2 mt-0.5 bg-background"
          value={f.type} onChange={e => setF({ type: e.target.value })}>
          {LEVER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {f.type === 'salary_defer' && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Deferral %</label>
            <Input type="range" min="0" max="100" className="h-7" value={f.deferPct||50} onChange={e => set('deferPct', e.target.value)} />
            <span className="text-xs font-bold">{f.deferPct||50}%</span>
          </div>
          <div><label className="text-[11px] text-muted-foreground">For how many weeks</label>
            <Input type="number" className="h-7 text-xs" value={f.weeks||4} onChange={e => set('weeks', e.target.value)} />
          </div>
        </div>
        <div><label className="text-[11px] text-muted-foreground">Resume (deferred pays out) Date</label>
          <Input type="date" className="h-7 text-xs" value={f.resumeDate||todayStr} onChange={e => set('resumeDate', e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2 py-1.5 rounded">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Ensure employee consent and compliance with applicable labour laws.
        </div>
      </>}

      {f.type === 'rent_defer' && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Defer for X months</label>
            <Input type="number" className="h-7 text-xs" value={f.deferMonths||1} onChange={e => set('deferMonths', e.target.value)} />
          </div>
          <div><label className="text-[11px] text-muted-foreground">Amount/month (₹)</label>
            <Input type="number" className="h-7 text-xs" value={f.monthlyAmt||Math.round(weeklyRent*4)} onChange={e => set('monthlyAmt', e.target.value)} />
          </div>
        </div>
        <div><label className="text-[11px] text-muted-foreground">Resume Date</label>
          <Input type="date" className="h-7 text-xs" value={f.resumeDate||todayStr} onChange={e => set('resumeDate', e.target.value)} />
        </div>
      </>}

      {f.type === 'tax_defer' && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Tax Type</label>
            <select className="w-full h-7 text-xs border rounded px-2 bg-background" value={f.taxType||'GST'} onChange={e => set('taxType', e.target.value)}>
              <option>GST</option><option>TDS</option><option>Advance Tax</option><option>Professional Tax</option>
            </select>
          </div>
          <div><label className="text-[11px] text-muted-foreground">Amount (₹)</label>
            <Input type="number" className="h-7 text-xs" value={f.amount||''} onChange={e => set('amount', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Original Due Date</label>
            <Input type="date" className="h-7 text-xs" value={f.origDate||todayStr} onChange={e => set('origDate', e.target.value)} />
          </div>
          <div><label className="text-[11px] text-muted-foreground">Deferred To Date</label>
            <Input type="date" className="h-7 text-xs" value={f.newDate||todayStr} onChange={e => set('newDate', e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 px-2 py-1.5 rounded">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Deferring statutory payments attracts interest and penalties. Consult your CA before proceeding.
        </div>
      </>}

      {f.type === 'recurring_pause' && <>
        <p className="text-[11px] text-muted-foreground">Select recurring expenses to pause:</p>
        {recurringExpenses.length === 0 && <p className="text-xs text-muted-foreground">No recurring expenses found.</p>}
        {recurringExpenses.slice(0, 8).map(e => (
          <label key={e.id} className="flex items-center gap-2 text-xs">
            <Checkbox checked={!!f['pause_'+e.id]} onCheckedChange={v => set('pause_'+e.id, v)} />
            {e.description} · {INR(e.amount)}
          </label>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Pause From</label>
            <Input type="date" className="h-7 text-xs" value={f.pauseFrom||todayStr} onChange={e => set('pauseFrom', e.target.value)} />
          </div>
          <div><label className="text-[11px] text-muted-foreground">Pause To</label>
            <Input type="date" className="h-7 text-xs" value={f.pauseTo||todayStr} onChange={e => set('pauseTo', e.target.value)} />
          </div>
        </div>
      </>}

      {f.type === 'early_pay_disc' && <>
        <div><label className="text-[11px] text-muted-foreground">Select Payable (bill number)</label>
          <select className="w-full h-7 text-xs border rounded px-2 bg-background" value={f.payableId||''} onChange={e => set('payableId', e.target.value)}>
            <option value="">— select —</option>
            {payables.map(p => <option key={p.id} value={p.id}>{p.bill_number||p.vendor_name} · {INR(p.amount)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Discount % offered</label>
            <Input type="number" className="h-7 text-xs" value={f.discPct||''} onChange={e => set('discPct', e.target.value)} />
          </div>
          <div><label className="text-[11px] text-muted-foreground">New Payment Date</label>
            <Input type="date" className="h-7 text-xs" value={f.newDate||todayStr} onChange={e => set('newDate', e.target.value)} />
          </div>
        </div>
        {f.payableId && f.discPct && (() => {
          const p = payables.find(x => x.id === f.payableId);
          const bal = p ? (p.amount - (p.amount_paid||0)) : 0;
          const savings = Math.round(bal * Number(f.discPct) / 100);
          return <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Pay {INR(bal - savings)} early, save {INR(savings)}</p>;
        })()}
      </>}

      {f.type === 'owner_drawings' && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Current monthly (₹)</label>
            <Input type="number" className="h-7 text-xs" value={f.current||''} onChange={e => set('current', e.target.value)} />
          </div>
          <div><label className="text-[11px] text-muted-foreground">Reduced amount (₹)</label>
            <Input type="number" className="h-7 text-xs" value={f.reduced||''} onChange={e => set('reduced', e.target.value)} />
          </div>
        </div>
        <div><label className="text-[11px] text-muted-foreground">Duration (months)</label>
          <Input type="number" className="h-7 text-xs" value={f.duration||3} onChange={e => set('duration', e.target.value)} />
        </div>
        {f.current && f.reduced && (
          <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
            Save {INR((Number(f.current)-Number(f.reduced)) * (Number(f.duration)||3))} over {f.duration||3} months
          </p>
        )}
      </>}

      {preview && <p className="text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded">{preview}</p>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs" onClick={() => onSave({ ...f, id: f.id || Date.now().toString() })}>Save</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function SimSectionE({ levers, setLevers, recurringExpenses, payables, expByGroup }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const handleSave = (f) => {
    setLevers(prev => editItem ? prev.map(l => l.id === f.id ? f : l) : [...prev, f]);
    setShowForm(false); setEditItem(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 justify-between">
          <span className="flex items-center gap-2"><Scissors className="w-4 h-4 text-orange-600" />Section E — Cost Reduction Levers</span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditItem(null); setShowForm(v => !v); }}>
            <Plus className="w-3 h-3" />Add Lever
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && <LeverForm onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null); }} initial={editItem} recurringExpenses={recurringExpenses} payables={payables} expByGroup={expByGroup} />}
        {levers.length === 0 && !showForm && <p className="text-xs text-muted-foreground py-2 text-center">No cost levers added yet.</p>}
        <div className="space-y-2">
          {levers.map(l => (
            <div key={l.id} className="border rounded-lg p-2.5 flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">{LEVER_TYPES.find(t => t.key === l.type)?.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{l.type === 'salary_defer' ? `${l.deferPct}% for ${l.weeks}w` : l.type === 'tax_defer' ? `${l.taxType} · ${INR(l.amount)}` : l.type === 'owner_drawings' ? `Save ${INR((Number(l.current)-Number(l.reduced))*Number(l.duration||3))}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditItem(l); setShowForm(true); }}><Scissors className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLevers(p => p.filter(x => x.id !== l.id))}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export { LEVER_TYPES };