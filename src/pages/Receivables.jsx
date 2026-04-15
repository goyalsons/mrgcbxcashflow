/**
 * Receivables.jsx
 * © 2025 CEOITBOX Tech Services LLP. All rights reserved.
 * https://www.ceoitbox.com
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Edit, Target, Trash2, CalendarClock, MessageSquare, Phone, Building2, Search, SlidersHorizontal, IndianRupee, Users, ArrowUpDown } from 'lucide-react';
import AttachmentCell from '@/components/receivables/AttachmentCell';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import EditInvoiceModal from '@/components/receivables/EditInvoiceModal';
import ScheduleRemindersModal from '@/components/receivables/ScheduleRemindersModal';
import QuickReminderModal from '@/components/debtors/QuickReminderModal';
import QuickBulkReminderModal from '@/components/debtors/QuickBulkReminderModal';
import SetTargetModal from '@/components/debtors/SetTargetModal';
import AddCustomerInfoPopover from '@/components/receivables/AddCustomerInfoPopover';
import { isSalesTeam } from '@/lib/utils/roles';

export default function Receivables() {
  const [searchTerm, setSearchTerm] = useState('');
  const [minAmount, setMinAmount] = useState(() => localStorage.getItem('receivables_minAmount') || '');
  const [filters, setFilters] = useState({
    company: '',
    dueWeek: '',
    dueMonth: '',
    manager: '',
  });
  const [groupBy, setGroupBy] = useState('company');
  const [selected, setSelected] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState('delete');
  const [assigningManager, setAssigningManager] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [reminderCustomer, setReminderCustomer] = useState(null);
  const [targetCustomer, setTargetCustomer] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showBulkReminder, setShowBulkReminder] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (minAmount) localStorage.setItem('receivables_minAmount', minAmount);
    else localStorage.removeItem('receivables_minAmount');
  }, [minAmount]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      return await base44.entities.Receivable.list('-created_date');
    },
  });



  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: scheduledReminders = [] } = useQuery({
    queryKey: ['scheduledReminders'],
    queryFn: () => base44.entities.ScheduledReminder.list('-scheduled_send_date', 500),
  });

  // Build a map: customerId -> { nextPending, lastSent }
  const reminderInfoByCustomer = useMemo(() => {
    const map = {};
    scheduledReminders.forEach(r => {
      if (!r.customer_id) return;
      if (!map[r.customer_id]) map[r.customer_id] = { nextPending: null, lastSent: null };
      if (r.status === 'pending' && r.scheduled_send_date) {
        if (!map[r.customer_id].nextPending || r.scheduled_send_date < map[r.customer_id].nextPending) {
          map[r.customer_id].nextPending = r.scheduled_send_date;
        }
      }
      if (r.status === 'sent' && r.sent_date) {
        if (!map[r.customer_id].lastSent || r.sent_date > map[r.customer_id].lastSent) {
          map[r.customer_id].lastSent = r.sent_date;
        }
      }
    });
    return map;
  }, [scheduledReminders]);

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Receivable.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const updateInvoiceMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Receivable.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const getCustomerInfo = (customerName) => {
    if (!customerName) return {};
    return customers.find(c => c.name?.toLowerCase() === customerName?.toLowerCase()) || {};
  };

  const getResolvedManager = (invoice) => {
    const customer = getCustomerInfo(invoice.customer_name);
    return customer?.account_manager || '';
  };

  const getWeekNumber = (date) => {
    if (!date) return -1;
    try {
      const d = new Date(date);
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    } catch {
      return -1;
    }
  };

  const getMonthKey = (date) => {
    if (!date) return '';
    try {
      const d = parseISO(date);
      return format(d, 'yyyy-MM');
    } catch {
      return '';
    }
  };

  const filteredData = useMemo(() => {
    let result = invoices;

    // Account Managers (sales_team) only see their assigned customers
    if (isSalesTeam(currentUser?.role) && currentUser?.email) {
      const myCustomerNames = new Set(
        customers
          .filter(c => c.account_manager === currentUser.email)
          .map(c => c.name?.toLowerCase())
      );
      result = result.filter(inv => myCustomerNames.has(inv.customer_name?.toLowerCase()));
    }

    if (searchTerm) {
      result = result.filter(inv =>
        inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.company) {
      result = result.filter(inv => inv.customer_name === filters.company);
    }

    if (filters.dueWeek) {
      result = result.filter(inv => getWeekNumber(inv.due_date) === parseInt(filters.dueWeek));
    }

    if (filters.dueMonth) {
      result = result.filter(inv => getMonthKey(inv.due_date) === filters.dueMonth);
      }

      if (filters.manager) {
      result = result.filter(inv => getResolvedManager(inv) === filters.manager);
      }

      if (minAmount) {
        const minVal = parseInt(minAmount) || 0;
        result = result.filter(inv => {
          const outstanding = inv.amount - (inv.amount_paid || 0);
          return outstanding > minVal;
        });
      }

      return result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [invoices, searchTerm, filters, minAmount]);

  const uniqueCompanies = useMemo(() => {
    return [...new Set(invoices.map(inv => inv.customer_name))].sort();
  }, [invoices]);

  const uniqueWeeks = useMemo(() => {
    const weeks = new Set();
    filteredData.forEach(inv => {
      const week = getWeekNumber(inv.due_date);
      if (week > 0) weeks.add(week);
    });
    return Array.from(weeks).sort((a, b) => a - b);
  }, [filteredData]);

  const uniqueMonths = useMemo(() => {
    const months = new Set();
    filteredData.forEach(inv => {
      const month = getMonthKey(inv.due_date);
      if (month) months.add(month);
    });
    return Array.from(months).sort().reverse();
  }, [filteredData]);

  const uniqueManagers = useMemo(() => {
    const managers = new Set();
    invoices.forEach(inv => {
      const m = getResolvedManager(inv);
      if (m) managers.add(m);
    });
    return Array.from(managers).sort();
  }, [invoices, customers]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', items: filteredData }];
    }

    const groups = {};
    filteredData.forEach(inv => {
      let key = '';
      let label = '';

      if (groupBy === 'company') {
        key = inv.customer_name;
        label = inv.customer_name;
      } else if (groupBy === 'week') {
        key = `W${getWeekNumber(inv.due_date)}`;
        label = `Week ${getWeekNumber(inv.due_date)}`;
      } else if (groupBy === 'month') {
        key = getMonthKey(inv.due_date);
        label = key ? format(parseISO(key + '-01'), 'MMMM yyyy') : 'Unknown';
      } else if (groupBy === 'manager') {
        const mgr = getResolvedManager(inv);
        key = mgr || 'unassigned';
        label = mgr ? mgr.split('@')[0] : 'Unassigned';
      }

      if (!groups[key]) {
        groups[key] = { key, label, items: [] };
      }
      groups[key].items.push(inv);
    });

    return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredData, groupBy]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortItems = (items) => {
    if (!sortConfig.key) return items;
    return [...items].sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === 'company') {
        aVal = a.customer_name?.toLowerCase() || '';
        bVal = b.customer_name?.toLowerCase() || '';
      } else if (sortConfig.key === 'outstanding') {
        aVal = (a.amount - (a.amount_paid || 0));
        bVal = (b.amount - (b.amount_paid || 0));
      } else if (sortConfig.key === 'due_date') {
        aVal = new Date(a.due_date || '');
        bVal = new Date(b.due_date || '');
      } else if (sortConfig.key === 'status') {
        aVal = a.status || '';
        bVal = b.status || '';
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortableHead = ({ label, sortKey }) => (
    <TableHead 
      className="px-3 text-xs font-semibold cursor-pointer hover:bg-muted/50"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortConfig.key === sortKey && <ArrowUpDown className="w-3 h-3" />}
      </div>
    </TableHead>
  );

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => base44.entities.Receivable.delete(id)));
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: `Deleted ${selected.size} invoice(s)` });
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
      setShowBulkModal(false);
    }
  };

  const handleBulkAssignManager = async () => {
    if (!assigningManager) return;
    setBulkLoading(true);
    const mgr = users.find(u => u.email === assigningManager);
    const mgrName = mgr ? mgr.full_name : assigningManager;
    try {
      // Deduplicate by customer id to avoid redundant updates
      const customerUpdates = new Map();
      [...selected].forEach(id => {
        const inv = invoices.find(i => i.id === id);
        const customer = getCustomerInfo(inv?.customer_name);
        if (customer?.id) {
          customerUpdates.set(customer.id, customer);
        }
      });
      await Promise.all([...customerUpdates.values()].map(customer =>
        base44.entities.Customer.update(customer.id, {
          account_manager: assigningManager.toLowerCase(),
          account_manager_name: mgrName,
        })
      ));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: `Assigned manager to ${customerUpdates.size} customer(s)` });
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
      setShowBulkModal(false);
      setAssigningManager('');
    }
  };

  const handleBulkReminder = async () => {
    const selectedInvoices = [...selected]
      .map(id => invoices.find(i => i.id === id))
      .filter(Boolean);
    setShowBulkReminder(true);
    setShowBulkModal(false);
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalOutstanding = useMemo(() => {
    return filteredData.reduce((sum, inv) => sum + (inv.amount - (inv.amount_paid || 0)), 0);
  }, [filteredData]);

  const statusColors = {
    overdue: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    partially_paid: 'bg-blue-50 text-blue-700 border-blue-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    written_off: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Receivables" subtitle="Manage and track outstanding invoices" />
        <div className="mt-8 flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading invoices...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Receivables" subtitle="Manage and track outstanding invoices" />

      {/* Filters */}
      <Card className="p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <select
            value={filters.company}
            onChange={(e) => setFilters({ ...filters, company: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:ring-1 focus:ring-ring"
          >
            <option value="">All Companies</option>
            {uniqueCompanies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filters.dueWeek}
            onChange={(e) => setFilters({ ...filters, dueWeek: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:ring-1 focus:ring-ring"
          >
            <option value="">All Weeks</option>
            {uniqueWeeks.map(w => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
          <select
            value={filters.dueMonth}
            onChange={(e) => setFilters({ ...filters, dueMonth: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:ring-1 focus:ring-ring"
          >
            <option value="">All Months</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMM yyyy')}</option>
            ))}
          </select>
          <select
            value={filters.manager}
            onChange={(e) => setFilters({ ...filters, manager: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:ring-1 focus:ring-ring"
          >
            <option value="">All Managers</option>
            {uniqueManagers.map(m => (
              <option key={m} value={m}>{m.split('@')[0]}</option>
            ))}
          </select>
          <div className="relative">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Min outstanding amount"
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          </div>

        <div className="flex gap-2 items-center flex-wrap pt-1 border-t">
          <span className="text-xs font-medium text-muted-foreground">Group by:</span>
          {['none', 'company', 'week', 'month', 'manager'].map(option => (
            <Button
              key={option}
              size="sm"
              variant={groupBy === option ? 'default' : 'ghost'}
              onClick={() => setGroupBy(option)}
              className="text-xs h-7 px-2.5"
            >
              {option === 'none' ? 'None' : option.charAt(0).toUpperCase() + option.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Total Outstanding Card */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Outstanding</p>
              <p className="text-2xl font-bold text-primary">₹{totalOutstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{filteredData.length}</p>
            <p className="text-xs text-muted-foreground">invoice{filteredData.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-primary">{selected.size} invoice{selected.size > 1 ? 's' : ''} selected</span>
          {selected.size < filteredData.length && (
            <button onClick={() => setSelected(new Set(filteredData.map(inv => inv.id)))} className="text-xs text-primary underline hover:text-primary/80">
              Select all {filteredData.length}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            {(() => {
              const selectedInvs = [...selected].map(id => invoices.find(i => i.id === id)).filter(Boolean);
              const anyNoContact = selectedInvs.some(inv => {
                const c = getCustomerInfo(inv.customer_name);
                return !(c?.email || c?.phone || c?.contact_person);
              });
              return (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={anyNoContact} title={anyNoContact ? 'Some selected companies have no contact info' : ''} onClick={() => setShowScheduleModal(true)}>
                    <CalendarClock className="w-3.5 h-3.5" /> Schedule Reminders
                  </Button>
                  <Button size="sm" variant="outline" disabled={anyNoContact} title={anyNoContact ? 'Some selected companies have no contact info' : ''} onClick={handleBulkReminder}>Send Quick Reminder</Button>
                </>
              );
            })()}
            <Button size="sm" variant="outline" onClick={() => { setBulkAction('manager'); setShowBulkModal(true); }}>Assign Manager</Button>

            <Button size="sm" variant="destructive" onClick={() => { setBulkAction('delete'); setShowBulkModal(true); }}>Delete</Button>
          </div>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-destructive underline">Clear</button>
        </div>
      )}

      {filteredData.length === 0 ? (
        <EmptyState
          icon="FileText"
          title="No receivables found"
          description="Adjust your filters or create invoices"
        />
      ) : (
        groupedData.map(group => (
          <div key={group.key} className="space-y-2">
            {groupBy !== 'none' && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-muted/80 to-muted/30 rounded-lg border">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {group.label}
                  <span className="text-xs text-muted-foreground font-normal">({group.items.length} invoice{group.items.length !== 1 ? 's' : ''})</span>
                </h3>
                <span className="text-sm font-bold text-primary">₹{group.items.reduce((sum, inv) => sum + (inv.amount - (inv.amount_paid || 0)), 0).toLocaleString('en-IN')}</span>
              </div>
            )}
            <Card className="overflow-hidden shadow-sm border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="w-8 px-3">
                      <Checkbox
                        checked={group.items.length > 0 && group.items.every(inv => selected.has(inv.id))}
                        onCheckedChange={() => {
                          const groupIds = new Set(group.items.map(inv => inv.id));
                          const allSelected = group.items.every(inv => selected.has(inv.id));
                          setSelected(prev => {
                            const next = new Set(prev);
                            if (allSelected) { groupIds.forEach(id => next.delete(id)); }
                            else { groupIds.forEach(id => next.add(id)); }
                            return next;
                          });
                        }}
                      />
                    </TableHead>
                    <SortableHead label="Company" sortKey="company" />
                      <TableHead className="px-3 text-xs font-semibold">Ref. No.</TableHead>
                      <SortableHead label="Outstanding" sortKey="outstanding" />
                      <SortableHead label="Status" sortKey="status" />
                      <SortableHead label="Due Date" sortKey="due_date" />
                      <TableHead className="px-3 text-xs font-semibold">Days Overdue</TableHead>
                      <TableHead className="px-3 text-xs font-semibold">Attachments</TableHead>
                      <TableHead className="px-3 text-xs font-semibold text-right">Credit Limit</TableHead>
                      <TableHead className="px-3 text-xs font-semibold">Manager</TableHead>
                      <TableHead className="px-3 text-xs font-semibold">Week</TableHead>
                      <TableHead className="px-3 text-xs font-semibold">Month</TableHead>
                      <TableHead className="px-3 text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {sortItems(group.items).map((invoice) => {
                    const outstanding = invoice.amount - (invoice.amount_paid || 0);
                    const dueDate = invoice.due_date ? parseISO(invoice.due_date) : null;
                    const _customer = getCustomerInfo(invoice.customer_name);
                    const hasContactInfo = !!(_customer?.email || _customer?.phone || _customer?.contact_person);
                    const reminderInfo = reminderInfoByCustomer[_customer?.id] || null;
                    const rowBg = !hasContactInfo
                      ? 'bg-gray-100 opacity-80'
                      : invoice.status === 'overdue' ? 'bg-red-50/30' : '';

                    return (
                      <TableRow key={invoice.id} className={`hover:bg-muted/30 transition-colors ${rowBg}`}>
                        <TableCell className="px-3" onClick={e => e.stopPropagation()}>
                          {groupBy === 'none' ? (
                            <Checkbox checked={selected.has(invoice.id)} onCheckedChange={() => toggleOne(invoice.id)} />
                          ) : null}
                        </TableCell>
                        <TableCell className="px-3 font-medium">
                          {(() => {
                                     const customer = getCustomerInfo(invoice.customer_name);
                                     const phone = customer.phone || '';
                                     const email = customer.email || '';
                                     const contactPerson = customer.contact_person || '';
                                     const rInfo = reminderInfoByCustomer[customer?.id];
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <span className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-primary transition-colors inline-flex items-center gap-1.5">
                                    {invoice.customer_name}
                                    {rInfo?.nextPending && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded px-1 py-0.5 leading-none">
                                        <CalendarClock className="w-2.5 h-2.5" /> Scheduled
                                      </span>
                                    )}
                                    {!rInfo?.nextPending && rInfo?.lastSent && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded px-1 py-0.5 leading-none">
                                        <Mail className="w-2.5 h-2.5" /> Sent
                                      </span>
                                    )}
                                  </span>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-0 overflow-hidden" align="start">
                                  <div className="bg-primary/5 border-b px-4 py-3 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                                    <div>
                                      <p className="font-semibold text-sm">{invoice.customer_name}</p>
                                      {contactPerson && <p className="text-xs text-muted-foreground">{contactPerson}</p>}
                                    </div>
                                  </div>
                                  <div className="px-4 py-3 space-y-2">
                                    {email ? (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="truncate text-xs">{email}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Mail className="w-3.5 h-3.5 shrink-0" />
                                        <span>No email on file</span>
                                      </div>
                                    )}
                                    {phone ? (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-xs">{phone}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Phone className="w-3.5 h-3.5 shrink-0" />
                                        <span>No phone on file</span>
                                      </div>
                                    )}
                                    {/* Reminder info */}
                                    {rInfo?.nextPending && (
                                      <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                                        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                                        <span>Next reminder: {format(parseISO(rInfo.nextPending), 'dd MMM yyyy')}</span>
                                      </div>
                                    )}
                                    {rInfo?.lastSent && (
                                      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded px-2 py-1">
                                        <Mail className="w-3.5 h-3.5 shrink-0" />
                                        <span>Last sent: {format(parseISO(rInfo.lastSent), 'dd MMM yyyy')}</span>
                                      </div>
                                    )}
                                    {!rInfo && hasContactInfo && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                                        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                                        <span>No reminders scheduled</span>
                                      </div>
                                    )}
                                    {!hasContactInfo && (
                                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                                        <Users className="w-3.5 h-3.5 shrink-0" />
                                        <span>No contact info — add details to enable reminders</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="border-t px-4 py-2.5 flex items-center gap-2">
                                    <button
                                      disabled={!phone}
                                      onClick={() => phone && window.open(`tel:${phone}`)}
                                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <Phone className="w-3 h-3" /> Call
                                    </button>
                                    <button
                                      disabled={!email}
                                      onClick={() => email && window.open(`mailto:${email}`)}
                                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <Mail className="w-3 h-3" /> Email
                                    </button>
                                    <button
                                      disabled={!phone}
                                      onClick={() => phone && window.open(`https://wa.me/${phone.replace(/\D/g, '')}`)}
                                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <MessageSquare className="w-3 h-3" /> WhatsApp
                                    </button>
                                  </div>
                                  {!email && !phone && !contactPerson && (
                                    <AddCustomerInfoPopover
                                      customerName={invoice.customer_name}
                                      existingCustomer={customer}
                                    />
                                  )}
                                </PopoverContent>
                                </Popover>
                                );
                                })()}
                                </TableCell>
                        <TableCell className="px-3">
                           <span className="text-xs font-mono text-muted-foreground">{invoice.invoice_number || '—'}</span>
                         </TableCell>
                         <TableCell className="px-3 text-right">
                           <span className={`font-semibold text-sm ${invoice.status === 'overdue' ? 'text-red-600' : 'text-foreground'}`}>
                             ₹{outstanding.toLocaleString('en-IN')}
                           </span>
                         </TableCell>
                         <TableCell className="px-3">
                           {invoice.status && (
                             <div className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border ${statusColors[invoice.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                               {invoice.status}
                             </div>
                           )}
                         </TableCell>
                         <TableCell className="px-3">
                           <span className={`text-xs ${dueDate && new Date(dueDate) < new Date() ? 'text-red-600 font-medium' : 'text-foreground'}`}>
                             {dueDate ? format(dueDate, 'dd/MM/yyyy') : '—'}
                           </span>
                         </TableCell>
                         <TableCell className="px-3">
                           {(() => {
                             if (!dueDate) return '—';
                             const today = new Date();
                             today.setHours(0, 0, 0, 0);
                             const dueDateOnly = new Date(dueDate);
                             dueDateOnly.setHours(0, 0, 0, 0);
                             const daysOverdue = Math.floor((today - dueDateOnly) / (1000 * 60 * 60 * 24));
                             if (daysOverdue <= 0) return '—';
                             return <span className="text-xs font-medium text-red-600">{daysOverdue}d</span>;
                           })()}
                         </TableCell>
                         <TableCell className="px-3">
                           <AttachmentCell
                             invoice={invoice}
                             onUpdate={(id, data) => updateInvoiceMut.mutate({ id, data })}
                           />
                         </TableCell>
                         <TableCell className="px-3 text-right text-xs text-muted-foreground">
                           {(() => { const cust = getCustomerInfo(invoice.customer_name); return cust?.credit_limit ? `₹${(cust.credit_limit).toLocaleString('en-IN')}` : '—'; })()}
                         </TableCell>
                         <TableCell className="px-3">
                           <span className="text-xs text-muted-foreground">{(() => { const m = getResolvedManager(invoice); return m ? m.split('@')[0] : '—'; })()}</span>
                         </TableCell>
                         <TableCell className="px-3">
                           <span className="text-xs font-medium text-muted-foreground">{dueDate ? `W${getWeekNumber(dueDate)}` : '—'}</span>
                         </TableCell>
                         <TableCell className="px-3">
                           <span className="text-xs text-muted-foreground">{dueDate ? format(dueDate, 'MMM yyyy') : '—'}</span>
                         </TableCell>
                        <TableCell className="px-3">
                           <div className="flex items-center gap-0.5">
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                               title="Edit Invoice"
                               onClick={() => setEditingInvoice(invoice)}
                             >
                               <Edit className="w-3.5 h-3.5" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-7 w-7 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                               title="Set Target"
                               onClick={() => setTargetCustomer(getCustomerInfo(invoice.customer_name))}
                               >
                               <Target className="w-3.5 h-3.5" />
                               </Button>
                               <Button
                               variant="ghost"
                               size="icon"
                               disabled={!hasContactInfo}
                               className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                               title={hasContactInfo ? "Send Reminder Email" : "Add contact info to send reminders"}
                               onClick={() => hasContactInfo && setReminderCustomer(getCustomerInfo(invoice.customer_name) || { id: invoice.customer_id, name: invoice.customer_name, email: '', phone: '' })}
                             >
                               <Mail className="w-3.5 h-3.5" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                               title="Delete"
                               onClick={() => deleteMut.mutate(invoice.id)}
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
          </div>
        ))
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <EditInvoiceModal invoice={editingInvoice} onClose={() => setEditingInvoice(null)} />
      )}

      {/* Reminder Modal */}
      {reminderCustomer && (
        <QuickReminderModal customer={reminderCustomer} onClose={() => setReminderCustomer(null)} />
      )}

      {/* Set Target Modal */}
      {targetCustomer && (
        <SetTargetModal customer={targetCustomer} onClose={() => setTargetCustomer(null)} />
      )}

      {/* Schedule Reminders Modal */}
      {showScheduleModal && (
        <ScheduleRemindersModal
          invoices={[...selected].map(id => invoices.find(i => i.id === id)).filter(Boolean)}
          onClose={() => { setShowScheduleModal(false); setSelected(new Set()); }}
        />
      )}

      {/* Bulk Quick Reminder Modal */}
      {showBulkReminder && (
        <QuickBulkReminderModal
          selectedInvoices={[...selected].map(id => invoices.find(i => i.id === id)).filter(Boolean)}
          onClose={() => setShowBulkReminder(false)}
          onSuccess={() => { setSelected(new Set()); setShowBulkReminder(false); }}
        />
      )}

      {/* Bulk Action Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'delete' && 'Delete Invoices'}
              {bulkAction === 'reminder' && 'Send Reminders'}
              {bulkAction === 'manager' && 'Assign Manager'}
            </DialogTitle>
          </DialogHeader>
          
          {bulkAction === 'delete' && (
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{selected.size}</strong> invoice{selected.size > 1 ? 's' : ''}? This cannot be undone.
            </p>
          )}
          
          {bulkAction === 'reminder' && (
            <p className="text-sm text-muted-foreground">
              Send payment reminders to <strong>{selected.size}</strong> debtor{selected.size > 1 ? 's' : ''}?
            </p>
          )}
          
          {bulkAction === 'manager' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Assign account manager to <strong>{selected.size}</strong> invoice{selected.size > 1 ? 's' : ''}:
              </p>
              <Select value={assigningManager} onValueChange={setAssigningManager}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account manager..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.full_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
            <Button
              disabled={bulkLoading || (bulkAction === 'manager' && !assigningManager)}
              onClick={() => {
                if (bulkAction === 'delete') handleBulkDelete();
                else if (bulkAction === 'reminder') handleBulkReminder();
                else if (bulkAction === 'manager') handleBulkAssignManager();
              }}
            >
              {bulkLoading ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}