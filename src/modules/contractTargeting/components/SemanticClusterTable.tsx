import React, { useState, useMemo } from 'react';
import { SemanticSpendCluster, OpportunityPriority } from '../../../core/types/contractTargeting';
import { KraljicBadge, PriorityBadge, ContractCoverageBar } from './badges/ContractBadges';
import { 
  Search, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Sparkles, 
  BookmarkPlus, 
  ChevronDown, 
  ChevronUp,
  Building2,
  Store,
  Eye,
  Download,
  Calendar
} from 'lucide-react';

interface TableProps {
  clusters: SemanticSpendCluster[];
  selectedPriority?: 'ALL' | OpportunityPriority;
  onSelectPriority?: (priority: 'ALL' | OpportunityPriority) => void;
  onSelectCluster: (cluster: SemanticSpendCluster) => void;
  onOpenSourcingBrief: (cluster: SemanticSpendCluster) => void;
  onPinToPipeline: (cluster: SemanticSpendCluster) => void;
  onExportCsv: () => void;
}

type SortField = 'spend' | 'qty' | 'po' | 'priority' | 'contract' | 'savings' | 'name';

export const SemanticClusterTable: React.FC<TableProps> = ({
  clusters,
  selectedPriority = 'ALL',
  onSelectPriority,
  onSelectCluster,
  onOpenSourcingBrief,
  onPinToPipeline,
  onExportCsv
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  
  // Volume Filter in Table Toolbar
  const [volumeFilter, setVolumeFilter] = useState<'ALL' | '100' | '500' | '1000' | '5000' | '10000' | '50000' | 'custom'>('ALL');
  const [minVolumeInput, setMinVolumeInput] = useState<string>('');
  const [maxVolumeInput, setMaxVolumeInput] = useState<string>('');

  const formatIDR = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setCurrentPage(1);
  };

  const filteredClusters = useMemo(() => {
    let result = clusters;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.clusterName.toLowerCase().includes(q) ||
        c.categoryLv1.toLowerCase().includes(q) ||
        c.categoryLv2.toLowerCase().includes(q) ||
        c.uniqueVendors.some(v => v.vendorName.toLowerCase().includes(q))
      );
    }

    // Volume Range Filter
    if (volumeFilter !== 'ALL') {
      if (volumeFilter === '100') {
        result = result.filter(c => c.totalQty >= 100);
      } else if (volumeFilter === '500') {
        result = result.filter(c => c.totalQty >= 500);
      } else if (volumeFilter === '1000') {
        result = result.filter(c => c.totalQty >= 1000);
      } else if (volumeFilter === '5000') {
        result = result.filter(c => c.totalQty >= 5000);
      } else if (volumeFilter === '10000') {
        result = result.filter(c => c.totalQty >= 10000);
      } else if (volumeFilter === '50000') {
        result = result.filter(c => c.totalQty >= 50000);
      } else if (volumeFilter === 'custom') {
        const min = minVolumeInput ? parseFloat(minVolumeInput) : 0;
        const max = maxVolumeInput ? parseFloat(maxVolumeInput) : Infinity;
        result = result.filter(c => c.totalQty >= min && c.totalQty <= max);
      }
    }

    // Priority Filter from Matrix Cards
    if (selectedPriority && selectedPriority !== 'ALL') {
      result = result.filter(c => c.opportunityPriority === selectedPriority);
    }

    return [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'spend':
          comparison = b.totalSpend - a.totalSpend;
          break;
        case 'qty':
          comparison = b.totalQty - a.totalQty;
          break;
        case 'po':
          comparison = b.poOccurrences - a.poOccurrences;
          break;
        case 'priority':
          comparison = b.priorityScore - a.priorityScore;
          break;
        case 'contract':
          comparison = a.contractCoverage.percentageContracted - b.contractCoverage.percentageContracted;
          break;
        case 'savings':
          comparison = b.potentialSavingsEstimate.minSavingsIdr - a.potentialSavingsEstimate.minSavingsIdr;
          break;
        case 'name':
          comparison = a.clusterName.localeCompare(b.clusterName);
          break;
      }
      return sortAsc ? -comparison : comparison;
    });
  }, [clusters, search, volumeFilter, minVolumeInput, maxVolumeInput, sortField, sortAsc, selectedPriority]);

  // Reset pagination to first page whenever filtering criteria change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedPriority, search, volumeFilter, minVolumeInput, maxVolumeInput]);

  const totalPages = Math.ceil(filteredClusters.length / pageSize) || 1;
  const paginatedClusters = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClusters.slice(start, start + pageSize);
  }, [filteredClusters, currentPage, pageSize]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            {filteredClusters.length}
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Daftar Kluster Komoditas &amp; Target Kontrak
              </h3>
              {selectedPriority && selectedPriority !== 'ALL' && (
                <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-blue-100 border border-blue-200 text-blue-800 rounded-md text-[10px] font-extrabold">
                  <span>Filter Aktif: {selectedPriority.replace(/_/g, ' ')}</span>
                  {onSelectPriority && (
                    <button
                      onClick={() => onSelectPriority('ALL')}
                      className="text-blue-700 hover:text-rose-600 font-black ml-1 cursor-pointer"
                      title="Hapus Filter Kuadran"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {selectedPriority && selectedPriority !== 'ALL'
                ? `Menampilkan ${filteredClusters.length} kluster hasil filter kuadran ${selectedPriority.replace(/_/g, ' ')}`
                : 'Hasil pengelompokan semantik transaksi belanja teragregasi'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Priority Quick Filter Selector */}
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Prioritas:</span>
            <select
              value={selectedPriority || 'ALL'}
              onChange={(e) => {
                onSelectPriority?.(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer text-xs"
            >
              <option value="ALL">Semua Prioritas (P1-P4)</option>
              <option value="P1_BLANKET_CONTRACT">P1: Urgent Blanket</option>
              <option value="P2_RATE_HARMONIZATION">P2: Rate Harmonization</option>
              <option value="P3_VENDOR_CONSOLIDATION">P3: Vendor Consol</option>
              <option value="P4_TAIL_AUTOMATION">P4: Tail Automation</option>
              <option value="MONITORED_STANDARD">Monitored Standard</option>
            </select>
          </div>

          {/* Volume Filter Selector */}
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Filter Vol:</span>
            <select
              value={volumeFilter}
              onChange={(e) => {
                setVolumeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua Volume</option>
              <option value="100">&ge; 100 Qty</option>
              <option value="500">&ge; 500 Qty</option>
              <option value="1000">&ge; 1.000 Qty</option>
              <option value="5000">&ge; 5.000 Qty</option>
              <option value="10000">&ge; 10.000 Qty</option>
              <option value="50000">&ge; 50.000 Qty</option>
              <option value="custom">Rentang Kustom...</option>
            </select>
          </div>

          {volumeFilter === 'custom' && (
            <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
              <input
                type="number"
                placeholder="Min"
                value={minVolumeInput}
                onChange={(e) => {
                  setMinVolumeInput(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[11px]"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxVolumeInput}
                onChange={(e) => {
                  setMaxVolumeInput(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[11px]"
              />
            </div>
          )}

          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kluster / vendor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={onExportCsv}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 select-none">
            <tr>
              <th className="py-3 px-4 w-10 text-center">#</th>
              <th 
                onClick={() => handleSort('name')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/60 transition-colors min-w-[220px]"
              >
                <div className="flex items-center space-x-1">
                  <span>Nama Kluster &amp; Periode</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('priority')}
                className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors w-24"
                title="Target Prioritas & Klasifikasi Kraljic"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Prioritas</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('spend')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60 transition-colors min-w-[130px]"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Total Belanja</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('qty')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60 transition-colors min-w-[110px]"
                title="Klik untuk menyortir berdasarkan Total Volume"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Volume Belanja</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('po')}
                className="py-3 px-4 text-center cursor-pointer hover:bg-slate-200/60 transition-colors min-w-[100px]"
                title="Klik untuk menyortir berdasarkan Jumlah PO"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Jumlah PO</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">
                <span>Vendor &amp; RS</span>
              </th>
              <th 
                onClick={() => handleSort('contract')}
                className="py-3 px-4 min-w-[140px] cursor-pointer hover:bg-slate-200/60 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Cakupan Kontrak</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('savings')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Estimasi Hemat</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center min-w-[140px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedClusters.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2.5 max-w-md mx-auto">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Tidak ada kluster yang cocok dengan filter saat ini
                    </p>
                    <p className="text-xs text-slate-400">
                      {selectedPriority !== 'ALL' 
                        ? `Tidak ada data dengan kuadran ${selectedPriority.replace(/_/g, ' ')}. Coba kuadran lain atau reset filter.`
                        : 'Coba sesuaikan kata kunci pencarian atau rentang volume/nilai belanja.'}
                    </p>
                    {(selectedPriority !== 'ALL' || search || volumeFilter !== 'ALL') && (
                      <button
                        onClick={() => {
                          setSearch('');
                          setVolumeFilter('ALL');
                          onSelectPriority?.('ALL');
                        }}
                        className="mt-2 px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Reset Semua Filter Tabel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedClusters.map((cluster, index) => {
                const rowIndex = (currentPage - 1) * pageSize + index + 1;
                const isExpanded = expandedClusterId === cluster.id;

                return (
                  <React.Fragment key={cluster.id}>
                    <tr className="hover:bg-slate-50/90 transition-colors group">
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                        {rowIndex}
                      </td>

                      {/* Cluster Name, Category & Transaction Timeline */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {cluster.clusterName}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5 flex-wrap">
                          <span className="text-slate-600 font-medium">{cluster.categoryLv1} &gt; {cluster.categoryLv2}</span>
                          <span>•</span>
                          <span>{cluster.rawItemVariations.length} SKU</span>
                          {cluster.dateRangeFormatted && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[10px] font-medium" title="Rentang Waktu Transaksi PO">
                                <Calendar className="w-2.5 h-2.5 mr-1 text-slate-400" />
                                {cluster.dateRangeFormatted}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Priority Micro Symbol & Compact Kraljic Badge */}
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <PriorityBadge priority={cluster.opportunityPriority} iconOnly={true} />
                          <KraljicBadge quadrant={cluster.kraljicQuadrant} compact={true} />
                        </div>
                      </td>

                      {/* Total Spend */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-extrabold text-slate-900">
                          {formatIDR(cluster.totalSpend)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Avg {formatIDR(cluster.avgUnitPrice)}/{cluster.primaryUom}
                        </div>
                      </td>

                      {/* Column 1: Volume Belanja */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-extrabold text-slate-800">
                          {cluster.totalQty.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {cluster.primaryUom}
                        </div>
                      </td>

                      {/* Column 2: Jumlah PO */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-slate-800 text-[11px]">
                          {cluster.poOccurrences}x PO
                        </span>
                      </td>

                      {/* Vendors & Hospitals count */}
                      <td className="py-3 px-4 text-center">
                        <div className="font-semibold text-slate-800 flex items-center justify-center space-x-2">
                          <span className="inline-flex items-center text-[11px] text-slate-700" title="Jumlah Vendor">
                            <Store className="w-3 h-3 mr-0.5 text-slate-400" />
                            {cluster.uniqueVendors.length}
                          </span>
                          <span>/</span>
                          <span className="inline-flex items-center text-[11px] text-slate-700" title="Jumlah RS">
                            <Building2 className="w-3 h-3 mr-0.5 text-slate-400" />
                            {cluster.uniqueHospitals.length}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400">
                          Top: {cluster.uniqueVendors[0]?.vendorName?.slice(0, 14)}...
                        </div>
                      </td>

                      {/* Contract Coverage Bar */}
                      <td className="py-3 px-4">
                        <ContractCoverageBar
                          percentage={cluster.contractCoverage.percentageContracted}
                          contractedSpend={cluster.contractCoverage.contractedSpend}
                          uncontractedSpend={cluster.contractCoverage.uncontractedSpend}
                        />
                      </td>

                      {/* Potential Savings */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-black text-emerald-700">
                          {formatIDR(cluster.potentialSavingsEstimate.minSavingsIdr)}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          {(cluster.potentialSavingsEstimate.targetSavingPercentage * 100).toFixed(0)}% target
                        </div>
                      </td>

                      {/* Strategic Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => onSelectCluster(cluster)}
                            title="Lihat Rincian Kluster & Drill Down PO"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenSourcingBrief(cluster)}
                            title="Draft RFP & Sourcing Brief"
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200 transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>RFP</span>
                          </button>

                          <button
                            onClick={() => onPinToPipeline(cluster)}
                            title={cluster.pinnedToPipeline ? 'Sudah di Pipeline' : 'Pin ke Pipeline'}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              cluster.pinnedToPipeline
                                ? 'bg-amber-500 text-white border-amber-600'
                                : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50 border-slate-200'
                            }`}
                          >
                            <BookmarkPlus className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setExpandedClusterId(isExpanded ? null : cluster.id)}
                            title={isExpanded ? 'Tutup Quick View' : 'Buka Quick View'}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Quick View Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-200">
                        <td colSpan={10} className="p-4 text-xs">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <span className="font-bold text-slate-800">
                                Rekomendasi Sourcing: {cluster.potentialSavingsEstimate.recommendedContractType}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Rentang Harga Pasar: {formatIDR(cluster.minUnitPrice)} s/d {formatIDR(cluster.maxUnitPrice)} (Disparitas {(cluster.priceSpreadRatio * 100).toFixed(1)}%)
                              </span>
                            </div>

                            <p className="text-slate-600 text-[11px] leading-relaxed">
                              {cluster.potentialSavingsEstimate.rationale}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                              <div>
                                <h5 className="font-bold text-slate-700 text-[11px] mb-1">Top 3 Vendor Incumbent:</h5>
                                <div className="space-y-1">
                                  {cluster.uniqueVendors.slice(0, 3).map((v, vi) => (
                                    <div key={vi} className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                      <span className="font-medium truncate max-w-[180px]">{v.vendorName}</span>
                                      <span className="font-bold text-slate-900">{formatIDR(v.spend)} ({v.poCount}x PO)</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <h5 className="font-bold text-slate-700 text-[11px] mb-1">Variasi Item Tergabung ({cluster.rawItemVariations.length}):</h5>
                                <div className="space-y-1">
                                  {cluster.rawItemVariations.slice(0, 3).map((iv, ivi) => (
                                    <div key={ivi} className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                      <span className="truncate max-w-[200px]">{iv.itemName}</span>
                                      <span className="font-semibold text-slate-800">{formatIDR(iv.spend)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <span>Menampilkan</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-800 cursor-pointer"
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>dari <strong>{filteredClusters.length}</strong> kluster</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100 transition-colors font-semibold flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>

          <span className="font-bold text-slate-800 px-2">
            Halaman {currentPage} dari {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100 transition-colors font-semibold flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
