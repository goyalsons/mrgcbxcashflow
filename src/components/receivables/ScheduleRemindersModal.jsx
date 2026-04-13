import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Mail } from 'lucide-react';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

export default function ScheduleRemindersModal({ invoices, debtors, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [frequencyType, setFrequencyType] = useState('weekly');
  const [selectedDays, setSelectedDays] = useState(new Set(['Monday', 'Wednesday', 'Friday']));
  const [selectedMonthlyDays, setSelectedMonthlyDays] = useState(new Set([1]));
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [sendTime, setSendTime] = useState('09:00');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [whatsappTemplateId, setWhatsappTemplateId] = useState('');
  const [mode, setMode] = useState('email');

  // Fetch templates
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list(),
    select: (data) => data.filter(t => t.type === 'email' && t.is_active !== false),
  });

  const { data: whatsappTemplates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list(),
    select: (data) => data.filter(t => t.type === 'whatsapp' && t.is_active !== false),
  });

  // Deduplicate debtors from invoices
  const selectedDebtors = useMemo(() => {
    const seen = new Set();
    const result = [];
    if (invoices && invoices.length > 0) {
      invoices.forEach(inv => {
        if (!inv) return;
        const debtor = debtors.find(d => d.id === inv.debtor_id || d.name === inv.debtor_name);
        if (debtor && !seen.has(debtor.id)) {
          seen.add(debtor.id);
          result.push(debtor);
        }
      });
    }
    return result;
  }, [invoices, debtors]);

  const toggleDay = (day) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const toggleMonthlyDay = (day) => {
    setSelectedMonthlyDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const handleSchedule = async () => {
    if (selectedDebtors.length === 0) {
      toast({ title: 'No debtors selected', variant: 'destructive' });
      return;
    }

    if ((mode === 'email' || mode === 'both') && !emailTemplateId) {
      toast({ title: 'Please select an email template', variant: 'destructive' });
      return;
    }

    if ((mode === 'whatsapp' || mode === 'both') && !whatsappTemplateId) {
      toast({ title: 'Please select a WhatsApp template', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('scheduleRemindersForDebtors', {
        debtorIds: selectedDebtors.map(d => d.id),
        frequencyType,
        selectedDays: [...selectedDays],
        selectedMonthlyDays: [...selectedMonthlyDays],
        startDate,
        sendTime,
        emailTemplateId: mode === 'email' || mode === 'both' ? emailTemplateId : null,
        whatsappTemplateId: mode === 'whatsapp' || mode === 'both' ? whatsappTemplateId : null,
        mode,
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Payment Reminders</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Selected Debtors */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <span>Selected Debtors ({selectedDebtors.length})</span>
              {selectedDebtors.length === 0 && <span className="text-red-600 font-normal">Required</span>}
            </Label>
            {selectedDebtors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto p-2 bg-muted/40 rounded-lg border">
                {selectedDebtors.map((debtor) => (
                  <Badge key={debtor.id} variant="secondary" className="text-xs">
                    {debtor.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                No debtors found. Please select invoices first.
              </div>
            )}
          </div>

          {/* Start Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Start Date
              </Label>
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Send Time
              </Label>
              <input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Frequency Type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Frequency</Label>
            <div className="grid grid-cols-3 gap-2">
              {['daily', 'weekly', 'monthly'].map(type => (
                <button
                  key={type}
                  onClick={() => setFrequencyType(type)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    frequencyType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Days of Week (for weekly) */}
          {frequencyType === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Send on these days</Label>
              <div className="grid grid-cols-4 gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedDays.has(day)}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    <span className="text-sm">{day.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Days of Month (for monthly) */}
          {frequencyType === 'monthly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Send on these dates</Label>
              <div className="grid grid-cols-7 gap-1.5 p-2 bg-muted/30 rounded-lg border">
                {DAYS_OF_MONTH.map(day => (
                  <label key={day} className="flex items-center justify-center cursor-pointer">
                    <Checkbox
                      checked={selectedMonthlyDays.has(day)}
                      onCheckedChange={() => toggleMonthlyDay(day)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs ml-1 w-6 text-center">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Message Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Send via</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">📧 Email only</SelectItem>
                <SelectItem value="whatsapp">💬 WhatsApp only</SelectItem>
                <SelectItem value="both">📧💬 Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          {(mode === 'email' || mode === 'both') && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email Template
              </Label>
              <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select email template..." />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {emailTemplates.length === 0 && (
                <p className="text-xs text-amber-600">No email templates available. Create one in Settings → Templates.</p>
              )}
            </div>
          )}

          {(mode === 'whatsapp' || mode === 'both') && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">WhatsApp Template</Label>
              <Select value={whatsappTemplateId} onValueChange={setWhatsappTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select WhatsApp template..." />
                </SelectTrigger>
                <SelectContent>
                  {whatsappTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {whatsappTemplates.length === 0 && (
                <p className="text-xs text-amber-600">No WhatsApp templates available. Create one in Settings → Templates.</p>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 space-y-1">
            <p>
              <strong>Schedule:</strong> {frequencyType === 'weekly' ? `Every ${[...selectedDays].join(', ')}` : frequencyType === 'monthly' ? `On dates: ${[...selectedMonthlyDays].sort((a, b) => a - b).join(', ')}` : frequencyType.charAt(0).toUpperCase() + frequencyType.slice(1)}
            </p>
            <p><strong>Starting:</strong> {startDate} at {sendTime}</p>
            <p><strong>Debtors:</strong> {selectedDebtors.length}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSchedule}
            disabled={loading || selectedDebtors.length === 0 || (mode === 'email' && !emailTemplateId) || (mode === 'whatsapp' && !whatsappTemplateId)}
          >
            {loading ? 'Scheduling...' : `Schedule Reminders`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}