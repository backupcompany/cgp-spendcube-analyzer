import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  X, 
  RotateCcw, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Building2, 
  Tag, 
  FileText, 
  Eye,
  SlidersHorizontal,
  DollarSign
} from 'lucide-react';
import { SpendRecord } from '../../../../core/types/spend';
import { exportSpendRecordsToCsv, exportSpendRecordsToJson } from '../../services/dataExportService';

export interface ActiveFilterDescription {
  label: string;
  value: string;
  onClear: () => void;
}

export interface FilteredTransactionsTableProps {
  records: SpendRecord[];
  totalRecordsInQuery: number;
  activeFilters: ActiveFilterDescription[];
  onResetAllFilters: () => void;
  onSelectRecord?: (record: SpendRecord) => void;
  queryTitle?: string;
}

type SortField = 'totalLineAmount' | 'createdDate' | 'purchPrice' | 'purchQty' | 'hospitalCode' | 'vendorName' | 'purchId' | 'itemName';

export const FilteredTransactionsTable: React.FC<FilteredTransactionsTableProps> = ({
  records,
  totalRecordsInQuery,
  activeFilters = [],
  onResetAllFilters,
  onSelectRecord,
  queryTitle
}) => {
  // Table search & pagination states
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Sorting states
  const [sortField, setSortField] = useState<SortField>('totalLineAmount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Format currency helpers
  const formatIDR = (val: number | undefined | null) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  // Filter records by search text
  const searchedRecords = useMemo(() => {
    if (!tableSearch.trim()) return records;
    const q = tableSearch.toLowerCase().trim();
    return records.filter(r => 
      (r.purchId && r.purchId.toLowerCase().includes(q)) ||
      (r.itemName && r.itemName.toLowerCase().includes(q)) ||
      (r.purchReqName && r.purchReqName.toLowerCase().includes(q)) ||
      (r.vendorName && r.vendorName.toLowerCase().includes(q)) ||
      (r.hospitalCode && r.hospitalCode.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q)) ||
      (r.requester && r.requester.toLowerCase().includes(q)) ||
      (r.procurementCategory && r.procurementCategory.toLowerCase().includes(q))
    );
  }, [records, tableSearch]);

  // Sort records
  const sortedRecords = useMemo(() => {
    const list = [...searchedRecords];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'createdDate') {
        valA = a.createdDate || a.monthYear || '';
        valB = b.createdDate || b.monthYear || '';
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    return list;
  }, [searchedRecords, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRecords = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, safeCurrentPage, pageSize]);

  // Reset page when search or records change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [records.length, tableSearch, activeFilters.length]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 inline ml-1" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 inline ml-1" />
      : <ArrowDown className="w-3 h-3 text-blue-600 inline ml-1" />;
  };

  // Export handlers
  const handleExportCsv = () => {
    const prefix = queryTitle 
      ? `Filter_AI_${queryTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
      : 'Siloam_Filtered_Spend';
    exportSpendRecordsToCsv(sortedRecords, prefix);
  };

  const handleExportJson = () => {
    const prefix = queryTitle 
      ? `Filter_AI_${queryTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
      : 'Siloam_Filtered_Spend';
    exportSpendRecordsToJson(sortedRecords, prefix);
  };

  // Aggregated totals for the active filtered set
  const totalSpendFiltered = useMemo(() => {
    return sortedRecords.reduce((acc, r) => acc + (Number(r.totalLineAmount) || 0), 0);
  }, [sortedRecords]);

  const totalQtyFiltered = useMemo(() => {
    return sortedRecords.reduce((acc, r) => acc + (Number(r.purchQty) || 0), 0);
  }, [sortedRecords]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5 animate-in fade-in duration-300">
      {/* Top Header & Export Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Daftar Transaksi Terfilter (Cross-Filter Grafik Interaktif)
            </h3>
            {activeFilters.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold font-mono border border-indigo-200 animate-pulse">
                {activeFilters.length} Filter Grafik Aktif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {activeFilters.length > 0 ? (
              <>
                Menampilkan <strong className="text-slate-800 font-bold">{records.length.toLocaleString('id-ID')}</strong> dari{' '}
                <strong className="text-slate-600">{totalRecordsInQuery.toLocaleString('id-ID')}</strong> baris transaksi yang terfilter dinamis mengikuti elemen grafik yang Anda klik di atas.
              </>
            ) : (
              <>
                Menampilkan seluruh <strong className="text-slate-800 font-bold">{records.length.toLocaleString('id-ID')}</strong> transaksi hasil kueri AI. Klik salah satu elemen grafik di atas untuk memfilter daftar ini secara instan.
              </>
            )}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={sortedRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/10"
            title="Download file Excel CSV dari transaksi yang sedang terfilter saat ini"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel CSV ({sortedRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={sortedRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 text-xs font-bold transition-colors"
            title="Download data transaksi dalam format JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips Banner */}
      {activeFilters.length > 0 && (
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5 shrink-0 text-[11px]">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filter Terpasang dari Grafik:</span>
            </span>

            {activeFilters.map((flt, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-indigo-300 text-indigo-900 font-semibold text-[11px] shadow-2xs"
              >
                <span className="text-indigo-600 font-bold">{flt.label}:</span>
                <span className="font-mono">{flt.value}</span>
                <button
                  type="button"
                  onClick={flt.onClear}
                  className="p-0.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-indigo-50 transition-colors ml-0.5"
                  title={`Hapus filter ${flt.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={onResetAllFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold text-[11px] transition-colors shrink-0 shadow-2xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Semua Filter Grafik</span>
          </button>
        </div>
      )}

      {/* Quick Summary Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
        <div className="px-2 border-r border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold block">Total Baris Terfilter</span>
          <span className="text-sm font-extrabold font-mono text-slate-900">
            {sortedRecords.length.toLocaleString('id-ID')}
          </span>
        </div>
        <div className="px-2 border-r border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold block">Total Spend Terfilter</span>
          <span className="text-sm font-extrabold font-mono text-emerald-600">
            {formatIDR(totalSpendFiltered)}
          </span>
        </div>
        <div className="px-2 border-r border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold block">Total Kuantitas (Qty)</span>
          <span className="text-sm font-extrabold font-mono text-blue-700">
            {totalQtyFiltered.toLocaleString('id-ID')}
          </span>
        </div>
        <div className="px-2">
          <span className="text-[10px] text-slate-500 font-semibold block">Rata-rata Nilai per Baris</span>
          <span className="text-sm font-extrabold font-mono text-slate-700">
            {formatIDR(sortedRecords.length > 0 ? totalSpendFiltered / sortedRecords.length : 0)}
          </span>
        </div>
      </div>

      {/* Search Input & Page Size Selector Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari PO, Item, Vendor, RS, atau Departemen..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
          {tableSearch && (
            <button
              type="button"
              onClick={() => setTableSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-600 shrink-0 self-end sm:self-center font-medium">
          <span>Baris per halaman:</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={10}>10 Baris</option>
            <option value={25}>25 Baris</option>
            <option value={50}>50 Baris</option>
            <option value={100}>100 Baris</option>
          </select>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 select-none">
            <tr>
              <th 
                className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('purchId')}
              >
                <span>PO Number</span>
                {renderSortIndicator('purchId')}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                onClick={() => handleSort('createdDate')}
              >
                <span>Tanggal</span>
                {renderSortIndicator('createdDate')}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap text-center"
                onClick={() => handleSort('hospitalCode')}
              >
                <span>Unit RS</span>
                {renderSortIndicator('hospitalCode')}
              </th>
              <th className="py-3 px-3.5">
                <span>Departemen / Requester</span>
              </th>
              <th 
                className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('vendorName')}
              >
                <span>Vendor Pemasok</span>
                {renderSortIndicator('vendorName')}
              </th>
              <th 
                className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('itemName')}
              >
                <span>Deskripsi Item Barang / SKU</span>
                {renderSortIndicator('itemName')}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors text-right whitespace-nowrap"
                onClick={() => handleSort('purchQty')}
              >
                <span>Qty</span>
                {renderSortIndicator('purchQty')}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors text-right whitespace-nowrap"
                onClick={() => handleSort('purchPrice')}
              >
                <span>Harga Satuan</span>
                {renderSortIndicator('purchPrice')}
              </th>
              <th 
                className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors text-right whitespace-nowrap"
                onClick={() => handleSort('totalLineAmount')}
              >
                <span>Total Spend</span>
                {renderSortIndicator('totalLineAmount')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {paginatedRecords.length > 0 ? (
              paginatedRecords.map((r, idx) => (
                <tr
                  key={r.id || idx}
                  onClick={() => onSelectRecord?.(r)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                >
                  <td className="py-2.5 px-3.5 font-mono text-blue-700 font-semibold group-hover:text-blue-800 whitespace-nowrap">
                    {r.purchId || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                    {r.createdDate || r.monthYear || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono font-bold text-slate-800 text-[11px] border border-slate-200">
                      {r.hospitalCode || 'HO'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 max-w-[150px] truncate" title={r.department || r.requester || '-'}>
                    <div className="font-semibold text-slate-800 truncate">{r.department || '-'}</div>
                    {r.requester && (
                      <div className="text-[10px] text-slate-400 font-mono truncate">{r.requester}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 max-w-[180px] font-medium text-slate-900 truncate" title={r.vendorName}>
                    {r.vendorName || '-'}
                  </td>
                  <td className="py-2.5 px-3.5 max-w-[240px] text-slate-800">
                    <div className="font-semibold truncate text-slate-900" title={r.itemName || r.purchReqName}>
                      {r.itemName || r.purchReqName || '-'}
                    </div>
                    {r.commodityItem && r.commodityItem !== r.itemName && (
                      <div className="text-[10px] text-blue-600 truncate font-mono">
                        Lv5: {r.commodityItem}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                    {Number(r.purchQty || 0).toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-sans">{r.purchUnit || ''}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap text-[11px]">
                    {formatIDR(r.purchPrice)}
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    {formatIDR(r.totalLineAmount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">
                      {tableSearch 
                        ? `Tidak ada transaksi yang cocok dengan kata kunci "${tableSearch}".`
                        : 'Tidak ada transaksi yang cocok dengan kombinasi filter grafik di atas.'}
                    </p>
                    {activeFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={onResetAllFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors mt-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Filter Grafik</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-1">
        <div>
          Menampilkan <span className="font-bold text-slate-800">{sortedRecords.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}</span> -{' '}
          <span className="font-bold text-slate-800">{Math.min(safeCurrentPage * pageSize, sortedRecords.length)}</span> dari{' '}
          <span className="font-bold text-slate-800">{sortedRecords.length.toLocaleString('id-ID')}</span> baris terfilter
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Halaman Pertama"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-xs">
            Halaman {safeCurrentPage} dari {totalPages}
          </span>

          <button
            type="button"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Halaman Terakhir"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
