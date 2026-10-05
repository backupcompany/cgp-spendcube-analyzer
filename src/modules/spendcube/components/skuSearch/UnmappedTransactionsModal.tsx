import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Download, 
  HelpCircle, 
  Building2, 
  ExternalLink 
} from 'lucide-react';
import { SpendRecord } from '../../../../core/types/spend';
import { formatIDR } from './types';

interface UnmappedTransactionsModalProps {
  unmappedRecords: SpendRecord[];
  committedQuery: string;
  onClose: () => void;
  onExportCsv: () => void;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const UnmappedTransactionsModal: React.FC<UnmappedTransactionsModalProps> = ({
  unmappedRecords,
  committedQuery,
  onClose,
  onExportCsv,
  onSelectRecord
}) => {
  const [search, setSearch] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('ALL');

  const uniqueHospitals = useMemo(() => {
    const set = new Set<string>();
    for (const r of unmappedRecords) {
      if (r.hospitalCode) set.add(r.hospitalCode);
    }
    return Array.from(set).sort();
  }, [unmappedRecords]);

  const filtered = useMemo(() => {
    return unmappedRecords.filter(r => {
      if (hospitalFilter !== 'ALL' && r.hospitalCode !== hospitalFilter) {
        return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const pId = (r.purchId || '').toLowerCase();
        const vendor = (r.vendorName || '').toLowerCase();
        const item = (r.itemName || r.rawItemName || '').toLowerCase();
        if (!pId.includes(s) && !vendor.includes(s) && !item.includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [unmappedRecords, search, hospitalFilter]);

  const totalSpend = useMemo(() => {
    return filtered.reduce((acc, r) => acc + (Number(r.totalLineAmount) || 0), 0);
  }, [filtered]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-amber-50/70 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-600 text-white flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                TRANSAKSI BELUM TERPETAKAN (UNMAPPED)
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Daftar Transaksi PO Belum Memiliki Master SKU
            </h2>
            <p className="text-xs text-slate-600">
              Kueri: "{committedQuery || 'Semua'}" • Menampilkan {filtered.length} transaksi senilai {formatIDR(totalSpend)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ekspor ke CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari PO, vendor, atau item..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
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
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Tidak ada transaksi belum ter-map yang sesuai filter
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 text-[11px]">
                <tr>
                  <th className="py-2 px-3">No. PO & Tanggal</th>
                  <th className="py-2 px-3">Entitas RS</th>
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">Deskripsi Item PO</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Harga Satuan</th>
                  <th className="py-2 px-3 text-right">Total Spend</th>
                  <th className="py-2 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-2 px-3 font-mono">
                      <div className="font-bold text-slate-900">{tx.purchId}</div>
                      <div className="text-[10px] text-slate-400">{tx.createdDate?.slice(0, 10)}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-medium text-[10px]">
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
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-950">
                      {formatIDR(tx.totalLineAmount)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {onSelectRecord && (
                        <button
                          type="button"
                          onClick={() => onSelectRecord(tx)}
                          className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors"
                          title="Buka detail transaksi"
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

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-mono text-[11px]">
            Total {filtered.length} baris PO
          </span>
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
  );
};
