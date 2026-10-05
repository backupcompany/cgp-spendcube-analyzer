import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Layers, 
  FileSpreadsheet, 
  TrendingDown, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { ComplianceSummaryStats } from '../../services/skuPoComplianceService';

interface ComplianceKpiCardsProps {
  stats: ComplianceSummaryStats;
  selectedMonth?: string;
  onFilterCategory?: (category: string) => void;
}

export const ComplianceKpiCards: React.FC<ComplianceKpiCardsProps> = ({
  stats,
  selectedMonth,
  onFilterCategory
}) => {
  const formatIDRShort = (val: number) => {
    if (val >= 1e9) return `Rp ${(val / 1e9).toFixed(1)} M`;
    if (val >= 1e6) return `Rp ${(val / 1e6).toFixed(1)} Jt`;
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. Total PO Lines */}
      <div 
        onClick={() => onFilterCategory?.('ALL')}
        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total PO Lines</span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-black text-slate-900 tracking-tight font-mono">
            {stats.totalPoLines.toLocaleString('id-ID')}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Spend: {formatIDRShort(stats.totalSpend)}</span>
            <span className="text-slate-400 font-mono">{stats.totalMonths} Bulan</span>
          </div>
        </div>
      </div>

      {/* 2. Match (Compliant) */}
      <div 
        onClick={() => onFilterCategory?.('MATCHED_ONLY')}
        className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group bg-gradient-to-br from-white via-white to-emerald-50/30"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Match (Compliant)</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-black text-emerald-700 tracking-tight font-mono">
              {stats.matchedCount.toLocaleString('id-ID')}
            </p>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
              {stats.matchedRate}%
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium truncate">
            {stats.exactMatchCount} Sempurna + {stats.codeDiffDescCount} Kode Valid
          </p>
        </div>
      </div>

      {/* 3. Belum Match (Non-Compliant - Target Menuju 0) */}
      <div 
        onClick={() => onFilterCategory?.('UNMATCHED_ONLY')}
        className={`bg-white rounded-2xl p-4 border shadow-2xs transition-all cursor-pointer group bg-gradient-to-br from-white via-white ${
          stats.unmatchedCount > 0 
            ? 'border-rose-300 to-rose-50/40 hover:border-rose-400' 
            : 'border-slate-200 to-slate-50 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Belum Match</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-100 text-rose-700 uppercase">
              Target 0%
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-black text-rose-700 tracking-tight font-mono">
              {stats.unmatchedCount.toLocaleString('id-ID')}
            </p>
            <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full font-mono">
              {stats.unmatchedRate}%
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-rose-600">
            <span>Perlu Tindak Lanjut Unit</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
          </div>
        </div>
      </div>

      {/* 4. Match Kode SKU Tapi Deskripsi PO Berbeda / Diedit */}
      <div 
        onClick={() => onFilterCategory?.('MATCH_CODE_DIFF_DESC')}
        className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs hover:border-amber-300 transition-all cursor-pointer group bg-gradient-to-br from-white via-white to-amber-50/30"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Deskripsi PO Berbeda</span>
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-black text-amber-700 tracking-tight font-mono">
              {stats.codeDiffDescCount.toLocaleString('id-ID')}
            </p>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-mono">
              {stats.codeDiffDescRate}%
            </span>
          </div>
          <p className="text-[11px] text-amber-600 font-medium truncate" title="Kode SKU Cocok, namun nama PO diedit manual">
            Kode Cocok, Deskripsi Diedit (Tetap Match)
          </p>
        </div>
      </div>

      {/* 5. Kode SKU Tidak Ditemukan di MDM */}
      <div 
        onClick={() => onFilterCategory?.('CODE_NOT_IN_MDM')}
        className="bg-white rounded-2xl p-4 border border-purple-200 shadow-2xs hover:border-purple-300 transition-all cursor-pointer group bg-gradient-to-br from-white via-white to-purple-50/30"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Kode SKU Belum di MDM</span>
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-black text-purple-700 tracking-tight font-mono">
              {stats.codeNotInMdmCount.toLocaleString('id-ID')}
            </p>
            <span className="text-xs font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full font-mono">
              {stats.codeNotInMdmRate}%
            </span>
          </div>
          <p className="text-[11px] text-purple-600 font-medium truncate" title="Harus dicari / didaftarkan ke MDM">
            Perlu Didaftarkan / Dicari di MDM
          </p>
        </div>
      </div>
    </div>
  );
};
