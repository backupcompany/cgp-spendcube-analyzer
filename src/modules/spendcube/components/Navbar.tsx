import React from 'react';
import { Upload, Sparkles, RefreshCw, Layers, ShieldAlert, BarChart3 } from 'lucide-react';

interface NavbarProps {
  onOpenUpload: () => void;
  onOpenAiAdvisor: () => void;
  onResetData: () => void;
  recordCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenUpload,
  onOpenAiAdvisor,
  onResetData,
  recordCount
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Hospital SpendCube Analyzer
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Multi-Source
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Consolidated D365 & AX (Capex & Opex) Procurement Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span className="font-semibold mr-1">{Number(recordCount || 0).toLocaleString()}</span> Records Active
          </div>

          <button
            onClick={onResetData}
            title="Reset to Sample Data"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload 4 Files</span>
          </button>

          <button
            onClick={onOpenAiAdvisor}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 gap-2 animate-pulse"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI CPO Advisor</span>
          </button>
        </div>
      </div>
    </header>
  );
};
