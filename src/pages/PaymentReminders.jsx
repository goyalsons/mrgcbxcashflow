import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import ReminderCampaignForm from '@/components/paymentreminders/ReminderCampaignForm';
import ReminderCampaignList from '@/components/paymentreminders/ReminderCampaignList';

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
      <ReminderCampaignForm onSuccess={handleSuccess} key={refreshKey} />
      <div>
        <h2 className="text-lg font-semibold mb-4">Active Campaigns</h2>
        <ReminderCampaignList key={refreshKey} />
      </div>
    </div>
  );
}