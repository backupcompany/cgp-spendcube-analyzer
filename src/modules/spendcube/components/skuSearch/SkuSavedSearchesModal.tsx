import React, { useState } from 'react';
import { 
  BookmarkCheck, 
  Search, 
  Trash2, 
  Play, 
  Layers, 
  X, 
  ArrowRight,
  Clock,
  Package,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertCircle,
  Plus
} from 'lucide-react';
import { SavedGoogleSkuSearchPreset, SavedGoogleSkuSearchItem } from '../../../../core/types/spend';
import { formatIDR } from './types';

interface SkuSavedSearchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSearches: SavedGoogleSkuSearchPreset[];
  onLoadPreset: (preset: SavedGoogleSkuSearchPreset) => void;
  onDeletePreset: (id: string) => void;
  onUpdatePreset?: (preset: SavedGoogleSkuSearchPreset) => void;
  onAppendNewSearch?: (preset: SavedGoogleSkuSearchPreset) => void;
  getLivePresetStats?: (preset: SavedGoogleSkuSearchPreset) => { totalSpend: number; totalTx: number };
  getLiveItemStats?: (productId: string) => { transactionCount: number; totalSpend: number };
}

export const SkuSavedSearchesModal: React.FC<SkuSavedSearchesModalProps> = ({
  isOpen,
  onClose,
  savedSearches,
  onLoadPreset,
  onDeletePreset,
  onUpdatePreset,
  onAppendNewSearch,
  getLivePresetStats,
  getLiveItemStats
}) => {
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [editingTitlePresetId, setEditingTitlePresetId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');

  if (!isOpen) return null;

  const handleStartRename = (preset: SavedGoogleSkuSearchPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitlePresetId(preset.id);
    setEditTitleValue(preset.title);
  };

  const handleSaveRename = (preset: SavedGoogleSkuSearchPreset, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTitleValue.trim()) return;

    if (onUpdatePreset) {
      const updated: SavedGoogleSkuSearchPreset = {
        ...preset,
        title: editTitleValue.trim(),
        updatedAt: new Date().toISOString()
      };
      onUpdatePreset(updated);
    }
    setEditingTitlePresetId(null);
  };

  const handleDeleteItemFromPreset = (
    preset: SavedGoogleSkuSearchPreset,
    productIdToDelete: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!onUpdatePreset) return;

    const updatedItems = (preset.selectedItems || []).filter(it => it.productId !== productIdToDelete);
    const updatedPIds = (preset.selectedProductIds || []).filter(id => id !== productIdToDelete);

    const updated: SavedGoogleSkuSearchPreset = {
      ...preset,
      selectedItems: updatedItems,
      selectedProductIds: updatedPIds,
      updatedAt: new Date().toISOString()
    };
    onUpdatePreset(updated);
  };

  const filteredSearches = savedSearches.filter(s => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return s.title.toLowerCase().includes(q) || 
      (s.description && s.description.toLowerCase().includes(q)) ||
      (s.searchQuery && s.searchQuery.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20">
              <BookmarkCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Koleksi Saved Search SKU (Playlists)</h3>
              <p className="text-xs text-slate-300">
                Kelola nama, daftar SKU tersimpan, atau terapkan ke dashboard analisa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        {savedSearches.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Cari nama playlist saved search..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Content list */}
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
          {savedSearches.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BookmarkCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-600">Belum ada pencarian SKU yang disimpan</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Cari SKU pada katalog Google Style, pilih satu atau beberapa baris SKU yang relevan, lalu klik "Simpan ke Saved Search".
              </p>
            </div>
          ) : filteredSearches.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Tidak ditemukan Saved Search dengan kata kunci "{filterText}".
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSearches.map(preset => {
                const liveStats = getLivePresetStats ? getLivePresetStats(preset) : null;
                const totalSpend = liveStats && liveStats.totalTx > 0 ? liveStats.totalSpend : (preset.selectedItems || []).reduce((acc, it) => acc + (it.totalSpend || 0), 0);
                const totalTx = liveStats && liveStats.totalTx > 0 ? liveStats.totalTx : (preset.selectedItems || []).reduce((acc, it) => acc + (it.transactionCount || 0), 0);
                const isExpanded = expandedPresetId === preset.id;
                const isEditingTitle = editingTitlePresetId === preset.id;

                return (
                  <div 
                    key={preset.id}
                    className={`rounded-xl border transition-all bg-white overflow-hidden ${
                      isExpanded ? 'border-blue-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Main Row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Title line (with inline rename support) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isEditingTitle ? (
                            <form 
                              onSubmit={e => handleSaveRename(preset, e)} 
                              className="flex items-center gap-1.5"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                autoFocus
                                value={editTitleValue}
                                onChange={e => setEditTitleValue(e.target.value)}
                                className="px-2 py-0.5 text-xs font-bold text-slate-900 border border-blue-500 rounded-md outline-none bg-blue-50/50"
                              />
                              <button
                                type="submit"
                                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                                title="Simpan Nama"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTitlePresetId(null)}
                                className="p-1 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"
                                title="Batal"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-1.5 group/title">
                              <h4 className="font-bold text-slate-900 text-sm">{preset.title}</h4>
                              <button
                                type="button"
                                onClick={e => handleStartRename(preset, e)}
                                className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity cursor-pointer"
                                title="Ubah Nama Saved Search"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {preset.selectedProductIds?.length || 0} SKU
                          </span>

                          {preset.searchQuery && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-1">
                              <Search className="w-2.5 h-2.5" />
                              "{preset.searchQuery}"
                            </span>
                          )}
                        </div>

                        {preset.description && (
                          <p className="text-xs text-slate-600 line-clamp-1">{preset.description}</p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(preset.updatedAt || preset.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">
                            {totalTx} PO • Rp {Math.round(totalSpend).toLocaleString('id-ID')}
                          </span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setExpandedPresetId(isExpanded ? null : preset.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Sembunyikan SKU' : 'Kelola Item SKU'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                        {onAppendNewSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              onAppendNewSearch(preset);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-900 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            title={`Cari SKU baru untuk ditambahkan ke "${preset.title}" (otomatis mengecualikan SKU yang sudah ada)`}
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-700" />
                            <span>Tambah SKU</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onLoadPreset(preset);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Terapkan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus seluruh rekaman saved search "${preset.title}"?`)) {
                              onDeletePreset(preset.id);
                            }
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Seluruh Saved Search"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* EXPANDABLE DRAWER: Manage Individual SKUs (Delete / Remove accidentally added item) */}
                    {isExpanded && (
                      <div className="bg-slate-50/70 border-t border-slate-200 p-3 sm:p-4 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-xs text-slate-600 pb-1 font-semibold">
                          <span>Daftar Item Terdaftar di Playlist Ini ({preset.selectedItems?.length || 0}):</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            Klik tanda hapus (✕) pada item untuk membuang baris yang keliru dimasukkan
                          </span>
                        </div>

                        {(!preset.selectedItems || preset.selectedItems.length === 0) ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            Tidak ada item tersisa di saved search ini.
                          </p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-200/60 rounded-lg border border-slate-200 bg-white">
                            {preset.selectedItems.map((item, idx) => {
                              const liveItem = getLiveItemStats ? getLiveItemStats(item.productId) : null;
                              const txCount = liveItem && liveItem.transactionCount > 0 ? liveItem.transactionCount : (item.transactionCount || 0);
                              const spendAmount = liveItem && liveItem.totalSpend > 0 ? liveItem.totalSpend : (item.totalSpend || 0);

                              return (
                                <div 
                                  key={`${item.productId}-${idx}`}
                                  className="p-2 sm:px-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-800 truncate">
                                      {item.specLine || item.commodityItem}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5 flex-wrap">
                                      <span>ID: <span className="font-mono">{item.productId}</span></span>
                                      <span>•</span>
                                      <span>{item.commodityItem}</span>
                                      <span>•</span>
                                      <span>Brand: <strong>{item.brand || 'NB'}</strong></span>
                                      <span>•</span>
                                      <span className="font-medium text-slate-700">
                                        {txCount} PO {spendAmount > 0 ? `(${formatIDR(spendAmount)})` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={e => handleDeleteItemFromPreset(preset, item.productId, e)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                    title={`Keluarkan "${item.productId}" dari playlist ini`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>{savedSearches.length} playlist tersimpan di IndexedDB browser</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
