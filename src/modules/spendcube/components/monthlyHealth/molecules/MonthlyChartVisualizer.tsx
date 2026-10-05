import React from 'react';
import { MonthlyIngestionRecord } from '../../../../../core/types/spend';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';

interface Props {
  months: MonthlyIngestionRecord[];
  onSelectMonth?: (month: MonthlyIngestionRecord) => void;
}

export const MonthlyChartVisualizer: React.FC<Props> = ({ months, onSelectMonth }) => {
  const chartData = months.map(m => ({
    name: m.monthShortIndo,
    fullName: m.monthNameIndo,
    period: m.gregorianPeriod,
    opex: m.opexSpend,
    capex: m.capexSpend,
    totalSpend: m.totalSpend,
    qty: m.totalQty,
    filesCount: m.filesCount,
    rawMonth: m
  }));

  const formatIDRAxis = (val: number) => {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(1)} M`;
    }
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(0)} Jt`;
    }
    return val.toLocaleString('id-ID');
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const m: MonthlyIngestionRecord = data.rawMonth;
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs backdrop-blur-md max-w-xs z-50">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
            <div>
              <p className="font-bold text-sm text-white">{m.monthNameIndo} {m.year}</p>
              <p className="text-[10px] text-slate-400">{m.gregorianPeriod}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-300 border border-blue-700 font-semibold">
              {m.filesCount} Berkas
            </span>
          </div>

          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                OPEX Value:
              </span>
              <span className="font-bold">Rp {Math.round(m.opexSpend).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="font-sans">Qty OPEX:</span>
              <span>{m.opexQty.toLocaleString('id-ID')} unit</span>
            </div>

            <div className="flex items-center justify-between text-indigo-300 pt-1 border-t border-slate-800">
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                CAPEX Value:
              </span>
              <span className="font-bold">Rp {Math.round(m.capexSpend).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="font-sans">Qty CAPEX:</span>
              <span>{m.capexQty.toLocaleString('id-ID')} unit</span>
            </div>

            <div className="flex items-center justify-between text-white font-bold pt-2 border-t border-slate-700">
              <span className="font-sans text-xs">Total Belanja:</span>
              <span className="text-amber-300">Rp {Math.round(m.totalSpend).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300 text-[10px]">
              <span className="font-sans">Total Volume Qty:</span>
              <span>{m.totalQty.toLocaleString('id-ID')} unit</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-blue-400 font-sans flex items-center justify-between">
            <span>Status: {m.completenessLabel}</span>
            <span className="underline cursor-pointer">Klik untuk rincian &rarr;</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Profil Pola Belanja Bulanan (OPEX vs CAPEX)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Visualisasi distribusi nilai serapan (Rp) dan volume kuantitas (unit) kalender 12 bulan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">OPEX (Rp)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600" />
            <span className="font-medium text-slate-700 dark:text-slate-300">CAPEX (Rp)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Volume Qty</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            onClick={(data: any) => {
              if (data && data.activePayload && data.activePayload.length && onSelectMonth) {
                onSelectMonth(data.activePayload[0].payload.rawMonth);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis 
              yAxisId="left"
              tickFormatter={formatIDRAxis}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => v.toLocaleString('id-ID')}
              tick={{ fontSize: 10, fill: '#f59e0b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              yAxisId="left" 
              dataKey="opex" 
              stackId="spend" 
              fill="#10b981" 
              radius={[0, 0, 0, 0]}
              cursor="pointer"
            />
            <Bar 
              yAxisId="left" 
              dataKey="capex" 
              stackId="spend" 
              fill="#4f46e5" 
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="qty" 
              stroke="#f59e0b" 
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f59e0b', strokeWidth: 1, stroke: '#fff' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
