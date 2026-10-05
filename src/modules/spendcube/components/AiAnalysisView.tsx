import React, { useState, useMemo, useEffect } from 'react';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  ManualFilterCard, 
  SavedAiQueryPreset, 
  ParsedQueryFilter, 
  QueryPipelineResult,
  CandidateTriageResult,
  CandidateTriageDecision
} from '../../../core/types/spend';
import { vectorService } from '../services/vectorService';
import { queryPipelineService, SemanticAuditResult } from '../services/queryPipelineService';
import { saveSavedQueryPreset } from '../../../core/db/db';
import { ManualFilterCardsBuilder } from './ManualFilterCardsBuilder';
import { FilteredDataDashboard } from './FilteredDataDashboard';
import { exportSpendRecordsToCsv, exportSpendRecordsToJson } from '../services/dataExportService';
import { 
  Sparkles, BrainCircuit, Search, Database, ArrowRight, CheckCircle2, ShieldAlert, 
  Cpu, Filter, Layers, DollarSign, BookmarkCheck, BarChart3, TrendingUp, 
  Building2, Package, Tag, Clock, ChevronRight, Copy, RefreshCw, XCircle, FileSpreadsheet,
  AlertTriangle, Check, Plus, X, EyeOff, ShieldCheck, SlidersHorizontal, CheckSquare,
  HelpCircle, Split, ListFilter, CornerDownRight, ArrowDownRight, Edit3, Download, FileText
} from 'lucide-react';

interface AiAnalysisViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  onSelectRecord: (record: SpendRecord) => void;
}

export const AiAnalysisView: React.FC<AiAnalysisViewProps> = ({
  records,
  skuMasters,
  onSelectRecord
}) => {
  const [userQuery, setUserQuery] = useState('');
  const [pipelineResult, setPipelineResult] = useState<QueryPipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState<'visual_dashboard' | 'triage_inspector' | 'pipeline_overview' | 'transactions_table' | 'vector_skus' | 'architecture_diagram'>('visual_dashboard');
  
  // Active Filter Cards State (Multi-card with OR logic across cards, AND within fields)
  const [activeFilterCards, setActiveFilterCards] = useState<ManualFilterCard[]>([]);
  const [isBuilderExpanded, setIsBuilderExpanded] = useState(false);

  // Notification & preset saved state
  const [presetSavedMsg, setPresetSavedMsg] = useState<string | null>(null);
  const [copiedNarrative, setCopiedNarrative] = useState(false);
  const [indexStats, setIndexStats] = useState<{ newlyGenerated: number; reusedFromCache: number } | null>(null);

  // AI Semantic Relevance Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<SemanticAuditResult | null>(null);
  const [customExcludeInput, setCustomExcludeInput] = useState('');

  // Suggested prompt pills
  const samplePrompts = [
    "Berapa pembelian kertas di jabotabek yang bukan kertas cetak tapi kertas polos saja yang diatas 70 gr",
    "Berapa banyak penggunaan kertas di shlv selama 2026",
    "Berapa total spend untuk alat kesehatan dan obat di Siloam Hospitals?",
    "Cari transaksi pengeluaran CAPEX tertinggi untuk MRI atau CT Scan",
    "Analisis vendor farmasi dengan nilai transaksi terbesar di SHKJ"
  ];

  // Initialize vector indexing asynchronously in the background so screen renders instantly
  useEffect(() => {
    if (skuMasters.length > 0) {
      const timer = setTimeout(() => {
        const stats = vectorService.indexSkuMasters(skuMasters);
        setIndexStats(stats);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [skuMasters]);

  // Execute the Two-Stage Query-to-Filter Translation Pipeline
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
      // Execute 2-Stage Pipeline (Discovery + AI Triage + Local Math Engine + Narrative Synthesis)
      const result = await queryPipelineService.runTwoStagePipeline(q, records, skuMasters);
      setPipelineResult(result);

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

  // Handle live modification of Filter Cards (0ms local re-evaluation)
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

  // Trigger AI Semantic Audit to find and eliminate false positives
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

  // Add a specific keyword to Exclude list across active cards and recalculate instantly
  const handleApplyExclusionKeyword = (keywordToExclude: string) => {
    if (!pipelineResult) return;
    const kw = keywordToExclude.trim().toLowerCase();
    if (!kw) return;

    // Apply to first card or all cards commodity/product field
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

  // Remove an exclusion keyword from all active cards
  const handleRemoveExclusionKeyword = (keywordToRemove: string) => {
    if (!pipelineResult) return;
    const kw = keywordToRemove.trim().toLowerCase();

    const updatedCards = activeFilterCards.map(card => {
      const currentComm = card.commodity_l5 || card.commodity_remark_product;
      if (!currentComm) return card;

      return {
        ...card,
        commodity_l5: {
          include: currentComm.include || [],
          exclude: (currentComm.exclude || []).filter(e => e.toLowerCase() !== kw)
        }
      };
    });

    handleCardsChange(updatedCards);
  };

  // Apply all recommended exclusions from AI
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

  // 1-Click Save as Preset
  const handleSaveAsPreset = async () => {
    if (!pipelineResult) return;

    const cardsToSave = activeFilterCards.length > 0 ? activeFilterCards : (pipelineResult.filterCards || []);

    const preset: SavedAiQueryPreset = {
      id: `preset_${Date.now()}`,
      title: pipelineResult.query.slice(0, 60) + (pipelineResult.query.length > 60 ? '...' : ''),
      description: `Saved Query: ${pipelineResult.triageResult?.search_intent || pipelineResult.parsedFilter.search_intent}`,
      originalUserQuery: pipelineResult.query,
      filterCards: cardsToSave,
      parsedFilter: pipelineResult.parsedFilter,
      narrativeInsight: pipelineResult.narrativeResponse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveSavedQueryPreset(preset);
    setPresetSavedMsg('Preset berhasil disimpan ke database! Anda dapat menggunakannya kembali di menu "Saved Queries & Presets" untuk perbandingan Apple-to-Apple.');
    setTimeout(() => setPresetSavedMsg(null), 5000);
  };

  // Export Filtered Raw Data for Excel Analysis
  const handleExportFilteredCsv = () => {
    if (!pipelineResult || pipelineResult.matchedRecords.length === 0) {
      alert('Tidak ada transaksi hasil filter yang dapat diexport.');
      return;
    }
    const safeTitle = (pipelineResult.query || 'SpendCube_Query')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 30);
    exportSpendRecordsToCsv(pipelineResult.matchedRecords, `Siloam_QueriedSpend_${safeTitle}`);
  };

  const handleExportFilteredJson = () => {
    if (!pipelineResult || pipelineResult.matchedRecords.length === 0) {
      alert('Tidak ada transaksi hasil filter yang dapat diexport.');
      return;
    }
    const safeTitle = (pipelineResult.query || 'SpendCube_Query')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 30);
    exportSpendRecordsToJson(pipelineResult.matchedRecords, `Siloam_QueriedSpend_${safeTitle}`);
  };

  const handleCopyNarrative = () => {
    if (!pipelineResult?.narrativeResponse) return;
    navigator.clipboard.writeText(pipelineResult.narrativeResponse);
    setCopiedNarrative(true);
    setTimeout(() => setCopiedNarrative(false), 2500);
  };

  // Vector search results based on query or extracted keywords (lazy, filtered by active excludes)
  const vectorSkuResults = useMemo(() => {
    if (!skuMasters.length) return [];
    const queryTerm = pipelineResult?.parsedFilter?.product_keywords?.include?.[0] || pipelineResult?.query || userQuery.trim();
    if (!queryTerm) return [];
    
    // Extract active excludes from cards
    const cardExcludes: string[] = [];
    activeFilterCards.forEach(c => {
      if (c.commodity_l5?.exclude) cardExcludes.push(...c.commodity_l5.exclude);
      if (c.commodity_remark_product?.exclude) cardExcludes.push(...c.commodity_remark_product.exclude);
      if (c.item_specification?.exclude) cardExcludes.push(...c.item_specification.exclude);
    });

    return vectorService.searchSkusSemantic(queryTerm, skuMasters, 12, cardExcludes);
  }, [pipelineResult, userQuery, skuMasters, activeFilterCards]);

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  // Calculate potential false positive suggestions from query and AI result
  const falsePositiveCandidates = useMemo(() => {
    if (!pipelineResult) return [];
    
    const currentExcludes = new Set<string>();
    activeFilterCards.forEach(c => {
      (c.commodity_l5?.exclude || []).forEach(e => currentExcludes.add(e.toLowerCase()));
      (c.commodity_remark_product?.exclude || []).forEach(e => currentExcludes.add(e.toLowerCase()));
      (c.item_specification?.exclude || []).forEach(e => currentExcludes.add(e.toLowerCase()));
    });

    const suggestions: string[] = [];

    // From Triage decisions (EXCLUDE)
    if (pipelineResult.triageResult?.candidateDecisions) {
      pipelineResult.triageResult.candidateDecisions
        .filter(d => d.decision === 'EXCLUDE')
        .forEach(d => {
          if (!currentExcludes.has(d.candidate.toLowerCase()) && !suggestions.includes(d.candidate)) {
            suggestions.push(d.candidate);
          }
        });
    }

    // From AI pipeline result
    if (pipelineResult.parsedFilter.suggested_false_positives) {
      pipelineResult.parsedFilter.suggested_false_positives.forEach(fp => {
        if (!currentExcludes.has(fp.toLowerCase()) && !suggestions.includes(fp)) suggestions.push(fp);
      });
    }

    // From Audit Result
    if (auditResult?.recommendedExclusions) {
      auditResult.recommendedExclusions.forEach(fp => {
        if (!currentExcludes.has(fp.toLowerCase()) && !suggestions.includes(fp)) suggestions.push(fp);
      });
    }

    // Domain heuristic suggestions for "kertas"
    const q = pipelineResult.query.toLowerCase();
    if (q.includes('kertas') || q.includes('paper')) {
      const defaultPaperFPs = ['cup', 'paper cup', 'sampling cup', 'paper bag', 'tissue', 'paper towel', 'paper clip', 'box', 'lakmus'];
      defaultPaperFPs.forEach(fp => {
        if (!currentExcludes.has(fp) && !suggestions.includes(fp)) {
          suggestions.push(fp);
        }
      });
    }

    return suggestions;
  }, [pipelineResult, auditResult, activeFilterCards]);

  // Aggregate all active exclusions across active cards
  const allActiveExcludes = useMemo(() => {
    const set = new Set<string>();
    activeFilterCards.forEach(c => {
      (c.commodity_l5?.exclude || []).forEach(e => set.add(e));
      (c.commodity_remark_product?.exclude || []).forEach(e => set.add(e));
      (c.item_specification?.exclude || []).forEach(e => set.add(e));
    });
    return Array.from(set);
  }, [activeFilterCards]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold mb-3">
            <BrainCircuit className="w-4 h-4 text-blue-400 animate-pulse" />
            <span>Two-Stage Hybrid Semantic AI Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">AI Spend Intelligence & Copilot</h1>
          <p className="text-xs sm:text-sm text-blue-100/80 mt-2 leading-relaxed">
            Menghubungkan bahasa alami dengan database lokal melalui 4 tahap: <strong>1. Penemuan Kandidat Semantik</strong> &rarr; <strong>2. AI Triage & Struktur Card Multi-Kondisi (OR Logic)</strong> &rarr; <strong>3. Eksekusi Database Lokal & Math 100% Presisi</strong> &rarr; <strong>4. Sintesis Laporan Eksekutif</strong>.
          </p>

          {indexStats && (
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 px-3 py-1 rounded-xl font-medium flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>SKU Master Vector DB Active</span>
              </span>
              <span className="bg-white/10 px-3 py-1 rounded-xl text-blue-100 font-mono">
                {indexStats.newlyGenerated} Indexed
              </span>
              <span className="bg-emerald-500/25 px-3 py-1 rounded-xl text-emerald-200 font-mono font-bold">
                ⚡ {indexStats.reusedFromCache} Reused from Cache (0 Token Cost)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Query Bar & Suggestions */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="e.g. Berapa pembelian kertas di jabotabek yang bukan kertas cetak tapi kertas polos saja yang diatas 70 gr"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecutePipeline()}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>
          <button
            type="button"
            disabled={loading || !userQuery.trim()}
            onClick={() => handleExecutePipeline()}
            className="inline-flex items-center justify-center space-x-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Menjalankan 2-Stage Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analisis AI</span>
              </>
            )}
          </button>
        </div>

        {/* Suggested prompt pills (Hidden when pipelineResult appears) */}
        {!pipelineResult && (
          <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-150">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-500" />
              <span>Contoh Kueri:</span>
            </span>
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setUserQuery(prompt);
                  const inputEl = document.querySelector('input[placeholder*="Berapa pembelian kertas"]') as HTMLInputElement;
                  if (inputEl) {
                    inputEl.focus();
                    inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="group inline-flex items-center gap-1.5 text-xs bg-slate-100/80 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 px-3.5 py-1.5 rounded-full border border-slate-200/80 transition-all font-medium text-left cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
                title="Klik untuk memuat ke input dan sesuaikan kueri"
              >
                <span>{prompt}</span>
                <CornerDownRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {presetSavedMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{presetSavedMsg}</span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-emerald-200/60 px-2 py-0.5 rounded text-emerald-800">Tersimpan</span>
        </div>
      )}

      {/* 2-Stage Pipeline Result Display */}
      {pipelineResult && (
        <div className="space-y-6">
          {/* STEP 1 & STEP 2: Live Architecture Pipeline Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1 & 2 Box: Two-Stage Triage & Filter Cards Summary */}
            <div className="bg-white rounded-2xl p-5 border border-blue-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1 & 2</span>
                  <span>Two-Stage AI Discovery & Triage Engine</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {activeFilterCards.length} Filter Card(s) Active [OR Logic]
                </span>
              </div>

              <p className="text-xs font-medium text-slate-700 italic">
                "{pipelineResult.triageResult?.search_intent || pipelineResult.parsedFilter.search_intent}"
              </p>

              {/* Dynamic Field Targeting Summary */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Target Dimensi Relevan (Dynamic Selection):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(pipelineResult.triageResult?.relevantFieldsTargeted || ['commodity_l5', 'item_specification']).map((fieldKey, idx) => (
                      <span key={idx} className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-lg text-[11px] font-semibold">
                        🎯 {fieldKey}
                      </span>
                    ))}
                    {(!pipelineResult.triageResult?.relevantFieldsTargeted?.includes('brand_name')) && (
                      <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px]">
                        Brand: Ditinggalkan (Hemat Token)
                      </span>
                    )}
                    {(!pipelineResult.triageResult?.relevantFieldsTargeted?.includes('vendor_name')) && (
                      <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px]">
                        Vendor: Ditinggalkan (Hemat Token)
                      </span>
                    )}
                  </div>
                </div>

                {/* Exclude Anti-False Positive Pills */}
                {allActiveExcludes.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Pencegah False Positive Aktif:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {allActiveExcludes.map((w, idx) => (
                        <span key={idx} className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium">
                          -{w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3 Box: Local DB Math Engine Results */}
            <div className="bg-white rounded-2xl p-5 border border-indigo-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Eksekusi Database Lokal & Math Engine</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  ⚡ {pipelineResult.aggregatedStats.executionTimeMs} ms (Zero Hallucination)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Spend</span>
                  <span className="font-extrabold text-blue-700 text-sm font-mono mt-0.5 block">
                    {formatIDR(pipelineResult.aggregatedStats.totalSpend)}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Volume</span>
                  <span className="font-extrabold text-slate-900 text-sm font-mono mt-0.5 block">
                    {pipelineResult.aggregatedStats.totalQuantity.toLocaleString('id-ID')} unit
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Transaksi (PO Lines)</span>
                  <span className="font-extrabold text-slate-900 text-sm font-mono mt-0.5 block">
                    {pipelineResult.aggregatedStats.totalTransactions} baris
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Bulan Puncak</span>
                  <span className="font-extrabold text-amber-700 text-xs font-mono mt-1 block truncate">
                    {pipelineResult.aggregatedStats.peakMonth?.month || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 flex items-center justify-between">
                <span>Data diproses instan dari <strong>{pipelineResult.aggregatedStats.scannedRecordsCount.toLocaleString()}</strong> transaksi menggunakan evaluasi Card OR/AND lokal.</span>
              </div>
            </div>
          </div>

          {/* AI Semantic Relevance & False-Positive Elimination Panel */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span>Pencegahan False Positive & Audit Relevansi Semantik</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      Zero-Spill Guard
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Membedakan Komoditas Inti vs Spesifikasi Bahan (misal: <em>Sampling Cup</em> berbahan <em>Paper</em> tidak dihitung sebagai Kertas ATK)
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  disabled={isAuditing}
                  onClick={handleTriggerAiAudit}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
                >
                  {isAuditing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></div>
                      <span>Sedang Memindai...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Audit False-Positive AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Audit Insight Feedback if available */}
            {auditResult && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900 animate-in fade-in">
                <div className="flex items-center space-x-2 font-bold text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Hasil Audit AI: Target Komoditas "{auditResult.targetCommodity}"</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">{auditResult.relevanceExplanation}</p>
                
                {auditResult.irrelevantItems.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">Item yang Teridentifikasi Tidak Relevan:</span>
                    <div className="space-y-1">
                      {auditResult.irrelevantItems.map((irr, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white/80 p-1.5 px-2.5 rounded-lg border border-amber-200 text-[11px]">
                          <span className="font-semibold text-slate-800">{irr.itemName}</span>
                          <span className="text-[10px] text-rose-600 font-medium italic">{irr.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Exclusions & Candidates */}
            <div className="space-y-3">
              {/* Currently Active Excluded Keywords */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Kata Kunci yang Sedang Dikecualikan ({allActiveExcludes.length}):
                  </span>
                  <span className="text-[10px] text-slate-400">Otomatis didiskualifikasi dari perhitungan Spend</span>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center min-h-[32px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {allActiveExcludes.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">Belum ada kata kunci exclude aktif.</span>
                  ) : (
                    allActiveExcludes.map((w, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-mono font-medium"
                      >
                        <span>-{w}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExclusionKeyword(w)}
                          className="hover:bg-rose-200/60 p-0.5 rounded text-rose-500 hover:text-rose-900 transition-colors"
                          title="Hapus filter exclude ini"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Suggested Exclude Pills */}
              {falsePositiveCandidates.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Rekomendasi Exclude dari AI (Potensi False-Positive):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyAllRecommendedExclusions(falsePositiveCandidates)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                    >
                      + Terapkan Semua Rekomendasi ({falsePositiveCandidates.length})
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {falsePositiveCandidates.map((cand, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyExclusionKeyword(cand)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 hover:border-amber-300 rounded-lg text-xs font-medium transition-all group"
                      >
                        <Plus className="w-3 h-3 text-amber-600 group-hover:scale-125 transition-transform" />
                        <span>Exclude: <strong>{cand}</strong></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Custom Exclude Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Ketik kata kunci exclude manual (misal: bag, cup, lakmus) lalu tekan Enter..."
                  value={customExcludeInput}
                  onChange={(e) => setCustomExcludeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customExcludeInput.trim()) {
                      handleApplyExclusionKeyword(customExcludeInput.trim());
                      setCustomExcludeInput('');
                    }
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-400 focus:border-rose-400 font-medium"
                />
                <button
                  type="button"
                  disabled={!customExcludeInput.trim()}
                  onClick={() => {
                    if (customExcludeInput.trim()) {
                      handleApplyExclusionKeyword(customExcludeInput.trim());
                      setCustomExcludeInput('');
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shrink-0"
                >
                  + Tambah Exclude
                </button>
              </div>
            </div>
          </div>

          {/* STEP 4: Executive Narrative Response Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                    <h3 className="text-base font-bold text-slate-900">Laporan & Analisis Eksekutif AI</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Dirangkai dari data agregasi matematis yang terverifikasi</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyNarrative}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{copiedNarrative ? 'Tersalin!' : 'Salin Laporan'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAsPreset}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Simpan Sebagai Preset</span>
                </button>
              </div>
            </div>

            {/* Narrative Box */}
            <div className="prose prose-slate max-w-none text-sm text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 font-sans">
              {pipelineResult.narrativeResponse}
            </div>

            {/* Sub-Navigation Tabs for Deep Dive Breakdown & Export Options */}
            <div className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 gap-3 pb-2">
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setActiveTabMode('visual_dashboard')}
                    className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                      activeTabMode === 'visual_dashboard' 
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Visual Dashboard Kueri</span>
                  </button>
                  <button
                    onClick={() => setActiveTabMode('triage_inspector')}
                    className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                      activeTabMode === 'triage_inspector' 
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BrainCircuit className="w-4 h-4" />
                    <span>Triage AI & Filter Cards</span>
                  </button>
                  <button
                    onClick={() => setActiveTabMode('pipeline_overview')}
                    className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                      activeTabMode === 'pipeline_overview' 
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Tren Bulanan & Vendor</span>
                  </button>
                  <button
                    onClick={() => setActiveTabMode('transactions_table')}
                    className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                      activeTabMode === 'transactions_table' 
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Data Mentah ({pipelineResult.matchedRecords.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTabMode('vector_skus')}
                    className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                      activeTabMode === 'vector_skus' 
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                    <span>Vektor SKU ({vectorSkuResults.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTabMode('architecture_diagram')}
                    className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                      activeTabMode === 'architecture_diagram' 
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    <span>Arsitektur Pipeline</span>
                  </button>
                </div>

                {/* Raw Data Export Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handleExportFilteredCsv}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-xs"
                    title="Download Data Mentah Kueri ke CSV (Bisa Dibuka di Excel)"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Export Excel (CSV)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFilteredJson}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
                    title="Download Data Mentah JSON"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-Tab: Interactive Visual Dashboard */}
            {activeTabMode === 'visual_dashboard' && (
              <div className="pt-2">
                <FilteredDataDashboard
                  stats={pipelineResult.aggregatedStats}
                  matchedRecords={pipelineResult.matchedRecords}
                  queryTitle={pipelineResult.query}
                  activeCardsCount={activeFilterCards.length}
                />
              </div>
            )}

            {/* Sub-Tab 0: Triage Inspector & Multi-Card Filter Visualizer */}
            {activeTabMode === 'triage_inspector' && (
              <div className="space-y-6 pt-2">
                {/* 1. Reasoning Summary Banner */}
                {pipelineResult.triageResult?.reasoningSummary && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-1.5">
                    <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Logika Pertimbangan AI (Procurement Reasoning)</span>
                    </div>
                    <p className="text-xs text-blue-950/80 leading-relaxed">
                      {pipelineResult.triageResult.reasoningSummary}
                    </p>
                  </div>
                )}

                {/* 2. Candidate Triage Decision Table */}
                {pipelineResult.triageResult?.candidateDecisions && pipelineResult.triageResult.candidateDecisions.length > 0 && (
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                          <span>Keputusan Triase Kandidat Semantik ({pipelineResult.triageResult.candidateDecisions.length} Item)</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          AI memeriksa semua kandidat yang mirip dari database lokal dan memutuskan status Include / Exclude berdasarkan konteks pertanyaan
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {pipelineResult.triageResult.candidateDecisions.map((dec, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3 rounded-xl border flex items-start space-x-3 transition-all ${
                            dec.decision === 'INCLUDE' 
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                              : dec.decision === 'EXCLUDE'
                              ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="shrink-0 mt-0.5">
                            {dec.decision === 'INCLUDE' ? (
                              <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-[10px] rounded-md uppercase tracking-wider">
                                INCLUDE
                              </span>
                            ) : dec.decision === 'EXCLUDE' ? (
                              <span className="px-2 py-0.5 bg-rose-600 text-white font-bold text-[10px] rounded-md uppercase tracking-wider">
                                EXCLUDE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-500 text-white font-bold text-[10px] rounded-md uppercase tracking-wider">
                                DISCARD
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-slate-900 truncate" title={dec.candidate}>
                                {dec.candidate}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                {dec.field}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug">
                              {dec.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Interactive Multi-Card Filter Hierarchy (OR between Cards, AND within Card) */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <span>Struktur Kartu Filter Multi-Kondisi (OR Logic Hierarchy)</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pertanyaan bertingkat dieksekusi melalui {activeFilterCards.length} grup kartu kondisi. Anda dapat menyesuaikan atau menambah kartu baru.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsBuilderExpanded(!isBuilderExpanded)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBuilderExpanded ? 'Sembunyikan Editor Kartu' : 'Buka Editor Kartu Filter'}</span>
                    </button>
                  </div>

                  {/* Visual Card Summary Chips */}
                  <div className="space-y-3">
                    {activeFilterCards.map((card, cardIdx) => (
                      <div key={card.id || cardIdx} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-bold text-xs text-blue-900 flex items-center space-x-1.5">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">
                              {cardIdx + 1}
                            </span>
                            <span>Filter Card {cardIdx + 1}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Field conditions evaluated with AND
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {/* Commodity L5 */}
                          {(card.commodity_l5 || card.commodity_remark_product) && (
                            <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                L5 Commodity / Product
                              </span>
                              {(card.commodity_l5?.include?.length || 0) > 0 && (
                                <div className="text-[11px] text-emerald-700 font-mono">
                                  + Include: {card.commodity_l5?.include.join(', ')}
                                </div>
                              )}
                              {(card.commodity_l5?.exclude?.length || 0) > 0 && (
                                <div className="text-[11px] text-rose-700 font-mono">
                                  - Exclude: {card.commodity_l5?.exclude.join(', ')}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Specification */}
                          {card.item_specification && (
                            <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                Specification & Material
                              </span>
                              {(card.item_specification.include?.length || 0) > 0 && (
                                <div className="text-[11px] text-emerald-700 font-mono">
                                  + Include: {card.item_specification.include.join(', ')}
                                </div>
                              )}
                              {(card.item_specification.exclude?.length || 0) > 0 && (
                                <div className="text-[11px] text-rose-700 font-mono">
                                  - Exclude: {card.item_specification.exclude.join(', ')}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Hospital Location */}
                          {card.hospital_code && (
                            <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                Unit / Hospital Code
                              </span>
                              {(card.hospital_code.include?.length || 0) > 0 && (
                                <div className="text-[11px] text-blue-700 font-mono">
                                  Units: {card.hospital_code.include.join(', ')}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Brand */}
                          {card.brand_name && ((card.brand_name.include?.length || 0) > 0 || (card.brand_name.exclude?.length || 0) > 0) && (
                            <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                Brand / Manufacturer
                              </span>
                              {card.brand_name.include?.length ? <div className="text-[11px] text-emerald-700 font-mono">+ {card.brand_name.include.join(', ')}</div> : null}
                              {card.brand_name.exclude?.length ? <div className="text-[11px] text-rose-700 font-mono">- {card.brand_name.exclude.join(', ')}</div> : null}
                            </div>
                          )}
                        </div>

                        {cardIdx < activeFilterCards.length - 1 && (
                          <div className="flex items-center justify-center pt-2">
                            <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-full text-[10px] font-extrabold tracking-widest uppercase">
                              [ OR LOGIC ]
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Expandable Manual Cards Builder */}
                  {isBuilderExpanded && (
                    <div className="pt-3 border-t border-slate-200">
                      <ManualFilterCardsBuilder
                        cards={activeFilterCards}
                        onChange={handleCardsChange}
                        matchedCount={pipelineResult.matchedRecords.length}
                        totalRecordsCount={records.length}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-Tab 1: Monthly Breakdown & Vendor Concentration */}
            {activeTabMode === 'pipeline_overview' && (
              <div className="space-y-6 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Monthly Trend Table */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span>Tren Penggunaan Bulanan ({pipelineResult.parsedFilter.entity_filters.year?.join(', ') || '2026'})</span>
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="py-2 px-2">Bulan</th>
                            <th className="py-2 px-2 text-center">Volume (Unit)</th>
                            <th className="py-2 px-2 text-right">Total Spend</th>
                            <th className="py-2 px-2 text-center">Transaksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 font-mono">
                          {pipelineResult.aggregatedStats.monthlyBreakdown.map((m, idx) => (
                            <tr key={idx} className="hover:bg-white/80 transition-colors">
                              <td className="py-2.5 px-2 font-bold text-slate-800">{m.month}</td>
                              <td className="py-2.5 px-2 text-center text-slate-700">{m.quantity.toLocaleString('id-ID')}</td>
                              <td className="py-2.5 px-2 text-right font-bold text-blue-700">{formatIDR(m.spend)}</td>
                              <td className="py-2.5 px-2 text-center text-slate-500">{m.transactionsCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Top Vendors */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>Top Vendor / Pemasok Utama</span>
                    </h4>
                    <div className="space-y-3">
                      {pipelineResult.aggregatedStats.topVendors.map((v, idx) => {
                        const pct = pipelineResult.aggregatedStats.totalSpend > 0 
                          ? ((v.spend / pipelineResult.aggregatedStats.totalSpend) * 100).toFixed(1) 
                          : '0';
                        return (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900 truncate max-w-[200px]" title={v.vendorName}>{v.vendorName}</span>
                              <span className="font-mono font-bold text-blue-700">{formatIDR(v.spend)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>{v.quantity.toLocaleString('id-ID')} unit ({v.transactionsCount} PO)</span>
                              <span className="font-bold text-slate-700">{pct}% dari total</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Filtered Transactions Raw Table */}
            {activeTabMode === 'transactions_table' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span>Daftar Transaksi Hasil Filter ({pipelineResult.matchedRecords.length} Baris)</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">Klik baris untuk inspeksi detail</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-2.5 px-3">PO Number</th>
                        <th className="py-2.5 px-3">Lokasi</th>
                        <th className="py-2.5 px-3">Vendor / Pemasok</th>
                        <th className="py-2.5 px-3">Deskripsi Barang</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Nilai Spend</th>
                        <th className="py-2.5 px-3">Kategori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {pipelineResult.matchedRecords.map(r => (
                        <tr key={r.id} onClick={() => onSelectRecord(r)} className="hover:bg-blue-50/50 cursor-pointer transition-colors font-mono">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{r.purchId}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-sans font-semibold text-[10px]">{r.hospitalCode}</span>
                          </td>
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-900 truncate max-w-[150px]" title={r.vendorName}>{r.vendorName}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-900 truncate max-w-[200px]" title={r.itemName}>{r.itemName}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{r.purchQty}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatIDR(r.totalLineAmount)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                              r.purchaseCategory === 'CAPEX' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {r.purchaseCategory}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Vector SKU Semantic Matches */}
            {activeTabMode === 'vector_skus' && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Katalog SKU Master (Semantic Cosine Matching)</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Pencocokan 4 segmen (Name, Specs, Brand, Part Number) terhadap kueri</p>
                  </div>
                  <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 font-bold">
                    {vectorSkuResults.length} SKU Relevan
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vectorSkuResults.map(({ item, score, matchedReason }, idx) => (
                    <div key={item.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3 hover:border-blue-300 transition-all shadow-xs">
                      <div>
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 truncate max-w-[120px]">
                            {item.productId || item.id || 'SKU'}
                          </span>
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {matchedReason || 'Semantic Match'}
                            </span>
                            <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                              {(score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2" title={item.name}>{item.name}</h4>
                        <div className="text-[11px] text-slate-500 mt-1.5 space-y-0.5">
                          {item.specification1 && <p><span className="font-semibold text-slate-600">Spec:</span> {item.specification1}</p>}
                          {item.brand && <p><span className="font-semibold text-slate-600">Brand:</span> {item.brand}</p>}
                          {item.partNumber && <p><span className="font-semibold text-slate-600">Part No:</span> {item.partNumber}</p>}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-medium text-slate-600 truncate max-w-[140px]">{item.brand || 'Standard Supplier'}</span>
                        <span className="font-mono font-bold text-slate-900">{formatIDR(item.standardPrice || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Tab 4: Architecture Diagram & Pipeline Guide */}
            {activeTabMode === 'architecture_diagram' && (
              <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Alur Eksekusi Two-Stage Hybrid Filtering Architecture</h4>
                    <p className="text-xs text-slate-400">Prinsip kerja efisiensi token & pencegahan halusinasi angka</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                    <div className="text-blue-400 font-bold text-[11px] uppercase">Tahap 1 (Lokal)</div>
                    <div className="font-bold text-white">Semantic Discovery & Candidate Scan</div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Memindai kandidat komoditas L5, spesifikasi, dan lokasi secara lokal dari database tanpa memindai field yang tidak relevan (seperti Brand jika tidak ditanya).
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                    <div className="text-indigo-400 font-bold text-[11px] uppercase">Tahap 2 (AI Reasoner)</div>
                    <div className="font-bold text-white">AI Triage & Multi-Card Structuring</div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      AI meninjau semua kandidat hasil pencarian semantik untuk menentukan mana yang di-INCLUDE, di-EXCLUDE (anti false-positive), serta menyusun kartu filter OR.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                    <div className="text-emerald-400 font-bold text-[11px] uppercase">Tahap 3 (Lokal)</div>
                    <div className="font-bold text-white">Local Database Card Evaluator</div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Mengevaluasi ribuan transaksi secara instan di IndexedDB dengan logika: OR antar kartu, AND dalam field kartu (Zero-Latency).
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                    <div className="text-amber-400 font-bold text-[11px] uppercase">Tahap 4 (AI Narator)</div>
                    <div className="font-bold text-white">Executive Narrative Synthesis</div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      AI menerima ringkasan angka matematis terverifikasi dan merangkai laporan eksekutif yang tajam dan profesional.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
