import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, AlertTriangle, CheckCircle, Clock, XCircle, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import ApprovalActionDialog from '@/components/expenses/ApprovalActionDialog';

const CATEGORY_LABELS = {
  travel: 'Travel', office_supplies: 'Office Supplies', meals: 'Meals',
  utilities: 'Utilities', rent: 'Rent', salary: 'Salary',
  marketing: 'Marketing', software: 'Software', maintenance: 'Maintenance',
  miscellaneous: 'Miscellaneous',
};

function loadApprovalThreshold() {
  try {
    const s = JSON.parse(localStorage.getItem('cashflow_pro_settings') || '{}');
    return Number(s.approvalThreshold) || 0;
  } catch { return 0; }
}

function ApprovalStatusBadge({ status }) {
  if (!status || status === 'not_required') return null;
  const config = {
    pending: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-800 border-amber-200', Icon: Clock },
    approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', Icon: CheckCircle },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200', Icon: XCircle },
  };
  const c = config[status];
  if (!c) return null;
  return (
    <Badge className={`${c.className} gap-1 text-xs`}>
      <c.Icon className="w-3 h-3" />{c.label}
    </Badge>
  );
}

export default function Expenses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [reviewExpense, setReviewExpense] = useState(null);
  const [processing, setProcessing] = useState(false);

  const approvalThreshold = loadApprovalThreshold();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-expense_date'),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = currentUser?.role === 'admin';

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
      const amount = Number(form.amount) || 0;
      const needsApproval = approvalThreshold > 0 && amount > approvalThreshold;
      const data = {
        ...form,
        approval_status: needsApproval ? 'pending' : 'not_required',
        submitted_by: currentUser?.email || '',
        submitted_by_name: currentUser?.full_name || '',
      };
      await createMut.mutateAsync(data);
      toast({ title: needsApproval ? 'Submitted for approval' : 'Expense recorded' });
    }
  };

  const handleApprove = async (expense) => {
    setProcessing(true);
    await updateMut.mutateAsync({
      id: expense.id,
      data: {
        approval_status: 'approved',
        approved_by: currentUser?.email,
        approved_by_name: currentUser?.full_name,
        approved_at: new Date().toISOString(),
      },
    });
    setReviewExpense(null);
    setProcessing(false);
    toast({ title: 'Expense approved' });
  };

  const handleReject = async (expense, reason) => {
    setProcessing(true);
    await updateMut.mutateAsync({
      id: expense.id,
      data: {
        approval_status: 'rejected',
        approved_by: currentUser?.email,
        approved_by_name: currentUser?.full_name,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      },
    });
    setReviewExpense(null);
    setProcessing(false);
    toast({ title: 'Expense rejected' });
  };

  const filtered = useMemo(() =>
    expenses
      .filter(e =>
        e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.category?.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)),
    [expenses, search]
  );

  const pending = filtered.filter(e => e.approval_status === 'pending');
  const approved = filtered.filter(e => e.approval_status === 'approved' || e.approval_status === 'not_required');
  const rejected = filtered.filter(e => e.approval_status === 'rejected');

  const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingCount = expenses.filter(e => e.approval_status === 'pending').length;

  const ExpenseRow = ({ expense }) => (
    <TableRow>
      <TableCell>
        <div className="font-medium text-sm">{expense.description}</div>
        <div className="text-xs text-muted-foreground">{formatDateIN(expense.expense_date)}</div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize">{CATEGORY_LABELS[expense.category] || expense.category}</Badge>
      </TableCell>
      <TableCell className="font-semibold">{formatINR(expense.amount)}</TableCell>
      <TableCell className="capitalize text-sm text-muted-foreground">{expense.payment_mode?.replace('_', ' ') || '—'}</TableCell>
      <TableCell>
        <ApprovalStatusBadge status={expense.approval_status} />
        {(!expense.approval_status || expense.approval_status === 'not_required') && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {isAdmin && expense.approval_status === 'pending' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setReviewExpense(expense)}>
              <AlertTriangle className="w-3 h-3 text-amber-500" /> Review
            </Button>
          )}
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
        </div>
      </TableCell>
    </TableRow>
  );

  const ExpenseTable = ({ list }) => (
    list.length === 0 ? (
      <div className="text-center py-10 text-muted-foreground text-sm">No expenses found.</div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment Mode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(e => <ExpenseRow key={e.id} expense={e} />)}
        </TableBody>
      </Table>
    )
  );

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

      {isAdmin && pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 flex-1">
            <strong>{pendingCount} expense{pendingCount > 1 ? 's' : ''}</strong> pending your approval.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-bold mt-1">{formatINR(totalAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-xl font-bold mt-1">{formatINR(
            expenses.filter(e => {
              const d = new Date(e.expense_date);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).reduce((s, e) => s + (e.amount || 0), 0)
          )}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending Approval</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-xl font-bold mt-1">{expenses.length}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending {pendingCount > 0 && <Badge className="bg-amber-500 text-white text-xs h-4 px-1">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card><CardContent className="p-0"><ExpenseTable list={filtered} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <Card><CardContent className="p-0"><ExpenseTable list={pending} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <Card><CardContent className="p-0"><ExpenseTable list={approved} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <Card><CardContent className="p-0"><ExpenseTable list={rejected} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <ExpenseForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditData(null); }}
        onSave={handleSave}
        editData={editData}
        approvalThreshold={approvalThreshold}
      />

      <ApprovalActionDialog
        open={!!reviewExpense}
        expense={reviewExpense}
        onClose={() => setReviewExpense(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        processing={processing}
      />
    </div>
  );
}