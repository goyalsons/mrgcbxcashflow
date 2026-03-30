import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle, XCircle, Wifi, WifiOff, Send, RefreshCw,
  Info, AlertTriangle, Book, Terminal, Zap
} from 'lucide-react';

const TALLY_SETTINGS_KEY = 'cashflow_tally_settings';

function loadTallySettings() {
  try { return JSON.parse(localStorage.getItem(TALLY_SETTINGS_KEY) || '{}'); } catch { return {}; }
}
function saveTallySettings(data) {
  localStorage.setItem(TALLY_SETTINGS_KEY, JSON.stringify(data));
}

const STEP = ({ num, title, children }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{num}</div>
    <div className="flex-1 pb-6 border-b border-border last:border-0">
      <p className="font-semibold text-sm mb-2">{title}</p>
      <div className="text-sm text-muted-foreground space-y-1">{children}</div>
    </div>
  </div>
);

export default function TallyIntegration() {
  const { toast } = useToast();

  const [config, setConfig] = useState({
    tallyUrl: 'http://localhost:9000',
    companyName: '',
    debitLedger: '',
    creditLedger: '',
  });
  const [connectionStatus, setConnectionStatus] = useState('idle'); // idle | testing | connected | failed
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Push Voucher form
  const [voucher, setVoucher] = useState({
    voucherType: 'Receipt',
    date: new Date().toISOString().split('T')[0],
    narration: '',
    debitLedger: '',
    creditLedger: '',
    amount: '',
  });
  const [pushStatus, setPushStatus] = useState('idle'); // idle | pushing | success | error
  const [pushMessage, setPushMessage] = useState('');

  // Custom XML
  const [customXml, setCustomXml] = useState('');
  const [customResponse, setCustomResponse] = useState('');
  const [customLoading, setCustomLoading] = useState(false);

  useEffect(() => {
    const s = loadTallySettings();
    if (s.tallyUrl) setConfig(s);
  }, []);

  const set = (k, v) => setConfig(f => ({ ...f, [k]: v }));
  const setV = (k, v) => setVoucher(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    saveTallySettings(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
    toast({ title: 'Tally settings saved' });
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionMessage('');
    try {
      const res = await base44.functions.invoke('tallyProxy', {
        action: 'test',
        tallyUrl: config.tallyUrl,
      });
      if (res.data.success) {
        setConnectionStatus('connected');
        setConnectionMessage(res.data.message);
        toast({ title: '✅ Connected to TallyPrime!' });
      } else {
        setConnectionStatus('failed');
        setConnectionMessage(res.data.error || 'Connection failed');
        toast({ title: 'Connection Failed', description: res.data.error, variant: 'destructive' });
      }
    } catch (e) {
      setConnectionStatus('failed');
      setConnectionMessage(e.message);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handlePushVoucher = async () => {
    if (!voucher.amount || !voucher.debitLedger || !voucher.creditLedger) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setPushStatus('pushing');
    setPushMessage('');
    try {
      const res = await base44.functions.invoke('tallyProxy', {
        action: 'pushVoucher',
        tallyUrl: config.tallyUrl,
        ...voucher,
        companyName: config.companyName,
      });
      if (res.data.success) {
        setPushStatus('success');
        setPushMessage(res.data.message);
        toast({ title: '✅ Voucher pushed to Tally!' });
      } else {
        setPushStatus('error');
        setPushMessage(res.data.error || 'Failed to push voucher');
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
      }
    } catch (e) {
      setPushStatus('error');
      setPushMessage(e.message);
    }
  };

  const handleCustomXml = async () => {
    if (!customXml.trim()) return;
    setCustomLoading(true);
    setCustomResponse('');
    try {
      const res = await base44.functions.invoke('tallyProxy', {
        action: 'custom',
        tallyUrl: config.tallyUrl,
        xmlRequest: customXml,
      });
      setCustomResponse(res.data.data || JSON.stringify(res.data));
    } catch (e) {
      setCustomResponse(`Error: ${e.message}`);
    }
    setCustomLoading(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="TallyPrime Integration"
        subtitle="Connect CashFlow Pro with TallyPrime for seamless accounting synchronisation"
      />

      {/* Connection Status Banner */}
      {connectionStatus === 'connected' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Connected to TallyPrime</p>
            <p className="text-xs">{connectionMessage}</p>
          </div>
        </div>
      )}
      {connectionStatus === 'failed' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Connection Failed</p>
            <p className="text-xs">{connectionMessage}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="setup">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="setup"><Wifi className="w-4 h-4 mr-1.5" />Connection Setup</TabsTrigger>
          <TabsTrigger value="voucher"><Send className="w-4 h-4 mr-1.5" />Push Voucher</TabsTrigger>
          <TabsTrigger value="custom"><Terminal className="w-4 h-4 mr-1.5" />Custom XML</TabsTrigger>
          <TabsTrigger value="guide"><Book className="w-4 h-4 mr-1.5" />Setup Guide</TabsTrigger>
        </TabsList>

        {/* === CONNECTION SETUP === */}
        <TabsContent value="setup" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                TallyPrime Server Configuration
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                TallyPrime acts as a local HTTP server. Enter the URL where your TallyPrime instance is running.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>TallyPrime Server URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={config.tallyUrl}
                      onChange={e => set('tallyUrl', e.target.value)}
                      placeholder="http://localhost:9000"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={connectionStatus === 'testing'}
                      className="gap-2 shrink-0"
                    >
                      {connectionStatus === 'testing' ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" />Testing...</>
                      ) : connectionStatus === 'connected' ? (
                        <><CheckCircle className="w-4 h-4 text-emerald-600" />Connected</>
                      ) : connectionStatus === 'failed' ? (
                        <><XCircle className="w-4 h-4 text-red-500" />Retry</>
                      ) : (
                        <><Wifi className="w-4 h-4" />Test Connection</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If running locally: <code className="bg-muted px-1 rounded">http://localhost:9000</code>&nbsp;
                    If on a network PC: <code className="bg-muted px-1 rounded">http://192.168.1.x:9000</code>&nbsp;
                    If exposed via ngrok: <code className="bg-muted px-1 rounded">https://xxxx.ngrok.io</code>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Company Name in Tally</Label>
                  <Input
                    value={config.companyName}
                    onChange={e => set('companyName', e.target.value)}
                    placeholder="ABC Enterprises Pvt Ltd"
                  />
                  <p className="text-xs text-muted-foreground">Exact name as shown in TallyPrime</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Default Debit Ledger</Label>
                  <Input
                    value={config.debitLedger}
                    onChange={e => set('debitLedger', e.target.value)}
                    placeholder="e.g. Accounts Receivable"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Credit Ledger</Label>
                  <Input
                    value={config.creditLedger}
                    onChange={e => set('creditLedger', e.target.value)}
                    placeholder="e.g. Bank Account"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Important:</strong> TallyPrime must be open and running on the target machine, and a company must be loaded. If TallyPrime is on a different machine than this app's server, the URL must be network-accessible. See the <strong>Setup Guide</strong> tab for full instructions.
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} className="gap-2">
                  {isSaved ? <CheckCircle className="w-4 h-4" /> : null}
                  {isSaved ? 'Saved!' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PUSH VOUCHER === */}
        <TabsContent value="voucher" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Push Voucher to TallyPrime
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Manually push a payment, receipt, or journal entry directly into your TallyPrime company.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Voucher Type *</Label>
                  <Select value={voucher.voucherType} onValueChange={v => setV('voucherType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Receipt">Receipt</SelectItem>
                      <SelectItem value="Payment">Payment</SelectItem>
                      <SelectItem value="Journal">Journal</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Purchase">Purchase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={voucher.date} onChange={e => setV('date', e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Debit Ledger *</Label>
                  <Input
                    value={voucher.debitLedger}
                    onChange={e => setV('debitLedger', e.target.value)}
                    placeholder="e.g. Accounts Receivable"
                  />
                  <p className="text-xs text-muted-foreground">Must exactly match ledger name in Tally</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Credit Ledger *</Label>
                  <Input
                    value={voucher.creditLedger}
                    onChange={e => setV('creditLedger', e.target.value)}
                    placeholder="e.g. State Bank of India"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number"
                    value={voucher.amount}
                    onChange={e => setV('amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Narration</Label>
                  <Input
                    value={voucher.narration}
                    onChange={e => setV('narration', e.target.value)}
                    placeholder="Payment received from customer..."
                  />
                </div>
              </div>

              {pushStatus !== 'idle' && (
                <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                  pushStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  pushStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                  'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  {pushStatus === 'pushing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {pushStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                  {pushStatus === 'error' && <XCircle className="w-4 h-4" />}
                  <span>{pushMessage || 'Pushing voucher to Tally...'}</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handlePushVoucher}
                  disabled={pushStatus === 'pushing'}
                  className="gap-2"
                >
                  {pushStatus === 'pushing' ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Pushing...</>
                  ) : (
                    <><Send className="w-4 h-4" />Push to Tally</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === CUSTOM XML === */}
        <TabsContent value="custom" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                Custom XML Request
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Send any custom XML request to TallyPrime and view the raw XML response. Use this for advanced queries.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>XML Request</Label>
                <Textarea
                  value={customXml}
                  onChange={e => setCustomXml(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={`<ENVELOPE>\n  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>EXPORT</TALLYREQUEST>\n    <TYPE>COLLECTION</TYPE>\n    <ID>List of Ledgers</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n      </STATICVARIABLES>\n    </DESC>\n  </BODY>\n</ENVELOPE>`}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCustomXml} disabled={customLoading} className="gap-2">
                  {customLoading ? <><RefreshCw className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send Request</>}
                </Button>
              </div>
              {customResponse && (
                <div className="space-y-1.5">
                  <Label>Response</Label>
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-64 font-mono whitespace-pre-wrap">{customResponse}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === SETUP GUIDE === */}
        <TabsContent value="guide" className="mt-4">
          <div className="space-y-4">

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">How TallyPrime Integration Works</p>
                    <p>TallyPrime does not have a cloud API. Instead, it runs as a local HTTP server on your PC (default port 9000) that accepts XML requests. This app's backend communicates with that server to read/write accounting data.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">📋 Step-by-Step Setup Instructions</CardTitle></CardHeader>
              <CardContent className="space-y-0 pt-2">

                <STEP num="1" title="Open TallyPrime on your PC">
                  <p>Make sure TallyPrime is installed and open on the machine that will act as the server. A company must be loaded (Go to <strong>Company → Select</strong> and load your company).</p>
                </STEP>

                <STEP num="2" title="Enable TallyPrime as HTTP Server">
                  <p>In TallyPrime, go to:</p>
                  <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li>Press <strong>Alt+F12</strong> or go to <strong>Configure → Advanced Config</strong></li>
                    <li>Set <strong>"TallyPrime acting as"</strong> → <strong>Both</strong> (or Server)</li>
                    <li>Set <strong>Port</strong> → <strong>9000</strong> (default, or choose any free port)</li>
                    <li>Press <strong>Enter/Accept</strong> to save</li>
                  </ul>
                  <p className="mt-2">Alternatively: <strong>Exchange → Data Synchronisation → Configuration</strong></p>
                </STEP>

                <STEP num="3" title="Allow Port Through Windows Firewall">
                  <p>The port (9000) must be open in your Windows Firewall:</p>
                  <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li>Open <strong>Windows Defender Firewall</strong> → <strong>Advanced Settings</strong></li>
                    <li>Click <strong>Inbound Rules → New Rule</strong></li>
                    <li>Select <strong>Port</strong> → TCP → enter <strong>9000</strong></li>
                    <li>Select <strong>Allow the connection</strong> → Name it "TallyPrime"</li>
                  </ul>
                </STEP>

                <STEP num="4" title="Expose TallyPrime to the Internet (Required for Cloud Access)">
                  <p>Since this app runs in the cloud, TallyPrime needs to be accessible from the internet. Use one of these methods:</p>

                  <div className="mt-2 space-y-3">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="font-semibold text-emerald-800 mb-1">Option A: ngrok (Recommended for Testing)</p>
                      <ol className="list-decimal ml-4 space-y-1 text-emerald-700">
                        <li>Download ngrok from <strong>ngrok.com</strong> and create a free account</li>
                        <li>Run: <code className="bg-emerald-100 px-1 rounded font-mono">ngrok http 9000</code></li>
                        <li>Copy the HTTPS URL shown (e.g. <code className="bg-emerald-100 px-1 rounded font-mono">https://abc123.ngrok.io</code>)</li>
                        <li>Paste that URL in the <strong>Connection Setup</strong> tab above</li>
                      </ol>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="font-semibold text-blue-800 mb-1">Option B: Static Public IP (For Production)</p>
                      <ol className="list-decimal ml-4 space-y-1 text-blue-700">
                        <li>Get a Static IP from your ISP for the machine running Tally</li>
                        <li>Configure Port Forwarding on your router: External Port 9000 → Internal IP of Tally PC → Port 9000</li>
                        <li>Use <code className="bg-blue-100 px-1 rounded font-mono">http://YOUR_PUBLIC_IP:9000</code> as the URL in Connection Setup</li>
                      </ol>
                    </div>

                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                      <p className="font-semibold text-purple-800 mb-1">Option C: Same Network (LAN Only)</p>
                      <p className="text-purple-700">If your server and Tally are on the same local network, use the local IP: <code className="bg-purple-100 px-1 rounded font-mono">http://192.168.1.x:9000</code></p>
                    </div>
                  </div>
                </STEP>

                <STEP num="5" title="Configure Ledger Names">
                  <p>In the <strong>Connection Setup</strong> tab, enter your ledger names exactly as they appear in TallyPrime (case-sensitive):</p>
                  <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li><strong>Debit Ledger</strong> — typically "Accounts Receivable" or the customer's ledger</li>
                    <li><strong>Credit Ledger</strong> — typically your bank account ledger name in Tally</li>
                  </ul>
                  <p className="mt-1">To find ledger names in Tally: <strong>Gateway of Tally → Accounts Info → Ledgers → Display</strong></p>
                </STEP>

                <STEP num="6" title="Test the Connection">
                  <p>Go to the <strong>Connection Setup</strong> tab, enter your Tally URL and click <strong>"Test Connection"</strong>. If successful, you'll see a green confirmation. Then click <strong>Save Settings</strong>.</p>
                </STEP>

                <STEP num="7" title="Push Your First Voucher">
                  <p>Go to the <strong>Push Voucher</strong> tab. Fill in the voucher details (type, date, ledgers, amount) and click <strong>Push to Tally</strong>. The entry will appear directly in your TallyPrime company.</p>
                </STEP>
              </CardContent>
            </Card>

            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Troubleshooting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { q: 'Connection timed out', a: 'TallyPrime is not running, not set as server, or the port is blocked by firewall. Check steps 1–3.' },
                  { q: 'Connection refused', a: 'The URL or port is wrong. Make sure the port in TallyPrime matches the URL (default: 9000).' },
                  { q: 'Voucher pushed but not appearing in Tally', a: 'Ledger names may be incorrect. They must exactly match the names in Tally (case-sensitive).' },
                  { q: 'ngrok URL stopped working', a: 'Free ngrok URLs expire after a few hours. Re-run ngrok and update the URL in Connection Setup.' },
                  { q: 'Works on LAN but not from cloud', a: 'Your TallyPrime is not exposed to the internet. Follow Option A or B in Step 4.' },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                    <p className="font-semibold text-foreground">❓ {item.q}</p>
                    <p className="text-muted-foreground mt-0.5">✅ {item.a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}