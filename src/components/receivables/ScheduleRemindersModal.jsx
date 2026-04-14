import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, AlertCircle, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

export default function ScheduleRemindersModal({ invoices, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [loading, setLoading] = useState(false);
  const [frequencyType, setFrequencyType] = useState('weekly');
  const [selectedDays, setSelectedDays] = useState(new Set(['Monday', 'Wednesday', 'Friday']));
  const [selectedMonthlyDays, setSelectedMonthlyDays] = useState(new Set([1]));
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [sendTime, setSendTime] = useState('09:00');
  const [mode, setMode] = useState('email');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [whatsappTemplateId, setWhatsappTemplateId] = useState('');

  // Fetch templates
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['messageTemplates', 'email'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list();
      return all.filter(t => t.type === 'email' && t.is_active !== false);
    },
  });

  // Auto-select "Default reminder" template when templates load
  useEffect(() => {
    if (emailTemplates.length > 0 && !emailTemplateId) {
      const defaultTemplate = emailTemplates.find(t => t.name?.toLowerCase().includes('default')) || emailTemplates[0];
      if (defaultTemplate) setEmailTemplateId(defaultTemplate.id);
    }
  }, [emailTemplates]);

  const { data: whatsappTemplates = [] } = useQuery({
    queryKey: ['messageTemplates', 'whatsapp'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list();
      return all.filter(t => t.type === 'whatsapp' && t.is_active !== false);
    },
  });

  // Fetch all customers to match with invoices
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      return await base44.entities.Customer.list();
    },
  });

  // Fetch existing campaigns to detect duplicates
  const { data: existingCampaigns = [] } = useQuery({
    queryKey: ['reminderCampaigns'],
    queryFn: () => base44.entities.ReminderCampaign.list(),
  });

  // Extract unique customers from selected invoices
  const selectedCustomers = useMemo(() => {
    if (!invoices || invoices.length === 0) return [];
    
    const customerMap = new Map();
    invoices.forEach(inv => {
      if (!inv) return;
      const key = inv.debtor_name || inv.customer_name;
      if (!key || customerMap.has(key)) return;
      
      // Find matching customer from Customer table
      const matchedCustomer = allCustomers.find(c => c.name?.toLowerCase() === key?.toLowerCase());
      
      customerMap.set(key, { 
        id: matchedCustomer?.id || inv.debtor_id || inv.customer_id, 
        name: key, 
        email: matchedCustomer?.email || '', 
        phone: matchedCustomer?.phone || '' 
      });
    });
    return Array.from(customerMap.values());
  }, [invoices, allCustomers]);

  // Detect customers who already have an active or paused campaign
  const duplicateCustomerIds = useMemo(() => {
    const activeCampaigns = existingCampaigns.filter(c => c.status === 'active' || c.status === 'paused');
    const activeDebtorIds = new Set(activeCampaigns.map(c => c.debtor_id).filter(Boolean));
    return new Set(selectedCustomers.filter(c => activeDebtorIds.has(c.id)).map(c => c.id));
  }, [selectedCustomers, existingCampaigns]);

  const duplicateCustomers = useMemo(() =>
    selectedCustomers.filter(c => duplicateCustomerIds.has(c.id)),
  [selectedCustomers, duplicateCustomerIds]);

  const schedulableCustomers = useMemo(() =>
    selectedCustomers.filter(c => !duplicateCustomerIds.has(c.id)),
  [selectedCustomers, duplicateCustomerIds]);

  // Handlers
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
    // Validate
    if (schedulableCustomers.length === 0) {
      toast({ title: 'All selected customers already have active reminder campaigns', variant: 'destructive' });
      return;
    }

    if ((mode === 'email' || mode === 'both') && !emailTemplateId) {
      toast({ title: 'Please select email template', variant: 'destructive' });
      return;
    }

    if ((mode === 'whatsapp' || mode === 'both') && !whatsappTemplateId) {
      toast({ title: 'Please select WhatsApp template', variant: 'destructive' });
      return;
    }

    if (frequencyType === 'weekly' && selectedDays.size === 0) {
      toast({ title: 'Select at least one day for weekly reminders', variant: 'destructive' });
      return;
    }

    if (frequencyType === 'monthly' && selectedMonthlyDays.size === 0) {
      toast({ title: 'Select at least one date for monthly reminders', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('scheduleRemindersForDebtors', {
        debtorIds: schedulableCustomers.map(c => c.id),
        frequencyType,
        selectedDays: Array.from(selectedDays),
        selectedMonthlyDays: Array.from(selectedMonthlyDays),
        startDate,
        sendTime,
        emailTemplateId: (mode === 'email' || mode === 'both') ? emailTemplateId : null,
        whatsappTemplateId: (mode === 'whatsapp' || mode === 'both') ? whatsappTemplateId : null,
        mode,
      });

      if (response.data?.error) throw new Error(response.data.error);

      toast({
        title: 'Reminders scheduled!',
        description: `${response.data.totalCreated} reminder(s) created for ${schedulableCustomers.length} customer(s).`,
      });

      queryClient.invalidateQueries({ queryKey: ['scheduledReminders'] });
      onClose();
    } catch (err) {
      toast({ title: 'Failed to schedule reminders', description: err.message, variant: 'destructive' });
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
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Selected Customers ({selectedCustomers.length})
            </Label>
            {selectedCustomers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2 bg-muted/40 rounded-lg border">
                {selectedCustomers.map(c => (
                  <Badge
                    key={c.id}
                    variant="secondary"
                    className={`text-xs ${duplicateCustomerIds.has(c.id) ? 'bg-amber-100 text-amber-800 border-amber-300 line-through opacity-60' : ''}`}
                  >
                    {c.name}
                    {duplicateCustomerIds.has(c.id) && ' (active campaign)'}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="text-red-700">No customers found. Please select invoices first.</span>
              </div>
            )}
            {duplicateCustomers.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-amber-800">
                  <strong>{duplicateCustomers.length}</strong> customer{duplicateCustomers.length > 1 ? 's' : ''} already {duplicateCustomers.length > 1 ? 'have' : 'has'} an active reminder campaign and will be skipped.
                  {schedulableCustomers.length === 0 && ' No new reminders will be created.'}
                </span>
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

          {/* Frequency */}
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

          {/* Weekly Days */}
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

          {/* Monthly Days */}
          {frequencyType === 'monthly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Send on these dates</Label>
              <div className="grid grid-cols-7 gap-1.5 p-2 bg-muted/30 rounded-lg border">
                {DAYS_OF_MONTH.map(day => (
                  <label key={day} className="flex items-center justify-center cursor-pointer">
                    <Checkbox
                      checked={selectedMonthlyDays.has(day)}
                      onCheckedChange={() => toggleMonthlyDay(day)}
                    />
                    <span className="text-xs ml-1">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Send Via */}
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

          {/* Email Template */}
          {(mode === 'email' || mode === 'both') && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Email Template</Label>
              <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.meta_template_name || t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {emailTemplates.length === 0 && (
                <p className="text-xs text-amber-600">No templates. Create one in Settings.</p>
              )}
            </div>
          )}

          {/* WhatsApp Template */}
          {(mode === 'whatsapp' || mode === 'both') && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">WhatsApp Template</Label>
              <Select value={whatsappTemplateId} onValueChange={setWhatsappTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {whatsappTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.meta_template_name || t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {whatsappTemplates.length === 0 && (
                <p className="text-xs text-amber-600">No templates. Create one in Settings.</p>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 space-y-1">
            <p>
              <strong>Schedule:</strong> {frequencyType === 'daily' ? 'Daily' : frequencyType === 'weekly' ? `Every ${Array.from(selectedDays).join(', ')}` : `Dates: ${Array.from(selectedMonthlyDays).sort((a, b) => a - b).join(', ')}`}
            </p>
            <p><strong>Starting:</strong> {startDate} at {sendTime}</p>
            <p><strong>Customers:</strong> {schedulableCustomers.length}{duplicateCustomers.length > 0 ? ` (${duplicateCustomers.length} skipped — active campaign)` : ''}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSchedule}
            disabled={loading || schedulableCustomers.length === 0}
          >
            {loading ? 'Scheduling...' : 'Schedule Reminders'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}