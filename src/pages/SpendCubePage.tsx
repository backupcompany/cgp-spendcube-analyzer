import React, { useState, useEffect, useMemo } from 'react';
import { SpendRecord, SpendFilterCriteria, SkuMasterRecord, HospitalMasterRecord, VendorMasterRecord, UploadedBatchMeta } from '../core/types/spend';
import { spendService } from '../modules/spendcube/services/spendService';
import { Sidebar } from '../modules/spendcube/components/Sidebar';
import { TopHeader } from '../modules/spendcube/components/TopHeader';
import { DashboardOverview } from '../modules/spendcube/components/DashboardOverview';
import { FilterBar } from '../modules/spendcube/components/FilterBar';
import { SpendCharts } from '../modules/spendcube/components/SpendCharts';
import { SpendTable } from '../modules/spendcube/components/SpendTable';
import { FileUploadModal } from '../modules/spendcube/components/FileUploadModal';
import { AiAdvisorModal } from '../modules/spendcube/components/AiAdvisorModal';
import { TransactionDetailModal } from '../modules/spendcube/components/TransactionDetailModal';
import { VendorsView } from '../modules/spendcube/components/VendorsView';
import { TaxonomyTreeMapAndTopCharts } from '../modules/spendcube/components/TaxonomyTreeMapAndTopCharts';
import { DataIngestionAuditView } from '../modules/spendcube/components/DataIngestionAuditView';
import { AiQueryHubView } from '../modules/spendcube/components/AiQueryHubView';
import { TokenMeterView } from '../modules/spendcube/components/TokenMeterView';
import { PriceIntelligenceView } from '../modules/spendcube/components/PriceIntelligenceView';
import { MasterDataView } from '../modules/spendcube/components/MasterDataView';
import { SettingsView } from '../modules/spendcube/components/SettingsView';
import { SupportView } from '../modules/spendcube/components/SupportView';
import { ContractTargetingView } from '../modules/contractTargeting/components/ContractTargetingView';
import { TaxonomyMappingReviewView } from '../modules/spendcube/components/TaxonomyMappingReviewView';
import { SkuCatalogSearchGoogleView } from '../modules/spendcube/components/SkuCatalogSearchGoogleView';
import { StagingProgressBarFooter } from '../core/ui/StagingProgressBarFooter';
import { useTriggerBackgroundStaging } from '../core/hooks/useBackgroundStaging';
import { backgroundJobManager } from '../core/services/backgroundJobManager';
import { Loader2, Upload, FileSpreadsheet } from 'lucide-react';

// Lazy-loaded on demand to ensure zero main-thread overhead on initial page load
const SkuPoComplianceView = React.lazy(() => 
  import('../modules/spendcube/components/compliance/SkuPoComplianceView').then(m => ({ default: m.SkuPoComplianceView }))
);

export default function SpendCubePage({ username, onSignOut }: { username: string; onSignOut: () => void }) {
  const [records, setRecords] = useState<SpendRecord[]>([]);
  const [skuMasters, setSkuMasters] = useState<SkuMasterRecord[]>([]);
  const [hospitalMasters, setHospitalMasters] = useState<HospitalMasterRecord[]>([]);
  const [vendorMasters, setVendorMasters] = useState<VendorMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SpendRecord | null>(null);

  // Keep-alive visited tabs tracking to retain page views in DOM without resetting or recalculating
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['dashboard']));

  useEffect(() => {
    let tabGroup = activeTab;
    if (activeTab === 'skuMaster' || activeTab === 'masterDirectories' || activeTab === 'maintenance') {
      tabGroup = 'masterData';
    } else if (activeTab === 'aiAnalysis' || activeTab === 'savedQueries') {
      tabGroup = 'aiQueryHub';
    } else if (activeTab === 'googleSearch' || activeTab === 'eCatalogueSearch' || activeTab === 'skuSearch') {
      tabGroup = 'eCatalogueSearch';
    } else if (activeTab === 'rawAudit' || activeTab === 'upload') {
      tabGroup = 'dataAudit';
    }

    setVisitedTabs(prev => {
      if (prev.has(tabGroup)) return prev;
      const next = new Set(prev);
      next.add(tabGroup);
      return next;
    });

    // Notify window resize so Recharts & ResponsiveContainer calibrate dimensions when un-hidden
    const resizeTimer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    return () => clearTimeout(resizeTimer);
  }, [activeTab]);

  const isTabActive = (group: string) => {
    if (group === 'dashboard') return activeTab === 'dashboard';
    if (group === 'contractTargeting') return activeTab === 'contractTargeting';
    if (group === 'priceIntelligence') return activeTab === 'priceIntelligence';
    if (group === 'masterData') return activeTab === 'masterData' || activeTab === 'skuMaster' || activeTab === 'masterDirectories' || activeTab === 'maintenance';
    if (group === 'aiQueryHub') return activeTab === 'aiQueryHub' || activeTab === 'aiAnalysis' || activeTab === 'savedQueries';
    if (group === 'tokenMeter') return activeTab === 'tokenMeter';
    if (group === 'dataAudit') return activeTab === 'dataAudit' || activeTab === 'rawAudit' || activeTab === 'upload';
    if (group === 'vendors') return activeTab === 'vendors';
    if (group === 'settings') return activeTab === 'settings';
    if (group === 'support') return activeTab === 'support';
    return activeTab === group;
  };

  const [criteria, setCriteria] = useState<SpendFilterCriteria>({
    searchQuery: '',
    hospitalCode: 'ALL',
    sourceFile: 'ALL',
    spendType: 'all',
    category: 'ALL',
    vendorName: 'ALL',
    startDate: '',
    endDate: ''
  });

  // Decoupled trigger-only hook: SpendCubePage will NOT re-render on worker progress updates!
  const { triggerStaging } = useTriggerBackgroundStaging();

  useEffect(() => {
    loadData();
  }, []);

  // Subscribe to Background Web Worker: When SKU mapping background job finishes, reload records so UI updates reactively
  useEffect(() => {
    let lastHandledSkuMapping = 0;
    const unsub = backgroundJobManager.subscribe((st) => {
      if (st.lastSkuMappingTimestamp && st.lastSkuMappingTimestamp > lastHandledSkuMapping) {
        lastHandledSkuMapping = st.lastSkuMappingTimestamp;
        spendService.getAllRecords().then((updated) => {
          if (updated && updated.length > 0) {
            setRecords([...updated]);
          }
        }).catch(err => {
          console.warn('[SpendCubePage] Error reloading records after SKU mapping job:', err);
        });
      }
    });
    return unsub;
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const allRecords = await spendService.init();
      const skus = await spendService.getSkuMasters();
      const hospitals = await spendService.getHospitalMasters();
      const vendors = await spendService.getVendorMasters();
      setRecords(allRecords || []);
      setSkuMasters(skus || []);
      setHospitalMasters(hospitals || []);
      setVendorMasters(vendors || []);
      
      // Defer background staging trigger slightly so initial DOM rendering is 100% fluid & responsive
      if (allRecords && allRecords.length > 0) {
        setTimeout(() => {
          triggerStaging(allRecords, skus || [], hospitals || [], vendors || []);
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to load spend records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = async (newRecords: SpendRecord[], meta: UploadedBatchMeta) => {
    const updated = await spendService.addRecords(newRecords, meta);
    setRecords([...updated]);
    spendService.scheduleBackgroundDepartmentCompilation(updated);
    triggerStaging(updated, skuMasters, hospitalMasters, vendorMasters, undefined, true);
  };

  const handleUploadMultipleBatches = async (batches: Array<{ records: SpendRecord[]; meta: UploadedBatchMeta }>) => {
    const updated = await spendService.addMultipleBatches(batches);
    setRecords([...updated]);
    spendService.scheduleBackgroundDepartmentCompilation(updated);
    triggerStaging(updated, skuMasters, hospitalMasters, vendorMasters, undefined, true);
  };

  const handleRefreshRecords = async () => {
    const updated = await spendService.getAllRecords();
    setRecords([...updated]);
    triggerStaging(updated, skuMasters, hospitalMasters, vendorMasters, undefined, true);
  };

  const handleUploadSkuMasters = async (newSkus: SkuMasterRecord[], meta: { id: string; fileName: string; fileType: string; recordCount: number; replaceAll?: boolean }) => {
    const updated = await spendService.addSkuMasters(newSkus, { replaceAll: meta.replaceAll });
    setSkuMasters([...updated]);
    triggerStaging(records, updated, hospitalMasters, vendorMasters, undefined, true);
  };

  const handleDeduplicateSkuMasters = async () => {
    setLoading(true);
    try {
      const updated = await spendService.deduplicateDatabaseSkus();
      setSkuMasters([...updated]);
      triggerStaging(records, updated, hospitalMasters, vendorMasters, undefined, true);
    } catch (err) {
      console.error('Failed to deduplicate SKUs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSkuMasters = async () => {
    if (window.confirm('Hapus SKU master di browser ini?')) {
      const reset = await spendService.resetSkuMasters();
      setSkuMasters(reset);
    }
  };

  const handleUpdateSkuStandardPrice = async (productId: string, newStandardPrice: number) => {
    const updated = skuMasters.map(s => {
      if (s.productId === productId || s.id === productId || s.prItemId === productId) {
        return { ...s, standardPrice: newStandardPrice };
      }
      return s;
    });
    const saved = await spendService.addSkuMasters(updated);
    setSkuMasters([...saved]);
  };

  const handleSaveHospitalMasters = async (newHospitals: HospitalMasterRecord[]) => {
    const saved = await spendService.saveHospitalMasters(newHospitals);
    setHospitalMasters([...saved]);
  };

  const handleResetHospitalMasters = async () => {
    const reset = await spendService.resetHospitalMasters();
    setHospitalMasters([...reset]);
  };

  const handleSaveVendorMasters = async (newVendors: VendorMasterRecord[]) => {
    const saved = await spendService.saveVendorMasters(newVendors);
    setVendorMasters([...saved]);
  };

  const handleResetVendorMasters = async () => {
    const reset = await spendService.resetVendorMasters();
    setVendorMasters([...reset]);
  };

  const handleReset = async () => {
    if (window.confirm('Hapus data spend di browser ini? Import berikutnya mulai dari kosong.')) {
      setLoading(true);
      const resetRecords = await spendService.resetData();
      const resetSkus = await spendService.resetSkuMasters();
      const resetHosp = await spendService.resetHospitalMasters();
      const resetVend = await spendService.resetVendorMasters();
      setRecords(resetRecords);
      setSkuMasters(resetSkus);
      setHospitalMasters(resetHosp);
      setVendorMasters(resetVend);
      setLoading(false);
    }
  };

  const handleExportData = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredRecords, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `SpendCube_Export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return spendService.filterRecords(records, criteria);
  }, [records, criteria]);

  // KPIs
  const kpis = useMemo(() => {
    return spendService.calculateKPIs(filteredRecords);
  }, [filteredRecords]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    return spendService.getMonthlyTrend(filteredRecords);
  }, [filteredRecords]);

  // Hospital spend
  const hospitalSpend = useMemo(() => {
    return spendService.getHospitalSpend(filteredRecords);
  }, [filteredRecords]);

  // Category spend
  const categorySpend = useMemo(() => {
    return spendService.getCategorySpend(filteredRecords);
  }, [filteredRecords]);

  // Top vendors
  const topVendors = useMemo(() => {
    return spendService.getTopVendors(filteredRecords);
  }, [filteredRecords]);

  // Unique lists for filter dropdowns
  const uniqueHospitals = useMemo(() => {
    if (!records || records.length === 0) return [];
    const set = new Set(records.filter(Boolean).map(r => r.hospitalCode));
    return Array.from(set).filter(Boolean).sort();
  }, [records]);

  const uniqueCategories = useMemo(() => {
    if (!records || records.length === 0) return [];
    const set = new Set(records.filter(Boolean).map(r => r.procurementCategory || r.mappedCategory));
    return Array.from(set).filter(Boolean).sort();
  }, [records]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Loading Hospital SpendCube Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex">
      {/* ERP Sidebar with minimize toggle */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          activeTab={activeTab}
          searchQuery={criteria.searchQuery}
          onSearchChange={(q) => setCriteria({ ...criteria, searchQuery: q })}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenAiAdvisor={() => setIsAiOpen(true)}
          onExportData={handleExportData}
          username={username}
          onSignOut={onSignOut}
        />

        <main className="flex-1 p-4 sm:p-6 w-full min-w-0">
          {/* Dashboard Tab */}
          {visitedTabs.has('dashboard') && (
            <div className={isTabActive('dashboard') ? 'space-y-6' : 'hidden'}>
              <DashboardOverview 
                kpis={kpis} 
                records={filteredRecords} 
                skuMasters={skuMasters} 
              />

              <FilterBar
                criteria={criteria}
                onFilterChange={setCriteria}
                hospitals={uniqueHospitals}
                categories={uniqueCategories}
              />

              <SpendCharts
                monthlyTrend={monthlyTrend}
                hospitalSpend={hospitalSpend}
                categorySpend={categorySpend}
                topVendors={topVendors}
              />

              <TaxonomyTreeMapAndTopCharts
                records={filteredRecords}
                skuMasters={skuMasters}
                onSelectRecord={setSelectedRecord}
              />
            </div>
          )}

          {/* Monitoring Compliance SKU to PO Tab */}
          {visitedTabs.has('skuPoCompliance') && (
            <div className={isTabActive('skuPoCompliance') ? 'block' : 'hidden'}>
              <React.Suspense fallback={
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">Memuat modul Monitoring Kepatuhan SKU...</p>
                </div>
              }>
                <SkuPoComplianceView
                  records={records}
                  skuMasters={skuMasters}
                  onSelectRecord={setSelectedRecord}
                />
              </React.Suspense>
            </div>
          )}

          {/* Review Pemetaan SKU & Taksonomi Master Tab */}
          {visitedTabs.has('taxonomyMappingReview') && (
            <div className={isTabActive('taxonomyMappingReview') ? 'block' : 'hidden'}>
              <TaxonomyMappingReviewView
                records={records}
                skuMasters={skuMasters}
                onSelectRecord={setSelectedRecord}
                onOpenAiAdvisor={() => setIsAiOpen(true)}
              />
            </div>
          )}

          {/* Contract Opportunity & Targeting Tab */}
          {visitedTabs.has('contractTargeting') && (
            <div className={isTabActive('contractTargeting') ? 'block' : 'hidden'}>
              <ContractTargetingView
                records={records}
                skuMasters={skuMasters}
              />
            </div>
          )}

          {/* Price & Regional Intelligence Tab */}
          {visitedTabs.has('priceIntelligence') && (
            <div className={isTabActive('priceIntelligence') ? 'block' : 'hidden'}>
              <PriceIntelligenceView
                records={records}
                skuMasters={skuMasters}
                hospitalMasters={hospitalMasters}
                vendorMasters={vendorMasters}
                onSelectRecord={setSelectedRecord}
                onUpdateSkuStandardPrice={handleUpdateSkuStandardPrice}
              />
            </div>
          )}

          {/* Master Data Hub Tab */}
          {visitedTabs.has('masterData') && (
            <div className={isTabActive('masterData') ? 'block' : 'hidden'}>
              <MasterDataView
                records={records}
                skuMasters={skuMasters}
                hospitalMasters={hospitalMasters}
                vendorMasters={vendorMasters}
                initialSubTab={
                  activeTab === 'skuMaster'
                    ? 'sku'
                    : activeTab === 'masterDirectories'
                    ? 'hospitals'
                    : activeTab === 'departments' || activeTab === 'cleanDepartments'
                    ? 'departments'
                    : activeTab === 'maintenance'
                    ? 'maintenance'
                    : 'sku'
                }
                onUploadSkuMasters={handleUploadSkuMasters}
                onResetSkuMasters={handleResetSkuMasters}
                onDeduplicateSkuMasters={handleDeduplicateSkuMasters}
                onSaveHospitalMasters={handleSaveHospitalMasters}
                onSaveVendorMasters={handleSaveVendorMasters}
                onResetHospitalMasters={handleResetHospitalMasters}
                onResetVendorMasters={handleResetVendorMasters}
                onRefreshData={loadData}
                onSelectRecord={setSelectedRecord}
              />
            </div>
          )}

          {/* AI Query Hub Tab */}
          {visitedTabs.has('aiQueryHub') && (
            <div className={isTabActive('aiQueryHub') ? 'block' : 'hidden'}>
              <AiQueryHubView
                records={records}
                skuMasters={skuMasters}
                onSelectRecord={setSelectedRecord}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            </div>
          )}

          {/* e-Catalogue SKU Search Tab */}
          {visitedTabs.has('eCatalogueSearch') && (
            <div className={isTabActive('eCatalogueSearch') ? 'block' : 'hidden'}>
              <SkuCatalogSearchGoogleView
                records={records}
                skuMasters={skuMasters}
                onSelectRecord={setSelectedRecord}
                onOpenAiAdvisor={() => setIsAiOpen(true)}
              />
            </div>
          )}

          {/* Token Meter Tab */}
          {visitedTabs.has('tokenMeter') && (
            <div className={isTabActive('tokenMeter') ? 'block' : 'hidden'}>
              <TokenMeterView />
            </div>
          )}

          {/* Data Ingestion & Audit Tab */}
          {visitedTabs.has('dataAudit') && (
            <div className={isTabActive('dataAudit') ? 'block' : 'hidden'}>
              <DataIngestionAuditView
                records={records}
                onUploadSuccess={handleUploadSuccess}
                onUploadMultipleBatches={handleUploadMultipleBatches}
                onSelectRecord={setSelectedRecord}
                onRefreshRecords={handleRefreshRecords}
              />
            </div>
          )}

          {/* Vendors Analytics Tab */}
          {visitedTabs.has('vendors') && (
            <div className={isTabActive('vendors') ? 'block' : 'hidden'}>
              <VendorsView records={records} topVendors={topVendors} />
            </div>
          )}

          {/* Settings Tab */}
          {visitedTabs.has('settings') && (
            <div className={isTabActive('settings') ? 'block' : 'hidden'}>
              <SettingsView onResetData={handleReset} recordCount={records.length} />
            </div>
          )}

          {/* Support Tab */}
          {visitedTabs.has('support') && (
            <div className={isTabActive('support') ? 'block' : 'hidden'}>
              <SupportView />
            </div>
          )}
        </main>
      </div>

      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        onUploadMultipleBatches={handleUploadMultipleBatches}
        records={records}
        onPrUploadSuccess={loadData}
      />

      <AiAdvisorModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        kpis={kpis}
        hospitalSpend={hospitalSpend}
        categorySpend={categorySpend}
        topVendors={topVendors}
        monthlyTrend={monthlyTrend}
      />

      <TransactionDetailModal
        record={selectedRecord}
        skuMasters={skuMasters}
        onClose={() => setSelectedRecord(null)}
      />

      {/* Floating / Docked Background Worker Staging Footer with Progress Bar */}
      <StagingProgressBarFooter
        records={records}
        skuMasters={skuMasters}
        hospitalMasters={hospitalMasters}
        vendorMasters={vendorMasters}
      />
    </div>
  );
}
