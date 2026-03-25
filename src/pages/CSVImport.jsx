import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, CheckCircle, AlertCircle, X, Play } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

function parseIndianDate(str) {
  if (!str) return null;
  // DD/MM/YYYY
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  // already ISO
  if (str.match(/\d{4}-\d{2}-\d{2}/)) return str;
  return str;
}

function parseIndianAmount(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
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
  debtor: {
    label: 'Debtors',
    fields: ['name', 'email', 'phone', 'gstin', 'contact_person', 'address'],
    required: ['name'],
    transform: (row) => ({
      name: row.name || row.company || row.debtor_name,
      email: row.email,
      phone: row.phone || row.mobile,
      gstin: row.gstin || row.gst,
      contact_person: row.contact_person || row.contact,
      address: row.address,
      status: 'active',
    }),
  },
  invoice: {
    label: 'Invoices',
    fields: ['invoice_number', 'debtor_name', 'amount', 'invoice_date', 'due_date'],
    required: ['debtor_name', 'amount'],
    transform: (row) => ({
      invoice_number: row.invoice_number || row.invoice_no || row.inv_no,
      debtor_name: row.debtor_name || row.customer || row.client,
      amount: parseIndianAmount(row.amount || row.total || row.invoice_amount),
      invoice_date: parseIndianDate(row.invoice_date || row.date),
      due_date: parseIndianDate(row.due_date || row.payment_due),
      description: row.description || row.narration || '',
      status: 'pending',
    }),
  },
  receivable: {
    label: 'Receivables',
    fields: ['invoice_number', 'customer_name', 'amount', 'due_date'],
    required: ['customer_name', 'amount'],
    transform: (row) => ({
      invoice_number: row.invoice_number || row.invoice_no,
      customer_name: row.customer_name || row.customer || row.client,
      amount: parseIndianAmount(row.amount || row.total),
      due_date: parseIndianDate(row.due_date || row.payment_due),
      invoice_date: parseIndianDate(row.invoice_date || row.date),
      status: 'pending',
      amount_received: 0,
    }),
  },
  expense: {
    label: 'Expenses',
    fields: ['description', 'amount', 'expense_date', 'category'],
    required: ['description', 'amount'],
    transform: (row) => ({
      description: row.description || row.narration || row.particulars,
      amount: parseIndianAmount(row.amount || row.total),
      expense_date: parseIndianDate(row.expense_date || row.date),
      category: row.category || 'miscellaneous',
      payment_mode: row.payment_mode || row.mode || 'bank_transfer',
      notes: row.notes || row.remarks || '',
    }),
  },
};

const ENTITY_MAP = {
  debtor: 'Debtor',
  invoice: 'Invoice',
  receivable: 'Receivable',
  expense: 'Expense',
};

export default function CSVImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef();
  const [entityType, setEntityType] = useState('debtor');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      const config = ENTITY_CONFIGS[entityType];
      const transformed = rows.map(row => {
        const data = config.transform(row);
        const missing = config.required.filter(k => !data[k]);
        return { raw: row, data, missing, valid: missing.length === 0 };
      });
      setPreview({ headers, rows: transformed });
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    const validRows = preview.rows.filter(r => r.valid);
    let success = 0, failed = 0, duplicates = 0;

    const entityName = ENTITY_MAP[entityType];
    for (const row of validRows) {
      // Duplicate check for debtors by name
      if (entityType === 'debtor') {
        const existing = await base44.entities.Debtor.filter({ name: row.data.name }).catch(() => []);
        if (existing.length > 0) { duplicates++; continue; }
      }
      // For invoices, link to debtor
      if (entityType === 'invoice' && row.data.debtor_name) {
        const debtors = await base44.entities.Debtor.filter({ name: row.data.debtor_name }).catch(() => []);
        if (debtors[0]) row.data.debtor_id = debtors[0].id;
      }
      await base44.entities[entityName].create(row.data);
      success++;
    }

    setResults({ success, failed: preview.rows.filter(r => !r.valid).length, duplicates });
    queryClient.invalidateQueries({ queryKey: [entityType + 's'] });
    queryClient.invalidateQueries({ queryKey: ['debtors'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    setImporting(false);
    toast({ title: `Import complete: ${success} imported, ${duplicates} duplicates skipped` });
  };

  const config = ENTITY_CONFIGS[entityType];

  return (
    <div className="space-y-6">
      <PageHeader title="CSV Import" subtitle="Import data from CSV files with Indian format support (DD/MM/YYYY, ₹ currency)" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Import Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Import As</Label>
                <Select value={entityType} onValueChange={(v) => { setEntityType(v); setFile(null); setPreview(null); setResults(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENTITY_CONFIGS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
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
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              </div>

              <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
                <p className="font-medium">Expected columns for {config.label}:</p>
                <p className="text-muted-foreground">{config.fields.join(', ')}</p>
                <p className="text-muted-foreground mt-1">Required: <span className="text-red-600">{config.required.join(', ')}</span></p>
                <p className="text-muted-foreground">Dates: DD/MM/YYYY or YYYY-MM-DD</p>
                <p className="text-muted-foreground">Amounts: ₹1,23,456 or 123456</p>
              </div>
            </CardContent>
          </Card>

          {results && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle className="w-5 h-5" />Import Complete</div>
                <div className="text-sm space-y-1">
                  <div className="text-emerald-700">✓ {results.success} records imported</div>
                  {results.duplicates > 0 && <div className="text-amber-700">↪ {results.duplicates} duplicates skipped</div>}
                  {results.failed > 0 && <div className="text-red-700">✗ {results.failed} invalid rows skipped</div>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          {!preview ? (
            <Card className="h-full flex items-center justify-center">
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
                        <TableCell>
                          {row.valid
                            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                            : <AlertCircle className="w-4 h-4 text-red-500" title={`Missing: ${row.missing.join(', ')}`} />
                          }
                        </TableCell>
                        {config.fields.map(f => (
                          <TableCell key={f} className="text-xs max-w-[120px] truncate">
                            {String(row.data[f] || '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.rows.length > 50 && <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 50 of {preview.rows.length} rows</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}