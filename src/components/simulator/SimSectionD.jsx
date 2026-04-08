import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, ChevronDown, Landmark, AlertTriangle } from 'lucide-react';

const INR = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
};
const toDateStr = d => d ? new Date(d).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));

const FUNDING_TYPES = [
  { key: 'informal',      label: 'Informal Borrowing' },
  { key: 'od',            label: 'Bank Overdraft (OD)' },
  { key: 'wcl',           label: 'Working Capital Loan / CC' },
  { key: 'invoice_disc',  label: 'Bill Discounting / Factoring' },
  { key: 'govt_loan',     label: 'MSME / Govt Scheme Loan' },
  { key: 'cust_advance',  label: 'Advance from Customer' },
  { key: 'asset_sale',    label: 'Sale of Asset / Investment' },
  { key: 'chit',          label: 'Chit Fund / ROSCA Payout' },
  { key: 'dealer_adv',    label: 'Dealer / Distributor Advance' },
  { key: 'nbfc_loan',     label: 'Unsecured Loan (NBFC / Fintech)' },
  { key: 'po_finance',    label: 'PO Financing / Advance Against PO' },
];

const BADGE_COLORS = {
  informal: 'bg-purple-100 text-purple-700',
  od: 'bg-blue-100 text-blue-700',
  wcl: 'bg-indigo-100 text-indigo-700',
  invoice_disc: 'bg-teal-100 text-teal-700',
  govt_loan: 'bg-green-100 text-green-700',
  cust_advance: 'bg-emerald-100 text-emerald-700',
  asset_sale: 'bg-yellow-100 text-yellow-700',
  chit: 'bg-pink-100 text-pink-700',
  dealer_adv: 'bg-orange-100 text-orange-700',
  nbfc_loan: 'bg-red-100 text-red-700',
  po_finance: 'bg-cyan-100 text-cyan-700',
};

const todayStr = toDateStr(new Date());

function calcEMIs(principal, rateAnnual, tenureMonths, startDate) {
  const r = rateAnnual / 12 / 100;
  const n = tenureMonths;
  if (r === 0) {
    const emi = principal / n;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(startDate); d.setMonth(d.getMonth() + i + 1);
      return { date: toDateStr(d), amount: Math.round(emi) };
    });
  }
  const emi = Math.round(principal * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(startDate); d.setMonth(d.getMonth() + i + 1);
    return { date: toDateStr(d), amount: emi };
  });
}

function buildSourceFlows(f) {
  const inflows = [], outflows = [];
  const amt = Number(f.amount) || 0;
  const rate = Number(f.rate) || 0;

  if (f.type === 'informal') {
    inflows.push({ date: f.date || todayStr, amount: amt, label: `Informal: ${f.lender || 'Borrowing'}` });
    if (f.repayDate && amt > 0) {
      const days = daysBetween(f.date || todayStr, f.repayDate);
      const interest = Math.round(amt * rate / 100 * days / 365);
      outflows.push({ date: f.repayDate, amount: amt + interest, label: `Repay: ${f.lender || 'Borrowing'}` });
    }
  } else if (f.type === 'od') {
    const draw = Number(f.drawAmt) || 0;
    inflows.push({ date: f.drawDate || todayStr, amount: draw, label: `OD: ${f.bank || 'Bank'}` });
    if (f.repayDate) {
      const days = daysBetween(f.drawDate || todayStr, f.repayDate);
      const interest = Math.round(draw * rate / 100 * days / 365);
      outflows.push({ date: f.repayDate, amount: draw + interest, label: `OD Repay: ${f.bank}` });
    }
  } else if (f.type === 'wcl') {
    const disburse = f.disburseDate || todayStr;
    inflows.push({ date: disburse, amount: amt, label: `WCL: ${f.lender || 'Lender'}` });
    const tenure = Number(f.tenure) || 12;
    if (f.repayType === 'bullet') {
      const interest = Math.round(amt * rate / 100 * tenure / 12);
      const endDate = new Date(disburse); endDate.setMonth(endDate.getMonth() + tenure);
      outflows.push({ date: toDateStr(endDate), amount: amt + interest, label: `WCL Bullet Repay` });
    } else {
      calcEMIs(amt, rate, tenure, disburse).forEach(e => outflows.push({ ...e, label: `WCL EMI` }));
    }
  } else if (f.type === 'invoice_disc') {
    const advance = Math.round(amt * (Number(f.advancePct) || 80) / 100);
    const fee = Math.round(amt * (Number(f.discRate) || 0) / 100);
    const net = advance - fee;
    inflows.push({ date: f.disburseDate || todayStr, amount: net, label: `Invoice Disc: ${INR(net)} net` });
    const remaining = amt - advance;
    if (remaining > 0 && f.collectionDate)
      inflows.push({ date: f.collectionDate, amount: remaining, label: `Disc Remainder` });
  } else if (f.type === 'govt_loan') {
    const disburse = f.disburseDate || todayStr;
    inflows.push({ date: disburse, amount: amt, label: `${f.scheme || 'Govt Scheme'}` });
    const moratorium = Number(f.moratorium) || 0;
    const tenure = Number(f.tenure) || 36;
    const repayTenure = tenure - moratorium;
    if (repayTenure > 0)
      calcEMIs(amt, rate, repayTenure, new Date(disburse).setMonth(new Date(disburse).getMonth() + moratorium)).forEach(e => outflows.push({ ...e, label: `${f.scheme || 'Govt'} EMI` }));
  } else if (f.type === 'cust_advance') {
    inflows.push({ date: f.date || todayStr, amount: amt, label: `Cust Advance: ${f.customer || ''}` });
  } else if (f.type === 'asset_sale') {
    inflows.push({ date: f.date || todayStr, amount: amt, label: `Asset Sale: ${f.asset || ''}` });
  } else if (f.type === 'chit') {
    inflows.push({ date: f.date || todayStr, amount: amt, label: `Chit: ${f.chitName || ''}` });
  } else if (f.type === 'dealer_adv') {
    inflows.push({ date: f.date || todayStr, amount: amt, label: `Dealer Adv: ${f.party || ''}` });
  } else if (f.type === 'nbfc_loan') {
    const fee = Math.round(amt * (Number(f.procFee) || 0) / 100);
    const net = amt - fee;
    const tenure = Number(f.tenure) || 12;
    const disburse = f.disburseDate || todayStr;
    inflows.push({ date: disburse, amount: net, label: `NBFC: ${f.lender || ''}` });
    calcEMIs(amt, rate, tenure, disburse).forEach(e => outflows.push({ ...e, label: `NBFC EMI` }));
  } else if (f.type === 'po_finance') {
    const advance = Math.round(amt * (Number(f.advancePct) || 70) / 100);
    const disburse = todayStr;
    inflows.push({ date: disburse, amount: advance, label: `PO Finance` });
    const days = daysBetween(disburse, f.fulfillDate || todayStr);
    const interest = Math.round(advance * rate / 100 * days / 365);
    if (f.fulfillDate)
      outflows.push({ date: f.fulfillDate, amount: advance + interest, label: `PO Repay` });
  }
  return { inflows, outflows };
}

function getSummary(f) {
  const { inflows, outflows } = buildSourceFlows(f);
  const totalIn = inflows.reduce((s, i) => s + i.amount, 0);
  const totalOut = outflows.reduce((s, o) => s + o.amount, 0);
  return { totalIn, totalOut, netBenefit: totalIn - totalOut };
}

function FundingForm({ onSave, onCancel, initial, receivables = [] }) {
  const [f, setF] = useState(initial || { type: 'informal', amount: '', rate: '0', date: todayStr });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const { inflows, outflows } = buildSourceFlows(f);
  const totalRepay = outflows.reduce((s, o) => s + o.amount, 0);
  const totalReceive = inflows.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="border rounded-lg p-3 space-y-2.5 bg-muted/20">
      <div>
        <label className="text-[11px] text-muted-foreground">Funding Type</label>
        <select className="w-full h-7 text-xs border rounded px-2 mt-0.5 bg-background"
          value={f.type} onChange={e => setF({ type: e.target.value, amount: '', rate: '0', date: todayStr })}>
          {FUNDING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {/* Common amount + date */}
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[11px] text-muted-foreground">Amount (₹)</label>
          <Input type="number" className="h-7 text-xs" value={f.amount} onChange={e => set('amount', e.target.value)} /></div>
        <div><label className="text-[11px] text-muted-foreground">Receipt / Draw Date</label>
          <Input type="date" className="h-7 text-xs" value={f.date || f.drawDate || f.disburseDate || todayStr} onChange={e => { set('date', e.target.value); set('drawDate', e.target.value); set('disburseDate', e.target.value); }} /></div>
      </div>

      {/* Type-specific fields */}
      {(f.type === 'informal') && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Lender Name</label><Input className="h-7 text-xs" value={f.lender||''} onChange={e => set('lender', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Interest Rate % p.a.</label><Input type="number" className="h-7 text-xs" value={f.rate||'0'} onChange={e => set('rate', e.target.value)} /></div>
        </div>
        <div><label className="text-[11px] text-muted-foreground">Repayment Date (optional)</label><Input type="date" className="h-7 text-xs" value={f.repayDate||''} onChange={e => set('repayDate', e.target.value)} /></div>
      </>}

      {(f.type === 'od') && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Bank Name</label><Input className="h-7 text-xs" value={f.bank||''} onChange={e => set('bank', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Amount to Draw (₹)</label><Input type="number" className="h-7 text-xs" value={f.drawAmt||''} onChange={e => set('drawAmt', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Interest Rate % p.a.</label><Input type="number" className="h-7 text-xs" value={f.rate||'0'} onChange={e => set('rate', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Repayment Date</label><Input type="date" className="h-7 text-xs" value={f.repayDate||''} onChange={e => set('repayDate', e.target.value)} /></div>
        </div>
      </>}

      {(f.type === 'wcl') && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Lender</label><Input className="h-7 text-xs" value={f.lender||''} onChange={e => set('lender', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Interest Rate % p.a.</label><Input type="number" className="h-7 text-xs" value={f.rate||'0'} onChange={e => set('rate', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Tenure (months)</label><Input type="number" className="h-7 text-xs" value={f.tenure||'12'} onChange={e => set('tenure', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Repayment Type</label>
            <select className="w-full h-7 text-xs border rounded px-2 bg-background" value={f.repayType||'emi'} onChange={e => set('repayType', e.target.value)}>
              <option value="emi">EMI</option><option value="bullet">Bullet</option>
            </select>
          </div>
        </div>
      </>}

      {(f.type === 'invoice_disc') && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Discount Rate %</label><Input type="number" className="h-7 text-xs" value={f.discRate||''} onChange={e => set('discRate', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Advance % (default 80)</label><Input type="number" className="h-7 text-xs" value={f.advancePct||'80'} onChange={e => set('advancePct', e.target.value)} /></div>
        </div>
        <div><label className="text-[11px] text-muted-foreground">Expected Collection Date</label><Input type="date" className="h-7 text-xs" value={f.collectionDate||''} onChange={e => set('collectionDate', e.target.value)} /></div>
      </>}

      {(f.type === 'govt_loan') && <>
        <div><label className="text-[11px] text-muted-foreground">Scheme Name</label><Input className="h-7 text-xs" placeholder="MUDRA / ECLGS / CGTMSE…" value={f.scheme||''} onChange={e => set('scheme', e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Moratorium (mo)</label><Input type="number" className="h-7 text-xs" value={f.moratorium||'0'} onChange={e => set('moratorium', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Tenure (mo)</label><Input type="number" className="h-7 text-xs" value={f.tenure||'36'} onChange={e => set('tenure', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Rate % p.a.</label><Input type="number" className="h-7 text-xs" value={f.rate||'0'} onChange={e => set('rate', e.target.value)} /></div>
        </div>
      </>}

      {(f.type === 'cust_advance') && <>
        <div><label className="text-[11px] text-muted-foreground">Customer Name</label><Input className="h-7 text-xs" value={f.customer||''} onChange={e => set('customer', e.target.value)} /></div>
      </>}

      {(f.type === 'asset_sale') && <>
        <div><label className="text-[11px] text-muted-foreground">Asset Description</label><Input className="h-7 text-xs" value={f.asset||''} onChange={e => set('asset', e.target.value)} /></div>
      </>}

      {(f.type === 'chit') && <>
        <div><label className="text-[11px] text-muted-foreground">Chit Fund Name</label><Input className="h-7 text-xs" value={f.chitName||''} onChange={e => set('chitName', e.target.value)} /></div>
      </>}

      {(f.type === 'dealer_adv') && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Party Name</label><Input className="h-7 text-xs" value={f.party||''} onChange={e => set('party', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Conditions (optional)</label><Input className="h-7 text-xs" value={f.conditions||''} onChange={e => set('conditions', e.target.value)} /></div>
        </div>
      </>}

      {(f.type === 'nbfc_loan') && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Lender Name</label><Input className="h-7 text-xs" value={f.lender||''} onChange={e => set('lender', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Processing Fee %</label><Input type="number" className="h-7 text-xs" value={f.procFee||'0'} onChange={e => set('procFee', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Tenure (months)</label><Input type="number" className="h-7 text-xs" value={f.tenure||'12'} onChange={e => set('tenure', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Interest Rate % p.a.</label><Input type="number" className="h-7 text-xs" value={f.rate||'0'} onChange={e => set('rate', e.target.value)} /></div>
        </div>
      </>}

      {(f.type === 'po_finance') && <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-muted-foreground">Advance % of PO</label><Input type="number" className="h-7 text-xs" value={f.advancePct||'70'} onChange={e => set('advancePct', e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Interest Rate % p.a.</label><Input type="number" className="h-7 text-xs" value={f.rate||'0'} onChange={e => set('rate', e.target.value)} /></div>
        </div>
        <div><label className="text-[11px] text-muted-foreground">Expected Fulfilment Date</label><Input type="date" className="h-7 text-xs" value={f.fulfillDate||''} onChange={e => set('fulfillDate', e.target.value)} /></div>
      </>}

      {/* Preview */}
      {Number(f.amount) > 0 && (
        <div className="text-[11px] text-emerald-700 bg-emerald-50 rounded px-2 py-1.5 space-y-0.5">
          <p>Receive: <strong>{INR(totalReceive)}</strong></p>
          {totalRepay > 0 && <p>Total repayment: <strong>{INR(totalRepay)}</strong> (cost: {INR(totalRepay - totalReceive)})</p>}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs" onClick={() => onSave({ ...f, id: f.id || Date.now().toString() })}>Save</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function SimSectionD({ sources, setSources, receivables = [] }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const handleSave = (f) => {
    setSources(prev => editItem ? prev.map(s => s.id === f.id ? f : s) : [...prev, f]);
    setShowForm(false); setEditItem(null);
  };

  const remove = (id) => setSources(prev => prev.filter(s => s.id !== id));
  const edit = (item) => { setEditItem(item); setShowForm(true); };

  const totalFunding = sources.reduce((s, f) => { const { inflows } = buildSourceFlows(f); return s + inflows.reduce((a, i) => a + i.amount, 0); }, 0);
  const totalRepay = sources.reduce((s, f) => { const { outflows } = buildSourceFlows(f); return s + outflows.reduce((a, o) => a + o.amount, 0); }, 0);
  const netBenefit = totalFunding - totalRepay;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 justify-between">
          <span className="flex items-center gap-2"><Landmark className="w-4 h-4 text-purple-600" />Section D — External Funding</span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditItem(null); setShowForm(v => !v); }}>
            <Plus className="w-3 h-3" />Add Source
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs p-2 bg-muted/30 rounded-lg">
            <span>Total funding: <strong className="text-purple-700">{INR(totalFunding)}</strong></span>
            <span>Total repayment: <strong className="text-red-700">{INR(totalRepay)}</strong></span>
            <span>Net benefit: <strong className={netBenefit >= 0 ? 'text-emerald-700' : 'text-red-700'}>{INR(netBenefit)}</strong></span>
          </div>
        )}

        {showForm && (
          <FundingForm
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditItem(null); }}
            initial={editItem}
            receivables={receivables}
          />
        )}

        {sources.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground py-2 text-center">No funding sources added yet.</p>
        )}

        <div className="space-y-2">
          {sources.map(f => {
            const typeLabel = FUNDING_TYPES.find(t => t.key === f.type)?.label || f.type;
            const { inflows, outflows } = buildSourceFlows(f);
            const totalIn = inflows.reduce((s, i) => s + i.amount, 0);
            const totalOut = outflows.reduce((s, o) => s + o.amount, 0);
            return (
              <div key={f.id} className="border rounded-lg p-2.5 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[f.type] || 'bg-gray-100 text-gray-700'}`}>{typeLabel}</span>
                      <span className="text-xs font-bold text-purple-700">{INR(totalIn)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {inflows[0]?.date && `Receive on ${inflows[0].date}`}
                      {totalOut > 0 && ` · Repay ${INR(totalOut)}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => edit(f)}><Edit2 className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(f.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export { buildSourceFlows };