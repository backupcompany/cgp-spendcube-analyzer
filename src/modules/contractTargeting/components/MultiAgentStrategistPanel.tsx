import React from 'react';
import { MultiAgentTargetingStrategy } from '../../../core/types/contractTargeting';
import { 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  TrendingUp, 
  FileCheck2, 
  Scale, 
  AlertTriangle,
  Building,
  Clock,
  Zap,
  CheckCircle2,
  Database,
  ArrowRight,
  Filter
} from 'lucide-react';

interface StrategistPanelProps {
  strategy?: MultiAgentTargetingStrategy;
  isLoading: boolean;
  onRefreshStrategy: () => void;
  clusterCount?: number;
  totalClusterSpend?: number;
  activePriorityFilter?: string;
  topClusterNames?: string[];
}

export const MultiAgentStrategistPanel: React.FC<StrategistPanelProps> = ({
  strategy,
  isLoading,
  onRefreshStrategy,
  clusterCount = 0,
  totalClusterSpend = 0,
  activePriorityFilter = 'ALL',
  topClusterNames = []
}) => {
  const formatIDR = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  const priorityLabelMap: Record<string, string> = {
    'ALL': 'Semua Kuadran Prioritas',
    'P1_BLANKET_CONTRACT': 'P1: Kebocoran Belanja Spot (Blanket Contract Urgent)',
    'P2_RATE_HARMONIZATION': 'P2: Disparitas Tarif Tinggi (Rate Harmonization)',
    'P3_VENDOR_CONSOLIDATION': 'P3: Fragmentasi Vendor Banyak (Vendor Consolidation)',
    'P4_TAIL_AUTOMATION': 'P4: Belanja Ekor Kecil (Tail Automation)'
  };

  if (!strategy && !isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center shadow-xs">
        <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="font-bold text-slate-800 text-sm">Belum Ada Rekomendasi Multi-Agent AI</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
          Strategi AI akan dirumuskan khusus berdasarkan turunan {clusterCount} Kluster Belanja dari Matriks Penargetan.
        </p>
        <button
          onClick={onRefreshStrategy}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          Generate AI Multi-Agent Strategy
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Data Lineage & Context Derivation Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 text-xs">Data Referensi Strategis:</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">
                Turunan Matriks &amp; Kluster Belanja
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Menganalisis <strong>{clusterCount} Kluster Komoditas</strong> teragregasi senilai <strong>{formatIDR(totalClusterSpend)}</strong> • Filter Matriks: <em>{priorityLabelMap[activePriorityFilter] || activePriorityFilter}</em>
            </p>
          </div>
        </div>

        {topClusterNames.length > 0 && (
          <div className="text-[10px] text-slate-500 max-w-xs truncate hidden md:block">
            Driver Utama: {topClusterNames.slice(0, 3).join(', ')}...
          </div>
        )}
      </div>

      {/* Executive Summary Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-400/20 border border-blue-400/40 text-[10px] font-extrabold text-blue-200 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3 h-3 mr-1 text-blue-300" />
                Multi-Agent Procurement Intelligence
              </span>
              {strategy?.generatedAt && (
                <span className="text-[10px] text-slate-300 flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-slate-400" />
                  {new Date(strategy.generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </span>
              )}
            </div>
            <h3 className="text-base font-black tracking-tight text-white">
              Executive Sourcing Strategy &amp; Category Targeting Roadmap
            </h3>
            <p className="text-xs text-slate-200/90 max-w-4xl leading-relaxed">
              {strategy?.overallExecutiveSummary || 'Sistem multi-agent sedang menyusun strategi penargetan kontrak terfokus pada pantauan kluster aktif...'}
            </p>
          </div>

          <button
            onClick={onRefreshStrategy}
            disabled={isLoading}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isLoading ? 'Menganalisis...' : 'Regenerate AI Strategy'}
          </button>
        </div>
      </div>

      {/* 3 Specialized Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent 1: Category Strategist */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-xs shadow-2xs">
                A1
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">
                  Category Strategist
                </h4>
                <p className="text-[10px] text-slate-500">Kraljic Portfolio &amp; Demand Aggregation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {strategy?.agent1CategoryStrategist.portfolioAnalysis}
            </p>

            <div className="space-y-2 pt-1">
              <h5 className="font-bold text-[11px] text-slate-800 flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                <span>Temuan Daya Tawar Volume:</span>
              </h5>
              <ul className="space-y-1.5 text-slate-600 text-[11px]">
                {strategy?.agent1CategoryStrategist.volumeLeverageFindings.map((f, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Kraljic Spend Breakdown Mini Bar */}
          {strategy?.agent1CategoryStrategist.kraljicBreakdownSummary && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] space-y-1">
              <div className="font-bold text-slate-700 mb-1">Distribusi Belanja Kraljic:</div>
              <div className="grid grid-cols-2 gap-1 text-slate-600 font-medium">
                <div>Leverage: <strong>{formatIDR(strategy.agent1CategoryStrategist.kraljicBreakdownSummary.leverageSpendIdr)}</strong></div>
                <div>Strategic: <strong>{formatIDR(strategy.agent1CategoryStrategist.kraljicBreakdownSummary.strategicSpendIdr)}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Agent 2: Contract Optimizer */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-xs shadow-2xs">
                A2
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">
                  Contract Optimizer
                </h4>
                <p className="text-[10px] text-slate-500">Sourcing Vehicles &amp; Governance</p>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-[11px] text-slate-800 flex items-center">
                <FileCheck2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                <span>Rekomendasi Bentuk Kontrak:</span>
              </h5>

              <div className="space-y-2">
                {strategy?.agent2ContractOptimizer.recommendedContractVehicles.slice(0, 3).map((v, i) => (
                  <div key={i} className="bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 text-[11px] space-y-1">
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span className="truncate max-w-[170px]">{v.clusterName}</span>
                      <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">
                        {v.vehicleType}
                      </span>
                    </div>
                    <div className="text-slate-600 text-[10px]">
                      Durasi: <strong>{v.termDuration}</strong> • Lead: {v.leadHospitalOrCentralized}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <h5 className="font-bold text-[11px] text-slate-800">Tata Kelola &amp; Eksekusi:</h5>
              <ul className="space-y-1 text-slate-600 text-[11px]">
                {strategy?.agent2ContractOptimizer.governanceActionPlan.slice(0, 3).map((g, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <CheckCircle2 className="w-3 h-3 text-blue-600 mt-0.5 shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Agent 3: Negotiation & Value Realization Advisor */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-black text-xs shadow-2xs">
                A3
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">
                  Negotiation &amp; Value Advisor
                </h4>
                <p className="text-[10px] text-slate-500">Commercial Levers &amp; Savings Target</p>
              </div>
            </div>

            {strategy?.agent3NegotiationAdvisor.targetCostReductionIdr && (
              <div className="bg-purple-50 border border-purple-200/80 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-purple-700 uppercase">Target Penghematan</span>
                  <div className="text-sm font-black text-purple-900">
                    {formatIDR(strategy.agent3NegotiationAdvisor.targetCostReductionIdr)}
                  </div>
                </div>
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
            )}

            <div className="space-y-2">
              <h5 className="font-bold text-[11px] text-slate-800 flex items-center">
                <Scale className="w-3.5 h-3.5 mr-1 text-purple-600" />
                <span>Tuas Negosiasi Utama:</span>
              </h5>
              <ul className="space-y-1.5 text-slate-600 text-[11px]">
                {strategy?.agent3NegotiationAdvisor.negotiationLevers.map((l, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5 pt-1">
              <h5 className="font-bold text-[11px] text-slate-800">Klausul Kontrak Wajib:</h5>
              <div className="space-y-1">
                {strategy?.agent3NegotiationAdvisor.keyClausesRecommended.map((c, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] text-slate-700 font-medium">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
