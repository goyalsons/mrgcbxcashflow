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
import { Building2, Mail, MessageSquare, Save, CheckCircle, Cloud, Plus, Pencil, Trash2, MoreHorizontal, Clock, CreditCard, ShieldCheck, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import LLMSettings from '@/components/settings/LLMSettings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SETTINGS_KEY = 'cashflow_pro_settings';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
function saveSettings(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

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
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Payment Reminder" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Message Body *</Label>
            <Textarea value={form.body} onChange={e => set('body', e.target.value)} rows={6} required />
            <p className="text-xs text-muted-foreground">Placeholders: {'{{name}}'}, {'{{amount}}'}, {'{{due_date}}'}</p>
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

  const [company, setCompany] = useState({ name: '', address: '', gstin: '', pan: '', email: '', phone: '', website: '' });
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', password: '', from_name: '' });
  const [whatsapp, setWhatsapp] = useState({ api_url: '', api_key: '', phone_number_id: '', from_number: '' });
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

  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list(),
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
    const s = loadSettings();
    if (s.company) setCompany(s.company);
    if (s.smtp) setSmtp(s.smtp);
    if (s.whatsapp) setWhatsapp(s.whatsapp);
    if (s.cloudinary) setCloudinary(s.cloudinary);
    if (s.paymentGateway) setPaymentGateway(s.paymentGateway);
    if (s.reminderSchedule) setReminderSchedule(s.reminderSchedule);
    if (s.digest) setDigest(s.digest);
    if (s.approvalThreshold !== undefined) setApprovalThreshold(Number(s.approvalThreshold) || 0);
  }, []);

  const handleSave = () => {
    saveSettings({ company, smtp, whatsapp, cloudinary, paymentGateway, reminderSchedule, digest, approvalThreshold });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    toast({ title: 'Settings saved successfully' });
  };

  const setC = (k, v) => setCompany(f => ({ ...f, [k]: v }));
  const setS = (k, v) => setSmtp(f => ({ ...f, [k]: v }));
  const setW = (k, v) => setWhatsapp(f => ({ ...f, [k]: v }));
  const setCl = (k, v) => setCloudinary(f => ({ ...f, [k]: v }));
  const setPG = (k, v) => setPaymentGateway(f => ({ ...f, [k]: v }));
  const setReminder = (k, v) => setReminderSchedule(f => ({ ...f, [k]: v }));
  const setD = (k, v) => setDigest(f => ({ ...f, [k]: v }));

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
        api_key: whatsapp.api_key || undefined,
        phone_id: whatsapp.phone_id || undefined,
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
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="company"><Building2 className="w-4 h-4 mr-1.5" />Company</TabsTrigger>
          <TabsTrigger value="smtp"><Mail className="w-4 h-4 mr-1.5" />Email</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageSquare className="w-4 h-4 mr-1.5" />WhatsApp</TabsTrigger>
          <TabsTrigger value="cloudinary"><Cloud className="w-4 h-4 mr-1.5" />Storage</TabsTrigger>
          <TabsTrigger value="payment"><CreditCard className="w-4 h-4 mr-1.5" />Payments</TabsTrigger>
          <TabsTrigger value="templates"><Mail className="w-4 h-4 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="reminders"><Clock className="w-4 h-4 mr-1.5" />Reminders</TabsTrigger>
          <TabsTrigger value="financial"><ShieldCheck className="w-4 h-4 mr-1.5" />Finance</TabsTrigger>
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

        {/* SMTP */}
        <TabsContent value="smtp" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SMTP Email Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">Configure your outgoing email server for sending payment reminders and reports.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>SMTP Host</Label>
                  <Input value={smtp.host} onChange={e => setS('host', e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input value={smtp.port} onChange={e => setS('port', e.target.value)} placeholder="587" />
                </div>
                <div className="space-y-1.5">
                  <Label>Username / Email</Label>
                  <Input value={smtp.user} onChange={e => setS('user', e.target.value)} placeholder="your@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password / App Password</Label>
                  <Input type="password" value={smtp.password} onChange={e => setS('password', e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label>From Name</Label>
                  <Input value={smtp.from_name} onChange={e => setS('from_name', e.target.value)} placeholder="CashFlow Pro" />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                <strong>Note:</strong> For Gmail, use an App Password (not your main password). Enable 2FA and generate at myaccount.google.com/apppasswords.
              </div>
            </CardContent>
          </Card>
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

              <div className="space-y-3">
                <Label className="text-sm font-medium">WhatsApp Template Names</Label>
                <p className="text-xs text-muted-foreground">
                  Enter the exact template names as approved in your RedLava / WhatsApp Business account (one per line). These will be available when sending reminders.
                </p>
                <Textarea
                  value={whatsapp.template_names || ''}
                  onChange={e => setW('template_names', e.target.value)}
                  rows={5}
                  placeholder={"payment_reminder\noverdue_notice\nwelcome\nreceipt_confirmation"}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Find your approved templates in your WhatsApp Business Manager → Message Templates.
                </p>
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

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                <strong>How it works:</strong> When sending a reminder, select a template name and the recipient's phone number. RedLava will deliver the approved WhatsApp template message instantly.
              </div>
            </CardContent>
          </Card>

          {/* API Credentials Info */}
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">🔑 API Credentials</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">RedLava credentials stored as secure server secrets.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCredsInfo(v => !v)}>
                  <Pencil className="w-3.5 h-3.5" />
                  Change Credentials
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="text-xs text-muted-foreground">API Key</p>
                    <p className="font-mono text-sm font-medium">REDLAVA_API_KEY</p>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">✓ Set</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="text-xs text-muted-foreground">Phone ID</p>
                    <p className="font-mono text-sm font-medium">REDLAVA_PHONE_ID</p>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">✓ Set</Badge>
                </div>
              </div>
              {showCredsInfo && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 space-y-2">
                  <p className="font-semibold">How to update credentials:</p>
                  <ol className="list-decimal ml-4 space-y-1 text-sm">
                    <li>Go to your <strong>Base44 App Dashboard</strong></li>
                    <li>Navigate to <strong>Code → Secrets</strong></li>
                    <li>Update the value for <code className="bg-amber-100 px-1 rounded font-mono">REDLAVA_API_KEY</code> and/or <code className="bg-amber-100 px-1 rounded font-mono">REDLAVA_PHONE_ID</code></li>
                    <li>Save — changes take effect immediately on the next function call</li>
                  </ol>
                  <p className="text-xs text-amber-600 mt-1">Secrets are stored server-side and never exposed to the browser for security.</p>
                </div>
              )}
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
                  <Input
                    value={testMsg.templateName}
                    onChange={e => setTestMsg(f => ({ ...f, templateName: e.target.value }))}
                    placeholder="payment_reminder"
                  />
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Gateway */}
        <TabsContent value="payment" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Gateway</CardTitle>
                <p className="text-sm text-muted-foreground">Configure your payment gateway to generate payment links directly from invoices.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Select value={paymentGateway.provider} onValueChange={v => setPG('provider', v)}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="razorpay">Razorpay</SelectItem>
                      <SelectItem value="upi">UPI (No Gateway)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentGateway.provider === 'razorpay' && (
                  <div className="space-y-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-sm font-medium text-blue-800">Razorpay Credentials</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Key ID *</Label>
                        <Input value={paymentGateway.razorpay_key_id} onChange={e => setPG('razorpay_key_id', e.target.value)} placeholder="rzp_live_xxxxxxxxxxxx" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Key Secret *</Label>
                        <Input type="password" value={paymentGateway.razorpay_key_secret} onChange={e => setPG('razorpay_key_secret', e.target.value)} placeholder="••••••••••••••••" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Webhook Secret</Label>
                        <Input type="password" value={paymentGateway.razorpay_webhook_secret} onChange={e => setPG('razorpay_webhook_secret', e.target.value)} placeholder="Webhook signing secret" />
                        <p className="text-xs text-muted-foreground">Used to verify payment webhooks. Set this in your Razorpay Dashboard → Settings → Webhooks.</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-blue-200 text-xs text-blue-700 space-y-1">
                      <p><strong>Setup:</strong> Go to <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer" className="underline">Razorpay Dashboard → Settings → API Keys</a> to get your Key ID and Secret.</p>
                      <p>Use <code className="bg-blue-100 px-1 rounded">rzp_test_</code> keys for testing and <code className="bg-blue-100 px-1 rounded">rzp_live_</code> for production.</p>
                    </div>
                  </div>
                )}

                {paymentGateway.provider === 'upi' && (
                  <div className="space-y-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-sm font-medium text-emerald-800">UPI Settings</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>UPI ID *</Label>
                        <Input value={paymentGateway.upi_id} onChange={e => setPG('upi_id', e.target.value)} placeholder="yourname@upi" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Payee Name</Label>
                        <Input value={paymentGateway.upi_name} onChange={e => setPG('upi_name', e.target.value)} placeholder="ABC Enterprises" />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-emerald-200 text-xs text-emerald-700">
                      <p>Generates a <code className="bg-emerald-100 px-1 rounded">upi://pay?</code> deep-link. Works with any UPI app (GPay, PhonePe, Paytm). No API keys required — payment confirmation is manual.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="mt-4">
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
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
          <div className="space-y-4">
            <div className="flex justify-end">
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
          </div>
        </TabsContent>
        {/* Financial Management */}
        <TabsContent value="financial" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Expense Approval Workflow</CardTitle>
              <p className="text-sm text-muted-foreground">Require admin sign-off for expenses above a threshold before they are recorded.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 max-w-xs">
                <Label>Approval Threshold (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={approvalThreshold}
                  onChange={e => setApprovalThreshold(Number(e.target.value))}
                  placeholder="e.g. 5000"
                />
                <p className="text-xs text-muted-foreground">
                  Expenses above this amount will require admin approval. Set to 0 to disable.
                </p>
              </div>
              {approvalThreshold > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  <strong>Active:</strong> Expenses over <strong>₹{Number(approvalThreshold).toLocaleString('en-IN')}</strong> will be sent for admin approval before being recorded.
                </div>
              )}
              {approvalThreshold === 0 && (
                <div className="p-3 rounded-lg bg-muted border text-sm text-muted-foreground">
                  Approval workflow is currently <strong>disabled</strong>. All expenses are recorded immediately.
                </div>
              )}
            </CardContent>
          </Card>
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