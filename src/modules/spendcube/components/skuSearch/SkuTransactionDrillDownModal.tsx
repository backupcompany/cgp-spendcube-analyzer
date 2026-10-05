import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Building2, 
  FileSpreadsheet, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Download,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { SpendRecord } from '../../../../core/types/spend';
import { SkuEnrichedWithStats, formatIDR } from './types';

interface SkuTransactionDrillDownModalProps {
  sku: SkuEnrichedWithStats;
  onClose: () => void;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const SkuTransactionDrillDownModal: React.FC<SkuTransactionDrillDownModalProps> = ({
  sku,
  onClose,
  onSelectRecord
}) => {
  const [search, setSearch] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const isVirtual = sku.isVirtualSku || sku.isUnmappedGroup;

  const uniqueHospitals = useMemo(() => {
    const set = new Set<string>();
    for (const t of sku.transactions) {
      if (t.hospitalCode) set.add(t.hospitalCode);
    }
    return Array.from(set).sort();
  }, [sku.transactions]);

  const filteredTransactions = useMemo(() => {
    return sku.transactions.filter(t => {
      if (hospitalFilter !== 'ALL' && t.hospitalCode !== hospitalFilter) {
        return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const pId = (t.purchId || '').toLowerCase();
        const vendor = (t.vendorName || '').toLowerCase();
        const item = (t.itemName || t.rawItemName || '').toLowerCase();
        if (!pId.includes(s) && !vendor.includes(s) && !item.includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [sku.transactions, search, hospitalFilter]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, hospitalFilter]);

  const stats = useMemo(() => {
    let spend = 0;
    let qty = 0;
    for (const t of filteredTransactions) {
      spend += Number(t.totalLineAmount) || 0;
      qty += Number(t.purchQty) || 0;
    }
    return { spend, qty, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Export CSV Handler
  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) return;
    const headers = [
      'No PO',
      'Tanggal',
      'Entitas RS',
      'Vendor',
      'Deskripsi Item PO',
      'Item Asli',
      'Qty',
      'Satuan',
      'Harga Satuan',
      'Total Nilai (IDR)',
      'Status Mapping'
    ];

    const rows = filteredTransactions.map(tx => [
      `"${(tx.purchId || '').replace(/"/g, '""')}"`,
      `"${(tx.createdDate || '').slice(0, 10)}"`,
      `"${(tx.hospitalCode || '').replace(/"/g, '""')}"`,
      `"${(tx.vendorName || '').replace(/"/g, '""')}"`,
      `"${(tx.itemName || '').replace(/"/g, '""')}"`,
      `"${(tx.rawItemName || '').replace(/"/g, '""')}"`,
      tx.purchQty || 0,
      `"${(tx.purchUnit || 'Unit').replace(/"/g, '""')}"`,
      tx.purchPrice || 0,
      tx.totalLineAmount || 0,
      `"${isVirtual ? 'Belum Ada Master SKU (Unmapped)' : 'Terpetakan ke ' + sku.productId}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PO_${(sku.productId || 'UNMAPPED').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className={`p-3.5 sm:p-4 border-b flex items-start justify-between gap-4 shrink-0 ${
          isVirtual 
            ? 'bg-amber-50/70 border-amber-200' 
            : 'bg-slate-50/80 border-slate-200'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isVirtual ? (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-600 text-white flex items-center gap-1 shadow-2xs">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Grup Item PO Belum Ada Master SKU
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-600 text-white font-mono shadow-2xs">
                  Master SKU [{sku.productId}]
                </span>
              )}

              <span className="text-xs font-bold text-slate-500 uppercase">
                {sku.purchCategoryLv1}
              </span>

              {!isVirtual && !sku.isActive && (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  STATUS: NON-AKTIF
                </span>
              )}
            </div>

            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              {sku.canonicalName}
            </h2>
            <p className="text-xs text-slate-500">
              Menampilkan {filteredTransactions.length} dari {sku.transactionCount} transaksi PO
              {isVirtual ? ' yang memiliki kesamaan nama item ini' : ' yang terpetakan ke SKU ini'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportCsv}
              className="p-1.5 text-slate-600 hover:text-blue-700 rounded-lg hover:bg-slate-200/80 transition-colors flex items-center gap-1 text-xs font-semibold px-2 cursor-pointer"
              title="Download CSV PO"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Unduh CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Filter & Stats Bar */}
        <div className="p-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nomor PO, vendor, atau item PO..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {uniqueHospitals.length > 1 && (
              <select
                value={hospitalFilter}
                onChange={e => setHospitalFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua RS ({uniqueHospitals.length})</option>
                {uniqueHospitals.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            )}
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Total Belanja</span>
              <strong className="text-slate-900">{formatIDR(stats.spend)}</strong>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-400 block">Total Volume</span>
              <strong className="text-slate-800">{stats.qty.toLocaleString('id-ID')} {sku.unitOfMeasurement}</strong>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-400 block">Transaksi</span>
              <strong className="text-blue-700">{filteredTransactions.length} PO</strong>
            </div>
          </div>
        </div>

        {/* Notice for 2000+ lines scalability */}
        {filteredTransactions.length > pageSize && (
          <div className="px-3.5 py-1.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-[11px] text-blue-800">
            <span>
              Menampilkan baris <strong>{((currentPage - 1) * pageSize) + 1}</strong> - <strong>{Math.min(currentPage * pageSize, filteredTransactions.length)}</strong> dari total <strong>{filteredTransactions.length} baris PO</strong>.
            </span>
            <div className="flex items-center gap-1 font-mono font-medium">
              <span>Halaman {currentPage} / {totalPages}</span>
            </div>
          </div>
        )}

        {/* Transactions Table Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {paginatedTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Tidak ada transaksi PO yang sesuai kriteria filter modal
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 text-[11px] z-10">
                <tr>
                  <th className="py-2 px-3">No. PO & Tanggal</th>
                  <th className="py-2 px-3">Entitas RS</th>
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">Deskripsi Item PO</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Harga Satuan</th>
                  <th className="py-2 px-3 text-right">Total Nilai</th>
                  <th className="py-2 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2 px-3 font-mono">
                      <div className="font-bold text-slate-900">{tx.purchId}</div>
                      <div className="text-[10px] text-slate-400">{tx.createdDate?.slice(0, 10)}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                        {tx.hospitalCode || 'RS'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-medium max-w-[150px] truncate" title={tx.vendorName}>
                      {tx.vendorName}
                    </td>
                    <td className="py-2 px-3 text-slate-800 max-w-[240px]">
                      <div className="font-medium truncate" title={tx.itemName}>{tx.itemName}</div>
                      {tx.rawItemName && tx.rawItemName !== tx.itemName && (
                        <div className="text-[10px] text-slate-400 truncate" title={tx.rawItemName}>
                          Asli: {tx.rawItemName}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      <span className="font-semibold text-slate-800">{tx.purchQty}</span>
                      <span className="text-[10px] text-slate-400 ml-1">{tx.purchUnit || 'Unit'}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {formatIDR(tx.purchPrice)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatIDR(tx.totalLineAmount)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {onSelectRecord && (
                        <button
                          type="button"
                          onClick={() => onSelectRecord(tx)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="Buka detail transaksi belanja"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer with Pagination Controls */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-[11px]">
              Total {filteredTransactions.length} baris PO
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              className="text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Ekspor Semua ({filteredTransactions.length})</span>
            </button>
          </div>

          {/* Pagination buttons */}
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 py-0.5 text-slate-700 font-mono text-xs">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
