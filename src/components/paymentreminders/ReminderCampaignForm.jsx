import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ReminderCampaignForm({ onSuccess }) {
  const { toast } = useToast();
  const [debtorId, setDebtorId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [reminderType, setReminderType] = useState('email');
  const [frequency, setFrequency] = useState('weekly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [numberOfReminders, setNumberOfReminders] = useState(5);
  const [loading, setLoading] = useState(false);

  const { data: debtors = [] } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.filter({ type: reminderType }),
  });

  const handleSchedule = async () => {
    if (!debtorId || !campaignName || !templateId) {
      toast({ title: 'Please fill all fields' });
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('scheduleReminderCampaign', {
        debtorId,
        campaignName,
        templateId,
        reminderType,
        frequency,
        startDate,
        numberOfReminders
      });
      toast({ title: 'Campaign scheduled successfully' });
      setDebtorId('');
      setCampaignName('');
      setTemplateId('');
      onSuccess?.();
    } catch (error) {
      toast({ title: 'Error scheduling campaign', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Reminder Campaign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Debtor</label>
            <Select value={debtorId} onValueChange={setDebtorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select debtor" />
              </SelectTrigger>
              <SelectContent>
                {debtors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Campaign Name</label>
            <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g., Q2 Payment Reminder" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Reminder Type</label>
            <Select value={reminderType} onValueChange={setReminderType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Template</label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Frequency</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Start Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Number of Reminders (1-10)</label>
            <Input type="number" min="1" max="10" value={numberOfReminders} onChange={e => setNumberOfReminders(parseInt(e.target.value))} />
          </div>
        </div>
        <Button onClick={handleSchedule} disabled={loading} className="gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Schedule Campaign
        </Button>
      </CardContent>
    </Card>
  );
}