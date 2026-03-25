import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, MessageSquare, Save, CheckCircle, Cloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const SETTINGS_KEY = 'cashflow_pro_settings';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
function saveSettings(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

export default function Settings() {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);

  const [company, setCompany] = useState({ name: '', address: '', gstin: '', pan: '', email: '', phone: '', website: '' });
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', password: '', from_name: '' });
  const [whatsapp, setWhatsapp] = useState({ api_url: '', api_key: '', phone_number_id: '', from_number: '' });
  const [cloudinary, setCloudinary] = useState({ cloud_name: '', api_key: '', api_secret: '' });

  useEffect(() => {
    const s = loadSettings();
    if (s.company) setCompany(s.company);
    if (s.smtp) setSmtp(s.smtp);
    if (s.whatsapp) setWhatsapp(s.whatsapp);
    if (s.cloudinary) setCloudinary(s.cloudinary);
  }, []);

  const handleSave = () => {
    saveSettings({ company, smtp, whatsapp, cloudinary });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    toast({ title: 'Settings saved successfully' });
  };

  const setC = (k, v) => setCompany(f => ({ ...f, [k]: v }));
  const setS = (k, v) => setSmtp(f => ({ ...f, [k]: v }));
  const setW = (k, v) => setWhatsapp(f => ({ ...f, [k]: v }));
  const setCl = (k, v) => setCloudinary(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure company profile, integrations, and system settings" />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="w-4 h-4 mr-1.5" />Company</TabsTrigger>
          <TabsTrigger value="smtp"><Mail className="w-4 h-4 mr-1.5" />Email / SMTP</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageSquare className="w-4 h-4 mr-1.5" />WhatsApp</TabsTrigger>
          <TabsTrigger value="cloudinary"><Cloud className="w-4 h-4 mr-1.5" />Cloudinary</TabsTrigger>
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
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}