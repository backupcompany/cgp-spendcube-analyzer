import React from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  FileSpreadsheet, 
  Filter, 
  Database, 
  TrendingUp, 
  Package, 
  Layers, 
  X,
  FileCheck,
  Check,
  Cpu,
  Zap
} from 'lucide-react';
import { UploadedBatchMeta } from '../../../core/types/spend';

export interface BatchProcessingItem {
  fileName: string;
  fileSourceType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  totalRowsScanned?: number;
  validRecordsCount?: number;
  skippedCount?: number;
  totalValue?: number;
  totalQty?: number;
  errorMessage?: string;
  processingEngine?: string;
  rowsPerSec?: number;
}

interface UploadProgressModalProps {
  isOpen: boolean;
  isCompleted: boolean;
  overallProgress: number; // 0 - 100
  currentStepMessage: string;
  currentStepNumber: number; // 1 - 5
  totalFiles: number;
  currentFileIndex: number;
  items: BatchProcessingItem[];
  overallTotals: {
    totalValidRecords: number;
    totalSkippedRows: number;
    totalValue: number;
    totalQty: number;
  };
  speedRowsSec?: number;
  onClose: () => void;
  onFinishAndInspect: () => void;
}

const STEPS = [
  { id: 1, name: 'Validasi File', desc: 'Membaca struktur sheet Excel/CSV' },
  { id: 2, name: 'Filter Non-Item', desc: 'Mengabaikan row Total, Subtotal & Remark' },
  { id: 3, name: 'Normalisasi ERP', desc: 'Mapping kolom D365/AX & SKU Master' },
  { id: 4, name: 'Kalkulasi Total', desc: 'Menghitung Total Value & Qty' },
  { id: 5, name: 'Sinkronisasi DB', desc: 'Menyimpan data transaksi ke SpendCube' },
];

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  isOpen,
  isCompleted,
  overallProgress,
  currentStepMessage,
  currentStepNumber,
  totalFiles,
  currentFileIndex,
  items,
  overallTotals,
  speedRowsSec,
  onClose,
  onFinishAndInspect
}) => {
  if (!isOpen) return null;

  const formatIDR = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;
  const formatQty = (val: number) => `${Math.round(val || 0).toLocaleString('id-ID')} Unit`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transition-all duration-300">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shadow-inner">
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-300 animate-bounce" />
              ) : (
                <Loader2 className="w-6 h-6 text-blue-200 animate-spin" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">
                  {isCompleted ? 'Impor Dokumen Selesai & Terverifikasi' : 'Memproses & Mengimpor Transaksi'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1 border border-emerald-400/30">
                  <Zap className="w-2.5 h-2.5" /> Web Worker
                </span>
              </div>
              <p className="text-xs text-blue-100/90 font-medium">
                {isCompleted 
                  ? `${totalFiles} file berhasil diproses tanpa lag browser (Total/Remark disaring).`
                  : `File ${Math.min(currentFileIndex + 1, totalFiles)} dari ${totalFiles} sedang diolah di background thread.`}
              </p>
            </div>
          </div>

          {isCompleted && (
            <button 
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Engine & Anti-Freeze Guarantee Badge */}
          <div className="flex items-center justify-between bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 px-3.5 py-2.5 rounded-xl text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-medium text-[11px]">
                <strong className="font-semibold">Mekanisme Anti-Freeze Aktif:</strong> Parsing data dijalankan di Background Worker OS & penulisan DB bertahap (Chunking).
              </span>
            </div>
            {Boolean(speedRowsSec && speedRowsSec > 0) && (
              <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-slate-700 shrink-0 ml-2">
                ⚡ {speedRowsSec.toLocaleString('id-ID')} baris/detik
              </span>
            )}
          </div>

          {/* Visual Step Tracker */}
          <div className="grid grid-cols-5 gap-1 text-center">
            {STEPS.map((step) => {
              const isPast = isCompleted || step.id < currentStepNumber;
              const isCurrent = !isCompleted && step.id === currentStepNumber;
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div 
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPast 
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50 animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  <span className={`text-[10px] font-semibold mt-1.5 leading-tight ${
                    isCurrent ? 'text-blue-600 dark:text-blue-400' : isPast ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'
                  }`}>
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar with Percentage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                {!isCompleted && <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />}
                {currentStepMessage || 'Sedang memproses...'}
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">
                {Math.round(overallProgress)}%
              </span>
            </div>
            
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, overallProgress))}%` }}
              />
            </div>
          </div>

          {/* Live File Queue Status List */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-3.5 max-h-48 overflow-y-auto space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 px-1 flex justify-between">
              <span>Daftar File ({items.length})</span>
              <span>Status Pengolahan</span>
            </div>

            {items.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition-all border ${
                  item.status === 'processing'
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                    : item.status === 'completed'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-200'
                    : item.status === 'error'
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileSpreadsheet className={`w-4 h-4 shrink-0 ${
                    item.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-500'
                  }`} />
                  <div className="truncate">
                    <span className="font-medium truncate block max-w-xs">{item.fileName}</span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-300">
                      {(item.fileSize / 1024).toFixed(1)} KB • {item.fileSourceType}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {item.status === 'processing' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Memproses...
                    </span>
                  )}
                  {item.status === 'completed' && (
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {(item.validRecordsCount || 0).toLocaleString()} Baris
                      </span>
                      {Boolean(item.skippedCount && item.skippedCount > 0) && (
                        <div className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                          ({item.skippedCount} non-item diabaikan)
                        </div>
                      )}
                    </div>
                  )}
                  {item.status === 'pending' && (
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Menunggu antrean
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      Gagal diurai
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Results Summary Box (Appears when Completed) */}
          {isCompleted && (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <FileCheck className="w-4 h-4" />
                <span>Ringkasan Hasil Verifikasi & Ingesti Data</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Transaksi Valid</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    {(overallTotals.totalValidRecords || 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Total Value Spend</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {formatIDR(overallTotals.totalValue)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Total Kuantitas</div>
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                    <Package className="w-3.5 h-3.5" />
                    {formatQty(overallTotals.totalQty)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Non-Item Disaring</div>
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                    <Filter className="w-3.5 h-3.5" />
                    {(overallTotals.totalSkippedRows || 0).toLocaleString('id-ID')} Baris
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                ✓ Baris yang mengandung teks <span className="font-semibold">"TOTAL", "SUBTOTAL", "REMARK", "CATATAN"</span> atau nama item kosong telah secara otomatis diabaikan sehingga data SpendCube 100% bersih dan akurat.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {isCompleted ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Sinkronisasi database lokal berhasil
              </span>
            ) : (
              <span>Mohon tunggu hingga proses validasi & penyimpanan selesai...</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isCompleted ? (
              <button
                onClick={onFinishAndInspect}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Lihat & Analisa Data di SpendCube
              </button>
            ) : (
              <div className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold rounded-xl cursor-not-allowed flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sedang Memproses...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

