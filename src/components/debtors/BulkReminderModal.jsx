import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, Mail, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function BulkReminderModal({ debtors, onClose, onSuccess }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [selectedDebtors, setSelectedDebtors] = useState(new Set());
  const [emailTemplateId, setEmailTemplateId] = useState('');

  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['messageTemplates', 'email'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list();
      return all.filter(t => t.type === 'email' && t.is_active !== false);
    },
  });

  const selectedDebtorsData = useMemo(() => {
    return Array.from(selectedDebtors).map(debtorId => 
      debtors.find(d => d.id === debtorId)
    ).filter(Boolean);
  }, [selectedDebtors, debtors]);

  const toggleDebtor = (debtorId) => {
    setSelectedDebtors(prev => {
      const next = new Set(prev);
      next.has(debtorId) ? next.delete(debtorId) : next.add(debtorId);
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedDebtorsData.length === 0) {
      toast({ title: 'Please select at least one debtor', variant: 'destructive' });
      return;
    }

    if (!emailTemplateId) {
      toast({ title: 'Please select an email template', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      let successCount = 0;
      const template = emailTemplates.find(t => t.id === emailTemplateId);

      if (!template) throw new Error('Template not found');

      for (const debtor of selectedDebtorsData) {
        try {
          if (!debtor.email) continue;

          const subject = (template.subject || `Payment Reminder - ${debtor.name}`)
            .replace(/\{\{company_name\}\}/g, debtor.name || '')
            .replace(/\{\{contact_person\}\}/g, debtor.contact_person || debtor.name || '');

          const body = (template.body || '')
            .replace(/\{\{contact_person\}\}/g, debtor.contact_person || debtor.name || '')
            .replace(/\{\{company_name\}\}/g, debtor.name || '')
            .replace(/\{\{outstanding_amount\}\}/g, `₹${(debtor.total_outstanding || 0).toLocaleString('en-IN')}`)
            .replace(/\{\{invoice_table\}\}/g, '');

          await base44.functions.invoke('sendGmailReminder', {
            to: debtor.email,
            subject,
            body,
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to send to ${debtor.name}:`, err);
        }
      }

      toast({
        title: `Reminders sent`,
        description: `Successfully sent ${successCount}/${selectedDebtorsData.length} email reminder(s)`,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      toast({ title: `Failed: ${err.message}`, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const selectAll = () => {
    if (selectedDebtors.size === debtors.length) {
      setSelectedDebtors(new Set());
    } else {
      setSelectedDebtors(new Set(debtors.map(d => d.id)));
    }
  };

  const debtorsWithEmail = debtors.filter(d => d.email);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Bulk Reminders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {debtorsWithEmail.length === 0 ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="text-red-700">No debtors have email addresses. Please update debtor contact info first.</span>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center justify-between p-2 bg-muted/40 rounded-lg border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedDebtors.size === debtorsWithEmail.length && debtorsWithEmail.length > 0}
                    onCheckedChange={selectAll}
                  />
                  <span className="text-sm font-semibold">Select All ({debtorsWithEmail.length})</span>
                </label>
              </div>

              {/* Debtor List */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Debtors
                </Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {debtorsWithEmail.map(debtor => (
                    <label key={debtor.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 p-2 rounded transition-colors">
                      <Checkbox
                        checked={selectedDebtors.has(debtor.id)}
                        onCheckedChange={() => toggleDebtor(debtor.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{debtor.name}</div>
                        <div className="text-xs text-muted-foreground">{debtor.email}</div>
                      </div>
                      {debtor.total_outstanding > 0 && (
                        <Badge variant="outline" className="text-xs shrink-0">₹{debtor.total_outstanding.toLocaleString('en-IN')}</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Template */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Email Template</Label>
                <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {emailTemplates.length === 0 && (
                  <p className="text-xs text-amber-600">No templates. Create one in Settings.</p>
                )}
              </div>

              {/* Summary */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <p><strong>Selected:</strong> {selectedDebtors.size} debtor{selectedDebtors.size !== 1 ? 's' : ''}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedDebtors.size === 0 || !emailTemplateId || debtorsWithEmail.length === 0}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            {sending ? 'Sending...' : 'Send Reminders'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}