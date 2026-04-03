import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Send, Loader2, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function QuickReminderModal({ debtor, onClose }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const outstanding = debtor.total_outstanding || 0;

  const [subject, setSubject] = useState('Payment Reminder — Outstanding Invoice');
  const [body, setBody] = useState(
    `Dear ${debtor.name},\n\nThis is a friendly reminder that you have an outstanding balance of ${formatINR(outstanding)}.\n\nKindly arrange payment at the earliest convenience.\n\nThank you.`
  );

  const handleSend = async () => {
    if (!debtor.email) {
      toast({ title: 'No email on file for this debtor', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({ to: debtor.email, subject, body });
      toast({ title: `Reminder sent to ${debtor.email}` });
      onClose();
    } catch (err) {
      toast({ title: `Failed: ${err.message}`, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Send Reminder — {debtor.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {debtor.email ? (
            <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-3 py-2">
              Sending to: <span className="font-semibold">{debtor.email}</span>
            </div>
          ) : (
            <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-3 py-2">
              ⚠️ No email on file. Please add an email to the debtor record first.
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="text-sm resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !debtor.email}>
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}