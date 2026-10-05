import React from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface Props {
  status: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
  label?: string;
  className?: string;
}

export const IngestionStatusBadge: React.FC<Props> = ({ status, label, className = '' }) => {
  if (status === 'COMPLETE') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{label || 'Lengkap & Terverifikasi'}</span>
      </span>
    );
  }

  if (status === 'PARTIAL') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>{label || 'Sebagian / Parsial'}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 ${className}`}>
      <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>{label || 'Belum Ada Ingestion'}</span>
    </span>
  );
};
