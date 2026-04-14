import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Trash2, PauseCircle, PlayCircle, Check, Clock, X, SkipForward, Send, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO, isBefore } from 'date-fns';

const STATUS_COLORS = {
  pending: 'secondary',
  sent: 'default',
  failed: 'destructive',
  skipped: 'outline',
};

const STATUS_ICONS = {
  pending: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  sent: <Check className="w-3.5 h-3.5 text-green-600" />,
  failed: <X className="w-3.5 h-3.5 text-red-600" />,
  skipped: <SkipForward className="w-3.5 h-3.5 text-gray-400" />,
};

export default function ScheduledRemindersList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sendingOverdue, setSendingOverdue] = useState(false);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['scheduledReminders'],
    queryFn: () => base44.entities.ScheduledReminder.list('-scheduled_send_date', 200),
  });

  // Fetch customers to get company names
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  // Fetch templates to get template names
  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplatesAll'],
    queryFn: () => base44.entities.MessageTemplate.list(),
  });

  // Also fetch campaigns to get template_id per reminder
  const { data: campaigns = [] } = useQuery({
    queryKey: ['reminderCampaigns'],
    queryFn: () => base44.entities.ReminderCampaign.list(),
  });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const templateMap = Object.fromEntries(templates.map(t => [t.id, t]));
  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]));

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduledReminder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReminder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] });
      toast({ title: 'Reminder deleted' });
    },
  });

  const handleSaveDate = (id) => {
   updateMut.mutate({ id, data: { scheduled_send_date: editDate, scheduled_send_time: editTime } });
   setEditingId(null);
   toast({ title: 'Schedule updated' });
  };

  const handleTogglePause = (reminder) => {
    const newStatus = reminder.status === 'skipped' ? 'pending' : 'skipped';
    updateMut.mutate({ id: reminder.id, data: { status: newStatus } });
    toast({ title: newStatus === 'skipped' ? 'Reminder paused' : 'Reminder resumed' });
  };

  const handleSendNow = async (reminder) => {
    setSendingId(reminder.id);
    try {
      const res = await base44.functions.invoke('sendSingleReminder', { reminderId: reminder.id });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] });
      toast({ title: 'Reminder sent successfully!' });
    } catch (err) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSendingId(null);
    }
  };

  const handleSendOverdue = async () => {
    setSendingOverdue(true);
    try {
      const res = await base44.functions.invoke('sendScheduledReminders', {});
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] });
      toast({
        title: 'Overdue reminders sent!',
        description: `Sent: ${res.data.sentCount}, Failed: ${res.data.failedCount}`,
      });
    } catch (err) {
      toast({ title: 'Failed to send overdue reminders', description: err.message, variant: 'destructive' });
    } finally {
      setSendingOverdue(false);
    }
  };

  const isOverdue = (reminder) => {
    if (reminder.status !== 'pending') return false;
    const now = new Date();
    const scheduled = new Date(`${reminder.scheduled_send_date}T${reminder.scheduled_send_time || '00:00'}`);
    return isBefore(scheduled, now);
  };

  const overdueCount = reminders.filter(isOverdue).length;

  const filtered = reminders.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterType !== 'all' && r.send_type !== filterType) return false;
    if (searchCustomer) {
      const customer = customerMap[r.customer_id];
      const name = customer?.name || '';
      const email = r.customer_email || '';
      const subject = r.message_subject || '';
      const q = searchCustomer.toLowerCase();
      if (!name.toLowerCase().includes(q) && !email.toLowerCase().includes(q) && !subject.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const pendingCount = reminders.filter(r => r.status === 'pending').length;
  const sentCount = reminders.filter(r => r.status === 'sent').length;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading reminders...</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', count: reminders.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Pending', count: pendingCount, color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Sent', count: sentCount, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-lg border px-4 py-3 ${s.color}`}>
            <p className="text-xs font-medium opacity-70">{s.label}</p>
            <p className="text-2xl font-bold">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filters + Send Overdue Button */}
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Search by company / email..."
            value={searchCustomer}
            onChange={e => setSearchCustomer(e.target.value)}
            className="w-56"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Paused</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="email">📧 Email</SelectItem>
              <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSendOverdue}
          disabled={sendingOverdue || overdueCount === 0}
          className="bg-orange-600 hover:bg-orange-700 text-white gap-2 disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          {sendingOverdue ? 'Sending...' : overdueCount > 0 ? `Send Now (${overdueCount} overdue)` : 'Send Now'}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
          <p className="text-2xl mb-2">📭</p>
          <p className="font-medium">No scheduled reminders found</p>
          <p className="text-sm mt-1">Select invoices in Receivables and schedule reminders to get started.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Scheduled Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                .sort((a, b) => (a.scheduled_send_date || '').localeCompare(b.scheduled_send_date || ''))
                .map(reminder => {
                  const customer = customerMap[reminder.customer_id];
                  const campaign = campaignMap[reminder.campaign_id];
                  const template = campaign ? templateMap[campaign.template_id] : null;
                  const templateName = template?.name || '—';
                  const overdue = isOverdue(reminder);

                  return (
                    <TableRow
                      key={reminder.id}
                      className={`${reminder.status === 'skipped' ? 'opacity-50' : ''} ${overdue ? 'bg-orange-50/40' : ''}`}
                    >
                      <TableCell className="text-muted-foreground text-xs">{reminder.reminder_number}</TableCell>

                      {/* Company */}
                      <TableCell>
                        <div className="text-sm font-medium">{customer?.name || '—'}</div>
                      </TableCell>

                      {/* Email */}
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{reminder.customer_email || '—'}</div>
                      </TableCell>

                      {/* Template Name */}
                      <TableCell>
                        <div className="text-sm text-muted-foreground truncate max-w-[160px]">
                          {templateName}
                        </div>
                      </TableCell>

                      {/* Channel */}
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {reminder.send_type === 'email' ? '📧 Email' : '💬 WhatsApp'}
                        </Badge>
                      </TableCell>

                      {/* Scheduled Date */}
                      <TableCell>
                        {editingId === reminder.id ? (
                          <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-32" />
                        ) : (
                          <span className={`text-sm ${overdue ? 'text-orange-600 font-medium' : ''}`}>
                            {reminder.scheduled_send_date
                              ? format(parseISO(reminder.scheduled_send_date), 'dd MMM yyyy')
                              : '—'}
                          </span>
                        )}
                      </TableCell>

                      {/* Scheduled Time */}
                      <TableCell>
                        {editingId === reminder.id ? (
                          <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-24" />
                        ) : (
                          <span className={`text-sm ${overdue ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                            {reminder.scheduled_send_time || '—'}
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {STATUS_ICONS[reminder.status]}
                          <Badge variant={STATUS_COLORS[reminder.status]} className="text-xs capitalize">
                            {reminder.status === 'skipped' ? 'paused' : reminder.status}
                          </Badge>
                          {overdue && <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">Overdue</Badge>}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Send Now (for pending reminders) */}
                          {reminder.status === 'pending' && editingId !== reminder.id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-primary"
                              title="Send now"
                              disabled={sendingId === reminder.id}
                              onClick={() => handleSendNow(reminder)}
                            >
                              {sendingId === reminder.id
                                ? <Clock className="w-3.5 h-3.5 animate-spin" />
                                : <Send className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          {/* Edit date & time */}
                          {reminder.status === 'pending' && editingId !== reminder.id && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit date & time"
                              onClick={() => { setEditingId(reminder.id); setEditDate(reminder.scheduled_send_date); setEditTime(reminder.scheduled_send_time || '09:00'); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {editingId === reminder.id && (
                            <>
                              <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveDate(reminder.id)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            </>
                          )}
                          {(reminder.status === 'pending' || reminder.status === 'skipped') && editingId !== reminder.id && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title={reminder.status === 'skipped' ? 'Resume' : 'Pause'}
                              onClick={() => handleTogglePause(reminder)}>
                              {reminder.status === 'skipped'
                                ? <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                                : <PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete"
                            onClick={() => deleteMut.mutate(reminder.id)}>
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