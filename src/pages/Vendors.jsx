import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Search, Upload, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ContactForm from '@/components/contacts/ContactForm';
import { useToast } from '@/components/ui/use-toast';

const ITEMS_PER_PAGE = 50;

export default function Vendors() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
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
    let result = vendors;
    if (search) {
      const q = search.toLowerCase();
      result = vendors.filter(v =>
        (v.name || '').toLowerCase().includes(q) ||
        (v.email || '').toLowerCase().includes(q) ||
        (v.phone || '').toLowerCase().includes(q) ||
        (v.contact_person || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const aVal = String(a[sortBy] || '').toLowerCase();
      const bVal = String(b[sortBy] || '').toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return result;
  }, [vendors, search, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const SortHeader = ({ label, col }) => (
    <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => toggleSort(col)}>
      <div className="flex items-center gap-1.5 font-semibold">
        {label}
        {sortBy === col ? (
          sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-4 h-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Vendors" subtitle={`${vendors.length} vendors`} actionLabel="Add Vendor" onAction={() => { setEditing(null); setShowForm(true); }}>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/csv-import?type=vendor')}>
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
        <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 border-primary/20 focus:border-primary" />
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : vendors.length === 0 ? (
          <EmptyState title="No vendors yet" description="Add your vendors to track payables" actionLabel="Add Vendor" onAction={() => setShowForm(true)} />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No vendors match your search</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b-2 border-slate-200">
                <TableRow className="hover:bg-slate-50/80">
                  <SortHeader label="Company" col="name" />
                  <SortHeader label="Contact Person" col="contact_person" />
                  <SortHeader label="Email" col="email" />
                  <SortHeader label="Phone" col="phone" />
                  <SortHeader label="Address" col="address" />
                  <SortHeader label="State" col="state" />
                  <SortHeader label="Country" col="country" />
                  <SortHeader label="GSTIN" col="gstin" />
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((v) => (
                  <TableRow key={v.id} className="group hover:bg-primary/5 border-slate-200/50">
                    <TableCell className="font-semibold text-slate-900">{v.name}</TableCell>
                    <TableCell className="text-slate-700">{v.contact_person || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-600">{v.email || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-700">{v.phone || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[150px] truncate">{v.address || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-700">{v.state || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-700">{v.country || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-xs text-slate-600 font-mono">{v.gstin || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 hover:bg-primary/10"><MoreHorizontal className="w-4 h-4 text-primary" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/vendor/${v.id}`)}><Eye className="w-4 h-4 mr-2" /> View Profile</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(v); setShowForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (confirm('Delete?')) deleteMut.mutate(v.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
              {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages} • Showing {paginatedData.length} of {filtered.length} vendors</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last</Button>
                </div>
              </div>
              )}
              {search && <div className="px-4 py-3 border-t text-xs text-muted-foreground">Showing {filtered.length} of {vendors.length}</div>}
              </div>
              )}
              </Card>

      <ContactForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} type="Vendor" />
    </div>
  );
}