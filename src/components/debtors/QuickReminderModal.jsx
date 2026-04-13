import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Send, Loader2, Mail, Eye, EyeOff, FileText } from 'lucide-react';
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

export default function QuickReminderModal({ debtor, onClose }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    base44.entities.Invoice.filter({ debtor_id: debtor.id })
      .then(all => {
        const outstanding = all.filter(i => ['pending', 'overdue', 'partial'].includes(i.status));
        setInvoices(outstanding);
        const table = buildInvoiceTable(outstanding.length > 0 ? outstanding : [{ invoice_number: '-', amount: debtor.total_outstanding || 0, amount_paid: 0, due_date: null, invoice_date: null, status: 'pending' }]);
        setBody(`Dear ${debtor.name},\n\nThis is a friendly reminder regarding the following outstanding dues:\n\n${table}\n\nKindly arrange payment at the earliest convenience. If you have already made the payment, please disregard this message.\n\nThank you.`);
      })
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, [debtor.id]);

  const [subject, setSubject] = useState(`Payment Reminder — ${debtor.name}`);
  const [body, setBody] = useState(`Dear ${debtor.name},\n\nLoading invoice details...`);

  const totalOutstanding = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0) || debtor.total_outstanding || 0;

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Send Reminder — {debtor.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Email recipient */}
          {debtor.email ? (
            <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-3 py-2">
              Sending to: <span className="font-semibold">{debtor.email}</span>
            </div>
          ) : (
            <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-3 py-2">
              ⚠️ No email on file. Please add an email to the debtor record first.
            </div>
          )}

          {/* Invoice summary table */}
          {loadingInvoices ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading invoices...
            </div>
          ) : invoices.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {invoices.length} Outstanding Invoice{invoices.length > 1 ? 's' : ''}</span>
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

          {/* Toggle preview / edit */}
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
                <strong>To:</strong> {debtor.email || '—'}<br />
                <strong>Subject:</strong> {subject}
              </div>
              {body}
            </div>
          ) : (
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="text-xs font-mono resize-none" />
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !debtor.email}>
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {sending ? 'Sending...' : 'Send Reminder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}