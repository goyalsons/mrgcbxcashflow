import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function ApprovalActionDialog({ expense, open, onClose, onApprove, onReject, processing }) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [mode, setMode] = useState(null); // 'approve' | 'reject'

  if (!expense) return null;

  const handleApprove = () => onApprove(expense);
  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(expense, rejectionReason.trim());
  };

  const CATEGORY_LABELS = {
    travel: 'Travel', office_supplies: 'Office Supplies', meals: 'Meals',
    utilities: 'Utilities', rent: 'Rent', salary: 'Salary',
    marketing: 'Marketing', software: 'Software', maintenance: 'Maintenance',
    miscellaneous: 'Miscellaneous',
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setMode(null); setRejectionReason(''); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Expense Approval Required
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Submitted by</span>
            <span className="font-medium">{expense.submitted_by_name || expense.submitted_by || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span className="font-medium text-right max-w-[60%]">{expense.description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Category</span>
            <Badge variant="outline" className="capitalize text-xs">{CATEGORY_LABELS[expense.category] || expense.category}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span>{formatDateIN(expense.expense_date)}</span>
          </div>
          <div className="flex justify-between items-center border-t pt-2 mt-2">
            <span className="text-muted-foreground font-medium">Amount</span>
            <span className="text-xl font-bold text-foreground">{formatINR(expense.amount)}</span>
          </div>
          {expense.notes && (
            <div className="border-t pt-2">
              <span className="text-muted-foreground">Notes: </span>
              <span className="text-foreground">{expense.notes}</span>
            </div>
          )}
        </div>

        {mode === 'reject' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setMode(null)}>Back</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!rejectionReason.trim() || processing}
                onClick={handleReject}
              >
                {processing ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
              onClick={() => setMode('reject')}
              disabled={processing}
            >
              <XCircle className="w-4 h-4" /> Reject
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={handleApprove}
              disabled={processing}
            >
              <CheckCircle className="w-4 h-4" /> Approve
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}