import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { format } from 'date-fns';

const ACTION_COLORS = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  payment_recorded: 'bg-purple-50 text-purple-700 border-purple-200',
  status_changed: 'bg-amber-50 text-amber-700 border-amber-200',
  follow_up_added: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

function ChangesDetail({ changes, action }) {
  if (!changes) return null;

  // For updates, try to show old->new per field
  if (action === 'update' && typeof changes === 'object' && !Array.isArray(changes)) {
    const entries = Object.entries(changes);
    if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">No field details recorded.</p>;
    return (
      <div className="space-y-1">
        {entries.map(([field, val]) => {
          const hasOldNew = val && typeof val === 'object' && ('oldValue' in val || 'newValue' in val);
          return (
            <div key={field} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground capitalize">{field.replace(/_/g, ' ')}:</span>
              {hasOldNew ? (
                <>
                  {val.oldValue !== undefined && (
                    <span className="line-through text-red-500 bg-red-50 px-1 rounded">{String(val.oldValue)}</span>
                  )}
                  <span className="text-muted-foreground">→</span>
                  {val.newValue !== undefined && (
                    <span className="text-emerald-700 bg-emerald-50 px-1 rounded font-medium">{String(val.newValue)}</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">{JSON.stringify(val)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: pretty JSON
  return (
    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
      {JSON.stringify(changes, null, 2)}
    </pre>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  let changes = null;
  try { changes = log.changes ? JSON.parse(log.changes) : null; } catch {}

  const hasChanges = changes !== null;
  const istTimestamp = log.created_date
    ? format(new Date(log.created_date), 'dd MMM yyyy, hh:mm:ss a')
    : '-';

  return (
    <>
      <TableRow
        className={`hover:bg-muted/30 transition-colors ${hasChanges ? 'cursor-pointer' : ''}`}
        onClick={() => hasChanges && setExpanded(e => !e)}
      >
        <TableCell>
          <div className="flex items-center gap-1.5">
            {hasChanges
              ? (expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />)
              : <div className="w-3.5 shrink-0" />
            }
            <span className="text-sm font-medium">{log.entity_name || log.entity_id || '-'}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">{log.entity_type || '-'}</span>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {log.action?.replace(/_/g, ' ')}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">{log.performed_by_name || log.performed_by || '-'}</TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{istTimestamp}</TableCell>
      </TableRow>

      {expanded && hasChanges && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/10 px-6 py-3 border-b">
            <div className="max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Changes Detail</p>
              <ChangesDetail changes={changes} action={log.action} />
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

  const entities = [...new Set(logs.map(l => l.entity_type).filter(Boolean))].sort();
  const actions = [...new Set(logs.map(l => l.action).filter(Boolean))].sort();

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      (l.entity_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.performed_by || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.performed_by_name || '').toLowerCase().includes(search.toLowerCase()) ||
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
            {action.replace(/_/g, ' ')}: <span className="font-bold">{count}</span>
          </div>
        ))}
        {logs.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium bg-gray-50 text-gray-600 border-gray-200 ml-auto">
            Total: <span className="font-bold">{logs.length}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by entity, user, or type..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)}
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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[220px]">Entity / Record</TableHead>
                    <TableHead className="w-[140px]">Type</TableHead>
                    <TableHead className="w-[140px]">Action</TableHead>
                    <TableHead className="w-[160px]">Performed By</TableHead>
                    <TableHead className="w-[180px]">Timestamp (IST)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(log => <LogRow key={log.id} log={log} />)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
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