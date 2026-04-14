import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { loadActiveLLM } from '@/components/settings/LLMSettings';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UploadCloud, Sparkles, Save, FileText, Trash2, ChevronDown, ChevronUp,
  BarChart3, TrendingUp, AlertCircle, CheckCircle, Loader2, X, FileDiff
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import AnalysisReportCard from '@/components/analysis/AnalysisReportCard';
import SaveReportDialog from '@/components/analysis/SaveReportDialog';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Analysis() {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState([]);
  const [fileUrls, setFileUrls] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [compareReportId, setCompareReportId] = useState(null);

  const { data: savedReports = [] } = useQuery({
    queryKey: ['analysisReports'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date'),
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id) => base44.entities.AnalysisReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analysisReports'] }),
  });

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;

    // Show filenames immediately so user gets feedback
    const newFileNames = selected.map(f => f.name);
    setFiles(f => [...f, ...newFileNames]);
    setFileUrls(u => [...u, ...newFileNames.map(() => null)]);
    setUploading(true);

    const uploadedUrls = [];
    for (const file of selected) {
      try {
        const res = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(res.file_url);
      } catch (err) {
        console.error('Upload error:', err);
        uploadedUrls.push(null);
      }
    }

    // Replace the placeholder nulls with real URLs
    setFileUrls(u => {
      const updated = [...u];
      const startIdx = updated.length - selected.length;
      uploadedUrls.forEach((url, i) => { updated[startIdx + i] = url; });
      return updated;
    });
    setUploading(false);
  };

  const removeFile = (idx) => {
    setFiles(f => f.filter((_, i) => i !== idx));
    setFileUrls(u => u.filter((_, i) => i !== idx));
  };

  const handleAnalyze = async () => {
    if (!prompt.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);

    // Get active LLM from settings
    const activeLLM = loadActiveLLM();
    if (!activeLLM.provider) {
      setAnalysisResult({ error: 'No LLM configured', message: 'Please configure and activate an LLM provider in Settings → AI/LLM to use analysis.' });
      setAnalyzing(false);
      return;
    }

    // Extract actual data from uploaded files
    let extractedDataText = '';
    const validUrls = fileUrls.filter(Boolean);
    if (validUrls.length > 0) {
      const extractionSchema = {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: { type: 'object', additionalProperties: true }
          },
          headers: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        }
      };

      const extractedParts = [];
      for (let i = 0; i < validUrls.length; i++) {
        try {
          const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: validUrls[i],
            json_schema: extractionSchema
          });
          if (extracted.status === 'success' && extracted.output) {
            const data = extracted.output;
            const rows = data.rows || (Array.isArray(data) ? data : []);
            const dataStr = JSON.stringify(rows.slice(0, 200));
            extractedParts.push(`File: ${files[i]}\nData (${rows.length} rows):\n${dataStr}`);
          }
        } catch (err) {
          console.error('Extraction error for', files[i], err);
        }
      }
      extractedDataText = extractedParts.join('\n\n');
    }

    const contextText = extractedDataText
      ? `The following data was extracted from the uploaded files:\n\n${extractedDataText}\n\nUse this actual data for the analysis.`
      : (files.length > 0 ? `Files referenced: ${files.join(', ')}.` : '');

    const analysisPrompt = `You are a financial data analyst. ${contextText}\n\nUser prompt: ${prompt}\n\nProvide a comprehensive analysis based on the actual data provided and return a JSON object with this exact structure:\n{\n  "summary": "2-3 sentence executive summary",\n  "key_metrics": [{"label": "string", "value": "string", "trend": "up|down|neutral", "color": "green|red|amber"}],\n  "insights": [{"title": "string", "description": "string", "type": "positive|negative|neutral"}],\n  "chart_data": {\n    "bar": [{"name": "string", "value": number, "value2": number}],\n    "line": [{"name": "string", "value": number}],\n    "pie": [{"name": "string", "value": number}]\n  },\n  "bar_label": "string",\n  "bar_label2": "string",\n  "line_label": "string",\n  "recommendations": ["string"]\n}`;

    try {
      let result;
      
      if (activeLLM.provider === 'gemini') {
        result = await base44.functions.invoke('testLLM', {
          provider: 'gemini',
          api_key: activeLLM.gemini_api_key,
          model: activeLLM.gemini_model,
          prompt: analysisPrompt,
        });
        setAnalysisResult(JSON.parse(result.data.response));
      } else if (activeLLM.provider === 'claude') {
        result = await base44.functions.invoke('testLLM', {
          provider: 'claude',
          api_key: activeLLM.claude_api_key,
          model: activeLLM.claude_model,
          prompt: analysisPrompt,
        });
        setAnalysisResult(JSON.parse(result.data.response));
      }
    } catch (err) {
      setAnalysisResult({ error: 'Analysis failed', message: err.message || 'An error occurred during analysis. Please try again.' });
    }
    setAnalyzing(false);
  };

  const compareReport = compareReportId ? savedReports.find(r => r.id === compareReportId) : null;
  const compareResult = compareReport?.result ? JSON.parse(compareReport.result) : null;

  const trendColor = (trend) => trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-amber-500';
  const trendIcon = (trend) => trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const metricBg = (color) => color === 'green' ? 'bg-emerald-50 border-emerald-200' : color === 'red' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analysis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload Tally exports or any financial files and get AI-powered insights</p>
        </div>
        {savedReports.length > 0 && (
          <Badge variant="outline" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            {savedReports.length} saved report{savedReports.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Upload + Prompt */}
        <div className="lg:col-span-1 space-y-4">
          {/* Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-primary" /> Upload Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <UploadCloud className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground text-center">Click to upload Excel, PDF, or CSV</span>
                <span className="text-xs text-muted-foreground/60">Tally exports, invoices, reports</span>
                <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
              {uploading && (
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading files...
                </div>
              )}
              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((name, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-muted/40 rounded-md px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">{name}</span>
                      </div>
                      <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive ml-2">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Analysis Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. Analyse my sales trend for Q1, identify top performing products, highlight any anomalies, and compare revenue vs expenses..."
                rows={6}
                className="text-sm resize-none"
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Quick prompts:</p>
                {[
                  'Summarize revenue, expenses and net profit trend',
                  'Identify top debtors and overdue risk',
                  'Analyse cash flow and liquidity position',
                ].map(q => (
                  <button key={q} onClick={() => setPrompt(q)} className="block w-full text-left text-xs text-primary hover:underline truncate">
                    → {q}
                  </button>
                ))}
              </div>
              <Button onClick={handleAnalyze} disabled={!prompt.trim() || analyzing || uploading} className="w-full gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? 'Analysing...' : 'Run Analysis'}
              </Button>
            </CardContent>
          </Card>

          {/* Compare with saved report */}
          {savedReports.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileDiff className="w-4 h-4 text-primary" /> Compare With
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background"
                  value={compareReportId || ''}
                  onChange={e => setCompareReportId(e.target.value || null)}
                >
                  <option value="">None</option>
                  {savedReports.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-2 space-y-4">
          {!analysisResult && !analyzing && (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-8">
              <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No analysis yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Upload files and write a prompt, then click Run Analysis</p>
            </div>
          )}

          {analysisResult?.error && (
            <div className="flex flex-col items-center justify-center h-64 border rounded-xl bg-red-50 border-red-200 text-center p-8">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-sm font-medium text-red-700">{analysisResult.error}</p>
              <p className="text-xs text-red-600 mt-1">{analysisResult.message}</p>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center h-64 border rounded-xl bg-primary/5">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm font-medium text-primary">Analysing your data...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4">
              {/* Actions */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Analysis Results</h2>
                <Button size="sm" onClick={() => setShowSaveDialog(true)} className="gap-1.5 h-8 text-xs">
                  <Save className="w-3.5 h-3.5" /> Save Report
                </Button>
              </div>

              {/* Summary */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-foreground leading-relaxed">{analysisResult.summary}</p>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              {analysisResult.key_metrics?.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {analysisResult.key_metrics.map((m, i) => (
                    <div key={i} className={`rounded-lg border px-4 py-3 ${metricBg(m.color)}`}>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{m.value}</p>
                      <span className={`text-xs font-medium ${trendColor(m.trend)}`}>{trendIcon(m.trend)} {m.trend}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Charts */}
              <Tabs defaultValue="bar">
                <TabsList className="h-8">
                  <TabsTrigger value="bar" className="text-xs">Bar Chart</TabsTrigger>
                  <TabsTrigger value="line" className="text-xs">Trend</TabsTrigger>
                  <TabsTrigger value="pie" className="text-xs">Distribution</TabsTrigger>
                </TabsList>

                <TabsContent value="bar">
                  <Card>
                    <CardContent className="pt-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analysisResult.chart_data?.bar || []}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="value" name={analysisResult.bar_label || 'Value'} fill={COLORS[0]} radius={[4,4,0,0]} />
                          {analysisResult.chart_data?.bar?.[0]?.value2 !== undefined && (
                            <Bar dataKey="value2" name={analysisResult.bar_label2 || 'Value 2'} fill={COLORS[1]} radius={[4,4,0,0]} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="line">
                  <Card>
                    <CardContent className="pt-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={analysisResult.chart_data?.line || []}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line type="monotone" dataKey="value" name={analysisResult.line_label || 'Trend'} stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="pie">
                  <Card>
                    <CardContent className="pt-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analysisResult.chart_data?.pie || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {(analysisResult.chart_data?.pie || []).map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Insights */}
              {analysisResult.insights?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm">Key Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysisResult.insights.map((ins, i) => (
                      <div key={i} className={`flex gap-3 p-3 rounded-lg border text-sm ${ins.type === 'positive' ? 'bg-emerald-50 border-emerald-200' : ins.type === 'negative' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                        {ins.type === 'positive' ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-medium text-foreground">{ins.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ins.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {analysisResult.recommendations?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {analysisResult.recommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Comparison */}
              {compareResult && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileDiff className="w-4 h-4 text-primary" /> Compared with: {compareReport?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2 italic">"{compareReport?.prompt}"</p>
                    <p className="text-sm">{compareResult.summary}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Saved Reports */}
      {savedReports.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Save className="w-4 h-4" /> Saved Reports
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReports.map(report => (
              <AnalysisReportCard
                key={report.id}
                report={report}
                onDelete={() => deleteReportMutation.mutate(report.id)}
                onLoad={(result, savedPrompt) => {
                  setAnalysisResult(result);
                  setPrompt(savedPrompt);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {showSaveDialog && (
        <SaveReportDialog
          prompt={prompt}
          files={files}
          fileUrls={fileUrls}
          analysisResult={analysisResult}
          onClose={() => setShowSaveDialog(false)}
          onSaved={() => {
            setShowSaveDialog(false);
            queryClient.invalidateQueries({ queryKey: ['analysisReports'] });
          }}
        />
      )}
    </div>
  );
}