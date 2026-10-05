import React, { useState } from 'react';
import { useBackgroundStaging } from '../hooks/useBackgroundStaging';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord 
} from '../types/spend';
import { 
  Cpu, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown, 
  Zap,
  HardDrive,
  Database
} from 'lucide-react';

interface StagingProgressBarFooterProps {
  records: SpendRecord[];
  skuMasters?: SkuMasterRecord[];
  hospitalMasters?: HospitalMasterRecord[];
  vendorMasters?: VendorMasterRecord[];
}

export const StagingProgressBarFooter: React.FC<StagingProgressBarFooterProps> = ({
  records,
  skuMasters = [],
  hospitalMasters = [],
  vendorMasters = []
}) => {
  const {
    isStagingReady,
    isStagingInProgress,
    progressPercent,
    currentStage,
    currentMessage,
    recordsCount,
    lastStagedTimestamp,
    lastDurationMs,
    error,
    triggerStaging,
    isSkuMappingInProgress,
    skuMappingProgressPercent,
    skuMappingMessage,
    skuMappingProcessed,
    skuMappingTotal
  } = useBackgroundStaging();

  const [isExpanded, setIsExpanded] = useState(false);

  const handleManualReStage = () => {
    triggerStaging(records, skuMasters, hospitalMasters, vendorMasters, undefined, true);
  };

  const isAnyWorkerActive = isStagingInProgress || isSkuMappingInProgress;
  const activePercent = isSkuMappingInProgress ? (skuMappingProgressPercent || 0) : progressPercent;

  // If no records at all, don't show distraction
  if (records.length === 0 && !isAnyWorkerActive) {
    return null;
  }

  return (
    <div 
      id="staging-progress-footer"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 text-slate-100 border-t border-slate-700/70 backdrop-blur shadow-2xl transition-all duration-300"
    >
      {/* Top Animated Progress Bar Stripe when active */}
      {isAnyWorkerActive && (
        <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ease-out relative ${
              isSkuMappingInProgress
                ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'
            }`}
            style={{ width: `${activePercent}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-[pulse_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      {/* Main Footer Bar Row */}
      <div className="w-full px-4 sm:px-6 py-2 flex items-center justify-between gap-4 text-xs">
        {/* Left Status Indicator */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
            <Cpu className={`w-3.5 h-3.5 ${isAnyWorkerActive ? 'text-cyan-400 animate-spin' : isStagingReady ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="font-semibold text-[11px] text-slate-200">
              {isSkuMappingInProgress ? 'Web Worker (SKU Mapping)' : 'Web Worker'}
            </span>
          </div>

          <div className="flex items-center gap-2 truncate">
            {isSkuMappingInProgress ? (
              <div className="flex items-center gap-2 truncate text-cyan-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-cyan-400" />
                <span className="font-medium truncate">
                  {skuMappingMessage || 'Menyelaraskan taksonomi SKU di latar belakang...'}
                </span>
                <span className="shrink-0 px-1.5 py-0.2 bg-cyan-900/60 text-cyan-200 rounded font-mono font-bold text-[10px]">
                  {activePercent}% {skuMappingProcessed && skuMappingTotal ? `(${skuMappingProcessed}/${skuMappingTotal})` : ''}
                </span>
              </div>
            ) : isStagingInProgress ? (
              <div className="flex items-center gap-2 truncate text-blue-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-blue-400" />
                <span className="font-medium truncate">
                  {currentMessage}
                </span>
                <span className="shrink-0 px-1.5 py-0.2 bg-blue-900/60 text-blue-300 rounded font-mono font-bold text-[10px]">
                  {progressPercent}%
                </span>
              </div>
            ) : isStagingReady ? (
              <div className="flex items-center gap-2 text-slate-300 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">
                  Staging Kompilasi Siap ({recordsCount.toLocaleString()} item • {lastDurationMs || 0}ms)
                </span>
                {lastStagedTimestamp && (
                  <span className="text-slate-400 text-[10px] hidden md:inline">
                    • Sinkron {new Date(lastStagedTimestamp).toLocaleTimeString('id-ID')}
                  </span>
                )}
              </div>
            ) : error ? (
              <div className="flex items-center gap-1.5 text-rose-400 truncate">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            ) : (
              <span className="text-slate-400 truncate">
                Siap memproses data di background thread.
              </span>
            )}
          </div>
        </div>

        {/* Right Action & Stats Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-3 text-slate-400 text-[11px] border-r border-slate-700 pr-3">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-indigo-400" />
              IndexedDB Staging
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              0ms Main-Thread Latency
            </span>
          </div>

          <button
            onClick={handleManualReStage}
            disabled={isStagingInProgress || records.length === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              isStagingInProgress
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 active:scale-95'
            }`}
            title="Jalankan ulang kompilasi klaster semantik & price intelligence di background worker"
          >
            <RefreshCw className={`w-3 h-3 ${isStagingInProgress ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Kompilasi Ulang</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title={isExpanded ? 'Tutup rincian status staging' : 'Buka rincian status staging'}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <div className="w-full px-4 sm:px-6 pb-3 pt-1 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300 animate-in fade-in duration-200">
          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            <p className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              Status Kompilasi Latar Belakang
            </p>
            <p className="text-[11px] text-slate-400">
              Tahap Aktif: <span className="font-mono text-slate-200 font-medium">{currentStage}</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Kapasitas Transaksi: <span className="text-slate-200">{records.length.toLocaleString()} baris</span>
            </p>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            <p className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Performa & UI Responsiveness
            </p>
            <p className="text-[11px] text-slate-400">
              Thread: <span className="text-emerald-400 font-medium">Dedicated Web Worker (Non-Blocking)</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Durasi Staging: <span className="text-slate-200">{lastDurationMs ? `${lastDurationMs} ms` : '-'}</span>
            </p>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            <p className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Modul Terkompilasi
            </p>
            <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
              <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-200">Klaster Semantik</span>
              <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-200">Price Surges</span>
              <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-200">Disparitas Tarif</span>
              <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-200">Substitusi Vendor</span>
              <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-200">Audit Standar ERP</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
