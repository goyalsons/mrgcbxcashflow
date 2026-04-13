import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Edit, Target, Bell, Trash2, CalendarClock, MessageSquare, User, Building2 } from 'lucide-react';
import AttachmentCell from '@/components/receivables/AttachmentCell';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import EditInvoiceModal from '@/components/receivables/EditInvoiceModal';
import ScheduleRemindersModal from '@/components/receivables/ScheduleRemindersModal';
import QuickReminderModal from '@/components/debtors/QuickReminderModal';
import SetTargetModal from '@/components/debtors/SetTargetModal';

export default function Receivables2() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    company: '',
    dueWeek: '',
    dueMonth: '',
    manager: '',
  });
  const [groupBy, setGroupBy] = useState('none');
  const [selected, setSelected] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState('delete');
  const [assigningManager, setAssigningManager] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [reminderDebtor, setReminderDebtor] = useState(null);
  const [targetDebtor, setTargetDebtor] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      return await base44.entities.Invoice.list('-created_date', 100);
    },
  });

  const { data: debtors = [] } = useQuery({
    queryKey: ['debtors'],
    queryFn: async () => {
      return await base44.entities.Debtor.list('-created_date', 100);
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

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const updateInvoiceMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const getDebtorInfo = (debtorId) => {
    const debtor = debtors.find(d => d.id === debtorId);
    return debtor || {};
  };

  const getCustomerInfo = (debtorName) => {
    if (!debtorName) return {};
    return customers.find(c => c.name?.toLowerCase() === debtorName?.toLowerCase()) || {};
  };

  const getResolvedManager = (invoice) => {
    const customer = getCustomerInfo(invoice.debtor_name);
    if (customer.account_manager) return customer.account_manager;
    const debtor = getDebtorInfo(invoice.debtor_id);
    return debtor?.assigned_manager || '';
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

    if (searchTerm) {
      result = result.filter(inv =>
        inv.debtor_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.company) {
      result = result.filter(inv => inv.debtor_name === filters.company);
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

    return result;
  }, [invoices, searchTerm, filters]);

  const uniqueCompanies = useMemo(() => {
    return [...new Set(invoices.map(inv => inv.debtor_name))].sort();
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
  }, [invoices, debtors, customers]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', items: filteredData }];
    }

    const groups = {};
    filteredData.forEach(inv => {
      let key = '';
      let label = '';

      if (groupBy === 'company') {
        key = inv.debtor_name;
        label = inv.debtor_name;
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

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => base44.entities.Invoice.delete(id)));
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
    try {
      await Promise.all([...selected].map(id => {
        const inv = invoices.find(i => i.id === id);
        const debtor = getDebtorInfo(inv?.debtor_id);
        if (debtor?.id) {
          return base44.entities.Debtor.update(debtor.id, { assigned_manager: assigningManager });
        }
      }).filter(Boolean));
      queryClient.invalidateQueries({ queryKey: ['invoices', 'debtors'] });
      toast({ title: `Assigned manager to ${selected.size} invoice(s)` });
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
      setShowBulkModal(false);
      setAssigningManager('');
    }
  };

  const handleBulkReminder = async () => {
    toast({ title: `Reminder sent to ${selected.size} debtors` });
    setSelected(new Set());
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

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Input
            placeholder="Search by company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            value={filters.company}
            onChange={(e) => setFilters({ ...filters, company: e.target.value })}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">All Companies</option>
            {uniqueCompanies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filters.dueWeek}
            onChange={(e) => setFilters({ ...filters, dueWeek: e.target.value })}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">All Weeks</option>
            {uniqueWeeks.map(w => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
          <select
            value={filters.dueMonth}
            onChange={(e) => setFilters({ ...filters, dueMonth: e.target.value })}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">All Months</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMM yyyy')}</option>
            ))}
          </select>
          <select
            value={filters.manager}
            onChange={(e) => setFilters({ ...filters, manager: e.target.value })}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">All Managers</option>
            {uniqueManagers.map(m => (
              <option key={m} value={m}>{m.split('@')[0]}</option>
            ))}
          </select>
        </div>

        {/* Grouping Buttons */}
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Group by:</span>
          {['none', 'company', 'week', 'month', 'manager'].map(option => (
            <Button
              key={option}
              size="sm"
              variant={groupBy === option ? 'default' : 'outline'}
              onClick={() => setGroupBy(option)}
              className="text-xs"
            >
              {option === 'none' ? 'None' : option.charAt(0).toUpperCase() + option.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Total Outstanding Card */}
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Outstanding (Filtered)</p>
            <p className="text-2xl font-bold text-primary">₹{totalOutstanding.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {filteredData.length} invoice{filteredData.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-primary">{selected.size} invoice{selected.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowScheduleModal(true)}>
              <CalendarClock className="w-3.5 h-3.5" /> Schedule Reminders
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setBulkAction('reminder'); setShowBulkModal(true); }}>Send Quick Reminder</Button>
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
          <div key={group.key} className="space-y-3">
            {groupBy !== 'none' && (
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg">
                <h3 className="font-semibold text-sm">{group.label}</h3>
                <span className="text-sm font-medium">₹{group.items.reduce((sum, inv) => sum + (inv.amount - (inv.amount_paid || 0)), 0).toLocaleString('en-IN')}</span>
              </div>
            )}
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 px-2">
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
                    <TableHead className="px-2">Co. Name</TableHead>
                    <TableHead className="px-2">Ref. No.</TableHead>
                    <TableHead className="px-2 text-right">Outstanding</TableHead>
                    <TableHead className="px-2">Due Date</TableHead>
                    <TableHead className="px-2">Attachments</TableHead>
                    <TableHead className="px-2 text-right">Credit Balance</TableHead>
                    <TableHead className="px-2">Manager</TableHead>
                    <TableHead className="px-2">Due Week</TableHead>
                    <TableHead className="px-2">Due Month</TableHead>
                    <TableHead className="px-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((invoice) => {
                    const debtor = getDebtorInfo(invoice.debtor_id);
                    const outstanding = invoice.amount - (invoice.amount_paid || 0);
                    const dueDate = invoice.due_date ? parseISO(invoice.due_date) : null;

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="px-2" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selected.has(invoice.id)} onCheckedChange={() => toggleOne(invoice.id)} />
                        </TableCell>
                        <TableCell className="px-2 font-medium">
                          {(() => {
                            const customer = getCustomerInfo(invoice.debtor_name);
                            const phone = customer.phone || debtor?.phone;
                            const email = customer.email || debtor?.email;
                            const contactPerson = customer.contact_person || debtor?.contact_person;
                            return (
                              <HoverCard openDelay={200} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <span className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-primary transition-colors">
                                    {invoice.debtor_name}
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-72 p-0 overflow-hidden" align="start">
                                  <div className="bg-primary/5 border-b px-4 py-3 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                                    <div>
                                      <p className="font-semibold text-sm">{invoice.debtor_name}</p>
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
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })()}
                          {debtor?.contact_person && (
                            <div className="text-xs text-muted-foreground mt-0.5">{debtor.contact_person}</div>
                          )}
                        </TableCell>
                        <TableCell className="px-2 text-xs text-muted-foreground">
                          {invoice.invoice_number || '-'}
                        </TableCell>
                        <TableCell className="px-2 text-right font-medium">
                          ₹{outstanding.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="px-2">
                          {dueDate ? format(dueDate, 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="px-2">
                          <AttachmentCell
                            invoice={invoice}
                            onUpdate={(id, data) => updateInvoiceMut.mutate({ id, data })}
                          />
                        </TableCell>
                        <TableCell className="px-2 text-right">
                          ₹{(debtor?.credit_limit || 0).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="px-2 text-sm">
                          {(() => { const m = getResolvedManager(invoice); return m ? m.split('@')[0] : '-'; })()}
                        </TableCell>
                        <TableCell className="px-2 text-sm">
                          {dueDate ? `W${getWeekNumber(dueDate)}` : '-'}
                        </TableCell>
                        <TableCell className="px-2 text-sm">
                          {dueDate ? format(dueDate, 'MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell className="px-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600"
                              title="Call"
                              onClick={() => { if (debtor?.phone) window.open(`tel:${debtor.phone}`); }}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-orange-600"
                              title="Email"
                              onClick={() => { if (debtor?.email) window.open(`mailto:${debtor.email}`); }}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-600"
                              title="Edit"
                              onClick={() => setEditingInvoice(invoice)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-purple-600"
                              title="Set Target"
                              onClick={() => setTargetDebtor(debtor)}
                            >
                              <Target className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600"
                              title="Send Reminder"
                              onClick={() => setReminderDebtor(debtor?.id ? debtor : { id: invoice.debtor_id, name: invoice.debtor_name })}
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
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
      {reminderDebtor && (
        <QuickReminderModal debtor={reminderDebtor} onClose={() => setReminderDebtor(null)} />
      )}

      {/* Set Target Modal */}
      {targetDebtor && (
        <SetTargetModal debtor={targetDebtor} onClose={() => setTargetDebtor(null)} />
      )}

      {/* Schedule Reminders Modal */}
      {showScheduleModal && (
        <ScheduleRemindersModal
          invoices={[...selected].map(id => invoices.find(i => i.id === id)).filter(Boolean)}
          debtors={debtors}
          onClose={() => { setShowScheduleModal(false); setSelected(new Set()); }}
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