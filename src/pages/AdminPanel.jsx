import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, Shield, UserCheck, UserX, MoreHorizontal, Mail, Search, UserPlus, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

const ROLES = ['admin', 'user', 'account_manager'];
const ROLE_COLORS = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  user: 'bg-blue-50 text-blue-700 border-blue-200',
  account_manager: 'bg-amber-50 text-amber-700 border-amber-200',
};
const ROLE_LABELS = { admin: 'Admin', user: 'User', account_manager: 'Account Manager' };

function InviteModal({ open, onClose }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    await base44.users.inviteUser(email, role);
    toast({ title: `Invitation sent to ${email}` });
    setEmail(''); setRole('user'); setInviting(false); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email Address *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="user@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={inviting}>{inviting ? 'Sending...' : 'Send Invitation'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Role updated' }); },
  });

  const filtered = users.filter(u =>
    !search ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const roleCount = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        subtitle="Manage users, roles, and access control"
        actionLabel="Invite User"
        onAction={() => setShowInvite(true)}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div><div className="text-xs text-purple-600 font-medium">Admins</div><div className="text-xl font-bold text-purple-700">{roleCount.admin || 0}</div></div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div><div className="text-xs text-blue-600 font-medium">Users</div><div className="text-xl font-bold text-blue-700">{roleCount.user || 0}</div></div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-amber-600" />
            <div><div className="text-xs text-amber-600 font-medium">Account Managers</div><div className="text-xl font-bold text-amber-700">{roleCount.account_manager || 0}</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Member Since</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {(u.full_name || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{u.full_name || '—'}</div>
                      {u.id === currentUser?.id && <div className="text-xs text-muted-foreground">(You)</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${ROLE_COLORS[u.role] || ''}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateIN(u.created_date)}</TableCell>
                <TableCell>
                  {u.id !== currentUser?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ROLES.filter(r => r !== u.role).map(r => (
                          <DropdownMenuItem key={r} onClick={() => updateRoleMut.mutate({ id: u.id, role: r })}>
                            Set as {ROLE_LABELS[r]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Permissions Matrix */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Role Permissions Matrix</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Permission</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-center">Accounts Team</TableHead>
                <TableHead className="text-center">Sales Team</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: 'View Dashboard Financials', admin: true, accounts: true, sales: false },
                { label: 'Add / Create Entries', admin: true, accounts: true, sales: false },
                { label: 'Edit Entries', admin: true, accounts: true, sales: false },
                { label: 'Delete Entries', admin: true, accounts: false, sales: false },
                { label: 'Invoices & Payments', admin: true, accounts: true, sales: false },
                { label: 'Receivables & Payables', admin: true, accounts: true, sales: false },
                { label: 'Expenses & Bank Accounts', admin: true, accounts: true, sales: false },
                { label: 'My Collections & Follow-ups', admin: true, accounts: false, sales: true },
                { label: 'Payment Reminders', admin: true, accounts: false, sales: true },
                { label: 'Reports & Analytics', admin: true, accounts: true, sales: false },
                { label: 'Admin Panel & Settings', admin: true, accounts: false, sales: false },
              ].map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{row.label}</TableCell>
                  {[row.admin, row.accounts, row.sales].map((allowed, j) => (
                    <TableCell key={j} className="text-center">
                      {allowed
                        ? <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        : <X className="w-4 h-4 text-red-400 mx-auto" />}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}