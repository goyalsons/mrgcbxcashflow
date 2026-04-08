import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Check, Trash2, Save, BookOpen } from 'lucide-react';
import ScenarioCompareModal from './ScenarioCompareModal';

const INR = v => { const a = Math.abs(v||0); if (a>=100000) return `₹${(a/100000).toFixed(1)}L`; return `₹${Math.round(a).toLocaleString('en-IN')}`; };

function serializeState(state) {
  return JSON.stringify({
    recAdj: [...state.recAdj.entries()],
    payAdj: [...state.payAdj.entries()],
    hypotheticals: state.hypotheticals,
    fundingSources: state.fundingSources,
    levers: state.levers,
    taxItems: state.taxItems,
  });
}
export function deserializeState(jsonStr) {
  const d = JSON.parse(jsonStr);
  return {
    recAdj: new Map(d.recAdj || []),
    payAdj: new Map(d.payAdj || []),
    hypotheticals: d.hypotheticals || [],
    fundingSources: d.fundingSources || [],
    levers: d.levers || [],
    taxItems: d.taxItems || [],
  };
}

export default function ScenarioManager({ currentState, onLoad, weeklyData, currentScenarioId, setCurrentScenarioId }) {
  const qc = useQueryClient();
  const [showDropdown, setShowDropdown] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: scenarios = [] } = useQuery({
    queryKey: ['simulatorScenarios'],
    queryFn: () => base44.entities.SimulatorScenario.list('-created_date', 20),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.SimulatorScenario.create(data),
    onSuccess: (s) => { qc.invalidateQueries(['simulatorScenarios']); setCurrentScenarioId(s.id); setSaveMode(false); setScenarioName(''); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SimulatorScenario.delete(id),
    onSuccess: (_, id) => { qc.invalidateQueries(['simulatorScenarios']); if (currentScenarioId === id) setCurrentScenarioId(null); },
  });

  const totalAdj = currentState.recAdj.size + currentState.payAdj.size + currentState.hypotheticals.length + currentState.fundingSources.length + currentState.levers.length + currentState.taxItems.length;

  const handleSave = () => {
    if (!totalAdj) { alert('No adjustments to save — make at least one change first.'); return; }
    if (scenarios.length >= 5) { alert('You have 5 saved scenarios — delete one to save a new one.'); return; }
    if (!scenarioName.trim()) { alert('Please enter a scenario name.'); return; }
    const baseNet = weeklyData.reduce((s, w) => s + w.baseNet, 0);
    const simNet  = weeklyData.reduce((s, w) => s + w.simNet, 0);
    saveMutation.mutate({ scenario_name: scenarioName.trim().slice(0,40), scenario_data: serializeState(currentState), net_improvement: simNet - baseNet, baseline_net: baseNet, sim_net: simNet });
  };

  const handleLoad = (s) => {
    setShowDropdown(false);
    onLoad(deserializeState(s.scenario_data));
    setCurrentScenarioId(s.id);
  };

  const handleDelete = (s) => {
    if (deleteConfirm === s.id) {
      deleteMutation.mutate(s.id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(s.id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* Save */}
      {saveMode ? (
        <div className="flex items-center gap-1.5">
          <Input maxLength={40} placeholder="Scenario name…" className="h-7 text-xs w-40" value={scenarioName} onChange={e => setScenarioName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saveMutation.isPending}>Save</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSaveMode(false)}>✕</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setSaveMode(true)}>
          <Save className="w-3 h-3" />Save
        </Button>
      )}

      {/* Scenarios dropdown */}
      <div className="relative">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowDropdown(v => !v)}>
          <BookOpen className="w-3 h-3" />Scenarios ({scenarios.length})<ChevronDown className="w-3 h-3" />
        </Button>
        {showDropdown && (
          <div className="absolute right-0 top-8 z-50 bg-card border rounded-xl shadow-lg min-w-[260px] overflow-hidden">
            {scenarios.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">No saved scenarios yet.</p>}
            {scenarios.map(s => {
              const imp = s.net_improvement || 0;
              const active = s.id === currentScenarioId;
              return (
                <div key={s.id} className={`flex items-center gap-2 p-2.5 hover:bg-muted/40 cursor-pointer border-b last:border-0 ${active ? 'bg-primary/5' : ''}`}>
                  <div className="flex-1 min-w-0" onClick={() => handleLoad(s)}>
                    <div className="flex items-center gap-1.5">
                      {active && <Check className="w-3 h-3 text-primary shrink-0" />}
                      <p className="text-xs font-medium truncate">{s.scenario_name}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{new Date(s.created_date).toLocaleDateString('en-IN')} · <span className={imp >= 0 ? 'text-emerald-600' : 'text-red-600'}>{imp >= 0 ? '▲' : '▼'} {INR(Math.abs(imp))}</span></p>
                  </div>
                  <button onClick={() => handleDelete(s)} className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${deleteConfirm === s.id ? 'bg-red-100 text-red-700' : 'text-muted-foreground hover:text-red-600'}`}>
                    {deleteConfirm === s.id ? 'Confirm?' : '×'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compare */}
      {scenarios.length >= 2 && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowCompare(true)}>Compare</Button>
      )}

      {showCompare && <ScenarioCompareModal scenarios={scenarios} onClose={() => setShowCompare(false)} onApply={s => { handleLoad(s); setShowCompare(false); }} weeklyData={weeklyData} />}

      {/* Click outside */}
      {showDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />}
    </div>
  );
}