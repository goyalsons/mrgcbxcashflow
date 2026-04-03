import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Mail, Phone, MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { useToast } from '@/components/ui/use-toast';

// ── Reminder Email Modal ──────────────────────────────────────────────────────
function ReminderModal({ receivables, onClose }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('Payment Reminder');
  const [body, setBody] = useState(() => {
    return `Dear {customer_name},\n\nWe have {invoice_count} pending invoice(s) awaiting payment:\n\n{invoices}\n\nTotal Outstanding: {amount}\n\nKindly arrange payment at the earliest.\n\nThank you.`;
  });
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list(),
  });
  
  const emailTemplates = templates.filter(t => t.type === 'email');
  const whatsappTemplates = templates.filter(t => t.type === 'whatsapp');

  // Fetch all customers to map emails
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  // Group receivables by company name and fetch email from Customer master
  const customerGroups = useMemo(() => {
    const groups = {};
    receivables.forEach(r => {
      // Match customer by name
      const customerName = r.customer_name;
      if (customerName) {
        const customer = allCustomers.find(c => c.name && c.name.toLowerCase() === customerName.toLowerCase());
        if (customer && customer.email) {
          const key = customer.id || customerName;
          if (!groups[key]) {
            groups[key] = {
              email: customer.email,
              customer: customer.name || customerName,
              receivables: [],
            };
          }
          groups[key].receivables.push(r);
        }
      }
    });
    return Object.values(groups);
  }, [receivables, allCustomers]);

  const handleTemplateChange = (id) => {
    setTemplateId(id);
    const template = templates.find(t => t.id === id);
    if (template) {
      setSubject(template.subject || 'Payment Reminder');
      setBody(template.body);
    }
  };

  const handleSend = async () => {
    if (!customerGroups.length) {
      toast({ title: 'No customers found', variant: 'destructive' });
      return;
    }
    if (!sendEmail && !sendWhatsapp) {
      toast({ title: 'Select at least one channel (Email or WhatsApp)', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const promises = customerGroups.flatMap(({ email, phone, customer, receivables: custReceivables }) => {
        const invoiceList = custReceivables
          .map((r, idx) => {
            const outstanding = (r.amount || 0) - (r.amount_received || 0);
            return `  ${idx + 1}. Invoice ${r.invoice_number || '-'}\n     Amount: ${formatINR(outstanding)}\n     Due: ${formatDateIN(r.due_date)}`;
          })
          .join('\n\n');
        
        const totalOutstanding = formatINR(custReceivables.reduce((s, r) => s + ((r.amount || 0) - (r.amount_received || 0)), 0));
        
        const customBody = body
          .replace(/{customer_name}/g, customer)
          .replace(/{invoices}/g, invoiceList)
          .replace(/{amount}/g, totalOutstanding)
          .replace(/{due_date}/g, custReceivables[0]?.due_date || '')
          .replace(/{invoice_count}/g, custReceivables.length);

        const actions = [];
        if (sendEmail && email) {
          actions.push(base44.integrations.Core.SendEmail({ to: email, subject, body: customBody }));
        }
        if (sendWhatsapp && phone) {
          const whatsappMsg = `Hi ${customer}, you have ${custReceivables.length} pending invoice(s) totaling ${totalOutstanding}. Please arrange payment.`;
          actions.push(
            fetch('https://graph.instagram.com/v17.0/your-phone-id/messages', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: phone.replace(/\D/g, ''),
                type: 'text',
                text: { body: whatsappMsg },
              }),
            }).catch(() => null)
          );
        }
        return actions;
      });

      await Promise.all(promises);
      const channels = [sendEmail && 'Email', sendWhatsapp && 'WhatsApp'].filter(Boolean).join(' & ');
      toast({ title: `${channels} sent to ${customerGroups.length} customer${customerGroups.length > 1 ? 's' : ''}` });
      onClose();
    } catch (err) {
      toast({ title: `Failed to send: ${err.message}`, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Send Payment Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Recipients ({customerGroups.length})</p>
            {customerGroups.map(({ email, customer, receivables: custReceivables }) => (
              <div key={email} className="flex justify-between text-sm">
                <span>{customer} ({custReceivables.length} inv)</span>
                <span className="font-semibold text-red-600">{formatINR(custReceivables.reduce((s, r) => s + ((r.amount || 0) - (r.amount_received || 0)), 0))}</span>
              </div>
            ))}
          </div>
          {customerGroups.length > 0 ? (
            <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">✓ Reminders will be sent to {customerGroups.length} customer{customerGroups.length > 1 ? 's' : ''}</div>
          ) : (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">No customers found. Ensure customer email/phone is on file.</div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-primary/5" onClick={() => setSendEmail(!sendEmail)}>
              <input type="checkbox" checked={sendEmail} readOnly className="cursor-pointer" />
              <label className="text-xs font-medium cursor-pointer flex-1">Email</label>
            </div>
            <div className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-primary/5" onClick={() => setSendWhatsapp(!sendWhatsapp)}>
              <input type="checkbox" checked={sendWhatsapp} readOnly className="cursor-pointer" />
              <label className="text-xs font-medium cursor-pointer flex-1">WhatsApp</label>
            </div>
          </div>

          {sendEmail && (
            <div className="space-y-1.5">
              <Label className="text-xs">Email Template {emailTemplates.length > 0 ? `(${emailTemplates.length})` : ''}</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder={emailTemplates.length > 0 ? "Select a template..." : "No templates created"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Custom Message —</SelectItem>
                  {emailTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {emailTemplates.length === 0 && (
                <p className="text-xs text-muted-foreground">Create templates in Settings → Message Templates</p>
              )}
            </div>
          )}
          {sendEmail && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Email Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email Message <span className="text-muted-foreground text-xs font-normal ml-1">(Use {'{customer_name}'}, {'{invoices}'}, {'{amount}'}, {'{invoice_count}'}, {'{due_date}'} as placeholders)</span></Label>
                <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5} className="text-sm resize-none" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !customerGroups.length}>
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {sending ? 'Sending...' : `Send to ${customerGroups.length}`}
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

      {activeModal === 'followup' && (
        <FollowUpModal receivables={selectedReceivables} type="note" onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'call' && (
        <FollowUpModal receivables={selectedReceivables} type="call" onClose={() => setActiveModal(null)} />
      )}
    </>
  );
}