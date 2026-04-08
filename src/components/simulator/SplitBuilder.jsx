import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

const INR = (v) => `₹${Math.round(Math.abs(v || 0)).toLocaleString('en-IN')}`;

export default function SplitBuilder({ totalAmount, tranches, onChange, originalDate, mode = 'prepone' }) {
  const today = new Date().toISOString().split('T')[0];
  const allocated = tranches.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const remainder = Math.max(0, totalAmount - allocated);
  const overAllocated = allocated > totalAmount + 1;
  const hasPastDate = (date) => date && date < today;

  const addTranche = () => {
    if (tranches.length >= 10) return;
    onChange([...tranches, { amount: '', date: originalDate }]);
  };

  const updateTranche = (i, field, value) => {
    const updated = tranches.map((t, idx) => idx === i ? { ...t, [field]: value } : t);
    onChange(updated);
  };

  const removeTranche = (i) => {
    if (tranches.length === 1) return;
    onChange(tranches.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      {tranches.map((t, i) => (
        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex flex-col w-full sm:w-auto">
          <Input
            type="number"
            placeholder="Amount"
            value={t.amount}
            onChange={e => updateTranche(i, 'amount', e.target.value)}
            className={`h-7 text-xs sm:w-32 ${Number(t.amount) === 0 && t.amount !== '' ? 'border-red-400' : ''}`}
            min={1}
          />
          {Number(t.amount) === 0 && t.amount !== '' && <p className="text-[10px] text-red-600">Amount must be &gt; ₹0</p>}
          </div>
          <div className="flex flex-col w-full sm:flex-1">
          <Input
            type="date"
            value={t.date}
            onChange={e => updateTranche(i, 'date', e.target.value)}
            className="h-7 text-xs"
          />
          {mode === 'prepone' && hasPastDate(t.date) && <p className="text-[10px] text-amber-600">This date has already passed — are you sure?</p>}
          {mode === 'defer' && t.date < today && <p className="text-[10px] text-amber-600">You're setting a payment date in the past.</p>}
          </div>
          {tranches.length > 1 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTranche(i)}>
              <Trash2 className="w-3 h-3 text-red-500" />
            </Button>
          )}
        </div>
      ))}

      {/* Remainder */}
      {remainder > 0 && (
        <div className="flex items-center gap-2 opacity-50 text-xs pl-1">
          <span className="w-32 text-muted-foreground">Remainder: {INR(remainder)}</span>
          <span className="text-muted-foreground">stays on {originalDate}</span>
        </div>
      )}

      {/* Allocation counter */}
      <div className={`text-xs font-medium ${overAllocated ? 'text-red-600' : allocated >= totalAmount ? 'text-emerald-600' : 'text-amber-600'}`}>
        Allocated: {INR(allocated)} of {INR(totalAmount)}
        {overAllocated && ' — over-allocated! Reduce amounts before saving.'}
      </div>

      {tranches.length < 10 && (
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={addTranche}>
          <Plus className="w-3 h-3" />Add split
        </Button>
      )}
    </div>
  );
}