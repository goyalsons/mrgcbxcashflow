import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Paperclip, FileText, Download, X, Eye } from 'lucide-react';

function isImageUrl(url) {
  return url && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export default function ReceiptCell({ url }) {
  const [open, setOpen] = useState(false);

  if (!url) return <span className="text-muted-foreground text-xs">—</span>;

  const isImage = isImageUrl(url);

  return (
    <>
      <button
        onClick={() => isImage ? setOpen(true) : window.open(url, '_blank')}
        className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
        title="View attachment"
      >
        {isImage ? <Eye className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        {isImage ? 'Image' : 'PDF'}
      </button>

      {/* Image preview dialog */}
      {isImage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl p-2">
            <div className="flex justify-between items-center px-2 pb-2">
              <span className="text-sm font-medium">Receipt Preview</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={url} download target="_blank" rel="noopener noreferrer">
                    <Download className="w-3.5 h-3.5 mr-1" /> Download
                  </a>
                </Button>
              </div>
            </div>
            <img src={url} alt="Receipt" className="w-full max-h-[70vh] object-contain rounded-lg border" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}