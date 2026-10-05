import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  SavedAiQueryPreset, 
  TokenLogEntry,
  HospitalMasterRecord,
  VendorMasterRecord,
  UploadedBatchMeta,
  MaintenanceCacheData,
  PrecalculatedCubeAggregates,
  PurchaseRequisitionRecord,
  UserDepartmentMappingRecord,
  SkuMappingCacheRecord,
  SavedGoogleSkuSearchPreset,
  DepartmentMasterRecord,
  RawDepartmentDiscoveryItem
} from '../types/spend';
import { ContractTargetingAnalysisResult, SemanticSpendCluster, SourcingPipelineStage } from '../types/contractTargeting';

export interface ContractPipelineItem {
  id: string;
  clusterId: string;
  cluster: SemanticSpendCluster;
  stage: SourcingPipelineStage;
  targetSavingIdr: number;
  priority: string;
  targetVendor?: string;
  assignedCategoryManager?: string;
  notes?: string;
  targetRfpQuarter?: string;
  pinnedAt: string;
  updatedAt: string;
}

interface SpendDBSchema extends DBSchema {
  spendRecords: {
    key: string;
    value: SpendRecord;
    indexes: { 'by-hospital': string; 'by-source': string; 'by-month': string; 'by-vendor': string; 'by-skumaster': string };
  };
  uploadedFiles: {
    key: string;
    value: UploadedBatchMeta;
  };
  skuMaster: {
    key: string;
    value: SkuMasterRecord;
    indexes: { 'by-product-id': string; 'by-brand': string };
  };
  hospitalMasters: {
    key: string;
    value: HospitalMasterRecord;
    indexes: { 'by-code': string; 'by-region': string; 'by-island': string };
  };
  vendorMasters: {
    key: string;
    value: VendorMasterRecord;
    indexes: { 'by-name': string; 'by-region': string; 'by-island': string };
  };
  savedQueries: {
    key: string;
    value: SavedAiQueryPreset;
    indexes: { 'by-title': string };
  };
  tokenLogs: {
    key: string;
    value: TokenLogEntry;
    indexes: { 'by-timestamp': string };
  };
  maintenanceCache: {
    key: string;
    value: MaintenanceCacheData;
  };
  precalculatedAggregates: {
    key: string;
    value: PrecalculatedCubeAggregates;
  };
  contractTargetingCache: {
    key: string;
    value: ContractTargetingAnalysisResult;
  };
  contractPipeline: {
    key: string;
    value: ContractPipelineItem;
    indexes: { 'by-stage': string; 'by-cluster': string };
  };
  prRecords: {
    key: string;
    value: PurchaseRequisitionRecord;
    indexes: { 'by-po': string; 'by-requester': string; 'by-unit': string };
  };
  userDepartmentMappings: {
    key: string;
    value: UserDepartmentMappingRecord;
    indexes: { 'by-username': string; 'by-dept': string; 'by-unit': string };
  };
  skuMappingCache: {
    key: string;
    value: SkuMappingCacheRecord;
    indexes: { 'by-status': string; 'by-sku': string };
  };
  savedSkuSearches: {
    key: string;
    value: SavedGoogleSkuSearchPreset;
    indexes: { 'by-title': string; 'by-created': string };
  };
  departmentMasters: {
    key: string;
    value: DepartmentMasterRecord;
    indexes: { 'by-name': string; 'by-code': string; 'by-category': string };
  };
  departmentDiscoveryCache: {
    key: string;
    value: {
      id: string;
      compiledAt: string;
      unmappedItems: RawDepartmentDiscoveryItem[];
      totalTxCovered: number;
      totalSpendCovered: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<SpendDBSchema>> | null = null;
let activeUser = '';

export function bindSpendDbUser(username: string) {
  const next = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!next) throw new Error('Sign in required');
  if (activeUser === next) return;
  if (dbPromise) {
    void dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
  activeUser = next;
}

export function closeSpendDb() {
  if (dbPromise) {
    void dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
  activeUser = '';
}

export function getSpendDB() {
  if (!activeUser) throw new Error('Sign in required');
  if (!dbPromise) {
    dbPromise = openDB<SpendDBSchema>(`hospital-spendcube-${activeUser}`, 14, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('spendRecords')) {
          const store = db.createObjectStore('spendRecords', { keyPath: 'id' });
          store.createIndex('by-hospital', 'hospitalCode');
          store.createIndex('by-source', 'sourceFile');
          store.createIndex('by-month', 'monthYear');
          store.createIndex('by-vendor', 'vendorName');
          store.createIndex('by-skumaster', 'skuMasterId');
        } else {
          const store = transaction.objectStore('spendRecords');
          if (!store.indexNames.contains('by-skumaster')) {
            store.createIndex('by-skumaster', 'skuMasterId');
          }
        }
        if (!db.objectStoreNames.contains('uploadedFiles')) {
          db.createObjectStore('uploadedFiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('skuMaster')) {
          const store = db.createObjectStore('skuMaster', { keyPath: 'id' });
          store.createIndex('by-product-id', 'productId');
          store.createIndex('by-brand', 'brand');
        }
        if (!db.objectStoreNames.contains('hospitalMasters')) {
          const store = db.createObjectStore('hospitalMasters', { keyPath: 'id' });
          store.createIndex('by-code', 'hospitalCode');
          store.createIndex('by-region', 'region');
          store.createIndex('by-island', 'island');
        }
        if (!db.objectStoreNames.contains('vendorMasters')) {
          const store = db.createObjectStore('vendorMasters', { keyPath: 'id' });
          store.createIndex('by-name', 'vendorName');
          store.createIndex('by-region', 'domicileRegion');
          store.createIndex('by-island', 'domicileIsland');
        }
        if (!db.objectStoreNames.contains('savedQueries')) {
          const store = db.createObjectStore('savedQueries', { keyPath: 'id' });
          store.createIndex('by-title', 'title');
        }
        if (!db.objectStoreNames.contains('tokenLogs')) {
          const store = db.createObjectStore('tokenLogs', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('maintenanceCache')) {
          db.createObjectStore('maintenanceCache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('precalculatedAggregates')) {
          db.createObjectStore('precalculatedAggregates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('contractTargetingCache')) {
          db.createObjectStore('contractTargetingCache', { keyPath: 'filterHash' });
        }
        if (!db.objectStoreNames.contains('contractPipeline')) {
          const store = db.createObjectStore('contractPipeline', { keyPath: 'id' });
          store.createIndex('by-stage', 'stage');
          store.createIndex('by-cluster', 'clusterId');
        }
        if (!db.objectStoreNames.contains('prRecords')) {
          const store = db.createObjectStore('prRecords', { keyPath: 'id' });
          store.createIndex('by-po', 'erpId');
          store.createIndex('by-requester', 'requester');
          store.createIndex('by-unit', 'unit');
        }
        if (!db.objectStoreNames.contains('userDepartmentMappings')) {
          const store = db.createObjectStore('userDepartmentMappings', { keyPath: 'id' });
          store.createIndex('by-username', 'username');
          store.createIndex('by-dept', 'department');
          store.createIndex('by-unit', 'hospitalUnitCode');
        }
        if (!db.objectStoreNames.contains('skuMappingCache')) {
          const store = db.createObjectStore('skuMappingCache', { keyPath: 'itemKey' });
          store.createIndex('by-status', 'orphanStatus');
          store.createIndex('by-sku', 'matchedSkuId');
        }
        if (!db.objectStoreNames.contains('savedSkuSearches')) {
          const store = db.createObjectStore('savedSkuSearches', { keyPath: 'id' });
          store.createIndex('by-title', 'title');
          store.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('departmentMasters')) {
          const store = db.createObjectStore('departmentMasters', { keyPath: 'id' });
          store.createIndex('by-name', 'cleanDepartmentName');
          store.createIndex('by-code', 'departmentCode');
          store.createIndex('by-category', 'divisionCategory');
        }
        if (!db.objectStoreNames.contains('departmentDiscoveryCache')) {
          db.createObjectStore('departmentDiscoveryCache', { keyPath: 'id' });
        }
      },
      blocked() {
        console.warn('Database upgrade is blocked.');
      },
      blocking() {
        console.warn('Database upgrade is blocking another connection. Closing...');
      },
      terminated() {
        console.warn('Database connection terminated.');
        dbPromise = null;
      }
    }).catch(err => {
      dbPromise = null;
      console.error('Failed to initialize SpendCube IndexedDB:', err);
      throw err;
    });
  }
  return dbPromise;
}

export async function saveSpendRecords(
  records: SpendRecord[],
  onChunkProgress?: (savedCount: number, totalCount: number) => void
): Promise<void> {
  const db = await getSpendDB();
  const chunkSize = 1000;
  const total = records.length;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const tx = db.transaction('spendRecords', 'readwrite');
    const store = tx.objectStore('spendRecords');
    for (const record of chunk) {
      store.put(record);
    }
    await tx.done;

    if (onChunkProgress) {
      onChunkProgress(Math.min(i + chunkSize, total), total);
    }

    // Micro-yield to browser event loop so animation frames render smoothly
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export async function getAllSpendRecords(): Promise<SpendRecord[]> {
  const db = await getSpendDB();
  return db.getAll('spendRecords');
}

export async function countSpendRecords(
  indexName?: 'by-hospital' | 'by-source' | 'by-month' | 'by-vendor' | 'by-skumaster',
  query?: string | IDBKeyRange
): Promise<number> {
  const db = await getSpendDB();
  const tx = db.transaction('spendRecords', 'readonly');
  const store = tx.objectStore('spendRecords');
  if (indexName && query !== undefined) {
    const index = store.index(indexName);
    return index.count(query);
  }
  return store.count();
}

export async function getPaginatedSpendRecords(
  offset: number, 
  limit: number,
  options?: {
    indexName?: 'by-hospital' | 'by-source' | 'by-month' | 'by-vendor' | 'by-skumaster';
    query?: string | IDBKeyRange;
    direction?: IDBCursorDirection;
  }
): Promise<SpendRecord[]> {
  const db = await getSpendDB();
  const tx = db.transaction('spendRecords', 'readonly');
  const store = tx.objectStore('spendRecords');
  
  let source: any = store;
  if (options?.indexName) {
    source = store.index(options.indexName);
  }

  let cursor = await source.openCursor(options?.query, options?.direction || 'next');
  const results: SpendRecord[] = [];
  
  if (cursor && offset > 0) {
    // Fast skip using advance if available, otherwise while loop
    try {
      cursor = await cursor.advance(offset);
    } catch {
      let skipped = 0;
      while (cursor && skipped < offset) {
        cursor = await cursor.continue();
        skipped++;
      }
    }
  }

  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  return results;
}

export async function getPaginatedSpendRecordsWithTotal(
  offset: number,
  limit: number,
  options?: {
    indexName?: 'by-hospital' | 'by-source' | 'by-month' | 'by-vendor' | 'by-skumaster';
    query?: string | IDBKeyRange;
    direction?: IDBCursorDirection;
  }
): Promise<{ records: SpendRecord[]; totalCount: number }> {
  const totalCount = await countSpendRecords(options?.indexName, options?.query);
  const records = await getPaginatedSpendRecords(offset, limit, options);
  return { records, totalCount };
}

/**
 * Streams spend records via Cursor in chunks to background or UI workers without allocating all records in RAM
 */
export async function streamSpendRecordsWithCursor(
  onChunk: (chunk: SpendRecord[], progressPct: number) => Promise<boolean | void> | boolean | void,
  options?: {
    chunkSize?: number;
    indexName?: 'by-hospital' | 'by-source' | 'by-month' | 'by-vendor' | 'by-skumaster';
    query?: string | IDBKeyRange;
  }
): Promise<number> {
  const db = await getSpendDB();
  const tx = db.transaction('spendRecords', 'readonly');
  const store = tx.objectStore('spendRecords');

  const total = await (options?.indexName && options.query !== undefined
    ? store.index(options.indexName).count(options.query)
    : store.count());

  if (total === 0) return 0;

  const chunkSize = options?.chunkSize || 1000;
  let source: any = store;
  if (options?.indexName) {
    source = store.index(options.indexName);
  }

  let cursor = await source.openCursor(options?.query);
  let chunk: SpendRecord[] = [];
  let processedCount = 0;

  while (cursor) {
    chunk.push(cursor.value);
    processedCount++;

    if (chunk.length >= chunkSize) {
      const progressPct = Math.round((processedCount / total) * 100);
      const shouldStop = await onChunk(chunk, progressPct);
      chunk = [];
      if (shouldStop === false) {
        break;
      }
      // Micro-yield to browser event loop
      await new Promise(r => setTimeout(r, 0));
    }

    cursor = await cursor.continue();
  }

  if (chunk.length > 0) {
    await onChunk(chunk, 100);
  }

  return processedCount;
}

/**
 * Computes spend KPIs directly via an IndexedDB cursor without loading entire tables into JavaScript memory
 */
export async function aggregateSpendRecordsWithCursor(
  filter?: {
    hospitalCode?: string;
    monthYear?: string;
    purchaseCategory?: string;
  }
): Promise<{
  totalSpend: number;
  totalQty: number;
  opexSpend: number;
  capexSpend: number;
  recordCount: number;
  uniqueVendors: number;
  uniquePOs: number;
}> {
  const db = await getSpendDB();
  const tx = db.transaction('spendRecords', 'readonly');
  const store = tx.objectStore('spendRecords');

  let cursor = await store.openCursor();
  let totalSpend = 0;
  let totalQty = 0;
  let opexSpend = 0;
  let capexSpend = 0;
  let recordCount = 0;
  const vendorSet = new Set<string>();
  const poSet = new Set<string>();

  while (cursor) {
    const r = cursor.value;

    if (filter?.hospitalCode && filter.hospitalCode !== 'ALL' && r.hospitalCode !== filter.hospitalCode) {
      cursor = await cursor.continue();
      continue;
    }
    if (filter?.monthYear && filter.monthYear !== 'ALL' && r.monthYear !== filter.monthYear) {
      cursor = await cursor.continue();
      continue;
    }
    if (filter?.purchaseCategory && filter.purchaseCategory !== 'ALL' && r.purchaseCategory !== filter.purchaseCategory) {
      cursor = await cursor.continue();
      continue;
    }

    const spend = Number(r.totalLineAmount) || 0;
    const qty = Number(r.purchQty) || 0;
    totalSpend += spend;
    totalQty += qty;

    if (r.purchaseCategory === 'CAPEX') {
      capexSpend += spend;
    } else {
      opexSpend += spend;
    }

    if (r.vendorName) vendorSet.add(r.vendorName);
    if (r.purchId) poSet.add(r.purchId);
    recordCount++;

    cursor = await cursor.continue();
  }

  return {
    totalSpend,
    totalQty,
    opexSpend,
    capexSpend,
    recordCount,
    uniqueVendors: vendorSet.size,
    uniquePOs: poSet.size
  };
}

export async function clearAllSpendRecords(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction(['spendRecords', 'uploadedFiles'], 'readwrite');
  await tx.objectStore('spendRecords').clear();
  await tx.objectStore('uploadedFiles').clear();
  await tx.done;
}

export async function deleteSpendRecords(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getSpendDB();
  const tx = db.transaction('spendRecords', 'readwrite');
  const store = tx.objectStore('spendRecords');
  for (const id of ids) {
    store.delete(id);
  }
  await tx.done;
}

export async function replaceAllSpendRecords(
  records: SpendRecord[],
  onChunkProgress?: (savedCount: number, totalCount: number) => void
): Promise<void> {
  const db = await getSpendDB();
  // Clear first
  const clearTx = db.transaction('spendRecords', 'readwrite');
  await clearTx.objectStore('spendRecords').clear();
  await clearTx.done;

  // Save new deduplicated chunks
  await saveSpendRecords(records, onChunkProgress);
}

export async function saveSkuMasterRecords(records: SkuMasterRecord[]): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('skuMaster', 'readwrite');
  const store = tx.objectStore('skuMaster');
  for (const record of records) {
    store.put(record);
  }
  await tx.done;
}

export async function getAllSkuMasterRecords(): Promise<SkuMasterRecord[]> {
  const db = await getSpendDB();
  return db.getAll('skuMaster');
}

export async function clearSkuMasterRecords(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('skuMaster', 'readwrite');
  await tx.objectStore('skuMaster').clear();
  await tx.done;
}

export async function saveHospitalMasterRecords(records: HospitalMasterRecord[]): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('hospitalMasters', 'readwrite');
  const store = tx.objectStore('hospitalMasters');
  for (const record of records) {
    store.put(record);
  }
  await tx.done;
}

export async function getAllHospitalMasterRecords(): Promise<HospitalMasterRecord[]> {
  const db = await getSpendDB();
  return db.getAll('hospitalMasters');
}

export async function clearHospitalMasterRecords(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('hospitalMasters', 'readwrite');
  await tx.objectStore('hospitalMasters').clear();
  await tx.done;
}

export async function saveVendorMasterRecords(records: VendorMasterRecord[]): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('vendorMasters', 'readwrite');
  const store = tx.objectStore('vendorMasters');
  for (const record of records) {
    store.put(record);
  }
  await tx.done;
}

export async function getAllVendorMasterRecords(): Promise<VendorMasterRecord[]> {
  const db = await getSpendDB();
  return db.getAll('vendorMasters');
}

export async function clearVendorMasterRecords(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('vendorMasters', 'readwrite');
  await tx.objectStore('vendorMasters').clear();
  await tx.done;
}

export async function saveUploadedFileInfo(info: UploadedBatchMeta): Promise<void> {
  const db = await getSpendDB();
  await db.put('uploadedFiles', info);
}

export async function getUploadedFilesInfo(): Promise<UploadedBatchMeta[]> {
  const db = await getSpendDB();
  return db.getAll('uploadedFiles');
}

export async function saveSavedQueryPreset(preset: SavedAiQueryPreset): Promise<void> {
  const db = await getSpendDB();
  await db.put('savedQueries', preset);
}

export async function getAllSavedQueryPresets(): Promise<SavedAiQueryPreset[]> {
  const db = await getSpendDB();
  return db.getAll('savedQueries');
}

export async function deleteSavedQueryPreset(id: string): Promise<void> {
  const db = await getSpendDB();
  await db.delete('savedQueries', id);
}

export async function saveSavedSkuSearchPreset(preset: SavedGoogleSkuSearchPreset): Promise<void> {
  const db = await getSpendDB();
  await db.put('savedSkuSearches', preset);
}

export async function getAllSavedSkuSearchPresets(): Promise<SavedGoogleSkuSearchPreset[]> {
  const db = await getSpendDB();
  return db.getAll('savedSkuSearches');
}

export async function deleteSavedSkuSearchPreset(id: string): Promise<void> {
  const db = await getSpendDB();
  await db.delete('savedSkuSearches', id);
}

export async function saveTokenLog(entry: TokenLogEntry): Promise<void> {
  const db = await getSpendDB();
  await db.put('tokenLogs', entry);
}

export async function getAllTokenLogs(): Promise<TokenLogEntry[]> {
  const db = await getSpendDB();
  return db.getAll('tokenLogs');
}

export async function clearTokenLogs(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('tokenLogs', 'readwrite');
  await tx.objectStore('tokenLogs').clear();
  await tx.done;
}

export async function saveMaintenanceCache(cache: MaintenanceCacheData): Promise<void> {
  const db = await getSpendDB();
  await db.put('maintenanceCache', cache);
}

export async function getMaintenanceCache(id: string = 'maintenance_summary'): Promise<MaintenanceCacheData | undefined> {
  const db = await getSpendDB();
  return db.get('maintenanceCache', id);
}

export async function clearMaintenanceCache(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('maintenanceCache', 'readwrite');
  await tx.objectStore('maintenanceCache').clear();
  await tx.done;
}

// Precalculated Cube Aggregates Persistence Methods
export async function savePrecalculatedAggregates(aggregates: PrecalculatedCubeAggregates): Promise<void> {
  const db = await getSpendDB();
  await db.put('precalculatedAggregates', aggregates);
}

export async function getPrecalculatedAggregates(id: string = 'latest_aggregates'): Promise<PrecalculatedCubeAggregates | undefined> {
  const db = await getSpendDB();
  return db.get('precalculatedAggregates', id);
}

export async function clearPrecalculatedAggregates(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('precalculatedAggregates', 'readwrite');
  await tx.objectStore('precalculatedAggregates').clear();
  await tx.done;
}

// Contract Opportunity & Targeting Persistence Methods
export async function saveContractTargetingCache(result: ContractTargetingAnalysisResult): Promise<void> {
  const db = await getSpendDB();
  await db.put('contractTargetingCache', result);
}

export async function getContractTargetingCache(filterHash: string): Promise<ContractTargetingAnalysisResult | undefined> {
  const db = await getSpendDB();
  return db.get('contractTargetingCache', filterHash);
}

export async function saveContractPipelineItem(item: ContractPipelineItem): Promise<void> {
  const db = await getSpendDB();
  await db.put('contractPipeline', item);
}

export async function getAllContractPipelineItems(): Promise<ContractPipelineItem[]> {
  const db = await getSpendDB();
  return db.getAll('contractPipeline');
}

export async function deleteContractPipelineItem(id: string): Promise<void> {
  const db = await getSpendDB();
  await db.delete('contractPipeline', id);
}

// Purchase Requisition (PR) Persistence Methods
export async function savePrRecords(records: PurchaseRequisitionRecord[]): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('prRecords', 'readwrite');
  const store = tx.objectStore('prRecords');
  for (const record of records) {
    store.put(record);
  }
  await tx.done;
}

export async function getAllPrRecords(): Promise<PurchaseRequisitionRecord[]> {
  const db = await getSpendDB();
  return db.getAll('prRecords');
}

export async function clearPrRecords(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('prRecords', 'readwrite');
  await tx.objectStore('prRecords').clear();
  await tx.done;
}

// User Department Mapping Persistence Methods
export async function saveUserDepartmentMappings(mappings: UserDepartmentMappingRecord[]): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('userDepartmentMappings', 'readwrite');
  const store = tx.objectStore('userDepartmentMappings');
  for (const mapping of mappings) {
    store.put(mapping);
  }
  await tx.done;
}

export async function getAllUserDepartmentMappings(): Promise<UserDepartmentMappingRecord[]> {
  const db = await getSpendDB();
  return db.getAll('userDepartmentMappings');
}

export async function saveSingleUserDepartmentMapping(mapping: UserDepartmentMappingRecord): Promise<void> {
  const db = await getSpendDB();
  await db.put('userDepartmentMappings', mapping);
}

export async function deleteUserDepartmentMapping(id: string): Promise<void> {
  const db = await getSpendDB();
  await db.delete('userDepartmentMappings', id);
}

export async function clearUserDepartmentMappings(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('userDepartmentMappings', 'readwrite');
  await tx.objectStore('userDepartmentMappings').clear();
  await tx.done;
}

// Sku Mapping Cache Persistence Methods (Enterprise Offline-First Cache)
export async function getSkuMappingCacheItem(itemKey: string): Promise<SkuMappingCacheRecord | undefined> {
  const db = await getSpendDB();
  return db.get('skuMappingCache', itemKey);
}

export async function getAllSkuMappingCache(): Promise<SkuMappingCacheRecord[]> {
  const db = await getSpendDB();
  return db.getAll('skuMappingCache');
}

export async function saveSkuMappingCacheBatch(items: SkuMappingCacheRecord[]): Promise<void> {
  if (!items || items.length === 0) return;
  const db = await getSpendDB();
  const chunkSize = 200;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const tx = db.transaction('skuMappingCache', 'readwrite');
    const store = tx.objectStore('skuMappingCache');
    for (const item of chunk) {
      await store.put(item);
    }
    await tx.done;
  }
}

export async function saveSingleSkuMappingCache(item: SkuMappingCacheRecord): Promise<void> {
  const db = await getSpendDB();
  await db.put('skuMappingCache', item);
}

export async function clearSkuMappingCache(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('skuMappingCache', 'readwrite');
  await tx.objectStore('skuMappingCache').clear();
  await tx.done;
}

// Department Masters Persistence Methods (Clean Enterprise Registry for AI Copilot)
export async function getAllDepartmentMasters(): Promise<DepartmentMasterRecord[]> {
  const db = await getSpendDB();
  return db.getAll('departmentMasters');
}

export async function saveDepartmentMasters(records: DepartmentMasterRecord[]): Promise<void> {
  if (!records || records.length === 0) return;
  const db = await getSpendDB();
  const tx = db.transaction('departmentMasters', 'readwrite');
  const store = tx.objectStore('departmentMasters');
  for (const record of records) {
    await store.put(record);
  }
  await tx.done;
}

export async function saveSingleDepartmentMaster(record: DepartmentMasterRecord): Promise<void> {
  const db = await getSpendDB();
  await db.put('departmentMasters', record);
}

export async function deleteDepartmentMaster(id: string): Promise<void> {
  const db = await getSpendDB();
  await db.delete('departmentMasters', id);
}

export async function clearDepartmentMasters(): Promise<void> {
  const db = await getSpendDB();
  const tx = db.transaction('departmentMasters', 'readwrite');
  await tx.objectStore('departmentMasters').clear();
  await tx.done;
}

export interface DepartmentDiscoveryCacheRecord {
  id: string;
  compiledAt: string;
  unmappedItems: RawDepartmentDiscoveryItem[];
  totalTxCovered: number;
  totalSpendCovered: number;
}

export async function saveDepartmentDiscoveryCache(cache: DepartmentDiscoveryCacheRecord): Promise<void> {
  const db = await getSpendDB();
  await db.put('departmentDiscoveryCache', cache);
}

export async function getDepartmentDiscoveryCache(id: string = 'latest_discovery'): Promise<DepartmentDiscoveryCacheRecord | undefined> {
  const db = await getSpendDB();
  return db.get('departmentDiscoveryCache', id);
}





