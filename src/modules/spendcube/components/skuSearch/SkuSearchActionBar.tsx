import React from 'react';
import { 
  BarChart3, 
  List, 
  BookmarkCheck, 
  CheckSquare, 
  Square, 
  FolderTree,
  Sparkles,
  Layers,
  ArrowRight,
  FilterX,
  PlusCircle,
  X
} from 'lucide-react';
import { SavedGoogleSkuSearchPreset } from '../../../../core/types/spend';

interface SkuSearchActionBarProps {
  activeView: 'list' | 'dashboard';
  setActiveView: (view: 'list' | 'dashboard') => void;
  // Selection
  totalItemCount: number;
  selectedCount: number;
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  onOpenSaveModal: () => void;
  // Saved searches modal
  savedSearchesCount: number;
  onOpenSavedSearchesModal: () => void;
  // Active loaded preset filter indicator
  activePreset: SavedGoogleSkuSearchPreset | null;
  onClearActivePreset: () => void;
  // Transaction stats for selected
  selectedSpend: number;
  selectedTxCount: number;
  // Exclude & Append mode
  excludePreset?: SavedGoogleSkuSearchPreset | null;
  onClearExcludePreset?: () => void;
  isAppendMode?: boolean;
}

export const SkuSearchActionBar: React.FC<SkuSearchActionBarProps> = ({
  activeView,
  setActiveView,
  totalItemCount,
  selectedCount,
  isAllSelected,
  onToggleSelectAll,
  onOpenSaveModal,
  savedSearchesCount,
  onOpenSavedSearchesModal,
  activePreset,
  onClearActivePreset,
  selectedSpend,
  selectedTxCount,
  excludePreset,
  onClearExcludePreset,
  isAppendMode = false
}) => {
  return (
    <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      {/* Left side: View Mode Toggle & Selection Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View Switcher: Daftar Hasil (Google Style) vs Visual Dashboard (Treemap & Charts) */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveView('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'list'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Hasil Katalog SKU</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Visual Dashboard & Treemap</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* Select All / Deselect All Toggle */}
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          title={isAllSelected ? 'Batalkan pilihan semua baris' : 'Pilih semua baris SKU pada hasil kueri'}
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-50" />
          ) : (
            <Square className="w-4 h-4 text-slate-400" />
          )}
          <span>{isAllSelected ? 'Batalkan Semua' : `Pilih Semua (${totalItemCount})`}</span>
        </button>

        {/* Selected count and metrics badge */}
        {selectedCount > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs">
            <span className="font-bold text-blue-800">{selectedCount} SKU dipilih</span>
            <span className="text-blue-300">•</span>
            <span className="text-blue-700 text-[11px] font-medium">
              {selectedTxCount} PO (Rp {Math.round(selectedSpend).toLocaleString('id-ID')})
            </span>
          </div>
        )}
      </div>

      {/* Right side: Saved Search Actions */}
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
        {/* Active Saved Preset Filter Banner (if loaded) */}
        {activePreset && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold">
            <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />
            <span className="truncate max-w-[150px]">{activePreset.title}</span>
            <button
              type="button"
              onClick={onClearActivePreset}
              className="text-amber-600 hover:text-amber-800 ml-1 underline cursor-pointer text-[10px]"
            >
              Reset
            </button>
          </div>
        )}

        {/* Exclude / Append Target Preset indicator (if active) */}
        {excludePreset && !activePreset && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
            isAppendMode 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
              : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}>
            {isAppendMode ? (
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <FilterX className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            )}
            <span className="truncate max-w-[140px]">
              {isAppendMode ? `Target: ${excludePreset.title}` : `Exclude: ${excludePreset.title}`}
            </span>
            {onClearExcludePreset && (
              <button
                type="button"
                onClick={onClearExcludePreset}
                className="text-slate-400 hover:text-slate-700 ml-0.5 cursor-pointer"
                title="Hapus filter exclude ini"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Open Saved Searches Modal Button */}
        <button
          type="button"
          onClick={onOpenSavedSearchesModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
          title="Buka daftar rekaman saved search tersimpan"
        >
          <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" />
          <span>Saved Search ({savedSearchesCount})</span>
        </button>

        {/* Save Selected button */}
        <button
          type="button"
          onClick={onOpenSaveModal}
          disabled={selectedCount === 0}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xs cursor-pointer ${
            isAppendMode && excludePreset
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title={selectedCount === 0 ? 'Pilih minimal 1 baris SKU untuk disimpan' : 'Simpan baris SKU terpilih ke dalam rekaman Saved Search'}
        >
          {isAppendMode && excludePreset ? (
            <>
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="truncate max-w-[170px]">Tambah ke "{excludePreset.title}"</span>
            </>
          ) : (
            <>
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Simpan ke Saved Search</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
