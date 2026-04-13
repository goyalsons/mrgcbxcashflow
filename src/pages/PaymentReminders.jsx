import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import ReminderCampaignForm from '@/components/paymentreminders/ReminderCampaignForm';
import ReminderCampaignList from '@/components/paymentreminders/ReminderCampaignList';
import ScheduledRemindersList from '@/components/paymentreminders/ScheduledRemindersList';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function PaymentReminders() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Reminders"
        subtitle="Schedule automated email and WhatsApp reminders to collect payments"
      />
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