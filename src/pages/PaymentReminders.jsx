import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Mail, Send, Plus, Pencil, Trash2, MoreHorizontal, Bell, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

const DEFAULT_TEMPLATES = {
  whatsapp_reminder: `Dear {{name}},\n\nThis is a friendly reminder that your payment of {{amount}} is due on {{due_date}}.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n{{company_name}}`,
  email_reminder: `Dear {{name}},\n\nWe hope this email finds you well. We would like to remind you that invoice {{invoice_number}} for {{amount}} is due on {{due_date}}.\n\nKindly process the payment to avoid any late charges.\n\nBest regards,\n{{company_name}}`,
};

function TemplateEditor({ template, onClose, onSave }) {
  const [form, setForm] = useState(template || { name: '', type: 'whatsapp', subject: '', body: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{template?.id ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Channel *</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="sms">📱 SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.type === 'email' && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Payment Reminder — {{company_name}}" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Message Body *</Label>
            <Textarea value={form.body} onChange={e => set('body', e.target.value)} rows={6} required placeholder="Use {{name}}, {{amount}}, {{due_date}}, {{invoice_number}}, {{company_name}}" />
            <p className="text-xs text-muted-foreground">Placeholders: {'{{name}}'}, {'{{amount}}'}, {'{{due_date}}'}, {'{{invoice_number}}'}, {'{{company_name}}'}, {'{{outstanding}}'}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Template'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PaymentReminders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDebtors, setSelectedDebtors] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [schedule, setSchedule] = useState('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [sending, setSending] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [sentLog, setSentLog] = useState([]);

  const { data: debtors = [] } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list('-created_date'),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list(),
  });

  const activeDebtors = debtors.filter(d => (d.total_outstanding || 0) > 0);
  const filteredTemplates = templates.filter(t => t.type === channel && t.is_active !== false);

  const selectedTemplateObj = templates.find(t => t.id === selectedTemplate);

  const createTemplateMut = useMutation({
    mutationFn: (data) => base44.entities.MessageTemplate.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }); setShowTemplateEditor(false); setEditingTemplate(null); toast({ title: 'Template saved' }); },
  });
  const updateTemplateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MessageTemplate.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }); setShowTemplateEditor(false); setEditingTemplate(null); toast({ title: 'Template updated' }); },
  });
  const deleteTemplateMut = useMutation({
    mutationFn: (id) => base44.entities.MessageTemplate.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }); toast({ title: 'Template deleted' }); },
  });

  const handleTemplateSave = (data) => {
    if (editingTemplate?.id) updateTemplateMut.mutate({ id: editingTemplate.id, data });
    else createTemplateMut.mutate(data);
  };

  const toggleDebtor = (id) => {
    setSelectedDebtors(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    setSelectedDebtors(prev => prev.length === activeDebtors.length ? [] : activeDebtors.map(d => d.id));
  };

  const fillTemplate = (template, debtor) => {
    if (!template) return '';
    return template.body
      .replace(/{{name}}/g, debtor.contact_person || debtor.name)
      .replace(/{{amount}}/g, formatINR(debtor.total_outstanding))
      .replace(/{{outstanding}}/g, formatINR(debtor.total_outstanding))
      .replace(/{{due_date}}/g, 'as per invoice')
      .replace(/{{invoice_number}}/g, 'multiple invoices')
      .replace(/{{company_name}}/g, 'CashFlow Pro');
  };

  const handleSend = async () => {
    if (!selectedDebtors.length) { toast({ title: 'Select at least one debtor', variant: 'destructive' }); return; }
    if (!selectedTemplate) { toast({ title: 'Select a template', variant: 'destructive' }); return; }
    setSending(true);

    const targetDebtors = debtors.filter(d => selectedDebtors.includes(d.id));
    const results = [];

    for (const debtor of targetDebtors) {
      const message = fillTemplate(selectedTemplateObj, debtor);
      if (channel === 'email' && debtor.email) {
        await base44.integrations.Core.SendEmail({
          to: debtor.email,
          subject: selectedTemplateObj?.subject?.replace(/{{company_name}}/g, 'CashFlow Pro') || 'Payment Reminder',
          body: message,
        });
        results.push({ debtor: debtor.name, channel: 'email', status: 'sent', time: new Date().toLocaleTimeString() });
      } else if (channel === 'whatsapp') {
        // WhatsApp: log as pending (requires WhatsApp Business API)
        results.push({ debtor: debtor.name, channel: 'whatsapp', status: 'queued', phone: debtor.phone, message, time: new Date().toLocaleTimeString() });
      } else {
        results.push({ debtor: debtor.name, channel, status: 'no_contact', time: new Date().toLocaleTimeString() });
      }
    }

    setSentLog(prev => [...results, ...prev]);
    setSending(false);
    setSelectedDebtors([]);
    toast({ title: `Reminders sent to ${results.filter(r => r.status === 'sent').length} debtors`, description: channel === 'whatsapp' ? 'WhatsApp messages queued (requires WhatsApp Business API)' : undefined });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Reminders" subtitle="Send bulk reminders via WhatsApp and email" />

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Send Reminders</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="log">Activity Log ({sentLog.length})</TabsTrigger>
        </TabsList>

        {/* Send Tab */}
        <TabsContent value="send" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: config */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Reminder Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Channel</Label>
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                        <SelectItem value="email">📧 Email</SelectItem>
                        <SelectItem value="sms">📱 SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                      <SelectContent>
                        {filteredTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        {filteredTemplates.length === 0 && <SelectItem value={null} disabled>No templates for {channel}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Schedule</Label>
                    <Select value={schedule} onValueChange={setSchedule}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="now">Send Now</SelectItem>
                        <SelectItem value="daily">Daily (9 AM)</SelectItem>
                        <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                        <SelectItem value="custom">Custom Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {schedule === 'custom' && (
                    <div className="space-y-1.5">
                      <Label>Send Date</Label>
                      <Input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                    </div>
                  )}
                  {selectedTemplateObj && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
                      <p className="text-xs whitespace-pre-wrap text-foreground line-clamp-5">{selectedTemplateObj.body}</p>
                    </div>
                  )}
                  <Button className="w-full gap-2" onClick={handleSend} disabled={sending || !selectedDebtors.length || !selectedTemplate}>
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending...' : `Send to ${selectedDebtors.length} Debtor${selectedDebtors.length !== 1 ? 's' : ''}`}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right: debtor selector */}
            <div>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Select Debtors ({selectedDebtors.length}/{activeDebtors.length})</CardTitle>
                    <Button variant="outline" size="sm" onClick={toggleAll}>
                      {selectedDebtors.length === activeDebtors.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {activeDebtors.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No active debtors with outstanding balance</p>
                  ) : (
                    activeDebtors.map(d => (
                      <div key={d.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedDebtors.includes(d.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}`}
                        onClick={() => toggleDebtor(d.id)}>
                        <Checkbox checked={selectedDebtors.includes(d.id)} onCheckedChange={() => toggleDebtor(d.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{d.name}</div>
                          <div className="text-xs text-muted-foreground flex gap-2">
                            {d.phone && <span>{d.phone}</span>}
                            {d.email && <span className="truncate">{d.email}</span>}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-red-600 shrink-0">{formatINR(d.total_outstanding)}</div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }} className="gap-2">
              <Plus className="w-4 h-4" />New Template
            </Button>
          </div>
          {templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3" />
              <p>No templates yet. Create your first message template.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(t => (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{t.type === 'whatsapp' ? '💬' : t.type === 'email' ? '📧' : '📱'}</span>
                        <span className="font-semibold text-sm">{t.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">{t.type}</Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingTemplate(t); setShowTemplateEditor(true); }}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete template?')) deleteTemplateMut.mutate(t.id); }}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {t.subject && <p className="text-xs font-medium text-muted-foreground mb-1">Subject: {t.subject}</p>}
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{t.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Log Tab */}
        <TabsContent value="log" className="mt-4">
          {sentLog.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Bell className="w-10 h-10 mx-auto mb-3" /><p>No reminders sent yet</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Debtor</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentLog.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{log.debtor}</TableCell>
                    <TableCell className="capitalize">{log.channel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${
                        log.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        log.status === 'queued' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.phone || log.email || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {showTemplateEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}
          onSave={handleTemplateSave}
        />
      )}
    </div>
  );
}