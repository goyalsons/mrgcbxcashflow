import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};

export default function FundingSummaryCard({ weeklyData }) {
  const totalFundingIn  = weeklyData.reduce((s, w) => s + (w.fundingInflow  || 0), 0);
  const totalRepayOut   = weeklyData.reduce((s, w) => s + (w.repaymentOutflow || 0), 0);
  const netCost         = totalRepayOut - totalFundingIn;

  const negativeWeeks = weeklyData.filter(w => (w.simNetWithFunding ?? w.simNet) < 0).map(w => w.label.split(' ')[0]);
  const rescuedWeeks  = weeklyData.filter(w => w.baseNet < 0 && (w.simNetWithFunding ?? w.simNet) >= 0).map(w => w.label.split(' ')[0]);

  if (totalFundingIn === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600" />Funding & Obligation Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <p className="text-[10px] text-muted-foreground">Total Funding Injected</p>
            <p className="text-sm font-bold text-purple-700">{INR(totalFundingIn)}</p>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <p className="text-[10px] text-muted-foreground">Total Repayment Obligations</p>
            <p className="text-sm font-bold text-red-700">{INR(totalRepayOut)}</p>
          </div>
          <div className={`text-center p-2 rounded-lg ${netCost > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className="text-[10px] text-muted-foreground">Net Cost of Funding</p>
            <p className={`text-sm font-bold ${netCost > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{INR(netCost)}</p>
          </div>
        </div>

        {rescuedWeeks.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] text-muted-foreground mb-1">Weeks rescued by funding:</p>
            <div className="flex flex-wrap gap-1">
              {rescuedWeeks.map(w => <span key={w} className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">{w}</span>)}
            </div>
          </div>
        )}

        {negativeWeeks.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Weeks still negative after all adjustments:</p>
            <div className="flex flex-wrap gap-1">
              {negativeWeeks.map(w => <span key={w} className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{w}</span>)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}