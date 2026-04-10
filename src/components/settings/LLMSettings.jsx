import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Zap, Bot, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Fast)' },
  { value: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro (Powerful)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

const CLAUDE_MODELS = [
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Most Capable)' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Balanced)' },
  { value: 'claude-haiku-3-5', label: 'Claude Haiku 3.5 (Fast)' },
];

const LLM_SETTINGS_KEY = 'cashflow_pro_llm_settings';

function loadLLMSettings() {
  try { return JSON.parse(localStorage.getItem(LLM_SETTINGS_KEY) || '{}'); } catch { return {}; }
}

export function saveLLMSettings(data) {
  localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(data));
}

export function loadActiveLLM() {
  const s = loadLLMSettings();
  return {
    provider: s.active_provider || null,
    gemini_api_key: s.gemini_api_key || '',
    gemini_model: s.gemini_model || 'gemini-2.0-flash',
    claude_api_key: s.claude_api_key || '',
    claude_model: s.claude_model || 'claude-sonnet-4-5',
  };
}

export default function LLMSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    active_provider: '',
    gemini_api_key: '',
    gemini_model: 'gemini-2.0-flash',
    claude_api_key: '',
    claude_model: 'claude-sonnet-4-5',
  });
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testPrompt, setTestPrompt] = useState('Say "Hello! LLM is working correctly." and nothing else.');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = loadLLMSettings();
    if (Object.keys(s).length > 0) {
      setSettings(prev => ({ ...prev, ...s }));
    }
  }, []);

  const set = (k, v) => setSettings(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    saveLLMSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    toast({ title: 'LLM settings saved' });
  };

  const handleTest = async () => {
    if (!settings.active_provider) {
      toast({ title: 'No active LLM selected', description: 'Please activate Gemini or Claude first.', variant: 'destructive' });
      return;
    }
    const apiKey = settings.active_provider === 'gemini' ? settings.gemini_api_key : settings.claude_api_key;
    if (!apiKey) {
      toast({ title: 'API key missing', description: `Enter your ${settings.active_provider === 'gemini' ? 'Gemini' : 'Claude'} API key.`, variant: 'destructive' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('testLLM', {
        provider: settings.active_provider,
        api_key: apiKey,
        model: settings.active_provider === 'gemini' ? settings.gemini_model : settings.claude_model,
        prompt: testPrompt,
      });
      setTestResult({ success: true, message: res.data.response });
    } catch (e) {
      setTestResult({ success: false, message: e.message });
    }
    setTesting(false);
  };

  const activeLabel = settings.active_provider === 'gemini' ? 'Gemini' : settings.active_provider === 'claude' ? 'Claude' : null;

  return (
    <div className="space-y-4">
      {/* Active Provider Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Active LLM Provider
          </CardTitle>
          <p className="text-sm text-muted-foreground">Select which LLM to use as the global default across the app.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Gemini Toggle */}
            <div className={`p-4 rounded-xl border-2 transition-all ${settings.active_provider === 'gemini' ? 'border-blue-500 bg-blue-50' : 'border-border bg-card'}`}>
              <button
                type="button"
                onClick={() => set('active_provider', settings.active_provider === 'gemini' ? '' : 'gemini')}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🌟</span>
                  {settings.active_provider === 'gemini' && <Badge className="bg-blue-500 text-white text-xs">Active</Badge>}
                </div>
                <p className="font-semibold">Google Gemini</p>
              </button>
              <div className="mt-2" onClick={e => e.stopPropagation()}>
                <Select value={settings.gemini_model} onValueChange={v => set('gemini_model', v)}>
                  <SelectTrigger className="h-7 text-xs w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_MODELS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Claude Toggle */}
            <div className={`p-4 rounded-xl border-2 transition-all ${settings.active_provider === 'claude' ? 'border-orange-500 bg-orange-50' : 'border-border bg-card'}`}>
              <button
                type="button"
                onClick={() => set('active_provider', settings.active_provider === 'claude' ? '' : 'claude')}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🤖</span>
                  {settings.active_provider === 'claude' && <Badge className="bg-orange-500 text-white text-xs">Active</Badge>}
                </div>
                <p className="font-semibold">Anthropic Claude</p>
              </button>
              <div className="mt-2" onClick={e => e.stopPropagation()}>
                <Select value={settings.claude_model} onValueChange={v => set('claude_model', v)}>
                  <SelectTrigger className="h-7 text-xs w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAUDE_MODELS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {!settings.active_provider && (
            <p className="text-sm text-muted-foreground mt-3 text-center">No LLM active — click a provider above to activate it.</p>
          )}
        </CardContent>
      </Card>

      {/* Gemini Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            🌟 Google Gemini Configuration
            {settings.active_provider === 'gemini' && <Badge className="bg-blue-500 text-white text-xs ml-auto">Active</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Gemini API Key</Label>
            <div className="relative flex items-center">
              <Input
                type={showGeminiKey ? 'text' : 'password'}
                value={settings.gemini_api_key}
                onChange={e => set('gemini_api_key', e.target.value)}
                placeholder="AIza..."
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(v => !v)}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline text-primary">Google AI Studio</a></p>
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={settings.gemini_model} onValueChange={v => set('gemini_model', v)}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Claude Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            🤖 Anthropic Claude Configuration
            {settings.active_provider === 'claude' && <Badge className="bg-orange-500 text-white text-xs ml-auto">Active</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Claude API Key</Label>
            <div className="relative flex items-center">
              <Input
                type={showClaudeKey ? 'text' : 'password'}
                value={settings.claude_api_key}
                onChange={e => set('claude_api_key', e.target.value)}
                placeholder="sk-ant-..."
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowClaudeKey(v => !v)}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                {showClaudeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Get your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline text-primary">Anthropic Console</a></p>
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={settings.claude_model} onValueChange={v => set('claude_model', v)}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLAUDE_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Test Active Configuration
            {activeLabel && <Badge variant="outline" className="ml-auto">{activeLabel}</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Send a test query to verify the active LLM is working correctly.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Test Prompt</Label>
            <Input value={testPrompt} onChange={e => setTestPrompt(e.target.value)} />
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg border text-sm ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              <div className="flex items-start gap-2">
                {testResult.success
                  ? <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                  : <XCircle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />}
                <p className="whitespace-pre-wrap">{testResult.message}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Save settings before testing to ensure latest keys are used.</p>
            <Button onClick={handleTest} disabled={testing || !settings.active_provider} variant="outline" className="gap-2">
              {testing ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : '🧪 Run Test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save LLM Settings'}
        </Button>
      </div>
    </div>
  );
}