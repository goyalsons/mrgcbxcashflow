import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import ReminderCampaignList from '@/components/paymentreminders/ReminderCampaignList';
import ScheduledRemindersList from '@/components/paymentreminders/ScheduledRemindersList';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Zap } from 'lucide-react';

export default function PaymentReminders() {
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    // Load from localStorage first for instant feedback, then sync from backend
    const stored = localStorage.getItem('auto_reminders_enabled');
    setAutoEnabled(stored === 'true');
    base44.functions.invoke('manageReminderCampaign', { action: 'getAutoStatus' })
      .then(res => {
        if (res?.data?.is_active !== undefined) {
          setAutoEnabled(res.data.is_active);
          localStorage.setItem('auto_reminders_enabled', String(res.data.is_active));
        }
      })
      .catch(() => { /* use localStorage value */ });
  }, []);

  const handleToggle = async (checked) => {
    setToggling(true);
    try {
      await base44.functions.invoke('manageReminderCampaign', {
        action: checked ? 'activateAutomation' : 'deactivateAutomation',
      });
      localStorage.setItem('auto_reminders_enabled', String(checked));
      setAutoEnabled(checked);
      toast({
        title: checked ? 'Auto Reminders Activated' : 'Auto Reminders Deactivated',
        description: checked
          ? 'Scheduled reminders will now be sent automatically.'
          : 'Automatic sending is paused. Campaigns are still saved.',
      });
    } catch (err) {
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="Payment Reminders"
          subtitle="Schedule automated email and WhatsApp reminders to collect payments"
        />
        {/* Auto-reminder global toggle */}
        <div className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3 shadow-sm shrink-0">
          <Zap className={`w-4 h-4 ${autoEnabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
          <div className="flex flex-col">
            <Label htmlFor="auto-toggle" className="text-sm font-semibold cursor-pointer">
              Auto Reminders
            </Label>
            <span className="text-xs text-muted-foreground">
              {autoEnabled ? 'Active – sending automatically' : 'Paused – no reminders sent'}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge variant={autoEnabled ? 'default' : 'secondary'} className="text-xs">
              {autoEnabled ? 'ON' : 'OFF'}
            </Badge>
            <Switch
              id="auto-toggle"
              checked={autoEnabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reminders</TabsTrigger>
        </TabsList>
        <TabsContent value="scheduled" className="mt-4">
          <ScheduledRemindersList key={refreshKey} />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <ReminderCampaignList key={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}