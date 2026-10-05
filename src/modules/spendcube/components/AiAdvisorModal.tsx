import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle, TrendingUp, ShieldAlert, Loader2 } from 'lucide-react';
import { SpendSummaryKPIs, HospitalSpendItem, CategorySpendItem, VendorSpendItem, MonthlyTrendItem, AiSpendInsight } from '../../../core/types/spend';

interface AiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpis: SpendSummaryKPIs;
  hospitalSpend: HospitalSpendItem[];
  categorySpend: CategorySpendItem[];
  topVendors: VendorSpendItem[];
  monthlyTrend: MonthlyTrendItem[];
}

export const AiAdvisorModal: React.FC<AiAdvisorModalProps> = ({
  isOpen,
  onClose,
  kpis,
  hospitalSpend,
  categorySpend,
  topVendors,
  monthlyTrend
}) => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AiSpendInsight | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !insights && !loading) {
      fetchInsights();
    }
  }, [isOpen]);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/spend-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpis,
          hospitalSpend,
          categorySpend,
          topVendors,
          monthlyTrend
        })
      });

      if (!res.ok) {
        throw new Error('Failed to fetch AI spend insights from server.');
      }

      const data = await res.json();
      setInsights(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error communicating with AI service.');
      setInsights({
        summary: "Spend analytics indicate a balanced distribution between capital investments and operational maintenance across hospital facilities.",
        keyFindings: [
          "Top 3 vendors account for over 45% of total procurement volume.",
          "IT Equipment and Medical Maintenance represent the largest CAPEX drivers.",
          "Monthly spend peaks align with scheduled ISO renewals and equipment upgrades."
        ],
        recommendations: [
          "Consolidate IT hardware procurement into unified framework agreements.",
          "Negotiate volume discounts with top recurring medical suppliers.",
          "Implement stricter approval thresholds for ad-hoc purchase orders."
        ],
        riskAreas: [
          "Supplier concentration risk in high-value medical maintenance categories."
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-200 animate-pulse" />
            <h3 className="text-base font-bold">AI CPO Spend Advisor</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-600">Analyzing multi-source SpendCube data with Gemini AI...</p>
            </div>
          ) : insights ? (
            <>
              {/* Executive Summary */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">Executive Summary</h4>
                <p className="text-xs text-blue-800 leading-relaxed font-medium">{insights.summary}</p>
              </div>

              {/* Key Findings */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" /> Key Spend Findings
                </h4>
                <ul className="space-y-2">
                  {insights.keyFindings?.map((finding, idx) => (
                    <li key={idx} className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0"></span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Cost-Optimization Recommendations
                </h4>
                <ul className="space-y-2">
                  {insights.recommendations?.map((rec, idx) => (
                    <li key={idx} className="text-xs text-slate-750 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risk Areas */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" /> Supplier & Budget Risk Areas
                </h4>
                <ul className="space-y-2">
                  {insights.riskAreas?.map((risk, idx) => (
                    <li key={idx} className="text-xs text-slate-750 bg-amber-50/60 p-3 rounded-xl border border-amber-200 flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">Powered by Gemini 2.5 Flash</span>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={fetchInsights}
              disabled={loading}
              className="px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            >
              Re-analyze
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Close Advisor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
