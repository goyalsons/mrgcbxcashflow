import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, Mail, MessageSquare } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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

  const getUniqueDebitors = () => {
    const seen = new Set();
    return selectedInvoices
      .filter(inv => {
        const key = `${inv.debtor_id || inv.debtor_name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const uniqueDebitors = getUniqueDebitors();

  const handleSend = async () => {
    const selectedTemplate = channel === 'email' ? emailTemplateId : whatsappTemplateId;
    
    if (!selectedTemplate) {
      toast({ title: `Please select a ${channel} template`, variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      let successCount = 0;
      const template = channel === 'email' 
        ? emailTemplates.find(t => t.id === selectedTemplate)
        : whatsappTemplates.find(t => t.id === selectedTemplate);

      if (!template) throw new Error('Template not found');

      // For each unique debtor, send reminder
      for (const inv of uniqueDebitors) {
        try {
          if (channel === 'email') {
            const debtor = inv; // Has email field
            if (!debtor.email) continue;
            
            const subject = (template.subject || `Payment Reminder - ${inv.debtor_name}`)
              .replace(/\{\{company_name\}\}/g, inv.debtor_name || '')
              .replace(/\{\{contact_person\}\}/g, inv.contact_person || inv.debtor_name || '');

            const body = (template.body || '')
              .replace(/\{\{contact_person\}\}/g, inv.contact_person || inv.debtor_name || '')
              .replace(/\{\{company_name\}\}/g, inv.debtor_name || '')
              .replace(/\{\{outstanding_amount\}\}/g, '₹0')
              .replace(/\{\{invoice_table\}\}/g, '');

            await base44.functions.invoke('sendGmailReminder', {
              to: debtor.email,
              subject,
              body,
            });
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to send to ${inv.debtor_name}:`, err);
        }
      }

      toast({
        title: `Reminders sent`,
        description: `Successfully sent ${successCount}/${uniqueDebitors.length} ${channel} reminder(s)`,
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
          <DialogTitle>Send Reminders to {uniqueDebitors.length} Debtor{uniqueDebitors.length > 1 ? 's' : ''}</DialogTitle>
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
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templateList.length === 0 && (
              <p className="text-xs text-amber-600">No templates. Create one in Settings.</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <p><strong>Recipients:</strong> {uniqueDebitors.map(d => d.debtor_name).join(', ')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !selectedTemplateId}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            {sending ? 'Sending...' : 'Send Reminders'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}