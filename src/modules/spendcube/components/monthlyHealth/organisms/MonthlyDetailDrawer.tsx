import React, { useState } from 'react';
import { MonthlyIngestionRecord, SpendRecord } from '../../../../../core/types/spend';
import { IngestionStatusBadge } from '../atoms/IngestionStatusBadge';
import { FidelityMeter } from '../atoms/FidelityMeter';
import { 
  X, 
  FileSpreadsheet, 
  Building2, 
  Layers, 
  DollarSign, 
  Clock, 
  Calendar,
  Download,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface Props {
  month: MonthlyIngestionRecord | null;
  records: SpendRecord[];
  onClose: () => void;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const MonthlyDetailDrawer: React.FC<Props> = ({
  month,
  records,
  onClose,
  onSelectRecord
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'hospitals' | 'transactions'>('files');
  const [searchTerm, setSearchTerm] = useState('');

  if (!month) return null;

  const formatIDR = (val: number) => `Rp ${Math.round(val).toLocaleString('id-ID')}`;

  const formatDateTime = (isoStr: string | null) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';
    } catch {
      return isoStr;
    }
  };

  // Get matching transactions for this month
  const monthRecords = records.filter(r => {
    if (!r) return false;
    if (r.monthYear === month.monthKey) return true;
    if (r.createdDate && r.createdDate.startsWith(month.monthKey)) return true;
    return false;
  });

  const filteredMonthRecords = monthRecords.filter(r => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (r.purchId && r.purchId.toLowerCase().includes(q)) ||
      (r.itemName && r.itemName.toLowerCase().includes(q)) ||
      (r.vendorName && r.vendorName.toLowerCase().includes(q)) ||
      (r.hospitalCode && r.hospitalCode.toLowerCase().includes(q)) ||
      (r.sourceFileName && r.sourceFileName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                {month.monthShortIndo}
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Rincian Ingestion {month.monthNameIndo} {month.year}
              </h2>
              <IngestionStatusBadge status={month.completenessStatus} label={month.completenessLabel} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Periode Kalender Gregorian: {month.gregorianPeriod} ({month.daysInMonth} Hari)
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI Strip */}
        <div className="p-4 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Belanja</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{formatIDR(month.totalSpend)}</span>
            <span className="text-[10px] text-slate-500 block">{month.totalQty.toLocaleString('id-ID')} unit</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase block">Belanja OPEX</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatIDR(month.opexSpend)}</span>
            <span className="text-[10px] text-slate-500 block">{month.opexQty.toLocaleString('id-ID')} unit ({month.opexRecordCount} baris)</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase block">Belanja CAPEX</span>
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatIDR(month.capexSpend)}</span>
            <span className="text-[10px] text-slate-500 block">{month.capexQty.toLocaleString('id-ID')} unit ({month.capexRecordCount} baris)</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Integritas Ingestion</span>
            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{month.uniquenessRatioPct}% Unik</span>
            <span className="text-[10px] text-slate-500 block">{month.uniquePoCount} PO / {month.filesCount} berkas</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'files'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Berkas Sumber Ingestion ({month.filesCount})</span>
            </div>
            {activeTab === 'files' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('hospitals')}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'hospitals'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              <span>Distribusi Unit RS ({month.hospitalBreakdowns.length})</span>
            </div>
            {activeTab === 'hospitals' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'transactions'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Sampel Transaksi ({monthRecords.length})</span>
            </div>
            {activeTab === 'transactions' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: FILES LIST */}
          {activeTab === 'files' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Daftar Berkas Excel/CSV yang Menyumbang Transaksi ke Bulan Ini
                </h4>
                <span className="text-[11px] text-slate-500">
                  Update Terakhir: {formatDateTime(month.latestIngestedAt)}
                </span>
              </div>

              {month.fileContributions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Belum ada berkas terunggah untuk periode ini</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {month.fileContributions.map((fc, idx) => (
                    <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {fc.fileName}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-[10px] font-mono uppercase">
                            {fc.sourceType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>Uploaded: {formatDateTime(fc.uploadedAt)}</span>
                        </div>
                      </div>

                      <div className="text-right sm:border-l sm:border-slate-100 sm:dark:border-slate-800 sm:pl-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs font-mono">
                          {formatIDR(fc.totalValue)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {fc.recordCount} baris ({fc.totalQty.toLocaleString('id-ID')} unit)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HOSPITALS BREAKDOWN */}
          {activeTab === 'hospitals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Distribusi Belanja dan Partisipasi Rumah Sakit ({month.monthNameIndo})
                </h4>
                <span className="text-[11px] text-slate-500">
                  {month.hospitalBreakdowns.length} Rumah Sakit Terdata
                </span>
              </div>

              {month.hospitalBreakdowns.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Belum ada data rumah sakit untuk bulan ini</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 px-3">Kode RS</th>
                        <th className="py-2.5 px-3 text-right">Belanja OPEX</th>
                        <th className="py-2.5 px-3 text-right">Belanja CAPEX</th>
                        <th className="py-2.5 px-3 text-right">Total Belanja</th>
                        <th className="py-2.5 px-3 text-right">Qty &amp; Baris</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
                      {month.hospitalBreakdowns.map((h, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-500" />
                              <span>{h.hospitalCode}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                            {formatIDR(h.opexSpend)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">
                            {formatIDR(h.capexSpend)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {formatIDR(h.totalSpend)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[11px] font-sans text-slate-500">
                            {h.totalQty.toLocaleString('id-ID')} unit ({h.recordCount} rows)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAMPLE TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter transaksi di bulan ini (PO, Item, Vendor, RS)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-500 shrink-0">
                  Menampilkan {Math.min(50, filteredMonthRecords.length)} dari {monthRecords.length} baris
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">PO &amp; Tgl</th>
                      <th className="py-2.5 px-3">RS</th>
                      <th className="py-2.5 px-3">Nama Barang</th>
                      <th className="py-2.5 px-3">Vendor</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {filteredMonthRecords.slice(0, 50).map((r, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => onSelectRecord && onSelectRecord(r)}
                        className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-3 font-sans">
                          <div className="font-bold text-blue-600 dark:text-blue-400">{r.purchId}</div>
                          <div className="text-[10px] text-slate-400">{r.createdDate}</div>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {r.hospitalCode}
                        </td>
                        <td className="py-2 px-3 font-sans max-w-xs truncate" title={r.itemName}>
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{r.itemName}</div>
                          <div className="text-[10px] text-slate-400">{r.purchaseCategory}</div>
                        </td>
                        <td className="py-2 px-3 font-sans max-w-xs truncate text-slate-600 dark:text-slate-300" title={r.vendorName}>
                          {r.vendorName}
                        </td>
                        <td className="py-2 px-3 text-right font-sans text-slate-700 dark:text-slate-300">
                          {r.purchQty} {r.purchUnit || 'unit'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {formatIDR(r.totalLineAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {month.completenessNote}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
