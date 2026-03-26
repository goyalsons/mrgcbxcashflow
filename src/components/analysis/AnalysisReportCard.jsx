import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function AnalysisReportCard({ report, onDelete, onLoad }) {
  const result = report.result ? JSON.parse(report.result) : null;
  const fileNames = report.file_names ? report.file_names.split(',') : [];

  const handleLoad = () => {
    if (result) onLoad(result, report.prompt);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{report.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {report.created_date ? format(new Date(report.created_date), 'dd MMM yyyy') : ''}
            </p>
          </div>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {fileNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {fileNames.map((f, i) => (
              <span key={i} className="flex items-center gap-1 text-xs bg-muted/60 rounded px-1.5 py-0.5">
                <FileText className="w-3 h-3" /> {f.trim()}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground line-clamp-2 italic">"{report.prompt}"</p>

        {result?.summary && (
          <p className="text-xs text-foreground/80 line-clamp-2">{result.summary}</p>
        )}

        <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5" onClick={handleLoad}>
          <ExternalLink className="w-3 h-3" /> Load Report
        </Button>
      </CardContent>
    </Card>
  );
}