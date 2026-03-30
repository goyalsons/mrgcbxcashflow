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
import { Building2, Mail, MessageSquare, Save, CheckCircle, Cloud, Plus, Pencil, Trash2, MoreHorizontal, Clock, CreditCard } from 'lucide-react';
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
  }, []);

  const handleSave = () => {
    saveSettings({ company, smtp, whatsapp, cloudinary, paymentGateway, reminderSchedule });
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
          <TabsTrigger value="payment"><CreditCard className="w-4 h-4 mr-1.5" />Payments</TabsTrigger>
          <TabsTrigger value="templates"><Mail className="w-4 h-4 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="reminders"><Clock className="w-4 h-4 mr-1.5" />Reminders</TabsTrigger>
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
              <CardTitle className="text-base">WhatsApp Business API</CardTitle>
              <p className="text-sm text-muted-foreground">Connect WhatsApp Business API (Meta Cloud API) for automated payment reminders.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>API Endpoint URL</Label>
                  <Input value={whatsapp.api_url} onChange={e => setW('api_url', e.target.value)} placeholder="https://graph.facebook.com/v17.0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Access Token</Label>
                  <Input type="password" value={whatsapp.api_key} onChange={e => setW('api_key', e.target.value)} placeholder="EAAx..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number ID</Label>
                  <Input value={whatsapp.phone_number_id} onChange={e => setW('phone_number_id', e.target.value)} placeholder="123456789012345" />
                </div>
                <div className="space-y-1.5">
                  <Label>From Number</Label>
                  <Input value={whatsapp.from_number} onChange={e => setW('from_number', e.target.value)} placeholder="+919876543210" />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                <strong>Setup:</strong> Register at <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline">Meta for Developers</a>, create a WhatsApp Business app, and get your credentials from the dashboard.
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