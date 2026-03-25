import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, X } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, format } from 'date-fns';

const PRESETS = [
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Custom', value: 'custom' },
];

function getPresetRange(preset) {
  const now = new Date();
  switch (preset) {
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month': {
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }
    case 'this_quarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'this_year':
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return null;
  }
}

export { getPresetRange };

export default function DateRangePicker({ value, onChange }) {
  const [preset, setPreset] = useState(value?.preset || 'this_month');
  const [customFrom, setCustomFrom] = useState(value?.from ? format(value.from, 'yyyy-MM-dd') : '');
  const [customTo, setCustomTo] = useState(value?.to ? format(value.to, 'yyyy-MM-dd') : '');

  const handlePresetChange = (p) => {
    setPreset(p);
    if (p !== 'custom') {
      const range = getPresetRange(p);
      onChange({ preset: p, ...range });
    }
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({ preset: 'custom', from: new Date(customFrom), to: new Date(customTo) });
    }
  };

  const handleClear = () => {
    setPreset('this_month');
    const range = getPresetRange('this_month');
    onChange({ preset: 'this_month', ...range });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="w-4 h-4" />
        <span className="font-medium">Period:</span>
      </div>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-40 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <>
          <Input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="w-36 h-8 text-sm"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="w-36 h-8 text-sm"
          />
          <Button size="sm" className="h-8 text-xs" onClick={handleCustomApply}>Apply</Button>
        </>
      )}

      {value?.from && value?.to && preset !== 'custom' && (
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
          {format(value.from, 'd MMM')} – {format(value.to, 'd MMM yyyy')}
        </span>
      )}
    </div>
  );
}