import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

export default function ScheduleRemindersModal({ invoices, debtors, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    numberOfReminders: 3,
    frequency: 'weekly',
    startDate: new Date().toISOString().split('T')[0],
    sendTime: '09:00',
    mode: 'email',
  });

  // Deduplicate debtors from selected invoices
  const selectedDebtors = [];
  const seen = new Set();
  invoices.forEach(inv => {
    const debtor = debtors.find(d => d.id === inv.debtor_id);
    if (debtor && !seen.has(debtor.id)) {
      seen.add(debtor.id);
      selectedDebtors.push({ debtor, invoice: inv });
    }
  });

  const handleSchedule = async () => {
    setLoading(true);
    try {
      const debtorIds = selectedDebtors.map(({ debtor }) => debtor.id);
      const res = await base44.functions.invoke('scheduleRemindersForDebtors', {
        debtorIds,
        numberOfReminders: Number(config.numberOfReminders),
        frequency: config.frequency,
        startDate: config.startDate,
        sendTime: config.sendTime,
        mode: config.mode,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast({
        title: 'Reminders scheduled!',
        description: `Created ${res.data.totalCreated} reminder(s) for ${selectedDebtors.length} debtor(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] });
      onClose();
    } catch (e) {
      toast({ title: 'Failed to schedule', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalMessages = selectedDebtors.length * Number(config.numberOfReminders) * (config.mode === 'both' ? 2 : 1);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Payment Reminders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected debtors */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected Debtors ({selectedDebtors.length})</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto p-2 bg-muted/40 rounded-lg border">
              {selectedDebtors.map(({ debtor }) => (
                <Badge key={debtor.id} variant="secondary" className="text-xs">{debtor.name}</Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Number of Reminders</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.numberOfReminders}
                onChange={e => setConfig(c => ({ ...c, numberOfReminders: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">1–10 messages per debtor</p>
            </div>

            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={config.frequency} onValueChange={v => setConfig(c => ({ ...c, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <input
                type="date"
                value={config.startDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setConfig(c => ({ ...c, startDate: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Send Time</Label>
              <input
                type="time"
                value={config.sendTime}
                onChange={e => setConfig(c => ({ ...c, sendTime: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Time reminders will be sent</p>
            </div>

            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={config.mode} onValueChange={v => setConfig(c => ({ ...c, mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">📧 Email only</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp only</SelectItem>
                  <SelectItem value="both">📧💬 Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 space-y-1">
            <p><strong>Templates used:</strong> <code>email_reminder_1</code>, <code>email_reminder_2</code>... (from Templates tab)</p>
            <p><strong>Total messages to schedule:</strong> {totalMessages}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSchedule} disabled={loading || selectedDebtors.length === 0}>
            {loading ? 'Scheduling...' : `Schedule ${totalMessages} Messages`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}