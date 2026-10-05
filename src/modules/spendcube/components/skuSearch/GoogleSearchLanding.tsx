import React from 'react';
import { Search, Tag, X, BookmarkCheck, ArrowRight, Layers, Clock, Sparkles } from 'lucide-react';
import { GoogleSkuLogo } from './GoogleSkuLogo';
import { SavedGoogleSkuSearchPreset } from '../../../../core/types/spend';

interface GoogleSearchLandingProps {
  keywordInput: string;
  setKeywordInput: (val: string) => void;
  brandInput: string;
  setBrandInput: (val: string) => void;
  onExecuteSearch: (e?: React.FormEvent) => void;
  onQuickSearch: (query: string, brand?: string) => void;
  totalSkuMasterCount: number;
  savedSearches?: SavedGoogleSkuSearchPreset[];
  onOpenSavedSearchesModal?: () => void;
  onLoadSavedPreset?: (preset: SavedGoogleSkuSearchPreset) => void;
}

export const GoogleSearchLanding: React.FC<GoogleSearchLandingProps> = ({
  keywordInput,
  setKeywordInput,
  brandInput,
  setBrandInput,
  onExecuteSearch,
  onQuickSearch,
  totalSkuMasterCount,
  savedSearches = [],
  onOpenSavedSearchesModal,
  onLoadSavedPreset
}) => {
  const formatIDRShort = (val: number | undefined | null) => {
    const num = Number(val) || 0;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}M`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}Jt`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}Rb`;
    return `${num}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[520px] py-8 sm:py-12 px-4 max-w-4xl mx-auto">
      <div className="w-full flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Google-Style SKU Logo with Isometric 3D Box */}
        <div className="flex flex-col items-center gap-3">
          <GoogleSkuLogo className="scale-110 sm:scale-125" />
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              e-Catalogue SKU Search
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Cari spesifikasi SKU master, komoditas sejenis, dan histori transaksi belanja
            </p>
          </div>
        </div>

        {/* Google Search Box (Centered Wide Input) */}
        <form onSubmit={onExecuteSearch} className="w-full max-w-2xl space-y-3">
          <div className="w-full flex items-center bg-white border border-slate-300 hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 rounded-full px-4 py-2.5 shadow-sm hover:shadow transition-all gap-2.5">
            {/* Search icon */}
            <div className="p-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
              <Search className="w-4 h-4" />
            </div>

            {/* Main Input */}
            <input
              id="input-landing-sku-search"
              type="text"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              placeholder="Ketik produk atau komoditas (misal: 'Masker Bedah 3M', 'Paracetamol 500mg')..."
              className="w-full text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
              autoFocus
            />

            {keywordInput && (
              <button
                type="button"
                onClick={() => setKeywordInput('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                title="Hapus teks"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Divider */}
            <div className="h-5 w-px bg-slate-200 shrink-0" />

            {/* Brand Pill */}
            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-200 text-xs shrink-0 focus-within:border-amber-400">
              <Tag className="w-3 h-3 text-amber-600" />
              <input
                id="input-landing-brand-filter"
                type="text"
                value={brandInput}
                onChange={e => setBrandInput(e.target.value)}
                placeholder="Brand (Opt)"
                className="w-16 sm:w-20 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none font-medium"
              />
              {brandInput && (
                <button type="button" onClick={() => setBrandInput('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons: Cari Katalog & Buka Saved Search Langsung dari Halaman Awal */}
          <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
            <button
              id="btn-landing-search-submit"
              type="submit"
              className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Cari Katalog</span>
            </button>

            {onOpenSavedSearchesModal && (
              <button
                type="button"
                onClick={onOpenSavedSearchesModal}
                className="px-5 py-2.5 rounded-full bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border border-indigo-200/80 transition-all cursor-pointer shadow-xs"
                title="Buka daftar koleksi pencarian tersimpan (Saved Searches)"
              >
                <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                <span>Buka Saved Search ({savedSearches.length})</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {totalSkuMasterCount.toLocaleString('id-ID')} master item SKU terdaftar
          </div>
        </form>

        {/* Direct Saved Searches Section on Landing Homepage */}
        <div className="w-full pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Koleksi Saved Search ({savedSearches.length}):
              </span>
            </div>
            {onOpenSavedSearchesModal && (
              <button
                type="button"
                onClick={onOpenSavedSearchesModal}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Kelola Semua ({savedSearches.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {savedSearches.length > 0 && onLoadSavedPreset ? (
            /* Horizontal Cards Grid for Direct Loading from Landing Page */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-left">
              {savedSearches.slice(0, 6).map((preset) => {
                const totalSpend = (preset.selectedItems || []).reduce((acc, it) => acc + (it.totalSpend || 0), 0);
                return (
                  <div
                    key={preset.id}
                    onClick={() => onLoadSavedPreset(preset)}
                    className="p-3.5 rounded-2xl bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold font-mono text-[10px] border border-indigo-200/60">
                          {preset.selectedProductIds?.length || 0} SKU
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(preset.createdAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}</span>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 line-clamp-1 transition-colors" title={preset.title}>
                        {preset.title}
                      </h4>
                      {preset.description ? (
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {preset.description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          Tersimpan dari {preset.searchQuery ? `kueri "${preset.searchQuery}"` : 'AI Query Hub & Preset Intelligence'}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 mt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-slate-400">Spend: </span>
                        <span className="font-mono font-bold text-emerald-600">
                          Rp {formatIDRShort(totalSpend)}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        <span>Buka</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-indigo-50/40 border border-dashed border-indigo-200 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Belum ada koleksi Saved Search tersimpan</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Anda dapat menyimpan kumpulan SKU dari pencarian katalog, atau mengonversi hasil kueri dari AI Query Hub & Preset Intelligence ke Saved Search SKU.
                </p>
              </div>
              {onOpenSavedSearchesModal && (
                <button
                  type="button"
                  onClick={onOpenSavedSearchesModal}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-2xs whitespace-nowrap cursor-pointer transition-colors"
                >
                  Buka Menu Saved Search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Popular Search Suggestions */}
        <div className="w-full pt-4 border-t border-slate-100 flex flex-col items-center gap-2.5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Pencarian Populer:</span>
          <div className="flex flex-wrap justify-center gap-1.5 max-w-xl">
            {[
              { label: 'Masker Bedah 3-Ply', q: 'masker bedah' },
              { label: 'Paracetamol 500mg', q: 'paracetamol 500' },
              { label: 'Spuit 3cc / 5cc', q: 'spuit' },
              { label: 'Kertas HVS A4 80gr', q: 'kertas a4' },
              { label: 'Sarung Tangan Latex', q: 'sarung tangan' },
              { label: 'Alkohol Swab 70%', q: 'alkohol' },
              { label: 'Infus Ringer Lactate', q: 'ringer lactate' },
              { label: 'Monitor Pasien Bedside', q: 'monitor pasien' }
            ].map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => onQuickSearch(p.q)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
