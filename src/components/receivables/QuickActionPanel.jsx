import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Mail, Phone, MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { useToast } from '@/components/ui/use-toast';

// ── Reminder Email Modal ──────────────────────────────────────────────────────
function ReminderModal({ receivables, onClose }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('Payment Reminder');
  const [body, setBody] = useState(() => {
    const lines = receivables.map(r =>
      `• Invoice ${r.invoice_number || '-'} — ${formatINR((r.amount || 0) - (r.amount_received || 0))} due ${formatDateIN(r.due_date)}`
    ).join('\n');
    return `Dear Customer,\n\nThis is a gentle reminder that the following invoice(s) are pending:\n\n${lines}\n\nKindly arrange payment at the earliest.\n\nThank you.`;
  });

  const emails = [...new Set(receivables.map(r => r.customer_email).filter(Boolean))];

  const handleSend = async () => {
    if (!emails.length) {
      toast({ title: 'No email address found on selected receivables', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      await Promise.all(emails.map(to =>
        base44.integrations.Core.SendEmail({ to, subject, body })
      ));
      toast({ title: `Reminder sent to ${emails.join(', ')}` });
      onClose();
    } catch {
      toast({ title: 'Failed to send reminder', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Send Payment Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Selected ({receivables.length})</p>
            {receivables.map(r => (
              <div key={r.id} className="flex justify-between text-sm">
                <span>{r.customer_name} — {r.invoice_number || 'No #'}</span>
                <span className="font-semibold text-red-600">{formatINR((r.amount || 0) - (r.amount_received || 0))}</span>
              </div>
            ))}
          </div>
          {emails.length > 0 ? (
            <div className="text-xs text-muted-foreground">Sending to: <span className="font-medium text-foreground">{emails.join(', ')}</span></div>
          ) : (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">No customer email on file. Add email to the receivable records first.</div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="text-sm resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !emails.length}>
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {sending ? 'Sending...' : 'Send Reminder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Follow-Up Log Modal ───────────────────────────────────────────────────────
function FollowUpModal({ receivables, type, onClose }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [followUpType, setFollowUpType] = useState(type || 'call');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextDate, setNextDate] = useState('');
  const today = new Date().toISOString().split('T')[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(receivables.map(r =>
        base44.entities.FollowUp.create({
          debtor_id: r.customer_id || '',
          debtor_name: r.customer_name,
          type: followUpType,
          follow_up_date: today,
          notes,
          outcome: outcome || undefined,
          next_follow_up_date: nextDate || undefined,
        })
      ));
      toast({ title: `Follow-up logged for ${receivables.length} item(s)` });
      onClose();
    } catch {
      toast({ title: 'Failed to log follow-up', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const icon = type === 'call' ? '📞' : type === 'email' ? '📧' : '💬';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'call' ? <Phone className="w-4 h-4 text-primary" /> : <MessageSquare className="w-4 h-4 text-primary" />}
            Log Follow-Up {icon}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
            {receivables.map(r => (
              <div key={r.id} className="flex justify-between">
                <span>{r.customer_name} — {r.invoice_number || 'No #'}</span>
                <span className="font-semibold text-red-600">{formatINR((r.amount || 0) - (r.amount_received || 0))}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={followUpType} onValueChange={setFollowUpType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="visit">🏢 Visit</SelectItem>
                  <SelectItem value="sms">📱 SMS</SelectItem>
                  <SelectItem value="note">📝 Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="promised_payment">Promised Payment</SelectItem>
                  <SelectItem value="partial_commitment">Partial Commitment</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes *</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was discussed?" rows={3} className="resize-none" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next Follow-Up Date</Label>
            <Input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="h-9" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !notes.trim()}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Log Follow-Up'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk Action Bar ───────────────────────────────────────────────────────────
export default function QuickActionBar({ selectedReceivables, onClear }) {
  const [activeModal, setActiveModal] = useState(null); // 'reminder' | 'followup' | 'call'

  if (!selectedReceivables.length) return null;

  const totalSelected = selectedReceivables.reduce((s, r) => s + ((r.amount || 0) - (r.amount_received || 0)), 0);

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background rounded-full shadow-2xl px-5 py-3 border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{selectedReceivables.length} selected</span>
          <span className="text-xs text-muted-foreground bg-muted/20 rounded-full px-2 py-0.5">{formatINR(totalSelected)}</span>
        </div>
        <div className="w-px h-5 bg-muted-foreground/30" />
        <Button size="sm" variant="secondary" onClick={() => setActiveModal('reminder')} className="h-8 gap-1.5 rounded-full text-xs">
          <Mail className="w-3.5 h-3.5" /> Reminder
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setActiveModal('followup')} className="h-8 gap-1.5 rounded-full text-xs">
          <MessageSquare className="w-3.5 h-3.5" /> Follow-Up
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setActiveModal('call')} className="h-8 gap-1.5 rounded-full text-xs">
          <Phone className="w-3.5 h-3.5" /> Log Call
        </Button>
        <button onClick={onClear} className="ml-1 text-muted-foreground hover:text-background transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeModal === 'reminder' && (
        <ReminderModal receivables={selectedReceivables} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'followup' && (
        <FollowUpModal receivables={selectedReceivables} type="note" onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'call' && (
        <FollowUpModal receivables={selectedReceivables} type="call" onClose={() => setActiveModal(null)} />
      )}
    </>
  );
}