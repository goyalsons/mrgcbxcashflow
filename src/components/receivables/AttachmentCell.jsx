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

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const newItems = await Promise.all(files.map(async (file) => {
        const res = await base44.functions.invoke('uploadToCloudinary', { file });
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
          <input type="file" multiple accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-6 left-0 w-80 bg-popover border rounded-lg shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Attachments ({attachments.length})</span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No attachments yet</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-md group hover:bg-muted/60 transition-colors">
                    <Paperclip className="w-4 h-4 text-primary shrink-0" />
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex-1 text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium min-w-0 break-words"
                    >
                      {item.name || 'File'}
                    </a>
                    <button 
                      onClick={() => removeAttachment(item.url)} 
                      className="text-destructive hover:text-red-700 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}