import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatINR } from '@/lib/utils/currency';
import { Target } from 'lucide-react';

export default function TopCollectionTargets() {
  const { data: targets = [] } = useQuery({
    queryKey: ['collectionTargets'],
    queryFn: () => base44.entities.CollectionTarget.list('-created_date'),
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const top5 = useMemo(() => {
    return targets
      .filter(t => t.period_month === currentMonth && t.period_year === currentYear)
      .map(t => ({
        ...t,
        pct: t.target_amount > 0 ? Math.min(100, Math.round(((t.collected_amount || 0) / t.target_amount) * 100)) : 0,
      }))
      .sort((a, b) => b.target_amount - a.target_amount)
      .slice(0, 5);
  }, [targets, currentMonth, currentYear]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Top 5 Collection Targets
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {now.toLocaleString('default', { month: 'long' })} {currentYear} — by target value
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {top5.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No targets set for this month</p>
        ) : (
          <div className="divide-y divide-border">
            {top5.map((t, i) => (
              <div key={t.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.customer_name || t.manager_name || t.manager_email}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.manager_name || t.manager_email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-bold text-primary">{t.pct}%</p>
                    <p className="text-xs text-muted-foreground">{formatINR(t.collected_amount || 0)} / {formatINR(t.target_amount)}</p>
                  </div>
                </div>
                <Progress value={t.pct} className="h-1.5 ml-7" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}