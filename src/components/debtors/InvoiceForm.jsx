import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Upload, Sparkles, Loader2, FileText, X, CheckCircle, Cloud } from 'lucide-react';
import { uploadToCloudinary, getCloudinaryConfig } from '@/lib/utils/cloudinary';

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
      const cloudConfig = getCloudinaryConfig();
      let fileUrl;

      // Try Cloudinary first, fallback to Base44 upload
      if (cloudConfig.cloud_name) {
        try {
          const result = await uploadToCloudinary(file, 'invoices');
          fileUrl = result.url;
        } catch (err) {
          console.warn('Cloudinary upload failed, using Base44 upload:', err.message);
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          fileUrl = file_url;
        }
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
      }

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
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
          document_url: fileUrl,
        }));
        setExtractSuccess(true);
      }
    } catch (err) {
      console.error('Extraction failed', err);
    } finally {
      setExtracting(false);
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
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">{editData ? 'Edit Invoice' : 'New Invoice'} — {debtorName}</DialogTitle>
        </DialogHeader>

        {/* AI Upload Zone — only for new invoices */}
        {!editData && (
          <div className="shrink-0">
            {!uploadedFile ? (
              <>
                <label
                  htmlFor="invoice-file-upload"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 hover:border-primary/60 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">AI Auto-fill from Invoice</p>
                    <p className="text-xs text-muted-foreground">Upload PDF, JPG or PNG — fields will be filled automatically</p>
                  </div>
                  <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    ref={fileInputRef}
                    id="invoice-file-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {getCloudinaryConfig().cloud_name && (
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> Files uploaded to Cloudinary
                  </div>
                )}
              </>
            ) : (
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
                extracting ? 'bg-blue-50 border-blue-200' :
                extractSuccess ? 'bg-emerald-50 border-emerald-200' :
                'bg-muted border-border'
              }`}>
                {extracting ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                ) : extractSuccess ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                  <p className={`text-xs ${extracting ? 'text-blue-600' : extractSuccess ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {extracting ? 'Extracting data with AI...' : extractSuccess ? 'Data extracted — review fields below' : 'Uploaded'}
                  </p>
                </div>
                {!extracting && (
                  <button type="button" onClick={handleRemoveFile} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form — scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice # *</Label>
                <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-001" required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} required min="0" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Date</Label>
                <Input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date *</Label>
                <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} required className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description of goods/services" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t mt-3 shrink-0">
            <Button type="button" variant="outline" onClick={onClose} size="sm">Cancel</Button>
            <Button type="submit" disabled={saving || extracting} size="sm">
              {saving ? 'Saving...' : editData ? 'Update' : 'Add Invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}