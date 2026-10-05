import React, { useState, useEffect, useMemo } from 'react';
import { SpendRecord, SavedAiQueryPreset, ManualFilterCard, AggregatedQueryStats } from '../../../core/types/spend';
import { getAllSavedQueryPresets, saveSavedQueryPreset, deleteSavedQueryPreset } from '../../../core/db/db';
import { ManualFilterCardsBuilder } from './ManualFilterCardsBuilder';
import { FilteredDataDashboard } from './FilteredDataDashboard';
import { exportSpendRecordsToCsv, exportSpendRecordsToJson } from '../services/dataExportService';
import { evaluateSpendRecordAgainstCards, AVAILABLE_FILTER_FIELDS } from '../services/manualFilterEvaluator';
import { queryPipelineService } from '../services/queryPipelineService';
import { 
  BookmarkCheck, 
  Play, 
  Trash2, 
  Copy, 
  Plus, 
  Search, 
  Calendar, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Filter, 
  Layers, 
  DollarSign, 
  SlidersHorizontal,
  Edit3,
  Eye,
  Save,
  RotateCcw,
  BarChart3,
  Download,
  FileSpreadsheet
} from 'lucide-react';

interface SavedQueriesViewProps {
  records: SpendRecord[];
  onSelectRecord: (record: SpendRecord) => void;
}

export const SavedQueriesView: React.FC<SavedQueriesViewProps> = ({
  records,
  onSelectRecord
}) => {
  const [presets, setPresets] = useState<SavedAiQueryPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<SavedAiQueryPreset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [activeTabMode, setActiveTabMode] = useState<'dashboard' | 'conditions' | 'transactions'>('dashboard');

  // Manual Editing States
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingCards, setEditingCards] = useState<ManualFilterCard[]>([]);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const data = await getAllSavedQueryPresets();
      setPresets(data);
      if (data.length > 0 && !selectedPreset) {
        selectPreset(data[0]);
      }
    } catch (err) {
      console.error('Failed to load saved query presets:', err);
    }
  };

  const selectPreset = (preset: SavedAiQueryPreset) => {
    setSelectedPreset(preset);
    setEditingTitle(preset.title);
    setEditingDescription(preset.description || '');
    setEditingCards(JSON.parse(JSON.stringify(preset.filterCards || [])));
    setIsEditingMode(false);
  };

  // Evaluate active cards against records
  // Inter-card: OR
  // Inter-field: AND
  const activeCardsToEvaluate = isEditingMode ? editingCards : (selectedPreset?.filterCards || []);

  const evaluatedTransactions = useMemo(() => {
    if (!activeCardsToEvaluate || activeCardsToEvaluate.length === 0) {
      return [];
    }
    return records.filter(record => evaluateSpendRecordAgainstCards(record, activeCardsToEvaluate));
  }, [activeCardsToEvaluate, records]);

  const totalSpend = useMemo(() => {
    return evaluatedTransactions.reduce((sum, r) => sum + (Number(r.totalLineAmount) || 0), 0);
  }, [evaluatedTransactions]);

  // Aggregate stats dynamically for live dashboard
  const aggregatedStats: AggregatedQueryStats = useMemo(() => {
    const startTime = performance.now();
    return queryPipelineService.aggregateStats(evaluatedTransactions, records.length, startTime);
  }, [evaluatedTransactions, records.length]);

  const handleExportCsv = () => {
    if (evaluatedTransactions.length === 0) {
      alert('Tidak ada transaksi yang dapat diexport.');
      return;
    }
    const safeTitle = (selectedPreset?.title || 'Saved_Preset')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 30);
    exportSpendRecordsToCsv(evaluatedTransactions, `Siloam_Preset_${safeTitle}`);
  };

  const handleExportJson = () => {
    if (evaluatedTransactions.length === 0) {
      alert('Tidak ada transaksi yang dapat diexport.');
      return;
    }
    const safeTitle = (selectedPreset?.title || 'Saved_Preset')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 30);
    exportSpendRecordsToJson(evaluatedTransactions, `Siloam_Preset_${safeTitle}`);
  };

  const handleCreateNewPreset = () => {
    const defaultNewCard: ManualFilterCard = {
      id: `group_${Date.now()}`,
      commodity_remark_product: { include: [], exclude: [] },
      vendor_name: { include: [], exclude: [] },
      hospital_code: { include: [], exclude: [] }
    };
    const newPreset: SavedAiQueryPreset = {
      id: `query_${Date.now()}`,
      title: 'Custom Filter Set',
      description: 'Definisikan kriteria filter multi-dimensi secara manual',
      originalUserQuery: 'Manual Filter Custom Set',
      filterCards: [defaultNewCard],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setSelectedPreset(newPreset);
    setEditingTitle(newPreset.title);
    setEditingDescription(newPreset.description);
    setEditingCards([defaultNewCard]);
    setIsEditingMode(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedPreset) return;
    const updated: SavedAiQueryPreset = {
      ...selectedPreset,
      title: editingTitle.trim() || 'Untitled Filter Set',
      description: editingDescription.trim(),
      filterCards: editingCards,
      updatedAt: new Date().toISOString()
    };

    await saveSavedQueryPreset(updated);
    await loadPresets();
    setSelectedPreset(updated);
    setIsEditingMode(false);
    setNotification('Filter set and condition groups saved successfully.');
    setTimeout(() => setNotification(null), 3500);
  };

  const handleDeletePreset = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus preset kueri ini?')) {
      await deleteSavedQueryPreset(id);
      await loadPresets();
      if (selectedPreset?.id === id) {
        setSelectedPreset(null);
      }
      setNotification('Preset kueri berhasil dihapus.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDuplicatePreset = async (preset: SavedAiQueryPreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const duplicated: SavedAiQueryPreset = {
      ...preset,
      id: `query_${Date.now()}`,
      title: `${preset.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveSavedQueryPreset(duplicated);
    await loadPresets();
    selectPreset(duplicated);
    setNotification('Preset berhasil diduplikasi.');
    setTimeout(() => setNotification(null), 3000);
  };

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  const filteredPresets = presets.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.originalUserQuery.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-3">
            <BookmarkCheck className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>Card-Based Condition Groups & Manual Edit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Saved AI Queries & Filter Presets</h1>
          <p className="text-xs sm:text-sm text-indigo-100/80 mt-2 leading-relaxed">
            Kelola dan edit kriteria filter multi-kelompok secara visual dengan logika <strong>AND</strong> antar-field dan <strong>OR</strong> antar-kelompok kartu. Memungkinkan perbandingan spend lintas bulan (<em>Apple-to-Apple</em>) tanpa konsumsi token AI ulang.
          </p>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-900 text-xs shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{notification}</span>
        </div>
      )}

      {/* Main Grid: Presets List vs Editor & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Presets List */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col h-[750px]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Saved Presets ({presets.length})</h3>
            <button
              type="button"
              onClick={handleCreateNewPreset}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Preset</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search saved presets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredPresets.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400">
                <BookmarkCheck className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                <p className="text-xs font-semibold">No saved query presets found</p>
                <p className="text-[11px] text-slate-400 mt-1">Run queries in AI Analysis or click 'New Preset' to create.</p>
              </div>
            ) : (
              filteredPresets.map(preset => {
                const isSelected = selectedPreset?.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => selectPreset(preset)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left space-y-2 ${
                      isSelected 
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-xs ring-1 ring-indigo-200' 
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{preset.title}</h4>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={(e) => handleDuplicatePreset(preset, e)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-colors"
                          title="Duplicate Preset"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                          title="Delete Preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 font-sans italic">"{preset.originalUserQuery}"</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 font-mono">
                      <span>{preset.filterCards?.length || 0} Filter Group(s)</span>
                      <span>{new Date(preset.updatedAt || preset.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Selected Preset Evaluation, Manual Edit & Apple-to-Apple Results */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6 flex flex-col h-[750px] overflow-y-auto">
          {selectedPreset ? (
            <>
              {/* Preset Header & Action Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
                <div className="flex-1">
                  {isEditingMode ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        placeholder="Nama Filter Set..."
                        className="text-base font-bold text-slate-900 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        placeholder="Deskripsi tujuan filter (misal: Monitor pengadaan kertas di RS SHLV)..."
                        className="text-xs text-slate-600 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl w-full"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold font-mono mb-2">
                        <span>Preset ID: {selectedPreset.id}</span>
                      </div>
                      <h2 className="text-lg font-extrabold text-slate-900">{selectedPreset.title}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedPreset.description || `Original Prompt: "${selectedPreset.originalUserQuery}"`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {/* Export Buttons */}
                  <div className="flex items-center space-x-1.5 mr-2">
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all shadow-xs"
                      title="Download Filtered Records as CSV (Excel Compatible)"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Export Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-xs"
                      title="Download JSON"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>JSON</span>
                    </button>
                  </div>

                  {isEditingMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingMode(false);
                          setEditingCards(JSON.parse(JSON.stringify(selectedPreset.filterCards || [])));
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingMode(true)}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Criteria</span>
                    </button>
                  )}

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-right min-w-[170px]">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Matching Spend</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono block">{formatIDR(totalSpend)}</span>
                    <span className="text-[10px] text-indigo-600 font-bold block">{evaluatedTransactions.length} lines</span>
                  </div>
                </div>
              </div>

              {/* View Sub-tabs (Visual Dashboard vs Filter Conditions vs Raw Transactions) */}
              <div className="flex border-b border-slate-200 gap-1 pb-1">
                <button
                  type="button"
                  onClick={() => setActiveTabMode('dashboard')}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    activeTabMode === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Visual Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabMode('conditions')}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    activeTabMode === 'conditions'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filter Conditions ({selectedPreset.filterCards?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabMode('transactions')}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    activeTabMode === 'transactions'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Raw Transactions ({evaluatedTransactions.length})</span>
                </button>
              </div>

              {/* Tab Content: Visual Dashboard */}
              {activeTabMode === 'dashboard' && (
                <div className="space-y-4">
                  <FilteredDataDashboard
                    stats={aggregatedStats}
                    matchedRecords={evaluatedTransactions}
                    queryTitle={selectedPreset.title}
                    activeCardsCount={activeCardsToEvaluate.length}
                  />
                </div>
              )}

              {/* Tab Content: Filter Cards Section */}
              {activeTabMode === 'conditions' && (
                <div className="space-y-4">
                  {isEditingMode ? (
                    <ManualFilterCardsBuilder
                      cards={editingCards}
                      onChange={setEditingCards}
                      onApply={handleSaveChanges}
                      onSavePreset={handleSaveChanges}
                      matchedCount={evaluatedTransactions.length}
                      totalRecordsCount={records.length}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                          <Filter className="w-4 h-4 text-indigo-600" />
                          <span>Active Filter Groups ({selectedPreset.filterCards?.length || 0})</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsEditingMode(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          + Modify Criteria
                        </button>
                      </div>

                      {/* Read-Only Visual Representation with OR dividers */}
                      <div className="space-y-4">
                        {selectedPreset.filterCards?.map((card, idx) => (
                          <React.Fragment key={card.id || idx}>
                            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-800">
                                  Filter Group #{idx + 1}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                                  AND within group
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                                {AVAILABLE_FILTER_FIELDS.map(f => {
                                  const fieldData = card[f.key];
                                  if (!fieldData || (fieldData.include.length === 0 && fieldData.exclude.length === 0)) return null;

                                  return (
                                    <div key={f.key} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                                      <span className="text-[10px] text-slate-400 uppercase font-bold block">{f.label}</span>
                                      {fieldData.include.length > 0 && (
                                        <div className="text-slate-800 font-bold text-xs">
                                          <span className="text-emerald-700 text-[10px] uppercase mr-1">Include:</span>
                                          {fieldData.include.join(', ')}
                                        </div>
                                      )}
                                      {fieldData.exclude.length > 0 && (
                                        <div className="text-rose-600 font-bold text-xs">
                                          <span className="text-rose-700 text-[10px] uppercase mr-1">Exclude:</span>
                                          {fieldData.exclude.join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {idx < (selectedPreset.filterCards?.length || 0) - 1 && (
                              <div className="relative flex py-1 items-center justify-center">
                                <div className="flex-grow border-t-2 border-dashed border-amber-300"></div>
                                <span className="mx-4 px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black tracking-wider uppercase shadow-xs">
                                  OR (Match Any Group)
                                </span>
                                <div className="flex-grow border-t-2 border-dashed border-amber-300"></div>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Transactions Table for Instant Cross-Month Apple-to-Apple Verification */}
              {activeTabMode === 'transactions' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Matching Transactions ({evaluatedTransactions.length})
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                        Zero Hallucination
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">Click any row to inspect line item</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[480px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5">Date / Month</th>
                          <th className="px-4 py-2.5">Hospital</th>
                          <th className="px-4 py-2.5">Item Name</th>
                          <th className="px-4 py-2.5">Vendor</th>
                          <th className="px-4 py-2.5 text-right">Qty</th>
                          <th className="px-4 py-2.5 text-right">Total (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {evaluatedTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                              Tidak ada transaksi yang cocok dengan kriteria filter aktif ini.
                            </td>
                          </tr>
                        ) : (
                          evaluatedTransactions.slice(0, 150).map(tx => (
                            <tr
                              key={tx.id}
                              onClick={() => onSelectRecord(tx)}
                              className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-2 text-slate-600 font-mono text-[11px]">
                                {tx.monthYear || tx.createdDate?.slice(0, 7) || 'N/A'}
                              </td>
                              <td className="px-4 py-2 font-bold text-slate-900 font-mono text-[11px]">
                                {tx.hospitalCode || 'SH'}
                              </td>
                              <td className="px-4 py-2 text-slate-800 font-medium max-w-[200px] truncate">
                                {tx.itemName || tx.purchReqName || '-'}
                              </td>
                              <td className="px-4 py-2 text-slate-600 max-w-[180px] truncate">
                                {tx.vendorName || '-'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-medium text-slate-700">
                                {Number(tx.purchQty || 1).toLocaleString('id-ID')}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-blue-700">
                                {formatIDR(Number(tx.totalLineAmount || 0))}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-16">
              <BookmarkCheck className="w-12 h-12 text-slate-300 mb-3 stroke-1" />
              <h3 className="text-sm font-bold text-slate-700">No Preset Selected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                Pilih preset yang tersimpan di sebelah kiri atau buat kelompok kondisi filter baru.
              </p>
              <button
                type="button"
                onClick={handleCreateNewPreset}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-xs"
              >
                + Buat Filter Set Baru
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
