import React, { useState, useMemo, useEffect } from 'react';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  ManualFilterCard, 
  SavedAiQueryPreset, 
  QueryPipelineResult,
  AggregatedQueryStats
} from '../../../core/types/spend';
import { vectorService } from '../services/vectorService';
import { queryPipelineService, SemanticAuditResult } from '../services/queryPipelineService';
import { getAllSavedQueryPresets, saveSavedQueryPreset, deleteSavedQueryPreset } from '../../../core/db/db';
import { ManualFilterCardsBuilder } from './ManualFilterCardsBuilder';
import { FilteredDataDashboard } from './FilteredDataDashboard';
import { exportSpendRecordsToCsv, exportSpendRecordsToJson } from '../services/dataExportService';
import { evaluateSpendRecordAgainstCards } from '../services/manualFilterEvaluator';
import { MarkdownRenderer } from '../../../core/ui/MarkdownRenderer';
import { ConvertAiQueryToSavedSearchModal } from './aiQuery/ConvertAiQueryToSavedSearchModal';
import { queryHistoryService, QueryHistoryEntry } from '../services/queryHistoryService';
import { 
  Sparkles, BrainCircuit, Search, Database, ArrowRight, CheckCircle2, ShieldAlert, 
  Cpu, Filter, Layers, DollarSign, BookmarkCheck, BookmarkPlus, BarChart3, TrendingUp, 
  Building2, Package, Tag, Clock, ChevronRight, Copy, RefreshCw, XCircle, FileSpreadsheet,
  AlertTriangle, Check, Plus, X, EyeOff, ShieldCheck, SlidersHorizontal, CheckSquare,
  HelpCircle, Split, ListFilter, CornerDownRight, ArrowDownRight, Edit3, Download, 
  FileText, Maximize2, Minimize2, ArrowLeft, Trash2, Play, Eye, ExternalLink, Calendar,
  Store, FolderTree, ArrowUpDown, ChevronLeft, History
} from 'lucide-react';

export const SAMPLE_PROMPTS: string[] = [
  'Berapa pembelian pulpen di pulau jawa selama q3 2026 tiap tanggal 1',
  'Berapa jumlah PO peralatan kantor namun bukan berupa kertas, hanya ATK saja di front office dan FMS',
  'Tampilkan pengadaan consumable medis yang bukan berupa jarum suntik atau syringe di SHKJ',
  'Bandingkan total pengadaan alat kesehatan dan obat antara Kuartal 1 dan Kuartal 2 tahun 2026',
  'Siapa saja vendor penjual kertas terbanyak ke SHLV selama bulan April 2026 dan berapa harga satuannya?',
  'Analisa disparitas harga satuan (unit price variance) untuk sarung tangan medis latex antar unit RS Siloam',
  'Ada berapa pembelian medical equipment di rumah sakit di pulau Jawa dibandingkan luar Jawa?',
  'Tampilkan seluruh transaksi belanja modal (CAPEX) dengan nilai diatas 500 juta rupiah untuk radiologi dan bedah',
  'Berapa belanja obat dan farmasi di unit SHLV yang bukan paracetamol dan bukan vitamin selama Q2 2026?',
  'Berapa pengadaan bahan pangan dan perlengkapan dapur yang diajukan oleh instalasi gizi atau F&B?',
  'Analisa pengadaan monitor pasien di rumah sakit wilayah Jabotabek dan USG di luar Jawa'
];

interface AiQueryHubViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  onSelectRecord: (record: SpendRecord) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const AiQueryHubView: React.FC<AiQueryHubViewProps> = ({
  records,
  skuMasters,
  onSelectRecord,
  onNavigateToTab
}) => {
  // Main Top-level View Mode: 'studio' (AI & Vector Query) | 'presets_list' (Saved Presets Catalog) | 'fullscreen_drilldown' (Full Screen Drilldown Workspace)
  const [hubMode, setHubMode] = useState<'studio' | 'presets_list' | 'fullscreen_drilldown'>('studio');

  // ==================== AI STUDIO STATES ====================
  const [userQuery, setUserQuery] = useState('');
  const [pipelineResult, setPipelineResult] = useState<QueryPipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [studioActiveTab, setStudioActiveTab] = useState<'visual_dashboard' | 'triage_inspector' | 'pipeline_overview' | 'transactions_table' | 'vector_skus'>('visual_dashboard');
  const [activeFilterCards, setActiveFilterCards] = useState<ManualFilterCard[]>([]);
  const [isBuilderExpanded, setIsBuilderExpanded] = useState(false);
  const [presetSavedMsg, setPresetSavedMsg] = useState<string | null>(null);
  const [copiedNarrative, setCopiedNarrative] = useState(false);
  const [indexStats, setIndexStats] = useState<{ newlyGenerated: number; reusedFromCache: number } | null>(null);

  // AI Semantic Relevance Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<SemanticAuditResult | null>(null);
  const [customExcludeInput, setCustomExcludeInput] = useState('');

  // Query history state and toggle
  const [showHistory, setShowHistory] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([]);

  useEffect(() => {
    setQueryHistory(queryHistoryService.getHistory());
  }, []);

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = queryHistoryService.deleteEntry(id);
    setQueryHistory(updated);
  };

  const handleClearAllHistory = () => {
    if (confirm('Hapus seluruh riwayat pertanyaan?')) {
      queryHistoryService.clearHistory();
      setQueryHistory([]);
    }
  };

  // Input ref and notification state for safely loading & editing prompts (No accidental 1-click execution)
  const queryInputRef = React.useRef<HTMLInputElement>(null);
  const [loadPromptNotice, setLoadPromptNotice] = useState<string | null>(null);

  const handleSelectPromptForEdit = (promptText: string) => {
    setUserQuery(promptText);
    setLoadPromptNotice('Pertanyaan telah dimuat ke kolom input. Anda dapat menyesuaikan (misal: mengganti nama unit RS, periode, atau kata kunci) lalu tekan "Analisis dengan AI".');
    setTimeout(() => setLoadPromptNotice(null), 6000);
    setTimeout(() => {
      if (queryInputRef.current) {
        queryInputRef.current.focus();
        queryInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };

  // Convert AI Query results to e-Catalogue Saved Search modal state
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [recordsToConvert, setRecordsToConvert] = useState<SpendRecord[]>([]);
  const [queryTitleToConvert, setQueryTitleToConvert] = useState<string>('');

  const handleOpenConvertToSavedSearch = (matchedRecs: SpendRecord[], title: string) => {
    setRecordsToConvert(matchedRecs);
    setQueryTitleToConvert(title);
    setIsConvertModalOpen(true);
  };

  // ==================== SAVED PRESETS STATES ====================
  const [presets, setPresets] = useState<SavedAiQueryPreset[]>([]);
  const [presetSearch, setPresetSearch] = useState('');
  const [selectedDrilldownPreset, setSelectedDrilldownPreset] = useState<SavedAiQueryPreset | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Fullscreen Drilldown States
  const [drilldownTab, setDrilldownTab] = useState<'dashboard' | 'transactions' | 'conditions' | 'narrative'>('dashboard');
  const [isEditingPresetCards, setIsEditingPresetCards] = useState(false);
  const [editingCards, setEditingCards] = useState<ManualFilterCard[]>([]);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');

  // Drilldown Transactions Table Pagination & Search
  const [tableSearch, setTableSearch] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<'totalLineAmount' | 'createdDate' | 'purchQty' | 'purchPrice' | 'hospitalCode' | 'vendorName'>('totalLineAmount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Initialize vector indexing in background
  useEffect(() => {
    if (skuMasters.length > 0) {
      const timer = setTimeout(() => {
        const stats = vectorService.indexSkuMasters(skuMasters);
        setIndexStats(stats);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [skuMasters]);

  // Load presets from DB
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const data = await getAllSavedQueryPresets();
      setPresets(data);
    } catch (err) {
      console.error('Failed to load saved query presets:', err);
    }
  };

  // Format currency helpers
  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
  const formatIDRShort = (val: number) => {
    if (!val) return '0';
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}M`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}Jt`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(0)}Rb`;
    return `${val}`;
  };

  // ==================== AI STUDIO HANDLERS ====================
  const handleExecutePipeline = async (queryToRun?: string) => {
    const q = (queryToRun !== undefined ? queryToRun : userQuery).trim();
    if (!q) return;

    if (queryToRun) {
      setUserQuery(queryToRun);
    }

    setLoading(true);
    setPresetSavedMsg(null);
    setAuditResult(null);

    try {
      const result = await queryPipelineService.runTwoStagePipeline(q, records, skuMasters);
      setPipelineResult(result);

      // Automatically record question to persistent query history
      const updatedHistory = queryHistoryService.addEntry(
        q, 
        result.matchedRecords.length, 
        result.aggregatedStats.totalSpend, 
        result.triageResult?.search_intent || result.parsedFilter?.search_intent
      );
      setQueryHistory(updatedHistory);

      const cards = result.filterCards && result.filterCards.length > 0 
        ? result.filterCards 
        : (result.triageResult?.suggestedCards || queryPipelineService.convertToManualFilterCards(result.parsedFilter));
      
      setActiveFilterCards(cards);
    } catch (err) {
      console.error('Two-stage pipeline execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardsChange = (updatedCards: ManualFilterCard[]) => {
    setActiveFilterCards(updatedCards);

    if (pipelineResult) {
      const startTime = performance.now();
      const matched = queryPipelineService.executeCardFilter(records, updatedCards);
      const stats = queryPipelineService.aggregateStats(matched, records.length, startTime);

      setPipelineResult({
        ...pipelineResult,
        filterCards: updatedCards,
        matchedRecords: matched,
        aggregatedStats: stats
      });
    }
  };

  const handleSaveAsPreset = async () => {
    if (!pipelineResult) return;

    const cardsToSave = activeFilterCards.length > 0 ? activeFilterCards : (pipelineResult.filterCards || []);

    const preset: SavedAiQueryPreset = {
      id: `preset_${Date.now()}`,
      title: pipelineResult.query.slice(0, 60) + (pipelineResult.query.length > 60 ? '...' : ''),
      description: `Intent: ${pipelineResult.triageResult?.search_intent || pipelineResult.parsedFilter.search_intent}`,
      originalUserQuery: pipelineResult.query,
      filterCards: cardsToSave,
      parsedFilter: pipelineResult.parsedFilter,
      narrativeInsight: pipelineResult.narrativeResponse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveSavedQueryPreset(preset);
    await loadPresets();
    setPresetSavedMsg('Preset berhasil disimpan ke database! Anda dapat membuka drilldown full-screen di tab "Katalog Saved Presets".');
    setTimeout(() => setPresetSavedMsg(null), 6000);
  };

  const handleTriggerAiAudit = async () => {
    if (!pipelineResult) return;
    setIsAuditing(true);
    try {
      const sampleItems = pipelineResult.matchedRecords.slice(0, 30).map(r => ({
        itemName: r.itemName || r.purchReqName || 'Unknown Item',
        spec: r.purchReqName || '',
        category: r.procurementCategory || r.purchaseCategory || ''
      }));
      const result = await queryPipelineService.auditSemanticRelevance(pipelineResult.query, sampleItems);
      setAuditResult(result);
    } catch (err) {
      console.error('Audit relevance error:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleApplyExclusionKeyword = (keywordToExclude: string) => {
    if (!pipelineResult) return;
    const kw = keywordToExclude.trim().toLowerCase();
    if (!kw) return;

    const updatedCards = activeFilterCards.map(card => {
      const currentComm = card.commodity_l5 || card.commodity_remark_product || { include: [], exclude: [] };
      const currentExcludes = currentComm.exclude || [];
      if (currentExcludes.some(e => e.toLowerCase() === kw)) return card;

      return {
        ...card,
        commodity_l5: {
          include: currentComm.include || [],
          exclude: [...currentExcludes, kw]
        }
      };
    });

    handleCardsChange(updatedCards);
  };

  const handleApplyAllRecommendedExclusions = (exclusions: string[]) => {
    if (!pipelineResult || !exclusions.length) return;
    const toAdd = exclusions.map(e => e.trim().toLowerCase()).filter(Boolean);

    const updatedCards = activeFilterCards.map(card => {
      const currentComm = card.commodity_l5 || card.commodity_remark_product || { include: [], exclude: [] };
      const currentExcludes = new Set((currentComm.exclude || []).map(e => e.toLowerCase()));
      toAdd.forEach(e => currentExcludes.add(e));

      return {
        ...card,
        commodity_l5: {
          include: currentComm.include || [],
          exclude: Array.from(currentExcludes)
        }
      };
    });

    handleCardsChange(updatedCards);
  };

  // ==================== DRILLDOWN WORKSPACE CALCULATIONS ====================
  const activeDrilldownCards = isEditingPresetCards 
    ? editingCards 
    : (selectedDrilldownPreset?.filterCards || []);

  const drilldownMatchedRecords = useMemo(() => {
    if (!selectedDrilldownPreset || !activeDrilldownCards || activeDrilldownCards.length === 0) {
      return [];
    }
    return records.filter(r => evaluateSpendRecordAgainstCards(r, activeDrilldownCards));
  }, [selectedDrilldownPreset, activeDrilldownCards, records]);

  const drilldownStats: AggregatedQueryStats = useMemo(() => {
    const startTime = performance.now();
    return queryPipelineService.aggregateStats(drilldownMatchedRecords, records.length, startTime);
  }, [drilldownMatchedRecords, records.length]);

  // Open Full-Screen Drilldown Workspace for a preset
  const handleOpenPresetDrilldown = (preset: SavedAiQueryPreset) => {
    setSelectedDrilldownPreset(preset);
    setEditingTitle(preset.title);
    setEditingDescription(preset.description || '');
    setEditingCards(JSON.parse(JSON.stringify(preset.filterCards || [])));
    setIsEditingPresetCards(false);
    setDrilldownTab('dashboard');
    setTablePage(1);
    setTableSearch('');
    setHubMode('fullscreen_drilldown');
  };

  const handleSaveDrilldownChanges = async () => {
    if (!selectedDrilldownPreset) return;
    const updated: SavedAiQueryPreset = {
      ...selectedDrilldownPreset,
      title: editingTitle.trim() || 'Untitled Filter Preset',
      description: editingDescription.trim(),
      filterCards: editingCards,
      updatedAt: new Date().toISOString()
    };

    await saveSavedQueryPreset(updated);
    await loadPresets();
    setSelectedDrilldownPreset(updated);
    setIsEditingPresetCards(false);
    setNotification('Perubahan kartu filter dan metadata preset berhasil disimpan.');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeletePreset = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus preset kueri ini?')) {
      await deleteSavedQueryPreset(id);
      await loadPresets();
      if (selectedDrilldownPreset?.id === id) {
        setSelectedDrilldownPreset(null);
        setHubMode('presets_list');
      }
      setNotification('Preset kueri berhasil dihapus.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDuplicatePreset = async (preset: SavedAiQueryPreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const duplicated: SavedAiQueryPreset = {
      ...preset,
      id: `preset_${Date.now()}`,
      title: `${preset.title} (Salinan)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveSavedQueryPreset(duplicated);
    await loadPresets();
    setNotification('Preset berhasil diduplikasi ke katalog.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleClonePresetToStudio = (preset: SavedAiQueryPreset) => {
    setUserQuery(preset.originalUserQuery);
    setHubMode('studio');
    setLoadPromptNotice(`Kueri dari preset "${preset.title}" telah dimuat ke kolom input. Anda dapat menyesuaikan kueri sebelum menekan "Analisis dengan AI".`);
    setTimeout(() => setLoadPromptNotice(null), 6000);
    setTimeout(() => {
      if (queryInputRef.current) {
        queryInputRef.current.focus();
        queryInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Export functions
  const handleExportDrilldownCsv = () => {
    if (drilldownMatchedRecords.length === 0) {
      alert('Tidak ada transaksi untuk diekspor.');
      return;
    }
    const safeTitle = (selectedDrilldownPreset?.title || 'Preset')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 30);
    exportSpendRecordsToCsv(drilldownMatchedRecords, `Siloam_Preset_${safeTitle}`);
  };

  const handleExportDrilldownJson = () => {
    if (drilldownMatchedRecords.length === 0) {
      alert('Tidak ada transaksi untuk diekspor.');
      return;
    }
    const safeTitle = (selectedDrilldownPreset?.title || 'Preset')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 30);
    exportSpendRecordsToJson(drilldownMatchedRecords, `Siloam_Preset_${safeTitle}`);
  };

  // Filtered and Sorted Table Data for Drilldown
  const tableFilteredRecords = useMemo(() => {
    let list = [...drilldownMatchedRecords];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(r => 
        (r.itemName && r.itemName.toLowerCase().includes(q)) ||
        (r.purchReqName && r.purchReqName.toLowerCase().includes(q)) ||
        (r.vendorName && r.vendorName.toLowerCase().includes(q)) ||
        (r.hospitalCode && r.hospitalCode.toLowerCase().includes(q)) ||
        (r.purchId && r.purchId.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') valA = (valA as string).toLowerCase();
      if (typeof valB === 'string') valB = (valB as string).toLowerCase();

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [drilldownMatchedRecords, tableSearch, sortField, sortOrder]);

  const totalTablePages = Math.ceil(tableFilteredRecords.length / pageSize) || 1;
  const paginatedTableRecords = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return tableFilteredRecords.slice(start, start + pageSize);
  }, [tableFilteredRecords, tablePage, pageSize]);

  // Filtered preset list search
  const filteredPresetsList = useMemo(() => {
    if (!presetSearch.trim()) return presets;
    const q = presetSearch.toLowerCase();
    return presets.filter(p => 
      p.title.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.originalUserQuery.toLowerCase().includes(q)
    );
  }, [presets, presetSearch]);

  // ==================== RENDER: FULL-SCREEN DRILLDOWN WORKSPACE ====================
  if (hubMode === 'fullscreen_drilldown' && selectedDrilldownPreset) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Full-Screen Header Toolbar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-4">
            {/* Back to Presets List navigation */}
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-700/60 pb-3">
              <button
                type="button"
                onClick={() => setHubMode('presets_list')}
                className="inline-flex items-center space-x-2 text-xs font-bold text-blue-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Katalog Presets</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleClonePresetToStudio(selectedDrilldownPreset)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-500/30 hover:bg-purple-500/50 text-purple-200 border border-purple-400/40 text-xs font-bold transition-colors"
                  title="Kloning kueri ini ke AI Studio untuk analisis lanjutan"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  <span>Kloning ke AI Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenConvertToSavedSearch(drilldownMatchedRecords, selectedDrilldownPreset.title)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm"
                  title="Ambil seluruh nama item/SKU yang masuk ke preset ini lalu convert menjadi Saved Search atau tambahkan ke Saved Search yang sudah ada"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Convert ke Saved Search SKU</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDrilldownCsv}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
                  title="Ekspor transaksi terfilter ke format CSV Microsoft Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDrilldownJson}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Preset Title & Metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                    Full-Screen Preset Drilldown
                  </span>
                  <span className="text-slate-400 text-xs flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    <span>Dibuat: {new Date(selectedDrilldownPreset.createdAt).toLocaleDateString('id-ID')}</span>
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {selectedDrilldownPreset.title}
                </h2>
                {selectedDrilldownPreset.description && (
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    {selectedDrilldownPreset.description}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 shrink-0">
                <div className="text-center px-3 border-r border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Spend</span>
                  <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-400">
                    {formatIDRShort(drilldownStats.totalSpend)}
                  </span>
                </div>
                <div className="text-center px-3">
                  <span className="text-[10px] text-slate-400 block font-semibold">Matched Rows</span>
                  <span className="text-sm sm:text-base font-extrabold font-mono text-blue-400">
                    {drilldownMatchedRecords.length.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub Tabs inside Full-Screen Drilldown */}
            <div className="flex items-center space-x-2 overflow-x-auto pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDrilldownTab('dashboard')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  drilldownTab === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Visual Dashboard, Top 10 & Treemap L1-L5</span>
              </button>

              <button
                type="button"
                onClick={() => setDrilldownTab('transactions')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  drilldownTab === 'transactions'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Spending Cube Transaksi ({drilldownMatchedRecords.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrilldownTab('conditions')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  drilldownTab === 'conditions'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Kartu Kondisi Filter ({activeDrilldownCards.length})</span>
              </button>

              {selectedDrilldownPreset.narrativeInsight && (
                <button
                  type="button"
                  onClick={() => setDrilldownTab('narrative')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    drilldownTab === 'narrative'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Narasi Analisis Eksekutif AI</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {notification && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-900 text-xs shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{notification}</span>
          </div>
        )}

        {/* Tab Content 1: Live Visual Dashboard with Full Treemap L1-L5 */}
        {drilldownTab === 'dashboard' && (
          <div className="space-y-6">
            <FilteredDataDashboard
              stats={drilldownStats}
              matchedRecords={drilldownMatchedRecords}
              queryTitle={selectedDrilldownPreset.title}
              activeCardsCount={activeDrilldownCards.length}
              onSelectRecord={onSelectRecord}
            />
          </div>
        )}

        {/* Tab Content 2: Spending Cube Transactions Data Table */}
        {drilldownTab === 'transactions' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Daftar Transaksi PO Mentah (SpendCube Rows)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan {tableFilteredRecords.length} transaksi yang memenuhi kriteria filter preset
                </p>
              </div>

              <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari item, vendor, RS, atau PO..."
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setTablePage(1);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-semibold">
                  <span>Baris per halaman:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setTablePage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">PO Number</th>
                    <th className="py-3 px-3.5">Tanggal</th>
                    <th className="py-3 px-3.5">Unit RS</th>
                    <th className="py-3 px-3.5">Vendor Pemasok</th>
                    <th className="py-3 px-3.5">Deskripsi Item Barang</th>
                    <th className="py-3 px-3.5 text-right">Qty</th>
                    <th className="py-3 px-3.5 text-right">Harga Satuan</th>
                    <th className="py-3 px-3.5 text-right">Total Nilai Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {paginatedTableRecords.length > 0 ? (
                    paginatedTableRecords.map((r, idx) => (
                      <tr 
                        key={r.id || idx}
                        onClick={() => onSelectRecord(r)}
                        className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3.5 font-mono text-blue-700 font-semibold">
                          {r.purchId || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {r.createdDate || r.monthYear || '-'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-700 text-[11px]">
                            {r.hospitalCode || 'HO'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-slate-900 max-w-[180px] truncate" title={r.vendorName}>
                          {r.vendorName || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-800 max-w-[240px] truncate" title={r.itemName || r.purchReqName}>
                          {r.itemName || r.purchReqName || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                          {Number(r.purchQty || 0).toLocaleString('id-ID')} {r.purchUnit || ''}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                          {formatIDR(r.purchPrice)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                          {formatIDR(r.totalLineAmount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Tidak ada baris data transaksi yang cocok dengan kriteria pencarian tabel ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
              <span>
                Menampilkan {(tablePage - 1) * pageSize + 1} - {Math.min(tablePage * pageSize, tableFilteredRecords.length)} dari {tableFilteredRecords.length} baris
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono font-bold text-slate-700">
                  Halaman {tablePage} dari {totalTablePages}
                </span>
                <button
                  type="button"
                  disabled={tablePage >= totalTablePages}
                  onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Filter Conditions Builder */}
        {drilldownTab === 'conditions' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span>Editor Kartu Kondisi Filter</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modifikasi kriteria multi-kelompok untuk mengubah cakupan transaksi secara langsung (0ms latency).
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSaveDrilldownChanges}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan Perubahan Preset</span>
                  </button>
                </div>
              </div>

              {/* Title and Description Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Preset</label>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => {
                      setEditingTitle(e.target.value);
                      setIsEditingPresetCards(true);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Tujuan Filter</label>
                  <input
                    type="text"
                    value={editingDescription}
                    onChange={(e) => {
                      setEditingDescription(e.target.value);
                      setIsEditingPresetCards(true);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Filter Cards Builder */}
              <ManualFilterCardsBuilder
                cards={activeDrilldownCards}
                onChange={(updated) => {
                  setEditingCards(updated);
                  setIsEditingPresetCards(true);
                }}
                matchedCount={drilldownMatchedRecords.length}
                totalRecordsCount={records.length}
              />
            </div>
          </div>
        )}

        {/* Tab Content 4: Executive AI Narrative */}
        {drilldownTab === 'narrative' && selectedDrilldownPreset.narrativeInsight && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 text-purple-700 border-b border-slate-100 pb-3">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-bold">Narasi Wawasan Eksekutif yang Tersimpan</h3>
            </div>

            <div className="bg-purple-50/30 p-6 rounded-xl border border-purple-100 shadow-2xs bg-white">
              <MarkdownRenderer content={selectedDrilldownPreset.narrativeInsight} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== RENDER: MAIN AI QUERY HUB VIEW ====================
  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Top Banner & Hub Navigation Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold mb-2">
                <BrainCircuit className="w-4 h-4 text-blue-400 animate-pulse" />
                <span>AI Query Hub & Presets Intelligence</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                AI Query Hub & Preset Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100/80 mt-1 max-w-2xl leading-relaxed">
                Pusat terpadu pencarian analisis natural language AI, discovery vektor SKU, serta katalog preset filter kueri transaksi Siloam Hospitals.
              </p>
            </div>

            {/* Quick Stats Widget */}
            <div className="flex items-center space-x-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/80 shrink-0">
              <div className="text-center px-3 border-r border-slate-700">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Presets</span>
                <span className="text-base font-extrabold font-mono text-white">{presets.length}</span>
              </div>
              <div className="text-center px-3">
                <span className="text-[10px] text-slate-400 block font-semibold">Indexed SKUs</span>
                <span className="text-base font-extrabold font-mono text-emerald-400">{skuMasters.length}</span>
              </div>
            </div>
          </div>

          {/* Primary Top Hub Tab Switcher */}
          <div className="flex items-center space-x-2 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/90 w-fit">
            <button
              type="button"
              onClick={() => setHubMode('studio')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                hubMode === 'studio'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI & Vector Query Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setHubMode('presets_list')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                hubMode === 'presets_list'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Katalog Saved Presets ({presets.length})</span>
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-900 text-xs shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{notification}</span>
        </div>
      )}

      {presetSavedMsg && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-blue-900 text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="font-bold">{presetSavedMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setHubMode('presets_list')}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors shrink-0 ml-3"
          >
            Buka Katalog Presets →
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: AI & VECTOR QUERY STUDIO
      ========================================================================= */}
      {hubMode === 'studio' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Query Search Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                <Search className="w-4 h-4 text-blue-600" />
                <span>Ketik Pertanyaan atau Kriteria Analisis Pengadaan</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {records.length.toLocaleString('id-ID')} Database Transaksi Siap
              </span>
            </div>

            {/* Input and Ask Button */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <div className="relative flex-1">
                  <input
                    ref={queryInputRef}
                    type="text"
                    placeholder="Contoh: Berapa pembelian kertas di jabotabek yang bukan cetak dan diatas 70gr..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecutePipeline()}
                    className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                  />
                  {userQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserQuery('');
                        setPipelineResult(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Hapus kueri"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={loading || !userQuery.trim()}
                  onClick={() => handleExecutePipeline()}
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-500/20 shrink-0 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analisis dengan AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Notice when prompt is loaded into input for review/editing */}
              {loadPromptNotice && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-150 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{loadPromptNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoadPromptNotice(null)}
                    className="text-blue-500 hover:text-blue-800 p-0.5 cursor-pointer"
                    title="Tutup pemberitahuan"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Common Suggestion Bubbles / Pills (Hidden when pipelineResult appears to eliminate visual clutter) */}
            {!pipelineResult && (
              <div className="space-y-3 pt-3 border-t border-slate-100 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Contoh pertanyaan:</span>
                  </div>

                  {queryHistory.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowHistory(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          showHistory
                            ? 'bg-blue-100 text-blue-800'
                            : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>{showHistory ? 'Lihat Contoh Pertanyaan' : `Riwayat Pertanyaan (${queryHistory.length})`}</span>
                      </button>

                      {showHistory && (
                        <button
                          type="button"
                          onClick={handleClearAllHistory}
                          className="text-[11px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-0.5 cursor-pointer ml-1"
                          title="Hapus semua riwayat"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {showHistory && queryHistory.length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                    {queryHistory.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectPromptForEdit(item.query)}
                        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 transition-all cursor-pointer shadow-2xs text-left"
                        title="Klik untuk menyalin ke kolom input"
                      >
                        <Clock className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0" />
                        <span className="truncate max-w-xs sm:max-w-md">{item.query}</span>
                        <CornerDownRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0" />
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 ml-0.5 cursor-pointer"
                          title="Hapus dari riwayat"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_PROMPTS.map((promptText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPromptForEdit(promptText)}
                        className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-700 bg-slate-100/80 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200/80 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99] text-left"
                        title="Klik untuk memasukkan ke kolom input (edit dahulu sebelum analisis)"
                      >
                        <span className="leading-relaxed">{promptText}</span>
                        <CornerDownRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Processing Indicator */}
          {loading && (
            <div className="bg-slate-900 border border-blue-500/50 rounded-3xl p-5 flex items-center space-x-4 text-blue-200 shadow-xl shadow-blue-500/10 animate-pulse">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin shrink-0" />
              <div className="space-y-1">
                <p className="font-extrabold text-white text-sm">
                  Menjalankan 4-Stage Agentic Spend Pipeline...
                </p>
                <p className="text-xs text-slate-300">
                  Tahap 1: Intent & Istilah &bull; Tahap 2: Item & Taksonomi &bull; Tahap 3: Pembentukan Multi-Kartu Filter (Logika OR) &bull; Tahap 4: Agregasi & Sintesis Narasi Eksekutif
                </p>
              </div>
            </div>
          )}

          {/* PIPELINE EXECUTION RESULTS */}
          {pipelineResult && (
            <div className="space-y-6">
              {/* Result Summary Bar */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-3xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Hasil Filter Reaktif
                    </span>
                    <span className="text-xs text-blue-200 font-mono">
                      Waktu Hitung: {pipelineResult.aggregatedStats.executionTimeMs.toFixed(1)}ms
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    {pipelineResult.query}
                  </h3>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center flex-wrap gap-y-2">
                  <button
                    type="button"
                    onClick={() => handleOpenConvertToSavedSearch(pipelineResult.matchedRecords, pipelineResult.query)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm"
                    title="Ambil seluruh nama item/SKU yang masuk ke kueri ini lalu convert menjadi Saved Search atau tambahkan ke Saved Search yang sudah ada"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Convert ke Saved Search SKU</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAsPreset}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Simpan ke Preset</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      exportSpendRecordsToCsv(pipelineResult.matchedRecords, `AI_Query_${Date.now()}`);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPipelineResult(null);
                      setUserQuery('');
                      setActiveFilterCards([]);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all cursor-pointer"
                    title="Mulai kueri baru dan tampilkan kembali saran pertanyaan"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Kueri Baru</span>
                  </button>
                </div>
              </div>

              {/* Sub-Tabs for AI Studio */}
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStudioActiveTab('visual_dashboard')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    studioActiveTab === 'visual_dashboard'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Visual Dashboard & Treemap</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudioActiveTab('triage_inspector')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    studioActiveTab === 'triage_inspector'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Editor Kartu Filter ({activeFilterCards.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudioActiveTab('transactions_table')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    studioActiveTab === 'transactions_table'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Baris Transaksi ({pipelineResult.matchedRecords.length})</span>
                </button>
              </div>

              {/* Studio Tab 1: Live Dashboard */}
              {studioActiveTab === 'visual_dashboard' && (
                <div className="space-y-6">
                  {/* AI Narrative Section */}
                  {pipelineResult.narrativeResponse && (
                    <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span>Narasi Wawasan Eksekutif AI (Context-Grounding)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pipelineResult.narrativeResponse);
                            setCopiedNarrative(true);
                            setTimeout(() => setCopiedNarrative(false), 2000);
                          }}
                          className="inline-flex items-center space-x-1 text-[11px] font-semibold text-purple-700 bg-white border border-purple-200 px-2.5 py-1 rounded-lg hover:bg-purple-100 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedNarrative ? 'Tersalin!' : 'Salin Narasi'}</span>
                        </button>
                      </div>

                      <div className="bg-white/95 p-5 rounded-xl border border-purple-100 shadow-2xs">
                        <MarkdownRenderer content={pipelineResult.narrativeResponse} />
                      </div>
                    </div>
                  )}

                  {/* Filtered Data Dashboard */}
                  <FilteredDataDashboard
                    stats={pipelineResult.aggregatedStats}
                    matchedRecords={pipelineResult.matchedRecords}
                    queryTitle={pipelineResult.query}
                    activeCardsCount={activeFilterCards.length}
                    onSelectRecord={onSelectRecord}
                  />
                </div>
              )}

              {/* Studio Tab 2: Filter Cards Builder & Triage */}
              {studioActiveTab === 'triage_inspector' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                          <span>Multi-Card Filter Builder (Live Logic)</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Atur kondisi inklusi dan eksklusi. Logika <strong>OR</strong> antar-kartu dan <strong>AND</strong> antar-field dievaluasi instan.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleTriggerAiAudit}
                        disabled={isAuditing}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-bold transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                        <span>{isAuditing ? 'Auditing Relevance...' : 'AI Semantic Audit'}</span>
                      </button>
                    </div>

                    {/* AI Audit Recommendations Alert if triggered */}
                    {auditResult && (
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs text-purple-900 font-bold">
                          <span>Audit Relevansi AI: Ditemukan {auditResult.recommendedExclusions?.length || 0} Kata Eksklusi</span>
                          {auditResult.recommendedExclusions?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleApplyAllRecommendedExclusions(auditResult.recommendedExclusions)}
                              className="px-2.5 py-1 bg-purple-700 text-white rounded-lg text-[11px] font-bold hover:bg-purple-800"
                            >
                              Terapkan Semua Eksklusi
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-purple-700">{auditResult.relevanceExplanation}</p>
                      </div>
                    )}

                    {/* 4-Step AI Query Hub Architecture Inspector */}
                    <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center space-x-2">
                          <BrainCircuit className="w-5 h-5 text-blue-400" />
                          <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                            Arsitektur AI Query Hub 4-Tahap (Execution Inspector)
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                          Gemini 3.8 Flash + Local Math Core
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* Step 1 */}
                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-400 font-mono">TAHAP 1: INTENT & ISTILAH</span>
                            <span className="text-[9px] text-slate-400">Gemini Flash</span>
                          </div>
                          <p className="text-[11px] text-slate-200 font-semibold truncate">
                            Produk: <strong className="text-amber-300">{pipelineResult.agenticTrace?.stage1?.primaryProductName || pipelineResult.parsedFilter.product_keywords?.include?.[0] || 'Katalog'}</strong>
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(pipelineResult.agenticTrace?.stage1?.productSynonyms || pipelineResult.triageResult?.product_keywords?.include || []).slice(0, 4).map((kw: string, i: number) => (
                              <span key={i} className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                                {kw}
                              </span>
                            ))}
                          </div>
                          {pipelineResult.agenticTrace?.stage1?.groupingCandidates?.length > 0 && (
                            <p className="text-[9px] text-slate-400 truncate">
                              Grouping: {pipelineResult.agenticTrace.stage1.groupingCandidates.slice(0, 2).join(', ')}
                            </p>
                          )}
                        </div>

                        {/* Step 2 */}
                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-cyan-400 font-mono">TAHAP 2: ITEM & TAXONOMY</span>
                            <span className="text-[9px] text-slate-400">Role & Period</span>
                          </div>
                          <p className="text-[11px] text-slate-200 font-semibold">
                            Role: <span className="text-cyan-300 font-mono text-[10px]">{pipelineResult.agenticTrace?.stage2?.taxonomyDecision?.role || 'SEARCH_CONTEXT'}</span>
                          </p>
                          <p className="text-[10px] text-slate-300">
                            Periode: <strong className="text-white font-mono">{pipelineResult.agenticTrace?.stage2?.periodFilter?.months?.join(', ') || 'Semua'}</strong>
                          </p>
                          <p className="text-[10px] text-slate-300">
                            Struktur: <strong className="text-cyan-300 font-mono">{activeFilterCards.length} Kartu</strong> (Logika OR)
                          </p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-400 font-mono">TAHAP 3: PIHAK & LOKASI</span>
                            <span className="text-[9px] text-slate-400 font-mono">4 Dimensi</span>
                          </div>
                          <p className="text-[11px] text-slate-200 font-semibold truncate">
                            RS: <strong className="text-emerald-300">{pipelineResult.agenticTrace?.stage3?.partiesFilters?.hospitalCodes?.join(', ') || 'Seluruh Unit'}</strong>
                          </p>
                          <p className="text-[10px] text-slate-300 truncate" title={pipelineResult.agenticTrace?.stage3?.dimensionRoles?.whoPurchased}>
                            Pihak: <span className="text-emerald-200">{pipelineResult.agenticTrace?.stage3?.dimensionRoles?.whoPurchased || 'Rumah Sakit & Dept'}</span>
                          </p>
                          <p className="text-[10px] text-slate-300 truncate">
                            Vendor: <span className="text-slate-200">{pipelineResult.agenticTrace?.stage3?.partiesFilters?.vendorNames?.join(', ') || 'Seluruh Rekanan'}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            Status: <span className="text-emerald-400 font-semibold">{pipelineResult.agenticTrace?.stage3?.ambiguityStatus?.status || 'FOUND'}</span>
                          </p>
                        </div>

                        {/* Step 4 */}
                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-purple-400 font-mono">TAHAP 4: HASIL & NARASI</span>
                            <span className="text-[9px] text-slate-400">Executive</span>
                          </div>
                          <p className="text-[11px] text-slate-200 font-semibold truncate">
                            PO: <strong className="text-white font-mono">{pipelineResult.aggregatedStats.distinctPoCount || 0}</strong> ({pipelineResult.matchedRecords.length} rows)
                          </p>
                          <p className="text-[10px] text-slate-300 truncate">
                            Winner: <strong className="text-purple-300">{pipelineResult.aggregatedStats.topVendorRanked?.winner?.vendorName || '-'}</strong>
                          </p>
                          <p className="text-[10px] text-emerald-400 font-mono font-bold">
                            Rp {(pipelineResult.aggregatedStats.totalSpend / 1e6).toFixed(1)} Juta
                          </p>
                        </div>
                      </div>
                    </div>

                    <ManualFilterCardsBuilder
                      cards={activeFilterCards}
                      onChange={handleCardsChange}
                      matchedCount={pipelineResult.matchedRecords.length}
                      totalRecordsCount={records.length}
                    />
                  </div>
                </div>
              )}

              {/* Studio Tab 3: Transactions Table */}
              {studioActiveTab === 'transactions_table' && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Baris Transaksi Hasil Filter ({pipelineResult.matchedRecords.length})
                      </h3>
                      <p className="text-xs text-slate-500">Klik pada baris untuk melihat audit benchmark dan rincian lengkap</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => exportSpendRecordsToCsv(pipelineResult.matchedRecords, `Query_Export_${Date.now()}`)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">PO Number</th>
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3">RS Unit</th>
                          <th className="py-2.5 px-3">Vendor</th>
                          <th className="py-2.5 px-3">Nama Item</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                          <th className="py-2.5 px-3 text-right">Harga</th>
                          <th className="py-2.5 px-3 text-right">Total Spend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pipelineResult.matchedRecords.slice(0, 50).map((r, i) => (
                          <tr
                            key={r.id || i}
                            onClick={() => onSelectRecord(r)}
                            className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                          >
                            <td className="py-2 px-3 font-mono text-blue-700 font-semibold">{r.purchId || '-'}</td>
                            <td className="py-2 px-3 text-slate-600">{r.createdDate || r.monthYear || '-'}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-700">{r.hospitalCode || '-'}</td>
                            <td className="py-2 px-3 font-medium text-slate-900 max-w-[150px] truncate">{r.vendorName || '-'}</td>
                            <td className="py-2 px-3 text-slate-800 max-w-[200px] truncate">{r.itemName || r.purchReqName || '-'}</td>
                            <td className="py-2 px-3 text-right font-mono">{r.purchQty?.toLocaleString('id-ID')}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatIDR(r.purchPrice)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatIDR(r.totalLineAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 2: SAVED PRESETS CATALOG (LIST VIEW WITH FULLSCREEN ACTION)
      ========================================================================= */}
      {hubMode === 'presets_list' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Presets List Header Toolbar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <BookmarkCheck className="w-5 h-5 text-blue-600" />
                  <span>Katalog Saved Presets & Template Analisis</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik pada preset untuk membuka <strong>Full-Screen Drilldown Workspace</strong> yang lengkap dengan Treemap Taksonomi dan Transaksi SpendCube.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="relative w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari preset kueri tersimpan..."
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHubMode('studio');
                    setUserQuery('');
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Kueri Baru</span>
                </button>
              </div>
            </div>

            {/* Presets List Container */}
            <div className="space-y-3 pt-2">
              {filteredPresetsList.length > 0 ? (
                filteredPresetsList.map((preset) => {
                  const cardsCount = preset.filterCards?.length || 1;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleOpenPresetDrilldown(preset)}
                      className="bg-white hover:bg-blue-50/40 p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-xs cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Preset Info */}
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold font-mono">
                            {cardsCount} Kelompok Kartu Filter
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 inline mr-1" />
                            <span>{new Date(preset.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          </span>
                          {preset.parsedFilter?.search_intent && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium truncate max-w-xs">
                              {preset.parsedFilter.search_intent}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {preset.title}
                          </h4>
                          {preset.description && (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {preset.description}
                            </p>
                          )}
                        </div>

                        {/* Query Preview */}
                        <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-500">Query Asli:</span>
                          <span className="italic text-slate-600 truncate max-w-lg">"{preset.originalUserQuery}"</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 shrink-0 self-end md:self-center flex-wrap gap-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const matched = records.filter(r => evaluateSpendRecordAgainstCards(r, preset.filterCards || []));
                            handleOpenConvertToSavedSearch(matched, preset.title);
                          }}
                          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all"
                          title="Ambil seluruh SKU yang masuk ke preset ini dan simpan sebagai Saved Search"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Convert ke SKU Search</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPresetDrilldown(preset)}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm group-hover:shadow-blue-500/20"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Buka Drilldown Full-Screen</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDuplicatePreset(preset, e)}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                          title="Duplikasi Preset"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Hapus Preset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-slate-500 text-xs font-medium">
                    {presetSearch ? 'Tidak ada preset yang cocok dengan pencarian.' : 'Belum ada preset kueri yang disimpan.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHubMode('studio')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Preset Baru di AI Studio</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert AI Query Results to e-Catalogue Saved Search Modal */}
      <ConvertAiQueryToSavedSearchModal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        query={queryTitleToConvert}
        matchedRecords={recordsToConvert}
        skuMasters={skuMasters}
        onNavigateToCatalogue={() => {
          if (onNavigateToTab) {
            onNavigateToTab('eCatalogueSearch');
          }
        }}
        onSuccess={(preset, mode) => {
          setNotification(
            mode === 'new'
              ? `Saved Search baru "${preset.title}" (${preset.selectedProductIds?.length || 0} SKU) berhasil disimpan ke e-Catalogue.`
              : `SKU berhasil ditambahkan ke Saved Search "${preset.title}". Total sekarang: ${preset.selectedProductIds?.length || 0} SKU.`
          );
          setTimeout(() => setNotification(null), 5000);
        }}
      />
    </div>
  );
};
