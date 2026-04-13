import React, { useState } from 'react';
import { Paperclip, Upload, X, ExternalLink, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function AttachmentCell({ invoice, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const attachments = (() => {
    try {
      const raw = invoice.attachments;
      if (!raw) return invoice.document_url ? [{ name: 'Document', url: invoice.document_url }] : [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  const getCloudinaryCreds = () => {
    try {
      const s = JSON.parse(localStorage.getItem('cashflow_pro_settings') || '{}');
      return s.cloudinary || {};
    } catch { return {}; }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const creds = getCloudinaryCreds();
    if (!creds.cloud_name || !creds.api_key || !creds.api_secret) {
      toast({ title: 'Cloudinary not configured', description: 'Please set up Cloudinary in Settings → Storage', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const newItems = await Promise.all(files.map(async (file) => {
        // Convert file to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await base44.functions.invoke('uploadToCloudinary', {
          cloud_name: creds.cloud_name,
          api_key: creds.api_key,
          api_secret: creds.api_secret,
          file: base64,
          file_name: file.name,
        });
        if (!res.data?.url) throw new Error(res.data?.error || 'Upload failed');
        return { name: file.name, url: res.data.url };
      }));
      const updated = [...attachments, ...newItems];
      await onUpdate(invoice.id, { attachments: JSON.stringify(updated) });
      toast({ title: `${files.length} file(s) uploaded` });
      setOpen(true);
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeAttachment = async (url) => {
    const updated = attachments.filter(a => a.url !== url);
    await onUpdate(invoice.id, { attachments: JSON.stringify(updated) });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors ${attachments.length > 0 ? 'text-blue-600 hover:bg-blue-50' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <Paperclip className="w-3 h-3" />
          {attachments.length > 0 && <span className="font-medium">{attachments.length}</span>}
        </button>
        <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          <input type="file" multiple className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {open && (
        <div className="absolute z-50 top-6 left-0 w-64 bg-popover border rounded-lg shadow-lg p-2 space-y-1">
          <div className="flex items-center justify-between pb-1 border-b">
            <span className="text-xs font-semibold">Attachments ({attachments.length})</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
          </div>
          {attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No attachments yet</p>
          ) : (
            attachments.map((item, i) => (
              <div key={i} className="flex items-center gap-1 group">
                <a href={item.url} target="_blank" rel="noreferrer" className="flex-1 flex items-center gap-1.5 text-xs text-blue-600 hover:underline min-w-0">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{item.name || 'File'}</span>
                </a>
                <button onClick={() => removeAttachment(item.url)} className="opacity-0 group-hover:opacity-100 text-destructive hover:text-red-700 transition-opacity shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}