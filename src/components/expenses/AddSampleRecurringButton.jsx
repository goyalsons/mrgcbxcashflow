import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const SAMPLE_RECURRING = [
  { description: 'Office Rent', category: 'rent', amount: 85000, payment_mode: 'bank_transfer', recurrence_type: 'monthly' },
  { description: 'Electricity Bill', category: 'utilities', amount: 12000, payment_mode: 'upi', recurrence_type: 'monthly' },
  { description: 'Internet & Broadband', category: 'utilities', amount: 3500, payment_mode: 'bank_transfer', recurrence_type: 'monthly' },
  { description: 'Tally ERP / Accounting Software', category: 'software', amount: 18000, payment_mode: 'bank_transfer', recurrence_type: 'monthly' },
  { description: 'Staff Salary', category: 'salary', amount: 250000, payment_mode: 'bank_transfer', recurrence_type: 'monthly' },
  { description: 'GST Filing Consultant', category: 'miscellaneous', amount: 5000, payment_mode: 'bank_transfer', recurrence_type: 'quarterly' },
  { description: 'Security Guard Charges', category: 'maintenance', amount: 8000, payment_mode: 'bank_transfer', recurrence_type: 'monthly' },
  { description: 'Housekeeping / Cleaning Services', category: 'maintenance', amount: 5000, payment_mode: 'cash', recurrence_type: 'monthly' },
  { description: 'Domain & Hosting Renewal', category: 'software', amount: 12000, payment_mode: 'credit_card', recurrence_type: 'monthly' },
  { description: 'Mobile & Telephone Bills', category: 'utilities', amount: 4000, payment_mode: 'upi', recurrence_type: 'monthly' },
];

const STORAGE_KEY = 'cashflow_pro_sample_recurring_added';

export default function AddSampleRecurringButton({ existingTemplates = [], onAdded, currentUser }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const alreadyAdded = localStorage.getItem(STORAGE_KEY) === 'true';

  const handleAdd = async () => {
    if (alreadyAdded) {
      toast({ title: 'Already added', description: 'Sample recurring expenses have already been added.' });
      return;
    }

    const existingDescriptions = new Set(existingTemplates.map(e => e.description?.trim().toLowerCase()));
    const toAdd = SAMPLE_RECURRING.filter(s => !existingDescriptions.has(s.description.trim().toLowerCase()));

    if (toAdd.length === 0) {
      localStorage.setItem(STORAGE_KEY, 'true');
      toast({ title: 'No new samples to add', description: 'All sample recurring templates already exist.' });
      return;
    }

    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    await base44.entities.Expense.bulkCreate(toAdd.map(e => ({
      ...e,
      expense_date: today,
      recurrence_start_date: today,
      approval_status: 'not_required',
      submitted_by: currentUser?.email || '',
      submitted_by_name: currentUser?.full_name || '',
    })));
    localStorage.setItem(STORAGE_KEY, 'true');
    toast({ title: `${toAdd.length} sample recurring expenses added!` });
    setLoading(false);
    onAdded?.();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleAdd}
      disabled={loading || alreadyAdded}
      title={alreadyAdded ? 'Sample recurring expenses already added' : 'Add typical Indian recurring expenses'}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {alreadyAdded ? 'Samples Added' : 'Add Sample Recurring'}
    </Button>
  );
}