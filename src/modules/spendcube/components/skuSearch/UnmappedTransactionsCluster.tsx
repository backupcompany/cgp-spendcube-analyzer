import React from 'react';
import { 
  HelpCircle, 
  ChevronRight, 
  Download, 
  ExternalLink, 
  Building2 
} from 'lucide-react';
import { SpendRecord } from '../../../../core/types/spend';
import { UnmappedStats, formatIDR } from './types';

interface UnmappedTransactionsClusterProps {
  unmappedRecords: SpendRecord[];
  unmappedStats: UnmappedStats;
  committedQuery: string;
  onOpenUnmappedModal: () => void;
  onExportCsv: () => void;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const UnmappedTransactionsCluster: React.FC<UnmappedTransactionsClusterProps> = ({
  unmappedRecords,
  unmappedStats,
  committedQuery,
  onOpenUnmappedModal,
  onExportCsv,
  onSelectRecord
}) => {
  if (unmappedRecords.length === 0) return null;

  return (
    <div className="bg-amber-50/40 rounded-xl border border-amber-200/90 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-2.5 sm:p-3 bg-gradient-to-r from-amber-100/60 to-amber-50/80 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide bg-amber-200 px-1.5 py-0.2 rounded border border-amber-300 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-amber-700" />
              Transaksi Belum Terpetakan (Unmapped)
            </span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900">
            Ditemukan {unmappedStats.count} transaksi PO dengan kata kunci "{committedQuery || 'Semua'}" yang belum memiliki master SKU
          </h3>
        </div>

        {/* Aggregates & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-amber-200 text-xs font-mono">
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block leading-none">Total Belanja</span>
              <span className="font-bold text-amber-950 text-xs">{formatIDR(unmappedStats.totalSpend)}</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block leading-none">Total Qty</span>
              <span className="font-bold text-slate-700 text-xs">{unmappedStats.totalQty.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-amber-100/80 text-amber-900 border border-amber-300 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
            title="Ekspor daftar transaksi belum terpetakan ke CSV"
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenUnmappedModal}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>Lihat Semua ({unmappedStats.count})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preview of top 3 unmapped records */}
      <div className="p-2 sm:p-2.5 divide-y divide-amber-100 text-xs">
        {unmappedRecords.slice(0, 3).map((r, idx) => (
          <div 
            key={r.id || idx}
            onClick={() => onSelectRecord && onSelectRecord(r)}
            className="py-1.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-amber-100/40 rounded transition-colors cursor-pointer"
          >
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {r.purchId}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {r.createdDate?.slice(0, 10)}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium">
                  {r.hospitalCode || 'RS'}
                </span>
                <span className="text-[10px] text-slate-600 truncate max-w-[200px]">
                  {r.vendorName}
                </span>
              </div>
              <p className="font-medium text-slate-900 truncate">
                {r.itemName || r.rawItemName}
              </p>
            </div>

            <div className="text-left sm:text-right font-mono shrink-0">
              <span className="font-bold text-amber-900 text-xs block">
                {formatIDR(r.totalLineAmount)}
              </span>
              <span className="text-[10px] text-slate-500">
                {r.purchQty} {r.purchUnit || 'Unit'} @ {formatIDR(r.purchPrice)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
