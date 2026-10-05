import React from 'react';
import { 
  ContractTargetingSummaryMetrics, 
  OpportunityPriority 
} from '../../../core/types/contractTargeting';
import { 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  PiggyBank, 
  Boxes, 
  GitMerge, 
  RefreshCw, 
  Zap, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface MatrixProps {
  summary: ContractTargetingSummaryMetrics;
  selectedPriority: 'ALL' | OpportunityPriority;
  onSelectPriority: (priority: 'ALL' | OpportunityPriority) => void;
}

export const ContractOpportunityMatrix: React.FC<MatrixProps> = ({
  summary,
  selectedPriority,
  onSelectPriority
}) => {
  const formatIDR = (val: number) => {
    if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(2)} Miliar`;
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)} Juta`;
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

  const spotPercentage = summary.totalAnalyzedSpend > 0
    ? (summary.uncontractedSpotSpend / summary.totalAnalyzedSpend) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* 4 Executive Strategic KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Analyzed Spend */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Belanja Terfilter</p>
            <h4 className="text-lg font-black text-slate-900 truncate">
              {formatIDR(summary.totalAnalyzedSpend)}
            </h4>
            <p className="text-[10px] text-slate-500 truncate">
              {summary.totalPoTransactions.toLocaleString('id-ID')} Baris PO • {summary.totalHospitalUnits} RS
            </p>
          </div>
        </div>

        {/* 2. Uncontracted Spot Leakage */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200/70 flex items-center justify-center text-rose-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Kebocoran Spot Buy</p>
            <h4 className="text-lg font-black text-rose-700 truncate">
              {formatIDR(summary.uncontractedSpotSpend)}
            </h4>
            <p className="text-[10px] font-semibold text-rose-600 truncate">
              {spotPercentage.toFixed(1)}% Belanja Tanpa Payung Kontrak
            </p>
          </div>
        </div>

        {/* 3. Target Cost Savings */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600 shrink-0">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estimasi Potensi Hemat</p>
            <h4 className="text-lg font-black text-emerald-700 truncate">
              {formatIDR(summary.totalEstimatedSavingsIdr)}
            </h4>
            <p className="text-[10px] text-emerald-600 font-semibold truncate">
              Target 8% - 15% dari Negosiasi Kontrak
            </p>
          </div>
        </div>

        {/* 4. Total Commodity Clusters */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200/70 flex items-center justify-center text-purple-600 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Kluster Komoditas</p>
            <h4 className="text-lg font-black text-slate-900 truncate">
              {summary.totalClusters} Kelompok Item
            </h4>
            <p className="text-[10px] text-slate-500 truncate">
              Dari {summary.totalDistinctVendors} Vendor Terdaftar
            </p>
          </div>
        </div>
      </div>

      {/* 4 Interactive Strategic Opportunity Quadrants */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center">
              <span>Sourcing Opportunity Matrix (Kraljic & Contract Targeting)</span>
              {selectedPriority !== 'ALL' && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-extrabold">
                  Filter Aktif: {selectedPriority.replace(/_/g, ' ')}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Pilih salah satu kuadran di bawah ini untuk memfilter tabel penargetan kontrak secara instan.
            </p>
          </div>

          {selectedPriority !== 'ALL' && (
            <button
              onClick={() => onSelectPriority('ALL')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer self-start sm:self-auto"
            >
              Lihat Semua Kluster ({summary.totalClusters})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Quadrant 1: Urgent Blanket Order */}
          <div
            onClick={() => onSelectPriority(selectedPriority === 'P1_BLANKET_CONTRACT' ? 'ALL' : 'P1_BLANKET_CONTRACT')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedPriority === 'P1_BLANKET_CONTRACT'
                ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/40 shadow-sm'
                : 'bg-gradient-to-br from-rose-50/40 to-white border-rose-200/80 hover:border-rose-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-black text-xs shadow-2xs">
                P1
              </div>
              <span className="text-xs font-black text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                {summary.priorityCounts.p1Blanket} Kluster
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 mt-2.5 mb-1">
              Urgent Blanket Order Target
            </h4>
            <p className="text-[11px] text-slate-600 leading-snug">
              Belanja spot tinggi tanpa payung kontrak dengan repetisi PO tinggi. Peluang diskon volume terbesar.
            </p>
            <div className="mt-3 pt-2 border-t border-rose-100 flex items-center justify-between text-[10px] text-rose-700 font-bold">
              <span>Saran: Kontrak Payung 2-Tahun</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Quadrant 2: Rate Harmonization */}
          <div
            onClick={() => onSelectPriority(selectedPriority === 'P2_RATE_HARMONIZATION' ? 'ALL' : 'P2_RATE_HARMONIZATION')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedPriority === 'P2_RATE_HARMONIZATION'
                ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/40 shadow-sm'
                : 'bg-gradient-to-br from-blue-50/40 to-white border-blue-200/80 hover:border-blue-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shadow-2xs">
                P2
              </div>
              <span className="text-xs font-black text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                {summary.priorityCounts.p2RateHarmonization} Kluster
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 mt-2.5 mb-1">
              Rate Card Harmonization (MFC)
            </h4>
            <p className="text-[11px] text-slate-600 leading-snug">
              Disparitas harga &gt;20% antar unit RS pada komoditas identik. Penyelarasan tarif ke patokan terendah.
            </p>
            <div className="mt-3 pt-2 border-t border-blue-100 flex items-center justify-between text-[10px] text-blue-700 font-bold">
              <span>Saran: Klausul MFC Korporat</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Quadrant 3: Vendor Consolidation */}
          <div
            onClick={() => onSelectPriority(selectedPriority === 'P3_VENDOR_CONSOLIDATION' ? 'ALL' : 'P3_VENDOR_CONSOLIDATION')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedPriority === 'P3_VENDOR_CONSOLIDATION'
                ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-400/40 shadow-sm'
                : 'bg-gradient-to-br from-indigo-50/40 to-white border-indigo-200/80 hover:border-indigo-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shadow-2xs">
                P3
              </div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                {summary.priorityCounts.p3VendorConsolidation} Kluster
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 mt-2.5 mb-1">
              Vendor Consolidation
            </h4>
            <p className="text-[11px] text-slate-600 leading-snug">
              Belanja terpecah ke &ge;3 vendor berbeda untuk barang sejenis. Penciutan ke Dual-Preferred Vendor.
            </p>
            <div className="mt-3 pt-2 border-t border-indigo-100 flex items-center justify-between text-[10px] text-indigo-700 font-bold">
              <span>Saran: Dual-Sourcing Program</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Quadrant 4: Tail Spend Catalog Automation */}
          <div
            onClick={() => onSelectPriority(selectedPriority === 'P4_TAIL_AUTOMATION' ? 'ALL' : 'P4_TAIL_AUTOMATION')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedPriority === 'P4_TAIL_AUTOMATION'
                ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/40 shadow-sm'
                : 'bg-gradient-to-br from-amber-50/40 to-white border-amber-200/80 hover:border-amber-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs shadow-2xs">
                P4
              </div>
              <span className="text-xs font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                {summary.priorityCounts.p4TailAutomation} Kluster
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 mt-2.5 mb-1">
              Tail Spend Catalog Lock
            </h4>
            <p className="text-[11px] text-slate-600 leading-snug">
              Barang belanja rutin frekuensi tinggi (&ge;8x PO). Otomasi katalog e-Procurement untuk memangkas OPEX admin.
            </p>
            <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between text-[10px] text-amber-800 font-bold">
              <span>Saran: e-Katalog Auto Replenish</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
