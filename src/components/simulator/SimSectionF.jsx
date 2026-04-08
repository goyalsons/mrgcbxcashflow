import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Trash2, AlertTriangle, Info } from 'lucide-react';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 100000) return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};
const todayStr = new Date().toISOString().split('T')[0];

const TAX_TYPES = [
  { key: 'itc',          label: 'ITC Utilisation' },
  { key: 'advance_tax',  label: 'Advance Tax Timing' },
  { key: 'tds_refund',   label: 'TDS / Tax Refund' },
];

function TaxForm({ onSave, onCancel, initial }) {
  const [f, setF] = useState(initial || { type: 'itc', amount: '', date: todayStr });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="border rounded-lg p-3 space-y-2.5 bg-muted/20">
      <div>
        <label className="text-[11px] text-muted-foreground">Type</label>
        <select className="w-full h-7 text-xs border rounded px-2 mt-0.5 bg-background"
          value={f.type} onChange={e => setF({ type: e.target.value, amount: '', date: todayStr })}>
          {TAX_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {f.type === 'itc' && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Available ITC Balance (₹)</label>
            <Input type="number" className="h-7 text-xs" value={f.amount||''} onChange={e => set('amount', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Apply Against Month</label>
            <Input type="month" className="h-7 text-xs" value={f.month||''} onChange={e => set('month', e.target.value)} /></div>
        </div>
        <div className="flex items-start gap-1.5 text-[11px] text-blue-700 bg-blue-50 px-2 py-1.5 rounded">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          Verify ITC eligibility and availability with your CA before applying.
        </div>
        {f.amount && <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Reduces GST outflow by {INR(f.amount)} in {f.month || 'selected month'}</p>}
      </>}

      {f.type === 'advance_tax' && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Instalment Amount (₹)</label>
            <Input type="number" className="h-7 text-xs" value={f.amount||''} onChange={e => set('amount', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Original Due Date</label>
            <Input type="date" className="h-7 text-xs" value={f.origDate||todayStr} onChange={e => set('origDate', e.target.value)} /></div>
        </div>
        <div><label className="text-[11px] text-muted-foreground">Revised Payment Date</label>
          <Input type="date" className="h-7 text-xs" value={f.newDate||todayStr} onChange={e => set('newDate', e.target.value)} /></div>
        <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2 py-1.5 rounded">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          Late advance tax payments attract interest under Section 234B/234C.
        </div>
      </>}

      {f.type === 'tds_refund' && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Expected Refund (₹)</label>
            <Input type="number" className="h-7 text-xs" value={f.amount||''} onChange={e => set('amount', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Expected Receipt Date</label>
            <Input type="date" className="h-7 text-xs" value={f.date||todayStr} onChange={e => set('date', e.target.value)} /></div>
        </div>
        {f.amount && <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Tax refund inflow: {INR(f.amount)} on {f.date} <span className="text-blue-600 ml-1">tax refund</span></p>}
      </>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs" onClick={() => onSave({ ...f, id: f.id || Date.now().toString() })}>Save</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function SimSectionF({ taxItems, setTaxItems }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const handleSave = (f) => {
    setTaxItems(prev => editItem ? prev.map(t => t.id === f.id ? f : t) : [...prev, f]);
    setShowForm(false); setEditItem(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 justify-between">
          <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" />Section F — GST & Tax Management</span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditItem(null); setShowForm(v => !v); }}>
            <Plus className="w-3 h-3" />Add Item
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && <TaxForm onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null); }} initial={editItem} />}
        {taxItems.length === 0 && !showForm && <p className="text-xs text-muted-foreground py-2 text-center">No tax adjustments added yet.</p>}
        <div className="space-y-2">
          {taxItems.map(t => (
            <div key={t.id} className="border rounded-lg p-2.5 flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                  {TAX_TYPES.find(x => x.key === t.type)?.label}
                </span>
                <p className="text-xs font-bold text-blue-700 mt-0.5">{INR(t.amount)}</p>
                <p className="text-[10px] text-muted-foreground">{t.date || t.newDate || ''}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditItem(t); setShowForm(true); }}><FileText className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTaxItems(p => p.filter(x => x.id !== t.id))}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}