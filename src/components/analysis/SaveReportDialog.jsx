import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Save, Loader2 } from 'lucide-react';

export default function SaveReportDialog({ prompt, files, fileUrls, analysisResult, onClose, onSaved }) {
  const [name, setName] = useState(`Report - ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.AnalysisReport.create({
      name,
      prompt,
      file_names: files.join(', '),
      file_urls: JSON.stringify(fileUrls),
      result: JSON.stringify(analysisResult),
      summary: analysisResult?.summary || '',
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Save className="w-4 h-4 text-primary" /> Save Report
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Report Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-9" />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 space-y-1">
            <p><span className="font-medium">Files:</span> {files.length > 0 ? files.join(', ') : 'None'}</p>
            <p className="line-clamp-2"><span className="font-medium">Prompt:</span> {prompt}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}