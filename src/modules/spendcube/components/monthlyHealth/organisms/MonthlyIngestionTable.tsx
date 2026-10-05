import React, { useState } from 'react';
import { MonthlyIngestionRecord } from '../../../../../core/types/spend';
import { IngestionStatusBadge } from '../atoms/IngestionStatusBadge';
import { FidelityMeter } from '../atoms/FidelityMeter';
import { 
  FileSpreadsheet, 
  ChevronRight, 
  Clock, 
  ExternalLink,
  Calendar,
  Layers,
  ArrowUpDown,
  Building2,
  CheckCircle,
  Eye
} from 'lucide-react';

interface Props {
  months: MonthlyIngestionRecord[];
  onSelectMonth: (month: MonthlyIngestionRecord) => void;
}

export const MonthlyIngestionTable: React.FC<Props> = ({ months, onSelectMonth }) => {
  const [sortField, setSortField] = useState<'monthIndex' | 'totalSpend' | 'opexSpend' | 'capexSpend' | 'totalQty' | 'filesCount'>('monthIndex');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'monthIndex' ? true : false);
    }
  };

  const sortedMonths = [...months].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (valA === valB) return 0;
    return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });

  const formatIDR = (val: number) => {
    if (val === 0) return 'Rp 0';
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

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
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Matriks Rekonsiliasi &amp; Kesehatan Ingestion Bulanan
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Evaluasi nominal OPEX vs CAPEX, volume unit, keunikan baris, dan berkas sumber per bulan Gregorian (1-31)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Total 12 Bulan Kalender
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700/80 select-none">
              <th 
                className="py-3 px-4 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => handleSort('monthIndex')}
              >
                <div className="flex items-center gap-1">
                  <span>Periode Bulan</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th 
                className="py-3 px-3 text-right cursor-pointer hover:text-emerald-600 transition-colors"
                onClick={() => handleSort('opexSpend')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Belanja OPEX</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th 
                className="py-3 px-3 text-right cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => handleSort('capexSpend')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Belanja CAPEX</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th 
                className="py-3 px-3 text-right cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => handleSort('totalSpend')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Total Spend &amp; Qty</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th 
                className="py-3 px-3 text-center cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => handleSort('filesCount')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Berkas Upload</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-3 min-w-[150px]">
                Profil Ingestion (Unik vs Timpa)
              </th>
              <th className="py-3 px-3">
                Waktu Terakhir Ingested
              </th>
              <th className="py-3 px-3 text-center">
                Status Kelengkapan
              </th>
              <th className="py-3 px-3 text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {sortedMonths.map((m) => {
              const hasData = m.totalRecordCount > 0;
              return (
                <tr
                  key={m.monthKey}
                  onClick={() => onSelectMonth(m)}
                  className={`group transition-colors cursor-pointer ${
                    hasData 
                      ? 'hover:bg-blue-50/40 dark:hover:bg-blue-950/20' 
                      : 'opacity-60 bg-slate-50/20 hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                  }`}
                >
                  {/* Column 1: Month Name & Gregorian Period */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        hasData
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                      }`}>
                        {m.monthShortIndo}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {m.monthNameIndo} {m.year}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {m.gregorianPeriod}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: OPEX Spend & Qty */}
                  <td className="py-3.5 px-3 text-right">
                    {m.opexRecordCount > 0 ? (
                      <div>
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-xs">
                          {formatIDR(m.opexSpend)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {m.opexQty.toLocaleString('id-ID')} unit <span className="text-slate-300">({m.opexRecordCount} baris)</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                    )}
                  </td>

                  {/* Column 3: CAPEX Spend & Qty */}
                  <td className="py-3.5 px-3 text-right">
                    {m.capexRecordCount > 0 ? (
                      <div>
                        <div className="font-bold text-indigo-700 dark:text-indigo-400 font-mono text-xs">
                          {formatIDR(m.capexSpend)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {m.capexQty.toLocaleString('id-ID')} unit <span className="text-slate-300">({m.capexRecordCount} baris)</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                    )}
                  </td>

                  {/* Column 4: Total Spend & Qty */}
                  <td className="py-3.5 px-3 text-right">
                    {hasData ? (
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">
                          {formatIDR(m.totalSpend)}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                          {m.totalQty.toLocaleString('id-ID')} total unit <span className="text-slate-400">({m.totalRecordCount} baris)</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                    )}
                  </td>

                  {/* Column 5: File Count & Badges */}
                  <td className="py-3.5 px-3 text-center">
                    {m.filesCount > 0 ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                          <FileSpreadsheet className="w-3 h-3 text-blue-500" />
                          {m.filesCount} Berkas
                        </span>
                        <div className="flex gap-1 mt-1">
                          {m.sourceTypes.map(st => (
                            <span 
                              key={st} 
                              className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono uppercase"
                            >
                              {st.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                    )}
                  </td>

                  {/* Column 6: Ingestion Profile (Unik vs Ditimpa) */}
                  <td className="py-3.5 px-3">
                    <FidelityMeter
                      uniqueCount={m.uniqueLineCount}
                      overwrittenCount={m.updatedOverwrittenCount}
                      totalCount={m.totalRecordCount}
                      uniquenessPct={m.uniquenessRatioPct}
                      compact
                    />
                  </td>

                  {/* Column 7: Latest Ingested Timestamp */}
                  <td className="py-3.5 px-3">
                    {m.latestIngestedAt ? (
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{formatDateTime(m.latestIngestedAt)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                    )}
                  </td>

                  {/* Column 8: Completeness Status Badge */}
                  <td className="py-3.5 px-3 text-center">
                    <IngestionStatusBadge
                      status={m.completenessStatus}
                      label={m.completenessLabel}
                    />
                  </td>

                  {/* Column 9: Actions */}
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMonth(m);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors"
                      title="Lihat Rincian Berkas & Rumah Sakit"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Rincian</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
