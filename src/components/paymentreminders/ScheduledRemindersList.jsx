import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Trash2, PauseCircle, PlayCircle, Check, Clock, X, SkipForward } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';

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

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['scheduledReminders'],
    queryFn: () => base44.entities.ScheduledReminder.list('-scheduled_send_date', 200),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduledReminder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReminder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] });
      toast({ title: 'Reminder deleted' });
    },
  });

  const handleSaveDate = (id) => {
    updateMut.mutate({ id, data: { scheduled_send_date: editDate } });
    setEditingId(null);
    toast({ title: 'Schedule updated' });
  };

  const handleTogglePause = (reminder) => {
    const newStatus = reminder.status === 'skipped' ? 'pending' : 'skipped';
    updateMut.mutate({ id: reminder.id, data: { status: newStatus } });
    toast({ title: newStatus === 'skipped' ? 'Reminder paused' : 'Reminder resumed' });
  };

  const filtered = reminders.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterType !== 'all' && r.send_type !== filterType) return false;
    if (searchCustomer && !r.customer_email?.toLowerCase().includes(searchCustomer.toLowerCase())) {
      // also check customer_id via name — use message_subject as fallback
      const matchSubject = r.message_subject?.toLowerCase().includes(searchCustomer.toLowerCase());
      const matchBody = r.message_body?.toLowerCase().includes(searchCustomer.toLowerCase());
      if (!matchSubject && !matchBody) return false;
    }
    return true;
  });

  // Group by customer for display
  const customerGroups = {};
  filtered.forEach(r => {
    const key = r.customer_id || r.customer_email || 'unknown';
    if (!customerGroups[key]) customerGroups[key] = { label: r.customer_email || r.customer_id, items: [] };
    customerGroups[key].items.push(r);
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search by customer / subject..."
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
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.sort((a, b) => a.scheduled_send_date?.localeCompare(b.scheduled_send_date)).map(reminder => (
                <TableRow key={reminder.id} className={reminder.status === 'skipped' ? 'opacity-50' : ''}>
                  <TableCell className="text-muted-foreground text-xs">{reminder.reminder_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{reminder.customer_email || '—'}</div>
                    {reminder.message_subject && (
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">{reminder.message_subject}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {reminder.send_type === 'email' ? '📧 Email' : '💬 WhatsApp'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editingId === reminder.id ? (
                      <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-32" />
                    ) : (
                      <span className="text-sm">
                        {reminder.scheduled_send_date ? format(parseISO(reminder.scheduled_send_date), 'dd MMM yyyy') : '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICONS[reminder.status]}
                      <Badge variant={STATUS_COLORS[reminder.status]} className="text-xs capitalize">
                        {reminder.status === 'skipped' ? 'paused' : reminder.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {reminder.sent_date ? format(parseISO(reminder.sent_date), 'dd MMM') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {reminder.status === 'pending' && editingId !== reminder.id && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit date"
                          onClick={() => { setEditingId(reminder.id); setEditDate(reminder.scheduled_send_date); }}>
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
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}