import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'services', label: 'Services' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'salary', label: 'Salary' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'other', label: 'Other' },
];

const EMPTY = {
   bill_number: '', vendor_id: '', vendor_name: '', vendor_email: '', vendor_phone: '',
   amount: '', amount_paid: 0, due_date: '', bill_date: '', status: 'pending',
   category: '', notes: '', bank_account_id: '', document_url: '',
 };

export default function PayableForm({ open, onClose, onSave, editData }) {
   const [form, setForm] = useState(EMPTY);
   const [saving, setSaving] = useState(false);
   const [uploading, setUploading] = useState(false);

   const { data: vendors = [] } = useQuery({
     queryKey: ['vendors'],
     queryFn: () => base44.entities.Vendor.list(),
   });
   const { data: bankAccounts = [] } = useQuery({
     queryKey: ['bankAccounts'],
     queryFn: () => base44.entities.BankAccount.list(),
   });

  useEffect(() => {
    if (editData) {
      setForm({ ...EMPTY, ...editData, amount: editData.amount || '', amount_paid: editData.amount_paid || 0 });
    } else {
      setForm(EMPTY);
    }
  }, [editData, open]);

  const handleVendorChange = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setForm(f => ({
      ...f,
      vendor_id: vendorId,
      vendor_name: vendor?.name || '',
      vendor_email: vendor?.email || '',
      vendor_phone: vendor?.phone || '',
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, document_url: response.file_url }));
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, amount: Number(form.amount), amount_paid: Number(form.amount_paid) });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Payable' : 'New Payable'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bill Number</Label>
              <Input value={form.bill_number} onChange={e => setForm(f => ({...f, bill_number: e.target.value}))} placeholder="BILL-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor *</Label>
              {vendors.length > 0 ? (
                <Select value={form.vendor_id} onValueChange={handleVendorChange}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.vendor_name} onChange={e => setForm(f => ({...f, vendor_name: e.target.value}))} placeholder="Vendor name" required />
              )}
            </div>
          </div>
          {(form.vendor_email || form.vendor_phone) && (
            <div className="flex gap-4 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              {form.vendor_email && <span>📧 {form.vendor_email}</span>}
              {form.vendor_phone && <span>📞 {form.vendor_phone}</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Amount Paid (₹)</Label>
              <Input type="number" min="0" step="0.01" value={form.amount_paid} onChange={e => setForm(f => ({...f, amount_paid: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bill Date</Label>
              <Input type="date" value={form.bill_date} onChange={e => setForm(f => ({...f, bill_date: e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date *</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Attachment (P.O., Invoice, etc.)</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="file" 
                onChange={handleFileUpload} 
                disabled={uploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="flex-1"
              />
              {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
            </div>
            {form.document_url && (
              <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                ✓ Document uploaded
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (editData ? 'Update' : 'Create')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}