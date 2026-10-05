import React, { useMemo } from 'react';
import { Search, Filter, RotateCcw, Building2, FileSpreadsheet, FolderTree, Tag, X } from 'lucide-react';
import { SpendFilterCriteria, OrphanFilterType } from '../../../core/types/spend';

interface FilterBarProps {
  criteria: SpendFilterCriteria;
  onFilterChange: (newCriteria: SpendFilterCriteria) => void;
  hospitals: string[];
  categories: string[];
}

export const FilterBar: React.FC<FilterBarProps> = React.memo(({
  criteria,
  onFilterChange,
  hospitals,
  categories
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...criteria, searchQuery: e.target.value });
  };

  const handleHospitalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...criteria, hospitalCode: e.target.value });
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...criteria, sourceFile: e.target.value });
  };

  const handleSpendTypeChange = (type: 'all' | 'CAPEX' | 'OPEX') => {
    onFilterChange({ ...criteria, spendType: type });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...criteria, category: e.target.value });
  };

  const handleOrphanFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...criteria, orphanFilter: e.target.value as OrphanFilterType });
  };

  const handleReset = () => {
    onFilterChange({
      searchQuery: '',
      hospitalCode: 'ALL',
      sourceFile: 'ALL',
      spendType: 'all',
      category: 'ALL',
      vendorName: 'ALL',
      startDate: '',
      endDate: '',
      orphanFilter: 'ALL'
    });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (criteria.searchQuery.trim()) count++;
    if (criteria.hospitalCode !== 'ALL') count++;
    if (criteria.sourceFile !== 'ALL') count++;
    if (criteria.spendType !== 'all') count++;
    if (criteria.category !== 'ALL') count++;
    if (criteria.orphanFilter && criteria.orphanFilter !== 'ALL') count++;
    return count;
  }, [criteria]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs mb-6 overflow-hidden">
      {/* Top Filter Header Bar */}
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Search input with ERP border */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vendor name, item description, PO#, or category..."
            value={criteria.searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 shadow-2xs font-sans transition-all placeholder:text-slate-400"
          />
          {criteria.searchQuery && (
            <button
              onClick={() => onFilterChange({ ...criteria, searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right side controls: Spend Type Segmented Control & Reset */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
          {/* Spend Type Segmented Tabs */}
          <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSpendTypeChange('all')}
              className={`px-3 py-1 rounded-md transition-all ${
                criteria.spendType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleSpendTypeChange('CAPEX')}
              className={`px-3 py-1 rounded-md transition-all ${
                criteria.spendType === 'CAPEX'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CAPEX
            </button>
            <button
              type="button"
              onClick={() => handleSpendTypeChange('OPEX')}
              className={`px-3 py-1 rounded-md transition-all ${
                criteria.spendType === 'OPEX'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              OPEX
            </button>
          </div>

          {/* Active Filters & Reset */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-lg transition-colors gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Structured ERP Dropdown Row */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1 font-mono uppercase">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Hospital Facility</span>
          </div>
          <select
            value={criteria.hospitalCode}
            onChange={handleHospitalChange}
            className="w-full px-2.5 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white transition-colors"
          >
            <option value="ALL">All Hospital Units ({hospitals.length})</option>
            {hospitals.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1 font-mono uppercase">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>Source Dataset</span>
          </div>
          <select
            value={criteria.sourceFile}
            onChange={handleSourceChange}
            className="w-full px-2.5 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white transition-colors"
          >
            <option value="ALL">All Consolidated Sources (4 Files)</option>
            <option value="capex_d365">Capex D365 (File 1)</option>
            <option value="opex_d365">Opex D365 (File 2)</option>
            <option value="capex_ax">Capex AX (File 3)</option>
            <option value="opex_ax">Opex AX (File 4)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1 font-mono uppercase">
            <FolderTree className="w-3.5 h-3.5 text-slate-400" />
            <span>Procurement Taxonomy</span>
          </div>
          <select
            value={criteria.category}
            onChange={handleCategoryChange}
            className="w-full px-2.5 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white transition-colors"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1 font-mono uppercase">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>Master SKU / Orphan Matching</span>
          </div>
          <select
            value={criteria.orphanFilter || 'ALL'}
            onChange={handleOrphanFilterChange}
            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white transition-colors ${
              criteria.orphanFilter && criteria.orphanFilter !== 'ALL'
                ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                : 'bg-slate-50/70 border-slate-200 text-slate-800'
            }`}
          >
            <option value="ALL">All Matching Status</option>
            <option value="EXACT_MATCH">Exact Match (100% Reconciled)</option>
            <option value="PARTIAL_ORPHAN">Partial Orphan (Semua Skor 40%–94%)</option>
            <option value="PARTIAL_40">Partial Orphan 40% (Substring / Nama Mirip)</option>
            <option value="PARTIAL_50">Partial Orphan 50% (Komoditas Cocok)</option>
            <option value="PARTIAL_60">Partial Orphan 60%–70% (Komoditas + Brand/Part#)</option>
            <option value="PARTIAL_80">Partial Orphan 80% (Komoditas + Spesifikasi)</option>
            <option value="PARTIAL_90">Partial Orphan 90%+ (Komoditas + Spec + Brand/Part#)</option>
            <option value="FULL_ORPHAN">Full Orphan (0% - Belum Cocok)</option>
          </select>
        </div>
      </div>
    </div>
  );
});

