import React from 'react';
import { FilterX, Eye, EyeOff, X, Layers, PlusCircle, CheckCircle } from 'lucide-react';
import { SavedGoogleSkuSearchPreset } from '../../../../core/types/spend';

interface SkuExcludedNoticeBannerProps {
  preset: SavedGoogleSkuSearchPreset;
  excludedCount: number;
  hideExcluded: boolean;
  onToggleHideExcluded: (val: boolean) => void;
  onClearExclude: () => void;
  isAppendMode?: boolean;
}

export const SkuExcludedNoticeBanner: React.FC<SkuExcludedNoticeBannerProps> = ({
  preset,
  excludedCount,
  hideExcluded,
  onToggleHideExcluded,
  onClearExclude,
  isAppendMode = false
}) => {
  return (
    <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-blue-50 border border-purple-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 rounded-xl bg-purple-600 text-white shrink-0 shadow-2xs">
          <FilterX className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-purple-950">Filter Exclude Aktif:</span>
            <span className="font-semibold text-purple-800 bg-white/80 px-2 py-0.5 rounded-md border border-purple-200 shadow-2xs">
              "{preset.title}"
            </span>
            {isAppendMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px] border border-emerald-300">
                <PlusCircle className="w-3 h-3 text-emerald-700" />
                Mode Tambah ke Koleksi Ini
              </span>
            )}
          </div>
          <p className="text-slate-600 mt-0.5 text-[11px]">
            {excludedCount > 0 ? (
              hideExcluded ? (
                <span>
                  <strong className="text-purple-900">{excludedCount} SKU</strong> disembunyikan dari hasil karena sudah terdaftar di koleksi ini.
                </span>
              ) : (
                <span>
                  Menampilkan <strong className="text-purple-900">{excludedCount} SKU</strong> yang sudah terdaftar dengan tanda centang terkunci.
                </span>
              )
            ) : (
              <span>
                Tidak ada SKU dari hasil pencarian saat ini yang beririsan dengan koleksi ini.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        {excludedCount > 0 && (
          <button
            type="button"
            onClick={() => onToggleHideExcluded(!hideExcluded)}
            className="px-2.5 py-1.5 rounded-xl border border-purple-300 bg-white hover:bg-purple-100/60 text-purple-900 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title={hideExcluded ? 'Tampilkan kembali baris SKU yang sudah ada di koleksi ini' : 'Sembunyikan baris SKU yang sudah ada di koleksi ini'}
          >
            {hideExcluded ? (
              <>
                <Eye className="w-3.5 h-3.5 text-purple-700" />
                <span>Lihat yang Disembunyikan ({excludedCount})</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-purple-700" />
                <span>Sembunyikan ({excludedCount})</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onClearExclude}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
          title="Tutup & Hapus Filter Exclude Koleksi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
