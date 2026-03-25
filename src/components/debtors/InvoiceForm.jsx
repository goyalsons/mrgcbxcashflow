import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Upload, Sparkles, Loader2, FileText, X, CheckCircle } from 'lucide-react';

const EMPTY = { invoice_number: '', amount: '', invoice_date: '', due_date: '', description: '', notes: '', status: 'pending' };

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    invoice_number: { type: 'string', description: 'Invoice number or ID' },
    amount: { type: 'number', description: 'Total invoice amount' },
    invoice_date: { type: 'string', description: 'Invoice date in YYYY-MM-DD format' },
    due_date: { type: 'string', description: 'Payment due date in YYYY-MM-DD format' },
    description: { type: 'string', description: 'Description of goods or services' },
  },
};

export default function InvoiceForm({ open, onClose, onSave, editData, debtorId, debtorName }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setForm(editData ? { ...EMPTY, ...editData, amount: editData.amount ?? '' } : EMPTY);
    setUploadedFile(null);
    setExtractSuccess(false);
  }, [editData, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setExtractSuccess(false);
    setExtracting(true);

    try {
      // Upload file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract invoice data using AI
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: EXTRACT_SCHEMA,
      });

      if (result.status === 'success' && result.output) {
        const extracted = result.output;
        setForm(prev => ({
          ...prev,
          invoice_number: extracted.invoice_number || prev.invoice_number,
          amount: extracted.amount != null ? String(extracted.amount) : prev.amount,
          invoice_date: extracted.invoice_date || prev.invoice_date,
          due_date: extracted.due_date || prev.due_date,
          description: extracted.description || prev.description,
          document_url: file_url,
        }));
        setExtractSuccess(true);
      }
    } catch (err) {
      console.error('Extraction failed', err);
    } finally {
      setExtracting(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setExtractSuccess(false);
    setForm(prev => ({ ...prev, document_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, debtor_id: debtorId, debtor_name: debtorName, amount: parseFloat(form.amount) || 0 });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Invoice' : 'New Invoice'} — {debtorName}</DialogTitle>
        </DialogHeader>

        {/* AI Upload Zone */}
        {!editData && (
          <div className="mb-1">
            {!uploadedFile ? (
              <label
                htmlFor="invoice-file-upload"
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-primary/30 rounded-lg p-4 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">Auto-fill from Invoice PDF / Image</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Upload className="w-3.5 h-3.5" />
                  Upload PDF, JPG, or PNG — AI will extract the data
                </div>
                <input
                  ref={fileInputRef}
                  id="invoice-file-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${extractSuccess ? 'bg-emerald-50 border-emerald-200' : extracting ? 'bg-blue-50 border-blue-200' : 'bg-muted border-border'}`}>
                {extracting ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                ) : extractSuccess ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {extracting ? 'Extracting data with AI...' : extractSuccess ? 'Data extracted successfully — review & save' : 'Uploaded'}
                  </p>
                </div>
                {!extracting && (
                  <button onClick={handleRemoveFile} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Invoice # *</Label>
              <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-001" required />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} required min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Invoice Date</Label>
              <Input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date *</Label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="written_off">Written Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description of goods/services" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || extracting}>
              {saving ? 'Saving...' : editData ? 'Update' : 'Add Invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}