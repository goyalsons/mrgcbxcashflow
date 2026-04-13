import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, Mail, Eye, EyeOff, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';

function buildInvoiceTable(invoices) {
  const rows = invoices.map(inv => {
    const outstanding = (inv.amount || 0) - (inv.amount_paid || 0);
    const dueDate = inv.due_date ? format(parseISO(inv.due_date), 'dd/MM/yyyy') : '-';
    const invDate = inv.invoice_date ? format(parseISO(inv.invoice_date), 'dd/MM/yyyy') : '-';
    const overdue = inv.status === 'overdue' ? ' ⚠️ Overdue' : '';
    return `  • Inv# ${inv.invoice_number || '-'}  |  Date: ${invDate}  |  Due: ${dueDate}  |  Outstanding: ₹${outstanding.toLocaleString('en-IN')}${overdue}`;
  }).join('\n');
  const total = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0);
  return rows + `\n${'─'.repeat(60)}\n  TOTAL OUTSTANDING: ₹${total.toLocaleString('en-IN')}`;
}

function buildAttachmentLinks(invoices) {
  const links = [];
  invoices.forEach(inv => {
    if (inv.attachments) {
      try {
        const arr = JSON.parse(inv.attachments);
        arr.forEach(a => {
          if (a.url) links.push(`  • ${a.name || 'Attachment'} (Inv# ${inv.invoice_number || '-'}): ${a.url}`);
        });
      } catch (e) { /* ignore parse errors */ }
    }
    if (inv.document_url && !inv.attachments) {
      links.push(`  • Invoice ${inv.invoice_number || '-'}: ${inv.document_url}`);
    }
  });
  return links.length > 0 ? `Attachments:\n${links.join('\n')}` : '';
}

export default function QuickReminderModal({ debtor, onClose }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState(debtor.email || '');
  const [resolvedPhone, setResolvedPhone] = useState(debtor.phone || '');
  const [resolvedContactPerson, setResolvedContactPerson] = useState(debtor.contact_person || debtor.name || '');
  const [subject, setSubject] = useState(`Payment Reminder - ${debtor.name || ''}`);
  const [body, setBody] = useState(`Dear ${debtor.contact_person || debtor.name || ''},\n\nLoading invoice details...`);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);

  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list(),
    select: (data) => data.filter(t => t.type === 'email'),
  });

  const getSignature = () => {
    try {
      const s = JSON.parse(localStorage.getItem('cashflow_pro_settings') || '{}');
      const c = s.company || {};
      const lines = [];
      if (c.contact_person) lines.push(c.contact_person);
      if (c.name) lines.push(c.name);
      if (c.phone) lines.push(`Phone: ${c.phone}`);
      if (c.email) lines.push(`Email: ${c.email}`);
      if (c.website) lines.push(c.website);
      return lines.length > 0 ? `\n\n--\n${lines.join('\n')}` : '';
    } catch (e) { return ''; }
  };

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('cashflow_pro_settings') || '{}');
      if (s.defaultReminderTemplateId) setSelectedTemplateId(s.defaultReminderTemplateId);
    } catch (e) {}
  }, []);

  const applyTemplate = (templateId, invoiceList, totalAmt, contactPerson) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (!template) return;
    const table = buildInvoiceTable(
      invoiceList.length > 0 ? invoiceList :
      [{ invoice_number: '-', amount: totalAmt, amount_paid: 0, due_date: null, invoice_date: null, status: 'pending' }]
    );
    const contact = contactPerson || debtor.name || '';
    const newSubject = (template.subject || `Payment Reminder - ${debtor.name}`)
      .replace(/\{\{company_name\}\}/g, debtor.name || '')
      .replace(/\{\{contact_person\}\}/g, contact);
    const attachmentText = buildAttachmentLinks(invoiceList);
    const newBody = (template.body || '')
      .replace(/\{\{contact_person\}\}/g, contact)
      .replace(/\{\{company_name\}\}/g, debtor.name || '')
      .replace(/\{\{outstanding_amount\}\}/g, `₹${totalAmt.toLocaleString('en-IN')}`)
      .replace(/\{\{invoice_table\}\}/g, table)
      .replace(/\{\{attachments\}\}/g, attachmentText);
    setSubject(newSubject);
    setBody(newBody + getSignature());
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    const total = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0) || debtor.total_outstanding || 0;
    applyTemplate(templateId, invoices, total, resolvedContactPerson);
  };

  useEffect(() => {
    base44.entities.Customer.list()
      .then(customers => {
        const match = customers.find(c =>
          c.name?.toLowerCase() === debtor.name?.toLowerCase()
        );
        if (match) {
          if (match.email && !resolvedEmail) setResolvedEmail(match.email);
          if (match.phone && !resolvedPhone) setResolvedPhone(match.phone);
          if (match.contact_person) setResolvedContactPerson(match.contact_person);
        }
      })
      .catch(() => {});
  }, [debtor.name]);

  useEffect(() => {
    base44.entities.Invoice.list('-created_date', 500)
      .then(all => {
        const forThisDebtor = all.filter(inv => {
          if (debtor.id) return inv.debtor_id === debtor.id;
          return inv.debtor_name?.toLowerCase() === debtor.name?.toLowerCase();
        });
        const outstanding = forThisDebtor.filter(i => ['pending', 'overdue', 'partial'].includes(i.status));
        setInvoices(outstanding);
        const table = buildInvoiceTable(
          outstanding.length > 0
            ? outstanding
            : [{ invoice_number: '-', amount: debtor.total_outstanding || 0, amount_paid: 0, due_date: null, invoice_date: null, status: 'pending' }]
        );
        const total = outstanding.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0) || debtor.total_outstanding || 0;
        if (selectedTemplateId) {
          applyTemplate(selectedTemplateId, outstanding, total, resolvedContactPerson);
        } else {
          const attachmentText = buildAttachmentLinks(outstanding);
          const attachmentSection = attachmentText ? `\n\n${attachmentText}` : '';
          const contactName = resolvedContactPerson || debtor.name;
          setSubject(`Payment Reminder - ${debtor.name || ''}`);
          setBody(`Dear ${contactName},\n\nThis is a friendly reminder regarding the following outstanding dues:\n\n${table}\n\nKindly arrange payment at the earliest convenience. If you have already made the payment, please disregard this message.${attachmentSection}\n\nThank you.${getSignature()}`);
        }
        setIsInitializing(false);
      })
      .catch(() => setIsInitializing(false))
      .finally(() => setLoadingInvoices(false));
  }, [debtor.id, debtor.name, resolvedContactPerson]);

  const totalOutstanding = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0) || debtor.total_outstanding || 0;

  const handleSend = async () => {
    if (!resolvedEmail) {
      toast({ title: 'No email found for this company', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendGmailReminder', { to: resolvedEmail, subject, body });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: `Reminder sent to ${resolvedEmail}` });
      onClose();
    } catch (err) {
      toast({ title: `Failed: ${err.message}`, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Send Reminder — {debtor.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {resolvedEmail ? (
            <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-3 py-2">
              Sending to: <span className="font-semibold">{resolvedEmail}</span>
              {resolvedPhone && <span className="ml-3 text-emerald-600">📞 {resolvedPhone}</span>}
            </div>
          ) : (
            <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-3 py-2">
              ⚠️ No email found in debtor or customer records. Please add an email first.
            </div>
          )}

          {loadingInvoices ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading invoices...
            </div>
          ) : invoices.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> {invoices.length} Outstanding Invoice{invoices.length > 1 ? 's' : ''}
                </span>
                <span className="text-xs font-bold text-primary">Total: ₹{totalOutstanding.toLocaleString('en-IN')}</span>
              </div>
              <div className="divide-y max-h-40 overflow-y-auto">
                {invoices.map(inv => {
                  const out = (inv.amount || 0) - (inv.amount_paid || 0);
                  return (
                    <div key={inv.id} className="px-3 py-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted-foreground">{inv.invoice_number || '—'}</span>
                        {inv.due_date && <span className="text-muted-foreground">Due: {format(parseISO(inv.due_date), 'dd/MM/yyyy')}</span>}
                        {inv.status === 'overdue' && <span className="text-red-600 font-medium">⚠️ Overdue</span>}
                      </div>
                      <span className="font-semibold">₹{out.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {emailTemplates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-xs">Email Message</Label>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowPreview(p => !p)}>
              {showPreview ? <><EyeOff className="w-3.5 h-3.5" /> Edit</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-9" disabled={showPreview} />
          </div>

          {showPreview ? (
            <div className="border rounded-lg bg-white p-4 text-sm whitespace-pre-wrap font-mono text-foreground max-h-64 overflow-y-auto shadow-inner">
              <div className="text-xs text-muted-foreground mb-2 font-sans border-b pb-2">
                <strong>To:</strong> {resolvedEmail || '—'}<br />
                <strong>Subject:</strong> {subject}
              </div>
              {body}
            </div>
          ) : (
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="text-xs font-mono resize-none" />
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !resolvedEmail}>
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {sending ? 'Sending...' : 'Send Reminder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}