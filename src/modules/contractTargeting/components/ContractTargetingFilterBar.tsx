import React from 'react';
import { ContractTargetingFilter, OpportunityPriority, DEFAULT_CONTRACT_FILTER } from '../../../core/types/contractTargeting';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  Sparkles, 
  Layers, 
  Building2, 
  Calendar, 
  MapPin, 
  SlidersHorizontal,
  ChevronDown,
  ShieldAlert
} from 'lucide-react';

interface FilterBarProps {
  filter: ContractTargetingFilter;
  onFilterChange: (newFilter: ContractTargetingFilter) => void;
  onScan: () => void;
  onReset: () => void;
  isScanning: boolean;
  categoriesLv1: string[];
  categoriesLv2: string[];
  islands: string[];
  regions: string[];
  hospitals: string[];
}

export const ContractTargetingFilterBar: React.FC<FilterBarProps> = ({
  filter,
  onFilterChange,
  onScan,
  onReset,
  isScanning,
  categoriesLv1,
  categoriesLv2,
  islands,
  regions,
  hospitals
}) => {
  const currentFilter = filter || DEFAULT_CONTRACT_FILTER;

  const handleChange = (key: keyof ContractTargetingFilter, value: any) => {
    onFilterChange({
      ...currentFilter,
      [key]: value
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
      {/* Top Row: Search and Primary Category Slicing */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama barang komoditas, keyword medis, nama vendor..."
            value={currentFilter.searchQuery || ''}
            onChange={(e) => handleChange('searchQuery', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Category Level 1 */}
        <div className="w-full sm:w-56">
          <div className="relative">
            <select
              value={currentFilter.categoryLv1 || 'ALL'}
              onChange={(e) => handleChange('categoryLv1', e.target.value)}
              aria-label="Filter Kategori Level 1"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all appearance-none pr-8 cursor-pointer"
            >
              <option value="ALL">Semua Kategori (L1)</option>
              {categoriesLv1.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Category Level 2 */}
        <div className="w-full sm:w-56">
          <div className="relative">
            <select
              value={currentFilter.categoryLv2 || 'ALL'}
              onChange={(e) => handleChange('categoryLv2', e.target.value)}
              aria-label="Filter Subkategori Level 2"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all appearance-none pr-8 cursor-pointer"
            >
              <option value="ALL">Semua Subkategori (L2)</option>
              {categoriesLv2.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Scan Button */}
        <button
          onClick={onScan}
          disabled={isScanning}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer shrink-0"
        >
          <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Memindai & Mengelompokkan...' : 'Scan & Target Peluang Kontrak'}</span>
        </button>
      </div>

      {/* Second Row: Granular Filters (Island, Region, Hospital, Contract Status, Priority, Min Spend, Min Volume) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-2 border-t border-slate-100 text-xs">
        {/* Island */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Wilayah / Pulau
          </label>
          <select
            value={currentFilter.island || 'ALL'}
            onChange={(e) => handleChange('island', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">Semua Pulau</option>
            {islands.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        {/* Region */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Regional Hub
          </label>
          <select
            value={currentFilter.region || 'ALL'}
            onChange={(e) => handleChange('region', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">Semua Region</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Hospital Unit */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Unit RS
          </label>
          <select
            value={currentFilter.hospitalCode || 'ALL'}
            onChange={(e) => handleChange('hospitalCode', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">Semua Unit RS ({hospitals.length})</option>
            {hospitals.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        {/* Contract Status Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Status Kontrak
          </label>
          <select
            value={currentFilter.contractStatusFilter || 'ALL'}
            onChange={(e) => handleChange('contractStatusFilter', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="UNCONTRACTED_ONLY">⚠️ Spot Buy Only (&lt;20% Kontrak)</option>
            <option value="CONTRACTED_ONLY">✅ Terkontrak (&gt;80%)</option>
            <option value="MIXED_ONLY">⚖️ Campuran (Partial Spot)</option>
          </select>
        </div>

        {/* Opportunity Priority */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Target Prioritas
          </label>
          <select
            value={currentFilter.priorityFilter || 'ALL'}
            onChange={(e) => handleChange('priorityFilter', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">Semua Prioritas</option>
            <option value="P1_BLANKET_CONTRACT">P1: Urgent Blanket Order</option>
            <option value="P2_RATE_HARMONIZATION">P2: Rate Harmonization</option>
            <option value="P3_VENDOR_CONSOLIDATION">P3: Vendor Consolidation</option>
            <option value="P4_TAIL_AUTOMATION">P4: e-Catalog Lock</option>
            <option value="MONITORED_STANDARD">Monitored Standard</option>
          </select>
        </div>

        {/* Min Spend Threshold */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Min. Belanja
          </label>
          <select
            value={currentFilter.minSpendThreshold || 0}
            onChange={(e) => handleChange('minSpendThreshold', Number(e.target.value))}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value={0}>Semua Nilai</option>
            <option value={10000000}>&ge; Rp 10 Jt</option>
            <option value={50000000}>&ge; Rp 50 Jt</option>
            <option value={100000000}>&ge; Rp 100 Jt</option>
            <option value={500000000}>&ge; Rp 500 Jt</option>
          </select>
        </div>

        {/* Min Volume Threshold */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Min. Volume
          </label>
          <select
            value={currentFilter.minVolumeThreshold || 0}
            onChange={(e) => handleChange('minVolumeThreshold', Number(e.target.value))}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value={0}>Semua Volume</option>
            <option value={100}>&ge; 100 Qty</option>
            <option value={500}>&ge; 500 Qty</option>
            <option value={1000}>&ge; 1.000 Qty</option>
            <option value={5000}>&ge; 5.000 Qty</option>
            <option value={10000}>&ge; 10.000 Qty</option>
            <option value={50000}>&ge; 50.000 Qty</option>
          </select>
        </div>
      </div>

      {/* Bottom Row: Date range & Reset action */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 text-slate-500">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-slate-700 flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Rentang Transaksi:
          </span>
          <input
            type="date"
            value={currentFilter.startDate || ''}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs"
          />
          <span>s/d</span>
          <input
            type="date"
            value={currentFilter.endDate || ''}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onReset}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
