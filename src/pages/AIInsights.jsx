import React, { useState } from 'react';
import { loadActiveLLM } from '@/components/settings/LLMSettings';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, TrendingUp, AlertTriangle, Zap, RefreshCw, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';

function InsightCard({ insight }) {
  const icons = { success: TrendingUp, warning: AlertTriangle, info: Sparkles, action: Zap };
  const colors = {
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    info: 'border-blue-200 bg-blue-50',
    action: 'border-purple-200 bg-purple-50',
  };
  const iconColors = { success: 'text-emerald-600', warning: 'text-amber-600', info: 'text-blue-600', action: 'text-purple-600' };
  const Icon = icons[insight.type] || Sparkles;

  return (
    <Card className={`border ${colors[insight.type] || 'border-border'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 ${iconColors[insight.type]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">{insight.title}</h3>
              <Badge variant="outline" className="text-xs capitalize">{insight.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{insight.description}</p>
            {insight.action && (
              <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary cursor-pointer hover:underline">
                {insight.action} <ChevronRight className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIInsights() {
  const { toast } = useToast();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: debtors = [] } = useQuery({ queryKey: ['debtors'], queryFn: () => base44.entities.Debtor.list() });
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => base44.entities.Receivable.list() });
  const { data: payables = [] } = useQuery({ queryKey: ['payables'], queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['allPayments'], queryFn: () => base44.entities.Payment.list('-payment_date', 100) });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ['bankAccounts'], queryFn: () => base44.entities.BankAccount.list() });

  const generateInsights = async () => {
    setLoading(true);
    const activeLLM = loadActiveLLM();

    // Map user-configured model to Base44 InvokeLLM model param
    const MODEL_MAP = {
      'gemini-2.0-flash': 'gemini_3_flash',
      'gemini-2.0-pro': 'gemini_3_1_pro',
      'gemini-1.5-flash': 'gemini_3_flash',
      'gemini-1.5-pro': 'gemini_3_1_pro',
      'claude-opus-4-5': 'claude_opus_4_6',
      'claude-sonnet-4-5': 'claude_sonnet_4_6',
      'claude-haiku-3-5': 'claude_sonnet_4_6',
    };
    let selectedModel = undefined;
    if (activeLLM.provider === 'gemini') selectedModel = MODEL_MAP[activeLLM.gemini_model];
    else if (activeLLM.provider === 'claude') selectedModel = MODEL_MAP[activeLLM.claude_model];

    const totalBankBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalOutstanding = debtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);
    const overdueRec = receivables.filter(r => {
      if (r.status === 'paid') return false;
      const days = Math.ceil((new Date() - new Date(r.due_date)) / 86400000);
      return days > 0;
    });
    const totalPayable = payables.filter(p => p.status !== 'paid').reduce((s, p) => s + ((p.amount || 0) - (p.amount_paid || 0)), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const highRiskDebtors = debtors.filter(d => (d.total_outstanding || 0) > 100000 && d.status === 'active');

    const prompt = `You are a financial analyst AI for an Indian B2B company. Analyze this financial data and provide exactly 6-8 specific, actionable insights in JSON format.

Financial Snapshot:
- Bank Balance: ₹${totalBankBalance.toLocaleString('en-IN')}
- Total Debtor Outstanding: ₹${totalOutstanding.toLocaleString('en-IN')} across ${debtors.length} debtors
- Overdue Receivables: ${overdueRec.length} invoices worth ₹${overdueRec.reduce((s,r)=>s+(r.amount||0)-(r.amount_received||0),0).toLocaleString('en-IN')}
- Total Payables Due: ₹${totalPayable.toLocaleString('en-IN')}
- Monthly Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
- High-risk debtors (>1L outstanding): ${highRiskDebtors.length} (${highRiskDebtors.map(d=>d.name).join(', ') || 'none'})
- Recent payments count (last 100): ${payments.length}
- Active debtors: ${debtors.filter(d=>(d.total_outstanding||0)>0).length}

Return JSON: { "insights": [ { "title": "...", "description": "...", "type": "success|warning|info|action", "category": "collections|cash_flow|risk|optimization", "action": "suggested next step (optional)" } ] }`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      ...(selectedModel && { model: selectedModel }),
      response_json_schema: {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                type: { type: 'string' },
                category: { type: 'string' },
                action: { type: 'string' },
              },
            },
          },
        },
      },
    });
    setInsights(result.insights || []);
    setLoading(false);
  };

  const categories = insights ? [...new Set(insights.map(i => i.category))] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" subtitle="AI-powered analysis of your financial health and recommendations" />

      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-purple-50 border-primary/20">
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Financial Intelligence</h2>
              <p className="text-sm text-muted-foreground">AI analyzes your debtors, cash flow, and overdue risks to provide tailored recommendations</p>
            </div>
          </div>
          <Button onClick={generateInsights} disabled={loading} className="gap-2 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analyzing...' : insights ? 'Refresh' : 'Generate Insights'}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      )}

      {insights && !loading && (
        <>
          {categories.map(cat => (
            <div key={cat}>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-3 capitalize">{cat.replace('_', ' ')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.filter(i => i.category === cat).map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {!insights && !loading && (
        <div className="text-center py-16">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-semibold">No insights generated yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click "Generate Insights" to get AI-powered financial recommendations</p>
        </div>
      )}
    </div>
  );
}