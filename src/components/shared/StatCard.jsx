import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, trend, trendLabel, variant = 'default' }) {
  const variantStyles = {
    default: 'border-l-primary',
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    danger: 'border-l-red-500',
    info: 'border-l-blue-500',
  };

  return (
    <Card className={`relative overflow-hidden border-l-4 ${variantStyles[variant]} p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-2">
              {trend >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {trendLabel || `${Math.abs(trend)}%`}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>
    </Card>
  );
}