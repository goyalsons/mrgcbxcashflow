import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, CheckCircle, AlertCircle, Play, Download, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import { useNavigate } from 'react-router-dom';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseIndianDate(str) {
  if (!str) return null;
  // DD/MM/YYYY
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  // YYYY-MM-DD (with optional time)
  const isoMatch = str.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  // D-Mon-YY or D-Mon-YYYY (Tally format: 1-Apr-25)
  const tallyMatch = str.match(/(\d{1,2})[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]?(\d{2,4})/i);
  if (tallyMatch) {
    const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const year = tallyMatch[3].length === 2 ? '20' + tallyMatch[3] : tallyMatch[3];
    return `${year}-${months[tallyMatch[2].toLowerCase()]}-${tallyMatch[1].padStart(2,'0')}`;
  }
  return str;
}

function parseIndianAmount(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
}

function normKey(s) {
  return s.toLowerCase().replace(/["']/g, '').replace(/[\s\.]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function parseTallyCSV(text) {
  // Split into lines, handling both \r\n and \n
  const lines = text.trim().split(/\r?\n/);

  // Find the header line: must contain 'date' AND 'party' (case-insensitive)
  let headerIdx = lines.findIndex(l => /date/i.test(l) && /party/i.test(l));
  if (headerIdx < 0) headerIdx = 0;

  // Parse raw headers and sub-headers
  const splitLine = (l) => l.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
  const rawHeaders = splitLine(lines[headerIdx]);
  const nextLine = lines[headerIdx + 1] ? splitLine(lines[headerIdx + 1]) : [];

  // Build merged column names: if sub-header cell is non-empty and doesn't start a new column, append it
  const MAIN_HEADER_WORDS = /^(date|ref|party|due|overdue|pending)/i;
  const mergedHeaders = rawHeaders.map((h, i) => {
    const sub = nextLine[i] || '';
    // If sub cell has content and it's not a new main header, merge
    if (sub && !MAIN_HEADER_WORDS.test(sub) && !MAIN_HEADER_WORDS.test(h.trim())) {
      return normKey(`${h} ${sub}`);
    }
    if (sub && h.trim() && !MAIN_HEADER_WORDS.test(sub)) {
      return normKey(`${h} ${sub}`);
    }
    return normKey(h);
  });

  // Data starts after header + possible sub-header row
  const hasSubHeader = nextLine.some(s => s.trim() && !MAIN_HEADER_WORDS.test(s));
  const dataStart = hasSubHeader ? headerIdx + 2 : headerIdx + 1;

  const rows = lines.slice(dataStart).map(line => {
    const vals = splitLine(line);
    const row = {};
    mergedHeaders.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  }).filter(r => {
    // Must have a non-empty, non-numeric party name
    const name = r['partys_name'] || r['party_s_name'] || r['party_name'] || r['party'] || '';
    return name.trim().length > 0 && !/^[\d,\.]+$/.test(name.trim());
  });

  return { headers: mergedHeaders, rows };
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["\s]/g, '_').replace(/[^a-z_]/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

const ENTITY_CONFIGS = {
  payable: {
    label: 'Payables',
    entity: 'Payable',
    fields: ['vendor_name', 'bill_number', 'amount', 'due_date', 'category'],
    required: ['vendor_name', 'amount'],
    sampleData: [
      ['ABC Suppliers', 'BILL-001', '25000', '30/04/2025', 'raw_materials'],
      ['Cloud Services Inc', 'INV-2025', '8500', '15/04/2025', 'services'],
    ],
    transform: (row) => ({
      vendor_name: row.vendor_name || row.vendor || row.supplier,
      bill_number: row.bill_number || row.bill_no || row.invoice_number,
      amount: parseIndianAmount(row.amount || row.total),
      amount_paid: 0,
      due_date: parseIndianDate(row.due_date || row.payment_due),
      bill_date: parseIndianDate(row.bill_date || row.date),
      category: row.category || 'other',
      status: 'pending',
      notes: row.notes || row.remarks || '',
    }),
  },
  expense: {
    label: 'Expenses',
    entity: 'Expense',
    fields: ['description', 'amount', 'expense_date', 'category', 'payment_mode'],
    required: ['description', 'amount'],
    sampleData: [
      ['Office Stationery', '5000', '15/03/2025', 'office_supplies', 'cash'],
      ['Internet Bill', '2500', '01/03/2025', 'utilities', 'bank_transfer'],
      ['Client Meeting Travel', '8500', '20/03/2025', 'travel', 'upi'],
    ],
    transform: (row) => ({
      description: row.description || row.narration || row.particulars,
      amount: parseIndianAmount(row.amount || row.total),
      expense_date: parseIndianDate(row.expense_date || row.date),
      category: row.category || 'miscellaneous',
      payment_mode: row.payment_mode || row.mode || 'bank_transfer',
      notes: row.notes || row.remarks || '',
      approval_status: 'not_required',
    }),
  },
  bank_account: {
    label: 'Bank Accounts',
    entity: 'BankAccount',
    fields: ['name', 'type', 'account_number', 'balance', 'snapshot_date'],
    required: ['name', 'balance'],
    sampleData: [
      ['HDFC Current Account', 'bank', '001234567890', '500000', '01/04/2025'],
      ['Petty Cash', 'cash', '', '15000', '01/04/2025'],
    ],
    transform: (row) => ({
      name: row.name || row.account_name,
      type: row.type === 'cash' ? 'cash' : 'bank',
      account_number: row.account_number || row.acc_no || '',
      balance: parseIndianAmount(row.balance || row.amount),
      snapshot_date: parseIndianDate(row.snapshot_date || row.date),
      is_active: true,
    }),
  },
  customer: {
    label: 'Customers',
    entity: 'Customer',
    fields: ['name', 'email', 'phone', 'gstin', 'contact_person', 'address'],
    required: ['name'],
    sampleData: [
      ['Global Exports Inc', 'info@globalexports.com', '+91 98000 11111', '27CCCCC2222C3Z7', 'Amit Sharma', '789 Export Zone, Mumbai'],
      ['Digital Ventures Ltd', 'hello@digitalventures.com', '+91 77000 22222', '', 'Sneha Patel', '321 IT Park, Pune'],
    ],
    transform: (row) => ({
      name: row.name || row.customer_name || row.company,
      email: row.email,
      phone: row.phone || row.mobile,
      gstin: row.gstin || row.gst,
      contact_person: row.contact_person || row.contact,
      address: row.address,
    }),
    dupCheck: async (data) => {
      const existing = await base44.entities.Customer.filter({ name: data.name }).catch(() => []);
      return existing.length > 0;
    },
  },
  vendor: {
    label: 'Vendors',
    entity: 'Vendor',
    fields: ['name', 'email', 'phone', 'gstin', 'contact_person', 'address'],
    required: ['name'],
    sampleData: [
      ['ABC Suppliers Pvt Ltd', 'procurement@abc.com', '+91 96000 33333', '27DDDDD3333D4Z8', 'Ravi Kumar', '100 Industrial Area, Chennai'],
      ['Cloud Services Inc', 'billing@cloudservices.com', '+91 85000 44444', '', 'Meena Iyer', '200 Tech Hub, Hyderabad'],
    ],
    transform: (row) => ({
      name: row.name || row.vendor_name || row.supplier,
      email: row.email,
      phone: row.phone || row.mobile,
      gstin: row.gstin || row.gst,
      contact_person: row.contact_person || row.contact,
      address: row.address,
    }),
    dupCheck: async (data) => {
      const existing = await base44.entities.Vendor.filter({ name: data.name }).catch(() => []);
      return existing.length > 0;
    },
  },
  tally_receivable: {
    label: 'Tally Bills Receivable',
    entity: 'Invoice',
    fields: ['Date', 'Ref. No.', "Party's Name", 'Pending Amount', 'Due on', 'Overdue by days'],
    required: ['debtor_name', 'amount'],
    sampleData: [
      ['01/04/2025', 'CEODL/25-26/001', 'Acme Corporation', '25000', '30/04/2025', '0'],
      ['15/03/2025', 'CEODL/24-25/999', 'Tech Solutions Ltd', '78000', '15/04/2025', '19'],
    ],
    transform: (row) => {
      const debtorName = row['partys_name'] || row['party_s_name'] || row['party_name'] || row['party'] || '';
      const amount = parseIndianAmount(row['pending_amount'] || row['pending'] || row['amount'] || '0');
      const dueDate = parseIndianDate(row['due_on'] || row['due_date'] || '');
      const invoiceDate = parseIndianDate(row['date'] || '');
      const invoiceNumber = row['ref_no'] || row['refno'] || row['invoice_number'] || '';
      const overdueDays = row['overdue_by_days'] || row['overdueby_days'] || row['overdue'] || '';
      const overdueDaysNum = parseInt(overdueDays) || 0;
      return {
        debtor_name: debtorName,
        invoice_number: invoiceNumber,
        amount,
        amount_paid: 0,
        invoice_date: invoiceDate,
        due_date: dueDate || invoiceDate,
        status: overdueDaysNum > 0 ? 'overdue' : 'pending',
        notes: overdueDaysNum > 0 ? `Overdue by ${overdueDaysNum} days` : '',
      };
    },
  },
  tally_payable: {
    label: 'Tally Bills Payable',
    entity: 'Payable',
    fields: ['vendor_name', 'bill_number', 'amount', 'bill_date', 'due_date', 'status'],
    required: ['vendor_name', 'amount'],
    sampleData: [
      ['ABC Suppliers', 'TDS', '25000', '17-Apr-21', '17-Apr-21', 'overdue'],
      ['XYZ Vendors', 'INV-001', '8500', '1-Jun-21', '1-Jun-21', 'overdue'],
    ],
    transform: (row) => {
      const vendorName = row['partys_name'] || row['party_s_name'] || row['party_name'] || row['party'] || '';
      const amount = parseIndianAmount(row['pending_amount'] || row['pending'] || row['amount'] || '0');
      const billDate = parseIndianDate(row['date'] || '');
      const dueDate = parseIndianDate(row['due_on'] || row['due_date'] || row['date'] || '');
      const billNumber = row['ref_no'] || row['refno'] || row['bill_number'] || '';
      const overdueDays = parseInt(row['overdue_by_days'] || row['overdueby_days'] || row['overdue'] || '0');
      const status = overdueDays > 0 ? 'overdue' : 'pending';
      return {
        vendor_name: vendorName,
        bill_number: billNumber,
        amount,
        amount_paid: 0,
        bill_date: billDate,
        due_date: dueDate || billDate,
        category: 'other',
        status,
        notes: overdueDays > 0 ? `Overdue by ${overdueDays} days` : '',
      };
    },
  },
};

const PAGE_MAP = {
  payable: '/payables',
  expense: '/expenses',
  bank_account: '/bank-accounts',
  customer: '/customers',
  vendor: '/vendors',
  tally_receivable: '/receivables2',
  tally_payable: '/payables',
};

export default function CSVImport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef();

  const urlParams = new URLSearchParams(window.location.search);
  const defaultType = urlParams.get('type') || 'payable';

  const [entityType, setEntityType] = useState(ENTITY_CONFIGS[defaultType] ? defaultType : 'payable');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const config = ENTITY_CONFIGS[entityType];

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResults(null);

    const isXLSX = f.name.match(/\.xlsx?$/i);

    const processRows = (rows) => {
      const transformed = rows.map(row => {
        const data = config.transform(row);
        const missing = config.required.filter(k => !data[k]);
        return { raw: row, data, missing, valid: missing.length === 0 };
      });
      setPreview({ rows: transformed });
    };

    if (isXLSX) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const workbook = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        if (entityType === 'tally_receivable' || entityType === 'tally_payable') {
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          let headerIdx = rawRows.findIndex(r =>
            r.some(c => /date/i.test(String(c))) && r.some(c => /party/i.test(String(c)))
          );
          if (headerIdx < 0) headerIdx = 0;
          const headers = rawRows[headerIdx].map(h => normKey(String(h)));
          const rows = rawRows.slice(headerIdx + 1).map(r => {
            const row = {};
            headers.forEach((h, i) => {
              let val = r[i];
              if (val instanceof Date) val = val.toISOString().slice(0, 10);
              row[h] = String(val ?? '');
            });
            return row;
          }).filter(r => {
            const name = r['partys_name'] || r['party_s_name'] || r['party_name'] || r['party'] || '';
            return name.trim().length > 0 && !/^[\d,\.]+$/.test(name.trim());
          });
          processRows(rows);
        } else {
          const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          const rows = jsonRows.map(r => {
            const normalized = {};
            Object.entries(r).forEach(([k, v]) => {
              let val = v;
              if (val instanceof Date) val = val.toISOString().slice(0, 10);
              normalized[normKey(String(k))] = String(val);
            });
            return normalized;
          });
          processRows(rows);
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const parser = (entityType === 'tally_receivable' || entityType === 'tally_payable') ? parseTallyCSV : parseCSV;
        const { rows } = parser(ev.target.result);
        processRows(rows);
      };
      reader.readAsText(f);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    const validRows = preview.rows.filter(r => r.valid);
    let success = 0, updated = 0, duplicates = 0;
    const BATCH = 25;

    if (entityType === 'tally_payable') {
      // Upsert logic for Tally Payables: match on bill_number
      const existingPayables = await base44.entities.Payable.list().catch(() => []);
      const existingMap = {};
      existingPayables.forEach(p => {
        if (p.bill_number) existingMap[p.bill_number.trim().toLowerCase()] = p;
      });
      const toCreate = [];
      for (const row of validRows) {
        const billNum = (row.data.bill_number || '').trim().toLowerCase();
        if (billNum && existingMap[billNum]) {
          await base44.entities.Payable.update(existingMap[billNum].id, {
            amount: row.data.amount,
            due_date: row.data.due_date,
            status: row.data.status,
          });
          updated++;
          await sleep(150);
        } else {
          toCreate.push(row.data);
        }
      }
      for (let i = 0; i < toCreate.length; i += BATCH) {
        const batch = toCreate.slice(i, i + BATCH);
        await base44.entities.Payable.bulkCreate(batch);
        success += batch.length;
        await sleep(300);
      }
    } else if (entityType === 'tally_receivable') {
      // Step 1: Resolve / create Debtor records by company name
      const allDebtors = await base44.entities.Debtor.list().catch(() => []);
      const debtorByName = {};
      allDebtors.forEach(d => { if (d.name) debtorByName[d.name.toLowerCase()] = d; });

      // Find names that need new Debtor records
      const uniqueNames = [...new Set(validRows.map(r => r.data.debtor_name).filter(Boolean))];
      for (const name of uniqueNames) {
        if (!debtorByName[name.toLowerCase()]) {
          const created = await base44.entities.Debtor.create({ name, status: 'active' });
          debtorByName[name.toLowerCase()] = created;
          await sleep(100);
        }
      }

      // Step 2: Upsert Invoices — match by invoice_number (Ref. No), fallback match by debtor_name+amount
      const existingInvoices = await base44.entities.Invoice.list().catch(() => []);
      const invoiceByRefNo = {};
      existingInvoices.forEach(inv => {
        if (inv.invoice_number) invoiceByRefNo[inv.invoice_number.trim().toLowerCase()] = inv;
      });

      for (const row of validRows) {
        const debtor = debtorByName[(row.data.debtor_name || '').toLowerCase()];
        const invData = {
          ...row.data,
          debtor_id: debtor?.id || '',
          debtor_name: row.data.debtor_name,
        };

        const refKey = (row.data.invoice_number || '').trim().toLowerCase();
        const existing = refKey ? invoiceByRefNo[refKey] : null;

        if (existing) {
          await base44.entities.Invoice.update(existing.id, {
            amount: invData.amount,
            due_date: invData.due_date,
            invoice_date: invData.invoice_date,
            status: invData.status,
            notes: invData.notes,
            debtor_id: invData.debtor_id,
            debtor_name: invData.debtor_name,
          });
          updated++;
        } else {
          await base44.entities.Invoice.create(invData);
          success++;
        }
        await sleep(100);
      }

    } else {
      // Standard import with dupCheck
      const toCreate = [];
      for (const row of validRows) {
        if (config.dupCheck) {
          const isDup = await config.dupCheck(row.data);
          if (isDup) { duplicates++; continue; }
        }
        toCreate.push(row.data);
      }
      for (let i = 0; i < toCreate.length; i += BATCH) {
        const batch = toCreate.slice(i, i + BATCH);
        await base44.entities[config.entity].bulkCreate(batch);
        success += batch.length;
        await sleep(300);
      }
    }

    setResults({ success, updated, failed: preview.rows.filter(r => !r.valid).length, duplicates });
    queryClient.invalidateQueries();
    setImporting(false);
    toast({ title: `Import complete: ${success} created, ${updated} updated${duplicates ? `, ${duplicates} skipped` : ''}` });
  };

  const downloadSampleCSV = () => {
    const csv = [config.fields.join(','), ...config.sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-${entityType}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleTypeChange = (v) => {
    setEntityType(v);
    setFile(null);
    setPreview(null);
    setResults(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(PAGE_MAP[entityType] || -1)} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>
      <PageHeader title="Bulk CSV Import" subtitle="Import data from CSV files with Indian format support (DD/MM/YYYY, ₹ currency)" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Import Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Import As</Label>
                <Select value={entityType} onValueChange={handleTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENTITY_CONFIGS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">{file ? file.name : 'Click to upload CSV'}</p>
                <p className="text-xs text-muted-foreground mt-1">CSV format, max 5MB</p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>

              <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-2">
                <p className="font-medium">Expected columns for {config.label}:</p>
                <p className="text-muted-foreground">{config.fields.join(', ')}</p>
                <p className="text-muted-foreground">Required: <span className="text-red-600">{config.required.join(', ')}</span></p>
                <p className="text-muted-foreground">Dates: DD/MM/YYYY, YYYY-MM-DD, or Tally (1-Apr-25)</p>
                <p className="text-muted-foreground">Amounts: ₹1,23,456 or 123456</p>
                <Button onClick={downloadSampleCSV} variant="outline" size="sm" className="w-full gap-2 mt-2">
                  <Download className="w-3.5 h-3.5" /> Download Sample CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {results && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle className="w-5 h-5" /> Import Complete</div>
                <div className="text-sm space-y-1">
                  {results.success > 0 && <div className="text-emerald-700">✓ {results.success} new records created</div>}
                  {results.updated > 0 && <div className="text-blue-700">↻ {results.updated} records updated</div>}
                  {results.duplicates > 0 && <div className="text-amber-700">↪ {results.duplicates} duplicates skipped</div>}
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => navigate(PAGE_MAP[entityType])}>
                  View {config.label}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-2">
          {!preview ? (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center py-16">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Upload a CSV file to preview data</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Preview — {preview.rows.filter(r => r.valid).length}/{preview.rows.length} valid rows
                  </CardTitle>
                  <Button onClick={handleImport} disabled={importing || !preview.rows.some(r => r.valid)} className="gap-2">
                    <Play className="w-4 h-4" />{importing ? 'Importing...' : 'Import Valid Rows'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      {config.fields.map(f => <TableHead key={f}>{f}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 50).map((row, i) => (
                      <TableRow key={i} className={row.valid ? '' : 'bg-red-50'}>
                        <TableCell className="min-w-[140px]">
                          {row.valid
                            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                            : <div className="flex items-start gap-1">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <span className="text-xs text-red-600">Missing: {row.missing.join(', ')}</span>
                              </div>
                          }
                        </TableCell>
                        {config.fields.map(f => (
                          <TableCell key={f} className="text-xs max-w-[120px] truncate">
                            {String(row.data[f] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.rows.length > 50 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 50 of {preview.rows.length} rows</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}