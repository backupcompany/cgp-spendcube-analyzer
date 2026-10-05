import React from 'react';
import { FilterX, X, Layers, Check } from 'lucide-react';
import { SavedGoogleSkuSearchPreset } from '../../../../core/types/spend';

interface SkuExcludeFilterDropdownProps {
  presets: SavedGoogleSkuSearchPreset[];
  selectedExcludePresetId: string | null;
  onSelectExcludePresetId: (presetId: string | null) => void;
  hideExcluded: boolean;
  onToggleHideExcluded: (val: boolean) => void;
  excludedCountInResults?: number;
}

export const SkuExcludeFilterDropdown: React.FC<SkuExcludeFilterDropdownProps> = ({
  presets,
  selectedExcludePresetId,
  onSelectExcludePresetId,
  hideExcluded,
  onToggleHideExcluded,
  excludedCountInResults = 0
}) => {
  if (presets.length === 0) return null;

  const activePreset = presets.find(p => p.id === selectedExcludePresetId);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Exclusion Selector Dropdown */}
      <div className="relative inline-flex items-center">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
            activePreset
              ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-2xs'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <FilterX className={`w-3.5 h-3.5 ${activePreset ? 'text-purple-600' : 'text-slate-400'}`} />
          <span className="hidden sm:inline text-slate-500 font-normal">Exclude Koleksi:</span>
          
          <select
            id="select-exclude-preset"
            value={selectedExcludePresetId || ''}
            onChange={e => onSelectExcludePresetId(e.target.value ? e.target.value : null)}
            className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1 max-w-[160px] truncate"
            title="Pilih Saved Search untuk mengecualikan SKU yang sudah ada di dalamnya dari hasil pencarian"
          >
            <option value="">(Tidak Ada Exclude)</option>
            {presets.map(p => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.selectedProductIds?.length || 0} SKU)
              </option>
            ))}
          </select>

          {activePreset && (
            <button
              type="button"
              onClick={() => onSelectExcludePresetId(null)}
              className="p-0.5 text-purple-600 hover:text-purple-900 rounded-full hover:bg-purple-200/50 cursor-pointer ml-0.5"
              title="Batalkan filter exclude koleksi ini"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Hide vs Show Excluded Toggle (Active only when a preset is selected) */}
      {activePreset && (
        <label className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-purple-50/60 border border-purple-200 text-xs text-purple-900 cursor-pointer select-none font-medium hover:bg-purple-100/50 transition-colors">
          <input
            type="checkbox"
            checked={hideExcluded}
            onChange={e => onToggleHideExcluded(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
          />
          <span>Sembunyikan dari hasil</span>
          {excludedCountInResults > 0 && hideExcluded && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-900">
              {excludedCountInResults} tersembunyi
            </span>
          )}
        </label>
      )}
    </div>
  );
};
