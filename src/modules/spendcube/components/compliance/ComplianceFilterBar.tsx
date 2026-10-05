import React from 'react';
import { 
  Filter, 
  Search, 
  RotateCcw, 
  Building2, 
  User, 
  Calendar, 
  Layers, 
  X,
  ShieldAlert
} from 'lucide-react';
import { COMPLIANCE_CATEGORIES, SkuComplianceCategory } from '../../services/skuPoComplianceService';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface ComplianceFilterBarProps {
  // Filter values
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedMonth: string;
  setSelectedMonth: (val: string) => void;
  selectedHospital: string;
  setSelectedHospital: (val: string) => void;
  selectedUser: string;
  setSelectedUser: (val: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (val: string) => void;

  // Options
  monthOptions: FilterOption[];
  hospitalOptions: FilterOption[];
  userOptions: FilterOption[];

  // Counts
  filteredCount: number;
  totalCount: number;
  onResetFilters: () => void;
}

export const ComplianceFilterBar: React.FC<ComplianceFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedMonth,
  setSelectedMonth,
  selectedHospital,
  setSelectedHospital,
  selectedUser,
  setSelectedUser,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
  monthOptions,
  hospitalOptions,
  userOptions,
  filteredCount,
  totalCount,
  onResetFilters
}) => {
  const hasActiveFilters = Boolean(
    searchQuery.trim() || 
    selectedMonth || 
    selectedHospital || 
    selectedUser || 
    selectedCategoryFilter !== 'ALL'
  );

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
      {/* Top Row: Search & Reset */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nomor PO, nama item, kode SKU, petugas, atau rekanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Counter and Reset */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          <div className="text-xs text-slate-500 font-mono">
            Menampilkan <strong className="text-slate-900">{filteredCount.toLocaleString('id-ID')}</strong> dari{' '}
            <span>{totalCount.toLocaleString('id-ID')}</span> PO Line
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: 4 Required Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-slate-100">
        {/* 1. Bulan & Tahun Transaksi */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-blue-600" />
            <span>Bulan & Tahun Transaksi</span>
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="">Semua Bulan (Seluruh Periode)</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} {opt.count !== undefined ? `(${opt.count})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Hospital Unit */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3 h-3 text-indigo-600" />
            <span>Hospital Unit (Cabang RS)</span>
          </label>
          <select
            value={selectedHospital}
            onChange={(e) => setSelectedHospital(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="">Semua Hospital Unit</option>
            {hospitalOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} {opt.count !== undefined ? `(${opt.count})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Pengguna / Petugas Tercatat pada PO */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3 text-emerald-600" />
            <span>Petugas / Pengguna PO</span>
          </label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="">Semua Pengguna / Petugas</option>
            {userOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} {opt.count !== undefined ? `(${opt.count})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Jenis Ketidaksesuaian / Status Matching */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-600" />
            <span>Hasil Pencocokan (Status Compliance)</span>
          </label>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">Semua Kategori Pencocokan</option>
            <option value="UNMATCHED_ONLY">⚠️ HANYA PO LINE BELUM MATCH (Target 0%)</option>
            <option value="MATCHED_ONLY">✅ HANYA PO LINE MATCH (Compliant)</option>
            <option value="MATCH_EXACT">1A. Match Sempurna (Kode & Deskripsi Sesuai)</option>
            <option value="MATCH_CODE_DIFF_DESC">1B. Match Kode SKU (Deskripsi PO Diedit)</option>
            <option value="MATCH_NAME_ONLY">1C. Match Nama Saja (Tanpa Kode SKU)</option>
            <option value="CODE_NOT_IN_MDM">2A. Kode SKU Belum di MDM (Anomali File Upload)</option>
            <option value="PARTIAL_MATCH">3. Partial Orphan (Kemiripan Parsial)</option>
            <option value="UNMATCHED_NO_SKU">4A. Belum Terdaftar (Full Orphan / Free-Text)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
