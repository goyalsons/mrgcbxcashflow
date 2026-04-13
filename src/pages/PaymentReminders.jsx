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
      <Tabs defaultValue="scheduled">
        <TabsList>
          <TabsTrigger value="scheduled">Scheduled Reminders</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="new">New Campaign (Manual)</TabsTrigger>
        </TabsList>
        <TabsContent value="scheduled" className="mt-4">
          <ScheduledRemindersList key={refreshKey} />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <ReminderCampaignList key={refreshKey} />
        </TabsContent>
        <TabsContent value="new" className="mt-4">
          <ReminderCampaignForm onSuccess={handleSuccess} key={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}