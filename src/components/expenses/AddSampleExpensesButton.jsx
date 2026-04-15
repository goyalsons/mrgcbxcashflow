import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const SAMPLE_EXPENSES = [
  { description: 'Office Rent - Mumbai', category: 'rent', amount: 85000, payment_mode: 'bank_transfer' },
  { description: 'Electricity Bill', category: 'utilities', amount: 12000, payment_mode: 'upi' },
  { description: 'Internet & Broadband', category: 'utilities', amount: 3500, payment_mode: 'bank_transfer' },
  { description: 'Staff Canteen & Meals', category: 'meals', amount: 8000, payment_mode: 'cash' },
  { description: 'GST Consultant Fees', category: 'miscellaneous', amount: 15000, payment_mode: 'bank_transfer' },
  { description: 'Office Stationery & Supplies', category: 'office_supplies', amount: 4500, payment_mode: 'cash' },
  { description: 'Tally ERP License', category: 'software', amount: 18000, payment_mode: 'bank_transfer' },
  { description: 'Local Travel - Auto/Cab', category: 'travel', amount: 6000, payment_mode: 'upi' },
  { description: 'Air Travel - Client Meeting', category: 'travel', amount: 24000, payment_mode: 'credit_card' },
  { description: 'Marketing & Advertising', category: 'marketing', amount: 30000, payment_mode: 'bank_transfer' },
  { description: 'Office Maintenance & Repairs', category: 'maintenance', amount: 9000, payment_mode: 'cash' },
  { description: 'Drinking Water Supply', category: 'miscellaneous', amount: 1200, payment_mode: 'cash' },
  { description: 'Printing & Courier Charges', category: 'office_supplies', amount: 2800, payment_mode: 'cash' },
  { description: 'Team Lunch / Client Entertainment', category: 'meals', amount: 11000, payment_mode: 'credit_card' },
  { description: 'Postage & Stamps', category: 'miscellaneous', amount: 500, payment_mode: 'cash' },
];

const STORAGE_KEY = 'cashflow_pro_sample_expenses_added';

export default function AddSampleExpensesButton({ existingExpenses = [], onAdded, currentUser }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const alreadyAdded = localStorage.getItem(STORAGE_KEY) === 'true';

  const handleAdd = async () => {
    if (alreadyAdded) {
      toast({ title: 'Already added', description: 'Sample expenses have already been added to this app.' });
      return;
    }

    const existingDescriptions = new Set(existingExpenses.map(e => e.description?.trim().toLowerCase()));
    const toAdd = SAMPLE_EXPENSES.filter(s => !existingDescriptions.has(s.description.trim().toLowerCase()));

    if (toAdd.length === 0) {
      localStorage.setItem(STORAGE_KEY, 'true');
      toast({ title: 'No new samples to add', description: 'All sample expenses already exist.' });
      return;
    }

    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    await base44.entities.Expense.bulkCreate(toAdd.map(e => ({
      ...e,
      expense_date: today,
      approval_status: 'not_required',
      submitted_by: currentUser?.email || '',
      submitted_by_name: currentUser?.full_name || '',
    })));
    localStorage.setItem(STORAGE_KEY, 'true');
    toast({ title: `${toAdd.length} sample expenses added!` });
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
      title={alreadyAdded ? 'Sample expenses already added' : 'Add typical Indian business expenses'}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {alreadyAdded ? 'Samples Added' : 'Add Sample Expenses'}
    </Button>
  );
}