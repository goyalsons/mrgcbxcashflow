import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, CheckCircle2, Users, FileText, CreditCard, Bell, Target, BarChart3, Plus, Edit, Trash2, Search, Download, Lightbulb, HelpCircle, Phone } from 'lucide-react';

export default function Instructions() {
  const [activeSection, setActiveSection] = useState('overview');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">CashFlow Pro - Instructions & Help</h1>
          <p className="text-muted-foreground">Your complete guide to managing collections, invoices, and cash flow efficiently</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="actions">Common Actions</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  What is CashFlow Pro?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-foreground leading-relaxed">
                  <strong>CashFlow Pro</strong> is a financial collection and cash flow management system designed to help businesses track payments, manage invoices, monitor collections, and maintain healthy cash flow.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 bg-card/50">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      For Managers
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Track customer payments</li>
                      <li>• Manage collection targets</li>
                      <li>• Send payment reminders</li>
                      <li>• Monitor overdue invoices</li>
                    </ul>
                  </div>
                  <div className="border rounded-lg p-4 bg-card/50">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      For Administrators
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Set up customers & vendors</li>
                      <li>• Configure settings</li>
                      <li>• View audit logs</li>
                      <li>• Manage user roles</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Core Concepts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">1</div>
                    <div>
                      <h4 className="font-semibold">Customers/Debtors</h4>
                      <p className="text-sm text-muted-foreground">People or businesses that owe you money</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">2</div>
                    <div>
                      <h4 className="font-semibold">Invoices/Receivables</h4>
                      <p className="text-sm text-muted-foreground">Money owed to you (how much, when due, payment status)</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">3</div>
                    <div>
                      <h4 className="font-semibold">Payments</h4>
                      <p className="text-sm text-muted-foreground">Money received from customers</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">4</div>
                    <div>
                      <h4 className="font-semibold">Collection Targets</h4>
                      <p className="text-sm text-muted-foreground">Monthly goals for collecting payments</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* QUICK START */}
          <TabsContent value="quickstart" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started in 5 Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  {
                    step: 1,
                    title: 'Add Your First Customer',
                    description: 'Go to Customers → Click "Add Customer" → Fill in name, email, phone, GST number (if applicable)',
                    icon: Users,
                  },
                  {
                    step: 2,
                    title: 'Create an Invoice',
                    description: 'Go to Receivables → Click "Add Invoice" → Select customer, enter amount, due date, and description',
                    icon: FileText,
                  },
                  {
                    step: 3,
                    title: 'Track Payment Status',
                    description: 'Check the Dashboard to see which invoices are paid, pending, or overdue at a glance',
                    icon: CreditCard,
                  },
                  {
                    step: 4,
                    title: 'Send Payment Reminders',
                    description: 'Go to Payment Reminders → Create a campaign → Set frequency (daily, weekly, monthly) and template',
                    icon: Bell,
                  },
                  {
                    step: 5,
                    title: 'Record Payments',
                    description: 'When a customer pays, go to Receivables → Click on the invoice → Click "Record Payment"',
                    icon: CreditCard,
                  },
                ].map(({ step, title, description, icon: Icon }) => (
                  <div key={step} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-accent" />
                        <h4 className="font-semibold">{title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGES BREAKDOWN */}
          <TabsContent value="pages" className="space-y-6">
            <Accordion type="single" collapsible className="space-y-3">
              {[
                {
                  name: 'Dashboard',
                  icon: BarChart3,
                  purpose: 'Your command center for viewing all critical financial information at a glance',
                  features: [
                    'View total outstanding amount and collection status',
                    'See overdue invoices and alerts',
                    'Track collection performance against targets',
                    'View recent transactions',
                  ],
                  usage: 'Open the app → Dashboard is your default landing page. Check it daily to stay on top of collections.',
                },
                {
                  name: 'Customers',
                  icon: Users,
                  purpose: 'Manage all your customers/clients in one place',
                  features: [
                    'Add new customers with contact details',
                    'Store GST numbers and addresses',
                    'Assign account managers',
                    'View customer payment history',
                    'Set credit limits for each customer',
                  ],
                  usage: 'Customers → Click "Add Customer" → Fill all details → Save. You can edit or delete anytime.',
                },
                {
                  name: 'Receivables (Invoices)',
                  icon: FileText,
                  purpose: 'Track all money owed to you by customers',
                  features: [
                    'Create invoices with amount and due date',
                    'Upload invoice documents (PDFs)',
                    'Mark invoices as paid, pending, or overdue',
                    'Add payment notes',
                    'Filter by status and date range',
                  ],
                  usage: 'Receivables → Click "Add Invoice" → Select customer → Enter amount → Set due date → Save.',
                },
                {
                  name: 'My Collections',
                  icon: CreditCard,
                  purpose: 'Track collections for customers you manage',
                  features: [
                    'See all outstanding invoices for your customers',
                    'Record payments received',
                    'Log follow-ups (calls, emails, visits)',
                    'Add follow-up notes and promised payment dates',
                    'Monitor payment promises',
                  ],
                  usage: 'My Collections → Find your customer → Click "Record Payment" or "Add Follow-up".',
                },
                {
                  name: 'Payment Reminders',
                  icon: Bell,
                  purpose: 'Automatically send payment reminders to customers',
                  features: [
                    'Create reminder campaigns (email/WhatsApp)',
                    'Set frequency (daily, weekly, monthly)',
                    'Use templates for consistent messaging',
                    'Schedule reminders to send automatically',
                    'View send logs to track delivery',
                  ],
                  usage: 'Payment Reminders → Click "Create Campaign" → Select customer & template → Set frequency → Save.',
                },
                {
                  name: 'Collection Targets',
                  icon: Target,
                  purpose: 'Set and track monthly collection goals',
                  features: [
                    'Define target amounts for each manager',
                    'Track progress against targets',
                    'View collection performance by period',
                    'Identify underperforming areas',
                  ],
                  usage: 'Collection Targets → Click "Add Target" → Set amount & date → Save. Progress updates automatically.',
                },
                {
                  name: 'Aging Analysis',
                  icon: BarChart3,
                  purpose: 'Analyze how long invoices have been outstanding',
                  features: [
                    'See invoices grouped by age (0-30, 30-60, 60+ days)',
                    'Identify oldest unpaid invoices',
                    'Prioritize collection efforts',
                  ],
                  usage: 'Aging Analysis → View chart to see which invoices need urgent attention.',
                },
              ].map(({ name, icon: Icon, purpose, features, usage }) => (
                <AccordionItem key={name} value={name} className="border rounded-lg">
                  <AccordionTrigger className="hover:no-underline px-4 py-3">
                    <div className="flex items-center gap-3 text-left">
                      <Icon className="w-5 h-5 text-accent flex-shrink-0" />
                      <h3 className="font-semibold">{name}</h3>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2 space-y-3 border-t">
                    <div>
                      <h4 className="text-sm font-semibold mb-1 text-muted-foreground">Purpose</h4>
                      <p className="text-sm">{purpose}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Key Features</h4>
                      <ul className="text-sm space-y-1">
                        {features.map((feature, i) => (
                          <li key={i} className="flex gap-2">
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-1 text-muted-foreground">How to Use</h4>
                      <p className="text-sm bg-muted/50 p-2 rounded">{usage}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {/* FEATURES */}
          <TabsContent value="features" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: Plus,
                  title: 'Add (Create)',
                  description: 'Create new records',
                  steps: [
                    'Navigate to the desired page (Customers, Invoices, etc.)',
                    'Click the "Add" button (usually in the top-right)',
                    'Fill in all required information',
                    'Click "Save"',
                  ],
                  outcome: 'New record is created and appears in the list',
                },
                {
                  icon: Edit,
                  title: 'Edit (Modify)',
                  description: 'Change existing information',
                  steps: [
                    'Find the record in the list',
                    'Click the edit/pencil icon',
                    'Make your changes',
                    'Click "Save"',
                  ],
                  outcome: 'Record is updated with new information',
                },
                {
                  icon: Trash2,
                  title: 'Delete (Remove)',
                  description: 'Remove unwanted records',
                  steps: [
                    'Find the record in the list',
                    'Click the trash/delete icon',
                    'Confirm deletion',
                  ],
                  outcome: 'Record is permanently removed',
                },
                {
                  icon: Search,
                  title: 'Search',
                  description: 'Find specific records quickly',
                  steps: [
                    'Look for the search box at the top of any list',
                    'Type customer name, email, or invoice number',
                    'Results filter in real-time',
                  ],
                  outcome: 'Only matching records are displayed',
                },
              ].map(({ icon: Icon, title, description, steps, outcome }) => (
                <Card key={title}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="w-5 h-5 text-accent" />
                      {title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-normal">{description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">How it works:</h4>
                      <ol className="text-sm space-y-1">
                        {steps.map((step, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-semibold text-muted-foreground">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="bg-success/10 border border-success/20 rounded p-2">
                      <p className="text-xs text-success font-semibold">✓ Result: {outcome}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Download className="w-5 h-5 text-accent" />
                    Export
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">Download data to Excel/CSV</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">How it works:</h4>
                    <ol className="text-sm space-y-1">
                      <li className="flex gap-2"><span className="font-semibold text-muted-foreground">1.</span> Open any list page</li>
                      <li className="flex gap-2"><span className="font-semibold text-muted-foreground">2.</span> Click "Export" button</li>
                      <li className="flex gap-2"><span className="font-semibold text-muted-foreground">3.</span> File downloads to your computer</li>
                      <li className="flex gap-2"><span className="font-semibold text-muted-foreground">4.</span> Open in Excel/Google Sheets</li>
                    </ol>
                  </div>
                  <div className="bg-success/10 border border-success/20 rounded p-2">
                    <p className="text-xs text-success font-semibold">✓ Result: Data file ready for analysis/reporting</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ArrowRight className="w-5 h-5 text-accent" />
                    Basic Flow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 overflow-x-auto py-4">
                    <div className="bg-primary/10 rounded-lg px-4 py-2 whitespace-nowrap text-sm font-semibold">📥 Input</div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="bg-accent/10 rounded-lg px-4 py-2 whitespace-nowrap text-sm font-semibold">⚙️ Process</div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="bg-success/10 rounded-lg px-4 py-2 whitespace-nowrap text-sm font-semibold">📊 Output</div>
                  </div>
                  <p className="text-sm text-muted-foreground">Add records → System tracks them → View reports & analytics</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COMMON ACTIONS */}
          <TabsContent value="actions" className="space-y-6">
            <Accordion type="single" collapsible className="space-y-3">
              {[
                {
                  action: 'Record a Payment from a Customer',
                  steps: [
                    '1. Go to Receivables',
                    '2. Find and click on the invoice',
                    '3. Click "Record Payment"',
                    '4. Enter payment amount and date',
                    '5. Select payment method (cash, bank transfer, etc.)',
                    '6. Click "Save"',
                  ],
                },
                {
                  action: 'Send a Payment Reminder to a Customer',
                  steps: [
                    '1. Go to Payment Reminders',
                    '2. Click "Create Campaign"',
                    '3. Select customer and invoice',
                    '4. Choose email or WhatsApp',
                    '5. Select or create a message template',
                    '6. Set frequency and number of reminders',
                    '7. Click "Save"',
                  ],
                },
                {
                  action: 'Log a Follow-up Call/Visit',
                  steps: [
                    '1. Go to My Collections',
                    '2. Find your customer',
                    '3. Click "Add Follow-up"',
                    '4. Select type (Call, Email, Visit, WhatsApp, etc.)',
                    '5. Add notes about what was discussed',
                    '6. Set next follow-up date if needed',
                    '7. Click "Save"',
                  ],
                },
                {
                  action: 'Check Monthly Collection Performance',
                  steps: [
                    '1. Go to Dashboard',
                    '2. Look at "Collection Trends" chart',
                    '3. Or go to Collection Targets',
                    '4. View progress against your targets',
                    '5. Compare actual collections vs. targets',
                  ],
                },
                {
                  action: 'Upload Invoice Document',
                  steps: [
                    '1. Go to Receivables',
                    '2. Click on an invoice',
                    '3. Click "Upload Document"',
                    '4. Select PDF or image file',
                    '5. Document is stored with the invoice',
                  ],
                },
                {
                  action: 'Generate a Report',
                  steps: [
                    '1. Go to Aging Analysis',
                    '2. Select date range',
                    '3. View chart showing age of unpaid invoices',
                    '4. Or go to specific pages and click "Export"',
                    '5. Download data to Excel for custom reporting',
                  ],
                },
              ].map(({ action, steps }) => (
                <AccordionItem key={action} value={action} className="border rounded-lg">
                  <AccordionTrigger className="hover:no-underline px-4 py-3">
                    <h3 className="font-semibold text-left">{action}</h3>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2">
                    <ol className="space-y-2 text-sm">
                      {steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-muted-foreground font-semibold min-w-fit">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {/* FAQ */}
          <TabsContent value="faq" className="space-y-6">
            <Accordion type="single" collapsible className="space-y-3">
              {[
                {
                  q: 'What if I enter wrong information in an invoice?',
                  a: 'You can edit it anytime. Go to Receivables → Find the invoice → Click edit → Make changes → Save.',
                },
                {
                  q: 'Can I delete a paid invoice?',
                  a: 'Yes, but it\'s better to keep it for records. You can mark it as "Paid" instead of deleting. If you must delete, click the delete icon next to the invoice.',
                },
                {
                  q: 'How do I know which customers are overdue?',
                  a: 'Go to Dashboard → Look at "Overdue Alerts" section. Or go to Aging Analysis to see all outstanding invoices grouped by how long they\'ve been unpaid.',
                },
                {
                  q: 'Can I schedule reminders to send automatically?',
                  a: 'Yes! Go to Payment Reminders → Create Campaign → Enable "Auto Reminders" toggle. The system will send reminders at scheduled times.',
                },
                {
                  q: 'What is a Collection Target?',
                  a: 'It\'s a monthly goal. For example, "Collect ₹50,000 from customers in March." You set the target, and the system tracks how much you\'ve actually collected toward that goal.',
                },
                {
                  q: 'Can multiple people use this app?',
                  a: 'Yes! Admins can invite team members. Go to Settings → Invite User. Each person can have different access levels (Admin or User).',
                },
                {
                  q: 'Where are my documents stored?',
                  a: 'All uploaded documents (PDFs, images) are securely stored in the cloud. You can access them anytime by clicking on the invoice and viewing attachments.',
                },
                {
                  q: 'How do I export all my data?',
                  a: 'Go to any list page (Customers, Invoices, Payments, etc.) → Click "Export" button → Data downloads as Excel file.',
                },
                {
                  q: 'What if a customer promises to pay on a certain date?',
                  a: 'Go to My Collections → Click "Add Follow-up" → Select "Promised Payment" → Enter the date. The system will track whether they keep their promise.',
                },
                {
                  q: 'Can I see how much each manager has collected?',
                  a: 'Yes! Go to Dashboard and check the performance charts, or go to Collection Targets to see individual manager progress.',
                },
              ].map(({ q, a }) => (
                <AccordionItem key={q} value={q} className="border rounded-lg">
                  <AccordionTrigger className="hover:no-underline px-4 py-3">
                    <div className="flex items-start gap-3 text-left">
                      <HelpCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      <h3 className="font-semibold">{q}</h3>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2 text-sm">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {/* TIPS & BEST PRACTICES */}
          <TabsContent value="tips" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: '💡 Keep Customer Info Updated',
                  tips: [
                    'Update phone numbers and emails regularly',
                    'Verify GSTIN numbers for correct invoicing',
                    'Note any payment preferences (preferred contact time, payment method)',
                  ],
                },
                {
                  title: '📞 Follow-up Regularly',
                  tips: [
                    'Log every call, email, or visit with a customer',
                    'Add notes about what was promised',
                    'Set next follow-up dates to stay consistent',
                  ],
                },
                {
                  title: '⏰ Act on Overdue Invoices Quickly',
                  tips: [
                    'Check the Aging Analysis page daily',
                    'Prioritize invoices over 30 days unpaid',
                    'Send friendly reminders before calling',
                  ],
                },
                {
                  title: '🎯 Set Realistic Targets',
                  tips: [
                    'Base targets on historical collection rates',
                    'Adjust seasonally if needed',
                    'Review targets monthly and celebrate wins',
                  ],
                },
                {
                  title: '📧 Use Message Templates',
                  tips: [
                    'Create consistent, professional reminder messages',
                    'Use friendly language, not threatening',
                    'Personalize messages with customer names when possible',
                  ],
                },
                {
                  title: '📊 Review Reports Weekly',
                  tips: [
                    'Look at Dashboard to spot trends',
                    'Export data for deeper analysis',
                    'Share reports with your team',
                  ],
                },
                {
                  title: '🔐 Protect Customer Data',
                  tips: [
                    'Don\'t share customer emails publicly',
                    'Use secure passwords for your account',
                    'Review who has access to your data (Settings → Users)',
                  ],
                },
                {
                  title: '⚙️ Automate Repetitive Tasks',
                  tips: [
                    'Set up recurring reminders for regular customers',
                    'Use templates to save time on messaging',
                    'Let the system auto-calculate payment status',
                  ],
                },
              ].map(({ title, tips }) => (
                <Card key={title}>
                  <CardHeader>
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {tips.map((tip, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SUPPORT */}
          <TabsContent value="support" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-accent" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 bg-card/50">
                    <h4 className="font-semibold mb-2">📚 Resources</h4>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>• Check the FAQ section above</li>
                      <li>• Review Tips & Best Practices</li>
                      <li>• Read the Pages section for detailed info</li>
                      <li>• Look at Common Actions for step-by-step guides</li>
                    </ul>
                  </div>
                  <div className="border rounded-lg p-4 bg-card/50">
                    <h4 className="font-semibold mb-2">📧 Contact Support</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      If you encounter issues or have questions not covered here:
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Email: support@cashflowpro.com</li>
                      <li>• Response time: Within 24 hours</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Common Issues & Solutions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    issue: 'I can\'t find a customer I added earlier',
                    solution: 'Use the Search box at the top of the Customers page and type their name or email. If not found, they may have been deleted.',
                  },
                  {
                    issue: 'An invoice shows as "Pending" but I received payment',
                    solution: 'Click the invoice → Click "Record Payment" → Enter the amount received. The status will auto-update to "Paid".',
                  },
                  {
                    issue: 'Payment reminders are not being sent',
                    solution: 'Check if reminders are enabled. Go to Payment Reminders and toggle "Auto Reminders" to ON. Ensure customer email/phone is correct.',
                  },
                  {
                    issue: 'I forgot my password',
                    solution: 'Click "Login" → Click "Forgot Password" → Enter your email → Follow the reset link sent to your inbox.',
                  },
                  {
                    issue: 'Document upload failed',
                    solution: 'Check file size (max 10MB). Supported formats: PDF, JPG, PNG. Try re-uploading or contact support if issue persists.',
                  },
                ].map(({ issue, solution }) => (
                  <div key={issue} className="border rounded-lg p-4 bg-card/50">
                    <h4 className="font-semibold text-sm mb-2 text-foreground">❓ {issue}</h4>
                    <p className="text-sm text-muted-foreground">✓ {solution}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="border-t mt-12 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-muted-foreground">
          <p>CashFlow Pro © 2024 | Version 1.0</p>
          <p className="mt-2">This guide is continuously updated. Last updated: April 2024</p>
        </div>
      </div>
    </div>
  );
}