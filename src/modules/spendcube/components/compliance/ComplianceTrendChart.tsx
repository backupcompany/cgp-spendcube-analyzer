import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';
import { 
  TrendingDown, 
  BarChart3, 
  Table as TableIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Target,
  ArrowDownRight,
  Info,
  X,
  Sparkles,
  Layers,
  Filter
} from 'lucide-react';
import { 
  MonthlyComplianceTrend, 
  COMPLIANCE_CATEGORIES, 
  SkuComplianceCategory 
} from '../../services/skuPoComplianceService';

export interface ComplianceTrendChartProps {
  monthlyData: MonthlyComplianceTrend[];
  selectedMonth: string;
  onSelectMonth: (monthYear: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export const STACKED_MATCHING_TYPES = [
  {
    key: 'MATCH_EXACT',
    dataKey: 'exactMatchCount',
    label: '1A. Match Sempurna',
    color: '#10b981', // emerald-500
    hoverColor: '#059669',
    description: 'Kode SKU valid di MDM dan deskripsi PO identik'
  },
  {
    key: 'MATCH_CODE_DIFF_DESC',
    dataKey: 'codeDiffDescCount',
    label: '1B. Deskripsi Diedit',
    color: '#f59e0b', // amber-500
    hoverColor: '#d97706',
    description: 'Kode SKU valid di MDM, namun teks deskripsi PO diedit'
  },
  {
    key: 'MATCH_NAME_ONLY',
    dataKey: 'nameOnlyMatchCount',
    label: '1C. Match Nama Saja',
    color: '#0284c7', // sky-600
    hoverColor: '#0369a1',
    description: 'Tanpa kode SKU, nama barang cocok dengan Master MDM'
  },
  {
    key: 'CODE_NOT_IN_MDM',
    dataKey: 'codeNotInMdmCount',
    label: '2A. Kode Belum di MDM',
    color: '#e11d48', // rose-600
    hoverColor: '#be123c',
    description: 'Kode SKU tercantum pada PO namun belum terdaftar di MDM'
  },
  {
    key: 'PARTIAL_MATCH',
    dataKey: 'partialMatchCount',
    label: '3. Partial Orphan',
    color: '#8b5cf6', // purple-500
    hoverColor: '#7c3aed',
    description: 'Kemiripan kata kunci parsial (perlu konfirmasi)'
  },
  {
    key: 'UNMATCHED_NO_SKU',
    dataKey: 'unmatchedNoSkuCount',
    label: '4A. Belum Terdaftar',
    color: '#64748b', // slate-500
    hoverColor: '#475569',
    description: 'PO tidak memiliki kode SKU dan tidak terdaftar di MDM'
  }
] as const;

export const ComplianceTrendChart: React.FC<ComplianceTrendChartProps> = ({
  monthlyData,
  selectedMonth,
  onSelectMonth,
  selectedCategory = 'ALL',
  onSelectCategory
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [stackScope, setStackScope] = useState<'all' | 'unmatchedOnly'>('all');

  // Trend direction: compare latest month with previous month
  const trendInfo = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const latest = monthlyData[monthlyData.length - 1];
    const prev = monthlyData[monthlyData.length - 2];
    const diffCount = latest.unmatchedCount - prev.unmatchedCount;
    const diffPct = Number((latest.unmatchedPercent - prev.unmatchedPercent).toFixed(1));
    const isImproving = diffPct <= 0;

    return {
      latestMonth: latest.formattedMonth,
      diffCount,
      diffPct,
      isImproving
    };
  }, [monthlyData]);

  // Selected Month formatted string for banner
  const selectedMonthFormatted = useMemo(() => {
    if (!selectedMonth) return '';
    const item = monthlyData.find(m => m.monthYear === selectedMonth);
    return item ? item.formattedMonth : selectedMonth;
  }, [selectedMonth, monthlyData]);

  // Selected Category Meta
  const selectedCategoryMeta = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'ALL') return null;
    if (selectedCategory === 'MATCHED_ONLY') return { label: 'Semua Match Saja' };
    if (selectedCategory === 'UNMATCHED_ONLY') return { label: 'Semua Belum Match Saja' };
    return COMPLIANCE_CATEGORIES[selectedCategory as SkuComplianceCategory] || null;
  }, [selectedCategory]);

  const hasActiveFilter = Boolean(selectedMonth || (selectedCategory && selectedCategory !== 'ALL'));

  // Power BI Cross-Filtering Handler: Clicking a bar segment
  const handleSegmentClick = (monthYear: string, categoryKey: string) => {
    if (selectedMonth === monthYear && selectedCategory === categoryKey) {
      // Toggle off both
      onSelectMonth('');
      onSelectCategory?.('ALL');
    } else if (selectedCategory === categoryKey && !selectedMonth) {
      // Toggle off category
      onSelectCategory?.('ALL');
    } else {
      // Cross-filter by both month and category
      onSelectMonth(monthYear);
      onSelectCategory?.(categoryKey);
    }
  };

  // Power BI Cross-Filtering Handler: Clicking a month column / chart background
  const handleMonthColumnClick = (monthYear: string) => {
    if (selectedMonth === monthYear) {
      onSelectMonth('');
    } else {
      onSelectMonth(monthYear);
    }
  };

  // Legend Click Handler: Filter by category across all months
  const handleLegendClick = (categoryKey: string) => {
    if (selectedCategory === categoryKey) {
      onSelectCategory?.('ALL');
    } else {
      onSelectCategory?.(categoryKey);
    }
  };

  // Types to display depending on stackScope toggle
  const activeTypes = useMemo(() => {
    if (stackScope === 'unmatchedOnly') {
      return STACKED_MATCHING_TYPES.filter(t => 
        t.key === 'CODE_NOT_IN_MDM' || 
        t.key === 'PARTIAL_MATCH' || 
        t.key === 'UNMATCHED_NO_SKU' ||
        t.key === 'MATCH_CODE_DIFF_DESC'
      );
    }
    return STACKED_MATCHING_TYPES;
  }, [stackScope]);

  // Custom Power BI Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: MonthlyComplianceTrend = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 text-xs space-y-2.5 min-w-[280px]">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div>
              <span className="font-extrabold text-sm text-blue-300 block">{data.formattedMonth}</span>
              <span className="text-[10px] text-slate-400 font-mono">Bulan Transaksi: {data.monthYear}</span>
            </div>
            <span className="text-[11px] font-mono font-bold bg-blue-950 text-blue-200 px-2 py-0.5 rounded border border-blue-800">
              Total {data.totalPoLines.toLocaleString('id-ID')} Line
            </span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Komposisi Tipe Pencocokan SKU:
            </span>

            {STACKED_MATCHING_TYPES.map(type => {
              const count = (data as any)[type.dataKey] || 0;
              const pct = data.totalPoLines > 0 ? ((count / data.totalPoLines) * 100).toFixed(1) : '0';
              const isCatActive = selectedCategory === type.key;

              return (
                <div 
                  key={type.key}
                  className={`flex items-center justify-between py-0.5 px-1.5 rounded transition-colors ${
                    isCatActive ? 'bg-white/10 font-bold' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: type.color }} />
                    <span className="text-slate-200 truncate">{type.label}:</span>
                  </div>
                  <span className="font-mono text-slate-100 shrink-0">
                    {count.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-700/80 pt-2 flex items-center justify-between text-xs">
            <span className="text-rose-300 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>Total Belum Match:</span>
            </span>
            <span className="font-mono font-bold text-rose-300">
              {data.unmatchedCount.toLocaleString('id-ID')} ({data.unmatchedPercent}%)
            </span>
          </div>

          <div className="p-2 rounded-xl bg-blue-950/70 border border-blue-800/60 text-[10px] text-blue-200 space-y-0.5">
            <p className="font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Interaktivitas Klik Power BI:</span>
            </p>
            <p className="text-blue-300/90 leading-tight">
              Klik pada segmen warna untuk memfilter bulan & tipe pencocokan tersebut secara bersamaan.
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-rose-600" />
              <span>Tren Bulanan Kesesuaian SKU Master pada PO Line</span>
            </h3>
            {trendInfo && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                trendInfo.isImproving 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {trendInfo.isImproving ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Turun {Math.abs(trendInfo.diffPct)}% ({trendInfo.latestMonth})</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-3.5 h-3.5 rotate-180" />
                    <span>Naik +{trendInfo.diffPct}% ({trendInfo.latestMonth})</span>
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <span>Stacked bar komposisi tipe hasil pencocokan dengan target menuju</span>
            <strong className="text-emerald-700 font-semibold">0% Non-Compliance</strong>
          </p>
        </div>

        {/* View Switcher & Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Stack Scope Switcher */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStackScope('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                stackScope === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilkan stacked bar seluruh 6 tipe hasil pencocokan"
            >
              Semua Tipe Hasil
            </button>
            <button
              type="button"
              onClick={() => setStackScope('unmatchedOnly')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                stackScope === 'unmatchedOnly'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Fokuskan stacked bar pada baris yang perlu review / belum match"
            >
              Fokus Non-Compliance
            </button>
          </div>

          {/* View Mode: Chart vs Table */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'chart' 
                  ? 'bg-white text-slate-900 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 inline mr-1" />
              Grafik
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' 
                  ? 'bg-white text-slate-900 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 inline mr-1" />
              Tabel Rekap
            </button>
          </div>
        </div>
      </div>

      {/* Power BI Cross-Filtering Active Banner */}
      {hasActiveFilter && (
        <div className="flex items-center flex-wrap gap-2 p-3 bg-blue-50/90 rounded-2xl border border-blue-200 text-xs shadow-2xs animate-in fade-in duration-150">
          <span className="font-bold text-blue-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Filter Interaktif Aktif (Power BI):</span>
          </span>

          {selectedMonth && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white font-bold text-xs shadow-xs">
              <span>Bulan: {selectedMonthFormatted || selectedMonth}</span>
              <button
                type="button"
                onClick={() => onSelectMonth('')}
                className="hover:bg-blue-700 rounded-full p-0.5 cursor-pointer"
                title="Hapus filter bulan"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedCategory && selectedCategory !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white font-bold text-xs shadow-xs">
              <span>Kategori: {selectedCategoryMeta?.label || selectedCategory}</span>
              <button
                type="button"
                onClick={() => onSelectCategory?.('ALL')}
                className="hover:bg-slate-700 rounded-full p-0.5 cursor-pointer"
                title="Hapus filter kategori"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              onSelectMonth('');
              onSelectCategory?.('ALL');
            }}
            className="ml-auto text-xs font-extrabold text-blue-700 hover:text-blue-950 underline cursor-pointer"
          >
            Reset Semua Filter Grafik
          </button>
        </div>
      )}

      {/* Main Content: Chart or Table */}
      {viewMode === 'chart' ? (
        <div className="space-y-3">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyData}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                onClick={(data: any) => {
                  if (data && data.activePayload && data.activePayload.length) {
                    const item: MonthlyComplianceTrend = data.activePayload[0].payload;
                    handleMonthColumnClick(item.monthYear);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="formattedMonth" 
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  cursor="pointer"
                />

                {/* Left Axis: Jumlah PO Line (Stacked Bar) */}
                <YAxis 
                  yAxisId="left"
                  orientation="left"
                  tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#94a3b8' }}
                  tickLine={false}
                  label={{ 
                    value: stackScope === 'all' ? 'Total PO Line (Stacked)' : 'PO Line Perlu Review (Stacked)', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fill: '#475569', 
                    fontSize: 10, 
                    fontWeight: 700 
                  }}
                />

                {/* Right Axis: Persentase Belum Match (%) */}
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: '#b91c1c', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#ef4444' }}
                  tickLine={false}
                  unit="%"
                  label={{ value: '% Belum Match (Target: 0%)', angle: 90, position: 'insideRight', fill: '#b91c1c', fontSize: 10, fontWeight: 700 }}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Target line at 0% */}
                <ReferenceLine 
                  yAxisId="right" 
                  y={0} 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                  label={{ value: 'Target 0%', fill: '#059669', fontSize: 10, position: 'insideBottomRight', fontWeight: 800 }}
                />

                {/* STACKED BARS FOR MATCHING TYPES (Cross-Filtering Power BI Enabled) */}
                {activeTypes.map((type, typeIdx) => {
                  const isTopBar = typeIdx === activeTypes.length - 1;

                  return (
                    <Bar
                      key={type.key}
                      yAxisId="left"
                      dataKey={type.dataKey}
                      name={type.label}
                      stackId="complianceStack"
                      fill={type.color}
                      radius={isTopBar ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={48}
                      cursor="pointer"
                      onClick={(entry: any) => {
                        if (entry && entry.monthYear) {
                          handleSegmentClick(entry.monthYear, type.key);
                        }
                      }}
                    >
                      {monthlyData.map((entry) => {
                        const isMonthMatch = !selectedMonth || selectedMonth === entry.monthYear;
                        const isCatMatch = !selectedCategory || selectedCategory === 'ALL' || selectedCategory === type.key;
                        const isCrossSelected = isMonthMatch && isCatMatch;
                        
                        // Power BI opacity formula:
                        let cellOpacity = 0.95;
                        let strokeColor = 'none';
                        let strokeWidth = 0;

                        if (hasActiveFilter) {
                          if (isCrossSelected) {
                            cellOpacity = 1.0;
                            strokeColor = '#0f172a';
                            strokeWidth = 2;
                          } else {
                            cellOpacity = 0.22;
                          }
                        }

                        return (
                          <Cell
                            key={`cell-${type.key}-${entry.monthYear}`}
                            fill={type.color}
                            fillOpacity={cellOpacity}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                          />
                        );
                      })}
                    </Bar>
                  );
                })}

                {/* Line: Persentase PO Line Belum Match */}
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="unmatchedPercent" 
                  name="% Belum Match" 
                  stroke="#b91c1c" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#b91c1c', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#881337', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Legend (Power BI Style Category Toggles) */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Legenda Stacked Bar (Klik untuk Filter Kategori):</span>
              </span>
              <span className="text-slate-400 italic">
                *Klik segmen atau legenda untuk cross-filter ala Power BI
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTypes.map(type => {
                const isActive = selectedCategory === type.key;

                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => handleLegendClick(type.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title={type.description}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: type.color }} 
                    />
                    <span>{type.label}</span>
                    {isActive && <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />}
                  </button>
                );
              })}

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 ml-auto">
                <span className="w-3 h-0.5 bg-rose-700"></span>
                <span className="w-2 h-2 rounded-full bg-rose-700"></span>
                <span>Garis: % Belum Match (Sumbu Kanan)</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Table View of Monthly Recapitulation */
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Periode Bulan</th>
                <th className="px-4 py-3 text-right">Total PO Line</th>
                <th className="px-4 py-3 text-right text-emerald-700">Match Sempurna</th>
                <th className="px-4 py-3 text-right text-amber-700">Deskripsi Beda</th>
                <th className="px-4 py-3 text-right text-sky-700">Match Nama</th>
                <th className="px-4 py-3 text-right text-purple-700">Match Parsial</th>
                <th className="px-4 py-3 text-right text-rose-700">Kode Belum MDM</th>
                <th className="px-4 py-3 text-right text-slate-600">Belum Ada Kode</th>
                <th className="px-4 py-3 text-right text-rose-700">% Belum Match</th>
                <th className="px-4 py-3 text-center">Aksi Filter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyData.map((row) => {
                const isSelected = selectedMonth === row.monthYear;
                return (
                  <tr 
                    key={row.monthYear}
                    onClick={() => handleMonthColumnClick(row.monthYear)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/80 font-semibold' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900 font-mono">
                      {row.formattedMonth}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-700">
                      {row.totalPoLines.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                      {row.exactMatchCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">
                      {row.codeDiffDescCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sky-700">
                      {row.nameOnlyMatchCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-purple-700">
                      {row.partialMatchCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">
                      {row.codeNotInMdmCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {row.unmatchedNoSkuCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded-full ${
                        row.unmatchedPercent <= 15 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : row.unmatchedPercent <= 35 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {row.unmatchedPercent}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMonthColumnClick(row.monthYear);
                        }}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700'
                        }`}
                      >
                        {isSelected ? 'Terpilih' : 'Filter'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
