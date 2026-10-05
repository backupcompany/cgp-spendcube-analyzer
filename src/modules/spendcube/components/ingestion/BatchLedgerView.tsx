import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  HardDrive, 
  FileCheck, 
  DollarSign, 
  Package, 
  Search, 
  Eye, 
  Download, 
  ArrowUpRight,
  ExternalLink,
  Info,
  Folder,
  FileText
} from 'lucide-react';
import { SpendRecord, UploadedBatchMeta } from '../../../../core/types/spend';
import { BatchAuditExplorerDrawer } from './BatchAuditExplorerDrawer';

interface BatchLedgerViewProps {
  uploadedFiles: UploadedBatchMeta[];
  records: SpendRecord[];
  formatIDR: (val: number) => string;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const BatchLedgerView: React.FC<BatchLedgerViewProps> = ({
  uploadedFiles,
  records,
  formatIDR,
  onSelectRecord
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNatureFilter, setSelectedNatureFilter] = useState<'all' | 'po' | 'pr'>('all');
  const [activeAuditBatch, setActiveAuditBatch] = useState<UploadedBatchMeta | null>(null);

  // Compute metrics for each batch
  const enrichedBatches = useMemo(() => {
    return uploadedFiles.map(batch => {
      const isPrSummary = batch.fileType === 'summary_pr' || 
        batch.fileType?.toLowerCase().includes('pr') || 
        batch.fileName?.toLowerCase().includes('summary_pr') ||
        batch.fileType?.includes('Requisition Reference');

      // Matching records in active spend store
      const matchingRecords = records.filter(r => {
        if (r.sourceFileName && batch.fileName && r.sourceFileName === batch.fileName) return true;
        if (r.sourceFile && batch.fileType && r.sourceFile.toLowerCase() === batch.fileType.toLowerCase()) return true;
        return false;
      });

      const totalVal = isPrSummary ? 0 : (batch.totalValue || matchingRecords.reduce((acc, r) => acc + (Number(r.totalLineAmount) || 0), 0));
      const totalQ = isPrSummary ? 0 : (batch.totalQty || matchingRecords.reduce((acc, r) => acc + (Number(r.purchQty) || 0), 0));
      const validCount = matchingRecords.length > 0 ? matchingRecords.length : (batch.recordCount || 0);

      // Determine folder identifier
      let folderLabel = '01_Capex_D365/';
      let folderBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
      const ft = (batch.fileType || '').toLowerCase();
      if (isPrSummary) {
        folderLabel = '05_PR_Summary/';
        folderBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
      } else if (ft.includes('opex_d365')) {
        folderLabel = '02_Opex_D365/';
        folderBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
      } else if (ft.includes('capex_ax')) {
        folderLabel = '03_Capex_AX/';
        folderBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      } else if (ft.includes('opex_ax')) {
        folderLabel = '04_Opex_AX/';
        folderBadgeClass = 'bg-sky-50 text-sky-700 border-sky-200';
      } else if (ft.includes('capex')) {
        folderLabel = '01_Capex_D365/';
        folderBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
      } else if (ft.includes('opex')) {
        folderLabel = '02_Opex_D365/';
        folderBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
      }

      return {
        ...batch,
        isPrSummary,
        folderLabel,
        folderBadgeClass,
        computedValue: totalVal,
        computedQty: totalQ,
        validCount,
        skippedCount: batch.skippedCount || 0
      };
    });
  }, [uploadedFiles, records]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return enrichedBatches.filter(b => {
      if (selectedNatureFilter === 'po' && b.isPrSummary) return false;
      if (selectedNatureFilter === 'pr' && !b.isPrSummary) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const fn = b.fileName.toLowerCase();
        const id = (b.id || '').toLowerCase();
        const folder = b.folderLabel.toLowerCase();
        return fn.includes(q) || id.includes(q) || folder.includes(q);
      }
      return true;
    });
  }, [enrichedBatches, selectedNatureFilter, searchTerm]);

  // Overall Ledger KPIs
  const totalPoSpend = useMemo(() => {
    return enrichedBatches
      .filter(b => !b.isPrSummary)
      .reduce((acc, b) => acc + b.computedValue, 0);
  }, [enrichedBatches]);

  const totalValidLines = useMemo(() => {
    return enrichedBatches
      .filter(b => !b.isPrSummary)
      .reduce((acc, b) => acc + b.validCount, 0);
  }, [enrichedBatches]);

  return (
    <div className="space-y-6">
      {/* Top Ledger Executive Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Batches Logged */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">Total Batch Log</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {uploadedFiles.length}
          </div>
          <p className="text-[11px] text-slate-400">Total riwayat batch terindeks</p>
        </div>

        {/* Total Valid PO Lines */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">Baris Transaksi PO</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {totalValidLines.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400">Transaksi PO terverifikasi (Non-PR)</p>
        </div>

        {/* Total Value Spend */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">Total Nilai Belanja (PO)</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-blue-900 font-mono truncate">
            {formatIDR(totalPoSpend)}
          </div>
          <p className="text-[11px] text-slate-400">Akumulasi line amount rupiah</p>
        </div>

        {/* PR Enrichment Batches */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">Berkas Referensi PR</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-800 font-mono">
            {enrichedBatches.filter(b => b.isPrSummary).length}
          </div>
          <p className="text-[11px] text-slate-400">Data pengayaan pemohon (Non-Spend)</p>
        </div>
      </div>

      {/* Main Tabular Log (System Audit Journal Style) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Filter Ribbon */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Batch Ledger &amp; System Audit Log</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik pada baris log manapun untuk membuka <strong>Table Audit Explorer</strong> dan memeriksa baris spreadsheet aslinya.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berkas, folder, ID batch..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Quick Sifat Filter */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setSelectedNatureFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedNatureFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({enrichedBatches.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedNatureFilter('po')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedNatureFilter === 'po'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PO Lines
              </button>

              <button
                type="button"
                onClick={() => setSelectedNatureFilter('pr')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedNatureFilter === 'pr'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Referensi PR
              </button>
            </div>
          </div>
        </div>

        {/* Tabular Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
              <tr>
                <th className="py-3 px-4">Waktu &amp; ID Batch</th>
                <th className="py-3 px-4">Folder Sumber</th>
                <th className="py-3 px-4 min-w-[220px]">Nama Berkas Spreadsheet</th>
                <th className="py-3 px-4">Sifat Berkas</th>
                <th className="py-3 px-4 text-center">Total Baris</th>
                <th className="py-3 px-4 text-center">Valid PO</th>
                <th className="py-3 px-4 text-center">Skipped</th>
                <th className="py-3 px-4 text-right">Total Belanja (IDR)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Tidak ada riwayat batch yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch, idx) => {
                  return (
                    <tr
                      key={batch.id || idx}
                      onClick={() => setActiveAuditBatch(batch)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp & ID Batch */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="text-slate-900 font-bold">
                          {new Date(batch.uploadedAt).toLocaleDateString('id-ID')}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {batch.id?.slice(-8) || `B-${idx + 1}`}
                        </span>
                      </td>

                      {/* Folder Sumber */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border ${batch.folderBadgeClass}`}>
                          <Folder className="w-3.5 h-3.5 shrink-0" />
                          <span>{batch.folderLabel}</span>
                        </span>
                      </td>

                      {/* Nama Berkas */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-slate-900 truncate max-w-xs group-hover:text-blue-700 transition-colors" title={batch.fileName}>
                            {batch.fileName}
                          </span>
                        </div>
                      </td>

                      {/* Sifat Berkas */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {batch.isPrSummary ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <span>Referensi PR (Enrichment)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span>PO Lines (Transaksi)</span>
                          </span>
                        )}
                      </td>

                      {/* Total Baris */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                        {(batch.recordCount || batch.validCount).toLocaleString('id-ID')}
                      </td>

                      {/* Valid PO */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {batch.isPrSummary ? '-' : batch.validCount.toLocaleString('id-ID')}
                      </td>

                      {/* Skipped */}
                      <td className="py-3 px-4 text-center font-mono text-slate-400 whitespace-nowrap">
                        {batch.skippedCount > 0 ? (
                          <span className="text-amber-700 font-bold">{batch.skippedCount}</span>
                        ) : (
                          <span>0</span>
                        )}
                      </td>

                      {/* Total Spend */}
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        {batch.isPrSummary ? (
                          <span className="text-slate-400 text-[11px] italic font-normal">
                            Rp 0 (Referensi PR)
                          </span>
                        ) : (
                          <span className="text-slate-900">
                            {formatIDR(batch.computedValue)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Terindeks</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveAuditBatch(batch)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                          title="Buka Table Audit Explorer untuk batch ini"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan <strong className="text-slate-800">{filteredBatches.length}</strong> dari total <strong className="text-slate-800">{enrichedBatches.length}</strong> batch riwayat impor
          </div>
          <div className="text-[11px] text-slate-400">
            Penyimpanan terisolasi pada IndexedDB lokal browser
          </div>
        </div>
      </div>

      {/* Batch Audit Explorer Drawer / Modal when a row is clicked */}
      {activeAuditBatch && (
        <BatchAuditExplorerDrawer
          batch={activeAuditBatch}
          allRecords={records}
          onClose={() => setActiveAuditBatch(null)}
          onSelectRecord={onSelectRecord}
        />
      )}
    </div>
  );
};
