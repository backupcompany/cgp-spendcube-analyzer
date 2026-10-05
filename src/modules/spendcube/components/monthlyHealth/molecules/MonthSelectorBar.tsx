import React from 'react';
import { 
  Calendar, 
  Building2, 
  Search, 
  Download, 
  RefreshCw,
  Filter
} from 'lucide-react';

interface Props {
  availableYears: number[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  availableHospitals: string[];
  selectedHospital: string;
  onSelectHospital: (hospital: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExportCsv: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const MonthSelectorBar: React.FC<Props> = ({
  availableYears,
  selectedYear,
  onSelectYear,
  availableHospitals,
  selectedHospital,
  onSelectHospital,
  searchQuery,
  onSearchChange,
  onExportCsv,
  onRefresh,
  isRefreshing = false
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Year Tabs & Hospital Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Switcher Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1.5 shrink-0" />
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => onSelectYear(year)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedYear === year
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Hospital Scope Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <Building2 className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5 font-medium">Unit RS:</span>
            <select
              value={selectedHospital}
              onChange={(e) => onSelectHospital(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-2"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                Semua Unit RS ({availableHospitals.length} Unit)
              </option>
              {availableHospitals.map(h => (
                <option key={h} value={h} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Search & Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari bulan / berkas..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Muat Ulang Agregasi"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Export Button */}
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Unduh Lembar Rekonsiliasi Excel / CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span className="hidden sm:inline">Export Rekonsiliasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
