import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  FileText, 
  ExternalLink, 
  Layers, 
  HelpCircle, 
  Building2, 
  ChevronLeft, 
  ChevronRight,
  Filter
} from 'lucide-react';
import { SpendRecord, SkuMasterRecord } from '../../../../core/types/spend';
import { MatchedTransactionItem, SkuEnrichedWithStats, formatIDR } from './types';

interface AllMatchedTransactionsViewProps {
  items: MatchedTransactionItem[];
  committedQuery: string;
  onSelectRecord?: (record: SpendRecord) => void;
  onOpenSkuDrillDown?: (sku: SkuEnrichedWithStats) => void;
  skuEnrichedList?: SkuEnrichedWithStats[];
}

export const AllMatchedTransactionsView: React.FC<AllMatchedTransactionsViewProps> = ({
  items,
  committedQuery,
  onSelectRecord,
  onOpenSkuDrillDown,
  skuEnrichedList = []
}) => {
  const [subSearch, setSubSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MAPPED' | 'UNMAPPED'>('ALL');
  const [hospitalFilter, setHospitalFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // SKU Enriched Map for lookup
  const skuEnrichedMap = useMemo(() => {
    const map = new Map<string, SkuEnrichedWithStats>();
    for (const s of skuEnrichedList) {
      const pId = (s.productId || s.sku.id || '').toLowerCase().trim();
      if (pId) map.set(pId, s);
    }
    return map;
  }, [skuEnrichedList]);

  // Unique hospitals in items
  const uniqueHospitals = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.record.hospitalCode) set.add(it.record.hospitalCode);
    }
    return Array.from(set).sort();
  }, [items]);

  // Status counts
  const counts = useMemo(() => {
    let mapped = 0;
    let unmapped = 0;
    let totalSpend = 0;
    for (const it of items) {
      const spend = Number(it.record.totalLineAmount) || 0;
      totalSpend += spend;
      if (it.status === 'EXACT_MATCH' || (it.mappedSku && it.status !== 'UNMAPPED')) {
        mapped++;
      } else {
        unmapped++;
      }
    }
    return {
      all: items.length,
      mapped,
      unmapped,
      totalSpend
    };
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    return items.filter(it => {
      const r = it.record;
      // Status filter
      if (statusFilter === 'MAPPED') {
        const isMapped = it.status === 'EXACT_MATCH' || (Boolean(it.mappedSku) && it.status !== 'UNMAPPED');
        if (!isMapped) return false;
      } else if (statusFilter === 'UNMAPPED') {
        const isUnmapped = it.status === 'UNMAPPED' || it.status === 'PARTIAL_ORPHAN' || !it.mappedSku;
        if (!isUnmapped) return false;
      }

      // Hospital filter
      if (hospitalFilter !== 'ALL' && r.hospitalCode !== hospitalFilter) {
        return false;
      }

      // In-table search filter
      if (subSearch.trim()) {
        const s = subSearch.toLowerCase();
        const pId = (r.purchId || '').toLowerCase();
        const vendor = (r.vendorName || '').toLowerCase();
        const iName = (r.itemName || '').toLowerCase();
        const rawName = (r.rawItemName || '').toLowerCase();
        const notes = (r.itemNotes || '').toLowerCase();
        const prName = (r.purchReqName || '').toLowerCase();
        const skuName = (it.mappedSku?.name || '').toLowerCase();
        const skuCode = (it.mappedSku?.productId || '').toLowerCase();

        if (
          !pId.includes(s) &&
          !vendor.includes(s) &&
          !iName.includes(s) &&
          !rawName.includes(s) &&
          !notes.includes(s) &&
          !prName.includes(s) &&
          !skuName.includes(s) &&
          !skuCode.includes(s)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [items, statusFilter, hospitalFilter, subSearch]);

  const filteredTotalSpend = useMemo(() => {
    return filtered.reduce((acc, it) => acc + (Number(it.record.totalLineAmount) || 0), 0);
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const rows = filtered.map(it => {
      const r = it.record;
      return {
        'No PO': r.purchId || '',
        'Tanggal PO': r.createdDate || '',
        'Unit RS': r.hospitalCode || '',
        'Vendor': r.vendorName || '',
        'Deskripsi Item PO': r.itemName || '',
        'Nama Asli Excel': r.rawItemName || '',
        'Catatan Item': r.itemNotes || '',
        'Judul PR': r.purchReqName || '',
        'Kategori': r.procurementCategory || '',
        'Qty': r.purchQty || 0,
        'Satuan': r.purchUnit || '',
        'Harga Satuan': r.purchPrice || 0,
        'Total Nilai (Spend)': r.totalLineAmount || 0,
        'Status Pemetaan': it.status,
        'Kode Master SKU': it.mappedSku?.productId || '',
        'Nama Master SKU': it.mappedSku?.name || ''
      };
    });

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String((row as any)[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transaksi_lengkap_${committedQuery || 'semua'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2.5">
      {/* Top Banner & Metric Aggregates */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 sm:p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide bg-blue-100 px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1">
                <FileText className="w-3 h-3 text-blue-700" />
                Audit Transaksi Lengkap (Paritas 100%)
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
              Ditemukan {items.length} Transaksi PO yang Memuat "{committedQuery || 'Semua'}"
            </h3>
            <p className="text-xs text-slate-500">
              Mencakup pencarian di nama item PO, catatan (Alt+Enter), judul PR, kategori belanja, vendor, dan nomor PO.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs shrink-0 font-mono">
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block leading-none uppercase">Total Belanja</span>
              <span className="font-bold text-slate-900 text-xs">{formatIDR(counts.totalSpend)}</span>
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block leading-none uppercase">Terpetakan</span>
              <span className="font-bold text-emerald-700 text-xs">{counts.mapped} PO</span>
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block leading-none uppercase">Belum Ter-map</span>
              <span className="font-bold text-amber-700 text-xs">{counts.unmapped} PO</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('MAPPED'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'MAPPED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terpetakan ({counts.mapped})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('UNMAPPED'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'UNMAPPED'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum Ter-map ({counts.unmapped})
            </button>
          </div>

          {/* Hospital Filter & Search Box & Export */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Hospital Filter */}
            {uniqueHospitals.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={hospitalFilter}
                  onChange={e => { setHospitalFilter(e.target.value); setCurrentPage(1); }}
                  className="text-xs bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua RS ({uniqueHospitals.length})</option>
                  {uniqueHospitals.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            )}

            {/* In-table Search */}
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 focus-within:ring-1 focus-within:ring-blue-500">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={subSearch}
                onChange={e => { setSubSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Cari di tabel..."
                className="text-xs bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none w-28 sm:w-36"
              />
              {subSearch && (
                <button
                  type="button"
                  onClick={() => setSubSearch('')}
                  className="text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
              title="Ekspor daftar transaksi lengkap ke CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>CSV ({filtered.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3 whitespace-nowrap">No PO & Tanggal</th>
                <th className="py-2.5 px-3 whitespace-nowrap">RS & Vendor</th>
                <th className="py-2.5 px-3 min-w-[260px]">Deskripsi Item PO & Judul PR</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">Qty & Harga Satuan</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">Total Nilai</th>
                <th className="py-2.5 px-3 min-w-[180px]">Status Pemetaan SKU</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.length > 0 ? (
                pageItems.map((it, idx) => {
                  const r = it.record;
                  const isMapped = it.status === 'EXACT_MATCH' || (Boolean(it.mappedSku) && it.status !== 'UNMAPPED');
                  const pIdLower = it.mappedSku?.productId ? it.mappedSku.productId.toLowerCase().trim() : '';
                  const enrichedSku = pIdLower ? skuEnrichedMap.get(pIdLower) : undefined;

                  return (
                    <tr 
                      key={r.id || `${r.purchId}-${idx}`}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      {/* PO & Date */}
                      <td className="py-2 px-3 align-top whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 block text-xs">
                          {r.purchId}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {r.createdDate?.slice(0, 10) || '-'}
                        </span>
                      </td>

                      {/* Hospital & Vendor */}
                      <td className="py-2 px-3 align-top whitespace-nowrap">
                        <span className="inline-block font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded text-[10px] border border-blue-200 mb-0.5">
                          {r.hospitalCode || 'RS'}
                        </span>
                        <div className="font-medium text-slate-800 text-[11px] truncate max-w-[150px]" title={r.vendorName}>
                          {r.vendorName || '-'}
                        </div>
                      </td>

                      {/* Item description & PR title */}
                      <td className="py-2 px-3 align-top">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 leading-snug">
                            {r.itemName || r.rawItemName}
                          </p>
                          {r.itemNotes && (
                            <p className="text-[10px] text-slate-500 font-mono bg-slate-50 p-1 rounded border border-slate-200 whitespace-pre-line leading-tight">
                              {r.itemNotes}
                            </p>
                          )}
                          {r.purchReqName && (
                            <p className="text-[10px] text-indigo-700 bg-indigo-50/50 px-1 rounded inline-block font-medium">
                              PR: {r.purchReqName}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Qty & Unit Price */}
                      <td className="py-2 px-3 align-top text-right whitespace-nowrap font-mono">
                        <span className="font-bold text-slate-700 block">
                          {(Number(r.purchQty) || 0).toLocaleString('id-ID')} {r.purchUnit || 'Unit'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          @{formatIDR(Number(r.purchPrice) || 0)}
                        </span>
                      </td>

                      {/* Total Nilai */}
                      <td className="py-2 px-3 align-top text-right whitespace-nowrap font-mono">
                        <span className="font-bold text-slate-900 text-xs">
                          {formatIDR(Number(r.totalLineAmount) || 0)}
                        </span>
                      </td>

                      {/* Status Pemetaan SKU */}
                      <td className="py-2 px-3 align-top">
                        {isMapped && it.mappedSku ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Terpetakan
                            </span>
                            <div className="font-mono text-[10px] font-bold text-slate-700">
                              {it.mappedSku.productId}
                            </div>
                            <div className="text-[10px] text-slate-600 line-clamp-1" title={it.mappedSku.name}>
                              {it.mappedSku.commodityItem || it.mappedSku.name}
                            </div>
                            {enrichedSku && onOpenSkuDrillDown && (
                              <button
                                type="button"
                                onClick={() => onOpenSkuDrillDown(enrichedSku)}
                                className="text-[9px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>Lihat di Katalog SKU</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ) : it.status === 'PARTIAL_ORPHAN' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              <HelpCircle className="w-3 h-3 text-amber-600" />
                              Partial Orphan
                            </span>
                            <p className="text-[10px] text-slate-500 line-clamp-1">
                              Kandidat: {it.mappedSku?.name || 'Perlu Verifikasi'}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            <HelpCircle className="w-3 h-3 text-rose-600" />
                            Belum Terpetakan
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-2 px-3 align-top text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectRecord && onSelectRecord(r)}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition-colors cursor-pointer"
                          title="Buka rincian lengkap transaksi"
                        >
                          Detail PO
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada transaksi yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {totalPages > 1 && (
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              Menampilkan {Math.min(filtered.length, (safePage - 1) * pageSize + 1)} - {Math.min(filtered.length, safePage * pageSize)} dari {filtered.length} transaksi
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="px-2 font-mono font-semibold text-slate-700">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
