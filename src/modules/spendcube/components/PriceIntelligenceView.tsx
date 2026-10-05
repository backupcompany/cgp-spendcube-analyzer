import React, { useState, useMemo, useEffect } from 'react';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord,
  PriceSurgeItem,
  IntraVendorDiscrepancyItem,
  VendorSwitchingOpportunity,
  RegionalPriceAnalysisItem,
  StandardPriceAuditItem
} from '../../../core/types/spend';
import { priceIntelligenceService } from '../services/priceIntelligenceService';
import { useBackgroundStaging } from '../../../core/hooks/useBackgroundStaging';
import { StagingGatekeeper } from '../../../core/ui/StagingGatekeeper';
import { PriceIntelligenceDetailModal, DiagnosticCode } from './PriceIntelligenceDetailModal';
import { 
  TrendingUp, 
  AlertTriangle, 
  Repeat, 
  Globe2, 
  SlidersHorizontal, 
  Sparkles, 
  Search, 
  ArrowUpRight, 
  ShieldAlert, 
  CheckCircle2, 
  Building, 
  DollarSign, 
  MapPin, 
  HelpCircle, 
  ArrowRight,
  Filter,
  Download,
  Flame,
  BadgeAlert,
  Coins,
  RefreshCw,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';

interface PriceIntelligenceViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  hospitalMasters: HospitalMasterRecord[];
  vendorMasters: VendorMasterRecord[];
  onSelectRecord?: (record: SpendRecord) => void;
  onUpdateSkuStandardPrice?: (productId: string, newStandardPrice: number) => void;
}

export const PriceIntelligenceView: React.FC<PriceIntelligenceViewProps> = ({
  records,
  skuMasters,
  hospitalMasters,
  vendorMasters,
  onSelectRecord,
  onUpdateSkuStandardPrice
}) => {
  const [activeTab, setActiveTab] = useState<'surges' | 'intraVendor' | 'switching' | 'regional' | 'standardPrice' | 'aiAudit'>('surges');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIsland, setSelectedIsland] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedAuditClass, setSelectedAuditClass] = useState<string>('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Notification Toast state (replaces blocking alert)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedIsland, selectedSeverity, selectedAuditClass, pageSize]);

  // AI Audit State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAuditReport, setAiAuditReport] = useState<{
    executiveSummary: string;
    keyPriceSurgesFindings: string[];
    vendorParityLeakages: string[];
    contractSwitchingRecommendations: string[];
    regionalPricingPolicyNotes: string[];
    skuManagementActions: string[];
  } | null>(null);

  // Price Intelligence Detail Modal State (PI-01 to PI-06 Audit & PO Follow-up)
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [auditModalDiagnostic, setAuditModalDiagnostic] = useState<DiagnosticCode>('PI-01');
  const [auditModalItem, setAuditModalItem] = useState<any>(null);

  const handleOpenAuditModal = (item: any, diagType: DiagnosticCode) => {
    setAuditModalItem(item);
    setAuditModalDiagnostic(diagType);
    setAuditModalOpen(true);
  };

  const formatIDR = (val: number) => `Rp ${Math.round(Number(val || 0)).toLocaleString('id-ID')}`;

  const { 
    stagedPriceIntelligence, 
    isStagingReady, 
    isStagingInProgress, 
    triggerStaging 
  } = useBackgroundStaging();

  // 1. Price Surges (Use pre-staged worker output if available, else calculate safely)
  const priceSurges = useMemo(() => {
    if (stagedPriceIntelligence?.priceSurges) {
      return stagedPriceIntelligence.priceSurges;
    }
    if (isStagingInProgress || records.length > 200) {
      return [];
    }
    return priceIntelligenceService.calculatePriceSurges(records);
  }, [stagedPriceIntelligence, isStagingInProgress, records]);

  // 2. Intra-Vendor Discrepancies
  const intraDiscrepancies = useMemo(() => {
    if (stagedPriceIntelligence?.intraVendorDiscrepancies) {
      return stagedPriceIntelligence.intraVendorDiscrepancies;
    }
    if (isStagingInProgress || records.length > 200) {
      return [];
    }
    return priceIntelligenceService.calculateIntraVendorDiscrepancies(records);
  }, [stagedPriceIntelligence, isStagingInProgress, records]);

  // 3. Vendor Switching Opportunities
  const switchingOpportunities = useMemo(() => {
    if (stagedPriceIntelligence?.switchingOpportunities) {
      return stagedPriceIntelligence.switchingOpportunities;
    }
    if (isStagingInProgress || records.length > 200) {
      return [];
    }
    return priceIntelligenceService.calculateVendorSwitchingOpportunities(records, priceSurges);
  }, [stagedPriceIntelligence, isStagingInProgress, records, priceSurges]);

  // 4. Regional Price Analysis
  const regionalAnomalies = useMemo(() => {
    if (stagedPriceIntelligence?.regionalAnalysis) {
      return stagedPriceIntelligence.regionalAnalysis;
    }
    if (isStagingInProgress || records.length > 200) {
      return [];
    }
    return priceIntelligenceService.calculateRegionalPriceAnalysis(records, hospitalMasters);
  }, [stagedPriceIntelligence, isStagingInProgress, records, hospitalMasters]);

  // 5. Standard Price vs Actual Purchase Audit
  const standardPriceAudits = useMemo(() => {
    if (stagedPriceIntelligence?.standardPriceAudits) {
      return stagedPriceIntelligence.standardPriceAudits;
    }
    if (isStagingInProgress || records.length > 200) {
      return [];
    }
    return priceIntelligenceService.calculateStandardPriceAudit(records, skuMasters);
  }, [stagedPriceIntelligence, isStagingInProgress, records, skuMasters]);

  // High-level KPI Summary
  const totalLeakageIntraVendor = useMemo(() => {
    return intraDiscrepancies.reduce((sum, item) => sum + item.totalLeakageAmount, 0);
  }, [intraDiscrepancies]);

  const totalSwitchingSavings = useMemo(() => {
    return switchingOpportunities.reduce((sum, item) => sum + item.totalPotentialSavingIDR, 0);
  }, [switchingOpportunities]);

  const totalCriticalSurges = useMemo(() => {
    return priceSurges.filter(s => s.severity === 'CRITICAL').length;
  }, [priceSurges]);

  const totalOverestimatedStandardPrices = useMemo(() => {
    return standardPriceAudits.filter(s => s.auditClassification === 'STANDARD_TOO_HIGH').length;
  }, [standardPriceAudits]);

  // Filtered views
  const filteredSurges = useMemo(() => {
    return priceSurges.filter(s => {
      if (selectedSeverity !== 'ALL' && s.severity !== selectedSeverity) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.itemName.toLowerCase().includes(q) || s.vendorName.toLowerCase().includes(q) || s.itemId.toLowerCase().includes(q);
      }
      return true;
    });
  }, [priceSurges, selectedSeverity, searchQuery]);

  const filteredIntra = useMemo(() => {
    return intraDiscrepancies.filter(i => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return i.itemName.toLowerCase().includes(q) || i.vendorName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [intraDiscrepancies, searchQuery]);

  const filteredSwitching = useMemo(() => {
    return switchingOpportunities.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.itemName.toLowerCase().includes(q) || s.currentVendor.toLowerCase().includes(q) || s.alternativeVendor.toLowerCase().includes(q);
      }
      return true;
    });
  }, [switchingOpportunities, searchQuery]);

  const filteredRegional = useMemo(() => {
    return regionalAnomalies.filter(r => {
      if (selectedIsland !== 'ALL' && r.island !== selectedIsland) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.itemName.toLowerCase().includes(q) || r.hospitalName.toLowerCase().includes(q) || r.region.toLowerCase().includes(q);
      }
      return true;
    });
  }, [regionalAnomalies, selectedIsland, searchQuery]);

  const filteredStandardAudits = useMemo(() => {
    return standardPriceAudits.filter(s => {
      if (selectedAuditClass !== 'ALL' && s.auditClassification !== selectedAuditClass) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.itemName.toLowerCase().includes(q) || s.productId.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [standardPriceAudits, selectedAuditClass, searchQuery]);

  // Paginated Slices
  const paginatedSurges = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSurges.slice(start, start + pageSize);
  }, [filteredSurges, currentPage, pageSize]);

  const paginatedIntra = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIntra.slice(start, start + pageSize);
  }, [filteredIntra, currentPage, pageSize]);

  const paginatedSwitching = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSwitching.slice(start, start + pageSize);
  }, [filteredSwitching, currentPage, pageSize]);

  const paginatedRegional = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegional.slice(start, start + pageSize);
  }, [filteredRegional, currentPage, pageSize]);

  const paginatedStandardAudits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStandardAudits.slice(start, start + pageSize);
  }, [filteredStandardAudits, currentPage, pageSize]);

  const handleRunAiAudit = async () => {
    setIsAiLoading(true);
    try {
      const result = await priceIntelligenceService.runAiPriceIntelligenceAudit({
        priceSurges: priceSurges.slice(0, 10),
        intraDiscrepancies: intraDiscrepancies.slice(0, 10),
        switchingOpportunities: switchingOpportunities.slice(0, 10),
        regionalAnomalies: regionalAnomalies.slice(0, 10),
        standardPriceAudits: standardPriceAudits.slice(0, 10)
      });
      setAiAuditReport(result);
    } catch (err) {
      console.error('Failed to run AI audit:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Reusable Pagination Controller
  const renderPagination = (totalItems: number) => {
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <span>Menampilkan <strong>{startIdx} - {endIdx}</strong> dari <strong>{totalItems}</strong> data</span>
          <span className="text-slate-300">|</span>
          <label className="flex items-center gap-1">
            <span>Baris:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="px-3 py-1 text-slate-700 font-semibold text-xs">
            Halaman {currentPage} dari {totalPages}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <StagingGatekeeper
      featureName="Price & Regional Intelligence"
      featureDescription="Kompilasi deteksi kenaikan harga, disparitas harga antar rumah sakit, dan audit standard price ERP sedang diproses di background Web Worker."
      onRetry={() => triggerStaging(records, skuMasters, hospitalMasters, vendorMasters, undefined, true)}
    >
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Non-blocking Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-md">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-medium text-slate-100">{toastMessage}</p>
          </div>
        )}

        {/* ERP System Control Bar (Clean ERP Ribbon & Modules) */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {/* Top Meta & System Context Bar */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">ERP PRICE & PARITY LEDGER</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-pulse"></span>
                    ACTIVE AUDIT ENGINE
                  </span>
                </div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                  Price Intelligence, Intra-Vendor Parity & Regional Benchmark
                </h2>
              </div>
            </div>

            {/* Quick Metrics & AI Action */}
            <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
              <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
                <span className="text-slate-400 text-[10px] uppercase font-sans">Surges:</span>
                <span className="font-bold text-rose-700">{totalCriticalSurges} Critical</span>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
                <span className="text-slate-400 text-[10px] uppercase font-sans">Disparity:</span>
                <span className="font-bold text-amber-700">{formatIDR(totalLeakageIntraVendor)}</span>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
                <span className="text-slate-400 text-[10px] uppercase font-sans">Switching:</span>
                <span className="font-bold text-emerald-700">{formatIDR(totalSwitchingSavings)}</span>
              </div>

              <button
                onClick={() => {
                  setActiveTab('aiAudit');
                  handleRunAiAudit();
                }}
                disabled={isAiLoading}
                className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'Auditing...' : 'AI Price Audit'}</span>
              </button>
            </div>
          </div>

          {/* ERP Module Navigation Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 sm:divide-x divide-slate-100 bg-white">
            {/* Module 1: Surges */}
            <button
              onClick={() => setActiveTab('surges')}
              className={`text-left p-3 transition-all relative flex flex-col justify-between group cursor-pointer ${
                activeTab === 'surges' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
              }`}
            >
              {activeTab === 'surges' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-slate-400">PI-01</span>
                <span className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  totalCriticalSurges > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {priceSurges.length}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Flame className={`w-3.5 h-3.5 ${activeTab === 'surges' ? 'text-blue-600' : 'text-rose-600'}`} />
                <span className={`text-xs font-bold truncate ${activeTab === 'surges' ? 'text-blue-900' : 'text-slate-800'}`}>
                  Price Surges
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                {totalCriticalSurges} &gt;20% Spikes
              </div>
            </button>

            {/* Module 2: Intra-Vendor */}
            <button
              onClick={() => setActiveTab('intraVendor')}
              className={`text-left p-3 transition-all relative flex flex-col justify-between group cursor-pointer ${
                activeTab === 'intraVendor' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
              }`}
            >
              {activeTab === 'intraVendor' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-slate-400">PI-02</span>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                  {intraDiscrepancies.length}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Repeat className={`w-3.5 h-3.5 ${activeTab === 'intraVendor' ? 'text-blue-600' : 'text-amber-600'}`} />
                <span className={`text-xs font-bold truncate ${activeTab === 'intraVendor' ? 'text-blue-900' : 'text-slate-800'}`}>
                  Intra-Vendor Parity
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                {formatIDR(totalLeakageIntraVendor)} Leak
              </div>
            </button>

            {/* Module 3: Vendor Switching */}
            <button
              onClick={() => setActiveTab('switching')}
              className={`text-left p-3 transition-all relative flex flex-col justify-between group cursor-pointer ${
                activeTab === 'switching' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
              }`}
            >
              {activeTab === 'switching' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-slate-400">PI-03</span>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                  {switchingOpportunities.length}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <DollarSign className={`w-3.5 h-3.5 ${activeTab === 'switching' ? 'text-blue-600' : 'text-emerald-600'}`} />
                <span className={`text-xs font-bold truncate ${activeTab === 'switching' ? 'text-blue-900' : 'text-slate-800'}`}>
                  Switching Options
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                {formatIDR(totalSwitchingSavings)} Save
              </div>
            </button>

            {/* Module 4: Regional Analysis */}
            <button
              onClick={() => setActiveTab('regional')}
              className={`text-left p-3 transition-all relative flex flex-col justify-between group cursor-pointer ${
                activeTab === 'regional' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
              }`}
            >
              {activeTab === 'regional' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-slate-400">PI-04</span>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                  {regionalAnomalies.length}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Globe2 className={`w-3.5 h-3.5 ${activeTab === 'regional' ? 'text-blue-600' : 'text-slate-600'}`} />
                <span className={`text-xs font-bold truncate ${activeTab === 'regional' ? 'text-blue-900' : 'text-slate-800'}`}>
                  Regional Indices
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                6 Regional Island Zones
              </div>
            </button>

            {/* Module 5: Standard Price (HPS) */}
            <button
              onClick={() => setActiveTab('standardPrice')}
              className={`text-left p-3 transition-all relative flex flex-col justify-between group cursor-pointer ${
                activeTab === 'standardPrice' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
              }`}
            >
              {activeTab === 'standardPrice' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-slate-400">PI-05</span>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                  {standardPriceAudits.length}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <SlidersHorizontal className={`w-3.5 h-3.5 ${activeTab === 'standardPrice' ? 'text-blue-600' : 'text-indigo-600'}`} />
                <span className={`text-xs font-bold truncate ${activeTab === 'standardPrice' ? 'text-blue-900' : 'text-slate-800'}`}>
                  Standard Price ERP
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                {totalOverestimatedStandardPrices} Need Recalibration
              </div>
            </button>

            {/* Module 6: AI Audit */}
            <button
              onClick={() => {
                setActiveTab('aiAudit');
                if (!aiAuditReport) handleRunAiAudit();
              }}
              className={`text-left p-3 transition-all relative flex flex-col justify-between group cursor-pointer ${
                activeTab === 'aiAudit' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
              }`}
            >
              {activeTab === 'aiAudit' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-slate-400">PI-06</span>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                  AI Ready
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span className={`text-xs font-bold truncate ${activeTab === 'aiAudit' ? 'text-blue-900' : 'text-slate-800'}`}>
                  AI Strategic Audit
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                {aiAuditReport ? 'Report Generated' : 'Run Diagnostics'}
              </div>
            </button>
          </div>
        </div>

      {/* Global Filter Bar for Current Tab */}
      {activeTab !== 'aiAudit' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari SKU, vendor, atau rumah sakit..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            {activeTab === 'surges' && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px] font-medium">Tingkat Lonjakan:</span>
                {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'STABLE'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                      selectedSeverity === sev
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sev === 'ALL' ? 'Semua' : sev}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'regional' && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px] font-medium">Pulau:</span>
                {['ALL', 'Jawa', 'Sumatera', 'Bali & Nusa Tenggara', 'Sulawesi', 'Kalimantan'].map((isl) => (
                  <button
                    key={isl}
                    onClick={() => setSelectedIsland(isl)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                      selectedIsland === isl
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isl === 'ALL' ? 'Semua Pulau' : isl}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'standardPrice' && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px] font-medium">Status ERP:</span>
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'STANDARD_TOO_HIGH', label: 'Standar Ketinggian (Revisi SKU)' },
                  { id: 'OVERPRICED_PURCHASE', label: 'Beli di Atas Standar' },
                  { id: 'OPTIMAL_MATCH', label: 'Optimal' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAuditClass(item.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                      selectedAuditClass === item.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: Kenaikan Harga & Inflasi SKU (Price Surge Tracker - PI-01) */}
      {activeTab === 'surges' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-mono font-bold text-[10px] rounded-sm">DIAGNOSTIK PI-01</span>
                <h3 className="text-sm font-bold text-slate-900">Historical Unit Price Inflation & Surge Detector</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Mendeteksi kenaikan harga satuan dari transaksi awal hingga transaksi terbaru per vendor. Klik baris untuk audit rumus & nomor PO.</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
              {filteredSurges.length} SKU Terdeteksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Komoditas & SKU</th>
                  <th className="py-3 px-4">Vendor Supplier</th>
                  <th className="py-3 px-4 text-center">Periode Transaksi</th>
                  <th className="py-3 px-4 text-right">Harga Awal</th>
                  <th className="py-3 px-4 text-right">Harga Terbaru</th>
                  <th className="py-3 px-4 text-right">Kenaikan %</th>
                  <th className="py-3 px-4 text-right">Est. Ekstra Biaya (IDR)</th>
                  <th className="py-3 px-4 text-center">Tingkat Lonjakan</th>
                  <th className="py-3 px-4 text-center">Audit PO & Rumus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedSurges.map((s) => (
                  <tr 
                    key={s.id} 
                    onClick={() => handleOpenAuditModal(s, 'PI-01')}
                    className="hover:bg-rose-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition-colors" title={s.itemName}>
                        {s.itemName}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Kode: {s.itemId}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {s.vendorName}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      {s.startMonth} &rarr; {s.latestMonth}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatIDR(s.initialPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatIDR(s.latestPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] ${
                        s.percentageIncrease >= 20 ? 'bg-rose-100 text-rose-700 font-extrabold' :
                        s.percentageIncrease >= 10 ? 'bg-amber-100 text-amber-700' :
                        s.percentageIncrease > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.percentageIncrease > 0 ? `+${s.percentageIncrease.toFixed(1)}%` : '0%'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      {formatIDR(s.estimatedExtraCost)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        s.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        s.severity === 'HIGH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        s.severity === 'MODERATE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}>
                        {s.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAuditModal(s, 'PI-01');
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 font-bold rounded-lg text-[11px] border border-slate-200 hover:border-rose-300 transition-all flex items-center justify-center gap-1 shadow-xs mx-auto cursor-pointer"
                      >
                        <Search className="w-3 h-3 text-rose-500" />
                        <span>Audit PO</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination(filteredSurges.length)}
        </div>
      )}

      {/* TAB 2: Disparitas Harga Intra-Vendor (Same Vendor Selling Cheap to A, Expensive to B - PI-02) */}
      {activeTab === 'intraVendor' && (
        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-mono font-bold text-[10px] rounded-sm">DIAGNOSTIK PI-02</span>
                <span className="font-bold text-sm">Deteksi Diskriminasi Harga Intra-Vendor</span>
              </div>
              Tabel ini menyoroti kasus di mana <strong>satu vendor yang sama</strong> menjual komoditas yang identik dengan harga murah di unit RS tertentu (misal Jabodetabek), namun menjual dengan harga jauh lebih mahal di unit RS lainnya. Menegakkan <em>Most Favored Customer (MFC) Clause</em> dapat menyelamatkan potensi kebocoran sebesar <strong>{formatIDR(totalLeakageIntraVendor)}</strong>. Klik baris untuk audit bukti PO per unit RS.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Vendor Supplier</th>
                    <th className="py-3 px-4">Komoditas / SKU</th>
                    <th className="py-3 px-4 text-left">Harga Termurah (Unit RS)</th>
                    <th className="py-3 px-4 text-left">Harga Termahal (Unit RS)</th>
                    <th className="py-3 px-4 text-right">Disparitas %</th>
                    <th className="py-3 px-4 text-right">Selisih Unit (IDR)</th>
                    <th className="py-3 px-4 text-right">Total Kebocoran (IDR)</th>
                    <th className="py-3 px-4 text-center">Audit Bukti PO</th>
                    <th className="py-3 px-4 text-center">Aksi Rekonsiliasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedIntra.map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => handleOpenAuditModal(item, 'PI-02')}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {item.vendorName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 line-clamp-1">{item.itemName}</div>
                        <span className="text-[10px] text-slate-400">Kode: {item.itemId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-emerald-700">{formatIDR(item.minPrice)}</span>
                        <span className="block text-[10px] text-slate-500">Unit: {item.minPriceHospital} ({item.minPriceMonth})</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-rose-700">{formatIDR(item.maxPrice)}</span>
                        <span className="block text-[10px] text-slate-500">Unit: {item.maxPriceHospital} ({item.maxPriceMonth})</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                        +{item.priceVariancePct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-800">
                        {formatIDR(item.priceDeltaIDR)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-700 bg-amber-50/40">
                        {formatIDR(item.totalLeakageAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAuditModal(item, 'PI-02');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 font-bold rounded-lg text-[11px] border border-slate-200 hover:border-amber-300 transition-all flex items-center justify-center gap-1 shadow-xs mx-auto cursor-pointer"
                        >
                          <Search className="w-3 h-3 text-amber-600" />
                          <span>Audit PO</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast(`Klausul Most Favored Customer (MFC) diajukan untuk ${item.vendorName} pada item "${item.itemName}". Target harga: ${formatIDR(item.minPrice)}.`);
                          }}
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[11px] border border-blue-200 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Samakan Tarif
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredIntra.length)}
          </div>
        </div>
      )}

      {/* TAB 3: Komparasi Kompetitor & Alihkan Vendor (Vendor Switching Advisor - PI-03) */}
      {activeTab === 'switching' && (
        <div className="space-y-4">
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 font-mono font-bold text-[10px] rounded-sm">DIAGNOSTIK PI-03</span>
                <span className="font-bold text-sm">Strategic Vendor Switching & Contract Reallocation Advisor</span>
              </div>
              Ketika vendor eksisting menaikkan harga secara signifikan, sistem SpendCube secara otomatis membandingkan dengan vendor kompetitor lain yang menawarkan harga lebih stabil/rendah untuk barang setara, memberikan estimasi penghematan tahunan hingga <strong>{formatIDR(totalSwitchingSavings)}</strong>. Klik baris untuk memeriksa bukti PO kenaikan vendor eksisting vs PO vendor alternatif.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Komoditas / SKU</th>
                    <th className="py-3 px-4">Vendor Eksisting (Harga Tinggi)</th>
                    <th className="py-3 px-4">Vendor Alternatif Disarankan</th>
                    <th className="py-3 px-4 text-right">Hemat per Unit</th>
                    <th className="py-3 px-4 text-right">Hemat %</th>
                    <th className="py-3 px-4 text-right">Potensi Hemat Total (IDR)</th>
                    <th className="py-3 px-4 text-center">Kelayakan Alih</th>
                    <th className="py-3 px-4 text-center">Audit Bukti PO</th>
                    <th className="py-3 px-4 text-center">Aksi Pengadaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedSwitching.map((opp) => (
                    <tr 
                      key={opp.id} 
                      onClick={() => handleOpenAuditModal(opp, 'PI-03')}
                      className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition-colors">{opp.itemName}</div>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{opp.recommendationNote}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-rose-800">{opp.currentVendor}</div>
                        <span className="font-mono text-slate-600 text-[11px] block">{formatIDR(opp.currentAvgPrice)} / unit</span>
                        {opp.priceIncreasePct > 0 && (
                          <span className="text-[10px] text-rose-600 font-semibold">Naik +{opp.priceIncreasePct.toFixed(1)}%</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{opp.alternativeVendor}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-[11px] block">{formatIDR(opp.alternativePrice)} / unit</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatIDR(opp.unitSavingIDR)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {opp.savingPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/40">
                        {formatIDR(opp.totalPotentialSavingIDR)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          opp.feasibilityScore === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                          opp.feasibilityScore === 'MEDIUM' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {opp.feasibilityScore}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAuditModal(opp, 'PI-03');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 font-bold rounded-lg text-[11px] border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-center gap-1 shadow-xs mx-auto cursor-pointer"
                        >
                          <Search className="w-3 h-3 text-emerald-600" />
                          <span>Audit PO</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast(`Rencana alih volume PO dibuat untuk "${opp.itemName}". PO berikutnya akan diarahkan ke ${opp.alternativeVendor}.`);
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Alihkan Kontrak
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredSwitching.length)}
          </div>
        </div>
      )}

      {/* TAB 4: Analisis Harga per Wilayah (Regional Pricing Matrix - PI-04) */}
      {activeTab === 'regional' && (
        <div className="space-y-4">
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <Globe2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 bg-blue-200 text-blue-900 font-mono font-bold text-[10px] rounded-sm">DIAGNOSTIK PI-04</span>
                <span className="font-bold text-sm">Analisis Harga per Wilayah Geografi (Kota, Region, Pulau)</span>
              </div>
              Membandingkan harga pembelian unit RS di luar Jabodetabek terhadap <strong>Benchmark Jabodetabek (100%)</strong>. Sistem memisahkan antara ongkos logistik yang wajar (toleransi 3% Jawa, 6-8% Luar Jawa) dengan <strong>Markup Berlebih (Excessive Markup)</strong> yang perlu dinegosiasikan ulang. Klik baris untuk detail bukti transaksi PO.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Rumah Sakit & Wilayah</th>
                    <th className="py-3 px-4">Pulau / Region</th>
                    <th className="py-3 px-4">Komoditas / SKU</th>
                    <th className="py-3 px-4 text-right">Harga Aktual Satuan</th>
                    <th className="py-3 px-4 text-right">Benchmark Jabotabek</th>
                    <th className="py-3 px-4 text-right">Regional Index</th>
                    <th className="py-3 px-4 text-right">Toleransi Logistik</th>
                    <th className="py-3 px-4 text-right">Markup Berlebih</th>
                    <th className="py-3 px-4 text-right">Potensi Efisiensi</th>
                    <th className="py-3 px-4 text-center">Audit Bukti PO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedRegional.map((reg) => (
                    <tr 
                      key={reg.id} 
                      onClick={() => handleOpenAuditModal(reg, 'PI-04')}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{reg.hospitalName}</div>
                        <span className="text-[10px] text-slate-500 font-mono">Kode: {reg.hospitalCode} &bull; Kota: {reg.city}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{reg.island}</span>
                        <span className="text-[10px] text-slate-500 block">{reg.region}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 line-clamp-1">{reg.itemName}</div>
                        <span className="text-[10px] text-slate-400">{reg.category}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatIDR(reg.actualAvgPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatIDR(reg.benchmarkJabodetabekPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                          reg.regionalPriceIndex > 115 ? 'bg-rose-100 text-rose-700' :
                          reg.regionalPriceIndex > 105 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {reg.regionalPriceIndex.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        +{reg.expectedFairLogisticsMarkupPct}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {reg.excessiveMarkupPct > 0 ? (
                          <span className="text-rose-600">+{reg.excessiveMarkupPct.toFixed(1)}%</span>
                        ) : (
                          <span className="text-emerald-600">Wajar (0%)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                        {formatIDR(reg.potentialFairAdjustmentSaving)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAuditModal(reg, 'PI-04');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 font-bold rounded-lg text-[11px] border border-slate-200 hover:border-blue-300 transition-all flex items-center justify-center gap-1 shadow-xs mx-auto cursor-pointer"
                        >
                          <Search className="w-3 h-3 text-blue-600" />
                          <span>Audit PO</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredRegional.length)}
          </div>
        </div>
      )}

      {/* TAB 5: Standar Price ERP vs Aktual (ERP Reference Control for SKU Management - PI-05) */}
      {activeTab === 'standardPrice' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 bg-indigo-200 text-indigo-900 font-mono font-bold text-[10px] rounded-sm">DIAGNOSTIK PI-05</span>
                <span className="font-bold text-sm">ERP Standard Price Governance & SKU Management Calibration</span>
              </div>
              Standar Price di SKU Master akan menjadi <strong>referensi resmi anggaran dan pagu di ERP (D365/AX)</strong>. Tabel ini mengidentifikasi item yang Standar Price-nya diset <strong>terlalu tinggi di atas harga riil pasar</strong> (perlu diturunkan oleh tim SKU Management agar referensi ERP presisi) atau unit yang membeli <strong>melebihi Standar Price</strong> (pelanggaran pagu ERP). Klik baris untuk memeriksa histori PO dan variansi.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Master SKU & Nama Item</th>
                    <th className="py-3 px-4">Kategori Pengadaan</th>
                    <th className="py-3 px-4 text-right">Standar Price ERP</th>
                    <th className="py-3 px-4 text-right">Rata-Rata Beli Riil</th>
                    <th className="py-3 px-4 text-right">Variansi vs Standar</th>
                    <th className="py-3 px-4 text-center">Status Kalibrasi SKU</th>
                    <th className="py-3 px-4">Instruksi Tim SKU Management</th>
                    <th className="py-3 px-4 text-center">Audit Bukti PO</th>
                    <th className="py-3 px-4 text-center">Aksi ERP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedStandardAudits.map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => handleOpenAuditModal(item, 'PI-05')}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition-colors">{item.itemName}</div>
                        <span className="text-[10px] text-slate-400 font-mono">Product ID: {item.productId}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                        {item.standardPriceERP > 0 ? formatIDR(item.standardPriceERP) : 'Belum Ada'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatIDR(item.actualAvgPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {item.standardPriceERP > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                            item.priceVarianceVsStandardPct > 10 ? 'bg-rose-100 text-rose-700' :
                            item.priceVarianceVsStandardPct < -15 ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {item.priceVarianceVsStandardPct > 0 ? `+${item.priceVarianceVsStandardPct.toFixed(1)}%` : `${item.priceVarianceVsStandardPct.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.auditClassification === 'STANDARD_TOO_HIGH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          item.auditClassification === 'OVERPRICED_PURCHASE' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          item.auditClassification === 'OPTIMAL_MATCH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}>
                          {item.auditClassification === 'STANDARD_TOO_HIGH' ? '⚠️ Standar Ketinggian' :
                           item.auditClassification === 'OVERPRICED_PURCHASE' ? '🚨 Beli Over-Price' :
                           item.auditClassification === 'OPTIMAL_MATCH' ? '✅ Optimal' : 'Belum Ada Standar'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-[11px]">
                        {item.skuTeamActionRequired}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAuditModal(item, 'PI-05');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-800 font-bold rounded-lg text-[11px] border border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-center gap-1 shadow-xs mx-auto cursor-pointer"
                        >
                          <Search className="w-3 h-3 text-indigo-600" />
                          <span>Audit PO</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.auditClassification === 'STANDARD_TOO_HIGH' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onUpdateSkuStandardPrice) {
                                onUpdateSkuStandardPrice(item.productId, item.recommendedNewStandardPrice);
                              }
                              showToast(`Standar Price untuk "${item.itemName}" berhasil disesuaikan ke ${formatIDR(item.recommendedNewStandardPrice)} untuk referensi ERP.`);
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Revisi ke {formatIDR(item.recommendedNewStandardPrice)}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-mono">Synced ERP</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredStandardAudits.length)}
          </div>
        </div>
      )}

      {/* TAB 6: Laporan Audit AI (Executive Gemini Copilot) */}
      {activeTab === 'aiAudit' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-blue-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Executive Strategic Price Intelligence & Regional Governance Report
                  </h3>
                  <p className="text-xs text-blue-200">
                    Laporan audit berbasis AI yang memadukan data transaksi, disparitas vendor, komparasi pasar, toleransi wilayah, dan Standar Price ERP
                  </p>
                </div>
              </div>

              <button
                onClick={handleRunAiAudit}
                disabled={isAiLoading}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'Menyusun Audit...' : 'Regenerate Audit AI'}</span>
              </button>
            </div>

            {aiAuditReport && (
              <div className="mt-5 p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur-xs">
                <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block mb-1">
                  Executive Summary
                </span>
                <p className="text-sm font-medium text-slate-100 leading-relaxed">
                  {aiAuditReport.executiveSummary}
                </p>
              </div>
            )}
          </div>

          {aiAuditReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Box 1: Temuan Kenaikan Harga */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-rose-700 font-bold text-sm">
                  <Flame className="w-4 h-4" />
                  <span>1. Lonjakan Harga & Supplier Terindikasi</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700">
                  {aiAuditReport.keyPriceSurgesFindings.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Box 2: Kebocoran Disparitas Intra-Vendor */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-amber-700 font-bold text-sm">
                  <Repeat className="w-4 h-4" />
                  <span>2. Disparitas Intra-Vendor & Klausul MFC</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700">
                  {aiAuditReport.vendorParityLeakages.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Box 3: Rekomendasi Alih Kontrak Vendor */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>3. Strategi Pengalihan Kontrak ke Kompetitor</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700">
                  {aiAuditReport.contractSwitchingRecommendations.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Box 4: Kebijakan Harga Regional & Toleransi Logistik */}
              <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-blue-700 font-bold text-sm">
                  <Globe2 className="w-4 h-4" />
                  <span>4. Tata Kelola Harga Wilayah & Batas Logistik</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700">
                  {aiAuditReport.regionalPricingPolicyNotes.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Box 5: Arahan Tim SKU Management (Full Width) */}
              <div className="bg-white rounded-2xl p-5 border border-indigo-200 shadow-xs space-y-3 md:col-span-2">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold text-sm">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>5. Arahan Khusus Tim SKU Management (ERP Reference Calibration)</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700">
                  {aiAuditReport.skuManagementActions.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal for Price Intelligence & PO Operational Follow-up */}
      {auditModalOpen && (
        <PriceIntelligenceDetailModal
          isOpen={auditModalOpen}
          onClose={() => setAuditModalOpen(false)}
          diagnosticType={auditModalDiagnostic}
          selectedItem={auditModalItem}
          allSpendRecords={records}
          onFollowUpPO={(poNumber) => {
            showToast(`Nomor PO "${poNumber}" siap difollow up ke tim procurement dan vendor.`);
          }}
        />
      )}
    </div>
    </StagingGatekeeper>
  );
};
