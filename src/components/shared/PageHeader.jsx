import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function PageHeader({ title, subtitle, actionLabel, onAction, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-5 border-b border-border">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        {actionLabel && onAction && (
          <Button onClick={onAction} size="sm" className="gap-1.5 h-8 text-sm">
            <Plus className="w-3.5 h-3.5" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}