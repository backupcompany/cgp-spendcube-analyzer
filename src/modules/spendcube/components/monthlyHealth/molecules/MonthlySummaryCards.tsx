import React from 'react';
import { MonthlyIngestionYearlySummary } from '../../../../../core/types/spend';
import { 
  DollarSign, 
  Layers, 
  FileCheck2, 
  CalendarCheck2, 
  ArrowUpRight, 
  RefreshCw,
  Clock
} from 'lucide-react';

interface Props {
  summary: MonthlyIngestionYearlySummary;
}

export const MonthlySummaryCards: React.FC<Props> = ({ summary }) => {
  const formatIDR = (val: number) => {
    if (val >= 1_000_000_000_000) {
      return `Rp ${(val / 1_000_000_000_000).toFixed(2)} T`;
    }
    if (val >= 1_000_000_000) {
      return `Rp ${(val / 1_000_000_000).toFixed(2)} M`;
    }
    if (val >= 1_000_000) {
      return `Rp ${(val / 1_000_000).toFixed(1)} Jt`;
    }
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

  const formatDateTime = (isoStr: string | null) => {
    if (!isoStr) return 'Belum ada data';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Ingested Spend & OPEX/CAPEX split */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Total Belanja Ingestion ({summary.year})
          </span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-2">
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight" title={`Rp ${summary.totalSpend.toLocaleString('id-ID')}`}>
            {formatIDR(summary.totalSpend)}
          </h3>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              OPEX: {formatIDR(summary.totalOpexSpend)} ({summary.opexPct.toFixed(1)}%)
            </span>
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              CAPEX: {formatIDR(summary.totalCapexSpend)} ({summary.capexPct.toFixed(1)}%)
            </span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
            <div 
              className="bg-emerald-500 h-full" 
              style={{ width: `${summary.opexPct}%` }}
              title={`OPEX: ${summary.opexPct.toFixed(1)}%`}
            />
            <div 
              className="bg-indigo-600 h-full" 
              style={{ width: `${summary.capexPct}%` }}
              title={`CAPEX: ${summary.capexPct.toFixed(1)}%`}
            />
          </div>
        </div>
      </div>

      {/* Card 2: Volume Qty & Line Items */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Volume Fisik &amp; Pesanan (PO)
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {summary.totalQty.toLocaleString('id-ID')}
          </h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">unit item</span>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Nomor PO Unik</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
              {summary.totalPoCount.toLocaleString('id-ID')} PO
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Baris Line</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
              {summary.totalRecordCount.toLocaleString('id-ID')} baris
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Ingestion Fidelity & Uploaded Files */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Integritas Data Ingestion
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileCheck2 className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {summary.overallFidelityPct}%
          </h3>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Keunikan Baris</span>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{summary.totalFilesUploaded} Berkas</span>
            <span className="text-slate-400">sumber aktif</span>
          </div>
          {summary.totalOverwrittenLines > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
              {summary.totalOverwrittenLines.toLocaleString('id-ID')} baris ditimpa
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
              100% Unik Murni
            </span>
          )}
        </div>
      </div>

      {/* Card 4: Gregorian Span Coverage & Latest Update */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Cakupan Kalender Gregorian
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <CalendarCheck2 className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {summary.monthsWithDataCount} <span className="text-sm font-semibold text-slate-400">/ 12 Bulan</span>
          </h3>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            ({Math.round((summary.monthsWithDataCount / 12) * 100)}% Terisi)
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            Update: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDateTime(summary.latestOverallIngestedAt)}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
