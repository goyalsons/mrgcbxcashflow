import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

export default function EditCampaignModal({ campaign, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [reminderType, setReminderType] = useState(campaign.reminder_type);
  const [frequency, setFrequency] = useState(campaign.frequency);
  const [mode, setMode] = useState(campaign.reminder_type === 'email' && campaign.reminder_type === 'whatsapp' ? 'both' : campaign.reminder_type);
  const [emailTemplateId, setEmailTemplateId] = useState(campaign.reminder_type === 'email' || campaign.reminder_type === 'whatsapp' ? campaign.template_id : '');
  const [whatsappTemplateId, setWhatsappTemplateId] = useState(campaign.reminder_type === 'whatsapp' || campaign.reminder_type === 'email' ? campaign.template_id : '');
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [selectedMonthlyDays, setSelectedMonthlyDays] = useState(new Set([1]));
  const [sendTime, setSendTime] = useState('09:00');

  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['messageTemplates', 'email'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list();
      return all.filter(t => t.type === 'email' && t.is_active !== false);
    },
  });

  const { data: whatsappTemplates = [] } = useQuery({
    queryKey: ['messageTemplates', 'whatsapp'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list();
      return all.filter(t => t.type === 'whatsapp' && t.is_active !== false);
    },
  });

  useEffect(() => {
    if (emailTemplates.length > 0 && !emailTemplateId && (mode === 'email' || mode === 'both')) {
      setEmailTemplateId(emailTemplates[0].id);
    }
  }, [emailTemplates]);

  useEffect(() => {
    if (whatsappTemplates.length > 0 && !whatsappTemplateId && (mode === 'whatsapp' || mode === 'both')) {
      setWhatsappTemplateId(whatsappTemplates[0].id);
    }
  }, [whatsappTemplates]);

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

  const handleSave = async () => {
    if ((mode === 'email' || mode === 'both') && !emailTemplateId) {
      toast({ title: 'Please select email template', variant: 'destructive' });
      return;
    }

    if ((mode === 'whatsapp' || mode === 'both') && !whatsappTemplateId) {
      toast({ title: 'Please select WhatsApp template', variant: 'destructive' });
      return;
    }

    if (frequency === 'weekly' && selectedDays.size === 0) {
      toast({ title: 'Select at least one day for weekly reminders', variant: 'destructive' });
      return;
    }

    if (frequency === 'monthly' && selectedMonthlyDays.size === 0) {
      toast({ title: 'Select at least one date for monthly reminders', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await base44.entities.ReminderCampaign.update(campaign.id, {
        reminder_type: mode === 'both' ? 'both' : mode,
        frequency,
        template_id: mode === 'email' ? emailTemplateId : mode === 'whatsapp' ? whatsappTemplateId : emailTemplateId,
      });
      queryClient.invalidateQueries({ queryKey: ['reminderCampaigns'] });
      toast({ title: 'Campaign updated successfully' });
      onClose();
    } catch (error) {
      toast({ title: 'Error updating campaign', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign: {campaign.campaign_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer Info */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-sm">
                {campaign.debtor_name}
              </Badge>
            </div>
          </div>

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

          {/* Frequency */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Frequency</Label>
            <div className="grid grid-cols-3 gap-2">
              {['daily', 'weekly', 'monthly'].map(type => (
                <button
                  key={type}
                  onClick={() => setFrequency(type)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    frequency === type
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
          {frequency === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Send on these days</Label>
              <div className="grid grid-cols-4 gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDays.has(day)}
                      onChange={() => toggleDay(day)}
                      className="rounded border-input w-4 h-4"
                    />
                    <span className="text-sm">{day.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Days */}
          {frequency === 'monthly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Send on these dates</Label>
              <div className="grid grid-cols-7 gap-1.5 p-2 bg-muted/30 rounded-lg border">
                {DAYS_OF_MONTH.map(day => (
                  <label key={day} className="flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMonthlyDays.has(day)}
                      onChange={() => toggleMonthlyDay(day)}
                      className="rounded border-input w-3 h-3"
                    />
                    <span className="text-xs ml-1">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Send Time */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Send Time</Label>
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
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
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {emailTemplates.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">No templates available for this type.</p>
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
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {whatsappTemplates.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">No templates available for this type.</p>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 space-y-1">
            <p>
              <strong>Schedule:</strong> {frequency === 'daily' ? 'Daily' : frequency === 'weekly' ? `Every ${Array.from(selectedDays).length > 0 ? Array.from(selectedDays).join(', ') : '(select days)'}` : `Dates: ${Array.from(selectedMonthlyDays).sort((a, b) => a - b).join(', ')}`}
            </p>
            <p><strong>Send Time:</strong> {sendTime}</p>
            <p><strong>Send via:</strong> {mode === 'both' ? 'Email & WhatsApp' : mode === 'email' ? 'Email' : 'WhatsApp'}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || (frequency === 'weekly' && selectedDays.size === 0) || (frequency === 'monthly' && selectedMonthlyDays.size === 0) || !((mode === 'email' || mode === 'both') ? emailTemplateId : true) || !((mode === 'whatsapp' || mode === 'both') ? whatsappTemplateId : true)}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}