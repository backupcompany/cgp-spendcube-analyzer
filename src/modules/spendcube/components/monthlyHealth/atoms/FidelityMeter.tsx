import React from 'react';

interface Props {
  uniqueCount: number;
  overwrittenCount: number;
  totalCount: number;
  uniquenessPct: number;
  compact?: boolean;
}

export const FidelityMeter: React.FC<Props> = ({
  uniqueCount,
  overwrittenCount,
  totalCount,
  uniquenessPct,
  compact = false
}) => {
  if (totalCount === 0) {
    return <span className="text-xs text-slate-400 font-mono">-</span>;
  }

  if (compact) {
    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {uniqueCount.toLocaleString('id-ID')} <span className="text-slate-400 font-normal">unik</span>
          </span>
          {overwrittenCount > 0 && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              +{overwrittenCount.toLocaleString('id-ID')} ditimpa
            </span>
          )}
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden flex">
          <div 
            className="bg-emerald-500 h-full rounded-l-full" 
            style={{ width: `${Math.min(100, Math.max(0, uniquenessPct))}%` }} 
          />
          {overwrittenCount > 0 && (
            <div 
              className="bg-amber-400 h-full rounded-r-full" 
              style={{ width: `${Math.min(100, 100 - uniquenessPct)}%` }} 
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {uniqueCount.toLocaleString('id-ID')} Baris Unik ({uniquenessPct}%)
          </span>
        </div>
        {overwrittenCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {overwrittenCount.toLocaleString('id-ID')} Ditimpa/Revisi
            </span>
          </div>
        )}
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
        <div 
          className="bg-emerald-500 h-full" 
          style={{ width: `${Math.min(100, Math.max(0, uniquenessPct))}%` }} 
        />
        {overwrittenCount > 0 && (
          <div 
            className="bg-amber-400 h-full" 
            style={{ width: `${Math.min(100, 100 - uniquenessPct)}%` }} 
          />
        )}
      </div>
    </div>
  );
};
