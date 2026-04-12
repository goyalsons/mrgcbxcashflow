import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ScheduledMessageList({ campaignId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');

  const { data: reminders = [] } = useQuery({
    queryKey: ['scheduledReminders', campaignId],
    queryFn: () => base44.entities.ScheduledReminder.filter({ campaign_id: campaignId }),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ reminderId, newStatus }) => 
      base44.functions.invoke('manageReminderCampaign', {
        action: 'updateMessageStatus',
        reminderId,
        newStatus
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders', campaignId] });
      toast({ title: 'Status updated' });
    },
  });

  const updateScheduleMut = useMutation({
    mutationFn: ({ reminderId, newSchedule }) => 
      base44.functions.invoke('manageReminderCampaign', {
        action: 'updateSchedule',
        reminderId,
        newSchedule
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders', campaignId] });
      setEditingId(null);
      toast({ title: 'Schedule updated' });
    },
  });

  const handleScheduleEdit = (reminder) => {
    setEditingId(reminder.id);
    setEditDate(reminder.scheduled_send_date);
  };

  const handleScheduleSave = (reminderId) => {
    updateScheduleMut.mutate({ reminderId, newSchedule: editDate });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <Check className="w-4 h-4 text-green-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'failed': return <X className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">Scheduled Messages ({reminders.length})</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Scheduled Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reminders.map(reminder => (
            <TableRow key={reminder.id}>
              <TableCell>{reminder.reminder_number}</TableCell>
              <TableCell>
                {editingId === reminder.id ? (
                  <Input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-32"
                  />
                ) : (
                  reminder.scheduled_send_date
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getStatusIcon(reminder.status)}
                  <Badge variant={reminder.status === 'sent' ? 'default' : reminder.status === 'pending' ? 'secondary' : 'destructive'}>
                    {reminder.status}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>{reminder.sent_date || '-'}</TableCell>
              <TableCell className="text-right space-x-2">
                {reminder.status === 'pending' && editingId !== reminder.id && (
                  <Button size="sm" variant="ghost" onClick={() => handleScheduleEdit(reminder)}>
                    Edit
                  </Button>
                )}
                {editingId === reminder.id && (
                  <>
                    <Button size="sm" onClick={() => handleScheduleSave(reminder.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </>
                )}
                {reminder.status === 'pending' && editingId !== reminder.id && (
                  <Button size="sm" variant="ghost" onClick={() => updateStatusMut.mutate({ reminderId: reminder.id, newStatus: 'skipped' })}>
                    Skip
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}