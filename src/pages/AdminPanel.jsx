/**
 * AdminPanel.jsx
 * © 2025 CEOITBOX Tech Services LLP. All rights reserved.
 * https://www.ceoitbox.com
 */
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
import { Users, Shield, UserCheck, UserX, MoreHorizontal, Mail, Search, UserPlus, Clock, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

const ROLES = ['admin', 'accounts_team', 'sales_team', 'inactive'];
const ROLE_COLORS = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  accounts_team: 'bg-blue-50 text-blue-700 border-blue-200',
  sales_team: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
};
const ROLE_LABELS = { admin: 'Admin', accounts_team: 'User', sales_team: 'Account Manager', inactive: 'Inactive' };

function InviteModal({ open, onClose, onInvited }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('accounts_team');
  const INVITE_ROLES = ['admin', 'accounts_team', 'sales_team', 'inactive'];
  const [inviting, setInviting] = useState(false);
  const queryClient = useQueryClient();

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    // Platform only supports 'user' or 'admin' — invite as 'user' then upgrade role
    const platformRole = (role === 'accounts_team' || role === 'sales_team' || role === 'inactive') ? 'user' : role;
    await base44.users.inviteUser(email, platformRole);
    // The actual role will be set via pending invitation once they log in
    const me = await base44.auth.me();
    await base44.entities.PendingInvitation.create({ email, role, invited_by: me?.email, invited_by_name: me?.full_name });
    queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] });
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
                {INVITE_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
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
    queryFn: async () => {
      const res = await base44.functions.invoke('listAllUsers', {});
      return res.data.users || [];
    },
  });

  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['pendingInvitations'],
    queryFn: () => base44.entities.PendingInvitation.list('-created_date'),
  });

  // Remove pending invitation once the user has joined with the correct role
  const joinedEmails = new Set(users.map(u => u.email));
  const stillPending = pendingInvitations.filter(inv => !joinedEmails.has(inv.email));
  // Users who joined but need their custom role applied
  const needsRoleUpgrade = pendingInvitations.filter(inv =>
    ['accounts_team', 'sales_team', 'inactive'].includes(inv.role) &&
    users.find(u => u.email === inv.email && u.role !== inv.role)
  );

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ id, role }) => base44.functions.invoke('updateUserRole', { userId: id, role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Role updated' }); },
  });

  const deleteUserMut = useMutation({
    mutationFn: (id) => base44.functions.invoke('deleteUser', { userId: id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'User deleted' }); },
  });

  const removeInviteMut = useMutation({
    mutationFn: (id) => base44.entities.PendingInvitation.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] }); toast({ title: 'Invitation removed' }); },
  });

  const filtered = users.filter(u =>
    !search ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const roleCount = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {});
  const inactiveCount = users.filter(u => !u.role || u.role === 'inactive').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        subtitle="Manage users, roles, and access control"
        actionLabel="Invite User"
        onAction={() => setShowInvite(true)}
      />

      {/* Needs Role Upgrade */}
      {needsRoleUpgrade.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
              <UserCheck className="w-4 h-4" /> Finalize Account Manager Roles ({needsRoleUpgrade.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {needsRoleUpgrade.map(inv => {
                const u = users.find(usr => usr.email === inv.email);
                return (
                  <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg border border-blue-200 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{u?.full_name || inv.email}</div>
                      <div className="text-xs text-muted-foreground">{inv.email} · needs role: <span className="font-medium">{ROLE_LABELS[inv.role] || inv.role}</span></div>
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={async () => {
                      await base44.functions.invoke('updateUserRole', { userId: u?.id, role: inv.role });
                      await base44.entities.PendingInvitation.delete(inv.id);
                      queryClient.invalidateQueries({ queryKey: ['users'] });
                      queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] });
                      toast({ title: `${u?.full_name || inv.email} assigned role: ${ROLE_LABELS[inv.role] || inv.role}` });
                    }}>Assign Role</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {stillPending.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Clock className="w-4 h-4" /> Pending Invitations ({stillPending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {stillPending.map(inv => (
                <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                      <Mail className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">Invited as <span className="font-medium">{ROLE_LABELS[inv.role] || inv.role}</span> · by {inv.invited_by_name || inv.invited_by}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">Pending Login</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeInviteMut.mutate(inv.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div><div className="text-xs text-purple-600 font-medium">Admins</div><div className="text-xl font-bold text-purple-700">{roleCount.admin || 0}</div></div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div><div className="text-xs text-blue-600 font-medium">Users</div><div className="text-xl font-bold text-blue-700">{roleCount.accounts_team || 0}</div></div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-amber-600" />
            <div><div className="text-xs text-amber-600 font-medium">Account Managers</div><div className="text-xl font-bold text-amber-700">{roleCount.sales_team || 0}</div></div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4 flex items-center gap-3">
            <UserX className="w-8 h-8 text-gray-400" />
            <div><div className="text-xs text-gray-500 font-medium">Inactive</div><div className="text-xl font-bold text-gray-500">{inactiveCount}</div></div>
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
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { if (confirm(`Delete user ${u.full_name || u.email}? This cannot be undone.`)) deleteUserMut.mutate(u.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InviteModal open={showInvite} onClose={() => { setShowInvite(false); queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] }); }} />
    </div>
  );
}