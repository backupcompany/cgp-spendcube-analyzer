import React from 'react';
import { useBackgroundStaging } from '../../../core/hooks/useBackgroundStaging';
import {
  LayoutDashboard,
  UploadCloud,
  Building2,
  BookOpen,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Package,
  FileSpreadsheet,
  BrainCircuit,
  BookmarkCheck,
  Coins,
  TrendingUp,
  Globe2,
  Wrench,
  Sparkles,
  Loader2,
  Database,
  Network,
  Search,
  CheckSquare
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed
}) => {
  const { isStagingInProgress } = useBackgroundStaging();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresStaging: false },
    { id: 'skuPoCompliance', label: 'Monitoring Compliance SKU to PO', icon: CheckSquare, requiresStaging: false },
    { id: 'taxonomyMappingReview', label: 'Review Mapping & Taksonomi', icon: Network, requiresStaging: false },
    { id: 'contractTargeting', label: 'Contract Opportunity & Targeting', icon: Sparkles, requiresStaging: true },
    { id: 'priceIntelligence', label: 'Price & Regional Intelligence', icon: TrendingUp, requiresStaging: true },
    { id: 'aiQueryHub', label: 'AI Query Hub & Preset Intelligence', icon: BrainCircuit, requiresStaging: false },
    { id: 'eCatalogueSearch', label: 'e-Catalogue SKU Search', icon: Search, requiresStaging: false },
    { id: 'tokenMeter', label: 'Token Meter & Cost (IDR)', icon: Coins, requiresStaging: false },
    { id: 'masterData', label: 'Master Data Hub', icon: Database, requiresStaging: false },
    { id: 'dataAudit', label: 'Data Ingestion & Audit', icon: FileSpreadsheet, requiresStaging: false },
    { id: 'vendors', label: 'Vendors Analytics', icon: Building2, requiresStaging: false },
  ];


  return (
    <aside
      className={`bg-[#071326] text-slate-300 transition-all duration-300 flex flex-col justify-between h-screen sticky top-0 z-40 border-r border-slate-800 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div>
        {/* Brand Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800/80">
          {!isCollapsed ? (
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div className="truncate">
                <h2 className="text-sm font-bold text-white tracking-tight leading-none">SpendCube</h2>
                <span className="text-[10px] text-blue-400 font-semibold tracking-wider">CGP ENTERPRISE</span>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md">
              <Layers className="w-5 h-5" />
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || 
              (item.id === 'masterData' && (activeTab === 'masterDirectories' || activeTab === 'skuMaster' || activeTab === 'maintenance'));
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.requiresStaging && isStagingInProgress && (
                  <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-900/80 text-blue-300 border border-blue-700/50 animate-pulse">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Staging
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation (Settings, Support) */}
      <div className="p-3 border-t border-slate-800/80 space-y-1.5">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-5 h-5 shrink-0 text-slate-400" />
          {!isCollapsed && <span className="truncate">Settings</span>}
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'support' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
          title={isCollapsed ? 'Support' : undefined}
        >
          <HelpCircle className="w-5 h-5 shrink-0 text-slate-400" />
          {!isCollapsed && <span className="truncate">Support</span>}
        </button>
      </div>
    </aside>
  );
};
