import React from 'react';
import { useBackgroundStaging } from '../hooks/useBackgroundStaging';
import { Cpu, Loader2, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface StagingGatekeeperProps {
  featureName: string;
  featureDescription?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export const StagingGatekeeper: React.FC<StagingGatekeeperProps> = ({
  featureName,
  featureDescription,
  onRetry,
  children
}) => {
  const {
    isStagingReady,
    isStagingInProgress,
    progressPercent,
    currentStage,
    currentMessage,
    recordsCount,
    error
  } = useBackgroundStaging();

  // If staging is fully ready, render the feature seamlessly!
  if (isStagingReady && !isStagingInProgress) {
    return <>{children}</>;
  }

  // If staging is in progress or not ready yet, display the non-blocking Staging Gatekeeper
  return (
    <div className="flex flex-col items-center justify-center min-h-[520px] p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-md w-full space-y-6">
        {/* Animated Icon Badge */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
            {isStagingInProgress ? (
              <Cpu className="w-8 h-8 animate-pulse text-blue-600 dark:text-blue-400" />
            ) : error ? (
              <AlertCircle className="w-8 h-8 text-rose-500" />
            ) : (
              <Layers className="w-8 h-8 text-blue-500" />
            )}
          </div>
          {isStagingInProgress && (
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}
        </div>

        {/* Feature Title & Staging Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Background Staging Guard
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Menyiapkan Kompilasi Data {featureName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {featureDescription || 'Kompilasi analitik berat dan pemetaan klaster dijalankan secara asinkron pada Web Worker agar browser tetap responsif.'}
          </p>
        </div>

        {/* Live Progress Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-left space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Loader2 className={`w-3.5 h-3.5 text-blue-500 ${isStagingInProgress ? 'animate-spin' : ''}`} />
              {currentStage || 'MEMPROSES'}
            </span>
            <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
              {progressPercent}%
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/25 animate-[pulse_1.5s_ease-in-out_infinite]" />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="truncate">{currentMessage}</span>
            <span className="shrink-0 font-medium text-slate-400">
              {recordsCount.toLocaleString()} item
            </span>
          </p>
        </div>

        {/* Action Button if error or waiting */}
        {error ? (
          <div className="space-y-2">
            <p className="text-xs text-rose-500 font-medium">
              {error}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Kompilasi Ulang
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Eksekusi fitur akan aktif otomatis begitu kompilasi selesai.</span>
          </div>
        )}
      </div>
    </div>
  );
};
