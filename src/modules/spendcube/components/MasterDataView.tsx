import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord, 
  SpendRecord 
} from '../../../core/types/spend';
import { SkuMasterView } from './SkuMasterView';
import { MasterDirectoriesView } from './MasterDirectoriesView';
import { MaintenanceView } from './MaintenanceView';
import { 
  Database, 
  Package, 
  Building2, 
  Truck, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  RotateCw,
  Search,
  Filter,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Info,
  UserCheck
} from 'lucide-react';
import { RequesterDeptMappingView } from './RequesterDeptMappingView';
import { DepartmentMasterView } from './DepartmentMasterView';

export type MasterDataTabType = 'sku' | 'hospitals' | 'vendors' | 'departments' | 'requesters' | 'maintenance';

interface MasterDataViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  hospitalMasters: HospitalMasterRecord[];
  vendorMasters: VendorMasterRecord[];
  initialSubTab?: MasterDataTabType;
  onUploadSkuMasters: (newSkus: SkuMasterRecord[], meta: { id: string; fileName: string; fileType: string; recordCount: number; replaceAll?: boolean }) => void;
  onResetSkuMasters: () => void;
  onDeduplicateSkuMasters?: () => Promise<void>;
  onSaveHospitalMasters: (records: HospitalMasterRecord[]) => void;
  onSaveVendorMasters: (records: VendorMasterRecord[]) => void;
  onResetHospitalMasters: () => void;
  onResetVendorMasters: () => void;
  onRefreshData: () => Promise<void>;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  records,
  skuMasters,
  hospitalMasters,
  vendorMasters,
  initialSubTab = 'sku',
  onUploadSkuMasters,
  onResetSkuMasters,
  onDeduplicateSkuMasters,
  onSaveHospitalMasters,
  onSaveVendorMasters,
  onResetHospitalMasters,
  onResetVendorMasters,
  onRefreshData,
  onSelectRecord
}) => {
  const [activeSubTab, setActiveSubTab] = useState<MasterDataTabType>(initialSubTab);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync activeSubTab only when initialSubTab explicitly changes via external navigation
  const prevInitialSubTabRef = useRef(initialSubTab);
  useEffect(() => {
    if (prevInitialSubTabRef.current !== initialSubTab) {
      prevInitialSubTabRef.current = initialSubTab;
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Health / summary statistics
  const stats = useMemo(() => {
    // Unmatched records count
    const skuMasterIdSet = new Set(skuMasters.map(s => s.id));
    const unmatchedCount = records.filter(r => !r.skuMasterId || !skuMasterIdSet.has(r.skuMasterId)).length;
    const matchRate = records.length > 0 
      ? Math.round(((records.length - unmatchedCount) / records.length) * 100) 
      : 100;

    // Unique category count in SKU master
    const lv1Categories = new Set(skuMasters.map(s => s.purchCategoryLv1).filter(Boolean)).size;
    const lv2Categories = new Set(skuMasters.map(s => s.purchCategoryLv2).filter(Boolean)).size;

    // Hospital islands count & bed count
    const islandsCount = new Set(hospitalMasters.map(h => h.island).filter(Boolean)).size;
    const totalBeds = hospitalMasters.reduce((acc, h) => acc + (h.bedCapacity || 0), 0);

    // Vendor stats
    const tier1Vendors = vendorMasters.filter(v => v.tierRating?.toLowerCase().includes('tier 1') || v.tierRating?.toLowerCase().includes('strategic') || v.tierRating?.toLowerCase().includes('preferred')).length;

    return {
      totalSkus: skuMasters.length,
      lv1Categories,
      lv2Categories,
      totalHospitals: hospitalMasters.length,
      islandsCount,
      totalBeds,
      totalVendors: vendorMasters.length,
      tier1Vendors,
      unmatchedCount,
      matchRate
    };
  }, [records, skuMasters, hospitalMasters, vendorMasters]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const navModules = [
    {
      id: 'sku' as MasterDataTabType,
      code: 'MD-01',
      title: 'Item & SKU Master',
      subtitle: '5-Level Taxonomy, Brand, Standard Price',
      icon: Package,
      count: stats.totalSkus,
      metricLabel: `${stats.lv1Categories} Lv1 Categories`,
      status: 'active'
    },
    {
      id: 'hospitals' as MasterDataTabType,
      code: 'MD-02',
      title: 'Hospital Units Directory',
      subtitle: 'Kode ERP (0000-9999), Pulau & Kapasitas TT',
      icon: Building2,
      count: stats.totalHospitals,
      metricLabel: `${stats.islandsCount} Pulau (${stats.totalBeds.toLocaleString()} TT)`,
      status: 'active'
    },
    {
      id: 'vendors' as MasterDataTabType,
      code: 'MD-03',
      title: 'Vendor Master Directory',
      subtitle: 'Tax ID (NPWP), Domicile & Tiering',
      icon: Truck,
      count: stats.totalVendors,
      metricLabel: `${stats.tier1Vendors} Strategic T1 Partners`,
      status: 'active'
    },
    {
      id: 'departments' as MasterDataTabType,
      code: 'MD-04',
      title: 'Clean Department Master',
      subtitle: 'Daftar Bersih, Alias & Referensi AI',
      icon: Building2,
      count: new Set(records.map(r => r.department).filter(Boolean)).size,
      metricLabel: 'AI Reference Registry',
      status: 'active'
    },
    {
      id: 'requesters' as MasterDataTabType,
      code: 'MD-05',
      title: 'Requester & Dept Mapping',
      subtitle: 'PR Pairing, Username to Dept & Cost Center',
      icon: UserCheck,
      count: records.filter(r => Boolean(r.requester)).length,
      metricLabel: `${new Set(records.map(r => r.department).filter(Boolean)).size} Depts Active`,
      status: 'active'
    },
    {
      id: 'maintenance' as MasterDataTabType,
      code: 'MD-06',
      title: 'Maintenance & Mapping',
      subtitle: 'Transaction Matching & AI Reconciliation',
      icon: Wrench,
      count: stats.unmatchedCount,
      metricLabel: stats.unmatchedCount > 0 ? `${stats.unmatchedCount} Unassigned POs` : '100% Fully Synced',
      status: stats.unmatchedCount > 0 ? 'warning' : 'healthy'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Enterprise System Control Bar (Clean ERP Toolbar) */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        {/* Top Meta & System Context Bar */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase font-mono">ERP MASTER REGISTRY</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                  INDEXEDDB PERSISTENT
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Enterprise Master Data & Classification Catalog
              </h2>
            </div>
          </div>

          {/* ERP Metric Chips */}
          <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
            <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-400 text-[10px] uppercase font-sans">SKUs:</span>
              <span className="font-bold text-slate-900">{stats.totalSkus.toLocaleString()}</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-400 text-[10px] uppercase font-sans">Units:</span>
              <span className="font-bold text-slate-900">{stats.totalHospitals} RS</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-400 text-[10px] uppercase font-sans">Vendors:</span>
              <span className="font-bold text-slate-900">{stats.totalVendors}</span>
            </div>
            <div className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 shadow-2xs ${
              stats.matchRate === 100 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' 
                : 'bg-amber-50/70 border-amber-200 text-amber-800'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-current" />
              <span className="text-[10px] uppercase font-sans">Mapping Rate:</span>
              <span className="font-bold">{stats.matchRate}%</span>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors title='Refresh Master Status'"
              title="Refresh Master Data Synchronization"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* ERP Tab Ribbon Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white">
          {navModules.map((item) => {
            const Icon = item.icon;
            const isSelected = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`text-left p-3.5 transition-all relative flex flex-col justify-between group cursor-pointer ${
                  isSelected 
                    ? 'bg-blue-50/50 hover:bg-blue-50/70' 
                    : 'hover:bg-slate-50/80'
                }`}
              >
                {/* Active Indicator Top Border */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>
                )}

                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-md transition-colors ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 block leading-none">
                        {item.code}
                      </span>
                      <span className={`text-xs font-bold block mt-0.5 leading-tight ${
                        isSelected ? 'text-blue-900' : 'text-slate-800'
                      }`}>
                        {item.title}
                      </span>
                    </div>
                  </div>

                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    isSelected
                      ? 'bg-blue-100 text-blue-800'
                      : item.status === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {item.count.toLocaleString()}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate pr-2">{item.subtitle}</span>
                  <span className="font-mono text-[10px] text-slate-600 shrink-0 font-medium bg-slate-100/70 px-1.5 py-0.5 rounded">
                    {item.metricLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Component based on Selected ERP Master Tab */}
      <div className="transition-opacity duration-150">
        {activeSubTab === 'sku' && (
          <SkuMasterView
            skuMasters={skuMasters}
            transactions={records}
            onUploadSkuMasters={onUploadSkuMasters}
            onResetSkuMasters={onResetSkuMasters}
            onDeduplicateSkuMasters={onDeduplicateSkuMasters}
          />
        )}

        {activeSubTab === 'hospitals' && (
          <MasterDirectoriesView
            hospitalMasters={hospitalMasters}
            vendorMasters={vendorMasters}
            initialTab="hospitals"
            onSaveHospitalMasters={onSaveHospitalMasters}
            onSaveVendorMasters={onSaveVendorMasters}
            onResetHospitalMasters={onResetHospitalMasters}
            onResetVendorMasters={onResetVendorMasters}
          />
        )}

        {activeSubTab === 'vendors' && (
          <MasterDirectoriesView
            hospitalMasters={hospitalMasters}
            vendorMasters={vendorMasters}
            initialTab="vendors"
            onSaveHospitalMasters={onSaveHospitalMasters}
            onSaveVendorMasters={onSaveVendorMasters}
            onResetHospitalMasters={onResetHospitalMasters}
            onResetVendorMasters={onResetVendorMasters}
          />
        )}

        {activeSubTab === 'maintenance' && (
          <MaintenanceView
            records={records}
            skuMasters={skuMasters}
            hospitalMasters={hospitalMasters}
            vendorMasters={vendorMasters}
            onRefreshData={onRefreshData}
            onSelectRecord={onSelectRecord}
          />
        )}

        {activeSubTab === 'departments' && (
          <DepartmentMasterView
            records={records}
            hospitalMasters={hospitalMasters}
            onRefreshData={onRefreshData}
          />
        )}

        {activeSubTab === 'requesters' && (
          <RequesterDeptMappingView
            records={records}
            hospitalMasters={hospitalMasters}
            onRefreshData={onRefreshData}
          />
        )}
      </div>
    </div>
  );
};
