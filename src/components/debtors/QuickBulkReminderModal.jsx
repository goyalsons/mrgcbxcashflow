import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, Mail, MessageSquare, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Handles both {{key}} and {key} placeholder syntaxes
function replacePlaceholders(text, data) {
  if (!text) return '';
  return text
    .replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] !== undefined ? data[key] : match)
    .replace(/\{(\w+)\}/g, (match, key) => data[key] !== undefined ? data[key] : match);
}

function buildInvoiceTable(invoices) {
  if (!invoices || invoices.length === 0) return '(No outstanding invoices found)';
  const rows = invoices.map(inv => {
    const outstanding = (inv.amount || 0) - (inv.amount_paid || 0);
    const dueDate = inv.due_date ? inv.due_date.split('T')[0] : '-';
    const overdue = inv.status === 'overdue' ? ' ⚠️ Overdue' : '';
    return `• Inv# ${inv.invoice_number || '-'}  |  Due: ${dueDate}  |  Outstanding: ₹${outstanding.toLocaleString('en-IN')}${overdue}`;
  }).join('\n');
  const total = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0);
  return rows + `\n${'─'.repeat(55)}\nTOTAL OUTSTANDING: ₹${total.toLocaleString('en-IN')}`;
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
      } catch (e) { /* ignore */ }
    }
    if (inv.document_url) {
      links.push(`  • Invoice ${inv.invoice_number || '-'}: ${inv.document_url}`);
    }
  });
  return links.length > 0 ? `Attachments:\n${links.join('\n')}` : '';
}

export default function QuickBulkReminderModal({ selectedInvoices, onClose, onSuccess }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState('email');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [whatsappTemplateId, setWhatsappTemplateId] = useState('');

  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['messageTemplates', 'email'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list();
      return all.filter(t => t.type === 'email' && t.is_active !== false);
    },
  });

  const { data: whatsappTemplates = [] } = useQuery({
    queryKey: ['messageTemplates', 'whatsapp'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list();
      return all.filter(t => t.type === 'whatsapp' && t.is_active !== false);
    },
  });

  // Invoice entity uses debtor_id / debtor_name (not customer_id / customer_name)
  const uniqueCustomers = useMemo(() => {
    const seen = new Set();
    const groups = {};
    selectedInvoices.forEach(inv => {
      const key = inv.debtor_id || inv.debtor_name || inv.customer_id || inv.customer_name || '';
      if (!key) return;
      if (!groups[key]) {
        groups[key] = {
          id: inv.debtor_id || inv.customer_id || '',
          name: inv.debtor_name || inv.customer_name || '',
          email: inv.customer_email || inv.debtor_email || '',
          phone: inv.customer_phone || inv.debtor_phone || '',
          contact_person: inv.contact_person || '',
          invoices: [],
        };
      }
      groups[key].invoices.push(inv);
    });
    return Object.values(groups);
  }, [selectedInvoices]);

  // Enrich customer list with emails/phones from Customer entity
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    staleTime: 60000,
  });

  const enrichedCustomers = useMemo(() => {
    return uniqueCustomers.map(uc => {
      if (uc.email && uc.phone) return uc; // already has info
      const match = customers.find(c =>
        c.id === uc.id ||
        c.name?.toLowerCase() === uc.name?.toLowerCase()
      );
      return {
        ...uc,
        email: uc.email || match?.email || '',
        phone: uc.phone || match?.phone || '',
        contact_person: uc.contact_person || match?.contact_person || '',
      };
    });
  }, [uniqueCustomers, customers]);

  const handleSend = async () => {
    const selectedTemplate = channel === 'email' ? emailTemplateId : whatsappTemplateId;
    if (!selectedTemplate) {
      toast({ title: `Please select a ${channel} template`, variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      let successCount = 0;
      let skipCount = 0;
      const template = channel === 'email'
        ? emailTemplates.find(t => t.id === selectedTemplate)
        : whatsappTemplates.find(t => t.id === selectedTemplate);

      if (!template) throw new Error('Template not found');

      for (const customer of enrichedCustomers) {
        try {
          const invoiceTable = buildInvoiceTable(customer.invoices || []);
          const totalOutstanding = (customer.invoices || []).reduce(
            (s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0
          );
          const contactName = customer.contact_person || customer.name || '';
          const firstInv = customer.invoices?.[0] || {};

          // Unified placeholder data for both {{key}} and {key} syntaxes
          const attachmentText = buildAttachmentLinks(customer.invoices || []);
          const placeholderData = {
            contact_person: contactName,
            debtor_name: customer.name || '',
            company_name: customer.name || '',
            outstanding_amount: totalOutstanding.toLocaleString('en-IN'),
            invoice_table: invoiceTable,
            attachments: attachmentText,
            invoice_number: firstInv.invoice_number || '',
            amount: firstInv.amount?.toLocaleString('en-IN') || '',
            due_date: firstInv.due_date ? firstInv.due_date.split('T')[0] : '',
          };

          if (channel === 'email') {
            if (!customer.email) { skipCount++; continue; }

            const subject = replacePlaceholders(template.subject || `Payment Reminder - ${customer.name}`, placeholderData);
            const body = replacePlaceholders(template.body || '', placeholderData);

            await base44.functions.invoke('sendGmailReminder', { to: customer.email, subject, body });
            successCount++;

          } else if (channel === 'whatsapp') {
            if (!customer.phone) { skipCount++; continue; }

            const waSettings = (() => { try { return JSON.parse(localStorage.getItem('cashflow_pro_settings') || '{}').whatsapp || {}; } catch { return {}; } })();

            // Replace all named placeholders in the body
            const processedBody = replacePlaceholders(template.body || '', placeholderData);

            // Build templateVariables array for numbered placeholders {{1}}, {{2}}, etc.
            // If no numbered placeholders, pass an empty array (body is pre-rendered)
            const numberedMatches = (template.body || '').match(/\{\{(\d+)\}\}/g) || [];
            const templateVariables = numberedMatches.length > 0
              ? [contactName, customer.name || '', `₹${totalOutstanding.toLocaleString('en-IN')}`, firstInv.invoice_number || '', firstInv.due_date?.split('T')[0] || ''].slice(0, numberedMatches.length)
              : [];

            await base44.functions.invoke('sendWhatsAppMessage', {
              action: 'sendMessage',
              to: customer.phone,
              templateName: template.meta_template_name || template.name,
              language: 'en',
              templateVariables,
              messageBody: processedBody,
              api_key: waSettings.api_key || '',
              phone_id: waSettings.phone_id || '',
            });
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to send to ${customer.name}:`, err);
        }
      }

      const total = enrichedCustomers.length;
      toast({
        title: 'Reminders sent',
        description: `Sent ${successCount}/${total} ${channel} reminder(s)${skipCount > 0 ? ` (${skipCount} skipped — missing contact)` : ''}`,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      toast({ title: `Failed: ${err.message}`, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const templateList = channel === 'email' ? emailTemplates : whatsappTemplates;
  const selectedTemplateId = channel === 'email' ? emailTemplateId : whatsappTemplateId;
  const setSelectedTemplateId = channel === 'email' ? setEmailTemplateId : setWhatsappTemplateId;


  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Reminders to {enrichedCustomers.length} Customer{enrichedCustomers.length !== 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Channel</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setChannel('email')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  channel === 'email'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Mail className="w-3.5 h-3.5 inline mr-1.5" />
                Email
              </button>
              <button
                onClick={() => setChannel('whatsapp')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  channel === 'whatsapp'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />
                WhatsApp
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templateList.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.meta_template_name || t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templateList.length === 0 && (
              <p className="text-xs text-amber-600">No templates. Create one in Settings.</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1.5 max-h-36 overflow-y-auto">
            <p className="font-semibold mb-1">Recipients ({enrichedCustomers.length}):</p>
            {enrichedCustomers.length === 0 ? (
              <p className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No recipients found. Make sure invoices are linked to customers with contact info.</p>
            ) : enrichedCustomers.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.name || '(Unknown)'}</span>
                <span className="text-blue-500 truncate">
                  {channel === 'email'
                    ? (c.email || <span className="text-amber-600">No email</span>)
                    : (c.phone || <span className="text-amber-600">No phone</span>)
                  }
                </span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !selectedTemplateId || enrichedCustomers.length === 0}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            {sending ? 'Sending...' : 'Send Reminders'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}