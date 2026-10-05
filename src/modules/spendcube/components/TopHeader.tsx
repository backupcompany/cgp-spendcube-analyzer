import React from 'react';
import { Search, Bell, Grid, Plus, Download, Sparkles, User } from 'lucide-react';

interface TopHeaderProps {
  activeTab: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  onOpenAiAdvisor: () => void;
  onExportData: () => void;
  username: string;
  onSignOut: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  searchQuery,
  onSearchChange,
  onOpenUpload,
  onOpenAiAdvisor,
  onExportData,
  username,
  onSignOut
}) => {
  const tabTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    skuPoCompliance: 'Monitoring Compliance SKU to PO',
    taxonomyMappingReview: 'Review Pemetaan SKU & Taksonomi Master',
    contractTargeting: 'Contract Opportunity & Targeting',
    priceIntelligence: 'Price Intelligence, Parity & Regional Audit',
    aiQueryHub: 'AI Query Hub & Preset Intelligence',
    aiAnalysis: 'AI Query Hub & Preset Intelligence',
    savedQueries: 'AI Query Hub & Preset Intelligence',
    eCatalogueSearch: 'e-Catalogue SKU Search & Commodity Catalog',
    googleSearch: 'e-Catalogue SKU Search & Commodity Catalog',
    skuSearch: 'e-Catalogue SKU Search & Commodity Catalog',
    tokenMeter: 'Token Meter & Cost Analytics',
    masterData: 'Master Data Hub & Enterprise Catalogs',
    masterDirectories: 'Master Hospital Units & Master Vendors',
    skuMaster: 'SKU Master & Item Catalog Directory',
    maintenance: 'Data Maintenance & Unmatched Mapping',
    dataAudit: 'Data Ingestion & Raw Audit Center',
    upload: 'Data Ingestion & Raw Audit Center',
    rawAudit: 'Data Ingestion & Raw Audit Center',
    vendors: 'Vendor Analytics & Concentration',
    settings: 'System Settings',
    support: 'Support & Documentation'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
          <span>Home</span>
          <span>/</span>
          <span className="font-semibold text-slate-800 capitalize">{activeTab}</span>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Procurement Hub
        </h1>
      </div>

      <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap gap-y-2">
        {/* Navigation shortcuts matching screenshot */}
        <div className="hidden lg:flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <button type="button" className="hover:text-blue-600 transition-colors">Reports</button>
          <button type="button" className="hover:text-blue-600 transition-colors">History</button>
        </div>

        {/* Search bar */}
        <div className="relative w-48 sm:w-56">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Notification & Grid icons */}
        <div className="flex items-center space-x-1.5 text-slate-600">
          <button type="button" className="p-2 hover:bg-slate-100 rounded-xl transition-colors relative" title="Notifications">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600"></span>
          </button>
          <button type="button" className="p-2 hover:bg-slate-100 rounded-xl transition-colors hidden sm:block" title="Apps Grid">
            <Grid className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Action & Export Data buttons matching screenshot */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>Quick Action</span>
          </button>

          <button
            type="button"
            onClick={onExportData}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Data</span>
          </button>

          <button
            type="button"
            onClick={onOpenAiAdvisor}
            className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
            title="AI CPO Advisor"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onSignOut}
            title={`Keluar (${username})`}
            className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-[10px] shrink-0 shadow-inner overflow-hidden uppercase"
          >
            {username.slice(0, 2)}
          </button>
        </div>
      </div>
    </header>
  );
};
