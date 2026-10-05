import React from 'react';
import { KraljicQuadrant, OpportunityPriority } from '../../../../core/types/contractTargeting';
import { ShieldCheck, AlertTriangle, Layers, GitMerge, FileText, Zap, RefreshCw } from 'lucide-react';

export const KraljicBadge: React.FC<{ quadrant: KraljicQuadrant; compact?: boolean }> = ({ quadrant, compact = false }) => {
  switch (quadrant) {
    case 'LEVERAGE':
      if (compact) {
        return (
          <span 
            title="Kraljic: LEVERAGE (High Spend, Low Risk)"
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
          >
            LEVERAGE
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Zap className="w-3 h-3 mr-1 text-emerald-600" />
          LEVERAGE (High Spend)
        </span>
      );
    case 'STRATEGIC':
      if (compact) {
        return (
          <span 
            title="Kraljic: STRATEGIC (High Spend, High Risk)"
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200"
          >
            STRATEGIC
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <ShieldCheck className="w-3 h-3 mr-1 text-purple-600" />
          STRATEGIC (High Risk)
        </span>
      );
    case 'BOTTLENECK':
      if (compact) {
        return (
          <span 
            title="Kraljic: BOTTLENECK (Low Spend, High Risk)"
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
          >
            BOTTLENECK
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
          BOTTLENECK
        </span>
      );
    case 'ROUTINE':
    default:
      if (compact) {
        return (
          <span 
            title="Kraljic: ROUTINE (Low Spend, Low Risk)"
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
          >
            ROUTINE
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <Layers className="w-3 h-3 mr-1 text-slate-500" />
          ROUTINE
        </span>
      );
  }
};

export const PriorityBadge: React.FC<{ priority: OpportunityPriority; iconOnly?: boolean }> = ({ priority, iconOnly = false }) => {
  switch (priority) {
    case 'P1_BLANKET_CONTRACT':
      if (iconOnly) {
        return (
          <span 
            title="Target Prioritas: P1 - Urgent Blanket Order (Spot Buy > 60%)"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black shadow-2xs cursor-help hover:bg-rose-100 transition-colors"
          >
            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
            <span>P1</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
          <AlertTriangle className="w-3 h-3 mr-1.5 text-rose-600" />
          P1: Urgent Blanket Order
        </span>
      );
    case 'P2_RATE_HARMONIZATION':
      if (iconOnly) {
        return (
          <span 
            title="Target Prioritas: P2 - Rate Harmonization / MFC (Disparitas Harga RS Tinggi)"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black shadow-2xs cursor-help hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5 text-blue-600" />
            <span>P2</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <RefreshCw className="w-3 h-3 mr-1.5 text-blue-600" />
          P2: Rate Harmonization (MFC)
        </span>
      );
    case 'P3_VENDOR_CONSOLIDATION':
      if (iconOnly) {
        return (
          <span 
            title="Target Prioritas: P3 - Vendor Consolidation (Fragmentasi Multi-Supplier)"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black shadow-2xs cursor-help hover:bg-indigo-100 transition-colors"
          >
            <GitMerge className="w-2.5 h-2.5 text-indigo-600" />
            <span>P3</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <GitMerge className="w-3 h-3 mr-1.5 text-indigo-600" />
          P3: Vendor Consolidation
        </span>
      );
    case 'P4_TAIL_AUTOMATION':
      if (iconOnly) {
        return (
          <span 
            title="Target Prioritas: P4 - e-Catalog Price Lock & Auto Replenish (Volume Transaksi Rutin)"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black shadow-2xs cursor-help hover:bg-amber-100 transition-colors"
          >
            <Zap className="w-2.5 h-2.5 text-amber-600" />
            <span>P4</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <Zap className="w-3 h-3 mr-1.5 text-amber-600" />
          P4: e-Catalog Lock
        </span>
      );
    case 'MONITORED_STANDARD':
    default:
      if (iconOnly) {
        return (
          <span 
            title="Target Prioritas: Standard Monitored Contract"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold cursor-help hover:bg-slate-200 transition-colors"
          >
            <FileText className="w-2.5 h-2.5 text-slate-400" />
            <span>STD</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <FileText className="w-3 h-3 mr-1.5 text-slate-400" />
          Standard Contract
        </span>
      );
  }
};

export const ContractCoverageBar: React.FC<{
  percentage: number;
  contractedSpend: number;
  uncontractedSpend: number;
}> = ({ percentage, contractedSpend, uncontractedSpend }) => {
  const isHighContract = percentage >= 75;
  const isLowContract = percentage <= 25;

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-semibold text-slate-600">
          {percentage.toFixed(0)}% Terkontrak
        </span>
        <span className={isLowContract ? 'text-rose-600 font-bold' : isHighContract ? 'text-emerald-600 font-bold' : 'text-amber-600 font-semibold'}>
          {isLowContract ? 'High Spot Leakage' : isHighContract ? 'Compliant' : 'Partial Spot'}
        </span>
      </div>
      <div className="h-1.5 w-full bg-rose-100 rounded-full overflow-hidden flex">
        <div 
          className={`h-full transition-all duration-500 ${isHighContract ? 'bg-emerald-500' : 'bg-blue-600'}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
};
