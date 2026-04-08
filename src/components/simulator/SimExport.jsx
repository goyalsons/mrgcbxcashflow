import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const INR = v => { const a=Math.abs(v||0); if(a>=10000000) return `Rs${(a/10000000).toFixed(2)}Cr`; if(a>=100000) return `Rs${(a/100000).toFixed(1)}L`; return `Rs${Math.round(a).toLocaleString('en-IN')}`; };
const today = () => new Date().toLocaleDateString('en-IN');

export default function SimExport({ weeklyData, bankAccounts, scenarioName, fundingSources = [], levers = [], taxItems = [], recAdj, payAdj, hypotheticals }) {
  const [open, setOpen] = useState(false);

  const exportPDF = () => {
    setOpen(false);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const name = scenarioName || 'Unsaved';
    const pageW = doc.internal.pageSize.getWidth();
    let y = 40;

    // Header
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`Cash Flow Simulation — ${name} — Generated on ${today()} — CashFlow Pro`, 40, y);
    y += 20;

    // Summary
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const baseNet = weeklyData.reduce((s,w) => s+w.baseNet, 0);
    const simNet  = weeklyData.reduce((s,w) => s+w.simNet, 0);
    const opening = bankAccounts.reduce((s,a) => s+(a.balance||0), 0);
    doc.text(`Opening Balance: ${INR(opening)}  |  Baseline Net 12W: ${INR(baseNet)}  |  Simulated Net 12W: ${INR(simNet)}  |  Improvement: ${INR(simNet-baseNet)}`, 40, y+16);
    y += 40;

    // Weekly table header
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const cols = ['Week','Base In','Sim In','Base Out','Sim Out','Base Net','Sim Net','Δ','Sim Closing'];
    const colW = [70,60,60,60,60,65,65,65,70];
    let x = 40;
    cols.forEach((c,i) => { doc.text(c, x, y); x += colW[i]; }); y += 14;
    doc.setFont('helvetica', 'normal');
    weeklyData.forEach(w => {
      x = 40;
      const delta = w.simNet - w.baseNet;
      const row = [w.label, INR(w.baseInflow), INR(w.simInflow), INR(w.baseOutflow), INR(w.simOutflow), INR(w.baseNet), INR(w.simNet), `${delta>=0?'+':''}${INR(delta)}`, INR(w.simClosing)];
      row.forEach((c,i) => { doc.text(c, x, y); x += colW[i]; });
      y += 13;
      if (y > 530) { doc.addPage(); y = 40; }
    });

    // Funding summary
    if (fundingSources.length > 0) {
      y += 10; doc.setFont('helvetica','bold'); doc.text('External Funding Sources', 40, y); y += 14;
      doc.setFont('helvetica','normal');
      fundingSources.forEach(f => { doc.text(`${f.type} — ${INR(f.amount||f.drawAmt||0)}`, 40, y); y += 13; });
    }

    // Disclaimer
    y += 15;
    doc.setFontSize(7); doc.setFont('helvetica','italic');
    const disc = 'All simulations are for planning purposes only. Consult your CA or legal advisor before acting on any simulation result.';
    doc.text(disc, 40, y);

    doc.save(`CashFlowSim_${name.replace(/\s+/g,'_')}_${today().replace(/\//g,'-')}.pdf`);
  };

  const exportExcel = () => {
    setOpen(false);
    const wb = XLSX.utils.book_new();
    const name = scenarioName || 'Unsaved';
    const header = `Cash Flow Simulation — ${name} — Generated on ${today()} — CashFlow Pro`;

    // Sheet 1: Weekly Comparison
    const weekRows = weeklyData.map(w => ({
      Week: w.label,
      'Base Inflow': w.baseInflow,
      'Sim Inflow': w.simInflow,
      'Base Outflow': w.baseOutflow,
      'Sim Outflow': w.simOutflow,
      'Base Net': w.baseNet,
      'Sim Net': w.simNet,
      'Δ Change': w.simNet - w.baseNet,
      'Funding Inflow': w.fundingInflow || 0,
      'Repayment Outflow': w.repaymentOutflow || 0,
      'Sim Closing Balance': w.simClosing,
    }));
    const ws1 = XLSX.utils.json_to_sheet(weekRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Weekly Comparison');

    // Sheet 2: Scheduling Changes (receivables)
    const schedRows = [];
    recAdj.forEach((adj, id) => { adj.tranches.forEach(t => schedRows.push({ Type: 'Receivable', ID: id, Amount: t.amount, Date: t.date, Splits: adj.tranches.length })); });
    payAdj.forEach((adj, id) => { adj.tranches.forEach(t => schedRows.push({ Type: 'Payable', ID: id, Amount: t.amount, Date: t.date, Splits: adj.tranches.length })); });
    hypotheticals.forEach(h => schedRows.push({ Type: `Hypo-${h.type}`, ID: h.id, Amount: h.amount, Date: h.tranches[0]?.date || '', Splits: h.tranches.length }));
    if (schedRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schedRows), 'Scheduling Changes');

    // Sheet 3: Funding Sources
    if (fundingSources.length) {
      const fRows = fundingSources.map(f => ({ Type: f.type, Amount: f.amount||f.drawAmt||0, 'Receipt Date': f.date||f.drawDate||f.disburseDate||'', 'Repay Date': f.repayDate||'', Rate: f.rate||0 }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fRows), 'Funding Sources');
    }

    // Sheet 4: Cost Reductions
    const costRows = [...levers.map(l => ({ Section: 'E', Type: l.type, Detail: JSON.stringify(l) })), ...taxItems.map(t => ({ Section: 'F', Type: t.type, Detail: JSON.stringify(t) }))];
    if (costRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costRows), 'Cost Reductions');

    XLSX.writeFile(wb, `CashFlowSim_${name.replace(/\s+/g,'_')}_${today().replace(/\//g,'-')}.xlsx`);
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setOpen(v => !v)}>
        <Download className="w-3 h-3" />Export<ChevronDown className="w-3 h-3" />
      </Button>
      {open && (
        <>
          <div className="absolute right-0 top-8 z-50 bg-card border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
            <button className="w-full text-left text-xs px-3 py-2 hover:bg-muted/50" onClick={exportPDF}>Export as PDF</button>
            <button className="w-full text-left text-xs px-3 py-2 hover:bg-muted/50" onClick={exportExcel}>Export as Excel</button>
          </div>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}