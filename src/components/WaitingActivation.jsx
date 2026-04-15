import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export default function WaitingActivation() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-md w-full mx-4 p-8 bg-card rounded-xl shadow-lg border border-border text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-amber-100">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Waiting for Activation</h1>
        <p className="text-muted-foreground mb-6">
          Your account has been created but is pending activation by an administrator.
          You will be notified once your account has been activated.
        </p>
        <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground mb-6">
          <p>In the meantime, you can:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-left">
            <li>Contact your administrator to expedite activation</li>
            <li>Verify you signed in with the correct email address</li>
          </ul>
        </div>
        <Button variant="outline" onClick={() => base44.auth.logout()}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}