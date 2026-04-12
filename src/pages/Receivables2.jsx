import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Phone, Mail, Edit, Target, Bell, Trash2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { format, parseISO } from 'date-fns';

export default function Receivables2() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const result = await base44.entities.Invoice.list('-created_date', 100);
      return result;
    },
  });

  const { data: debtors = [] } = useQuery({
    queryKey: ['debtors'],
    queryFn: async () => {
      const result = await base44.entities.Debtor.list('-created_date', 100);
      return result;
    },
  });

  const getDebtorInfo = (debtorId) => {
    return debtors.find(d => d.id === debtorId);
  };

  const getWeekNumber = (date) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    } catch {
      return '-';
    }
  };

  const filteredData = useMemo(() => {
    let result = invoices;

    if (searchTerm) {
      result = result.filter(inv =>
        inv.debtor_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(inv => inv.status === statusFilter);
    }

    return result;
  }, [invoices, searchTerm, statusFilter]);

  const handleCall = (phone) => {
    if (phone) window.open(`tel:${phone}`);
  };

  const handleEmail = (email) => {
    if (email) window.open(`mailto:${email}`);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      await base44.entities.Invoice.delete(id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Receivables 2" subtitle="Manage and track outstanding invoices" />
        <div className="mt-8 flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Receivables 2" subtitle="Manage and track outstanding invoices" />

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Search by company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="written_off">Written Off</option>
          </select>
        </div>
      </Card>

      {filteredData.length === 0 ? (
        <EmptyState
          icon="FileText"
          title="No receivables found"
          description="Create invoices to see them here"
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Co. Name</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Credit Balance</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Due Week</TableHead>
                <TableHead>Due Month</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((invoice) => {
                const debtor = getDebtorInfo(invoice.debtor_id);
                const outstanding = invoice.amount - (invoice.amount_paid || 0);
                const dueDate = invoice.due_date ? parseISO(invoice.due_date) : null;

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <div>{invoice.debtor_name}</div>
                      {debtor?.contact_person && (
                        <div className="text-xs text-muted-foreground">{debtor.contact_person}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{outstanding.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      {dueDate ? format(dueDate, 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{(debtor?.credit_limit || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {debtor?.assigned_manager ? debtor.assigned_manager.split('@')[0] : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {dueDate ? `W${getWeekNumber(dueDate)}` : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {dueDate ? format(dueDate, 'MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600"
                          title="Call"
                          onClick={() => handleCall(debtor?.phone)}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-orange-600"
                          title="Email"
                          onClick={() => handleEmail(debtor?.email)}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-purple-600"
                          title="Set Target"
                        >
                          <Target className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600"
                          title="Send Reminder"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600"
                          title="Delete"
                          onClick={() => handleDelete(invoice.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}