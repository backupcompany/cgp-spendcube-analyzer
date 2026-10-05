import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  TrendingDown, 
  Layers, 
  CheckSquare, 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  AlertTriangle,
  Info,
  Calendar,
  Building2,
  User,
  Target,
  Sparkles,
  Cpu,
  Loader2
} from 'lucide-react';
import { 
  SpendRecord, 
  SkuMasterRecord,
  isPrSummaryRecord 
} from '../../../../core/types/spend';
import { 
  aggregateMonthlyCompliance, 
  aggregateComplianceStats, 
  aggregateHospitalCompliance, 
  aggregateUserCompliance,
  PoLineComplianceRecord,
  COMPLIANCE_CATEGORIES
} from '../../services/skuPoComplianceService';
import { 
  skuComplianceWorkerService, 
  SkuComplianceWorkerState 
} from '../../services/skuComplianceWorkerService';
import type { SkuCompliancePreAggregates } from '../../services/skuComplianceTypes';
import { ComplianceKpiCards } from './ComplianceKpiCards';
import { ComplianceTrendChart } from './ComplianceTrendChart';
import { ComplianceFilterBar } from './ComplianceFilterBar';
import { ComplianceFollowUpCards } from './ComplianceFollowUpCards';
import { CompliancePoLineTable } from './CompliancePoLineTable';
import { ComplianceDetailModal } from './ComplianceDetailModal';

export interface SkuPoComplianceViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  onSelectRecord?: (record: SpendRecord) => void;
}

export const SkuPoComplianceView: React.FC<SkuPoComplianceViewProps> = ({
  records = [],
  skuMasters = [],
  onSelectRecord
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Detail Modal State
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<PoLineComplianceRecord | null>(null);

  // Background Web Worker State
  const [workerState, setWorkerState] = useState<SkuComplianceWorkerState>(() => skuComplianceWorkerService.getState());
  const [allEvaluatedRecords, setAllEvaluatedRecords] = useState<PoLineComplianceRecord[]>([]);
  const [aggregates, setAggregates] = useState<SkuCompliancePreAggregates | null>(null);

  // Subscribe to Web Worker Progress
  useEffect(() => {
    const unsub = skuComplianceWorkerService.subscribe((state) => {
      setWorkerState(state);
    });
    return unsub;
  }, []);

  // Trigger evaluation in Background Web Worker
  const runEvaluation = useCallback(async (force = false) => {
    if (!records || records.length === 0) {
      setAllEvaluatedRecords([]);
      setAggregates(null);
      return;
    }

    try {
      // Filter out PR summary records: compliance monitoring is exclusively for PO Lines!
      const poOnlyRecords = records.filter(r => !isPrSummaryRecord(r));

      const result = await skuComplianceWorkerService.evaluateCompliance(poOnlyRecords, skuMasters, force);
      setAllEvaluatedRecords(result.evaluatedRecords);
      setAggregates(result.aggregates);
    } catch (err) {
      console.error('[SkuPoComplianceView] Error during worker evaluation:', err);
    }
  }, [records, skuMasters]);

  useEffect(() => {
    runEvaluation(false);
  }, [runEvaluation]);

  // Pre-computed Options & Trends from Background Worker (zero main thread CPU cost)
  const monthlyTrends = aggregates?.monthlyTrends || [];
  const monthOptions = aggregates?.monthOptions || [];
  const hospitalOptions = aggregates?.hospitalOptions || [];
  const userOptions = aggregates?.userOptions || [];

  const isFilterActive = Boolean(
    selectedMonth || 
    selectedHospital || 
    selectedUser || 
    selectedCategoryFilter !== 'ALL' || 
    searchQuery.trim()
  );

  // 4. Apply Filters to Evaluated Records
  const filteredRecords = useMemo(() => {
    if (!isFilterActive) {
      return allEvaluatedRecords;
    }

    let result = allEvaluatedRecords;

    // Filter by Month
    if (selectedMonth) {
      result = result.filter(r => r.monthYear === selectedMonth);
    }

    // Filter by Hospital
    if (selectedHospital) {
      result = result.filter(r => r.hospitalCode.toUpperCase() === selectedHospital.toUpperCase());
    }

    // Filter by User
    if (selectedUser) {
      result = result.filter(r => (r.requesterName === selectedUser || r.requester === selectedUser));
    }

    // Filter by Compliance Category
    if (selectedCategoryFilter !== 'ALL') {
      if (selectedCategoryFilter === 'UNMATCHED_ONLY') {
        result = result.filter(r => r.isUnmatched);
      } else if (selectedCategoryFilter === 'MATCHED_ONLY') {
        result = result.filter(r => r.isMatched);
      } else {
        result = result.filter(r => r.category === selectedCategoryFilter);
      }
    }

    // Search Query (Text search)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        r.purchId.toLowerCase().includes(q) ||
        r.poItemName.toLowerCase().includes(q) ||
        (r.poSkuCode && r.poSkuCode.toLowerCase().includes(q)) ||
        r.hospitalCode.toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        (r.matchedMaster && r.matchedMaster.name.toLowerCase().includes(q)) ||
        (r.matchedMaster && (r.matchedMaster.productId || '').toLowerCase().includes(q))
      );
    }

    return result;
  }, [allEvaluatedRecords, isFilterActive, selectedMonth, selectedHospital, selectedUser, selectedCategoryFilter, searchQuery]);

  // 5. Aggregate KPI Summary Stats (Use worker pre-computed if no filter active)
  const summaryStats = useMemo(() => {
    if (!isFilterActive && aggregates?.summaryStats) {
      return aggregates.summaryStats;
    }
    return aggregateComplianceStats(filteredRecords);
  }, [filteredRecords, isFilterActive, aggregates]);

  // 6. Aggregate Follow-up Rankings (Use worker pre-computed if no filter active)
  const topHospitalFollowUps = useMemo(() => {
    if (!isFilterActive && aggregates?.topHospitals) {
      return aggregates.topHospitals;
    }
    return aggregateHospitalCompliance(filteredRecords);
  }, [filteredRecords, isFilterActive, aggregates]);

  const topUserFollowUps = useMemo(() => {
    if (!isFilterActive && aggregates?.topUsers) {
      return aggregates.topUsers;
    }
    return aggregateUserCompliance(filteredRecords);
  }, [filteredRecords, isFilterActive, aggregates]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedMonth('');
    setSelectedHospital('');
    setSelectedUser('');
    setSelectedCategoryFilter('ALL');
  };

  const handleKpiCategoryFilter = (cat: string) => {
    setSelectedCategoryFilter(cat);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-7 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Target className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                Kepatuhan Penggunaan Master SKU
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Target: Menuju 0% Non-Compliance
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Monitoring Compliance SKU to PO
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Memantau kesesuaian penamaan dan kode SKU pada setiap baris PO terhadap Master Data MDM katalog. 
              Mendeteksi ketidaksesuaian kode, perbedaan deskripsi yang diedit manual, serta kode yang belum terdaftar di MDM.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Katalog Master SKU</span>
                <span className="text-base font-extrabold text-blue-300 font-mono">
                  {skuMasters.length.toLocaleString('id-ID')} Master MDM
                </span>
              </div>

              <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Database PO</span>
                <span className="text-base font-extrabold text-emerald-300 font-mono">
                  {records.length.toLocaleString('id-ID')} PO Line
                </span>
              </div>

              <button
                type="button"
                onClick={() => runEvaluation(true)}
                disabled={workerState.isEvaluating}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                title="Jalankan ulang evaluasi di background worker"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${workerState.isEvaluating ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{workerState.isEvaluating ? 'Memproses...' : 'Sinkronkan Evaluasi'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Background Web Worker Progress Banner */}
      {workerState.isEvaluating && (
        <div className="p-4 rounded-2xl bg-cyan-950/95 text-cyan-100 border border-cyan-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-300 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-2">
                <span>Web Worker Thread: Memproses Evaluasi Kepatuhan SKU</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-900 text-cyan-200 border border-cyan-700">
                  {workerState.progressPercent}%
                </span>
              </p>
              <p className="text-[11px] text-cyan-200">
                {workerState.progressMessage || 'Mempersiapkan evaluasi data kepatuhan...'}
              </p>
            </div>
          </div>
          <div className="w-full sm:w-56 bg-cyan-900/60 rounded-full h-2.5 overflow-hidden border border-cyan-700/80 shrink-0">
            <div 
              className="bg-cyan-400 h-full transition-all duration-200 rounded-full"
              style={{ width: `${workerState.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content: Show skeleton during initial background preparation */}
      {allEvaluatedRecords.length === 0 && workerState.isEvaluating ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Menyiapkan Data Monitoring Kepatuhan SKU</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Web Worker sedang mengevaluasi {records.length.toLocaleString('id-ID')} baris PO terhadap {skuMasters.length.toLocaleString('id-ID')} Master MDM di background thread agar browser Anda tetap responsif dan lancar.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Summary KPI Cards */}
          <ComplianceKpiCards 
            stats={summaryStats}
            selectedMonth={selectedMonth}
            onFilterCategory={handleKpiCategoryFilter}
          />

          {/* 2. Monthly Trend Chart with target towards 0% (Power BI Stacked Bar & Cross-Filter) */}
          <ComplianceTrendChart
            monthlyData={monthlyTrends}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            selectedCategory={selectedCategoryFilter}
            onSelectCategory={setSelectedCategoryFilter}
          />

          {/* 3. Follow-up Ranking Cards (Top Units & Users Needing Coordination) */}
          <ComplianceFollowUpCards
            topHospitals={topHospitalFollowUps}
            topUsers={topUserFollowUps}
            onSelectHospital={setSelectedHospital}
            onSelectUser={setSelectedUser}
          />

          {/* 4. Filter Toolbar */}
          <ComplianceFilterBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedHospital={selectedHospital}
            setSelectedHospital={setSelectedHospital}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            selectedCategoryFilter={selectedCategoryFilter}
            setSelectedCategoryFilter={setSelectedCategoryFilter}
            monthOptions={monthOptions}
            hospitalOptions={hospitalOptions}
            userOptions={userOptions}
            filteredCount={filteredRecords.length}
            totalCount={allEvaluatedRecords.length}
            onResetFilters={handleResetFilters}
          />

          {/* 5. PO Line Detail Table */}
          <CompliancePoLineTable
            records={filteredRecords}
            onSelectRecord={setSelectedDetailRecord}
          />
        </>
      )}

      {/* 6. Side-by-Side Audit Modal */}
      {selectedDetailRecord && (
        <ComplianceDetailModal
          record={selectedDetailRecord}
          onClose={() => setSelectedDetailRecord(null)}
        />
      )}
    </div>
  );
};
