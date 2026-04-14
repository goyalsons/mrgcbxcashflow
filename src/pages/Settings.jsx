import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Mail, MessageSquare, Save, CheckCircle, Cloud, Plus, Pencil, Trash2, MoreHorizontal, Clock, CreditCard, BrainCircuit, Eye, EyeOff, Copy, Check } from 'lucide-react';
import LLMSettings from '@/components/settings/LLMSettings';
import TemplatesTab from '@/components/settings/TemplatesTab';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SETTINGS_KEY = 'cashflow_pro_settings';
const DB_SETTINGS_KEY = 'app_settings_v1';

function loadLocalSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
function saveLocalSettings(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

const PLACEHOLDER_GUIDE = [
  { placeholder: '{{1}}', label: 'contact_person', description: 'Contact person at the debtor company' },
  { placeholder: '{{2}}', label: 'company_name', description: 'Debtor company name' },
  { placeholder: '{{3}}', label: 'outstanding_amount', description: 'Total outstanding balance (e.g. ₹1,50,000)' },
  { placeholder: '{{4}}', label: 'invoice_table', description: 'Full table of outstanding invoices with dates & amounts' },
  { placeholder: '{{5}}', label: 'attachments', description: 'Links to invoice attachments (if any are uploaded)' },
];

function TemplateEditor({ template, onClose, onSave }) {
  const [form, setForm] = useState(template || { name: '', type: 'whatsapp', subject: '', body: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const set = (k, v) => {
    if (k === 'meta_template_name') {
      // Keep name in sync with meta_template_name
      setForm(f => ({ ...f, meta_template_name: v, name: v }));
    } else {
      setForm(f => ({ ...f, [k]: v }));
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false);
  };
  const insertPlaceholder = (ph) => {
    set('body', (form.body || '') + ph);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{template?.id ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input
                value={form.meta_template_name || ''}
                onChange={e => set('meta_template_name', e.target.value)}
                placeholder="e.g. payment_reminder_v1"
                className="font-mono"
                required
              />
            </div>
          </div>
          {form.type === 'email' && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Payment Reminder - {{company_name}}" />
            </div>
          )}
          {form.type === 'whatsapp' && (
            <div className="space-y-4 p-3 rounded-lg border border-green-200 bg-green-50/50">
              <div className="space-y-1.5">
                <Label>Default Variable Values</Label>
                <Input
                  value={form.default_variables || ''}
                  onChange={e => set('default_variables', e.target.value)}
                  placeholder="e.g. John Doe, ₹5000, 31 March 2026"
                />
                <p className="text-xs text-muted-foreground">Comma-separated default values for {'{{1}}'}, {'{{2}}'}, {'{{3}}'}... Used when testing.</p>
              </div>
            </div>
          )}

          {/* Dynamic Fields Guide */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
              onClick={() => setShowGuide(v => !v)}
            >
              <span>📋 Dynamic Fields Reference</span>
              <span>{showGuide ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {showGuide && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs text-blue-700 mb-2">Click a placeholder to insert it at the end of the message body.</p>
                <div className="grid gap-1.5">
                  {PLACEHOLDER_GUIDE.map(({ placeholder, label, description }) => (
                    <div key={placeholder} className="flex items-center gap-2 bg-white rounded border border-blue-100 px-2 py-1.5">
                      <button
                        type="button"
                        className="font-mono text-xs text-blue-700 font-bold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100 shrink-0"
                        onClick={() => insertPlaceholder(placeholder)}
                        title="Insert into body"
                      >
                        {placeholder}
                      </button>
                      {label && <span className="font-mono text-xs text-muted-foreground bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded shrink-0">{label}</span>}
                      <span className="text-xs text-muted-foreground">{description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Message Body *</Label>
            <Textarea value={form.body} onChange={e => set('body', e.target.value)} rows={8} required className="font-mono text-sm" />
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

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const [company, setCompany] = useState({ name: '', address: '', gstin: '', pan: '', email: '', phone: '', website: '', contact_person: '' });
  const [gmailFromName, setGmailFromName] = useState('');
  const [gmailConnected, setGmailConnected] = useState(null); // null=loading, false=no, {email}=yes
  const [gmailChecking, setGmailChecking] = useState(false);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [whatsapp, setWhatsapp] = useState({ api_url: '', api_key: '', phone_id: '', phone_number_id: '', from_number: '', language: 'en', template_names: '', wa_templates: [] });
  const [cloudinary, setCloudinary] = useState({ cloud_name: '', api_key: '', api_secret: '' });
  const [paymentGateway, setPaymentGateway] = useState({ provider: 'razorpay', razorpay_key_id: '', razorpay_key_secret: '', razorpay_webhook_secret: '', upi_id: '', upi_name: '' });
  const [reminderSchedule, setReminderSchedule] = useState({
    enabled: false,
    frequency: 'daily',
    time: '09:00',
    daysOfWeek: [1],
    templateId: '',
    channel: 'email'
  });
  const [digest, setDigest] = useState({
    enabled: false,
    time: '08:00',
    send_email: true,
    send_whatsapp: false,
    recipient_email: '',
    recipient_phone: '',
  });
  const [approvalThreshold, setApprovalThreshold] = useState(0);
  const [digestSending, setDigestSending] = useState(false);
  const [testMsg, setTestMsg] = useState({ phone: '', templateName: '', variables: '' });
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showCredsInfo, setShowCredsInfo] = useState(false);
  const [showRedlavaKey, setShowRedlavaKey] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);
  const [cloudinaryTesting, setCloudinaryTesting] = useState(false);
  const [cloudinaryTestResult, setCloudinaryTestResult] = useState(null);
  const [templateTestState, setTemplateTestState] = useState({}); // { [id]: { email, sending, result } }
  const [defaultReminderTemplateId, setDefaultReminderTemplateId] = useState('');
  const [testEmailForReminders, setTestEmailForReminders] = useState('');
  const [testPhoneForReminders, setTestPhoneForReminders] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list(),
  });

  // Load all settings from DB on mount
  const { data: dbSettingsRecords = [] } = useQuery({
    select: (data) => Array.isArray(data) ? data : [],
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

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

  useEffect(() => {
    // Try DB first, fall back to localStorage
    const dbRecord = Array.isArray(dbSettingsRecords) ? dbSettingsRecords.find(r => r.key === DB_SETTINGS_KEY) : undefined;
    let s = {};
    if (dbRecord?.value) {
      try { s = JSON.parse(dbRecord.value); } catch {}
    }
    // Merge with localStorage as fallback for any missing keys
    const local = loadLocalSettings();
    s = { ...local, ...s };

    if (s.company) setCompany(s.company);
    if (s.gmailFromName) setGmailFromName(s.gmailFromName);
    if (s.whatsapp) setWhatsapp(prev => ({ ...prev, ...s.whatsapp, wa_templates: s.whatsapp.wa_templates || [] }));
    if (s.cloudinary) setCloudinary(s.cloudinary);
    if (s.paymentGateway) setPaymentGateway(s.paymentGateway);
    if (s.reminderSchedule) setReminderSchedule(s.reminderSchedule);
    if (s.digest) setDigest(s.digest);
    if (s.approvalThreshold !== undefined) setApprovalThreshold(Number(s.approvalThreshold) || 0);
    if (s.defaultReminderTemplateId) setDefaultReminderTemplateId(s.defaultReminderTemplateId);
    if (s.testEmailForReminders) setTestEmailForReminders(s.testEmailForReminders);
    if (s.testPhoneForReminders) setTestPhoneForReminders(s.testPhoneForReminders);
  }, [dbSettingsRecords]);

  const checkGmailStatus = async () => {
    setGmailChecking(true);
    try {
      const res = await base44.functions.invoke('checkGmailConnection', {});
      if (res.data.connected) {
        setGmailConnected({ email: res.data.email });
      } else {
        // Even if status check fails, Gmail connector may still work — show warning only
        setGmailConnected({ warning: true, error: res.data.error });
      }
    } catch (e) {
      setGmailConnected({ warning: true, error: e.message });
    }
    setGmailChecking(false);
  };

  useEffect(() => { checkGmailStatus(); }, []);

  const handleSave = async () => {
    const allSettings = { company, gmailFromName, whatsapp, cloudinary, paymentGateway, reminderSchedule, digest, approvalThreshold, defaultReminderTemplateId, testEmailForReminders, testPhoneForReminders };
    // Save to localStorage as cache
    saveLocalSettings(allSettings);
    // Save all settings to DB
    try {
      const existing = await base44.entities.AppSettings.filter({ key: DB_SETTINGS_KEY });
      const payload = { key: DB_SETTINGS_KEY, value: JSON.stringify(allSettings) };
      if (existing.length > 0) {
        await base44.entities.AppSettings.update(existing[0].id, payload);
      } else {
        await base44.entities.AppSettings.create(payload);
      }
    } catch (e) {
      console.warn('Could not persist settings to DB:', e.message);
    }
    // Also persist company profile separately for backend functions
    try {
      const existing = await base44.entities.AppSettings.filter({ key: 'company_profile' });
      const payload = { key: 'company_profile', value: JSON.stringify(company) };
      if (existing.length > 0) {
        await base44.entities.AppSettings.update(existing[0].id, payload);
      } else {
        await base44.entities.AppSettings.create(payload);
      }
    } catch (e) {
      console.warn('Could not persist company profile to DB:', e.message);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    toast({ title: 'Settings saved successfully' });
  };

  const setC = (k, v) => setCompany(f => ({ ...f, [k]: v }));
  const setW = (k, v) => setWhatsapp(f => ({ ...f, [k]: v }));
  const setCl = (k, v) => setCloudinary(f => ({ ...f, [k]: v }));
  const setPG = (k, v) => setPaymentGateway(f => ({ ...f, [k]: v }));
  const setReminder = (k, v) => setReminderSchedule(f => ({ ...f, [k]: v }));
  const setD = (k, v) => setDigest(f => ({ ...f, [k]: v }));

  const handleCloudinaryTest = async () => {
    if (!cloudinary.cloud_name || !cloudinary.api_key || !cloudinary.api_secret) {
      setCloudinaryTestResult({ success: false, message: '❌ Please fill in all Cloudinary credentials first.' });
      return;
    }
    setCloudinaryTesting(true);
    setCloudinaryTestResult(null);
    try {
      // Pass credentials in body; omit 'file' to trigger ping/connection test only
      const res = await base44.functions.invoke('uploadToCloudinary', {
        cloud_name: cloudinary.cloud_name,
        api_key: cloudinary.api_key,
        api_secret: cloudinary.api_secret,
      });
      if (res.data.success || res.data.url) {
        setCloudinaryTestResult({ success: true, message: `✅ ${res.data.message || 'Cloudinary connection successful!'}` });
      } else {
        setCloudinaryTestResult({ success: false, message: `❌ ${res.data.error || 'Unknown error'}` });
      }
    } catch (e) {
      setCloudinaryTestResult({ success: false, message: `❌ ${e.message}` });
    }
    setCloudinaryTesting(false);
  };

  const handleTemplateTest = async (template, recipientEmail) => {
    setTemplateTestState(prev => ({ ...prev, [template.id]: { ...prev[template.id], sending: true, result: null } }));
    try {
      const res = await base44.functions.invoke('sendSmtpEmail', {
        to: recipientEmail,
        subject: template.subject || `Test: ${template.name}`,
        body: template.body,
        from_name: gmailFromName || 'CashFlow Pro',
      });
      if (res.data.success) {
        setTemplateTestState(prev => ({ ...prev, [template.id]: { ...prev[template.id], sending: false, result: { success: true, message: `✅ Test sent to ${recipientEmail}` } } }));
      } else {
        setTemplateTestState(prev => ({ ...prev, [template.id]: { ...prev[template.id], sending: false, result: { success: false, message: `❌ ${res.data.error}` } } }));
      }
    } catch (e) {
      setTemplateTestState(prev => ({ ...prev, [template.id]: { ...prev[template.id], sending: false, result: { success: false, message: `❌ ${e.message}` } } }));
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const res = await base44.functions.invoke('sendSmtpEmail', {
        to: testEmail,
        subject: 'CashFlow Pro — Gmail Test Email',
        body: `This is a test email from CashFlow Pro sent at ${new Date().toLocaleString('en-IN')}. If you received this, your Gmail connection is working correctly.`,
        from_name: gmailFromName || 'CashFlow Pro',
      });
      if (res.data.success) {
        setTestEmailResult({ success: true, message: `✅ Test email sent successfully to ${testEmail}` });
      } else {
        setTestEmailResult({ success: false, message: `❌ ${res.data.error}` });
      }
    } catch (e) {
      setTestEmailResult({ success: false, message: `❌ ${e.message}` });
    }
    setTestEmailSending(false);
  };

  const handleTestWhatsApp = async () => {
    if (!testMsg.phone || !testMsg.templateName) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const vars = testMsg.variables ? testMsg.variables.split(',').map(v => v.trim()).filter(Boolean) : [];
      const res = await base44.functions.invoke('sendWhatsAppMessage', {
        action: 'sendMessage',
        to: testMsg.phone,
        templateName: testMsg.templateName,
        language: whatsapp.language || 'en',
        templateVariables: vars,
        api_key: whatsapp.api_key || '',
        phone_id: whatsapp.phone_id || '',
      });
      setTestResult({ success: res.data.success, message: res.data.success ? `✅ Message sent! ID: ${res.data.messageId || 'N/A'}` : `❌ ${res.data.error}` });
    } catch (e) {
      setTestResult({ success: false, message: `❌ ${e.message}` });
    }
    setTestSending(false);
  };

  const handleSendTestDigest = async () => {
    setDigestSending(true);
    try {
      await base44.functions.invoke('sendDailyDigest', digest);
      toast({ title: 'Test digest sent!', description: 'Check your email/WhatsApp.' });
    } catch (e) {
      toast({ title: 'Failed to send', description: e.message, variant: 'destructive' });
    }
    setDigestSending(false);
  };

  const toggleDay = (dayNum) => {
    setReminder('daysOfWeek', reminderSchedule.daysOfWeek.includes(dayNum) 
      ? reminderSchedule.daysOfWeek.filter(d => d !== dayNum)
      : [...reminderSchedule.daysOfWeek, dayNum].sort()
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure company profile, integrations, and system settings" />

      <Tabs defaultValue="company">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="company"><Building2 className="w-4 h-4 mr-1.5" />Company</TabsTrigger>
          <TabsTrigger value="smtp"><Mail className="w-4 h-4 mr-1.5" />Email</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageSquare className="w-4 h-4 mr-1.5" />WhatsApp</TabsTrigger>
          <TabsTrigger value="cloudinary"><Cloud className="w-4 h-4 mr-1.5" />Storage</TabsTrigger>
          <TabsTrigger value="templates"><Mail className="w-4 h-4 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="reports"><Clock className="w-4 h-4 mr-1.5" />Reports</TabsTrigger>
          <TabsTrigger value="llm"><BrainCircuit className="w-4 h-4 mr-1.5" />AI / LLM</TabsTrigger>
        </TabsList>

        {/* Company */}
        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Company Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Company Name *</Label>
                  <Input value={company.name} onChange={e => setC('name', e.target.value)} placeholder="ABC Enterprises Pvt Ltd" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={company.email} onChange={e => setC('email', e.target.value)} placeholder="accounts@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={company.phone} onChange={e => setC('phone', e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={company.website} onChange={e => setC('website', e.target.value)} placeholder="https://www.company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Person</Label>
                  <Input value={company.contact_person} onChange={e => setC('contact_person', e.target.value)} placeholder="e.g. Ramesh Shah" />
                </div>
                <div className="space-y-1.5">
                  <Label>GSTIN</Label>
                  <Input value={company.gstin} onChange={e => setC('gstin', e.target.value)} placeholder="27AAAAA0000A1Z5" maxLength={15} />
                </div>
                <div className="space-y-1.5">
                  <Label>PAN</Label>
                  <Input value={company.pan} onChange={e => setC('pan', e.target.value)} placeholder="AAAAA0000A" maxLength={10} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea value={company.address} onChange={e => setC('address', e.target.value)} rows={3} placeholder="Full business address..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gmail OAuth */}
        <TabsContent value="smtp" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" />Gmail — Send Emails via OAuth</CardTitle>
                <p className="text-sm text-muted-foreground">Connect your Gmail account to send payment reminders, reports, and test emails. No SMTP passwords needed.</p>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Connection Status */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${gmailConnected?.email ? 'bg-emerald-500' : gmailConnected?.warning ? 'bg-amber-400' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-medium text-sm">
                        {gmailConnected?.email
                          ? `Connected as ${gmailConnected.email}`
                          : gmailConnected?.warning
                          ? 'Gmail connected via OAuth (status check pending)'
                          : 'Not connected'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {gmailConnected?.email
                          ? 'Emails will be sent from this Gmail account.'
                          : gmailConnected?.warning
                          ? 'Use the test email below to verify your connection works.'
                          : 'Connect your Gmail account to enable email sending.'}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={checkGmailStatus} disabled={gmailChecking}>
                    {gmailChecking ? '⏳ Checking...' : '🔄 Refresh'}
                  </Button>
                </div>

                {!gmailConnected?.email && !gmailConnected?.warning && (
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-3">
                    <p className="text-sm font-medium text-blue-800">How to connect Gmail:</p>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal ml-4">
                      <li>In the Base44 platform, go to <strong>App Settings → Connectors</strong></li>
                      <li>Find <strong>Gmail</strong> and click <strong>Connect</strong></li>
                      <li>Sign in with your Google account and grant permission to send emails</li>
                      <li>Come back here and click <strong>Refresh Status</strong> to confirm</li>
                    </ol>
                  </div>
                )}

                <div className="space-y-1.5 max-w-xs">
                  <Label>From Name</Label>
                  <Input value={gmailFromName} onChange={e => setGmailFromName(e.target.value)} placeholder="CashFlow Pro" />
                  <p className="text-xs text-muted-foreground">Display name shown to email recipients.</p>
                </div>

                <div className="border-t pt-4 space-y-3">
                   <p className="text-sm font-medium">Default Test Email for Reminders</p>
                   <Input
                     type="email"
                     value={testEmailForReminders}
                     onChange={e => setTestEmailForReminders(e.target.value)}
                     placeholder="test@example.com"
                     className="max-w-xs"
                   />
                   <p className="text-xs text-muted-foreground">Used to send test email reminders from campaign list.</p>
                 </div>

                 <div className="border-t pt-4 space-y-3">
                   <p className="text-sm font-medium">Send Ad-hoc Test Email</p>
                   <div className="flex gap-3">
                     <Input
                       type="email"
                       value={testEmail}
                       onChange={e => setTestEmail(e.target.value)}
                       placeholder="recipient@example.com"
                       className="flex-1"
                     />
                     <Button
                       variant="outline"
                       onClick={handleTestEmail}
                       disabled={testEmailSending || !testEmail}
                       className="gap-2 shrink-0"
                     >
                       {testEmailSending ? '⏳ Sending...' : '📤 Send Test'}
                     </Button>
                   </div>
                   {testEmailResult && (
                     <div className={`p-3 rounded-lg border text-sm ${testEmailResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                       {testEmailResult.message}
                     </div>
                   )}
                 </div>

              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* WhatsApp */}
        <TabsContent value="whatsapp" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-600" />
              WhatsApp Business API — RedLava
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your RedLava API credentials below. These are stored locally in your browser and sent securely to the server for each request.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-800 space-y-1">
              <p className="font-semibold">⚠️ Important: Templates must be created in Meta first</p>
              <p>WhatsApp templates must be <strong>pre-approved in your Meta Business Manager</strong> before they can be sent. The messages in the Templates tab are for reference only — you can copy them and use them as a starting point when creating templates in Meta.</p>
              <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noreferrer" className="underline font-medium text-amber-700">→ Open Meta Message Templates Manager</a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>RedLava API Key *</Label>
                <div className="relative flex items-center">
                  <Input
                    type={showRedlavaKey ? 'text' : 'password'}
                    value={whatsapp.api_key || ''}
                    onChange={e => setW('api_key', e.target.value)}
                    placeholder="Enter your RedLava API key"
                    className="pr-10 font-mono"
                  />
                  <button type="button" onClick={() => setShowRedlavaKey(v => !v)} className="absolute right-2 text-muted-foreground hover:text-foreground">
                    {showRedlavaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Phone ID *</Label>
                <Input
                  value={whatsapp.phone_id || ''}
                  onChange={e => setW('phone_id', e.target.value)}
                  placeholder="Enter your RedLava Phone ID"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              Get your API Key and Phone ID from your <a href="https://wa.redlava.in" target="_blank" rel="noreferrer" className="underline font-medium">RedLava dashboard</a> → API Credentials.
            </div>

              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                💬 WhatsApp templates are managed in the <strong>Templates tab</strong>. Create a template there and set the Meta template name. All dropdowns throughout the app will use those templates.
              </div>

              <div className="space-y-1.5">
                <Label>Default Language Code</Label>
                <Input
                  value={whatsapp.language || 'en'}
                  onChange={e => setW('language', e.target.value)}
                  placeholder="en"
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">e.g. en, hi, mr, ta, te</p>
                </div>

                <div className="border-t pt-4 space-y-3">
                <Label className="text-sm font-semibold">Default Test Phone for Reminders</Label>
                <Input
                  type="tel"
                  value={testPhoneForReminders}
                  onChange={e => setTestPhoneForReminders(e.target.value)}
                  placeholder="919876543210"
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Used to send test WhatsApp reminders from campaign list. Country code without +.</p>
                </div>

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                <strong>How it works:</strong> When sending a reminder, select a template name and the recipient's phone number. RedLava will deliver the approved WhatsApp template message instantly.
                </div>
            </CardContent>
          </Card>



          {/* Template Test */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">🧪 Test Template Message</CardTitle>
              <p className="text-sm text-muted-foreground">Send a live WhatsApp test message using one of your approved templates.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Recipient Phone *</Label>
                  <Input
                    value={testMsg.phone}
                    onChange={e => setTestMsg(f => ({ ...f, phone: e.target.value }))}
                    placeholder="919876543210"
                  />
                  <p className="text-xs text-muted-foreground">Country code without +, e.g. 919876543210</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Template Name *</Label>
                  {templates.filter(t => t.type === 'whatsapp').length > 0 ? (
                    <Select value={testMsg.templateName} onValueChange={v => {
                      const tpl = templates.find(t => (t.meta_template_name || t.name) === v);
                      setTestMsg(f => ({ ...f, templateName: v, variables: tpl?.default_variables || f.variables }));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select a template..." /></SelectTrigger>
                      <SelectContent>
                        {templates.filter(t => t.type === 'whatsapp').map(t => (
                          <SelectItem key={t.id} value={t.meta_template_name || t.name}>
                            {t.meta_template_name || t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={testMsg.templateName}
                      onChange={e => setTestMsg(f => ({ ...f, templateName: e.target.value }))}
                      placeholder="Add WhatsApp templates in the Templates tab"
                    />
                  )}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Template Variables (comma-separated)</Label>
                  <Input
                    value={testMsg.variables}
                    onChange={e => setTestMsg(f => ({ ...f, variables: e.target.value }))}
                    placeholder="John Doe, ₹5000, 31 March 2026"
                  />
                  <p className="text-xs text-muted-foreground">Enter values for {'{{1}}'}, {'{{2}}'}, {'{{3}}'}... in the same order as your template.</p>
                </div>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg border text-sm ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {testResult.message}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleTestWhatsApp}
                  disabled={testSending || !testMsg.phone || !testMsg.templateName}
                  className="gap-2"
                  variant="outline"
                >
                  {testSending ? '⏳ Sending...' : '📤 Send Test Message'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cloudinary */}
        <TabsContent value="cloudinary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cloudinary File Storage</CardTitle>
              <p className="text-sm text-muted-foreground">Configure Cloudinary to store invoices, bills, and documents in the cloud.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cloud Name *</Label>
                  <Input value={cloudinary.cloud_name} onChange={e => setCl('cloud_name', e.target.value)} placeholder="your-cloud-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>API Key *</Label>
                  <Input value={cloudinary.api_key} onChange={e => setCl('api_key', e.target.value)} placeholder="Your API Key" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>API Secret *</Label>
                  <Input type="password" value={cloudinary.api_secret} onChange={e => setCl('api_secret', e.target.value)} placeholder="Your API Secret" />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                <strong>Setup:</strong> Sign up at <a href="https://cloudinary.com" target="_blank" rel="noreferrer" className="underline">Cloudinary</a>, then go to Settings &gt; API Keys to find your Cloud Name, API Key, and API Secret.
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Test Connection</p>
                <Button variant="outline" onClick={handleCloudinaryTest} disabled={cloudinaryTesting} className="gap-2">
                  {cloudinaryTesting ? '⏳ Testing...' : '🔗 Test Cloudinary Connection'}
                </Button>
                {cloudinaryTestResult && (
                  <div className={`p-3 rounded-lg border text-sm ${cloudinaryTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {cloudinaryTestResult.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>



        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4">
          {/* Daily Cash Digest */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">☀️ Daily Cash Digest</CardTitle>
              <p className="text-sm text-muted-foreground">Send a morning summary of cash position, overdue amounts, due-today invoices, top debtors, and yesterday's payments.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                <div>
                  <p className="font-medium">Enable Daily Digest</p>
                  <p className="text-xs text-muted-foreground">Automatically delivered each morning</p>
                </div>
                <input type="checkbox" checked={digest.enabled} onChange={e => setD('enabled', e.target.checked)} className="w-5 h-5" />
              </div>

              {digest.enabled && (
                <div className="space-y-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Send Time</Label>
                      <Input type="time" value={digest.time} onChange={e => setD('time', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Channels</Label>
                      <div className="flex items-center gap-4 pt-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={digest.send_email} onChange={e => setD('send_email', e.target.checked)} className="w-4 h-4" />
                          📧 Email
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={digest.send_whatsapp} onChange={e => setD('send_whatsapp', e.target.checked)} className="w-4 h-4" />
                          💬 WhatsApp
                        </label>
                      </div>
                    </div>
                  </div>

                  {digest.send_email && (
                    <div className="space-y-1.5">
                      <Label>Recipient Email *</Label>
                      <Input type="email" value={digest.recipient_email} onChange={e => setD('recipient_email', e.target.value)} placeholder="owner@company.com" />
                    </div>
                  )}

                  {digest.send_whatsapp && (
                    <div className="space-y-1.5">
                      <Label>Recipient Phone (WhatsApp) *</Label>
                      <Input value={digest.recipient_phone} onChange={e => setD('recipient_phone', e.target.value)} placeholder="+919876543210" />
                      <p className="text-xs text-muted-foreground">Requires WhatsApp Business API configured in the WhatsApp tab.</p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-white border border-amber-200 text-xs text-amber-700">
                    <strong>Digest includes:</strong> Net cash position · Overdue receivables · Invoices due today · Top 3 debtors · Today's follow-ups · Yesterday's payments received
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleSendTestDigest} disabled={digestSending} className="gap-2">
                  {digestSending ? 'Sending...' : '📨 Send Test Digest Now'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recurring Reminders</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                <div>
                  <p className="font-medium">Enable Automatic Reminders</p>
                  <p className="text-xs text-muted-foreground">Send payment reminders on a schedule</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={reminderSchedule.enabled}
                  onChange={(e) => setReminder('enabled', e.target.checked)}
                  className="w-5 h-5"
                />
              </div>

              {reminderSchedule.enabled && (
                <div className="space-y-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Frequency</Label>
                      <Select value={reminderSchedule.frequency} onValueChange={(v) => setReminder('frequency', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Time to Send</Label>
                      <Input 
                        type="time" 
                        value={reminderSchedule.time}
                        onChange={(e) => setReminder('time', e.target.value)}
                      />
                    </div>
                  </div>

                  {reminderSchedule.frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Days of Week</Label>
                      <div className="grid grid-cols-7 gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                          <button
                            key={i}
                            onClick={() => toggleDay(i)}
                            className={`p-2 rounded-lg font-medium text-sm transition-colors ${
                              reminderSchedule.daysOfWeek.includes(i)
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Channel</Label>
                      <Select value={reminderSchedule.channel} onValueChange={(v) => setReminder('channel', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">📧 Email</SelectItem>
                          <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                          <SelectItem value="sms">📱 SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Template</Label>
                      <Select value={reminderSchedule.templateId} onValueChange={(v) => setReminder('templateId', v)}>
                        <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                        <SelectContent>
                          {templates.filter(t => t.type === reminderSchedule.channel).map(t => (
                                             <SelectItem key={t.id} value={t.id}>{t.meta_template_name || t.name}</SelectItem>
                                           ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab
            templates={templates}
            templateTestState={templateTestState}
            setTemplateTestState={setTemplateTestState}
            setEditingTemplate={setEditingTemplate}
            setShowTemplateEditor={setShowTemplateEditor}
            deleteTemplateMut={deleteTemplateMut}
            handleTemplateTest={handleTemplateTest}
            defaultReminderTemplateId={defaultReminderTemplateId}
            setDefaultReminderTemplateId={(id) => { setDefaultReminderTemplateId(id); saveLocalSettings({ company, gmailFromName, whatsapp, cloudinary, paymentGateway, reminderSchedule, digest, approvalThreshold, defaultReminderTemplateId: id }); }}
          />
        </TabsContent>
        {/* LLM Settings */}
        <TabsContent value="llm" className="mt-4">
          <LLMSettings />
        </TabsContent>

      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>

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