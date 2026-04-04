import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Search, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ContactForm from '@/components/contacts/ContactForm';
import { useToast } from '@/components/ui/use-toast';

export default function Vendors() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list('-created_date'),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Vendor.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); setShowForm(false); toast({ title: 'Vendor added' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Vendor.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); setShowForm(false); setEditing(null); toast({ title: 'Vendor updated' }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Vendor.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast({ title: 'Vendor deleted' }); },
  });

  const handleSave = async (formData) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data: formData });
    else await createMut.mutateAsync(formData);
  };

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.phone || '').toLowerCase().includes(q) ||
      (v.contact_person || '').toLowerCase().includes(q)
    );
  }, [vendors, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Vendors" subtitle={`${vendors.length} vendors`} actionLabel="Add Vendor" onAction={() => { setEditing(null); setShowForm(true); }}>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/csv-import?type=vendor')}>
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : vendors.length === 0 ? (
          <EmptyState title="No vendors yet" description="Add your vendors to track payables" actionLabel="Add Vendor" onAction={() => setShowForm(true)} />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No vendors match your search</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow key={v.id} className="group">
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.contact_person || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{v.email || '-'}</TableCell>
                    <TableCell>{v.phone || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{v.gstin || '-'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(v); setShowForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (confirm('Delete?')) deleteMut.mutate(v.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {search && <div className="px-4 py-3 border-t text-xs text-muted-foreground">Showing {filtered.length} of {vendors.length}</div>}
          </div>
        )}
      </Card>

      <ContactForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} type="Vendor" />
    </div>
  );
}