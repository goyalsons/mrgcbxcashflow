import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

const VARIANT = {
  default: { border: 'border-l-primary', icon: 'bg-primary/10 text-primary' },
  success: { border: 'border-l-emerald-500', icon: 'bg-emerald-50 text-emerald-600' },
  warning: { border: 'border-l-amber-500', icon: 'bg-amber-50 text-amber-600' },
  danger:  { border: 'border-l-red-500',   icon: 'bg-red-50 text-red-600' },
  info:    { border: 'border-l-blue-500',  icon: 'bg-blue-50 text-blue-600' },
};

export default function StatCard({ title, value, icon: Icon, trend, trendLabel, variant = 'default', subtitle }) {
  const styles = VARIANT[variant] || VARIANT.default;

  return (
    <Card className={`border-l-4 ${styles.border} p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{title}</p>
          <p className="text-xl font-bold text-foreground mt-0.5 truncate">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-1.5">
              {trend >= 0
                ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                : <TrendingDown className="w-3 h-3 text-red-500" />}
              <span className={`text-[11px] font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {trendLabel || `${Math.abs(trend)}%`}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg shrink-0 ${styles.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </Card>
  );
}