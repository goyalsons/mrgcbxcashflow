import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Pencil, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import ExpenseForm from '@/components/expenses/ExpenseForm';

const CATEGORY_LABELS = {
  travel: 'Travel', office_supplies: 'Office Supplies', meals: 'Meals',
  utilities: 'Utilities', rent: 'Rent', salary: 'Salary',
  marketing: 'Marketing', software: 'Software', maintenance: 'Maintenance',
  miscellaneous: 'Miscellaneous',
};

function getISOWeekLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  return `W${wn} '${String(d.getFullYear()).slice(2)}`;
}
function getMonthLabel(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function Expenses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterWeek, setFilterWeek] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-expense_date'),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); setEditData(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const handleSave = async (form) => {
    if (editData) {
      await updateMut.mutateAsync({ id: editData.id, data: form });
      toast({ title: 'Expense updated' });
    } else {
      await createMut.mutateAsync({
        ...form,
        submitted_by: currentUser?.email || '',
        submitted_by_name: currentUser?.full_name || '',
      });
      toast({ title: 'Expense recorded' });
    }
  };

  const weekOptions = useMemo(() => {
    const s = new Set();
    expenses.forEach(e => { const w = getISOWeekLabel(e.expense_date); if (w) s.add(w); });
    return [...s].sort();
  }, [expenses]);

  const monthOptions = useMemo(() => {
    const s = new Set();
    expenses.forEach(e => { const m = getMonthLabel(e.expense_date); if (m) s.add(m); });
    return [...s];
  }, [expenses]);

  const filtered = useMemo(() =>
    expenses
      .filter(e => {
        const matchSearch = !search ||
          e.description?.toLowerCase().includes(search.toLowerCase()) ||
          e.category?.toLowerCase().includes(search.toLowerCase());
        const matchWeek = filterWeek === 'all' || getISOWeekLabel(e.expense_date) === filterWeek;
        const matchMonth = filterMonth === 'all' || getMonthLabel(e.expense_date) === filterMonth;
        const matchCategory = filterCategory === 'all' || e.category === filterCategory;
        return matchSearch && matchWeek && matchMonth && matchCategory;
      })
      .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)),
    [expenses, search, filterWeek, filterMonth, filterCategory]
  );

  const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const thisMonthAmount = expenses.filter(e => {
    const d = new Date(e.expense_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track and manage business expenses"
        actionLabel="Add Expense"
        onAction={() => { setEditData(null); setShowForm(true); }}
      >
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/csv-import?type=expense')}>
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-bold mt-1">{formatINR(totalAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-xl font-bold mt-1">{formatINR(thisMonthAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-xl font-bold mt-1">{expenses.length}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterWeek} onValueChange={setFilterWeek}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Week" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Weeks</SelectItem>
            {weekOptions.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No expenses found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium text-sm">{expense.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{CATEGORY_LABELS[expense.category] || expense.category}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{formatINR(expense.amount)}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{expense.payment_mode?.replace('_', ' ') || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateIN(expense.expense_date)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditData(expense); setShowForm(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete this expense?')) deleteMut.mutate(expense.id); }}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExpenseForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditData(null); }}
        onSave={handleSave}
        editData={editData}
      />
    </div>
  );
}