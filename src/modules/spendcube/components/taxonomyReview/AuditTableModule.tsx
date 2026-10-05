import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  HardDrive, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Search, 
  Filter, 
  Check, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Sparkles 
} from 'lucide-react';
import { UniqueItemMappingSummary } from './types';

interface AuditTableModuleProps {
  uniqueItemsList: UniqueItemMappingSummary[];
  onSelectItem: (item: UniqueItemMappingSummary) => void;
}

export function getUnifiedStatusBadge(item: UniqueItemMappingSummary) {
  const isManual = item.persistedCacheItem?.matchTier === 'MANUAL' || item.matchReason?.includes('Manual');
  if (isManual) {
    return {
      groupLabel: 'Rekonsiliasi Manual',
      code: 'MANUAL',
      label: 'Manual User',
      fullLabel: 'Rekonsiliasi Manual (Ditetapkan User)',
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      badgeBorder: 'border-indigo-200',
      dotColor: 'bg-indigo-500'
    };
  }

  // KELOMPOK 2: ANOMALI KODE SKU (INPUT ERROR / SKU BARU)
  if (item.extractedSkuCode && item.orphanStatus !== 'EXACT_MATCH') {
    return {
      groupLabel: 'Kelompok 2: Anomali Kode SKU',
      code: 'CODE_NOT_IN_MDM',
      label: '2A. Kode Belum di MDM',
      fullLabel: '2A. Kode SKU Belum di MDM (Anomali File Upload)',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
      badgeBorder: 'border-rose-200',
      dotColor: 'bg-rose-500'
    };
  }

  // KELOMPOK 1: MATCH DEFINITIF (COMPLIANT)
  if (item.orphanStatus === 'EXACT_MATCH') {
    const tier = item.persistedCacheItem?.matchTier;
    if (item.extractedSkuCode) {
      const isDescDiff = item.matchReason?.toLowerCase().includes('deskripsi berbeda') || (item.matchedSku && item.primaryItemName.toLowerCase().trim() !== item.matchedSku.name.toLowerCase().trim());
      if (isDescDiff) {
        return {
          groupLabel: 'Kelompok 1: Match Definitif',
          code: 'MATCH_CODE_DIFF_DESC',
          label: '1B. Match Kode SKU',
          fullLabel: '1B. Match Kode SKU (Deskripsi PO Diedit)',
          badgeBg: 'bg-amber-50',
          badgeText: 'text-amber-700',
          badgeBorder: 'border-amber-200',
          dotColor: 'bg-amber-500'
        };
      }
      return {
        groupLabel: 'Kelompok 1: Match Definitif',
        code: 'MATCH_EXACT',
        label: '1A. Match Sempurna',
        fullLabel: '1A. Match Sempurna (Kode & Deskripsi Sesuai)',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        dotColor: 'bg-emerald-500'
      };
    }

    if (tier === 'COMPONENT_EXACT' || tier === 'FUZZY_HIGH' || item.confidenceScore < 100) {
      return {
        groupLabel: 'Kelompok 1: Match Definitif',
        code: 'COMPONENT_MATCH',
        label: '1D. Match 4-Pilar',
        fullLabel: '1D. Match 4-Pilar Otomatis (Komponen Identik ≥85%)',
        badgeBg: 'bg-teal-50',
        badgeText: 'text-teal-700',
        badgeBorder: 'border-teal-200',
        dotColor: 'bg-teal-500'
      };
    }

    return {
      groupLabel: 'Kelompok 1: Match Definitif',
      code: 'MATCH_NAME_ONLY',
      label: '1C. Match Nama Saja',
      fullLabel: '1C. Match Nama Saja (Tanpa Kode SKU)',
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-700',
      badgeBorder: 'border-sky-200',
      dotColor: 'bg-sky-500'
    };
  }

  // KELOMPOK 3: PARTIAL ORPHAN (5 SUB-TAHAPAN TINGKAT KEMIRIPAN)
  if (item.orphanStatus === 'PARTIAL_ORPHAN') {
    const score = item.confidenceScore || 0;
    if (score >= 90) {
      return {
        groupLabel: 'Kelompok 3: Partial Orphan',
        code: 'PARTIAL_90',
        label: '3A. Partial Orphan 90%+',
        fullLabel: '3A. Partial Orphan 90%+ (Sangat Tinggi: Komoditas + Spec + Brand/Part#)',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-800',
        badgeBorder: 'border-indigo-200',
        dotColor: 'bg-indigo-600'
      };
    }
    if (score >= 80) {
      return {
        groupLabel: 'Kelompok 3: Partial Orphan',
        code: 'PARTIAL_80',
        label: '3B. Partial Orphan 80%–89%',
        fullLabel: '3B. Partial Orphan 80%–89% (Tinggi: Komoditas + Spesifikasi Cocok)',
        badgeBg: 'bg-purple-50',
        badgeText: 'text-purple-800',
        badgeBorder: 'border-purple-200',
        dotColor: 'bg-purple-600'
      };
    }
    if (score >= 60) {
      return {
        groupLabel: 'Kelompok 3: Partial Orphan',
        code: 'PARTIAL_60',
        label: '3C. Partial Orphan 60%–79%',
        fullLabel: '3C. Partial Orphan 60%–79% (Sedang: Komoditas + Brand/Part# Cocok)',
        badgeBg: 'bg-violet-50',
        badgeText: 'text-violet-800',
        badgeBorder: 'border-violet-200',
        dotColor: 'bg-violet-600'
      };
    }
    if (score >= 50) {
      return {
        groupLabel: 'Kelompok 3: Partial Orphan',
        code: 'PARTIAL_50',
        label: '3D. Partial Orphan 50%–59%',
        fullLabel: '3D. Partial Orphan 50%–59% (Rendah: Komoditas Dasar Cocok)',
        badgeBg: 'bg-fuchsia-50',
        badgeText: 'text-fuchsia-800',
        badgeBorder: 'border-fuchsia-200',
        dotColor: 'bg-fuchsia-600'
      };
    }
    return {
      groupLabel: 'Kelompok 3: Partial Orphan',
      code: 'PARTIAL_40',
      label: '3E. Partial Orphan ≤45%',
      fullLabel: '3E. Partial Orphan ≤45% (Sangat Rendah: Substring / Nama Mirip)',
      badgeBg: 'bg-pink-50',
      badgeText: 'text-pink-800',
      badgeBorder: 'border-pink-200',
      dotColor: 'bg-pink-600'
    };
  }

  // KELOMPOK 4: FULL ORPHAN / BELUM TERDAFTAR (ROGUE / FREE-TEXT)
  return {
    groupLabel: 'Kelompok 4: Full Orphan',
    code: 'FULL_ORPHAN',
    label: '4A. Belum Terdaftar',
    fullLabel: '4A. Belum Terdaftar (Full Orphan 0% / Free-Text)',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    dotColor: 'bg-slate-500'
  };
}

export const AuditTableModule: React.FC<AuditTableModuleProps> = ({
  uniqueItemsList,
  onSelectItem
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXACT_MATCH' | 'CODE_NOT_IN_MDM' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN'>('ALL');
  const [persistenceFilter, setPersistenceFilter] = useState<'ALL' | 'PERSISTED' | 'NOT_PERSISTED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Overall KPIs
  const kpis = useMemo(() => {
    const total = uniqueItemsList.length;
    if (total === 0) {
      return { total: 0, persisted: 0, persistedPct: 0, exact: 0, exactPct: 0, partial: 0, partialPct: 0, orphan: 0, orphanPct: 0 };
    }
    const persisted = uniqueItemsList.filter(i => i.isPersistedInDisk).length;
    const exact = uniqueItemsList.filter(i => i.orphanStatus === 'EXACT_MATCH').length;
    const partial = uniqueItemsList.filter(i => i.orphanStatus === 'PARTIAL_ORPHAN').length;
    const orphan = uniqueItemsList.filter(i => i.orphanStatus === 'FULL_ORPHAN').length;

    return {
      total,
      persisted,
      persistedPct: Math.round((persisted / total) * 100),
      exact,
      exactPct: Math.round((exact / total) * 100),
      partial,
      partialPct: Math.round((partial / total) * 100),
      orphan,
      orphanPct: Math.round((orphan / total) * 100)
    };
  }, [uniqueItemsList]);

  // Unique categories for filtering
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of uniqueItemsList) {
      if (item.taxonomyLv1 && item.taxonomyLv1 !== 'UNMAPPED / ORPHAN PO' && item.taxonomyLv1 !== 'ORPHAN') {
        set.add(item.taxonomyLv1);
      }
    }
    return Array.from(set).sort();
  }, [uniqueItemsList]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return uniqueItemsList.filter(item => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CODE_NOT_IN_MDM') {
          if (!item.extractedSkuCode || item.orphanStatus === 'EXACT_MATCH') return false;
        } else if (statusFilter === 'EXACT_MATCH') {
          if (item.orphanStatus !== 'EXACT_MATCH') return false;
        } else if (statusFilter === 'PARTIAL_ORPHAN') {
          if (item.orphanStatus !== 'PARTIAL_ORPHAN' || Boolean(item.extractedSkuCode)) return false;
        } else if (statusFilter === 'FULL_ORPHAN') {
          if (item.orphanStatus !== 'FULL_ORPHAN' || Boolean(item.extractedSkuCode)) return false;
        }
      }
      if (persistenceFilter === 'PERSISTED' && !item.isPersistedInDisk) {
        return false;
      }
      if (persistenceFilter === 'NOT_PERSISTED' && item.isPersistedInDisk) {
        return false;
      }
      if (categoryFilter !== 'ALL' && item.taxonomyLv1 !== categoryFilter) {
        return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const raw = item.rawItemName.toLowerCase();
        const clean = item.primaryItemName.toLowerCase();
        const code = (item.extractedSkuCode || '').toLowerCase();
        const matched = (item.matchedSku?.name || item.matchedSku?.formattedSkuName || item.matchedSkuId || '').toLowerCase();
        const reason = item.matchReason.toLowerCase();
        if (!raw.includes(s) && !clean.includes(s) && !code.includes(s) && !matched.includes(s) && !reason.includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [uniqueItemsList, statusFilter, persistenceFilter, categoryFilter, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="space-y-4">
      {/* Executive Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Unique Items */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Item Unik PO</span>
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Variasi item unik transaksi
          </div>
        </div>

        {/* Persisted in Harddisk */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-xs font-medium">Tersimpan di Disk</span>
            <HardDrive className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-2">
            <span>{kpis.persisted.toLocaleString()}</span>
            <span className="text-xs font-semibold text-blue-600">({kpis.persistedPct}%)</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-500" />
            IndexedDB Offline Persistence
          </div>
        </div>

        {/* Exact Match */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-medium">Exact Match (≥95%)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 flex items-baseline gap-2">
            <span>{kpis.exact.toLocaleString()}</span>
            <span className="text-xs font-semibold text-emerald-700">({kpis.exactPct}%)</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Cocok terstandarisasi master SKU
          </div>
        </div>

        {/* Partial Orphan */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-medium">Partial Orphan (50–94%)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 flex items-baseline gap-2">
            <span>{kpis.partial.toLocaleString()}</span>
            <span className="text-xs font-semibold text-amber-700">({kpis.partialPct}%)</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Kandidat komoditas cocok
          </div>
        </div>

        {/* Full Orphan */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-medium">Full Orphan (&lt;50%)</span>
            <HelpCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 flex items-baseline gap-2">
            <span>{kpis.orphan.toLocaleString()}</span>
            <span className="text-xs font-semibold text-rose-700">({kpis.orphanPct}%)</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Belum ada pasangan master SKU
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama barang, kode SKU, dll..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">Semua Kelompok Status</option>
              <option value="EXACT_MATCH">Kelompok 1: Match Definitif (1A–1D)</option>
              <option value="CODE_NOT_IN_MDM">Kelompok 2: Anomali Kode SKU (2A)</option>
              <option value="PARTIAL_ORPHAN">Kelompok 3: Partial Orphan (3A–3E)</option>
              <option value="FULL_ORPHAN">Kelompok 4: Full Orphan (4A)</option>
            </select>
          </div>

          {/* Disk Cache Persistence Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">Disk:</span>
            <select
              value={persistenceFilter}
              onChange={e => {
                setPersistenceFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Semua Cache</option>
              <option value="PERSISTED">Tersimpan di Harddisk</option>
              <option value="NOT_PERSISTED">Belum Tersimpan (Pending)</option>
            </select>
          </div>

          {/* Taxonomy Lv 1 Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">Level 1:</span>
            <select
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
            >
              <option value="ALL">Semua Kategori (Level 1)</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter stats bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div>
            Menampilkan <span className="font-semibold text-slate-800">{filteredItems.length.toLocaleString()}</span> dari total <span className="font-semibold text-slate-800">{uniqueItemsList.length.toLocaleString()}</span> item unik PO
          </div>
          <div className="flex items-center gap-2">
            <span>Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-0.5 px-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Review Table (Zero PO / Zero Commercial Value) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama Barang Asli PO & 4 Pilar PO</th>
                <th className="py-3 px-4 w-48">Hasil Pencocokan</th>
                <th className="py-3 px-4 w-40">Tingkat Akurasi</th>
                <th className="py-3 px-4">Master Data SKU Cocok</th>
                <th className="py-3 px-4">Hierarki Taksonomi Master</th>
                <th className="py-3 px-4 text-center w-28">Status Cache</th>
                <th className="py-3 px-4 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ada item yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const status = getUnifiedStatusBadge(item);
                  return (
                    <tr
                      key={item.itemKey}
                      onClick={() => onSelectItem(item)}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                    >
                      {/* Column 1: PO Item & 4 Pillars */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1.5">
                          <div className="font-semibold text-slate-900 text-xs">
                            {item.primaryItemName}
                          </div>
                          
                          {item.itemNotes && (
                            <div className="text-[10px] text-slate-500 line-clamp-1 italic">
                              Catatan: {item.itemNotes}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-600 pt-1 border-t border-slate-100">
                            <div><span className="text-slate-400">Komoditas:</span> {item.poCommodity}</div>
                            <div><span className="text-slate-400">Spec:</span> {item.poSpec}</div>
                            <div><span className="text-slate-400">Brand:</span> {item.poBrand}</div>
                            <div><span className="text-slate-400">Part#:</span> {item.poPartNumber}</div>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                              {item.transactionCount}x Transaksi PO
                            </span>
                            {item.extractedSkuCode && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[9px] border border-blue-200">
                                SKU::{item.extractedSkuCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Hasil Pencocokan (Status Tagging) */}
                      <td className="py-3 px-4 align-top w-48">
                        <div className="space-y-1">
                          <span 
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${status.badgeBg} ${status.badgeText} ${status.badgeBorder} shadow-2xs`}
                            title={status.fullLabel}
                          >
                            <span className={`w-2 h-2 rounded-full ${status.dotColor} shrink-0`}></span>
                            <span className="truncate">{status.label}</span>
                          </span>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {status.groupLabel}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Tingkat Akurasi */}
                      <td className="py-3 px-4 align-top w-40">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Skor</span>
                            <span className="text-xs font-extrabold text-slate-900 font-mono">
                              {item.confidenceScore}%
                            </span>
                          </div>

                          {/* Confidence Progress Bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.confidenceScore >= 90
                                  ? 'bg-emerald-500'
                                  : item.confidenceScore >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(item.confidenceScore, 100)}%` }}
                            />
                          </div>

                          <div className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed" title={item.matchReason}>
                            {item.matchReason}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Matched Master SKU */}
                      <td className="py-3 px-4 align-top">
                        {item.orphanStatus === 'EXACT_MATCH' && item.matchedSku ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900 font-mono text-[11px] text-blue-700">
                              {item.matchedSku.productId || item.matchedSku.id}
                            </div>
                            <div className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-tight">
                              {item.matchedSku.formattedSkuName || item.matchedSku.name}
                            </div>
                            <div className="text-[10px] text-slate-500 grid grid-cols-2 gap-x-1">
                              <div><span className="text-slate-400">Brand:</span> {item.matchedSku.brand || '-'}</div>
                              <div><span className="text-slate-400">Part#:</span> {item.matchedSku.partNumber || '-'}</div>
                            </div>
                          </div>
                        ) : item.orphanStatus === 'PARTIAL_ORPHAN' && item.targetSku ? (
                          <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800">
                              <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Saran Kandidat (Belum Terpetakan)</span>
                            </div>
                            <div className="font-mono text-[11px] font-bold text-amber-900">
                              [{item.targetSku.productId || item.targetSku.id}] {item.targetSku.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Komoditas: {item.targetSku.commodityItem || '-'}
                            </div>
                          </div>
                        ) : item.matchedSku ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900 font-mono text-[11px] text-blue-700">
                              {item.matchedSku.productId || item.matchedSku.id}
                            </div>
                            <div className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-tight">
                              {item.matchedSku.formattedSkuName || item.matchedSku.name}
                            </div>
                            <div className="text-[10px] text-slate-500 grid grid-cols-2 gap-x-1">
                              <div><span className="text-slate-400">Brand:</span> {item.matchedSku.brand || '-'}</div>
                              <div><span className="text-slate-400">Part#:</span> {item.matchedSku.partNumber || '-'}</div>
                            </div>
                          </div>
                        ) : item.matchedSkuId ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-xs text-slate-700 font-semibold">
                              {item.matchedSkuId}
                            </span>
                            <p className="text-[10px] text-slate-400">ID Terpasang di Cache</p>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">
                            Belum terpasang master SKU
                          </div>
                        )}
                      </td>

                      {/* Column 4: Master Taxonomy Hierarchy */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-800">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">Lv 1</span>
                            <span>{item.taxonomyLv1}</span>
                          </div>
                          
                          <div className="text-[10px] text-slate-500 space-y-0.5 pl-2 border-l-2 border-slate-200">
                            <div><span className="text-slate-400 font-medium">Lv 2:</span> {item.taxonomyLv2}</div>
                            {item.taxonomyLv3 && item.taxonomyLv3 !== item.taxonomyLv2 && (
                              <div><span className="text-slate-400 font-medium">Lv 3:</span> {item.taxonomyLv3}</div>
                            )}
                            <div><span className="text-slate-400 font-medium">Lv 5 (Komoditas):</span> <strong className="text-slate-700 font-semibold">{item.taxonomyLv5}</strong></div>
                          </div>
                        </div>
                      </td>

                      {/* Column 5: Persistence Status */}
                      <td className="py-3 px-4 align-top text-center">
                        {item.isPersistedInDisk ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <HardDrive className="w-3 h-3 text-blue-600" />
                            Persisted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Column 6: Action */}
                      <td className="py-3 px-4 align-top text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(item);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          title="Lihat Detail Analisis Pembobotan"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Halaman <span className="font-semibold text-slate-900">{currentPage}</span> dari <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">{currentPage}</span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
