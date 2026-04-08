import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, PlusCircle } from 'lucide-react';
import SplitBuilder from './SplitBuilder';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
  return `₹${abs.toLocaleString('en-IN')}`;
};
const toDateStr = (d) => d ? (d instanceof Date ? d : new Date(d)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

const EMPTY_FORM = { type: 'inflow', label: '', amount: '', category: '', tranches: [{ amount: '', date: toDateStr(new Date()) }] };

export default function SimSectionC({ hypotheticals, setHypotheticals }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const saveEntry = () => {
    if (!form.label || !form.amount) return;
    const total = Number(form.amount);
    const entry = { id: editId || Date.now().toString(), ...form, amount: total, tranches: form.tranches.map(t => ({ ...t, amount: Number(t.amount) || total })) };
    if (editId) setHypotheticals(prev => prev.map(h => h.id === editId ? entry : h));
    else setHypotheticals(prev => [...prev, entry]);
    setForm(EMPTY_FORM); setShowForm(false); setEditId(null);
  };

  const editEntry = (h) => {
    setForm({ ...h, amount: String(h.amount) });
    setEditId(h.id);
    setShowForm(true);
  };

  const deleteEntry = (id) => setHypotheticals(prev => prev.filter(h => h.id !== id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 justify-between">
          <span className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-blue-500" />
            Section C — Hypothetical Entries
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(v => !v); }}>
            <Plus className="w-3 h-3" />Add Entry
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="border rounded-lg p-3 space-y-2.5 bg-muted/20">
            <div className="flex gap-2">
              {['inflow', 'outflow'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`text-xs px-3 py-1 rounded-full border font-medium ${form.type === t ? (t === 'inflow' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-red-500 text-white border-red-500') : 'border-border text-muted-foreground'}`}>
                  {t === 'inflow' ? '↑ Inflow' : '↓ Outflow'}
                </button>
              ))}
            </div>
            <Input placeholder="Label (e.g. GST refund, Advance payment)" className="h-7 text-xs"
              value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            <Input type="number" placeholder="Total amount" className="h-7 text-xs"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value, tranches: [{ amount: e.target.value, date: f.tranches[0]?.date || toDateStr(new Date()) }] }))} />
            <Input placeholder="Category (optional)" className="h-7 text-xs"
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            {form.amount && (
              <SplitBuilder
                totalAmount={Number(form.amount) || 0}
                tranches={form.tranches}
                onChange={t => setForm(f => ({ ...f, tranches: t }))}
                originalDate={toDateStr(new Date())}
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={saveEntry}>{editId ? 'Update' : 'Save Entry'}</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        {hypotheticals.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground py-2 text-center">No hypothetical entries yet. Add one-off inflows or outflows to model scenarios.</p>
        )}

        <div className="space-y-2">
          {hypotheticals.map(h => (
            <div key={h.id} className={`border-2 border-dashed rounded-lg p-2.5 ${h.type === 'inflow' ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${h.type === 'inflow' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                      {h.type === 'inflow' ? 'INFLOW' : 'OUTFLOW'}
                    </span>
                    <span className="text-xs font-medium">{h.label}</span>
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">sim</span>
                  </div>
                  <p className="text-xs font-bold mt-0.5">{INR(h.amount)}</p>
                  {h.tranches.map((t, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground">{INR(t.amount)} on {t.date}</p>
                  ))}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editEntry(h)}><Edit2 className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteEntry(h.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}