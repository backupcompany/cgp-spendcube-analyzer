import React from 'react';
import { Search, Tag, X, Home, Calendar } from 'lucide-react';
import { UnmappedStats } from './types';
import { SavedGoogleSkuSearchPreset } from '../../../../core/types/spend';
import { SkuExcludeFilterDropdown } from './SkuExcludeFilterDropdown';

interface GoogleSearchResultsHeaderProps {
  keywordInput: string;
  setKeywordInput: (val: string) => void;
  brandInput: string;
  setBrandInput: (val: string) => void;
  committedQuery: string;
  committedBrand: string;
  onExecuteSearch: (e?: React.FormEvent) => void;
  onResetToHome: () => void;
  // Filters
  onlyWithTransactions: boolean;
  setOnlyWithTransactions: (val: boolean) => void;
  includeUnmapped: boolean;
  setIncludeUnmapped: (val: boolean) => void;
  unmappedStats: UnmappedStats;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  // Categories
  availableCategories: string[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  categoryCounts: Record<string, number>;
  // Saved Search Exclusion Filter
  savedSearches?: SavedGoogleSkuSearchPreset[];
  selectedExcludePresetId?: string | null;
  onSelectExcludePresetId?: (id: string | null) => void;
  hideExcluded?: boolean;
  onToggleHideExcluded?: (val: boolean) => void;
  excludedCountInResults?: number;
}

export const GoogleSearchResultsHeader: React.FC<GoogleSearchResultsHeaderProps> = ({
  keywordInput,
  setKeywordInput,
  brandInput,
  setBrandInput,
  committedQuery,
  committedBrand,
  onExecuteSearch,
  onResetToHome,
  onlyWithTransactions,
  setOnlyWithTransactions,
  includeUnmapped,
  setIncludeUnmapped,
  unmappedStats,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  availableCategories,
  selectedCategory,
  setSelectedCategory,
  categoryCounts,
  savedSearches = [],
  selectedExcludePresetId = null,
  onSelectExcludePresetId,
  hideExcluded = true,
  onToggleHideExcluded,
  excludedCountInResults = 0
}) => {
  return (
    <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
      {/* Search Input Bar */}
      <form onSubmit={onExecuteSearch} className="flex flex-col sm:flex-row items-center gap-2">
        {/* Back to Home Button */}
        <button
          type="button"
          onClick={onResetToHome}
          className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
          title="Kembali ke Layar Beranda Pencarian"
        >
          <Home className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Beranda</span>
        </button>

        {/* Main Search Input Container */}
        <div className="w-full flex-1 flex items-center bg-white border border-slate-200 hover:border-slate-300 rounded-full px-3.5 py-1.5 shadow-2xs hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all gap-2">
          <div className="p-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
            <Search className="w-3.5 h-3.5" />
          </div>

          <input
            id="input-google-sku-search"
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            placeholder="Cari produk, komoditas, atau spesifikasi (tekan Enter atau klik Cari)..."
            className="w-full text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />

          {keywordInput && (
            <button
              type="button"
              onClick={() => {
                setKeywordInput('');
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              title="Hapus teks pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Divider */}
          <div className="h-4 w-px bg-slate-200 shrink-0 hidden md:block" />

          {/* Brand Filter */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-full border border-slate-200 text-xs shrink-0 focus-within:border-amber-400 focus-within:bg-amber-50/40">
            <Tag className="w-3 h-3 text-amber-600" />
            <input
              id="input-google-brand-filter"
              type="text"
              value={brandInput}
              onChange={e => setBrandInput(e.target.value)}
              placeholder="Brand (Opt)"
              className="w-20 text-[11px] text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none font-medium"
            />
            {brandInput && (
              <button 
                type="button" 
                onClick={() => setBrandInput('')} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Action Button: Cari */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            id="btn-google-search-submit"
            type="submit"
            className="w-full sm:w-auto px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Cari</span>
          </button>

          {(keywordInput.trim() !== committedQuery.trim() || brandInput.trim() !== committedBrand.trim()) && (
            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 animate-pulse shrink-0 hidden lg:inline-block">
              Tekan Enter / Klik Cari
            </span>
          )}
        </div>
      </form>

      {/* Filter Controls Bar: Hanya Ber-transaksi & Time Range PO */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
        {/* Checkboxes: Hanya yang memiliki transaksi & Sertakan Unmapped */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700 hover:text-slate-900 text-xs">
            <input
              type="checkbox"
              id="checkbox-only-with-transactions"
              checked={onlyWithTransactions}
              onChange={e => setOnlyWithTransactions(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Hanya yang memiliki transaksi</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700 hover:text-slate-900 text-xs">
            <input
              type="checkbox"
              id="checkbox-include-unmapped"
              checked={includeUnmapped}
              onChange={e => setIncludeUnmapped(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <span>Sertakan transaksi belum ter-map</span>
              {unmappedStats.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
                  Unmapped ({unmappedStats.count})
                </span>
              )}
            </span>
          </label>

          {/* Exclude Collection Filter */}
          {onSelectExcludePresetId && onToggleHideExcluded && savedSearches.length > 0 && (
            <>
              <div className="h-3.5 w-px bg-slate-200 hidden md:block" />
              <SkuExcludeFilterDropdown
                presets={savedSearches}
                selectedExcludePresetId={selectedExcludePresetId}
                onSelectExcludePresetId={onSelectExcludePresetId}
                hideExcluded={hideExcluded}
                onToggleHideExcluded={onToggleHideExcluded}
                excludedCountInResults={excludedCountInResults}
              />
            </>
          )}
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Periode PO:
          </span>
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
            <input
              id="input-google-start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-[11px] bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
              title="Tanggal Awal Transaksi"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              id="input-google-end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-[11px] bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
              title="Tanggal Akhir Transaksi"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                title="Hapus filter tanggal"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Category Chips (No slider, wraps cleanly into 2 lines max, only categories in results) */}
      {availableCategories.length > 1 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-2.5 py-0.5 rounded-full text-xs transition-all font-semibold cursor-pointer border ${
                selectedCategory === 'All'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Semua ({categoryCounts['All'] || 0})
            </button>

            {availableCategories.map(cat => {
              if (cat === 'All') return null;
              const isActive = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              const isUnmapped = cat === 'Unmapped' || cat === 'Belum Ter-map';
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-0.5 rounded-full text-xs transition-all font-medium cursor-pointer border ${
                    isActive
                      ? (isUnmapped 
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs' 
                          : 'bg-slate-900 text-white border-slate-900 shadow-2xs')
                      : (isUnmapped
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100')
                  }`}
                >
                  {isUnmapped ? 'Belum Ter-map (Unmapped)' : cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
