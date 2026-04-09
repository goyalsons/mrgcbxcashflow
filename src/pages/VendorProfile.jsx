import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, Mail, Phone, CreditCard, CheckCircle2, AlertTriangle, Clock, Receipt } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VendorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: vendor, isLoading: loadingVendor } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      const list = await base44.entities.Vendor.list();
      return list.find(v => v.id === id) || null;
    },
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.Payable.list('-due_date'),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['supplierPayments'],
    queryFn: () => base44.entities.SupplierPayment.list('-payment_date'),
  });

  const vendorPayables = useMemo(() =>
    payables.filter(p => p.vendor_id === id || p.vendor_name === vendor?.name),
    [payables, id, vendor]
  );

  const vendorPayments = useMemo(() =>
    payments.filter(p => p.vendor_id === id || p.vendor_name === vendor?.name),
    [payments, id, vendor]
  );

  const stats = useMemo(() => {
    const totalBilled = vendorPayables.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPaid = vendorPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const outstanding = vendorPayables
      .filter(p => p.status !== 'paid')
      .reduce((s, p) => s + ((p.amount || 0) - (p.amount_paid || 0)), 0);
    const overdue = vendorPayables.filter(p => {
      if (p.status === 'paid') return false;
      return p.due_date && new Date(p.due_date) < new Date();
    }).length;
    return { totalBilled, totalPaid, outstanding, overdue, billCount: vendorPayables.length };
  }, [vendorPayables, vendorPayments]);

  // Build unified timeline
  const timeline = useMemo(() => {
    const items = [
      ...vendorPayables.map(p => ({
        type: 'bill',
        date: p.bill_date || p.created_date,
        label: `Bill ${p.bill_number || ''}`,
        amount: p.amount,
        status: p.status,
        id: p.id,
        due_date: p.due_date,
      })),
      ...vendorPayments.map(p => ({
        type: 'payment',
        date: p.payment_date,
        label: `Payment${p.bill_number ? ` for ${p.bill_number}` : ''}`,
        amount: p.amount,
        mode: p.payment_mode,
        reference: p.reference_number,
        id: p.id,
      })),
    ];
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [vendorPayables, vendorPayments]);

  if (loadingVendor) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!vendor) return <div className="p-8 text-muted-foreground">Vendor not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vendors')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{vendor.name}</h1>
              <p className="text-sm text-muted-foreground">{vendor.contact_person || 'Supplier'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-6">
          {vendor.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{vendor.email}</span>
            </div>
          )}
          {vendor.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{vendor.phone}</span>
            </div>
          )}
          {vendor.gstin && (
            <div className="flex items-center gap-2 text-sm">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono">{vendor.gstin}</span>
            </div>
          )}
          {vendor.address && (
            <div className="text-sm text-muted-foreground">{vendor.address}</div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CreditCard} label="Total Billed" value={formatINR(stats.totalBilled)} color="blue" />
        <StatCard icon={CheckCircle2} label="Total Paid" value={formatINR(stats.totalPaid)} color="green" />
        <StatCard icon={Clock} label="Outstanding" value={formatINR(stats.outstanding)} color="amber" />
        <StatCard icon={AlertTriangle} label="Overdue Bills" value={stats.overdue} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bills List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Bills ({stats.billCount})</h2>
          {vendorPayables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills yet.</p>
          ) : (
            <div className="space-y-2">
              {vendorPayables.map(p => (
                <Card key={p.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{p.bill_number || 'No bill #'}</p>
                      <p className="text-xs text-muted-foreground">Due: {p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN') : '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatINR(p.amount)}</p>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  {p.status !== 'paid' && p.amount_paid > 0 && (
                    <div className="mt-1.5">
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((p.amount_paid / p.amount) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatINR(p.amount_paid)} paid of {formatINR(p.amount)}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Activity Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="relative space-y-0">
              {timeline.map((item, i) => (
                <div key={item.id + item.type} className="flex gap-3 pb-4 relative">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${item.type === 'payment' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                      {item.type === 'payment'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        : <Receipt className="w-4 h-4 text-blue-600" />
                      }
                    </div>
                    {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <Card className="flex-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                        {item.type === 'bill' && item.due_date && (
                          <p className="text-xs text-muted-foreground">Due: {new Date(item.due_date).toLocaleDateString('en-IN')}</p>
                        )}
                        {item.type === 'payment' && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.mode && <Badge variant="outline" className="text-[10px] py-0 h-4">{item.mode.replace(/_/g, ' ').toUpperCase()}</Badge>}
                            {item.reference && <span className="text-[10px] text-muted-foreground">Ref: {item.reference}</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${item.type === 'payment' ? 'text-emerald-600' : 'text-foreground'}`}>
                          {item.type === 'payment' ? '-' : ''}{formatINR(item.amount)}
                        </p>
                        {item.type === 'bill' && <StatusBadge status={item.status} />}
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}