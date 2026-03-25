import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

const ACTION_COLORS = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  payment_recorded: 'bg-purple-50 text-purple-700 border-purple-200',
  status_changed: 'bg-amber-50 text-amber-700 border-amber-200',
  follow_up_added: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  let changes = null;
  try { changes = log.changes ? JSON.parse(log.changes) : null; } catch {}

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => changes && setExpanded(e => !e)}>
        <TableCell>
          <div className="flex items-center gap-1">
            {changes ? (expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />) : <div className="w-3.5" />}
            <span className="text-sm">{log.entity_name || log.entity_id || '-'}</span>
          </div>
        </TableCell>
        <TableCell><span className="text-sm text-muted-foreground">{log.entity_type}</span></TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {log.action?.replace('_', ' ')}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">{log.performed_by_name || log.performed_by}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{log.created_date ? new Date(log.created_date).toLocaleString('en-IN') : '-'}</TableCell>
      </TableRow>
      {expanded && changes && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/20 py-2 px-4">
            <div className="text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
              {JSON.stringify(changes, null, 2)}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
  });

  const entities = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];
  const actions = [...new Set(logs.map(l => l.action).filter(Boolean))];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      (l.entity_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.performed_by || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.entity_type || '').toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    const matchEntity = entityFilter === 'all' || l.entity_type === entityFilter;
    return matchSearch && matchAction && matchEntity;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const countByAction = actions.reduce((acc, a) => ({ ...acc, [a]: logs.filter(l => l.action === a).length }), {});

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="Complete trail of all create, update, and delete actions" />

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(countByAction).map(([action, count]) => (
          <div key={action} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${ACTION_COLORS[action] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {action.replace('_', ' ')}: {count}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Entities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No audit logs found</p>
          <p className="text-sm text-muted-foreground mt-1">Logs are created automatically when data is added, updated, or deleted</p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity / Record</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(log => <LogRow key={log.id} log={log} />)}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}