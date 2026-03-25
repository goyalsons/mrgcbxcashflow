import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Send, BarChart3, Users, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

export default function Reports() {
  const { toast } = useToast();
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);
  const [reportType, setReportType] = useState('debtor_summary');

  const { data: debtors = [] } = useQuery({ queryKey: ['debtors'], queryFn: () => base44.entities.Debtor.list() });
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => base44.entities.Receivable.list() });
  const { data: payables = [] } = useQuery({ queryKey: ['payables'], queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list() });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ['bankAccounts'], queryFn: () => base44.entities.BankAccount.list() });

  const totalOutstanding = debtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);
  const totalCollected = debtors.reduce((s, d) => s + (d.total_received || 0), 0);
  const overdueRec = receivables.filter(r => {
    if (r.status === 'paid') return false;
    return new Date(r.due_date) < new Date();
  });
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const bankBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const generateReport = () => {
    const lines = [];
    const date = new Date().toLocaleDateString('en-IN');

    if (reportType === 'debtor_summary') {
      lines.push(`DEBTOR SUMMARY REPORT — ${date}`);
      lines.push(`${'='.repeat(60)}`);
      lines.push(`Total Outstanding: ${formatINR(totalOutstanding)}`);
      lines.push(`Total Collected: ${formatINR(totalCollected)}`);
      lines.push(`Active Debtors: ${debtors.filter(d=>(d.total_outstanding||0)>0).length}`);
      lines.push('');
      lines.push('DEBTOR DETAILS:');
      debtors.filter(d=>(d.total_outstanding||0)>0).forEach(d => {
        lines.push(`  ${d.name}: Outstanding ${formatINR(d.total_outstanding)}, Collected ${formatINR(d.total_received)}`);
      });
    } else if (reportType === 'payment_due') {
      lines.push(`PAYMENT DUE REPORT — ${date}`);
      lines.push(`${'='.repeat(60)}`);
      lines.push(`Overdue Receivables: ${overdueRec.length} items`);
      lines.push('');
      overdueRec.forEach(r => {
        const days = Math.ceil((new Date() - new Date(r.due_date)) / 86400000);
        lines.push(`  ${r.customer_name} | ${r.invoice_number || 'N/A'} | Due: ${formatDateIN(r.due_date)} | ${days}d overdue | ${formatINR((r.amount||0)-(r.amount_received||0))}`);
      });
    } else if (reportType === 'cash_flow') {
      lines.push(`CASH FLOW SUMMARY — ${date}`);
      lines.push(`${'='.repeat(60)}`);
      lines.push(`Bank Balance: ${formatINR(bankBalance)}`);
      lines.push(`Receivables Outstanding: ${formatINR(receivables.filter(r=>r.status!=='paid').reduce((s,r)=>s+(r.amount||0)-(r.amount_received||0),0))}`);
      lines.push(`Payables Due: ${formatINR(payables.filter(p=>p.status!=='paid').reduce((s,p)=>s+(p.amount||0)-(p.amount_paid||0),0))}`);
      lines.push(`Total Expenses: ${formatINR(totalExpenses)}`);
      lines.push(`Net Position: ${formatINR(bankBalance + totalOutstanding - payables.filter(p=>p.status!=='paid').reduce((s,p)=>s+(p.amount||0)-(p.amount_paid||0),0))}`);
    }

    return lines.join('\n');
  };

  const handleSendEmail = async () => {
    if (!emailTo) { toast({ title: 'Enter email address', variant: 'destructive' }); return; }
    setSending(true);
    const report = generateReport();
    const titles = { debtor_summary: 'Debtor Summary Report', payment_due: 'Payment Due Report', cash_flow: 'Cash Flow Summary' };
    await base44.integrations.Core.SendEmail({
      to: emailTo,
      subject: `${titles[reportType]} — ${new Date().toLocaleDateString('en-IN')}`,
      body: report,
    });
    toast({ title: 'Report sent successfully', description: `Sent to ${emailTo}` });
    setSending(false);
  };

  const handleDownload = () => {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Generate and email financial reports" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Report Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Generate Report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debtor_summary">Debtor Summary</SelectItem>
                    <SelectItem value="payment_due">Payment Due Report</SelectItem>
                    <SelectItem value="cash_flow">Cash Flow Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Send to Email</Label>
                <Input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="accounts@company.com" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownload} className="flex-1 gap-2">
                  <Download className="w-4 h-4" /> Download
                </Button>
                <Button onClick={handleSendEmail} disabled={sending} className="flex-1 gap-2">
                  <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Email'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader><CardTitle className="text-base">Quick Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Bank Balance</span><span className="font-semibold">{formatINR(bankBalance)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Outstanding</span><span className="font-semibold text-red-600">{formatINR(totalOutstanding)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Collected</span><span className="font-semibold text-emerald-600">{formatINR(totalCollected)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Overdue Invoices</span><span className="font-semibold text-amber-600">{overdueRec.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Expenses</span><span className="font-semibold">{formatINR(totalExpenses)}</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Report Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Report Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {generateReport()}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}