import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, SkipForward, RefreshCw, Mail, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  sent: { label: 'Sent', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
  skipped: { label: 'Skipped', icon: SkipForward, className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const CHANNEL_ICON = {
  email: <Mail className="w-3.5 h-3.5" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5 text-green-600" />,
  sms: <MessageSquare className="w-3.5 h-3.5 text-purple-600" />,
};

export default function ReminderLogs() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reminderLogs'],
    queryFn: () => base44.entities.ReminderLog.list('-created_date', 200),
  });

  const filtered = logs.filter(log => {
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    if (channelFilter !== 'all' && log.channel !== channelFilter) return false;
    return true;
  });

  const counts = {
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">{counts.sent} Sent</span>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700">{counts.failed} Failed</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <SkipForward className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">{counts.skipped} Skipped</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading logs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No logs found</p>
          <p className="text-sm mt-1">Logs will appear here once reminders are sent.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date & Time</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Recipient</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Channel</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Triggered By</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, idx) => {
                const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.sent;
                const Icon = sc.icon;
                return (
                  <tr key={log.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${log.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {log.created_date ? format(new Date(log.created_date), 'dd MMM yyyy, HH:mm') : '-'}
                    </td>
                    <td className="px-4 py-3 font-medium">{log.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{log.recipient || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 capitalize">
                        {CHANNEL_ICON[log.channel]}
                        {log.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">{log.triggered_by || 'auto'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold ${sc.className}`}>
                        <Icon className="w-3 h-3" />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">
                      {log.status === 'failed' && log.error_message ? (
                        <span className="text-red-600 font-mono">{log.error_message}</span>
                      ) : log.subject ? (
                        <span className="truncate block" title={log.subject}>{log.subject}</span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}