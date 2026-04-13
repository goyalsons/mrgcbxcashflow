import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Pencil, Trash2, MoreHorizontal, Copy, Check, Mail, MessageSquare, Star } from 'lucide-react';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy} title="Copy message">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </Button>
  );
}

function TemplateCard({ t, ts = {}, setTemplateTestState, setEditingTemplate, setShowTemplateEditor, deleteTemplateMut, handleTemplateTest, defaultReminderTemplateId, setDefaultReminderTemplateId }) {
  const isDefault = t.id === defaultReminderTemplateId;
  const isWhatsApp = t.type === 'whatsapp';
  const isEmail = t.type === 'email';

  const cardBg = isWhatsApp
    ? 'border-green-200 bg-green-50/40'
    : isEmail
    ? 'border-blue-200 bg-blue-50/40'
    : 'border-purple-200 bg-purple-50/40';

  const badgeStyle = isWhatsApp
    ? 'bg-green-100 text-green-700 border-green-300'
    : isEmail
    ? 'bg-blue-100 text-blue-700 border-blue-300'
    : 'bg-purple-100 text-purple-700 border-purple-300';

  return (
    <Card className={`${cardBg} shadow-sm hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{isWhatsApp ? '💬' : isEmail ? '📧' : '📱'}</span>
            <span className="font-semibold text-sm">{t.name}</span>
            <Badge variant="outline" className={`text-xs ${badgeStyle}`}>{t.type}</Badge>
            {isDefault && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300"><Star className="w-2.5 h-2.5 mr-1" />Default Reminder</Badge>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <CopyButton text={isEmail && t.subject ? `Subject: ${t.subject}\n\n${t.body}` : t.body} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditingTemplate(t); setShowTemplateEditor(true); }}>
                  <Pencil className="w-4 h-4 mr-2" />Edit
                </DropdownMenuItem>
                {isEmail && (
                  <DropdownMenuItem onClick={() => setDefaultReminderTemplateId(isDefault ? '' : t.id)}>
                    <Star className="w-4 h-4 mr-2" />{isDefault ? 'Remove as Default' : 'Set as Default Reminder'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete template?')) deleteTemplateMut.mutate(t.id); }}>
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {t.subject && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-white/70 border border-blue-100">
            <span className="text-xs font-semibold text-blue-600 shrink-0">Subject:</span>
            <span className="text-xs text-foreground">{t.subject}</span>
          </div>
        )}
        <div className="relative p-3 rounded-md bg-white/70 border border-gray-100">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-5 pr-2">{t.body}</p>
        </div>

        {isEmail && (
          <div className="border-t border-blue-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-blue-700">📤 Send Test Email</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="recipient@example.com"
                className="h-7 text-xs flex-1 bg-white"
                value={ts.email || ''}
                onChange={e => setTemplateTestState(prev => ({ ...prev, [t.id]: { ...prev[t.id], email: e.target.value } }))}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 border-blue-300 text-blue-700 hover:bg-blue-50"
                disabled={ts.sending || !ts.email}
                onClick={() => handleTemplateTest(t, ts.email)}>
                {ts.sending ? '⏳' : 'Send'}
              </Button>
            </div>
            {ts.result && (
              <p className={`text-xs ${ts.result.success ? 'text-emerald-600' : 'text-red-600'}`}>{ts.result.message}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon, label, count, colorClass }) {
  return (
    <div className={`flex items-center gap-3 py-3 px-4 rounded-xl ${colorClass}`}>
      <span className="text-lg">{icon}</span>
      <span className="font-bold text-sm">{label}</span>
      <span className="ml-auto text-xs font-medium opacity-70">{count} template{count !== 1 ? 's' : ''}</span>
    </div>
  );
}

export default function TemplatesTab({
  templates, templateTestState, setTemplateTestState,
  setEditingTemplate, setShowTemplateEditor, deleteTemplateMut, handleTemplateTest,
  defaultReminderTemplateId, setDefaultReminderTemplateId
}) {
  const emailTemplates = templates.filter(t => t.type === 'email');
  const whatsappTemplates = templates.filter(t => t.type === 'whatsapp');
  const otherTemplates = templates.filter(t => t.type !== 'email' && t.type !== 'whatsapp');

  const cardProps = { templateTestState, setTemplateTestState, setEditingTemplate, setShowTemplateEditor, deleteTemplateMut, handleTemplateTest, defaultReminderTemplateId, setDefaultReminderTemplateId };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }} className="gap-2">
          <Plus className="w-4 h-4" />New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No templates yet.</p>
          <p className="text-sm mt-1">Create your first message template to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Email Templates */}
          {emailTemplates.length > 0 && (
            <div className="space-y-4">
              <SectionHeader icon="📧" label="Email Templates" count={emailTemplates.length} colorClass="bg-blue-50 border border-blue-200 text-blue-800" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emailTemplates.map(t => (
                  <TemplateCard key={t.id} t={t} ts={templateTestState[t.id]} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          {emailTemplates.length > 0 && whatsappTemplates.length > 0 && (
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-dashed border-gray-300" />
              <span className="mx-4 text-xs text-muted-foreground bg-background px-2">WhatsApp</span>
              <div className="flex-grow border-t border-dashed border-gray-300" />
            </div>
          )}

          {/* WhatsApp Templates */}
          {whatsappTemplates.length > 0 && (
            <div className="space-y-4">
              <SectionHeader icon="💬" label="WhatsApp Templates" count={whatsappTemplates.length} colorClass="bg-green-50 border border-green-200 text-green-800" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {whatsappTemplates.map(t => (
                  <TemplateCard key={t.id} t={t} ts={templateTestState[t.id]} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {/* Other */}
          {otherTemplates.length > 0 && (
            <div className="space-y-4">
              <SectionHeader icon="📱" label="SMS Templates" count={otherTemplates.length} colorClass="bg-purple-50 border border-purple-200 text-purple-800" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherTemplates.map(t => (
                  <TemplateCard key={t.id} t={t} ts={templateTestState[t.id]} {...cardProps} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}