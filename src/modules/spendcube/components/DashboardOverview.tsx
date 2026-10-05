import React, { useMemo } from 'react';
import { DollarSign, Layers, Building2, TrendingUp, ShoppingCart, Database, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { SpendSummaryKPIs, SpendRecord, SkuMasterRecord } from '../../../core/types/spend';
import { vectorService } from '../services/vectorService';

interface DashboardOverviewProps {
  kpis: SpendSummaryKPIs;
  records?: SpendRecord[];
  skuMasters?: SkuMasterRecord[];
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = React.memo(({ kpis, records = [], skuMasters = [] }) => {
  const formatIDR = (val: number | undefined | null) => {
    const num = Number(val) || 0;
    if (num >= 1e9) return `Rp ${(num / 1e9).toFixed(2)} B`;
    if (num >= 1e6) return `Rp ${(num / 1e6).toFixed(2)} M`;
    return `Rp ${num.toLocaleString()}`;
  };

  const capexPercentage = kpis.totalSpend > 0 ? (kpis.totalCapexSpend / kpis.totalSpend) * 100 : 0;
  const opexPercentage = kpis.totalSpend > 0 ? (kpis.totalOpexSpend / kpis.totalSpend) * 100 : 0;

  const unmappedStats = useMemo(() => {
    return vectorService.getUnmappedTransactionStats(records, skuMasters);
  }, [records, skuMasters]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden mb-6">
      {/* Executive KPI Strip Header */}
      <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
            EXECUTIVE SPEND METRICS
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-semibold text-slate-700">Consolidated Procurement Ledger</span>
        </div>
        <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono">
          <span>Hospitals: <strong className="text-slate-900">{kpis.uniqueHospitals}</strong></span>
          <span>Vendors: <strong className="text-slate-900">{kpis.uniqueVendors}</strong></span>
          <span>POs: <strong className="text-slate-900">{kpis.totalTransactions.toLocaleString()}</strong></span>
          {typeof kpis.pairingRatePct === 'number' && (
            <span>
              PO-PR Paired: <strong className={kpis.pairingRatePct >= 80 ? 'text-emerald-700' : 'text-purple-700'}>{kpis.pairingRatePct}%</strong>
            </span>
          )}
        </div>
      </div>

      {/* High-Density 5-Column Metric Ledger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* Metric 1: Total Spend */}
        <div className="p-4 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">TOTAL EXPENDITURE</span>
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {formatIDR(kpis.totalSpend)}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span>{kpis.totalTransactions.toLocaleString()} PO Line Items</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono pt-1.5 border-t border-slate-100">
            Source: D365 & AX Systems
          </div>
        </div>

        {/* Metric 2: CAPEX Spend */}
        <div className="p-4 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">CAPEX OUTLAY</span>
            <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {formatIDR(kpis.totalCapexSpend)}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${capexPercentage}%` }}></div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-100 flex justify-between">
            <span>Share of Total</span>
            <span className="text-indigo-700 font-bold">{capexPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Metric 3: OPEX Spend */}
        <div className="p-4 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">OPEX RUN-RATE</span>
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {formatIDR(kpis.totalOpexSpend)}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${opexPercentage}%` }}></div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-100 flex justify-between">
            <span>Operational</span>
            <span className="text-amber-700 font-bold">{opexPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Metric 4: Avg PO Ticket */}
        <div className="p-4 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AVG PO VALUE</span>
            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {formatIDR(kpis.averagePoAmount)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Mean transaction ticket
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-100 flex justify-between">
            <span>Ticket Range</span>
            <span className="text-emerald-700 font-bold">Standard</span>
          </div>
        </div>

        {/* Metric 5: Data Mapping Status */}
        <div className="p-4 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">MAPPING HEALTH</span>
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              unmappedStats.unmappedCount === 0 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-purple-50 text-purple-700'
            }`}>
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-black text-slate-900 font-mono">
                {(100 - unmappedStats.percentageTransactions).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Mapped</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full" 
                style={{ width: `${100 - unmappedStats.percentageTransactions}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-100 flex justify-between">
            <span>Unmapped</span>
            <span className={`font-bold ${unmappedStats.unmappedCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {unmappedStats.unmappedCount} items
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

