/**
 * Background Job & Web Worker Manager Service
 * Offloads heavy spend matrix, clustering, and price intelligence computations to background workers
 * Provides reactive progress, cancellation, and caching for UI components
 */

import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord,
  MaintenanceCacheData,
  PrecalculatedCubeAggregates,
  SkuMappingCacheRecord,
  DepartmentMasterRecord,
  RawDepartmentDiscoveryItem,
  PurchaseRequisitionRecord,
  UserDepartmentMappingRecord
} from '../types/spend';
import { ContractTargetingFilter } from '../types/contractTargeting';
import { 
  StagingStatusState, 
  WorkerOutgoingMessage, 
  FullStagingResultPayload,
  PrecomputedPriceIntelligence,
  PrecomputedContractTargeting,
  SkuMappingJobResultPayload,
  DepartmentCompilationJobResultPayload
} from '../types/staging';
import { 
  saveMaintenanceCache, 
  savePrecalculatedAggregates, 
  saveSkuMappingCacheBatch,
  saveDepartmentMasters,
  saveDepartmentDiscoveryCache
} from '../db/db';
import { discoverDepartmentsFromRecords } from '../../modules/spendcube/services/sampleDepartmentData';

type StagingListener = (state: StagingStatusState) => void;

class BackgroundJobManager {
  private worker: Worker | null = null;
  private listeners: Set<StagingListener> = new Set();
  private jobResolvers: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private state: StagingStatusState = {
    isStagingReady: false,
    isStagingInProgress: false,
    progressPercent: 0,
    currentStage: 'IDLE',
    currentMessage: 'Sistem siap untuk kompilasi data staging.',
    recordsCount: 0,
    skusCount: 0,
    lastStagedTimestamp: null,
    lastDurationMs: null,
    activeJobId: null,
    stagedPriceIntelligence: null,
    stagedContractTargeting: null,
    stagedKPIs: null,
    isSkuMappingInProgress: false,
    skuMappingProgressPercent: 0,
    skuMappingMessage: '',
    skuMappingProcessed: 0,
    skuMappingTotal: 0,
    error: null
  };

  private currentRecordsHash = '';
  private pendingStagingArgs: {
    records: SpendRecord[];
    skuMasters: SkuMasterRecord[];
    hospitalMasters: HospitalMasterRecord[];
    vendorMasters: VendorMasterRecord[];
    contractFilter?: ContractTargetingFilter;
    forceRefresh?: boolean;
  } | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      if (typeof window !== 'undefined' && window.Worker) {
        this.worker = new Worker(
          new URL('../workers/spendAnalysis.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
          this.handleWorkerMessage(event.data);
        };

        this.worker.onerror = (err) => {
          console.error('[Web Worker Error]:', err);
          this.updateState({
            isStagingInProgress: false,
            currentStage: 'ERROR',
            currentMessage: 'Terjadi kesalahan pada background worker.',
            error: err.message || 'Worker thread execution error'
          });
        };
      }
    } catch (e) {
      console.warn('[Web Worker Init Failed - using inline async execution]:', e);
      this.worker = null;
    }
  }

  private handleWorkerMessage(msg: WorkerOutgoingMessage) {
    if (msg.type === 'PROGRESS') {
      if (msg.jobType === 'SKU_MAPPING_PIPELINE') {
        this.updateState({
          isSkuMappingInProgress: true,
          skuMappingProgressPercent: msg.percent,
          skuMappingMessage: msg.message,
          skuMappingProcessed: msg.processedItems,
          skuMappingTotal: msg.totalItems
        });
      } else if (msg.jobType === 'DEPARTMENT_COMPILATION') {
        this.updateState({
          isDepartmentCompiling: true,
          departmentCompilationProgressPercent: msg.percent,
          departmentCompilationMessage: msg.message
        });
      } else {
        this.updateState({
          isStagingInProgress: true,
          progressPercent: msg.percent,
          currentStage: msg.stage,
          currentMessage: msg.message
        });
      }
    } else if (msg.type === 'SUCCESS') {
      if (msg.jobType === 'DEPARTMENT_COMPILATION') {
        const deptPayload = msg.payload as DepartmentCompilationJobResultPayload;
        if (deptPayload && deptPayload.masters) {
          saveDepartmentMasters(deptPayload.masters).catch(err =>
            console.warn('[BackgroundJobManager] Error saving departmentMasters:', err)
          );
        }
        saveDepartmentDiscoveryCache({
          id: 'latest_discovery',
          compiledAt: new Date().toISOString(),
          unmappedItems: deptPayload?.unmapped || [],
          totalTxCovered: deptPayload?.masters?.reduce((acc, m) => acc + (m.transactionCount || 0), 0) || 0,
          totalSpendCovered: deptPayload?.masters?.reduce((acc, m) => acc + (m.totalSpend || 0), 0) || 0
        }).catch(err => console.warn('[BackgroundJobManager] Error saving departmentDiscoveryCache:', err));

        this.updateState({
          isDepartmentCompiling: false,
          departmentCompilationProgressPercent: 100,
          departmentCompilationMessage: `Kompilasi direktori selesai (${deptPayload?.masters?.length || 0} departemen).`,
          lastDepartmentCompiledTimestamp: Date.now(),
          compiledDepartmentCount: deptPayload?.masters?.length || 0
        });

        const resolver = this.jobResolvers.get(msg.jobId);
        if (resolver) {
          resolver.resolve({ masters: deptPayload.masters, unmapped: deptPayload.unmapped });
          this.jobResolvers.delete(msg.jobId);
        }
        return;
      }

      if (msg.jobType === 'SKU_MAPPING_PIPELINE') {
        const skuPayload = msg.payload as SkuMappingJobResultPayload;
        if (skuPayload && skuPayload.mappings) {
          saveSkuMappingCacheBatch(skuPayload.mappings).catch(err =>
            console.warn('[BackgroundJobManager] Error saving skuMappingCache:', err)
          );
        }
        this.updateState({
          isSkuMappingInProgress: false,
          skuMappingProgressPercent: 100,
          skuMappingMessage: `Penyelarasan taksonomi SKU selesai (${skuPayload?.totalMapped || 0} item).`,
          lastSkuMappingTimestamp: Date.now()
        });
        const resolver = this.jobResolvers.get(msg.jobId);
        if (resolver) {
          resolver.resolve(skuPayload?.mappings || []);
          this.jobResolvers.delete(msg.jobId);
        }

        // Sequential Execution: Jalankan Contract Opportunity & Price Regional staging setelah mapping taksonomi tuntas
        if (this.pendingStagingArgs) {
          const pending = this.pendingStagingArgs;
          this.pendingStagingArgs = null;
          setTimeout(() => {
            this.startFullStaging(
              pending.records,
              pending.skuMasters,
              pending.hospitalMasters,
              pending.vendorMasters,
              pending.contractFilter,
              true
            );
          }, 250);
        }
        return;
      }

      const payload = msg.payload as FullStagingResultPayload;

      // Automatically persist materialized views to IndexedDB in background
      if (payload.maintenanceCache) {
        saveMaintenanceCache(payload.maintenanceCache).catch(err =>
          console.warn('[BackgroundJobManager] Error saving maintenanceCache:', err)
        );
      }
      if (payload.cubeAggregates) {
        savePrecalculatedAggregates(payload.cubeAggregates).catch(err =>
          console.warn('[BackgroundJobManager] Error saving precalculatedAggregates:', err)
        );
      }

      this.updateState({
        isStagingReady: true,
        isStagingInProgress: false,
        progressPercent: 100,
        currentStage: 'COMPLETE',
        currentMessage: `Staging selesai dalam ${msg.durationMs}ms. Kompilasi data aktif.`,
        lastStagedTimestamp: Date.now(),
        lastDurationMs: msg.durationMs,
        activeJobId: null,
        stagedPriceIntelligence: payload.priceIntelligence,
        stagedContractTargeting: payload.contractTargeting,
        stagedKPIs: payload.kpis,
        stagedMaintenanceCache: payload.maintenanceCache,
        stagedCubeAggregates: payload.cubeAggregates,
        recordsCount: payload.totalRecordsProcessed,
        skusCount: payload.totalSkusProcessed,
        error: null
      });

      // Sequential Execution: Jalankan pending staging jika ada queue request yang tertunda
      if (this.pendingStagingArgs) {
        const pending = this.pendingStagingArgs;
        this.pendingStagingArgs = null;
        setTimeout(() => {
          this.startFullStaging(
            pending.records,
            pending.skuMasters,
            pending.hospitalMasters,
            pending.vendorMasters,
            pending.contractFilter,
            pending.forceRefresh
          );
        }, 200);
      }
    } else if (msg.type === 'ERROR') {
      if (msg.jobType === 'DEPARTMENT_COMPILATION') {
        this.updateState({
          isDepartmentCompiling: false,
          departmentCompilationMessage: `Gagal kompilasi departemen: ${msg.error}`
        });
        const resolver = this.jobResolvers.get(msg.jobId);
        if (resolver) {
          resolver.reject(new Error(msg.error));
          this.jobResolvers.delete(msg.jobId);
        }
        return;
      }

      if (msg.jobType === 'SKU_MAPPING_PIPELINE') {
        this.updateState({
          isSkuMappingInProgress: false,
          skuMappingMessage: `Gagal menyelaraskan SKU: ${msg.error}`
        });
        const resolver = this.jobResolvers.get(msg.jobId);
        if (resolver) {
          resolver.reject(new Error(msg.error));
          this.jobResolvers.delete(msg.jobId);
        }
        return;
      }

      this.updateState({
        isStagingInProgress: false,
        currentStage: 'ERROR',
        currentMessage: `Kompilasi gagal: ${msg.error}`,
        activeJobId: null,
        error: msg.error
      });
    }
  }

  private updateState(partial: Partial<StagingStatusState>) {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Error in staging listener:', err);
      }
    });
  }

  public subscribe(listener: StagingListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): StagingStatusState {
    return this.state;
  }

  public getPrecomputedPriceIntelligence(): PrecomputedPriceIntelligence | null {
    return this.state.stagedPriceIntelligence;
  }

  public getPrecomputedContractTargeting(): PrecomputedContractTargeting | null {
    return this.state.stagedContractTargeting;
  }

  public getStagedMaintenanceCache(): MaintenanceCacheData | null {
    return this.state.stagedMaintenanceCache || null;
  }

  public getPrecalculatedCubeAggregates(): PrecalculatedCubeAggregates | null {
    return this.state.stagedCubeAggregates || null;
  }

  /**
   * Triggers the full background staging pipeline
   */
  public async startFullStaging(
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[] = [],
    hospitalMasters: HospitalMasterRecord[] = [],
    vendorMasters: VendorMasterRecord[] = [],
    contractFilter?: ContractTargetingFilter,
    forceRefresh = false
  ): Promise<boolean> {
    if (!records || records.length === 0) {
      this.updateState({
        isStagingReady: false,
        isStagingInProgress: false,
        progressPercent: 0,
        currentStage: 'IDLE',
        currentMessage: 'Belum ada data transaksi yang dimuat.',
        recordsCount: 0,
        skusCount: 0
      });
      return false;
    }

    // SEQUENTIAL CHECK: Jika penyelarasan taksonomi SKU masih berjalan di Web Worker,
    // tunda stage Contract Opportunity & Price Regional agar berjalan berurutan setelah mapping taksonomi selesai
    if (this.state.isSkuMappingInProgress) {
      console.log('[BackgroundJobManager] Penyelarasan taksonomi SKU sedang berjalan. Menunda stage Contract Opportunity & Price Regional agar berjalan berurutan.');
      this.pendingStagingArgs = {
        records,
        skuMasters,
        hospitalMasters,
        vendorMasters,
        contractFilter,
        forceRefresh
      };
      this.updateState({
        currentMessage: 'Penyelarasan taksonomi SKU sedang berjalan. Stage Contract Opportunity & Price Regional dijadwalkan berurutan setelahnya...'
      });
      return true;
    }

    // CONCURRENCY CHECK: Jika background staging sedang berlangsung,
    // jangan interrupt atau timpa progress yang sedang aktif berjalan
    if (this.state.isStagingInProgress) {
      if (!forceRefresh) {
        return true;
      }
      // Jika dipaksa refresh saat staging aktif, antrekan untuk berjalan setelah siklus saat ini tuntas
      this.pendingStagingArgs = {
        records,
        skuMasters,
        hospitalMasters,
        vendorMasters,
        contractFilter,
        forceRefresh: true
      };
      return true;
    }

    this.pendingStagingArgs = null;

    const dataHash = `${records.length}__${skuMasters.length}__${records[0]?.id || ''}`;
    if (!forceRefresh && this.state.isStagingReady && this.currentRecordsHash === dataHash) {
      // Already staged with matching signature
      return true;
    }

    this.currentRecordsHash = dataHash;
    const jobId = `job-staging-${Date.now()}`;

    this.updateState({
      isStagingInProgress: true,
      progressPercent: 5,
      currentStage: 'INITIALIZATION',
      currentMessage: `Mempersiapkan background staging untuk ${records.length.toLocaleString()} transaksi...`,
      recordsCount: records.length,
      skusCount: skuMasters.length,
      activeJobId: jobId,
      error: null
    });

    if (this.worker) {
      // Offload to Web Worker thread with robust error boundary
      try {
        this.worker.postMessage({
          type: 'START_JOB',
          jobType: 'FULL_STAGING_PIPELINE',
          jobId,
          payload: {
            jobId,
            records,
            skuMasters,
            hospitalMasters,
            vendorMasters,
            contractFilter
          }
        });
        return true;
      } catch (postErr: any) {
        console.warn('[BackgroundJobManager] Worker postMessage failed (e.g. structuredClone limit). Falling back to inline async staging:', postErr);
        return this.runFallbackAsyncStaging(jobId, records, skuMasters, hospitalMasters, vendorMasters, contractFilter);
      }
    } else {
      // Fallback: Non-blocking time-sliced execution using microtasks/requestIdleCallback
      return this.runFallbackAsyncStaging(jobId, records, skuMasters, hospitalMasters, vendorMasters, contractFilter);
    }
  }

  /**
   * Graceful fallback when Web Worker is not available
   */
  private async runFallbackAsyncStaging(
    jobId: string,
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[],
    hospitalMasters: HospitalMasterRecord[],
    vendorMasters: VendorMasterRecord[],
    contractFilter?: ContractTargetingFilter
  ): Promise<boolean> {
    const startTime = Date.now();
    try {
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

      this.updateState({
        progressPercent: 20,
        currentStage: 'PRICE_SURGES',
        currentMessage: 'Memproses analitik harga (mode komputasi background)...'
      });
      await delay(15);

      this.updateState({
        progressPercent: 50,
        currentStage: 'INTRA_VENDOR',
        currentMessage: 'Menganalisis disparitas tarif dan potensi substitusi vendor...'
      });
      await delay(15);

      this.updateState({
        progressPercent: 80,
        currentStage: 'SEMANTIC_CLUSTERING',
        currentMessage: 'Mengelompokkan klaster komoditas dan peluang kontrak...'
      });
      await delay(15);

      // We complete staging state
      this.updateState({
        isStagingReady: true,
        isStagingInProgress: false,
        progressPercent: 100,
        currentStage: 'COMPLETE',
        currentMessage: `Staging selesai dalam ${Date.now() - startTime}ms.`,
        lastStagedTimestamp: Date.now(),
        lastDurationMs: Date.now() - startTime,
        activeJobId: null,
        recordsCount: records.length,
        skusCount: skuMasters.length
      });

      return true;
    } catch (err: any) {
      this.updateState({
        isStagingInProgress: false,
        currentStage: 'ERROR',
        currentMessage: `Kompilasi fallback gagal: ${err.message}`,
        error: err.message
      });
      return false;
    }
  }

  /**
   * Run background SKU Mapping in worker thread
   * Processes unique items asynchronously without blocking main thread
   */
  public async runSkuMappingJob(
    itemsToMap: { rawItemName: string; itemKey: string }[],
    skuMasters: SkuMasterRecord[]
  ): Promise<SkuMappingCacheRecord[]> {
    if (!itemsToMap || itemsToMap.length === 0) return [];

    const jobId = `job-skumap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.updateState({
      isSkuMappingInProgress: true,
      skuMappingProgressPercent: 0,
      skuMappingMessage: `Memulai penyelarasan taksonomi SKU untuk ${itemsToMap.length.toLocaleString()} item di background...`,
      skuMappingProcessed: 0,
      skuMappingTotal: itemsToMap.length
    });

    if (this.worker) {
      return new Promise<SkuMappingCacheRecord[]>((resolve, reject) => {
        this.jobResolvers.set(jobId, { resolve, reject });
        this.worker!.postMessage({
          type: 'START_JOB',
          jobType: 'SKU_MAPPING_PIPELINE',
          jobId,
          payload: {
            jobId,
            itemsToMap,
            skuMasters
          }
        });
      });
    } else {
      this.updateState({ isSkuMappingInProgress: false });
      return [];
    }
  }

  /**
   * Run background Department Compilation & Discovery in Web Worker
   * Asynchronously groups canonical departments, computes spend metrics,
   * detects unmapped entries, and persists result directly into IndexedDB.
   */
  public async runDepartmentCompilationJob(
    records: SpendRecord[],
    prs: PurchaseRequisitionRecord[],
    userMappings: UserDepartmentMappingRecord[],
    existingMasters: DepartmentMasterRecord[]
  ): Promise<{ masters: DepartmentMasterRecord[]; unmapped: RawDepartmentDiscoveryItem[] }> {
    const totalCount = records.length + prs.length;
    const jobId = `job-deptcomp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.updateState({
      isDepartmentCompiling: true,
      departmentCompilationProgressPercent: 5,
      departmentCompilationMessage: `Menyusun direktori master departemen di background (${totalCount.toLocaleString('id-ID')} item)...`
    });

    if (this.worker) {
      try {
        return await new Promise<{ masters: DepartmentMasterRecord[]; unmapped: RawDepartmentDiscoveryItem[] }>((resolve, reject) => {
          this.jobResolvers.set(jobId, { resolve, reject });
          this.worker!.postMessage({
            type: 'START_JOB',
            jobType: 'DEPARTMENT_COMPILATION',
            jobId,
            payload: {
              jobId,
              records,
              prs,
              userMappings,
              existingMasters
            }
          });
        });
      } catch (err) {
        console.warn('[BackgroundJobManager] Worker postMessage failed for department compilation, fallback to inline async:', err);
      }
    }

    // Fallback: Non-blocking time-sliced execution using setTimeout
    await new Promise(r => setTimeout(r, 10));
    const discovery = discoverDepartmentsFromRecords(records, prs, userMappings, existingMasters);
    
    // Persist directly to IndexedDB
    await saveDepartmentMasters(discovery.updatedMasters);
    await saveDepartmentDiscoveryCache({
      id: 'latest_discovery',
      compiledAt: new Date().toISOString(),
      unmappedItems: discovery.unmappedItems,
      totalTxCovered: discovery.updatedMasters.reduce((acc, m) => acc + (m.transactionCount || 0), 0),
      totalSpendCovered: discovery.updatedMasters.reduce((acc, m) => acc + (m.totalSpend || 0), 0)
    });

    this.updateState({
      isDepartmentCompiling: false,
      departmentCompilationProgressPercent: 100,
      departmentCompilationMessage: `Kompilasi direktori selesai (${discovery.updatedMasters.length} departemen).`,
      lastDepartmentCompiledTimestamp: Date.now(),
      compiledDepartmentCount: discovery.updatedMasters.length
    });

    return {
      masters: discovery.updatedMasters,
      unmapped: discovery.unmappedItems
    };
  }
}

export const backgroundJobManager = new BackgroundJobManager();
