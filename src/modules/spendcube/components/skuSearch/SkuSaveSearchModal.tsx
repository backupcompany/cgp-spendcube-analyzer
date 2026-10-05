import React, { useState } from 'react';
import { 
  BookmarkCheck, 
  X, 
  PlusCircle, 
  FolderPlus, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { SavedGoogleSkuSearchItem, SavedGoogleSkuSearchPreset } from '../../../../core/types/spend';

interface SkuSaveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: SavedGoogleSkuSearchItem[];
  searchQuery: string;
  brandFilter?: string;
  selectedCategory?: string;
  existingPresets: SavedGoogleSkuSearchPreset[];
  initialPresetId?: string;
  initialSaveMode?: 'new' | 'append';
  onSaveSuccess: (savedPreset: SavedGoogleSkuSearchPreset, mode: 'new' | 'append') => void;
}

export const SkuSaveSearchModal: React.FC<SkuSaveSearchModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  searchQuery,
  brandFilter = '',
  selectedCategory = 'All',
  existingPresets = [],
  initialPresetId,
  initialSaveMode,
  onSaveSuccess
}) => {
  const [saveMode, setSaveMode] = useState<'new' | 'append'>(
    initialSaveMode || (existingPresets.length > 0 ? 'append' : 'new')
  );

  const defaultTitle = searchQuery 
    ? `Katalog: ${searchQuery}${brandFilter ? ` (${brandFilter})` : ''}`
    : `Koleksi SKU (${selectedItems.length} item)`;

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    initialPresetId || (existingPresets.length > 0 ? existingPresets[0].id : '')
  );

  // Sync when initialPresetId changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialPresetId && existingPresets.some(p => p.id === initialPresetId)) {
        setSelectedPresetId(initialPresetId);
        setSaveMode('append');
      } else if (existingPresets.length > 0) {
        if (!selectedPresetId || !existingPresets.some(p => p.id === selectedPresetId)) {
          setSelectedPresetId(existingPresets[0].id);
        }
      }
    }
  }, [isOpen, initialPresetId, existingPresets]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalSpend = selectedItems.reduce((acc, it) => acc + (it.totalSpend || 0), 0);
  const totalQty = selectedItems.reduce((acc, it) => acc + (it.totalQty || 0), 0);
  const totalTx = selectedItems.reduce((acc, it) => acc + (it.transactionCount || 0), 0);

  const targetExistingPreset = existingPresets.find(p => p.id === selectedPresetId);

  // Calculate deduplication stats when appending to existing playlist
  let newSkusCount = selectedItems.length;
  let duplicateCount = 0;
  if (saveMode === 'append' && targetExistingPreset) {
    const existingIds = new Set(targetExistingPreset.selectedProductIds || []);
    for (const it of selectedItems) {
      if (existingIds.has(it.productId)) {
        duplicateCount++;
      }
    }
    newSkusCount = selectedItems.length - duplicateCount;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (saveMode === 'new') {
      if (!title.trim()) {
        setError('Nama Saved Search baru wajib diisi.');
        return;
      }

      try {
        setIsSaving(true);
        const newPreset: SavedGoogleSkuSearchPreset = {
          id: `sku-saved-search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: title.trim(),
          description: description.trim() || undefined,
          searchQuery: searchQuery || '',
          brandFilter: brandFilter || undefined,
          selectedCategory: selectedCategory || 'All',
          selectedItems,
          selectedProductIds: selectedItems.map(it => it.productId),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        onSaveSuccess(newPreset, 'new');
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Gagal menyimpan rekaman pencarian baru.');
      } finally {
        setIsSaving(false);
      }
    } else {
      // Append mode to existing playlist
      if (!targetExistingPreset) {
        setError('Pilih Saved Search tujuan yang ingin ditambahkan.');
        return;
      }

      try {
        setIsSaving(true);
        // Deduplicate using Map by productId to ensure idempotent additions (never double counts)
        const combinedMap = new Map<string, SavedGoogleSkuSearchItem>();
        for (const it of (targetExistingPreset.selectedItems || [])) {
          combinedMap.set(it.productId, it);
        }
        for (const it of selectedItems) {
          // Add or refresh metadata without duplication
          combinedMap.set(it.productId, it);
        }

        const combinedItems = Array.from(combinedMap.values());
        const combinedProductIds = combinedItems.map(it => it.productId);

        const updatedPreset: SavedGoogleSkuSearchPreset = {
          ...targetExistingPreset,
          selectedItems: combinedItems,
          selectedProductIds: combinedProductIds,
          updatedAt: new Date().toISOString()
        };

        onSaveSuccess(updatedPreset, 'append');
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Gagal menambahkan SKU ke Saved Search terpilih.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20">
              <BookmarkCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Simpan ke Saved Search (Playlist SKU)</h3>
              <p className="text-xs text-blue-100">Kelola dan kumpulkan {selectedItems.length} baris SKU terpilih</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-blue-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Selector (Playlist Concept) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSaveMode('append')}
              disabled={existingPresets.length === 0}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                saveMode === 'append'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah ke Existing ({existingPresets.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSaveMode('new')}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                saveMode === 'new'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Buat Saved Search Baru</span>
            </button>
          </div>

          {/* Metrics summary banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 font-medium block">SKU Terpilih Saat Ini:</span>
              <span className="font-bold text-blue-900 text-sm">{selectedItems.length} Baris</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 font-medium block">Transaksi PO Terkait:</span>
              <span className="font-bold text-slate-800 text-xs">
                {totalTx} PO • Rp {Math.round(totalSpend).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* APPEND MODE INPUTS */}
          {saveMode === 'append' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Pilih Saved Search / Playlist Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedPresetId}
                  onChange={e => setSelectedPresetId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium text-slate-900"
                >
                  {existingPresets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.title} ({preset.selectedProductIds?.length || 0} SKU saat ini)
                    </option>
                  ))}
                </select>
              </div>

              {targetExistingPreset && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700 font-semibold">
                    <span>{targetExistingPreset.title}</span>
                    <span className="text-blue-700 font-bold">
                      {targetExistingPreset.selectedProductIds?.length || 0} → {(targetExistingPreset.selectedProductIds?.length || 0) + newSkusCount} SKU
                    </span>
                  </div>
                  {targetExistingPreset.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-1">{targetExistingPreset.description}</p>
                  )}
                  <div className="pt-1 flex items-center gap-3 text-[10px] text-slate-500 border-t border-slate-200/60">
                    <span className="text-emerald-700 font-medium">+{newSkusCount} SKU baru ditambahkan</span>
                    {duplicateCount > 0 && (
                      <span className="text-amber-700 font-medium">• {duplicateCount} SKU sudah ada (di-deduplikasi)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NEW MODE INPUTS */}
          {saveMode === 'new' && (
            <div className="space-y-3">
              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Nama Saved Search Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Paket Pengadaan Spuit & Infus 2026"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium text-slate-900"
                />
              </div>

              {/* Description input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Catatan / Deskripsi (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Tambahkan catatan tujuan pengadaan, nama proyek, atau kelompok analisa..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Summary Preview of Selected SKU lines */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Daftar Baris SKU yang Akan Dimasukkan ({selectedItems.length})
            </label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50 p-1">
              {selectedItems.map((it, idx) => (
                <div key={`${it.productId}-${idx}`} className="p-2 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate">{it.specLine || it.commodityItem}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      ID: <span className="font-mono">{it.productId}</span> • {it.commodityItem} • {it.brand || 'NB'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 text-[11px]">
                    <span className="font-semibold text-slate-700 block">
                      {it.transactionCount} PO
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      Rp {Math.round(it.totalSpend || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || (saveMode === 'append' && !targetExistingPreset)}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSaving 
                  ? 'Menyimpan...' 
                  : (saveMode === 'append' ? 'Tambahkan ke Playlist' : 'Simpan Saved Search')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
