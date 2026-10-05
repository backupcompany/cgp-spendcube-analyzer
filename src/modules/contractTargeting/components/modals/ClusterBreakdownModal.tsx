import React, { useState, useMemo } from 'react';
import { SemanticSpendCluster, ClusterPoTransaction } from '../../../../core/types/contractTargeting';
import { KraljicBadge, PriorityBadge } from '../badges/ContractBadges';
import { 
  X, 
  Building2, 
  Store, 
  Layers, 
  TrendingUp, 
  AlertCircle, 
  Sparkles, 
  FileSpreadsheet,
  CheckCircle2,
  BookmarkPlus,
  Calendar,
  Package,
  Receipt,
  Search,
  Download,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

interface BreakdownModalProps {
  cluster: SemanticSpendCluster | null;
  onClose: () => void;
  onOpenSourcingBrief: (cluster: SemanticSpendCluster) => void;
  onPinToPipeline: (cluster: SemanticSpendCluster) => void;
}

type TabType = 'variations' | 'vendors' | 'hospitals' | 'pos' | 'strategy';

export const ClusterBreakdownModal: React.FC<BreakdownModalProps> = ({
  cluster,
  onClose,
  onOpenSourcingBrief,
  onPinToPipeline
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('variations');

  // PO Drilldown Filters & Pagination State
  const [poSearch, setPoSearch] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState<'ALL' | 'SPOT' | 'CONTRACT'>('ALL');
  const [poVendorFilter, setPoVendorFilter] = useState<string>('');
  const [poHospitalFilter, setPoHospitalFilter] = useState<string>('');
  const [poItemFilter, setPoItemFilter] = useState<string>('');
  const [poSortField, setPoSortField] = useState<'date' | 'amount' | 'qty' | 'vendor' | 'po'>('date');
  const [poSortAsc, setPoSortAsc] = useState(false);
  const [poPage, setPoPage] = useState(1);
  const poPageSize = 15;

  const formatIDR = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  // Helper to drill down directly to the PO tab with specific entity filtered
  const handleDrilldownToPo = (filter: { vendor?: string; hospital?: string; item?: string }) => {
    if (filter.vendor !== undefined) setPoVendorFilter(filter.vendor);
    if (filter.hospital !== undefined) setPoHospitalFilter(filter.hospital);
    if (filter.item !== undefined) setPoItemFilter(filter.item);
    setPoPage(1);
    setActiveTab('pos');
  };

  const handleClearPoFilters = () => {
    setPoSearch('');
    setPoStatusFilter('ALL');
    setPoVendorFilter('');
    setPoHospitalFilter('');
    setPoItemFilter('');
    setPoPage(1);
  };

  // Filtered and Sorted PO Transactions
  const rawPos: ClusterPoTransaction[] = cluster?.poTransactions || [];

  const filteredPos = useMemo(() => {
    let result = rawPos;

    if (poSearch.trim()) {
      const q = poSearch.toLowerCase();
      result = result.filter(p =>
        p.purchId.toLowerCase().includes(q) ||
        p.itemName.toLowerCase().includes(q) ||
        p.itemId.toLowerCase().includes(q) ||
        p.vendorName.toLowerCase().includes(q) ||
        p.hospitalCode.toLowerCase().includes(q)
      );
    }

    if (poStatusFilter === 'SPOT') {
      result = result.filter(p => !p.isContract);
    } else if (poStatusFilter === 'CONTRACT') {
      result = result.filter(p => p.isContract);
    }

    if (poVendorFilter) {
      result = result.filter(p => p.vendorName === poVendorFilter);
    }

    if (poHospitalFilter) {
      result = result.filter(p => p.hospitalCode === poHospitalFilter);
    }

    if (poItemFilter) {
      result = result.filter(p => p.itemName === poItemFilter || p.itemId === poItemFilter);
    }

    return [...result].sort((a, b) => {
      let comparison = 0;
      switch (poSortField) {
        case 'date':
          comparison = (a.createdDate || '').localeCompare(b.createdDate || '');
          break;
        case 'amount':
          comparison = (b.totalLineAmount || 0) - (a.totalLineAmount || 0);
          break;
        case 'qty':
          comparison = (b.purchQty || 0) - (a.purchQty || 0);
          break;
        case 'vendor':
          comparison = (a.vendorName || '').localeCompare(b.vendorName || '');
          break;
        case 'po':
          comparison = (a.purchId || '').localeCompare(b.purchId || '');
          break;
      }
      return poSortAsc ? -comparison : comparison;
    });
  }, [rawPos, poSearch, poStatusFilter, poVendorFilter, poHospitalFilter, poItemFilter, poSortField, poSortAsc]);

  const totalPoPages = Math.ceil(filteredPos.length / poPageSize) || 1;
  const paginatedPos = useMemo(() => {
    const start = (poPage - 1) * poPageSize;
    return filteredPos.slice(start, start + poPageSize);
  }, [filteredPos, poPage, poPageSize]);

  // Aggregate metrics of filtered POs
  const poMetrics = useMemo(() => {
    const totalSpend = filteredPos.reduce((sum, p) => sum + (p.totalLineAmount || 0), 0);
    const totalQty = filteredPos.reduce((sum, p) => sum + (p.purchQty || 0), 0);
    const spotCount = filteredPos.filter(p => !p.isContract).length;
    const contractCount = filteredPos.filter(p => p.isContract).length;
    const spotSpend = filteredPos.filter(p => !p.isContract).reduce((sum, p) => sum + (p.totalLineAmount || 0), 0);
    const avgAmount = filteredPos.length > 0 ? totalSpend / filteredPos.length : 0;
    return { totalSpend, totalQty, spotCount, contractCount, spotSpend, avgAmount };
  }, [filteredPos]);

  if (!cluster) return null;

  // Export Filtered POs to CSV
  const handleExportPoCsv = () => {
    if (filteredPos.length === 0) return;
    const headers = ['Nomor PO', 'Tanggal', 'Unit RS', 'Vendor', 'Kode Item', 'Nama Item', 'Qty', 'Satuan', 'Harga Satuan (Rp)', 'Total Nominal (Rp)', 'Status Kontrak', 'Tipe Belanja'];
    const rows = filteredPos.map(p => [
      `"${p.purchId}"`,
      `"${p.createdDate}"`,
      `"${p.hospitalCode}"`,
      `"${p.vendorName.replace(/"/g, '""')}"`,
      `"${p.itemId}"`,
      `"${p.itemName.replace(/"/g, '""')}"`,
      p.purchQty,
      `"${p.purchUnit}"`,
      p.purchPrice,
      p.totalLineAmount,
      p.isContract ? 'Terkontrak' : 'Spot Buy',
      p.spendType || 'OPEX'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `drilldown_po_${cluster.clusterName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSortPo = (field: 'date' | 'amount' | 'qty' | 'vendor' | 'po') => {
    if (poSortField === field) {
      setPoSortAsc(!poSortAsc);
    } else {
      setPoSortField(field);
      setPoSortAsc(false);
    }
    setPoPage(1);
  };

  const hasActivePoFilters = Boolean(poSearch || poStatusFilter !== 'ALL' || poVendorFilter || poHospitalFilter || poItemFilter);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <PriorityBadge priority={cluster.opportunityPriority} />
              <KraljicBadge quadrant={cluster.kraljicQuadrant} />
              <span className="text-[11px] font-semibold text-slate-500">
                {cluster.categoryLv1} &gt; {cluster.categoryLv2}
              </span>
              <span className="inline-flex items-center text-[10px] font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                Periode: <strong className="ml-1 text-slate-800">{cluster.dateRangeFormatted || 'Semua Periode'}</strong>
              </span>
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              {cluster.clusterName}
            </h3>
            <p className="text-xs text-slate-600">
              Total Belanja: <strong className="text-slate-900">{formatIDR(cluster.totalSpend)}</strong> • Volume: <strong className="text-slate-900">{cluster.totalQty.toLocaleString('id-ID')} {cluster.primaryUom}</strong> • {cluster.poOccurrences} Transaksi PO
            </p>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
            <button
              onClick={() => onPinToPipeline(cluster)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-2xs transition-colors cursor-pointer ${
                cluster.pinnedToPipeline 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              <BookmarkPlus className="w-3 h-3" />
              <span>{cluster.pinnedToPipeline ? 'Tersimpan' : 'Pin Pipeline'}</span>
            </button>

            <button
              onClick={() => onOpenSourcingBrief(cluster)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Draft RFP</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Contract & Savings Strip */}
        <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4 flex-wrap gap-y-1">
            <div>
              <span className="text-slate-500 text-[10px]">Cakupan Kontrak:</span>
              <div className="font-bold text-slate-900 text-xs">
                {cluster.contractCoverage.percentageContracted.toFixed(0)}% ({formatIDR(cluster.contractCoverage.contractedSpend)})
              </div>
            </div>
            <div>
              <span className="text-slate-500 text-[10px]">Belanja Spot Non-Kontrak:</span>
              <div className="font-bold text-rose-700 text-xs">
                {formatIDR(cluster.contractCoverage.uncontractedSpend)}
              </div>
            </div>
            <div>
              <span className="text-slate-500 text-[10px]">Rentang Harga (Min - Max):</span>
              <div className="font-bold text-slate-900 text-xs">
                {formatIDR(cluster.minUnitPrice)} - {formatIDR(cluster.maxUnitPrice)}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-slate-500 text-[10px]">Estimasi Hemat Sourcing:</span>
            <div className="font-extrabold text-emerald-700 text-xs">
              {formatIDR(cluster.potentialSavingsEstimate.minSavingsIdr)} - {formatIDR(cluster.potentialSavingsEstimate.maxSavingsIdr)} ({(cluster.potentialSavingsEstimate.targetSavingPercentage * 100).toFixed(0)}%)
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white space-x-2 sm:space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('variations')}
            className={`py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'variations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Item Variasi Mentah ({cluster.rawItemVariations.length})
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'vendors'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Sebaran Vendor ({cluster.uniqueVendors.length})
          </button>
          <button
            onClick={() => setActiveTab('hospitals')}
            className={`py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'hospitals'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Sebaran Unit RS ({cluster.uniqueHospitals.length})
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            className={`py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'pos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Rincian Transaksi PO ({rawPos.length || cluster.poOccurrences})</span>
          </button>
          <button
            onClick={() => setActiveTab('strategy')}
            className={`py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'strategy'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Rekomendasi Strategi Kontrak
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-xs">
          
          {/* TAB 1: Variations */}
          {activeTab === 'variations' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-slate-600">
                  Variasi penamaan item mentah pada transaksi pembelian yang dikelompokkan secara semantik ke dalam kluster ini:
                </p>
                <button
                  onClick={() => {
                    handleClearPoFilters();
                    setActiveTab('pos');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                >
                  <span>Lihat Seluruh PO ({rawPos.length})</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left min-w-[750px]">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5">Nama Item Transaksi</th>
                      <th className="py-2.5 px-3.5">Kode Item</th>
                      <th className="py-2.5 px-3.5 text-right">Total Belanja</th>
                      <th className="py-2.5 px-3.5 text-right">Volume</th>
                      <th className="py-2.5 px-3.5">Sample Vendor</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                      <th className="py-2.5 px-3.5 text-center">Drill Down PO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {cluster.rawItemVariations.map((v, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">{v.itemName}</td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">{v.itemId}</td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900">{formatIDR(v.spend)}</td>
                        <td className="py-2.5 px-3.5 text-right">{v.qty.toLocaleString('id-ID')} {v.uom}</td>
                        <td className="py-2.5 px-3.5 text-slate-600 truncate max-w-[150px]">{v.sampleVendor}</td>
                        <td className="py-2.5 px-3.5 text-center">
                          {v.isContract ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                              Kontrak
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                              Spot Buy
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            onClick={() => handleDrilldownToPo({ item: v.itemName })}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-bold text-[11px] border border-blue-200 transition-colors cursor-pointer inline-flex items-center space-x-1"
                            title={`Filter PO untuk item ${v.itemName}`}
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Buka PO</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Vendors */}
          {activeTab === 'vendors' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-slate-600">
                  Pangsa pasar pemasok untuk komoditas ini ({cluster.uniqueVendors.length} vendor) beserta rincian item yang dipasok:
                </p>
                <button
                  onClick={() => {
                    handleClearPoFilters();
                    setActiveTab('pos');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                >
                  <span>Lihat Seluruh PO ({rawPos.length})</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left min-w-[900px]">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5 min-w-[180px]">Nama Vendor</th>
                      <th className="py-2.5 px-3.5 min-w-[220px]">Item yang Dipasok</th>
                      <th className="py-2.5 px-3.5 text-right">Total Belanja</th>
                      <th className="py-2.5 px-3.5 text-right">Volume</th>
                      <th className="py-2.5 px-3.5 text-center">Frekuensi PO</th>
                      <th className="py-2.5 px-3.5 text-right">Rata-rata Tarif</th>
                      <th className="py-2.5 px-3.5 text-center">Pangsa Belanja</th>
                      <th className="py-2.5 px-3.5 text-center">Drill Down PO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {cluster.uniqueVendors.map((v, i) => {
                      const share = cluster.totalSpend > 0 ? (v.spend / cluster.totalSpend) * 100 : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span>{v.vendorName}</span>
                              {v.isPrimary && (
                                <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">
                                  Incumbent
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[320px]">
                              {v.itemNames && v.itemNames.length > 0 ? (
                                v.itemNames.map((itName, itIdx) => (
                                  <span 
                                    key={itIdx} 
                                    className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] max-w-[260px] truncate"
                                    title={itName}
                                  >
                                    {itName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[10px] italic">Semua item kluster</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900">{formatIDR(v.spend)}</td>
                          <td className="py-2.5 px-3.5 text-right">{v.qty.toLocaleString('id-ID')} {cluster.primaryUom}</td>
                          <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">{v.poCount}x</td>
                          <td className="py-2.5 px-3.5 text-right font-semibold text-slate-800">{formatIDR(v.avgPrice)}</td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span className="font-bold text-slate-900">{share.toFixed(1)}%</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <button
                              onClick={() => handleDrilldownToPo({ vendor: v.vendorName })}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-bold text-[11px] border border-blue-200 transition-colors cursor-pointer inline-flex items-center space-x-1"
                              title={`Filter PO untuk vendor ${v.vendorName}`}
                            >
                              <Receipt className="w-3 h-3" />
                              <span>{v.poCount} PO</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Hospitals */}
          {activeTab === 'hospitals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-slate-600">
                  Sebaran serapan dan variasi harga antar unit rumah sakit ({cluster.uniqueHospitals.length} RS), termasuk vendor rekanan dan variasi item:
                </p>
                <button
                  onClick={() => {
                    handleClearPoFilters();
                    setActiveTab('pos');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                >
                  <span>Lihat Seluruh PO ({rawPos.length})</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left min-w-[950px]">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5 w-24">Kode RS</th>
                      <th className="py-2.5 px-3.5 min-w-[180px]">Vendor Pemasok</th>
                      <th className="py-2.5 px-3.5 min-w-[220px]">Item yang Digunakan</th>
                      <th className="py-2.5 px-3.5 text-right">Total Belanja</th>
                      <th className="py-2.5 px-3.5 text-right">Volume</th>
                      <th className="py-2.5 px-3.5 text-center">Frekuensi PO</th>
                      <th className="py-2.5 px-3.5 text-right">Rata-rata Harga</th>
                      <th className="py-2.5 px-3.5 text-center">Drill Down PO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {cluster.uniqueHospitals.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">
                          <div className="flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{h.hospitalCode}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {h.vendorNames && h.vendorNames.length > 0 ? (
                              h.vendorNames.map((vn, vIdx) => (
                                <span 
                                  key={vIdx} 
                                  className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-medium rounded text-[10px] max-w-[220px] truncate cursor-pointer hover:bg-blue-100"
                                  onClick={() => handleDrilldownToPo({ hospital: h.hospitalCode, vendor: vn })}
                                  title={`Klik untuk filter PO dari ${vn} di ${h.hospitalCode}`}
                                >
                                  {vn}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[300px]">
                            {h.itemNames && h.itemNames.length > 0 ? (
                              h.itemNames.map((itn, itIdx) => (
                                <span 
                                  key={itIdx} 
                                  className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] max-w-[260px] truncate"
                                  title={itn}
                                >
                                  {itn}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900">{formatIDR(h.spend)}</td>
                        <td className="py-2.5 px-3.5 text-right">{h.qty.toLocaleString('id-ID')} {cluster.primaryUom}</td>
                        <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">{h.poCount}x</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-blue-700">{formatIDR(h.avgPrice)}</td>
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            onClick={() => handleDrilldownToPo({ hospital: h.hospitalCode })}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-bold text-[11px] border border-blue-200 transition-colors cursor-pointer inline-flex items-center space-x-1"
                            title={`Filter PO untuk RS ${h.hospitalCode}`}
                          >
                            <Receipt className="w-3 h-3" />
                            <span>{h.poCount} PO</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PO Transaction Log (Granular Drill Down) */}
          {activeTab === 'pos' && (
            <div className="space-y-4">
              {/* Summary Metric Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Transaksi Terfilter</div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    {filteredPos.length} <span className="text-xs font-medium text-slate-500">/ {rawPos.length} PO</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Total Nilai Transaksi</div>
                  <div className="text-base font-extrabold text-blue-700 mt-0.5">
                    {formatIDR(poMetrics.totalSpend)}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Rata-rata per PO</div>
                  <div className="text-base font-extrabold text-slate-800 mt-0.5">
                    {formatIDR(poMetrics.avgAmount)}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Spot vs Kontrak</div>
                  <div className="text-xs font-bold text-rose-700 mt-1 flex items-center justify-between">
                    <span>Spot: {poMetrics.spotCount} PO ({formatIDR(poMetrics.spotSpend)})</span>
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-700">
                    Kontrak: {poMetrics.contractCount} PO
                  </div>
                </div>
              </div>

              {/* Toolbar & Active Filter Chips */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Search PO */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari No PO / Vendor / Item / RS..."
                      value={poSearch}
                      onChange={(e) => {
                        setPoSearch(e.target.value);
                        setPoPage(1);
                      }}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Status Filter Buttons */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => { setPoStatusFilter('ALL'); setPoPage(1); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                        poStatusFilter === 'ALL' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => { setPoStatusFilter('SPOT'); setPoPage(1); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                        poStatusFilter === 'SPOT' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Spot Buy
                    </button>
                    <button
                      onClick={() => { setPoStatusFilter('CONTRACT'); setPoPage(1); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                        poStatusFilter === 'CONTRACT' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Kontrak
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {hasActivePoFilters && (
                    <button
                      onClick={handleClearPoFilters}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
                      title="Reset Semua Filter PO"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Filter</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportPoCsv}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PO CSV</span>
                  </button>
                </div>
              </div>

              {/* Active Filter Badges */}
              {(poVendorFilter || poHospitalFilter || poItemFilter) && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px]">
                  <span className="font-bold text-blue-950">Filter Drill Down:</span>
                  {poVendorFilter && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                      Vendor: {poVendorFilter}
                      <X className="w-3 h-3 ml-1 cursor-pointer hover:text-blue-950" onClick={() => setPoVendorFilter('')} />
                    </span>
                  )}
                  {poHospitalFilter && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                      Unit RS: {poHospitalFilter}
                      <X className="w-3 h-3 ml-1 cursor-pointer hover:text-blue-950" onClick={() => setPoHospitalFilter('')} />
                    </span>
                  )}
                  {poItemFilter && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                      Item: {poItemFilter}
                      <X className="w-3 h-3 ml-1 cursor-pointer hover:text-blue-950" onClick={() => setPoItemFilter('')} />
                    </span>
                  )}
                </div>
              )}

              {/* PO Transactions Detailed Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left min-w-[950px]">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th 
                        onClick={() => handleSortPo('po')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/60 transition-colors min-w-[140px]"
                      >
                        <div className="flex items-center space-x-1">
                          <span>No. PO</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortPo('date')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/60 transition-colors w-24"
                      >
                        <div className="flex items-center space-x-1">
                          <span>Tanggal</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 w-20 text-center">Unit RS</th>
                      <th 
                        onClick={() => handleSortPo('vendor')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/60 transition-colors min-w-[180px]"
                      >
                        <div className="flex items-center space-x-1">
                          <span>Nama Vendor</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 min-w-[220px]">Item / SKU</th>
                      <th 
                        onClick={() => handleSortPo('qty')}
                        className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200/60 transition-colors w-24"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Qty</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right min-w-[110px]">Harga Satuan</th>
                      <th 
                        onClick={() => handleSortPo('amount')}
                        className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200/60 transition-colors min-w-[130px]"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Total Nilai PO</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-center w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedPos.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          Tidak ada transaksi PO yang cocok dengan filter pencarian saat ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedPos.map((p, idx) => {
                        const rowNumber = (poPage - 1) * poPageSize + idx + 1;
                        return (
                          <tr key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                              {rowNumber}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 font-mono text-[11px]">
                              {p.purchId}
                              {p.spendType && (
                                <span className="ml-1.5 px-1 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-sans font-medium">
                                  {p.spendType}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {p.createdDate}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                                {p.hospitalCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {p.vendorName}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-900 line-clamp-1" title={p.itemName}>
                                {p.itemName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {p.itemId}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                              {p.purchQty.toLocaleString('id-ID')} {p.purchUnit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                              {formatIDR(p.purchPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatIDR(p.totalLineAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {p.isContract ? (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
                                  Kontrak
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px]">
                                  Spot Buy
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PO Pagination Controls */}
              {totalPoPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-600">
                  <span>
                    Menampilkan <strong>{(poPage - 1) * poPageSize + 1}</strong> - <strong>{Math.min(poPage * poPageSize, filteredPos.length)}</strong> dari <strong>{filteredPos.length}</strong> PO
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPoPage(prev => Math.max(prev - 1, 1))}
                      disabled={poPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-slate-800">
                      Hal {poPage} / {totalPoPages}
                    </span>
                    <button
                      onClick={() => setPoPage(prev => Math.min(prev + 1, totalPoPages))}
                      disabled={poPage === totalPoPages}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Strategy */}
          {activeTab === 'strategy' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-sm text-blue-950 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Rekomendasi Bentuk Kontrak: {cluster.potentialSavingsEstimate.recommendedContractType}</span>
                </h4>
                <p className="text-slate-700 leading-relaxed">
                  {cluster.potentialSavingsEstimate.rationale}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <h5 className="font-bold text-slate-900">Klausul Negosiasi Prioritas</h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                    <li>Klausul Most Favored Customer (MFC) patokan tarif {formatIDR(cluster.minUnitPrice)}.</li>
                    <li>Tiered volume rebate jika total serapan konsorsium melampaui kuota komitmen.</li>
                    <li>SLA lead time maksimal 48 jam dengan penalti 0.1%/hari jika terlambat.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <h5 className="font-bold text-slate-900">Target Tindak Lanjut</h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                    <li>Terbitkan Dokumen Tender / RFP Sourcing Brief terpadu.</li>
                    <li>Undang vendor incumbent dan vendor alternatif untuk tender tertutup.</li>
                    <li>Kunci kode SKU &amp; harga kontrak pada modul katalog ERP.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>ID Kluster: <code className="font-mono text-[10px]">{cluster.id}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
