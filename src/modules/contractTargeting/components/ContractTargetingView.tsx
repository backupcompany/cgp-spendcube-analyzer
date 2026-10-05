import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SpendRecord, SkuMasterRecord } from '../../../core/types/spend';
import { 
  ContractTargetingFilter, 
  ContractTargetingAnalysisResult, 
  SemanticSpendCluster,
  OpportunityPriority,
  SourcingPipelineStage
} from '../../../core/types/contractTargeting';
import { contractOpportunityService } from '../services/contractOpportunityService';
import { useBackgroundStaging } from '../../../core/hooks/useBackgroundStaging';
import { StagingGatekeeper } from '../../../core/ui/StagingGatekeeper';
import { ContractTargetingFilterBar } from './ContractTargetingFilterBar';
import { ContractOpportunityMatrix } from './ContractOpportunityMatrix';
import { SemanticClusterTable } from './SemanticClusterTable';
import { MultiAgentStrategistPanel } from './MultiAgentStrategistPanel';
import { TargetingPipelineBoard } from './TargetingPipelineBoard';
import { ClusterBreakdownModal } from './modals/ClusterBreakdownModal';
import { SourcingRfpBriefModal } from './modals/SourcingRfpBriefModal';
import { 
  Sparkles, 
  Layers, 
  Bot, 
  BookmarkCheck, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  TrendingUp
} from 'lucide-react';

interface ContractTargetingViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
}

export const ContractTargetingView: React.FC<ContractTargetingViewProps> = ({
  records,
  skuMasters
}) => {
  // Extract dynamic categories and metadata from available data
  const { categoriesLv1, categoriesLv2, islands, regions, hospitals } = useMemo(() => {
    const l1Set = new Set<string>();
    const l2Set = new Set<string>();
    const hospitalSet = new Set<string>();

    records.forEach(r => {
      const cat1 = r.taxonomyLv1 || r.procurementCategory || r.mappedCategory || r.purchaseCategory;
      if (cat1) l1Set.add(cat1);
      if (r.taxonomyLv2) l2Set.add(r.taxonomyLv2);
      if (r.hospitalCode) hospitalSet.add(r.hospitalCode);
    });

    skuMasters.forEach(s => {
      if (s.purchCategoryLv1) l1Set.add(s.purchCategoryLv1);
      if (s.purchCategoryLv2) l2Set.add(s.purchCategoryLv2);
    });

    return {
      categoriesLv1: Array.from(l1Set).filter(Boolean).sort(),
      categoriesLv2: Array.from(l2Set).filter(Boolean).sort(),
      islands: ['Jawa', 'Sumatera', 'Bali & Nusa Tenggara', 'Kalimantan', 'Sulawesi'],
      regions: ['Jabodetabek', 'Jawa Barat', 'Jawa Tengah & DIY', 'Jawa Timur', 'Sumatera Utara', 'Sulawesi Selatan'],
      hospitals: Array.from(hospitalSet).filter(Boolean).sort()
    };
  }, [records, skuMasters]);

  // Main Filter State
  const [filter, setFilter] = useState<ContractTargetingFilter>({
    categoryLv1: 'ALL',
    categoryLv2: 'ALL',
    startDate: '',
    endDate: '',
    island: 'ALL',
    region: 'ALL',
    hospitalCode: 'ALL',
    spendType: 'all',
    contractStatusFilter: 'ALL',
    priorityFilter: 'ALL',
    minSpendThreshold: 0,
    searchQuery: ''
  });

  // UI state
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'ai_strategy' | 'pipeline'>('matrix');
  const [isScanning, setIsScanning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ContractTargetingAnalysisResult | null>(null);
  const [selectedClusterForBreakdown, setSelectedClusterForBreakdown] = useState<SemanticSpendCluster | null>(null);
  const [selectedClusterForBrief, setSelectedClusterForBrief] = useState<SemanticSpendCluster | null>(null);
  const [pipelineItems, setPipelineItems] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    stagedContractTargeting,
    isStagingReady,
    isStagingInProgress,
    triggerStaging
  } = useBackgroundStaging();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load pipeline items
  const reloadPipeline = useCallback(async () => {
    const items = await contractOpportunityService.getPipelineItems();
    setPipelineItems(items);
  }, []);

  useEffect(() => {
    reloadPipeline();
  }, [reloadPipeline]);

  // If worker pre-staged results become available and no custom scan has run, use precomputed staging
  useEffect(() => {
    if (stagedContractTargeting && !analysisResult) {
      setAnalysisResult({
        filterHash: stagedContractTargeting.filterHash,
        timestamp: new Date(stagedContractTargeting.computedAt).toISOString(),
        clusters: stagedContractTargeting.clusters,
        summary: stagedContractTargeting.summary
      });
    }
  }, [stagedContractTargeting, analysisResult]);

  // Main Scan Trigger
  const handleScan = useCallback(async (forceRefresh = false) => {
    if (records.length === 0) return;

    setIsScanning(true);
    try {
      const res = await contractOpportunityService.scanContractOpportunities(
        records,
        skuMasters,
        filter,
        forceRefresh
      );
      setAnalysisResult(res);
      await reloadPipeline();
    } catch (err) {
      console.error('Scan failed:', err);
      showToast('Gagal memindai data transaksi.');
    } finally {
      setIsScanning(false);
    }
  }, [records, skuMasters, filter, reloadPipeline]);

  // Initial auto scan on mount if not using pre-staged result
  useEffect(() => {
    if (records.length > 0 && !analysisResult && !stagedContractTargeting && !isStagingInProgress) {
      handleScan(false);
    }
  }, [records.length, analysisResult, stagedContractTargeting, isStagingInProgress, handleScan]);

  const handleResetFilter = () => {
    setFilter({
      categoryLv1: 'ALL',
      categoryLv2: 'ALL',
      startDate: '',
      endDate: '',
      island: 'ALL',
      region: 'ALL',
      hospitalCode: 'ALL',
      spendType: 'all',
      contractStatusFilter: 'ALL',
      priorityFilter: 'ALL',
      minSpendThreshold: 0,
      searchQuery: ''
    });
  };

  const handleSelectPriorityFromMatrix = (priority: 'ALL' | OpportunityPriority) => {
    setFilter(prev => ({
      ...prev,
      priorityFilter: priority
    }));
  };

  const handlePinCluster = async (cluster: SemanticSpendCluster) => {
    await contractOpportunityService.pinClusterToPipeline(cluster);
    await reloadPipeline();
    showToast(`"${cluster.clusterName}" berhasil disematkan di Pipeline Sourcing!`);
    
    // Update local state if present
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        clusters: analysisResult.clusters.map(c => 
          c.id === cluster.id ? { ...c, pinnedToPipeline: true } : c
        )
      });
    }
  };

  const handleUpdatePipelineStage = async (itemId: string, newStage: SourcingPipelineStage) => {
    await contractOpportunityService.updatePipelineStage(itemId, newStage);
    await reloadPipeline();
    showToast('Tahapan pipeline berhasil diperbarui.');
  };

  const handleRemovePipelineItem = async (itemId: string) => {
    await contractOpportunityService.removeClusterFromPipeline(itemId);
    await reloadPipeline();
    showToast('Item dihapus dari Pipeline.');
  };

  const handleExportCsv = () => {
    if (!analysisResult || analysisResult.clusters.length === 0) return;

    const headers = [
      'ID_Kluster',
      'Nama_Kluster',
      'Kategori_L1',
      'Kategori_L2',
      'Kuadran_Kraljic',
      'Target_Prioritas',
      'Total_Belanja_IDR',
      'Total_Qty',
      'Satuan_UOM',
      'Frekuensi_PO',
      'Jumlah_Vendor',
      'Jumlah_RS',
      'Belanja_Terkontrak_IDR',
      'Belanja_Spot_IDR',
      'Persen_Terkontrak',
      'Harga_Terendah',
      'Harga_Tertinggi',
      'Estimasi_Hemat_Min_IDR',
      'Estimasi_Hemat_Max_IDR',
      'Rekomendasi_Kontrak'
    ];

    const rows = analysisResult.clusters.map(c => [
      c.id,
      `"${c.clusterName.replace(/"/g, '""')}"`,
      `"${c.categoryLv1}"`,
      `"${c.categoryLv2}"`,
      c.kraljicQuadrant,
      c.opportunityPriority,
      c.totalSpend,
      c.totalQty,
      c.primaryUom,
      c.poOccurrences,
      c.uniqueVendors.length,
      c.uniqueHospitals.length,
      c.contractCoverage.contractedSpend,
      c.contractCoverage.uncontractedSpend,
      c.contractCoverage.percentageContracted.toFixed(2),
      c.minUnitPrice,
      c.maxUnitPrice,
      c.potentialSavingsEstimate.minSavingsIdr,
      c.potentialSavingsEstimate.maxSavingsIdr,
      `"${c.potentialSavingsEstimate.recommendedContractType}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Siloam_Contract_Opportunity_Targeting_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Ekspor CSV berhasil diunduh.');
  };

  return (
    <StagingGatekeeper
      featureName="Contract Opportunity & Targeting Hub"
      featureDescription="Pemindaian transaksi pembelian, pengelompokan kemiripan semantik, dan evaluasi matriks peluang kontrak sedang diproses di background Web Worker."
      onRetry={() => triggerStaging(records, skuMasters, [], [], undefined, true)}
    >
      <div className="space-y-5 pb-16">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Page Title & Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase tracking-wider">
              Procurement Category Intelligence
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
              Offline-First &amp; Zero Token Engine
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Smart Contract Opportunity &amp; Semantic Category Targeting Hub
          </h1>
          <p className="text-xs text-slate-500 max-w-3xl mt-0.5">
            Pindai data transaksi pembelian historis, kelompokkan variasi item mentah secara semantik, identifikasi kebocoran belanja spot tanpa kontrak, dan hasilkan rekomendasi kontrak korporat terpusat.
          </p>
        </div>

        {/* Action Button: Force Re-scan */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            onClick={() => handleScan(true)}
            disabled={isScanning}
            className="flex items-center space-x-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-blue-600' : ''}`} />
            <span>Pindai Ulang Data</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <ContractTargetingFilterBar
        filter={filter}
        onFilterChange={setFilter}
        onScan={() => handleScan(true)}
        onReset={handleResetFilter}
        isScanning={isScanning}
        categoriesLv1={categoriesLv1}
        categoriesLv2={categoriesLv2}
        islands={islands}
        regions={regions}
        hospitals={hospitals}
      />

      {/* View Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'matrix'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Matriks &amp; Kluster Belanja</span>
          {analysisResult && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
              {analysisResult.clusters.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('ai_strategy')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'ai_strategy'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Bot className="w-4 h-4 text-purple-600" />
          <span>Multi-Agent AI Strategist</span>
          <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold">
            3 Agen
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('pipeline')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'pipeline'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BookmarkCheck className="w-4 h-4 text-amber-600" />
          <span>Pipeline Sourcing Kontrak</span>
          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
            {pipelineItems.length}
          </span>
        </button>
      </div>

      {/* SUBTAB 1: Matrix & Clusters Table */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-5">
          {analysisResult?.summary && (
            <ContractOpportunityMatrix
              summary={analysisResult.summary}
              selectedPriority={filter.priorityFilter}
              onSelectPriority={handleSelectPriorityFromMatrix}
            />
          )}

          <SemanticClusterTable
            clusters={analysisResult?.clusters || []}
            selectedPriority={filter.priorityFilter || 'ALL'}
            onSelectPriority={handleSelectPriorityFromMatrix}
            onSelectCluster={(cluster) => setSelectedClusterForBreakdown(cluster)}
            onOpenSourcingBrief={(cluster) => setSelectedClusterForBrief(cluster)}
            onPinToPipeline={handlePinCluster}
            onExportCsv={handleExportCsv}
          />
        </div>
      )}

      {/* SUBTAB 2: Multi-Agent AI Strategist */}
      {activeSubTab === 'ai_strategy' && (
        <MultiAgentStrategistPanel
          strategy={analysisResult?.aiStrategy}
          isLoading={isScanning}
          onRefreshStrategy={() => handleScan(true)}
          clusterCount={analysisResult?.clusters?.length || 0}
          totalClusterSpend={analysisResult?.summary?.totalAnalyzedSpend || 0}
          activePriorityFilter={filter.priorityFilter || 'ALL'}
          topClusterNames={analysisResult?.clusters?.slice(0, 4).map(c => c.clusterName) || []}
        />
      )}

      {/* SUBTAB 3: Targeting Pipeline Board */}
      {activeSubTab === 'pipeline' && (
        <TargetingPipelineBoard
          pipelineItems={pipelineItems}
          onUpdateStage={handleUpdatePipelineStage}
          onRemoveItem={handleRemovePipelineItem}
          onOpenSourcingBrief={(cluster) => setSelectedClusterForBrief(cluster)}
          onSelectCluster={(cluster) => setSelectedClusterForBreakdown(cluster)}
        />
      )}

      {/* Modals */}
      {selectedClusterForBreakdown && (
        <ClusterBreakdownModal
          cluster={selectedClusterForBreakdown}
          onClose={() => setSelectedClusterForBreakdown(null)}
          onOpenSourcingBrief={(cluster) => {
            setSelectedClusterForBreakdown(null);
            setSelectedClusterForBrief(cluster);
          }}
          onPinToPipeline={handlePinCluster}
        />
      )}

      {selectedClusterForBrief && (
        <SourcingRfpBriefModal
          cluster={selectedClusterForBrief}
          onClose={() => setSelectedClusterForBrief(null)}
        />
      )}
    </div>
    </StagingGatekeeper>
  );
};
