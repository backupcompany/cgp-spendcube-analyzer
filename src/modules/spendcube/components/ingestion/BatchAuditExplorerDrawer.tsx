import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Search, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  User, 
  Tag, 
  Layers, 
  HardDrive,
  Copy,
  ExternalLink,
  Info
} from 'lucide-react';
import { SpendRecord, UploadedBatchMeta } from '../../../../core/types/spend';
import * as XLSX from 'xlsx';

interface BatchAuditExplorerDrawerProps {
  batch: UploadedBatchMeta;
  allRecords: SpendRecord[];
  onClose: () => void;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const BatchAuditExplorerDrawer: React.FC<BatchAuditExplorerDrawerProps> = ({
  batch,
  allRecords,
  onClose,
  onSelectRecord
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with_notes' | 'with_sku'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pageSize = 20;

  // Filter records belonging to this batch
  const batchRecords = useMemo(() => {
    return allRecords.filter(r => {
      if (r.sourceFileName && batch.fileName && r.sourceFileName === batch.fileName) {
        return true;
      }
      if (r.sourceFile && batch.fileType && r.sourceFile.toLowerCase() === batch.fileType.toLowerCase()) {
        return true;
      }
      return false;
    });
  }, [allRecords, batch]);

  // Secondary Filter (Search & Type)
  const filteredRecords = useMemo(() => {
    return batchRecords.filter(r => {
      if (filterType === 'with_notes' && !r.itemNotes) return false;
      if (filterType === 'with_sku' && !r.extractedSkuCode) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const po = (r.purchId || '').toLowerCase();
        const name = (r.itemName || '').toLowerCase();
        const raw = (r.rawItemName || '').toLowerCase();
        const sku = (r.extractedSkuCode || '').toLowerCase();
        const vendor = (r.vendorName || '').toLowerCase();
        const user = (r.requesterName || r.requester || '').toLowerCase();
        const unit = (r.hospitalCode || '').toLowerCase();

        return po.includes(q) || name.includes(q) || raw.includes(q) || sku.includes(q) || vendor.includes(q) || user.includes(q) || unit.includes(q);
      }

      return true;
    });
  }, [batchRecords, filterType, searchTerm]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportBatchCsv = () => {
    if (batchRecords.length === 0) return;
    const exportData = batchRecords.map(r => ({
      'Purch ID': r.purchId,
      'Line Number': r.lineNumber,
      'Date': r.createdDate,
      'Hospital Unit': r.hospitalCode,
      'Requester / User': r.requesterName || r.requester || '',
      'Department': r.department || '',
      'Item Clean Name': r.itemName,
      'Extracted SKU Code': r.extractedSkuCode || '',
      'Item Notes': r.itemNotes || '',
      'Raw Cell Content': r.rawItemName || r.itemName,
      'Quantity': r.purchQty,
      'Unit': r.purchUnit,
      'Unit Price': r.purchPrice,
      'Total Spend IDR': r.totalLineAmount,
      'Category': r.purchaseCategory,
      'File Name': r.sourceFileName,
      'File Source': r.sourceFile
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Batch_Audit');
    XLSX.writeFile(wb, `Batch_Audit_${batch.fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
  };

  const totalBatchSpend = useMemo(() => {
    return batchRecords.reduce((acc, r) => acc + (Number(r.totalLineAmount) || 0), 0);
  }, [batchRecords]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                  BATCH AUDIT EXPLORER
                </span>
                <span className="text-xs font-mono text-slate-400 font-bold">
                  {batch.fileType?.toUpperCase()}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 truncate max-w-xl">
                {batch.fileName}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportBatchCsv}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Batch (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Batch Key Metrics Banner */}
        <div className="px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center space-x-6 flex-wrap gap-y-2">
            <div>
              <span className="text-slate-400 text-[10px] uppercase block font-sans">Total Baris Terindeks</span>
              <span className="text-base font-bold text-emerald-400">{batchRecords.length.toLocaleString('id-ID')} Baris</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block font-sans">Total Nilai Spend</span>
              <span className="text-base font-bold text-white">{formatIDR(totalBatchSpend)}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block font-sans">Waktu Impor</span>
              <span className="text-slate-300">{new Date(batch.uploadedAt).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Terverifikasi di IndexedDB</span>
            </span>
          </div>
        </div>

        {/* Filter and Search Ribbon */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nomor PO, nama item, SKU, kode RS, petugas..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Quick Pills */}
            <div className="flex items-center space-x-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Baris ({batchRecords.length})
              </button>

              <button
                type="button"
                onClick={() => { setFilterType('with_sku'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'with_sku'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Memuat Kode SKU
              </button>

              <button
                type="button"
                onClick={() => { setFilterType('with_notes'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'with_notes'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Memuat Catatan
              </button>
            </div>
          </div>
        </div>

        {/* Forensic Line-by-Line Table */}
        <div className="overflow-x-auto flex-1 p-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">No PO &amp; Line</th>
                <th className="py-2.5 px-3">Unit RS</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Petugas / Pemohon</th>
                <th className="py-2.5 px-3 min-w-[200px]">Deskripsi Item &amp; Catatan</th>
                <th className="py-2.5 px-3">Kode SKU</th>
                <th className="py-2.5 px-3 min-w-[220px]">Original Cell Upload</th>
                <th className="py-2.5 px-3 text-right">Spend (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada baris transaksi yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => {
                  const isRawDiff = Boolean(r.rawItemName && r.rawItemName !== r.itemName);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelectRecord && onSelectRecord(r)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    >
                      {/* PO & Line */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                        <div>{r.purchId}</div>
                        <span className="text-[10px] text-slate-400 font-normal">Line #{r.lineNumber}</span>
                      </td>

                      {/* Unit RS */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {r.hospitalCode}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                        {r.createdDate}
                      </td>

                      {/* Requester / Dept */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800 truncate max-w-[140px]" title={r.requesterName || r.requester}>
                          {r.requesterName || r.requester || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={r.department}>
                          {r.department || '-'}
                        </div>
                      </td>

                      {/* Item Description */}
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900 line-clamp-2" title={r.itemName}>
                          {r.itemName}
                        </p>
                        {r.itemNotes && (
                          <p className="text-[10px] text-slate-500 italic line-clamp-1 mt-0.5" title={r.itemNotes}>
                            Catatan: {r.itemNotes}
                          </p>
                        )}
                      </td>

                      {/* SKU Code */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                        {r.extractedSkuCode ? (
                          <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                            {r.extractedSkuCode}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Tanpa SKU</span>
                        )}
                      </td>

                      {/* Raw Cell Upload */}
                      <td className="py-2.5 px-3">
                        <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px] font-mono text-slate-600 line-clamp-2" title={r.rawItemName || r.itemName}>
                          {r.rawItemName || r.itemName}
                        </div>
                      </td>

                      {/* Spend */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatIDR(r.totalLineAmount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan <strong className="text-slate-800">{paginatedRecords.length}</strong> dari{' '}
            <strong className="text-slate-800">{filteredRecords.length}</strong> baris
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="font-mono text-xs">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
