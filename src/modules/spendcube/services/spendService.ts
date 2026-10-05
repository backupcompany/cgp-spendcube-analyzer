import { 
  SpendRecord, 
  SpendFilterCriteria, 
  SpendSummaryKPIs, 
  MonthlyTrendItem, 
  HospitalSpendItem, 
  CategorySpendItem, 
  VendorSpendItem, 
  SkuMasterRecord, 
  getFormattedSkuName,
  decomposeSkuString,
  ParsedSkuComponents,
  normalizeSkuSyntax,
  normalizeSpecString,
  isSpecSlotEmpty,
  parseSpecSlots,
  HospitalMasterRecord,
  VendorMasterRecord,
  UploadedBatchMeta,
  UnmatchedItemSummary,
  SuggestedSkuMatch,
  MaintenanceHealthStats,
  MaintenanceCacheData,
  PrecalculatedCubeAggregates,
  PurchaseRequisitionRecord,
  UserDepartmentMappingRecord,
  splitItemNameAndNotes,
  computeWeightedSkuSimilarity,
  computeTokenSetSimilarity,
  hasConflictingNumbers,
  hasConflictingModifiers,
  computeJaroWinklerSimilarity,
  WeightedSkuMatchResult,
  SkuMappingCacheRecord,
  buildSpendRecordId,
  DepartmentMasterRecord,
  RawDepartmentDiscoveryItem,
  isPrSummaryRecord
} from '../../../core/types/spend';
import { 
  saveSpendRecords, 
  replaceAllSpendRecords,
  getAllSpendRecords, 
  getPaginatedSpendRecords,
  getPaginatedSpendRecordsWithTotal,
  countSpendRecords,
  streamSpendRecordsWithCursor,
  aggregateSpendRecordsWithCursor,
  clearAllSpendRecords, 
  saveUploadedFileInfo, 
  getUploadedFilesInfo, 
  getAllSkuMasterRecords, 
  saveSkuMasterRecords, 
  clearSkuMasterRecords,
  getAllHospitalMasterRecords,
  saveHospitalMasterRecords,
  clearHospitalMasterRecords,
  getAllVendorMasterRecords,
  saveVendorMasterRecords,
  clearVendorMasterRecords,
  saveMaintenanceCache,
  getMaintenanceCache,
  clearMaintenanceCache,
  savePrecalculatedAggregates,
  getPrecalculatedAggregates,
  clearPrecalculatedAggregates,
  getAllPrRecords,
  savePrRecords,
  clearPrRecords,
  getAllUserDepartmentMappings,
  saveUserDepartmentMappings,
  saveSingleUserDepartmentMapping,
  deleteUserDepartmentMapping,
  clearUserDepartmentMappings,
  getAllSkuMappingCache,
  saveSkuMappingCacheBatch,
  saveSingleSkuMappingCache,
  clearSkuMappingCache,
  getAllDepartmentMasters,
  saveDepartmentMasters,
  saveSingleDepartmentMaster,
  deleteDepartmentMaster,
  clearDepartmentMasters,
  clearTokenLogs,
  saveDepartmentDiscoveryCache,
  getDepartmentDiscoveryCache,
  DepartmentDiscoveryCacheRecord
} from '../../../core/db/db';
import { backgroundJobManager } from '../../../core/services/backgroundJobManager';
import { generateSampleSkuRecords } from './sampleSkuData';
import { generateSampleHospitalMasters } from './sampleMasterData';
import { generateSamplePrRecords, generateSampleUserDepartmentMappings } from './samplePrData';

export interface SkuIndex {
  exactNameMap: Map<string, SkuMasterRecord>;
  exactCodeMap: Map<string, SkuMasterRecord>;
  tokenMap: Map<string, SkuMasterRecord[]>;
}

let cachedSkuIndex: { skusCount: number; index: SkuIndex } | null = null;

export function buildSkuIndex(masterSkus: SkuMasterRecord[]): SkuIndex {
  if (cachedSkuIndex && cachedSkuIndex.skusCount === masterSkus.length) {
    return cachedSkuIndex.index;
  }

  const exactNameMap = new Map<string, SkuMasterRecord>();
  const exactCodeMap = new Map<string, SkuMasterRecord>();
  const tokenMap = new Map<string, SkuMasterRecord[]>();

  for (const sku of masterSkus) {
    const rawName = (sku.name || '').trim().toLowerCase();
    if (rawName) exactNameMap.set(rawName, sku);
    const formatted = (sku.formattedSkuName || '').trim().toLowerCase();
    if (formatted) exactNameMap.set(formatted, sku);
    if (sku.commodityItem) exactNameMap.set(sku.commodityItem.trim().toLowerCase(), sku);

    if (sku.productId) exactCodeMap.set(sku.productId.trim().toLowerCase(), sku);
    if (sku.id) exactCodeMap.set(sku.id.trim().toLowerCase(), sku);
    if (sku.prItemId) exactCodeMap.set(sku.prItemId.trim().toLowerCase(), sku);
    if (sku.cprItemId) exactCodeMap.set(sku.cprItemId.trim().toLowerCase(), sku);
    if (sku.partNumber) exactCodeMap.set(sku.partNumber.trim().toLowerCase(), sku);

    // Tokenize
    const tokens = rawName.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
    for (const t of tokens) {
      let list = tokenMap.get(t);
      if (!list) {
        list = [];
        tokenMap.set(t, list);
      }
      if (list.length < 20) { // Cap list per token to keep search instantaneous
        list.push(sku);
      }
    }
  }

  const result = { exactNameMap, exactCodeMap, tokenMap };
  cachedSkuIndex = { skusCount: masterSkus.length, index: result };
  return result;
}

export function findSmartSkuSuggestionsFast(
  unmatchedName: string, 
  itemIds: string[], 
  skuIndex: SkuIndex
): SuggestedSkuMatch[] {
  // Strip note component written on new lines and extract ::skuCode
  const { itemName: cleanUnmatched, extractedSkuCode } = splitItemNameAndNotes(unmatchedName);
  const cleanName = (cleanUnmatched || unmatchedName || '').toLowerCase().trim();
  if (!cleanName && !extractedSkuCode) return [];
  const suggestions: SuggestedSkuMatch[] = [];

  // TAHAP 1 (PRIORITAS PERTAMA): Kecocokan langsung kode SKU dari '::' pada Item Name PO
  if (extractedSkuCode) {
    const codeKey = extractedSkuCode.toLowerCase().trim();
    const matchedByCode = skuIndex.exactCodeMap.get(codeKey);
    if (matchedByCode) {
      suggestions.push({
        sku: matchedByCode,
        similarityScore: 100,
        matchReason: `Kode SKU Master (::${extractedSkuCode}) dari Item Name PO cocok dengan Master SKU (${matchedByCode.productId || matchedByCode.name})`,
        matchType: 'EXACT_CODE'
      });
      return suggestions;
    }
  }

  // TAHAP 3: Direct match by exact full name (tanpa komponen Note di line baru & tanpa ::code)
  const exactNameSku = skuIndex.exactNameMap.get(cleanName);
  if (exactNameSku) {
    suggestions.push({
      sku: exactNameSku,
      similarityScore: 100,
      matchReason: 'Nama barang (tanpa Note baris baru) identik dengan Master SKU',
      matchType: 'EXACT_NAME'
    });
    return suggestions;
  }

  // NOTE: itemId / product code dari PO TIDAK DIGUNAKAN karena itemId di PO adalah grouping finance spending, bukan master SKU.

  // TAHAP 4 & 5: Candidate lookup via Inverted Token Index
  const tokensA = cleanName.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  if (tokensA.length === 0) return [];

  const candidateSet = new Set<SkuMasterRecord>();
  for (const t of tokensA) {
    const matches = skuIndex.tokenMap.get(t);
    if (matches) {
      for (const m of matches) candidateSet.add(m);
      if (candidateSet.size >= 12) break; // Keep candidate set tight for speed
    }
  }

  if (candidateSet.size === 0) return [];

  // Score ONLY the candidate subset (typically 3 to 12 SKUs max!)
  for (const sku of candidateSet) {
    const skuName = (sku.name || '').toLowerCase();
    let score = 0;
    let matchReason = '';

    if (skuName.includes(cleanName) || cleanName.includes(skuName)) {
      score = 88;
      matchReason = 'Nama barang merupakan bagian dari Master SKU';
    } else {
      let overlap = 0;
      const skuTokens = skuName.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
      tokensA.forEach(ta => {
        if (skuTokens.some(tb => tb.includes(ta) || ta.includes(tb))) overlap += 1;
      });
      const union = new Set([...tokensA, ...skuTokens]).size;
      const jaccard = union > 0 ? (overlap / union) * 100 : 0;

      if (jaccard > 25) {
        score = Math.round(jaccard);
        matchReason = `Kemiripan kata kunci (${overlap} kata kunci cocok)`;
      }
    }

    if (score >= 35) {
      suggestions.push({
        sku,
        similarityScore: score,
        matchReason,
        matchType: 'TOKEN_SIMILARITY'
      });
    }
  }

  return suggestions.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3);
}

class SpendService {
  private cacheRecords: SpendRecord[] = [];
  private cacheSkuMasters: SkuMasterRecord[] = [];
  private cacheHospitalMasters: HospitalMasterRecord[] = [];
  private cacheVendorMasters: VendorMasterRecord[] = [];
  private cachePrRecords: PurchaseRequisitionRecord[] = [];
  private cacheUserDepartmentMappings: UserDepartmentMappingRecord[] = [];
  private cacheDepartmentMasters: DepartmentMasterRecord[] = [];
  private isLoaded = false;
  private isSkuLoaded = false;
  private isHospitalLoaded = false;
  private isVendorLoaded = false;
  private isPrLoaded = false;
  private isUserDeptLoaded = false;
  private isDepartmentLoaded = false;
  private memoryMaintenanceCache: MaintenanceCacheData | null = null;
  private memoryPrecalculatedAggregates: PrecalculatedCubeAggregates | null = null;
  private skuMappingCacheMap: Map<string, SkuMappingCacheRecord> = new Map();
  private isSkuMappingCacheLoaded = false;
  private pendingWorkerMapping = false;

  async loadSkuMappingCache(): Promise<Map<string, SkuMappingCacheRecord>> {
    if (this.isSkuMappingCacheLoaded && this.skuMappingCacheMap.size > 0) {
      return this.skuMappingCacheMap;
    }
    try {
      const cached = await getAllSkuMappingCache();
      for (const c of cached) {
        if (c && c.itemKey) {
          this.skuMappingCacheMap.set(c.itemKey, c);
        }
      }
      this.isSkuMappingCacheLoaded = true;
    } catch (err) {
      console.warn('[SpendService] Error loading skuMappingCache:', err);
    }
    return this.skuMappingCacheMap;
  }

  private async purgeDemoIfUntouched(): Promise<void> {
    const files = await getUploadedFilesInfo();
    const hasReal = files.some((f) => f.id.startsWith('upload-') || f.id.startsWith('pr-batch-'));
    const hasDemo = files.some((f) => f.id.startsWith('sample-') || f.fileType === 'Sample Master Dataset');
    if (!hasDemo || hasReal) return;

    await clearAllSpendRecords();
    await clearSkuMasterRecords();
    await clearHospitalMasterRecords();
    await clearVendorMasterRecords();
    await clearPrRecords();
    await clearUserDepartmentMappings();
    await clearSkuMappingCache();
    await clearDepartmentMasters();
    await clearTokenLogs();
    await clearMaintenanceCache();
    await clearPrecalculatedAggregates();

    this.cacheRecords = [];
    this.cacheSkuMasters = [];
    this.cacheHospitalMasters = [];
    this.cacheVendorMasters = [];
    this.cachePrRecords = [];
    this.cacheUserDepartmentMappings = [];
    this.cacheDepartmentMasters = [];
    this.skuMappingCacheMap.clear();
    this.memoryMaintenanceCache = null;
    this.memoryPrecalculatedAggregates = null;
    this.isLoaded = false;
    this.isSkuLoaded = false;
    this.isHospitalLoaded = false;
    this.isVendorLoaded = false;
    this.isPrLoaded = false;
    this.isUserDeptLoaded = false;
    this.isDepartmentLoaded = false;
    this.isSkuMappingCacheLoaded = false;
  }

  async init(): Promise<SpendRecord[]> {
    await this.purgeDemoIfUntouched();
    if (this.isLoaded && this.cacheRecords.length > 0) {
      return this.cacheRecords;
    }
    await this.loadSkuMappingCache();
    const skus = await getAllSkuMasterRecords();
    let skuList: SkuMasterRecord[];
    if (skus.length === 0) {
      skuList = [];
    } else {
      const deduplicated = this.deduplicateSkuList(skus);
      if (deduplicated.length !== skus.length) {
        console.log(`[SpendService] Auto-deduplicating SKU Master DB on init: from ${skus.length} down to ${deduplicated.length} unique SKUs.`);
        await clearSkuMasterRecords();
        await saveSkuMasterRecords(deduplicated);
        skuList = deduplicated;
      } else {
        skuList = skus;
      }
    }
    this.cacheSkuMasters = skuList;
    this.isSkuLoaded = true;

    // Load hospital masters
    await this.getHospitalMasters();
    // Load vendor masters
    await this.getVendorMasters();
    // Load clean department masters (AI Reference Registry)
    await this.getDepartmentMasters();

    // Load PR records and User-Dept mappings
    const userMappings = await this.getUserDepartmentMappings();
    const prs = await this.getPrRecords();

    let records = await getAllSpendRecords();
    if (records.length === 0) {
      this.cacheRecords = [];
    } else {
      // Auto-retrofit & Deduplication: Transaksi unik murni berdasarkan PO ID dan Line Number.
      // Hospital code dan file source tidak relevan.
      // Jika ada perpaduan PO ID dan Line Number yang sama, gunakan transaksi yang terakhir.
      const deduplicatedMap = new Map<string, SpendRecord>();
      let hasLegacyIdOrDuplicate = false;

      // Purge any PR summary records accidentally ingested into the spend transactions store
      const hasPrSummaryInTransactions = records.some(r => isPrSummaryRecord(r));
      if (hasPrSummaryInTransactions) {
        console.log('[SpendService] Purging rogue PR summary records from transaction database...');
        records = records.filter(r => !isPrSummaryRecord(r));
        hasLegacyIdOrDuplicate = true;
      }

      for (const r of records) {
        const canonicalId = buildSpendRecordId(r.purchId, r.lineNumber);
        if (r.id !== canonicalId) {
          hasLegacyIdOrDuplicate = true;
        }
        if (deduplicatedMap.has(canonicalId)) {
          hasLegacyIdOrDuplicate = true;
        }
        // Selalu gunakan transaksi yang terakhir
        deduplicatedMap.set(canonicalId, { ...r, id: canonicalId });
      }

      if (hasLegacyIdOrDuplicate) {
        const deduplicatedRecords = Array.from(deduplicatedMap.values());
        console.log(`[SpendService] Auto-deduplicating transactions by PO ID & Line Number on init: from ${records.length} to ${deduplicatedRecords.length} unique records.`);
        await replaceAllSpendRecords(deduplicatedRecords);
        records = deduplicatedRecords;
      }

      // Auto-retrofit: Check if any existing stored records contain multiline notes or '::' in itemName
      let hasMultilineToMigrate = false;
      const normalizedRecords = records.map(r => {
        const rawTarget = r.rawItemName || r.itemName || '';
        if (/[\r\n]|_x000D_|::/g.test(rawTarget)) {
          const { itemName, itemNotes, rawItemName, extractedSkuCode } = splitItemNameAndNotes(rawTarget);
          if (itemNotes || itemName !== r.itemName || extractedSkuCode !== r.extractedSkuCode) {
            hasMultilineToMigrate = true;
            return {
              ...r,
              itemName,
              itemNotes,
              extractedSkuCode,
              rawItemName: r.rawItemName || rawItemName
            };
          }
        }
        return r;
      });

      const recordsToEnrich = hasMultilineToMigrate ? normalizedRecords : records;
      
      // Auto-retrofit taxonomy: Check if any orphan records still use raw procurementCategory, have skuMasterId incorrectly populated, or haven't been mapped to UNMAPPED / ORPHAN PO
      const needsTaxonomyRetrofit = records.some(r => 
        (r.orphanStatus === 'FULL_ORPHAN' || r.orphanStatus === 'PARTIAL_ORPHAN' || !r.skuMasterId) &&
        (r.taxonomyLv1 !== 'UNMAPPED / ORPHAN PO' || (r.orphanStatus !== 'EXACT_MATCH' && r.skuMasterId !== undefined))
      );

      const isAlreadyEnriched = !hasMultilineToMigrate && 
        !needsTaxonomyRetrofit &&
        records.length > 0 && 
        records[0].orphanStatus !== undefined;

      if (isAlreadyEnriched) {
        this.cacheRecords = records;
        // Smart Check: Cek apakah ada record yang belum match dan belum terdaftar di skuMappingCache
        const unmappedToSchedule: { rawItemName: string; itemKey: string }[] = [];
        const seenKeys = new Set<string>();
        for (const r of records) {
          const rawTarget = r.rawItemName || r.itemName || '';
          const itemKey = rawTarget.trim().toLowerCase();
          if (itemKey && !seenKeys.has(itemKey) && (!r.skuMasterId || r.orphanStatus !== 'EXACT_MATCH')) {
            if (!this.skuMappingCacheMap.has(itemKey)) {
              seenKeys.add(itemKey);
              unmappedToSchedule.push({ rawItemName: rawTarget, itemKey });
            }
          }
        }
        if (unmappedToSchedule.length > 0) {
          this.scheduleWorkerSkuMapping(unmappedToSchedule, skuList);
        }
      } else {
        const skuEnriched = this.enrichRecordsWithSkuMapping(recordsToEnrich, skuList);
        this.cacheRecords = this.enrichRecordsWithPrData(skuEnriched, prs, userMappings);
        saveSpendRecords(this.cacheRecords).catch(err => console.warn('Background auto-save migrated records error:', err));
      }
    }

    // Preload precalculated aggregates from IndexedDB in background
    getPrecalculatedAggregates('latest_aggregates').then(agg => {
      if (agg) this.memoryPrecalculatedAggregates = agg;
    }).catch(() => {});

    this.isLoaded = true;
    return this.cacheRecords;
  }

  /**
   * Retroactive Migration: Scans all existing records in IndexedDB,
   * extracts Line 1 as clean SKU Name and Line 2+ as itemNotes,
   * re-saves to IndexedDB, and updates SKU pairings.
   * This completely eliminates the need for users to re-upload existing PO files!
   */
  async retrofitSplitItemNotesOnExistingRecords(): Promise<{
    scannedCount: number;
    updatedCount: number;
  }> {
    const allRecords = await getAllSpendRecords();
    let updatedCount = 0;

    const normalizedRecords = allRecords.map(r => {
      const rawTarget = r.rawItemName || r.itemName || '';
      if (/[\r\n]|_x000D_|::/g.test(rawTarget)) {
        const { itemName, itemNotes, rawItemName, extractedSkuCode } = splitItemNameAndNotes(rawTarget);
        if (itemNotes || itemName !== r.itemName || extractedSkuCode !== r.extractedSkuCode) {
          updatedCount++;
          return {
            ...r,
            itemName,
            itemNotes,
            extractedSkuCode,
            rawItemName: r.rawItemName || rawItemName
          };
        }
      }
      return r;
    });

    if (updatedCount > 0) {
      const skus = await this.getSkuMasters();
      const prs = await this.getPrRecords();
      const userMappings = await this.getUserDepartmentMappings();

      const skuEnriched = this.enrichRecordsWithSkuMapping(normalizedRecords, skus);
      const fullyEnriched = this.enrichRecordsWithPrData(skuEnriched, prs, userMappings);

      await saveSpendRecords(fullyEnriched);
      this.cacheRecords = fullyEnriched;
    }

    return {
      scannedCount: allRecords.length,
      updatedCount
    };
  }

  async getAllRecords(): Promise<SpendRecord[]> {
    if (this.isLoaded && this.cacheRecords.length > 0) {
      return this.cacheRecords.filter(r => !isPrSummaryRecord(r));
    }
    const res = await this.init();
    return res.filter(r => !isPrSummaryRecord(r));
  }

  /**
   * Reads a page of records using IndexedDB cursor navigation (zero memory bloat)
   */
  async getPaginatedRecords(
    offset: number, 
    limit: number,
    options?: {
      indexName?: 'by-hospital' | 'by-source' | 'by-month' | 'by-vendor' | 'by-skumaster';
      query?: string | IDBKeyRange;
    }
  ): Promise<{ records: SpendRecord[]; totalCount: number }> {
    const skuList = await this.getSkuMasters();
    const result = await getPaginatedSpendRecordsWithTotal(offset, limit, options);
    const enriched = this.enrichRecordsWithSkuMapping(result.records, skuList);
    return {
      records: enriched,
      totalCount: result.totalCount
    };
  }

  /**
   * Fast count of records in IndexedDB without fetching data objects
   */
  async countRecords(
    indexName?: 'by-hospital' | 'by-source' | 'by-month' | 'by-vendor' | 'by-skumaster',
    query?: string | IDBKeyRange
  ): Promise<number> {
    return countSpendRecords(indexName, query);
  }

  /**
   * Streams all records in chunks using a background Cursor
   */
  async streamAllRecords(
    onChunk: (chunk: SpendRecord[], progressPct: number) => Promise<boolean | void> | boolean | void,
    options?: {
      chunkSize?: number;
      indexName?: 'by-hospital' | 'by-source' | 'by-month' | 'by-vendor' | 'by-skumaster';
      query?: string | IDBKeyRange;
    }
  ): Promise<number> {
    const skuList = await this.getSkuMasters();
    return streamSpendRecordsWithCursor(async (rawChunk, pct) => {
      const enriched = this.enrichRecordsWithSkuMapping(rawChunk, skuList);
      return onChunk(enriched, pct);
    }, options);
  }

  /**
   * Direct cursor-based KPI aggregation from IndexedDB
   */
  async aggregateMetricsWithCursor(filter?: {
    hospitalCode?: string;
    monthYear?: string;
    purchaseCategory?: string;
  }) {
    return aggregateSpendRecordsWithCursor(filter);
  }

  async getHospitalMasters(): Promise<HospitalMasterRecord[]> {
    if (this.isHospitalLoaded && this.cacheHospitalMasters.length > 0) {
      return this.cacheHospitalMasters;
    }
    const list = await getAllHospitalMasterRecords();
    if (list.length === 0) {
      this.cacheHospitalMasters = [];
    } else {
      // Check if any hospital records are missing erpHospitalUnitCode and backfill them
      const sampleMap = new Map(generateSampleHospitalMasters().map(s => [s.hospitalCode.toUpperCase(), s.erpHospitalUnitCode]));
      let hasMissing = false;
      const updatedList = list.map((h, idx) => {
        if (!h.erpHospitalUnitCode) {
          hasMissing = true;
          const sampleCode = sampleMap.get(h.hospitalCode.toUpperCase());
          const code = sampleCode || String(idx + 1).padStart(4, '0');
          return { ...h, erpHospitalUnitCode: code };
        }
        return h;
      });

      if (hasMissing) {
        await saveHospitalMasterRecords(updatedList);
        this.cacheHospitalMasters = updatedList;
      } else {
        this.cacheHospitalMasters = list;
      }
    }
    this.isHospitalLoaded = true;
    return this.cacheHospitalMasters;
  }

  async saveHospitalMasters(records: HospitalMasterRecord[]): Promise<HospitalMasterRecord[]> {
    await saveHospitalMasterRecords(records);
    this.cacheHospitalMasters = await getAllHospitalMasterRecords();
    return this.cacheHospitalMasters;
  }

  async resetHospitalMasters(): Promise<HospitalMasterRecord[]> {
    await clearHospitalMasterRecords();
    this.cacheHospitalMasters = [];
    this.isHospitalLoaded = true;
    return this.cacheHospitalMasters;
  }

  async getVendorMasters(): Promise<VendorMasterRecord[]> {
    if (this.isVendorLoaded && this.cacheVendorMasters.length > 0) {
      return this.cacheVendorMasters;
    }
    const list = await getAllVendorMasterRecords();
    if (list.length === 0) {
      this.cacheVendorMasters = [];
    } else {
      this.cacheVendorMasters = list;
    }
    this.isVendorLoaded = true;
    return this.cacheVendorMasters;
  }

  async saveVendorMasters(records: VendorMasterRecord[]): Promise<VendorMasterRecord[]> {
    await saveVendorMasterRecords(records);
    this.cacheVendorMasters = await getAllVendorMasterRecords();
    return this.cacheVendorMasters;
  }

  async resetVendorMasters(): Promise<VendorMasterRecord[]> {
    await clearVendorMasterRecords();
    this.cacheVendorMasters = [];
    this.isVendorLoaded = true;
    return this.cacheVendorMasters;
  }

  // PR (Purchase Requisition) & Requester Methods
  async getPrRecords(): Promise<PurchaseRequisitionRecord[]> {
    if (this.isPrLoaded && this.cachePrRecords.length > 0) {
      return this.cachePrRecords;
    }
    const list = await getAllPrRecords();
    if (list.length === 0) {
      // ONLY load sample PRs if we are in initial demo/sample state.
      // NEVER fabricate fake PR records if real procurement records are loaded!
      const isSampleOrEmpty = this.cacheRecords.length === 0 || this.cacheRecords.every(r => r.id.startsWith('sample-'));
      if (isSampleOrEmpty && this.cacheRecords.length > 0) {
        const sample = generateSamplePrRecords(this.cacheRecords);
        await savePrRecords(sample);
        this.cachePrRecords = sample;
      } else {
        this.cachePrRecords = [];
      }
    } else {
      this.cachePrRecords = list;
    }
    this.isPrLoaded = true;
    return this.cachePrRecords;
  }

  async savePrRecords(records: PurchaseRequisitionRecord[]): Promise<PurchaseRequisitionRecord[]> {
    await savePrRecords(records);
    this.cachePrRecords = await getAllPrRecords();
    // Re-enrich cached records
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithPrData(this.cacheRecords, this.cachePrRecords, this.cacheUserDepartmentMappings);
      await saveSpendRecords(this.cacheRecords);
    }
    return this.cachePrRecords;
  }

  async addPrBatch(
    newPrs: PurchaseRequisitionRecord[], 
    harvestedUsers: UserDepartmentMappingRecord[] = [],
    fileName: string = 'Summary_PR_Requisitions.xlsx'
  ): Promise<{ addedPrCount: number; addedUserCount: number; pairedCount: number }> {
    const currentPrs = await this.getPrRecords();
    const currentUsers = await this.getUserDepartmentMappings();

    // Merge PRs by purchaseReqId
    const prMap = new Map<string, PurchaseRequisitionRecord>();
    currentPrs.forEach(p => prMap.set(p.purchaseReqId, p));
    newPrs.forEach(p => prMap.set(p.purchaseReqId, p));
    const mergedPrs = Array.from(prMap.values());
    await savePrRecords(mergedPrs);
    this.cachePrRecords = mergedPrs;

    // Merge Users
    const userMap = new Map<string, UserDepartmentMappingRecord>();
    currentUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));
    harvestedUsers.forEach(u => {
      if (!userMap.has(u.username.toLowerCase())) {
        userMap.set(u.username.toLowerCase(), u);
      }
    });
    const mergedUsers = Array.from(userMap.values());
    await saveUserDepartmentMappings(mergedUsers);
    this.cacheUserDepartmentMappings = mergedUsers;

    // Record as transaction ingestion batch in UploadedBatchMeta (Summary PR)
    const totalPrAmount = newPrs.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
    const uniqueUnits = Array.from(new Set(newPrs.map(p => p.unit).filter(Boolean)));
    await saveUploadedFileInfo({
      id: `pr-batch-${Date.now()}`,
      fileName: fileName,
      fileType: 'summary_pr',
      uploadedAt: new Date().toISOString(),
      recordCount: newPrs.length,
      totalValue: totalPrAmount,
      totalQty: newPrs.length
    });

    // Re-enrich cached spend records
    let pairedCount = 0;
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithPrData(this.cacheRecords, this.cachePrRecords, this.cacheUserDepartmentMappings);
      await saveSpendRecords(this.cacheRecords);
      pairedCount = this.cacheRecords.filter(r => Boolean(r.purchaseReqId)).length;
    }

    // Auto-sync clean department registry with newly ingested PRs and harvested users in background
    this.scheduleBackgroundDepartmentCompilation(this.cacheRecords);

    return {
      addedPrCount: newPrs.length,
      addedUserCount: harvestedUsers.length,
      pairedCount,
    };
  }

  async resetPrRecords(): Promise<PurchaseRequisitionRecord[]> {
    await clearPrRecords();
    this.cachePrRecords = [];
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithPrData(this.cacheRecords, this.cachePrRecords, this.cacheUserDepartmentMappings);
      await saveSpendRecords(this.cacheRecords);
    }
    return this.cachePrRecords;
  }

  // User to Department Master Mapping Methods
  async getUserDepartmentMappings(): Promise<UserDepartmentMappingRecord[]> {
    if (this.isUserDeptLoaded && this.cacheUserDepartmentMappings.length > 0) {
      return this.cacheUserDepartmentMappings;
    }
    const list = await getAllUserDepartmentMappings();
    if (list.length === 0) {
      const isSampleOrEmpty = this.cacheRecords.length === 0 || this.cacheRecords.every(r => r.id.startsWith('sample-'));
      if (isSampleOrEmpty && this.cacheRecords.length > 0) {
        const sample = generateSampleUserDepartmentMappings();
        await saveUserDepartmentMappings(sample);
        this.cacheUserDepartmentMappings = sample;
      } else {
        this.cacheUserDepartmentMappings = [];
      }
    } else {
      this.cacheUserDepartmentMappings = list;
    }
    this.isUserDeptLoaded = true;
    return this.cacheUserDepartmentMappings;
  }

  async saveUserDepartmentMappings(mappings: UserDepartmentMappingRecord[]): Promise<UserDepartmentMappingRecord[]> {
    await saveUserDepartmentMappings(mappings);
    this.cacheUserDepartmentMappings = await getAllUserDepartmentMappings();
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithPrData(this.cacheRecords, this.cachePrRecords, this.cacheUserDepartmentMappings);
      await saveSpendRecords(this.cacheRecords);
    }
    return this.cacheUserDepartmentMappings;
  }

  async saveSingleUserDepartmentMapping(mapping: UserDepartmentMappingRecord): Promise<void> {
    await saveSingleUserDepartmentMapping(mapping);
    this.cacheUserDepartmentMappings = await getAllUserDepartmentMappings();
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithPrData(this.cacheRecords, this.cachePrRecords, this.cacheUserDepartmentMappings);
      await saveSpendRecords(this.cacheRecords);
    }
  }

  async deleteUserDepartmentMapping(id: string): Promise<void> {
    await deleteUserDepartmentMapping(id);
    this.cacheUserDepartmentMappings = await getAllUserDepartmentMappings();
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithPrData(this.cacheRecords, this.cachePrRecords, this.cacheUserDepartmentMappings);
      await saveSpendRecords(this.cacheRecords);
    }
  }

  async resetUserDepartmentMappings(): Promise<UserDepartmentMappingRecord[]> {
    await clearUserDepartmentMappings();
    this.cacheUserDepartmentMappings = [];
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithPrData(this.cacheRecords, this.cachePrRecords, this.cacheUserDepartmentMappings);
      await saveSpendRecords(this.cacheRecords);
    }
    return this.cacheUserDepartmentMappings;
  }

  // =========================================================================
  // Clean Department Master Directory & AI Reference Methods
  // =========================================================================

  /**
   * Retrieves clean department master records from persistent IndexedDB.
   * Instantaneous O(1) read without freezing the UI thread.
   */
  async getDepartmentMasters(): Promise<DepartmentMasterRecord[]> {
    if (this.isDepartmentLoaded && this.cacheDepartmentMasters.length > 0) {
      return this.cacheDepartmentMasters;
    }

    const storedMasters = await getAllDepartmentMasters();
    if (storedMasters.length > 0) {
      this.cacheDepartmentMasters = storedMasters;
      this.isDepartmentLoaded = true;
      return this.cacheDepartmentMasters;
    }

    // First time initialization: trigger non-blocking background Web Worker compilation
    const records = this.cacheRecords.length > 0 ? this.cacheRecords : await getAllSpendRecords();
    if (records.length > 0) {
      this.scheduleBackgroundDepartmentCompilation(records);
    }

    this.isDepartmentLoaded = true;
    return this.cacheDepartmentMasters;
  }

  /**
   * Saves updated clean department master records to IndexedDB and cache.
   */
  async saveDepartmentMasters(records: DepartmentMasterRecord[]): Promise<DepartmentMasterRecord[]> {
    await saveDepartmentMasters(records);
    this.cacheDepartmentMasters = records;
    return this.cacheDepartmentMasters;
  }

  /**
   * Adds or updates a single clean department master record.
   */
  async saveSingleDepartmentMaster(record: DepartmentMasterRecord): Promise<DepartmentMasterRecord[]> {
    await saveSingleDepartmentMaster(record);
    const stored = await getAllDepartmentMasters();
    this.cacheDepartmentMasters = stored;
    return this.cacheDepartmentMasters;
  }

  /**
   * Deletes a department master record.
   */
  async deleteDepartmentMaster(id: string): Promise<DepartmentMasterRecord[]> {
    await deleteDepartmentMaster(id);
    const stored = await getAllDepartmentMasters();
    this.cacheDepartmentMasters = stored;
    return this.cacheDepartmentMasters;
  }

  /**
   * Resets department master records back to default standard Siloam registry.
   */
  async resetDepartmentMasters(): Promise<DepartmentMasterRecord[]> {
    await clearDepartmentMasters();
    this.cacheDepartmentMasters = [];
    this.isDepartmentLoaded = true;
    return this.cacheDepartmentMasters;
  }

  /**
   * Scans dataset to discover raw department variations and maps them against clean department masters.
   * Fully offloaded to background Web Worker to prevent "Page Unresponsive" browser freeze!
   */
  async discoverAndSyncDepartments(recordsToScan?: SpendRecord[]): Promise<{
    masters: DepartmentMasterRecord[];
    unmapped: RawDepartmentDiscoveryItem[];
  }> {
    const records = recordsToScan || (this.cacheRecords.length > 0 ? this.cacheRecords : await getAllSpendRecords());
    const stored = await getAllDepartmentMasters();
    const prs = await this.getPrRecords();
    const userMappings = await this.getUserDepartmentMappings();

    const result = await backgroundJobManager.runDepartmentCompilationJob(records, prs, userMappings, stored);
    this.cacheDepartmentMasters = result.masters;
    this.isDepartmentLoaded = true;

    return result;
  }

  /**
   * Schedules background Web Worker compilation without blocking caller thread,
   * ideal for upload completion and background syncing.
   */
  scheduleBackgroundDepartmentCompilation(recordsToScan?: SpendRecord[]): void {
    const records = recordsToScan || (this.cacheRecords.length > 0 ? this.cacheRecords : []);
    Promise.all([
      getAllDepartmentMasters(),
      this.getPrRecords(),
      this.getUserDepartmentMappings()
    ]).then(([stored, prs, userMappings]) => {
      backgroundJobManager.runDepartmentCompilationJob(records, prs, userMappings, stored).then(result => {
        this.cacheDepartmentMasters = result.masters;
      }).catch(err => {
        console.warn('[SpendService] Background department compilation error:', err);
      });
    }).catch(err => {
      console.warn('[SpendService] Error initiating background department compilation:', err);
    });
  }

  /**
   * Fetches latest persistent discovery cache from IndexedDB
   */
  async getDepartmentDiscoveryCache(): Promise<DepartmentDiscoveryCacheRecord | undefined> {
    return getDepartmentDiscoveryCache('latest_discovery');
  }

  /**
   * Returns a fast in-memory index for AI queries to match departments and aliases
   */
  async getCleanDepartmentIndex(): Promise<{
    cleanNames: string[];
    aliasMap: Map<string, string>;
    activeRecords: DepartmentMasterRecord[];
  }> {
    const masters = await this.getDepartmentMasters();
    const activeRecords = masters.filter(m => m.isActive && m.isAiReference);
    const cleanNames = activeRecords.map(m => m.cleanDepartmentName);
    const aliasMap = new Map<string, string>();

    for (const m of activeRecords) {
      const canonical = m.cleanDepartmentName;
      aliasMap.set(canonical.toLowerCase(), canonical);
      aliasMap.set(m.departmentCode.toLowerCase(), canonical);
      for (const alias of m.rawAliases) {
        aliasMap.set(alias.toLowerCase(), canonical);
      }
    }

    return {
      cleanNames,
      aliasMap,
      activeRecords
    };
  }


  /**
   * Enriches spend records with PR requisitions and user department mappings
   * Supports Dual-Key VLOOKUP:
   * 1. 'PO' prefix in ERP ID -> pairs to PURCHID
   * 2. 'PRQ' prefix in ERP ID -> pairs to MIIREFERENCEREQNUM (or purchReqName)
   * 3. Full metadata enrichment: requester, department, costCenter, prSubject, prCategoryType, prDocumentStatus, prPairingKeyType
   */
  enrichRecordsWithPrData(
    records: SpendRecord[],
    prs: PurchaseRequisitionRecord[],
    userMappings: UserDepartmentMappingRecord[]
  ): SpendRecord[] {
    if (!records || records.length === 0) return [];
    
    // Exact token normalizers
    const cleanKey = (s: string | undefined | null) => (s || '').trim().toUpperCase();
    const cleanAlphaNum = (s: string | undefined | null) => (s || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

    // 1. Build Strict Indices
    const prByReqId = new Map<string, PurchaseRequisitionRecord>();
    const prByReqIdAlpha = new Map<string, PurchaseRequisitionRecord>();
    const prByPoToken = new Map<string, PurchaseRequisitionRecord>();
    const prByPoTokenAlpha = new Map<string, PurchaseRequisitionRecord>();
    const prByPrqToken = new Map<string, PurchaseRequisitionRecord>();
    const prByPrqTokenAlpha = new Map<string, PurchaseRequisitionRecord>();

    (prs || []).forEach(p => {
      // Primary PR identifier (purchaseReqId / id)
      const primaryReq = cleanKey(p.purchaseReqId || p.id);
      if (primaryReq) {
        prByReqId.set(primaryReq, p);
        const reqAlpha = cleanAlphaNum(primaryReq);
        if (reqAlpha.length >= 6) {
          prByReqIdAlpha.set(reqAlpha, p);
        }
      }

      // Direct purchId property on PR
      if (p.purchId) {
        const directPo = cleanKey(p.purchId);
        prByPoToken.set(directPo, p);
        const poAlpha = cleanAlphaNum(directPo);
        if (poAlpha.length >= 6) {
          prByPoTokenAlpha.set(poAlpha, p);
        }
      }

      // ERP ID tokens (e.g. "PO-0000-260100001,PO-0000-260100002" or "PRQ-2601-0003644")
      if (p.erpId) {
        const tokens = p.erpId.split(/[,;\s]+/).map(t => cleanKey(t)).filter(Boolean);
        tokens.forEach(token => {
          const tokenAlpha = cleanAlphaNum(token);

          if (token.startsWith('PRQ')) {
            prByPrqToken.set(token, p);
            if (tokenAlpha.length >= 6) prByPrqTokenAlpha.set(tokenAlpha, p);
          } else if (token.startsWith('PO')) {
            prByPoToken.set(token, p);
            if (tokenAlpha.length >= 6) prByPoTokenAlpha.set(tokenAlpha, p);
          } else {
            // General token
            prByPoToken.set(token, p);
            if (tokenAlpha.length >= 6) prByPoTokenAlpha.set(tokenAlpha, p);
          }
        });
      }
    });

    // 2. Map Username to UserDepartmentMappingRecord
    const userMap = new Map<string, UserDepartmentMappingRecord>();
    (userMappings || []).forEach(u => {
      if (u.username) {
        userMap.set(cleanKey(u.username), u);
      }
    });

    return records.map((r) => {
      const pId = cleanKey(r.purchId);
      const pIdAlpha = cleanAlphaNum(r.purchId);
      const miiRef = cleanKey(r.miiReferenceReqNum || r.purchReqName);
      const miiRefAlpha = cleanAlphaNum(r.miiReferenceReqNum || r.purchReqName);

      let matchedPr: PurchaseRequisitionRecord | undefined = undefined;
      let pairingKeyType: 'PO' | 'PRQ' | 'UNPAIRED' = 'UNPAIRED';

      // 1. EXACT PRQ Matching via PR Document ID or PRQ token
      if (miiRef) {
        matchedPr = prByReqId.get(miiRef) || prByPrqToken.get(miiRef);
        if (!matchedPr && miiRefAlpha.length >= 6) {
          matchedPr = prByReqIdAlpha.get(miiRefAlpha) || prByPrqTokenAlpha.get(miiRefAlpha);
        }
        if (matchedPr) {
          pairingKeyType = 'PRQ';
        }
      }

      // 2. EXACT PO Matching via PURCHID
      if (!matchedPr && pId) {
        matchedPr = prByPoToken.get(pId);
        if (!matchedPr && pIdAlpha.length >= 6) {
          matchedPr = prByPoTokenAlpha.get(pIdAlpha);
        }
        if (matchedPr) {
          pairingKeyType = 'PO';
        }
      }

      // 3. STRICT NO-FALLBACK: If not matched, do NOT fabricate or guess. Mark strictly as UNPAIRED, but retain direct CPR/PO fields if present.
      if (!matchedPr) {
        return {
          ...r,
          prPairingKeyType: r.prPairingKeyType || 'UNPAIRED',
          purchaseReqId: r.purchaseReqId || undefined,
          requester: r.requester || undefined,
          requesterName: r.requesterName || undefined,
          department: r.department || undefined,
          costCenter: r.costCenter || undefined,
          prSubject: r.prSubject || undefined,
          prCategoryType: r.prCategoryType || undefined,
          prDocumentStatus: r.prDocumentStatus || undefined
        };
      }

      // If strictly matched, enrich with verified metadata
      const username = cleanKey(matchedPr.requester);
      const userMapping = userMap.get(username);

      const deptName = userMapping?.department 
        || (matchedPr.description 
            ? matchedPr.description.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') 
            : 'Unassigned Department');
      
      const fullName = userMapping?.fullName 
        || (username 
            ? username.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') 
            : 'System Requester');

      return {
        ...r,
        purchaseReqId: matchedPr.purchaseReqId,
        requester: matchedPr.requester,
        requesterName: fullName,
        department: deptName,
        costCenter: userMapping?.costCenter || matchedPr.costCenter || '0001',
        prSubject: matchedPr.subject || 'Pengadaan Operasional Unit',
        prCategoryType: matchedPr.categoryType,
        prDocumentStatus: matchedPr.documentStatus,
        prPairingKeyType: pairingKeyType,
        miiReferenceReqNum: r.miiReferenceReqNum || (pairingKeyType === 'PRQ' ? matchedPr.erpId : r.purchReqName)
      };
    });
  }

  deduplicateSkuList(skus: SkuMasterRecord[]): SkuMasterRecord[] {
    if (!Array.isArray(skus) || skus.length === 0) return [];
    const map = new Map<string, SkuMasterRecord>();

    for (const item of skus) {
      if (!item) continue;
      // Key index: clean normalized productId, fallback to normalized name or id
      const cleanProductId = (item.productId || '').trim();
      const rawKey = cleanProductId ? cleanProductId.toLowerCase() : (item.name ? item.name.trim().toLowerCase() : item.id);
      if (!rawKey) continue;

      const safeId = cleanProductId
        ? `sku-${cleanProductId.toLowerCase().replace(/[^a-z0-9_\-]/g, '_')}`
        : item.id;

      const existing = map.get(rawKey);
      if (!existing) {
        map.set(rawKey, {
          ...item,
          id: safeId,
          formattedSkuName: item.formattedSkuName || getFormattedSkuName(item)
        });
      } else {
        // Resolve conflict between duplicates:
        const existingIsSample = existing.id.startsWith('sku-sample-') || existing.id.startsWith('sku-1-') || existing.id.startsWith('sku-2-') || existing.id.startsWith('sku-3-') || existing.id.startsWith('sku-4-') || existing.id.startsWith('sku-5-');
        const itemIsSample = item.id.startsWith('sku-sample-') || item.id.startsWith('sku-1-') || item.id.startsWith('sku-2-') || item.id.startsWith('sku-3-') || item.id.startsWith('sku-4-') || item.id.startsWith('sku-5-');

        // Rule 1: Real user upload always replaces demo sample item
        if (existingIsSample && !itemIsSample) {
          map.set(rawKey, {
            ...item,
            id: safeId,
            formattedSkuName: item.formattedSkuName || getFormattedSkuName(item)
          });
        } else if (!existingIsSample && itemIsSample) {
          // Keep existing real item
          continue;
        } else {
          // Rule 2: Pick the richer/more complete record
          const existingPrice = Number(existing.standardPrice) || 0;
          const itemPrice = Number(item.standardPrice) || 0;

          let existingScore = 0;
          let itemScore = 0;

          if (existingPrice > 1) existingScore += 10;
          if (itemPrice > 1) itemScore += 10;

          if (existing.purchCategoryLv1 && existing.purchCategoryLv1 !== 'GENERAL') existingScore += 5;
          if (item.purchCategoryLv1 && item.purchCategoryLv1 !== 'GENERAL') itemScore += 5;

          if (existing.brand && existing.brand !== 'GENERIC') existingScore += 3;
          if (item.brand && item.brand !== 'GENERIC') itemScore += 3;

          if (existing.specification1 && existing.specification1 !== '-') existingScore += 2;
          if (item.specification1 && item.specification1 !== '-') itemScore += 2;

          if (itemScore >= existingScore) {
            map.set(rawKey, {
              ...item,
              id: safeId,
              formattedSkuName: item.formattedSkuName || getFormattedSkuName(item)
            });
          }
        }
      }
    }

    return Array.from(map.values());
  }

  async deduplicateDatabaseSkus(): Promise<SkuMasterRecord[]> {
    const allSkus = await getAllSkuMasterRecords();
    const cleanList = this.deduplicateSkuList(allSkus);
    await clearSkuMasterRecords();
    await clearSkuMappingCache();
    this.skuMappingCacheMap.clear();
    await saveSkuMasterRecords(cleanList);
    this.cacheSkuMasters = cleanList;

    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithSkuMapping(this.cacheRecords, this.cacheSkuMasters);
      await saveSpendRecords(this.cacheRecords);
    }
    return this.cacheSkuMasters;
  }

  async getSkuMasters(): Promise<SkuMasterRecord[]> {
    if (this.isSkuLoaded && this.cacheSkuMasters.length > 0) {
      return this.cacheSkuMasters;
    }
    const skus = await getAllSkuMasterRecords();
    if (skus.length === 0) {
      this.cacheSkuMasters = [];
    } else {
      const deduplicated = this.deduplicateSkuList(skus);
      if (deduplicated.length !== skus.length) {
        console.log(`[SpendService] Auto-deduplicating SKU Master DB in getSkuMasters: from ${skus.length} down to ${deduplicated.length} unique SKUs.`);
        await clearSkuMasterRecords();
        await clearSkuMappingCache();
        this.skuMappingCacheMap.clear();
        await saveSkuMasterRecords(deduplicated);
        this.cacheSkuMasters = deduplicated;
      } else {
        this.cacheSkuMasters = skus;
      }
    }
    this.isSkuLoaded = true;
    return this.cacheSkuMasters;
  }

  async addSkuMasters(records: SkuMasterRecord[], options?: { replaceAll?: boolean }): Promise<SkuMasterRecord[]> {
    const formatted = records.map(r => ({
      ...r,
      formattedSkuName: getFormattedSkuName(r)
    }));

    if (options?.replaceAll) {
      await clearSkuMappingCache();
      this.skuMappingCacheMap.clear();
    }

    const existing = options?.replaceAll 
      ? [] 
      : (this.cacheSkuMasters.length > 0 ? this.cacheSkuMasters : await getAllSkuMasterRecords());

    // Discard default sample items if real user records are being added
    const sampleProductIds = new Set(generateSampleSkuRecords().map(s => s.productId.toLowerCase().trim()));
    const isIncomingRealData = records.some(r => r.productId && !sampleProductIds.has(r.productId.toLowerCase().trim()));

    const filteredExisting = isIncomingRealData
      ? existing.filter(e => !e.id.startsWith('sku-sample-') && !sampleProductIds.has((e.productId || '').toLowerCase().trim()))
      : existing;

    const merged = [...filteredExisting, ...formatted];
    const deduplicated = this.deduplicateSkuList(merged);

    await clearSkuMasterRecords();
    await saveSkuMasterRecords(deduplicated);
    this.cacheSkuMasters = deduplicated;
    
    // Re-enrich cached records with new clean SKU master definitions
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithSkuMapping(this.cacheRecords, this.cacheSkuMasters);
      await saveSpendRecords(this.cacheRecords);
    }
    
    return this.cacheSkuMasters;
  }

  async resetSkuMasters(): Promise<SkuMasterRecord[]> {
    await clearSkuMasterRecords();
    await clearSkuMappingCache();
    this.skuMappingCacheMap.clear();
    this.cacheSkuMasters = [];
    this.isSkuLoaded = true;
    if (this.cacheRecords.length > 0) {
      this.cacheRecords = this.enrichRecordsWithSkuMapping(this.cacheRecords, this.cacheSkuMasters);
      await saveSpendRecords(this.cacheRecords);
    }
    return this.cacheSkuMasters;
  }

  public async scheduleWorkerSkuMapping(
    itemsToMap: { rawItemName: string; itemKey: string }[],
    skuMasters: SkuMasterRecord[]
  ) {
    if (this.pendingWorkerMapping || itemsToMap.length === 0) return;
    this.pendingWorkerMapping = true;
    try {
      const mappings = await backgroundJobManager.runSkuMappingJob(itemsToMap, skuMasters);
      if (mappings && mappings.length > 0) {
        for (const m of mappings) {
          if (m && m.itemKey) {
            this.skuMappingCacheMap.set(m.itemKey, m);
          }
        }
        if (this.cacheRecords.length > 0) {
          this.cacheRecords = this.enrichRecordsWithSkuMapping(this.cacheRecords, skuMasters);
          await saveSpendRecords(this.cacheRecords);
          backgroundJobManager.startFullStaging(
            this.cacheRecords,
            this.cacheSkuMasters,
            this.cacheHospitalMasters,
            this.cacheVendorMasters
          );
        }
      }
    } catch (err) {
      console.warn('[SpendService] scheduleWorkerSkuMapping failed:', err);
    } finally {
      this.pendingWorkerMapping = false;
    }
  }

  enrichRecordsWithSkuMapping(records: SpendRecord[] = [], skuMasters: SkuMasterRecord[] = []): SpendRecord[] {
    if (!Array.isArray(records) || records.length === 0) return [];
    if (!Array.isArray(skuMasters) || skuMasters.length === 0) {
      return records.filter(Boolean).map(r => {
        const decomp = decomposeSkuString(r.itemName);
        const poCategory = (r.procurementCategory || r.mappedCategory || decomp.commodityItem || 'General Supplies').trim();
        return {
          ...r,
          commodityItem: decomp.commodityItem,
          generalSpec: decomp.generalSpec,
          brand: decomp.brand,
          partNumber: decomp.partNumber,
          orphanStatus: 'FULL_ORPHAN',
          orphanConfidenceScore: 0,
          orphanMatchReason: 'Belum ada Master SKU terdaftar',
          taxonomyLv1: 'UNMAPPED / ORPHAN PO',
          taxonomyLv2: poCategory,
          taxonomyLv3: poCategory,
          taxonomyLv4: poCategory,
          taxonomyLv5: decomp.commodityItem || r.itemName
        };
      });
    }

    // Build O(1) Hash Maps for ultra-fast lookup across tens of thousands of records
    const byIdMap = new Map<string, SkuMasterRecord>();
    const byExactNameMap = new Map<string, SkuMasterRecord>();
    const bySkuCodeMap = new Map<string, SkuMasterRecord>();
    const byCommodityMap = new Map<string, SkuMasterRecord[]>();

    for (const sku of skuMasters) {
      if (!sku) continue;
      if (sku.id) byIdMap.set(sku.id, sku);
      if (sku.productId) bySkuCodeMap.set(sku.productId.toLowerCase().trim(), sku);
      if (sku.id) bySkuCodeMap.set(sku.id.toLowerCase().trim(), sku);
      if (sku.prItemId) bySkuCodeMap.set(sku.prItemId.toLowerCase().trim(), sku);
      if (sku.cprItemId) bySkuCodeMap.set(sku.cprItemId.toLowerCase().trim(), sku);
      if (sku.spItemId) bySkuCodeMap.set(sku.spItemId.toLowerCase().trim(), sku);
      if (sku.partNumber) bySkuCodeMap.set(sku.partNumber.toLowerCase().trim(), sku);

      // NOTE: itemId / product code dari PO TIDAK DIGUNAKAN karena itemId di PO adalah grouping finance spending, bukan master SKU.
      if (sku.name) byExactNameMap.set(sku.name.toLowerCase().trim(), sku);
      if (sku.formattedSkuName) byExactNameMap.set(sku.formattedSkuName.toLowerCase().trim(), sku);
      
      // Index canonical normalized SKU syntax (mengabaikan perbedaan spasi dan slot NA '-' atau '.' pada 3-slot spec)
      const normSkuName = normalizeSkuSyntax(sku.name);
      if (normSkuName) byExactNameMap.set(normSkuName, sku);
      const normFormatted = normalizeSkuSyntax(sku.formattedSkuName);
      if (normFormatted) byExactNameMap.set(normFormatted, sku);

      // Index synthesized syntax dari komponen-komponen terstruktur
      const synthSyntax = normalizeSkuSyntax(
        `${sku.commodityItem || sku.name};${sku.specification1 || sku.generalSpec || ''};${sku.brand || ''};${sku.partNumber || ''}`
      );
      if (synthSyntax) byExactNameMap.set(synthSyntax, sku);

      // Commodity (Level 5) indexing for partial match
      const skuDecomp = decomposeSkuString(sku.formattedSkuName || sku.name);
      const commKey = (sku.commodityItem || skuDecomp.commodityItem || sku.name || '').replace(/\s+/g, ' ').toLowerCase().trim();
      if (commKey) {
        let list = byCommodityMap.get(commKey);
        if (!list) {
          list = [];
          byCommodityMap.set(commKey, list);
        }
        list.push(sku);
      }
    }

    const unmappedItemsToWorkerMap = new Map<string, { rawItemName: string; itemKey: string }>();
    const newCacheEntriesToSave: SkuMappingCacheRecord[] = [];

    const mappedRecords: SpendRecord[] = records.filter(Boolean).map((r): SpendRecord => {
      // 0. Clean item name by stripping notes written on new lines and extracting ::skuCode if present
      const rawTarget = r.rawItemName || r.itemName || '';
      const itemKey = rawTarget.trim().toLowerCase();
      const { itemName: cleanItemName, itemNotes: extractedNotes, extractedSkuCode } = splitItemNameAndNotes(rawTarget);
      const poSkuCode = (r.extractedSkuCode || extractedSkuCode || '').trim();
      const primaryItemName = (cleanItemName || r.itemName || '').trim();
      const itemNotes = r.itemNotes || extractedNotes;

      // FAST PATH 1: Cek Persistent IndexedDB SKU Mapping Cache (O(1) Instant hit)
      if (itemKey && this.skuMappingCacheMap.has(itemKey)) {
        const cached = this.skuMappingCacheMap.get(itemKey)!;
        const txDecomp = decomposeSkuString(primaryItemName);
        const poCategory = (r.procurementCategory || r.mappedCategory || txDecomp.commodityItem || 'General Supplies').trim();
        const tier = cached.matchTier || (cached.orphanStatus === 'EXACT_MATCH' ? 'FUZZY_HIGH' : (cached.orphanStatus === 'PARTIAL_ORPHAN' ? 'PARTIAL_ORPHAN' : 'FULL_ORPHAN'));
        return {
          ...r,
          itemName: primaryItemName,
          itemNotes: r.itemNotes || itemNotes,
          extractedSkuCode: poSkuCode || undefined,
          skuMasterId: cached.matchedSkuId || undefined,
          matchTier: tier,
          commodityItem: cached.taxonomy?.taxonomyLv5 || txDecomp.commodityItem || primaryItemName,
          generalSpec: cached.taxonomy?.spec || normalizeSpecString(txDecomp.generalSpec || txDecomp.rawSpec),
          brand: cached.taxonomy?.brand || (txDecomp.brand || '').trim(),
          partNumber: cached.taxonomy?.partNumber || (txDecomp.partNumber || '').trim(),
          orphanStatus: (cached.orphanStatus as 'EXACT_MATCH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN') || 'FULL_ORPHAN',
          orphanConfidenceScore: cached.confidenceScore,
          orphanMatchReason: cached.matchReason,
          taxonomyLv1: cached.taxonomy?.taxonomyLv1 || 'UNMAPPED / ORPHAN PO',
          taxonomyLv2: cached.taxonomy?.taxonomyLv2 || poCategory,
          taxonomyLv3: cached.taxonomy?.taxonomyLv3 || poCategory,
          taxonomyLv4: cached.taxonomy?.taxonomyLv4 || poCategory,
          taxonomyLv5: cached.taxonomy?.taxonomyLv5 || txDecomp.commodityItem || primaryItemName
        };
      }

      // Decompose transaction primary item name (trimming whitespace around semicolons and slots)
      const txDecomp = decomposeSkuString(primaryItemName);
      const txCommodity = txDecomp.commodityItem.replace(/\s+/g, ' ').trim();
      const txSpec = normalizeSpecString(txDecomp.generalSpec || txDecomp.rawSpec);
      const txBrand = (txDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
      const txPartNumber = (txDecomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

      let matched: SkuMasterRecord | null = null;
      let bestCandidate: SkuMasterRecord | null = null;
      let orphanStatus: 'EXACT_MATCH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' = 'FULL_ORPHAN';
      let matchTier: SpendRecord['matchTier'] = undefined;
      let confidenceScore = 0;
      let matchReason = '';

      // TAHAP 1 (PRIORITAS PERTAMA): Ekstraksi Kode Master SKU dari nama item transaksi PO (setelah segmen "::")
      if (poSkuCode) {
        const codeKey = poSkuCode.toLowerCase();
        if (bySkuCodeMap.has(codeKey)) {
          matched = bySkuCodeMap.get(codeKey)!;
          orphanStatus = 'EXACT_MATCH';
          matchTier = 'DIRECT_CODE';
          confidenceScore = 100;
          matchReason = `Kecocokan Langsung Kode SKU Master (::${poSkuCode}) dari Item Name dengan Master SKU (${matched.productId || matched.name})`;
        }
      }

      // TAHAP 2: Direct ID check (only valid if name matches or manually reconciled)
      if (!matched && r.skuMasterId && byIdMap.has(r.skuMasterId)) {
        const candidate = byIdMap.get(r.skuMasterId)!;
        const candName = (candidate.name || '').toLowerCase().trim();
        const candFormatted = (candidate.formattedSkuName || '').toLowerCase().trim();
        const targetClean = primaryItemName.toLowerCase();
        const targetNorm = normalizeSkuSyntax(primaryItemName);
        const candNorm = normalizeSkuSyntax(candidate.formattedSkuName || candidate.name);

        if (
          candName === targetClean ||
          candFormatted === targetClean ||
          (targetNorm && targetNorm === candNorm) ||
          (r.orphanMatchReason && r.orphanMatchReason.includes('Manual'))
        ) {
          matched = candidate;
          orphanStatus = 'EXACT_MATCH';
          matchTier = r.matchTier || 'DIRECT_ID';
          confidenceScore = 100;
          matchReason = r.orphanMatchReason || 'Cocok langsung dengan Master SKU';
        }
      }

      // TAHAP 3: Exact Full Name Match O(1) (setelah komponen Note di line baru, ::code dibuang, dan format 3-slot spesifikasi dinormalisasi)
      if (!matched && primaryItemName) {
        const cleanName = primaryItemName.toLowerCase();
        const normName = normalizeSkuSyntax(primaryItemName);
        if (byExactNameMap.has(cleanName)) {
          matched = byExactNameMap.get(cleanName)!;
          orphanStatus = 'EXACT_MATCH';
          matchTier = 'EXACT_SYNTAX';
          confidenceScore = 100;
          matchReason = 'Nama SKU transaksi (tanpa Note) identik dengan Master SKU';
        } else if (normName && byExactNameMap.has(normName)) {
          matched = byExactNameMap.get(normName)!;
          orphanStatus = 'EXACT_MATCH';
          matchTier = 'EXACT_SYNTAX';
          confidenceScore = 100;
          matchReason = 'Nama SKU transaksi identik dengan Master SKU (format 3-slot spesifikasi dinormalisasi)';
        }
      }

      // TAHAP 4: Component-based matching using decomposition: Commodity (50%), Spec 3-Slot (30%), Brand (10%), Part# (10%)
      if (!matched) {
        const commClean = txCommodity.toLowerCase().trim();
        const candidateSkus = commClean ? (byCommodityMap.get(commClean) || []) : [];
        let bestScore = 0;
        let bestReason = '';

        if (candidateSkus.length > 0) {
          for (const cand of candidateSkus) {
            let score = 50; // Commodity matches = 50%
            let reasonParts = ['Komoditas cocok (50%)'];

            const candDecomp = decomposeSkuString(cand.formattedSkuName || cand.name);
            const candSpec = normalizeSpecString(cand.generalSpec || candDecomp.generalSpec || cand.specification1);
            const candBrand = (cand.brand || candDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
            const candPart = (cand.partNumber || candDecomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

            // Spec matching (30%):
            // - Jika ada spec: cocok jika string spec sama (misal "XS" vs "XS,-,-" -> keduanya ternormalisasi menjadi "xs")
            // - Atau slot per slot sama (dengan slot kosong/'-'/'.' ternormalisasi menjadi null)
            // - Jika tidak ada spec (PO pakai "." atau "-" atau kosong vs Master pakai ",-,-" atau "-,-,-" atau kosong): identik (+30%)
            const isTxSpecEmpty = !txSpec || isSpecSlotEmpty(txSpec);
            const isCandSpecEmpty = !candSpec || isSpecSlotEmpty(candSpec);

            if (!isTxSpecEmpty && !isCandSpecEmpty) {
              const spec1Match = txDecomp.spec1 && candDecomp.spec1 && txDecomp.spec1.toLowerCase() === candDecomp.spec1.toLowerCase();
              const spec2Match = (!txDecomp.spec2 && !candDecomp.spec2) || (txDecomp.spec2 && candDecomp.spec2 && txDecomp.spec2.toLowerCase() === candDecomp.spec2.toLowerCase());
              const spec3Match = (!txDecomp.spec3 && !candDecomp.spec3) || (txDecomp.spec3 && candDecomp.spec3 && txDecomp.spec3.toLowerCase() === candDecomp.spec3.toLowerCase());

              if (txSpec === candSpec || candSpec.includes(txSpec) || txSpec.includes(candSpec) || (spec1Match && spec2Match && spec3Match)) {
                score += 30;
                reasonParts.push('Spesifikasi cocok (+30%)');
              }
            } else if (isTxSpecEmpty && isCandSpecEmpty) {
              score += 30;
              reasonParts.push('Spesifikasi umum/NA identik (+30%)');
            }

            // Brand matching (10%):
            const isTxBrandEmpty = !txBrand || isSpecSlotEmpty(txBrand) || txBrand === 'generic' || txBrand === 'nb';
            const isCandBrandEmpty = !candBrand || isSpecSlotEmpty(candBrand) || candBrand === 'generic' || candBrand === 'nb';

            if (!isTxBrandEmpty && !isCandBrandEmpty) {
              if (txBrand === candBrand || candBrand.includes(txBrand) || txBrand.includes(candBrand)) {
                score += 10;
                reasonParts.push('Brand cocok (+10%)');
              }
            } else if (isTxBrandEmpty && isCandBrandEmpty) {
              score += 10;
              reasonParts.push('Brand generic/NA cocok (+10%)');
            }

            // Part Number matching (10%):
            const isTxPartEmpty = !txPartNumber || isSpecSlotEmpty(txPartNumber) || txPartNumber === 'np';
            const isCandPartEmpty = !candPart || isSpecSlotEmpty(candPart) || candPart === 'np';

            if (!isTxPartEmpty && !isCandPartEmpty) {
              if (txPartNumber === candPart || candPart.includes(txPartNumber) || txPartNumber.includes(candPart)) {
                score += 10;
                reasonParts.push('Part Number cocok (+10%)');
              }
            } else if (isTxPartEmpty && isCandPartEmpty) {
              score += 10;
              reasonParts.push('Part Number NP/NA cocok (+10%)');
            }

            if (score > bestScore) {
              bestScore = score;
              bestCandidate = cand;
              bestReason = reasonParts.join(', ');
            }
          }

          if (bestCandidate) {
            if (bestScore >= 95) {
              matched = bestCandidate;
              orphanStatus = 'EXACT_MATCH';
              matchTier = 'COMPONENT_EXACT';
              confidenceScore = bestScore;
              matchReason = bestReason;
            } else if (bestScore >= 50) {
              orphanStatus = 'PARTIAL_ORPHAN';
              matchTier = 'PARTIAL_ORPHAN';
              confidenceScore = bestScore;
              matchReason = `Kandidat Komoditas Parsial (${bestScore}%): ${bestReason}`;
            }
          }
        }
      }

      // TAHAP 4B (Sinkron Baru): Komoditas Identik (50 Poin) + Token-Set Spec Similarity + Brand (JW 0.85) + Part Number (Ambang >= 85)
      if (!matched) {
        const commClean = txCommodity.toLowerCase().trim();
        const candidateSkus = commClean ? (byCommodityMap.get(commClean) || []) : [];
        let fuzzyCommBestScore = 0;
        let fuzzyCommBestCandidate: SkuMasterRecord | null = null;
        let fuzzyCommBestReason = '';

        if (candidateSkus.length > 0) {
          for (const cand of candidateSkus) {
            const candDecomp = decomposeSkuString(cand.formattedSkuName || cand.name);
            const candSpec = normalizeSpecString(cand.generalSpec || candDecomp.generalSpec || cand.specification1);
            const candBrand = (cand.brand || candDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
            const cleanCandPart = (cand.partNumber || candDecomp.partNumber || '').replace(/[^a-z0-9]/g, '').toLowerCase().trim();

            const isTxSpecEmpty = !txSpec || isSpecSlotEmpty(txSpec);
            const isCandSpecEmpty = !candSpec || isSpecSlotEmpty(candSpec);

            // 1. Komoditas (50 poin penuh karena kunci pencarian identik)
            const commodityScore = 50;

            // 2. Spesifikasi via computeTokenSetSimilarity
            let specSim = 0;
            if (isTxSpecEmpty && isCandSpecEmpty) {
              specSim = 1.0;
            } else if (!isTxSpecEmpty && !isCandSpecEmpty) {
              // Safety checks: angka/ukuran bertolak belakang atau modifier berlawanan
              const txFull = `${txCommodity} ${txSpec}`.toLowerCase();
              const candFull = `${cand.name} ${candSpec}`.toLowerCase();
              if (
                hasConflictingNumbers(txSpec, candSpec) ||
                hasConflictingNumbers(txFull, candFull) ||
                hasConflictingModifiers(txFull, candFull)
              ) {
                specSim = 0;
              } else {
                specSim = computeTokenSetSimilarity(txSpec, candSpec);
              }
            } else {
              specSim = 0.1;
            }
            const specScore = Math.round(30 * specSim);

            // 3. Brand (Max 10 poin)
            const isTxBrandGeneric = !txBrand || isSpecSlotEmpty(txBrand) || txBrand === 'generic' || txBrand === 'nb';
            const isCandBrandGeneric = !candBrand || isSpecSlotEmpty(candBrand) || candBrand === 'generic' || candBrand === 'nb';

            let brandSim = 0;
            let isBrandInSpec = false;
            let hasConflictingBrand = false;

            if (isTxBrandGeneric && !isCandBrandGeneric && candBrand.length >= 3) {
              const rawPoSpec = (txDecomp.rawSpec || txDecomp.generalSpec || '').toLowerCase();
              if (rawPoSpec.includes(candBrand)) {
                isBrandInSpec = true;
                brandSim = 1.0;
              }
            }

            if (!isBrandInSpec) {
              if (isTxBrandGeneric && isCandBrandGeneric) {
                brandSim = 1.0;
              } else if (!isTxBrandGeneric && !isCandBrandGeneric) {
                if (txBrand === candBrand || candBrand.includes(txBrand) || txBrand.includes(candBrand)) {
                  brandSim = 1.0;
                } else {
                  const jw = computeJaroWinklerSimilarity(txBrand, candBrand);
                  if (jw >= 0.85) {
                    brandSim = jw;
                  } else {
                    hasConflictingBrand = true;
                    brandSim = 0;
                  }
                }
              } else {
                brandSim = 0;
              }
            }
            const brandScore = Math.round(10 * brandSim);

            // 4. Part Number (Max 10 poin)
            const cleanTxPart = (txDecomp.partNumber || '').replace(/[^a-z0-9]/g, '').toLowerCase().trim();
            const isTxPartEmpty = !cleanTxPart || cleanTxPart === 'np' || cleanTxPart === 'na';
            const isCandPartEmpty = !cleanCandPart || cleanCandPart === 'np' || cleanCandPart === 'na';

            let partNumberSim = 0;
            let goldenBoostApplied = false;
            let hasConflictingPart = false;

            if (isTxPartEmpty && isCandPartEmpty) {
              partNumberSim = 1.0;
            } else if (!isTxPartEmpty && !isCandPartEmpty) {
              if (cleanTxPart === cleanCandPart) {
                partNumberSim = 1.0;
                if (cleanTxPart.length >= 4) {
                  goldenBoostApplied = true;
                }
              } else {
                hasConflictingPart = true;
                partNumberSim = 0;
              }
            } else {
              partNumberSim = 0;
            }
            const partNumberScore = Math.round(10 * partNumberSim);

            let totalCandidateScore = commodityScore + specScore + brandScore + partNumberScore;
            if (goldenBoostApplied && !hasConflictingBrand) {
              totalCandidateScore = Math.max(totalCandidateScore, 95);
            } else if (hasConflictingBrand) {
              totalCandidateScore = Math.min(totalCandidateScore, 45);
            } else if (hasConflictingPart) {
              totalCandidateScore = Math.min(totalCandidateScore, 50);
            }

            if (totalCandidateScore > fuzzyCommBestScore) {
              fuzzyCommBestScore = totalCandidateScore;
              fuzzyCommBestCandidate = cand;
              const reasons: string[] = ['Komoditas identik (50/50)'];
              if (specScore > 0) reasons.push(`Spec similarity (${specScore}/30)`);
              if (isBrandInSpec) reasons.push('Brand di Spec (+10%)');
              else if (brandScore > 0) reasons.push(`Brand (${brandScore}/10)`);
              if (goldenBoostApplied) reasons.push('Part# Golden Boost (+95%)');
              else if (partNumberScore > 0) reasons.push(`Part# (${partNumberScore}/10)`);
              fuzzyCommBestReason = reasons.join(' + ');
            }
          }

          if (fuzzyCommBestCandidate && fuzzyCommBestScore >= 85) {
            matched = fuzzyCommBestCandidate;
            orphanStatus = 'EXACT_MATCH';
            matchTier = 'FUZZY_HIGH';
            confidenceScore = fuzzyCommBestScore;
            matchReason = `Kecocokan Komoditas Identik + Fuzzy (${fuzzyCommBestScore}%): ${fuzzyCommBestReason}`;
          } else if (fuzzyCommBestCandidate && fuzzyCommBestScore >= 50 && !bestCandidate) {
            bestCandidate = fuzzyCommBestCandidate;
            orphanStatus = 'PARTIAL_ORPHAN';
            matchTier = 'PARTIAL_ORPHAN';
            confidenceScore = fuzzyCommBestScore;
            matchReason = `Kandidat Komoditas Parsial (${fuzzyCommBestScore}%): ${fuzzyCommBestReason}`;
          }
        }
      }

      if (matched) {
        const lv1 = (matched.purchCategoryLv1 || 'General').trim();
        const lv2 = (matched.purchCategoryLv2 || lv1).trim();
        const lv3 = (matched.purchCategoryLv3 || lv2).trim();
        const lv4 = (matched.purchCategoryLv4 || lv3).trim();
        const lv5 = txCommodity || matched.name || primaryItemName;

        if (itemKey) {
          const cacheEntry: SkuMappingCacheRecord = {
            itemKey,
            rawItemName: rawTarget,
            matchedSkuId: matched.id,
            orphanStatus: 'EXACT_MATCH',
            matchTier,
            confidenceScore,
            matchReason,
            matchedSku: matched,
            taxonomy: {
              taxonomyLv1: lv1,
              taxonomyLv2: lv2,
              taxonomyLv3: lv3,
              taxonomyLv4: lv4,
              taxonomyLv5: lv5,
              brand: txBrand || matched.brand || '',
              spec: txSpec || matched.generalSpec || matched.specification1 || '',
              partNumber: txPartNumber || matched.partNumber || ''
            },
            updatedAt: Date.now()
          };
          this.skuMappingCacheMap.set(itemKey, cacheEntry);
          newCacheEntriesToSave.push(cacheEntry);
        }

        return {
          ...r,
          itemName: primaryItemName,
          itemNotes: r.itemNotes || itemNotes,
          extractedSkuCode: poSkuCode || undefined,
          skuMasterId: matched.id,
          matchTier,
          commodityItem: txCommodity || matched.commodityItem || matched.name,
          generalSpec: txSpec || matched.generalSpec || matched.specification1,
          brand: txBrand || matched.brand,
          partNumber: txPartNumber || matched.partNumber,
          orphanStatus: 'EXACT_MATCH',
          orphanConfidenceScore: confidenceScore,
          orphanMatchReason: matchReason,
          taxonomyLv1: lv1,
          taxonomyLv2: lv2,
          taxonomyLv3: lv3,
          taxonomyLv4: lv4,
          taxonomyLv5: lv5
        };
      } else {
        // Belum match 85% di Tahap 1-4B: Daftarkan ke Background Web Worker (Tahap 5 Weighted Fuzzy)
        // Tanpa memblokir main thread UI
        if (itemKey) {
          unmappedItemsToWorkerMap.set(itemKey, { rawItemName: rawTarget, itemKey });
        }

        const poCategory = (r.procurementCategory || r.mappedCategory || txCommodity || 'General Supplies').trim();
        
        const lv1 = 'UNMAPPED / ORPHAN PO';
        const lv2 = poCategory;
        const lv3 = poCategory;
        const lv4 = poCategory;
        const lv5 = txCommodity || primaryItemName;

        return {
          ...r,
          itemName: primaryItemName,
          itemNotes: r.itemNotes || itemNotes,
          extractedSkuCode: poSkuCode || undefined,
          skuMasterId: undefined,
          matchTier: orphanStatus === 'PARTIAL_ORPHAN' ? 'PARTIAL_ORPHAN' : 'FULL_ORPHAN',
          commodityItem: txCommodity || primaryItemName,
          generalSpec: txSpec,
          brand: txBrand,
          partNumber: txPartNumber,
          orphanStatus,
          orphanConfidenceScore: confidenceScore,
          orphanMatchReason: matchReason || 'Sedang diselaraskan di background worker...',
          taxonomyLv1: lv1,
          taxonomyLv2: lv2,
          taxonomyLv3: lv3,
          taxonomyLv4: lv4,
          taxonomyLv5: lv5
        };
      }
    });

    if (newCacheEntriesToSave.length > 0) {
      saveSkuMappingCacheBatch(newCacheEntriesToSave).catch(err =>
        console.warn('[SpendService] Error saving sku mapping cache batch:', err)
      );
    }

    if (unmappedItemsToWorkerMap.size > 0) {
      this.scheduleWorkerSkuMapping(Array.from(unmappedItemsToWorkerMap.values()), skuMasters);
    }

    return mappedRecords;
  }

  matchTransactionWithSku(record: SpendRecord, skuMasters: SkuMasterRecord[]): SkuMasterRecord | null {
    if (!record || !skuMasters || skuMasters.length === 0) return null;

    // Clean item name from PO by removing note written in new lines and extracting ::skuCode
    const { itemName: cleanItemName, extractedSkuCode } = splitItemNameAndNotes(record.rawItemName || record.itemName);
    const poSkuCode = (record.extractedSkuCode || extractedSkuCode || '').toLowerCase().trim();
    const targetName = (cleanItemName || record.itemName || '').toLowerCase().trim();

    // PRIORITAS PERTAMA: Ekstraksi Kode Master SKU dari nama item transaksi PO (setelah "::")
    if (poSkuCode) {
      const foundByPoCode = skuMasters.find(s => 
        s && (
          (s.productId && s.productId.toLowerCase().trim() === poSkuCode) ||
          (s.id && s.id.toLowerCase().trim() === poSkuCode) ||
          (s.prItemId && s.prItemId.toLowerCase().trim() === poSkuCode) ||
          (s.cprItemId && s.cprItemId.toLowerCase().trim() === poSkuCode) ||
          (s.spItemId && s.spItemId.toLowerCase().trim() === poSkuCode) ||
          (s.partNumber && s.partNumber.toLowerCase().trim() === poSkuCode)
        )
      );
      if (foundByPoCode) return foundByPoCode;
    }

    // 1. Direct ID check (only if validated against item name or manually reconciled)
    if (record.skuMasterId) {
      const found = skuMasters.find(s => s && s.id === record.skuMasterId);
      if (found) {
        const sName = (found.name || '').toLowerCase().trim();
        const sFormatted = (found.formattedSkuName || '').toLowerCase().trim();
        const targetClean = targetName;
        const targetNorm = normalizeSkuSyntax(cleanItemName || record.itemName);
        const foundNorm = normalizeSkuSyntax(found.formattedSkuName || found.name);

        if (
          sName === targetClean ||
          sFormatted === targetClean ||
          (targetNorm && targetNorm === foundNorm) ||
          (record.orphanMatchReason && record.orphanMatchReason.includes('Manual'))
        ) {
          return found;
        }
      }
    }

    if (!targetName) return null;

    // NOTE: Direct matching by record.itemId / product code is EXCLUDED because in PO data
    // itemId is a financial spending grouping, not a product SKU Master ID.

    // TAHAP 3: Exact Full Name Match (Case-insensitive, tanpa Note baris baru, format 3-slot spec dinormalisasi)
    const normTarget = normalizeSkuSyntax(cleanItemName || record.itemName);
    const exactMatch = skuMasters.find(s => {
      if (!s) return false;
      const sName = (s.name || '').toLowerCase().trim();
      const sFormatted = (s.formattedSkuName || '').toLowerCase().trim();
      if (sName === targetName || sFormatted === targetName) return true;
      if (normTarget) {
        if (normalizeSkuSyntax(s.formattedSkuName) === normTarget || normalizeSkuSyntax(s.name) === normTarget) {
          return true;
        }
      }
      return false;
    });
    if (exactMatch) return exactMatch;

    // TAHAP 4: Component-based matching using decomposition: Commodity (50%), Spec 3-Slot (30%), Brand (10%), Part# (10%)
    const txDecomp = decomposeSkuString(cleanItemName || record.itemName);
    const txCommodity = txDecomp.commodityItem.replace(/\s+/g, ' ').toLowerCase().trim();
    const txSpec = normalizeSpecString(txDecomp.generalSpec || txDecomp.rawSpec);
    const txBrand = (txDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
    const txPartNumber = (txDecomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

    if (txCommodity.length >= 3) {
      let bestCandidate: SkuMasterRecord | null = null;
      let bestScore = 0;

      for (const s of skuMasters) {
        if (!s) continue;
        const sDecomp = decomposeSkuString(s.formattedSkuName || s.name);
        const sCommodity = (s.commodityItem || sDecomp.commodityItem || s.name || '').replace(/\s+/g, ' ').toLowerCase().trim();
        const sSpec = normalizeSpecString(s.generalSpec || sDecomp.generalSpec || s.specification1);
        const sBrand = (s.brand || sDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
        const sPart = (s.partNumber || sDecomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

        const commMatch = sCommodity === txCommodity || (sCommodity.length >= 4 && (sCommodity.includes(txCommodity) || txCommodity.includes(sCommodity)));
        if (!commMatch) continue;

        let score = 50; // Commodity matched
        
        // Spec matching (30%):
        const isTxSpecEmpty = !txSpec || isSpecSlotEmpty(txSpec);
        const isCandSpecEmpty = !sSpec || isSpecSlotEmpty(sSpec);
        if (!isTxSpecEmpty && !isCandSpecEmpty) {
          const spec1Match = txDecomp.spec1 && sDecomp.spec1 && txDecomp.spec1.toLowerCase() === sDecomp.spec1.toLowerCase();
          const spec2Match = (!txDecomp.spec2 && !sDecomp.spec2) || (txDecomp.spec2 && sDecomp.spec2 && txDecomp.spec2.toLowerCase() === sDecomp.spec2.toLowerCase());
          const spec3Match = (!txDecomp.spec3 && !sDecomp.spec3) || (txDecomp.spec3 && sDecomp.spec3 && txDecomp.spec3.toLowerCase() === sDecomp.spec3.toLowerCase());

          if (txSpec === sSpec || sSpec.includes(txSpec) || txSpec.includes(sSpec) || (spec1Match && spec2Match && spec3Match)) {
            score += 30;
          }
        } else if (isTxSpecEmpty && isCandSpecEmpty) {
          score += 30;
        }

        // Brand matching (10%):
        const isTxBrandEmpty = !txBrand || isSpecSlotEmpty(txBrand) || txBrand === 'generic' || txBrand === 'nb';
        const isCandBrandEmpty = !sBrand || isSpecSlotEmpty(sBrand) || sBrand === 'generic' || sBrand === 'nb';
        if (!isTxBrandEmpty && !isCandBrandEmpty) {
          if (txBrand === sBrand || sBrand.includes(txBrand) || txBrand.includes(sBrand)) {
            score += 10;
          }
        } else if (isTxBrandEmpty && isCandBrandEmpty) {
          score += 10;
        }

        // Part Number matching (10%):
        const isTxPartEmpty = !txPartNumber || isSpecSlotEmpty(txPartNumber) || txPartNumber === 'np';
        const isCandPartEmpty = !sPart || isSpecSlotEmpty(sPart) || sPart === 'np';
        if (!isTxPartEmpty && !isCandPartEmpty) {
          if (txPartNumber === sPart || sPart.includes(txPartNumber) || txPartNumber.includes(sPart)) {
            score += 10;
          }
        } else if (isTxPartEmpty && isCandPartEmpty) {
          score += 10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = s;
        }
      }

      // Exact match threshold >= 95%
      if (bestCandidate && bestScore >= 95) {
        return bestCandidate;
      }

      // TAHAP 5: Fuzzy Multiplier Fallback
      let fuzzyBestScore = bestScore;
      let fuzzyBestCandidate: SkuMasterRecord | null = bestCandidate;

      for (const s of skuMasters) {
        if (!s) continue;
        const sDecomp = decomposeSkuString(s.formattedSkuName || s.name);
        const sim = computeWeightedSkuSimilarity(txDecomp, s, sDecomp);
        if (sim.totalScore > fuzzyBestScore) {
          fuzzyBestScore = sim.totalScore;
          fuzzyBestCandidate = s;
          if (fuzzyBestScore >= 95) break;
        }
      }

      if (fuzzyBestCandidate && fuzzyBestScore >= 80) {
        return fuzzyBestCandidate;
      }
    }

    // Full Orphan -> no exact master SKU
    return null;
  }

  async addRecords(
    records: SpendRecord[], 
    fileMeta: { 
      id: string; 
      fileName: string; 
      fileType: string; 
      recordCount?: number;
      totalValue?: number;
      totalQty?: number;
      skippedCount?: number;
    },
    onSaveProgress?: (savedCount: number, totalCount: number) => void
  ): Promise<SpendRecord[]> {
    // If existing database only contains sample data, clear sample data before adding real data
    const existing = await getAllSpendRecords();
    const isOnlySample = existing.length > 0 && existing.every(r => r.id.startsWith('sample-'));
    if (isOnlySample) {
      await clearAllSpendRecords();
      this.cacheRecords = [];
    }

    const skuList = await this.getSkuMasters();
    const prs = await this.getPrRecords();
    const userMappings = await this.getUserDepartmentMappings();

    const poRecordsOnly = records.filter(r => !isPrSummaryRecord(r));
    const skuEnriched = this.enrichRecordsWithSkuMapping(poRecordsOnly, skuList);
    const enriched = this.enrichRecordsWithPrData(skuEnriched, prs, userMappings);

    // Merge dengan existing records: Transaksi unik murni berdasarkan PO ID dan Line Number.
    // Hospital code dan file source tidak relevan sebagai penentu keunikan.
    // Jika ada perpaduan PO ID dan Line Number yang sama, gunakan yang terakhir di-upload (enriched overwrites existing).
    const mergedMap = new Map<string, SpendRecord>();
    const currentStored = isOnlySample ? [] : (await getAllSpendRecords()).filter(r => !isPrSummaryRecord(r));
    for (const r of currentStored) {
      const canonicalId = buildSpendRecordId(r.purchId, r.lineNumber);
      mergedMap.set(canonicalId, { ...r, id: canonicalId });
    }
    for (const r of enriched) {
      const canonicalId = buildSpendRecordId(r.purchId, r.lineNumber);
      mergedMap.set(canonicalId, { ...r, id: canonicalId });
    }

    const finalMergedRecords = Array.from(mergedMap.values());
    await replaceAllSpendRecords(finalMergedRecords, onSaveProgress);

    const totalVal = fileMeta.totalValue ?? enriched.reduce((acc, r) => acc + (Number(r.totalLineAmount) || 0), 0);
    const totalQ = fileMeta.totalQty ?? enriched.reduce((acc, r) => acc + (Number(r.purchQty) || 0), 0);

    await saveUploadedFileInfo({
      id: fileMeta.id,
      fileName: fileMeta.fileName,
      fileType: fileMeta.fileType,
      recordCount: enriched.length,
      totalValue: totalVal,
      totalQty: totalQ,
      skippedCount: fileMeta.skippedCount || 0,
      uploadedAt: new Date().toISOString()
    });
    this.cacheRecords = finalMergedRecords;
    this.invalidateMaintenanceCache();
    return this.cacheRecords;
  }

  async addMultipleBatches(
    batches: Array<{
      records: SpendRecord[];
      meta: {
        id: string;
        fileName: string;
        fileType: string;
        recordCount?: number;
        totalValue?: number;
        totalQty?: number;
        skippedCount?: number;
      };
    }>,
    onSaveProgress?: (savedCount: number, totalCount: number) => void
  ): Promise<SpendRecord[]> {
    // If existing database only contains sample data, clear sample data before adding real data
    const existing = await getAllSpendRecords();
    const isOnlySample = existing.length > 0 && existing.every(r => r.id.startsWith('sample-'));
    if (isOnlySample) {
      await clearAllSpendRecords();
      this.cacheRecords = [];
    }

    const skuList = await this.getSkuMasters();
    const prs = await this.getPrRecords();
    const userMappings = await this.getUserDepartmentMappings();
    const allEnriched: SpendRecord[] = [];

    // Filter out PR reference batches from spend transactions
    const poBatches = batches.filter(b => b.meta.fileType !== 'summary_pr' && !b.meta.fileType?.includes('Requisition Reference'));

    for (const batch of poBatches) {
      const poOnlyRecords = batch.records.filter(r => !isPrSummaryRecord(r));
      const skuEnriched = this.enrichRecordsWithSkuMapping(poOnlyRecords, skuList);
      const enriched = this.enrichRecordsWithPrData(skuEnriched, prs, userMappings);
      allEnriched.push(...enriched);

      const totalVal = batch.meta.totalValue ?? enriched.reduce((acc, r) => acc + (Number(r.totalLineAmount) || 0), 0);
      const totalQ = batch.meta.totalQty ?? enriched.reduce((acc, r) => acc + (Number(r.purchQty) || 0), 0);

      await saveUploadedFileInfo({
        id: batch.meta.id,
        fileName: batch.meta.fileName,
        fileType: batch.meta.fileType,
        recordCount: enriched.length,
        totalValue: totalVal,
        totalQty: totalQ,
        skippedCount: batch.meta.skippedCount || 0,
        uploadedAt: new Date().toISOString()
      });
    }

    if (allEnriched.length > 0) {
      // Merge dengan existing records: Transaksi unik murni berdasarkan PO ID dan Line Number.
      // Jika ada perpaduan PO ID dan Line Number yang sama, gunakan yang terakhir di-upload (allEnriched overwrites existing).
      const mergedMap = new Map<string, SpendRecord>();
      const currentStored = isOnlySample ? [] : await getAllSpendRecords();
      for (const r of currentStored) {
        const canonicalId = buildSpendRecordId(r.purchId, r.lineNumber);
        mergedMap.set(canonicalId, { ...r, id: canonicalId });
      }
      for (const r of allEnriched) {
        const canonicalId = buildSpendRecordId(r.purchId, r.lineNumber);
        mergedMap.set(canonicalId, { ...r, id: canonicalId });
      }

      const finalMergedRecords = Array.from(mergedMap.values());
      await replaceAllSpendRecords(finalMergedRecords, onSaveProgress);
      this.cacheRecords = finalMergedRecords;
    } else {
      this.cacheRecords = await getAllSpendRecords();
    }
    this.invalidateMaintenanceCache();
    return this.cacheRecords;
  }

  async resetData(): Promise<SpendRecord[]> {
    await clearAllSpendRecords();
    await clearMaintenanceCache();
    await clearPrecalculatedAggregates();
    this.cacheRecords = [];
    this.memoryMaintenanceCache = null;
    this.memoryPrecalculatedAggregates = null;
    this.isLoaded = true;
    return this.cacheRecords;
  }

  async getFilesInfo(): Promise<UploadedBatchMeta[]> {
    return getUploadedFilesInfo();
  }

  filterRecords(records: SpendRecord[] = [], criteria: SpendFilterCriteria): SpendRecord[] {
    if (!Array.isArray(records)) return [];
    const q = (criteria.searchQuery || '').trim().toLowerCase();

    return records.filter(r => {
      if (!r) return false;

      // Search query across vendor, item, purchId, hospital
      if (q) {
        const vName = (r.vendorName || '').toLowerCase();
        const iName = (r.itemName || '').toLowerCase();
        const pId = (r.purchId || '').toLowerCase();
        const hCode = (r.hospitalCode || '').toLowerCase();
        const pCat = (r.procurementCategory || '').toLowerCase();
        const matches = 
          vName.includes(q) ||
          iName.includes(q) ||
          pId.includes(q) ||
          hCode.includes(q) ||
          pCat.includes(q);
        if (!matches) return false;
      }

      if (criteria.hospitalCode && criteria.hospitalCode !== 'ALL' && r.hospitalCode !== criteria.hospitalCode) {
        return false;
      }

      if (criteria.sourceFile && criteria.sourceFile !== 'ALL' && r.sourceFile !== criteria.sourceFile) {
        return false;
      }

      if (criteria.spendType && criteria.spendType !== 'all' && r.purchaseCategory !== criteria.spendType) {
        return false;
      }

      if (criteria.category && criteria.category !== 'ALL' && r.procurementCategory !== criteria.category && r.mappedCategory !== criteria.category) {
        return false;
      }

      if (criteria.vendorName && criteria.vendorName !== 'ALL' && r.vendorName !== criteria.vendorName) {
        return false;
      }

      if (criteria.startDate && r.createdDate && r.createdDate < criteria.startDate) {
        return false;
      }

      if (criteria.endDate && r.createdDate && r.createdDate > criteria.endDate) {
        return false;
      }

      // Filter by SKU Matching / Orphan Status
      if (criteria.orphanFilter && criteria.orphanFilter !== 'ALL') {
        const isMatched = r.orphanStatus === 'EXACT_MATCH' || (Boolean(r.skuMasterId) && r.orphanStatus !== 'PARTIAL_ORPHAN' && r.orphanStatus !== 'FULL_ORPHAN');
        const score = r.orphanConfidenceScore || 0;

        if (criteria.orphanFilter === 'EXACT_MATCH') {
          if (!isMatched) return false;
        } else if (criteria.orphanFilter === 'PARTIAL_ORPHAN') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN') return false;
        } else if (criteria.orphanFilter === 'PARTIAL_40') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score > 45) return false;
        } else if (criteria.orphanFilter === 'PARTIAL_50') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 46 || score > 59) return false;
        } else if (criteria.orphanFilter === 'PARTIAL_60') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 60 || score > 79) return false;
        } else if (criteria.orphanFilter === 'PARTIAL_80') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 80 || score > 89) return false;
        } else if (criteria.orphanFilter === 'PARTIAL_90') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 90) return false;
        } else if (criteria.orphanFilter === 'FULL_ORPHAN') {
          if (r.orphanStatus !== 'FULL_ORPHAN' && !(!isMatched && r.orphanStatus !== 'PARTIAL_ORPHAN')) return false;
        }
      }

      return true;
    });
  }

  calculateKPIs(records: SpendRecord[] = []): SpendSummaryKPIs {
    if (!Array.isArray(records) || records.length === 0) {
      return {
        totalSpend: 0,
        totalTransactions: 0,
        uniqueVendors: 0,
        uniqueHospitals: 0,
        totalCapexSpend: 0,
        totalOpexSpend: 0,
        averagePoAmount: 0,
        pairedTransactions: 0,
        unpairedTransactions: 0,
        pairedSpend: 0,
        unpairedSpend: 0,
        pairingRatePct: 0
      };
    }

    const totalTransactions = records.length;
    let totalSpend = 0;
    let totalCapexSpend = 0;
    let totalOpexSpend = 0;
    let pairedTransactions = 0;
    let unpairedTransactions = 0;
    let pairedSpend = 0;
    let unpairedSpend = 0;
    const vendors = new Set<string>();
    const hospitals = new Set<string>();

    for (const r of records) {
      if (!r) continue;
      const amt = Number(r.totalLineAmount) || 0;
      totalSpend += amt;
      if (r.purchaseCategory === 'CAPEX') {
        totalCapexSpend += amt;
      } else {
        totalOpexSpend += amt;
      }
      if (r.vendorName) vendors.add(r.vendorName);
      if (r.hospitalCode) hospitals.add(r.hospitalCode);

      const isPaired = r.prPairingKeyType === 'PO' || r.prPairingKeyType === 'PRQ' || (Boolean(r.purchaseReqId) && r.prPairingKeyType !== 'UNPAIRED');
      if (isPaired) {
        pairedTransactions++;
        pairedSpend += amt;
      } else {
        unpairedTransactions++;
        unpairedSpend += amt;
      }
    }

    const averagePoAmount = totalTransactions > 0 ? totalSpend / totalTransactions : 0;
    const pairingRatePct = totalSpend > 0 ? (pairedSpend / totalSpend) * 100 : 0;

    return {
      totalSpend,
      totalTransactions,
      uniqueVendors: vendors.size,
      uniqueHospitals: hospitals.size,
      totalCapexSpend,
      totalOpexSpend,
      averagePoAmount,
      pairedTransactions,
      unpairedTransactions,
      pairedSpend,
      unpairedSpend,
      pairingRatePct
    };
  }

  getMonthlyTrend(records: SpendRecord[] = []): MonthlyTrendItem[] {
    if (!Array.isArray(records) || records.length === 0) return [];
    const map = new Map<string, { capex: number; opex: number; total: number }>();

    for (const r of records) {
      if (!r) continue;
      const m = r.monthYear || '2026-01';
      const existing = map.get(m) || { capex: 0, opex: 0, total: 0 };
      const amt = Number(r.totalLineAmount) || 0;
      if (r.purchaseCategory === 'CAPEX') {
        existing.capex += amt;
      } else {
        existing.opex += amt;
      }
      existing.total += amt;
      map.set(m, existing);
    }

    const sortedMonths = Array.from(map.keys()).sort();
    return sortedMonths.map(month => ({
      month,
      capex: map.get(month)!.capex,
      opex: map.get(month)!.opex,
      total: map.get(month)!.total
    }));
  }

  getHospitalSpend(records: SpendRecord[] = []): HospitalSpendItem[] {
    if (!Array.isArray(records) || records.length === 0) return [];
    const map = new Map<string, number>();
    let total = 0;

    for (const r of records) {
      if (!r) continue;
      const h = r.hospitalCode || 'UNKNOWN';
      const amt = Number(r.totalLineAmount) || 0;
      map.set(h, (map.get(h) || 0) + amt);
      total += amt;
    }

    const items: HospitalSpendItem[] = [];
    map.forEach((spend, hospitalCode) => {
      items.push({
        hospitalCode,
        spend,
        percentage: total > 0 ? (spend / total) * 100 : 0
      });
    });

    return items.sort((a, b) => b.spend - a.spend);
  }

  getCategorySpend(records: SpendRecord[] = []): CategorySpendItem[] {
    if (!Array.isArray(records) || records.length === 0) return [];
    const map = new Map<string, number>();
    let total = 0;

    for (const r of records) {
      if (!r) continue;
      // For Full Orphan, categorize as ORPHAN. For Partial Orphan, keep in Procurement Categories!
      const isFullOrphan = r.orphanStatus === 'FULL_ORPHAN' || (!r.skuMasterId && r.orphanStatus !== 'PARTIAL_ORPHAN' && r.orphanStatus !== 'EXACT_MATCH');
      const cat = isFullOrphan ? 'ORPHAN' : (r.taxonomyLv1 || r.procurementCategory || r.mappedCategory || 'General');
      const amt = Number(r.totalLineAmount) || 0;
      map.set(cat, (map.get(cat) || 0) + amt);
      total += amt;
    }

    const items: CategorySpendItem[] = [];
    map.forEach((spend, category) => {
      items.push({
        category,
        spend,
        percentage: total > 0 ? (spend / total) * 100 : 0
      });
    });

    return items.sort((a, b) => b.spend - a.spend).slice(0, 10);
  }

  getTopVendors(records: SpendRecord[] = []): VendorSpendItem[] {
    if (!Array.isArray(records) || records.length === 0) return [];
    const map = new Map<string, { spend: number; count: number }>();

    for (const r of records) {
      if (!r) continue;
      const v = r.vendorName || 'Unknown Vendor';
      const amt = Number(r.totalLineAmount) || 0;
      const current = map.get(v) || { spend: 0, count: 0 };
      current.spend += amt;
      current.count += 1;
      map.set(v, current);
    }

    const items: VendorSpendItem[] = [];
    map.forEach((data, vendorName) => {
      items.push({
        vendorName,
        spend: data.spend,
        transactionsCount: data.count
      });
    });

    return items.sort((a, b) => b.spend - a.spend).slice(0, 10);
  }

  /**
   * Generates unmatched items analysis from current transactions and SKU Master directory with high-speed indexing.
   */
  getUnmatchedItemsSummary(
    records?: SpendRecord[],
    skuMasters?: SkuMasterRecord[]
  ): UnmatchedItemSummary[] {
    const dataRecords = records || this.cacheRecords;
    const masterSkus = skuMasters || this.cacheSkuMasters;

    // Create SKU lookup set and map for rapid validation and candidate resolution
    const validSkuIds = new Set<string>();
    const masterSkuMap = new Map<string, SkuMasterRecord>();
    masterSkus.forEach(s => {
      if (s.id) {
        validSkuIds.add(s.id);
        masterSkuMap.set(s.id, s);
        masterSkuMap.set(s.id.toLowerCase(), s);
      }
      if (s.productId) {
        const pIdClean = s.productId.toLowerCase().trim();
        validSkuIds.add(pIdClean);
        masterSkuMap.set(pIdClean, s);
        masterSkuMap.set(s.productId.trim(), s);
      }
    });

    // Group unmatched records by normalized item name / item ID
    const unmatchedGroups = new Map<string, {
      itemName: string;
      itemIds: Set<string>;
      procurementCategory: string;
      mappedCategory?: string;
      purchUnits: Set<string>;
      transactionCount: number;
      totalSpend: number;
      totalQty: number;
      minUnitPrice: number;
      maxUnitPrice: number;
      sumUnitPrice: number;
      countUnitPrice: number;
      candidateSkuId?: string;
      candidateMatchReason?: string;
      txOrphanStatus?: 'PARTIAL_ORPHAN' | 'FULL_ORPHAN';
      txConfidenceScore?: number;
      hospitals: Map<string, { count: number; spend: number }>;
      vendors: Map<string, { count: number; spend: number }>;
      samplePurchIds: Set<string>;
      firstSeenDate: string;
      lastSeenDate: string;
    }>();

    for (const r of dataRecords) {
      // An item is unmatched if it has no skuMasterId or the skuMasterId isn't found in masterSkus
      const isMatched = Boolean(r.skuMasterId && validSkuIds.has(r.skuMasterId));
      if (isMatched) continue;

      const itemNameClean = (r.itemName || 'ITEM TANPA NAMA').trim();
      const groupKey = itemNameClean.toLowerCase();

      let group = unmatchedGroups.get(groupKey);
      if (!group) {
        group = {
          itemName: itemNameClean,
          itemIds: new Set<string>(),
          procurementCategory: r.procurementCategory || r.mappedCategory || 'General Unclassified',
          mappedCategory: r.mappedCategory,
          purchUnits: new Set<string>(),
          transactionCount: 0,
          totalSpend: 0,
          totalQty: 0,
          minUnitPrice: Infinity,
          maxUnitPrice: -Infinity,
          sumUnitPrice: 0,
          countUnitPrice: 0,
          hospitals: new Map<string, { count: number; spend: number }>(),
          vendors: new Map<string, { count: number; spend: number }>(),
          samplePurchIds: new Set<string>(),
          firstSeenDate: r.createdDate || '',
          lastSeenDate: r.createdDate || ''
        };
        unmatchedGroups.set(groupKey, group);
      }

      if (r.itemId && group.itemIds.size < 5) group.itemIds.add(r.itemId.trim());
      if (r.purchUnit && group.purchUnits.size < 5) group.purchUnits.add(r.purchUnit.trim());
      if (r.purchId && group.samplePurchIds.size < 5) group.samplePurchIds.add(r.purchId.trim());

      if (r.candidateSkuId && !group.candidateSkuId) {
        group.candidateSkuId = r.candidateSkuId;
      }
      if (r.orphanMatchReason && !group.candidateMatchReason) {
        group.candidateMatchReason = r.orphanMatchReason;
      }
      if (r.orphanStatus === 'PARTIAL_ORPHAN') {
        group.txOrphanStatus = 'PARTIAL_ORPHAN';
      }
      if (r.orphanConfidenceScore && (!group.txConfidenceScore || r.orphanConfidenceScore > group.txConfidenceScore)) {
        group.txConfidenceScore = r.orphanConfidenceScore;
      }

      const spend = Number(r.totalLineAmount) || 0;
      const qty = Number(r.purchQty) || 0;
      const unitPrice = Number(r.purchPrice) || (qty > 0 ? spend / qty : 0);

      group.transactionCount += 1;
      group.totalSpend += spend;
      group.totalQty += qty;
      if (unitPrice > 0) {
        group.sumUnitPrice += unitPrice;
        group.countUnitPrice += 1;
        if (unitPrice < group.minUnitPrice) group.minUnitPrice = unitPrice;
        if (unitPrice > group.maxUnitPrice) group.maxUnitPrice = unitPrice;
      }

      // Hospital tracking
      const hosp = r.hospitalCode || 'UNKNOWN';
      const hData = group.hospitals.get(hosp) || { count: 0, spend: 0 };
      hData.count += 1;
      hData.spend += spend;
      group.hospitals.set(hosp, hData);

      // Vendor tracking
      const vend = r.vendorName || 'UNKNOWN VENDOR';
      const vData = group.vendors.get(vend) || { count: 0, spend: 0 };
      vData.count += 1;
      vData.spend += spend;
      group.vendors.set(vend, vData);

      // Date tracking
      if (r.createdDate) {
        if (!group.firstSeenDate || r.createdDate < group.firstSeenDate) {
          group.firstSeenDate = r.createdDate;
        }
        if (!group.lastSeenDate || r.createdDate > group.lastSeenDate) {
          group.lastSeenDate = r.createdDate;
        }
      }
    }

    // Convert map to array of UnmatchedItemSummary with decomposition and Orphan Status
    const result: UnmatchedItemSummary[] = [];
    unmatchedGroups.forEach((val, key) => {
      const avgPrice = val.countUnitPrice > 0
        ? val.sumUnitPrice / val.countUnitPrice
        : (val.totalQty > 0 ? val.totalSpend / val.totalQty : 0);
      const minPrice = val.minUnitPrice !== Infinity ? val.minUnitPrice : avgPrice;
      const maxPrice = val.maxUnitPrice !== -Infinity ? val.maxUnitPrice : avgPrice;

      const hospArray = Array.from(val.hospitals.entries()).map(([code, d]) => ({
        code,
        count: d.count,
        spend: d.spend
      })).sort((a, b) => b.spend - a.spend);

      const vendArray = Array.from(val.vendors.entries()).map(([name, d]) => ({
        name,
        count: d.count,
        spend: d.spend
      })).sort((a, b) => b.spend - a.spend);

      // Decompose SKU for this unmatched group item
      const decomp = decomposeSkuString(val.itemName);
      const commodityClean = decomp.commodityItem.replace(/\s+/g, ' ').toLowerCase().trim();

      // Determine Orphan Scale: Partial Orphan (commodity matches master) vs Full Orphan
      let orphanStatus: 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' = 'FULL_ORPHAN';
      let orphanConfidenceScore = 0;
      let orphanExplanation = 'Full Orphan: Tidak ditemukan kesamaan komoditas (Level 5) pada Master SKU.';
      let bestMatchedSku: SkuMasterRecord | undefined;
      let bestMatchedComponents = {
        commodityMatch: false,
        specMatch: false,
        brandMatch: false,
        partNumberMatch: false
      };

      if (commodityClean) {
        // Search across master SKUs for commodity match
        for (const sku of masterSkus) {
          if (!sku) continue;
          const skuDecomp = decomposeSkuString(sku.formattedSkuName || sku.name);
          const skuCommodity = (sku.commodityItem || skuDecomp.commodityItem || sku.name || '').replace(/\s+/g, ' ').toLowerCase().trim();

          const commMatches = skuCommodity === commodityClean ||
            (skuCommodity.length >= 4 && (skuCommodity.includes(commodityClean) || commodityClean.includes(skuCommodity)));

          if (commMatches) {
            let score = 50;
            const skuSpec = normalizeSpecString(sku.generalSpec || skuDecomp.generalSpec || sku.specification1);
            const skuBrand = (sku.brand || skuDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
            const skuPart = (sku.partNumber || skuDecomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

            const txSpec = normalizeSpecString(decomp.generalSpec || decomp.rawSpec);
            const txBrand = (decomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
            const txPart = (decomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

            const isTxSpecEmpty = !txSpec || isSpecSlotEmpty(txSpec);
            const isCandSpecEmpty = !skuSpec || isSpecSlotEmpty(skuSpec);
            const spec1Match = decomp.spec1 && skuDecomp.spec1 && decomp.spec1.toLowerCase() === skuDecomp.spec1.toLowerCase();
            const spec2Match = (!decomp.spec2 && !skuDecomp.spec2) || (decomp.spec2 && skuDecomp.spec2 && decomp.spec2.toLowerCase() === skuDecomp.spec2.toLowerCase());
            const spec3Match = (!decomp.spec3 && !skuDecomp.spec3) || (decomp.spec3 && skuDecomp.spec3 && decomp.spec3.toLowerCase() === skuDecomp.spec3.toLowerCase());
            const specMatches = Boolean((!isTxSpecEmpty && !isCandSpecEmpty && (txSpec === skuSpec || skuSpec.includes(txSpec) || txSpec.includes(skuSpec) || (spec1Match && spec2Match && spec3Match))) || (isTxSpecEmpty && isCandSpecEmpty));

            const isTxBrandEmpty = !txBrand || isSpecSlotEmpty(txBrand) || txBrand === 'generic' || txBrand === 'nb';
            const isCandBrandEmpty = !skuBrand || isSpecSlotEmpty(skuBrand) || skuBrand === 'generic' || skuBrand === 'nb';
            const brandMatches = Boolean((!isTxBrandEmpty && !isCandBrandEmpty && (txBrand === skuBrand || skuBrand.includes(txBrand) || txBrand.includes(skuBrand))) || (isTxBrandEmpty && isCandBrandEmpty));

            const isTxPartEmpty = !txPart || isSpecSlotEmpty(txPart) || txPart === 'np';
            const isCandPartEmpty = !skuPart || isSpecSlotEmpty(skuPart) || skuPart === 'np';
            const partMatches = Boolean((!isTxPartEmpty && !isCandPartEmpty && (txPart === skuPart || skuPart.includes(txPart) || txPart.includes(skuPart))) || (isTxPartEmpty && isCandPartEmpty));

            if (specMatches) score += 30;
            if (brandMatches) score += 10;
            if (partMatches) score += 10;

            if (score > orphanConfidenceScore) {
              orphanStatus = 'PARTIAL_ORPHAN';
              orphanConfidenceScore = score;
              bestMatchedSku = sku;
              bestMatchedComponents = {
                commodityMatch: true,
                specMatch: specMatches,
                brandMatch: brandMatches,
                partNumberMatch: partMatches
              };
              orphanExplanation = `Partial Orphan (${score}%): Komoditas '${decomp.commodityItem}' cocok dengan Master SKU [${sku.productId}] ${sku.name}.`;
            }
          }
        }

        // Tahap 5 Weighted Fuzzy check jika kandidat belum mencapai skor tinggi
        if (orphanConfidenceScore < 70) {
          for (const sku of masterSkus) {
            if (!sku) continue;
            const skuDecomp = decomposeSkuString(sku.formattedSkuName || sku.name);
            const sim = computeWeightedSkuSimilarity(decomp, sku, skuDecomp);
            if (sim.totalScore > orphanConfidenceScore) {
              orphanConfidenceScore = sim.totalScore;
              bestMatchedSku = sku;
              orphanStatus = 'PARTIAL_ORPHAN';
              bestMatchedComponents = {
                commodityMatch: sim.commodityScore >= 35,
                specMatch: sim.specScore >= 20,
                brandMatch: sim.brandScore >= 8 || sim.isBrandInSpec,
                partNumberMatch: sim.partNumberScore >= 8 || sim.goldenBoostApplied
              };
              orphanExplanation = `Tahap 5 Partial Match (${sim.totalScore}%): ${sim.matchExplanation} [${sku.productId}]`;
            }
          }
        }
      }

      if (val.txOrphanStatus === 'PARTIAL_ORPHAN') {
        orphanStatus = 'PARTIAL_ORPHAN';
        if (val.txConfidenceScore) orphanConfidenceScore = Math.max(orphanConfidenceScore, val.txConfidenceScore);
      }

      let candidateSkuId = val.candidateSkuId;
      let candidateSku: SkuMasterRecord | undefined;
      if (candidateSkuId) {
        candidateSku = masterSkuMap.get(candidateSkuId) || masterSkuMap.get(candidateSkuId.toLowerCase());
      }
      if (!candidateSku && bestMatchedSku) {
        candidateSku = bestMatchedSku;
        candidateSkuId = bestMatchedSku.productId || bestMatchedSku.id;
      }

      result.push({
        id: key,
        itemName: val.itemName,
        itemIds: Array.from(val.itemIds),
        commodityItem: decomp.commodityItem || val.itemName,
        generalSpec: decomp.generalSpec,
        brand: decomp.brand,
        partNumber: decomp.partNumber,
        orphanStatus,
        orphanConfidenceScore,
        orphanExplanation: val.candidateMatchReason || orphanExplanation,
        candidateSkuId,
        candidateSku,
        candidateMatchReason: val.candidateMatchReason,
        bestMatchedSku,
        bestMatchedComponents,
        procurementCategory: val.procurementCategory,
        mappedCategory: val.mappedCategory,
        purchUnits: Array.from(val.purchUnits),
        transactionCount: val.transactionCount,
        totalSpend: val.totalSpend,
        totalQty: val.totalQty,
        avgUnitPrice: Math.round(avgPrice),
        minUnitPrice: Math.round(minPrice),
        maxUnitPrice: Math.round(maxPrice),
        hospitals: hospArray,
        vendors: vendArray,
        samplePurchIds: Array.from(val.samplePurchIds).slice(0, 5),
        firstSeenDate: val.firstSeenDate,
        lastSeenDate: val.lastSeenDate,
        suggestedMatches: [] // Computed lazily on view / page render
      });
    });

    // Sort by total spend descending
    return result.sort((a, b) => b.totalSpend - a.totalSpend);
  }

  /**
   * Helper to retrieve SKU index quickly
   */
  getSkuIndex(masterSkus?: SkuMasterRecord[]): SkuIndex {
    return buildSkuIndex(masterSkus || this.cacheSkuMasters);
  }

  /**
   * Helper to get smart suggestions for an item on demand
   */
  getSuggestionsForItem(itemName: string, itemIds: string[], skuIndex?: SkuIndex): SuggestedSkuMatch[] {
    const index = skuIndex || this.getSkuIndex();
    return findSmartSkuSuggestionsFast(itemName, itemIds, index);
  }

  /**
   * Calculates overall Master Data Health & Synchronization statistics
   */
  getMaintenanceHealthStats(
    records?: SpendRecord[],
    skuMasters?: SkuMasterRecord[],
    hospitalMasters?: HospitalMasterRecord[],
    vendorMasters?: VendorMasterRecord[]
  ): MaintenanceHealthStats {
    const dataRecords = records || this.cacheRecords;
    const masterSkus = skuMasters || this.cacheSkuMasters;
    const masterHosp = hospitalMasters || this.cacheHospitalMasters;
    const masterVend = vendorMasters || this.cacheVendorMasters;

    const validSkuIds = new Set<string>();
    masterSkus.forEach(s => {
      if (s.id) validSkuIds.add(s.id);
      if (s.productId) validSkuIds.add(s.productId.toLowerCase().trim());
    });

    let totalTransactions = dataRecords.length;
    let matchedTransactions = 0;
    let partialOrphanTransactions = 0;
    let fullOrphanTransactions = 0;
    let totalSpendAmount = 0;
    let matchedSpendAmount = 0;
    let partialOrphanSpendAmount = 0;
    let fullOrphanSpendAmount = 0;

    const uniqueItemsMap = new Map<string, { isMatched: boolean; orphanStatus?: 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' }>();

    for (const r of dataRecords) {
      const spend = Number(r.totalLineAmount) || 0;
      totalSpendAmount += spend;

      const isMatched = Boolean(r.skuMasterId && validSkuIds.has(r.skuMasterId));
      if (isMatched) {
        matchedTransactions += 1;
        matchedSpendAmount += spend;
      } else {
        if (r.orphanStatus === 'PARTIAL_ORPHAN') {
          partialOrphanTransactions += 1;
          partialOrphanSpendAmount += spend;
        } else {
          fullOrphanTransactions += 1;
          fullOrphanSpendAmount += spend;
        }
      }

      const itemKey = (r.itemName || 'UNKNOWN').trim().toLowerCase();
      const existing = uniqueItemsMap.get(itemKey);
      if (!existing || (!existing.isMatched && isMatched)) {
        uniqueItemsMap.set(itemKey, { 
          isMatched: isMatched || (existing?.isMatched ?? false),
          orphanStatus: isMatched ? undefined : (r.orphanStatus === 'PARTIAL_ORPHAN' ? 'PARTIAL_ORPHAN' : 'FULL_ORPHAN')
        });
      }
    }

    const unmatchedTransactions = totalTransactions - matchedTransactions;
    const unmatchedSpendAmount = totalSpendAmount - matchedSpendAmount;

    let matchedUniqueItems = 0;
    let partialOrphanUniqueItems = 0;
    let fullOrphanUniqueItems = 0;

    uniqueItemsMap.forEach(entry => {
      if (entry.isMatched) {
        matchedUniqueItems += 1;
      } else if (entry.orphanStatus === 'PARTIAL_ORPHAN') {
        partialOrphanUniqueItems += 1;
      } else {
        fullOrphanUniqueItems += 1;
      }
    });

    const totalUniqueItemsInTx = uniqueItemsMap.size;
    const unmatchedUniqueItems = totalUniqueItemsInTx - matchedUniqueItems;

    let skusWithStandardPrice = 0;
    let skusWithFullTaxonomy = 0;

    masterSkus.forEach(s => {
      if (s.standardPrice && s.standardPrice > 0) skusWithStandardPrice += 1;
      if (s.purchCategoryLv1 && s.purchCategoryLv2 && s.purchCategoryLv3 && s.purchCategoryLv4) {
        skusWithFullTaxonomy += 1;
      }
    });

    return {
      totalTransactions,
      matchedTransactions,
      unmatchedTransactions,
      partialOrphanTransactions,
      fullOrphanTransactions,
      transactionMatchRatePct: totalTransactions > 0 ? (matchedTransactions / totalTransactions) * 100 : 0,
      totalSpendAmount,
      matchedSpendAmount,
      unmatchedSpendAmount,
      partialOrphanSpendAmount,
      fullOrphanSpendAmount,
      spendMatchRatePct: totalSpendAmount > 0 ? (matchedSpendAmount / totalSpendAmount) * 100 : 0,
      totalUniqueItemsInTx,
      matchedUniqueItems,
      unmatchedUniqueItems,
      partialOrphanUniqueItems,
      fullOrphanUniqueItems,
      itemMatchRatePct: totalUniqueItemsInTx > 0 ? (matchedUniqueItems / totalUniqueItemsInTx) * 100 : 0,
      totalMasterSkus: masterSkus.length,
      skusWithStandardPrice,
      skusMissingStandardPrice: masterSkus.length - skusWithStandardPrice,
      skusWithFullTaxonomy,
      skusMissingTaxonomy: masterSkus.length - skusWithFullTaxonomy,
      totalMasterHospitals: masterHosp.length,
      totalMasterVendors: masterVend.length
    };
  }

  /**
   * Loads maintenance data with persistent IndexedDB caching and non-blocking background evaluation.
   */
  async getMaintenanceData(
    options?: {
      forceRefresh?: boolean;
      onProgress?: (pct: number, msg: string) => void;
      inMemoryData?: {
        records?: SpendRecord[];
        skus?: SkuMasterRecord[];
        hospitals?: HospitalMasterRecord[];
        vendors?: VendorMasterRecord[];
      };
    }
  ): Promise<MaintenanceCacheData> {
    const records = options?.inMemoryData?.records || (this.isLoaded ? this.cacheRecords : await this.getAllRecords());
    const skuMasters = options?.inMemoryData?.skus || (this.isSkuLoaded ? this.cacheSkuMasters : await this.getSkuMasters());
    const hospitalMasters = options?.inMemoryData?.hospitals || (this.isHospitalLoaded ? this.cacheHospitalMasters : await this.getHospitalMasters());
    const vendorMasters = options?.inMemoryData?.vendors || (this.isVendorLoaded ? this.cacheVendorMasters : await this.getVendorMasters());

    // 1. Instant check in-memory cache
    if (!options?.forceRefresh && this.memoryMaintenanceCache) {
      if (
        this.memoryMaintenanceCache.recordsCount === records.length &&
        this.memoryMaintenanceCache.skusCount === skuMasters.length &&
        this.memoryMaintenanceCache.hospitalsCount === hospitalMasters.length &&
        this.memoryMaintenanceCache.vendorsCount === vendorMasters.length
      ) {
        return this.memoryMaintenanceCache;
      }
    }

    // 1b. Check if background worker staged maintenance cache
    if (!options?.forceRefresh) {
      const staged = backgroundJobManager.getStagedMaintenanceCache();
      if (staged && staged.recordsCount === records.length && staged.skusCount === skuMasters.length) {
        this.memoryMaintenanceCache = staged;
        return staged;
      }
    }

    // 2. Check persistent IndexedDB cache
    if (!options?.forceRefresh) {
      try {
        const dbCache = await getMaintenanceCache('maintenance_summary');
        if (dbCache) {
          if (
            dbCache.recordsCount === records.length &&
            dbCache.skusCount === skuMasters.length &&
            dbCache.hospitalsCount === hospitalMasters.length &&
            dbCache.vendorsCount === vendorMasters.length
          ) {
            this.memoryMaintenanceCache = dbCache;
            return dbCache;
          }
        }
      } catch (err) {
        console.warn('Failed to read maintenanceCache from IDB', err);
      }
    }

    // 3. Compute in background non-blocking chunks
    options?.onProgress?.(30, 'Membaca status kesehatan master data...');
    const healthStats = this.getMaintenanceHealthStats(records, skuMasters, hospitalMasters, vendorMasters);

    // Yield to browser event loop
    await new Promise(resolve => setTimeout(resolve, 0));

    options?.onProgress?.(70, 'Menganalisis item transaksi unmatched...');
    const unmatchedList = this.getUnmatchedItemsSummary(records, skuMasters);

    const cacheData: MaintenanceCacheData = {
      id: 'maintenance_summary',
      unmatchedList,
      healthStats,
      lastUpdated: new Date().toISOString(),
      recordsCount: records.length,
      skusCount: skuMasters.length,
      hospitalsCount: hospitalMasters.length,
      vendorsCount: vendorMasters.length
    };

    // 4. Save to memory & async save to IDB without blocking return
    this.memoryMaintenanceCache = cacheData;
    saveMaintenanceCache(cacheData).catch(err => {
      console.warn('Failed to save maintenanceCache to IDB', err);
    });

    options?.onProgress?.(100, 'Analisis selesai');
    return cacheData;
  }

  /**
   * Invalidates maintenance caches when underlying data changes.
   */
  invalidateMaintenanceCache() {
    this.memoryMaintenanceCache = null;
    this.memoryPrecalculatedAggregates = null;
    clearMaintenanceCache().catch(() => {});
    clearPrecalculatedAggregates().catch(() => {});
  }

  /**
   * Retrieves Precalculated Cube Aggregates from:
   * 1. In-memory cache
   * 2. Background worker staged cache
   * 3. IndexedDB 'precalculatedAggregates' table
   * 4. Automatic compute fallback if empty
   */
  async getPrecalculatedAggregates(forceRefresh = false): Promise<PrecalculatedCubeAggregates | null> {
    if (!forceRefresh) {
      if (this.memoryPrecalculatedAggregates) {
        return this.memoryPrecalculatedAggregates;
      }
      const staged = backgroundJobManager.getPrecalculatedCubeAggregates();
      if (staged) {
        this.memoryPrecalculatedAggregates = staged;
        return staged;
      }
      try {
        const stored = await getPrecalculatedAggregates('latest_aggregates');
        if (stored) {
          this.memoryPrecalculatedAggregates = stored;
          return stored;
        }
      } catch (err) {
        console.warn('Error fetching precalculatedAggregates from IDB:', err);
      }
    }

    // Fallback: Compute or trigger background worker
    const records = await this.getAllRecords();
    const skus = await this.getSkuMasters();
    if (records.length === 0) return null;

    // Trigger background worker non-blocking for subsequent refreshes
    backgroundJobManager.startFullStaging(records, skus, this.cacheHospitalMasters, this.cacheVendorMasters, undefined, true);

    const kpis = this.calculateKPIs(records);
    const healthStats = this.getMaintenanceHealthStats(records, skus);
    const monthlyTrend = this.getMonthlyTrend(records);
    const hospitalSpend = this.getHospitalSpend(records);
    const topCategories = this.getCategorySpend(records);
    const topVendors = this.getTopVendors(records);

    const orphanStats = {
      partialOrphanCount: healthStats.partialOrphanTransactions,
      partialOrphanSpend: healthStats.partialOrphanSpendAmount,
      fullOrphanCount: healthStats.fullOrphanTransactions,
      fullOrphanSpend: healthStats.fullOrphanSpendAmount,
      matchedSpendAmount: healthStats.matchedSpendAmount,
      totalSpendAmount: healthStats.totalSpendAmount,
      spendMatchRatePct: healthStats.spendMatchRatePct,
      itemMatchRatePct: healthStats.itemMatchRatePct
    };

    const topV = topVendors.slice(0, 5).map((v, i) => `${i + 1}. **${v.vendorName}**: IDR ${(v.spend / 1e9).toFixed(2)} Miliar (${v.transactionsCount} PO)`).join('\n');
    const topC = topCategories.slice(0, 5).map((c, i) => `${i + 1}. **${c.category}**: IDR ${(c.spend / 1e9).toFixed(2)} Miliar (${c.percentage.toFixed(1)}%)`).join('\n');
    const topH = hospitalSpend.slice(0, 5).map((h, i) => `${i + 1}. **${h.hospitalCode}**: IDR ${(h.spend / 1e9).toFixed(2)} Miliar (${h.percentage.toFixed(1)}%)`).join('\n');

    const aiSummaryPromptContext = `### Ringkasan Eksekutif Pengadaan Rumah Sakit (Precalculated SpendCube)
- **Total Belanja (Spend)**: IDR ${(kpis.totalSpend / 1e9).toFixed(2)} Miliar | **Total Transaksi**: ${kpis.totalTransactions.toLocaleString('id-ID')} PO
- **Struktur Belanja**: CAPEX IDR ${(kpis.totalCapexSpend / 1e9).toFixed(2)} Miliar (${((kpis.totalCapexSpend / Math.max(1, kpis.totalSpend)) * 100).toFixed(1)}%) | OPEX IDR ${(kpis.totalOpexSpend / 1e9).toFixed(2)} Miliar (${((kpis.totalOpexSpend / Math.max(1, kpis.totalSpend)) * 100).toFixed(1)}%)
- **Entitas & Rekanan**: ${kpis.uniqueVendors} Vendor Aktif di ${kpis.uniqueHospitals} Unit Rumah Sakit | Rata-rata Nilai PO: IDR ${(kpis.averagePoAmount / 1e6).toFixed(2)} Juta
- **Kualitas Sinkronisasi Master Data**: Item Match Rate: ${healthStats.itemMatchRatePct.toFixed(1)}% | Spend Match Rate: ${healthStats.spendMatchRatePct.toFixed(1)}%
  - Partial Orphan: ${healthStats.partialOrphanTransactions} transaksi (IDR ${(healthStats.partialOrphanSpendAmount / 1e9).toFixed(2)} Miliar)
  - Full Orphan: ${healthStats.fullOrphanTransactions} transaksi (IDR ${(healthStats.fullOrphanSpendAmount / 1e9).toFixed(2)} Miliar)

#### 5 Vendor Terbesar:
${topV}

#### 5 Kategori Terbesar:
${topC}

#### 5 Unit RS Terbesar:
${topH}
`;

    const aggregates: PrecalculatedCubeAggregates = {
      id: 'latest_aggregates',
      computedAt: new Date().toISOString(),
      recordsCount: records.length,
      skusCount: skus.length,
      kpis,
      monthlyTrend,
      hospitalSpend,
      topCategories,
      topVendors,
      orphanStats,
      healthStats,
      aiSummaryPromptContext
    };

    this.memoryPrecalculatedAggregates = aggregates;
    savePrecalculatedAggregates(aggregates).catch(err => console.warn('Failed to save precalculated aggregates to IDB', err));
    return aggregates;
  }

  /**
   * AI API Integration Method:
   * Returns high-level pre-formatted summary for executive or conversational AI queries (< 400 tokens)
   */
  async getAISummaryContext(): Promise<string> {
    const agg = await this.getPrecalculatedAggregates();
    if (agg?.aiSummaryPromptContext) {
      return agg.aiSummaryPromptContext;
    }
    const records = await this.getAllRecords();
    const kpis = this.calculateKPIs(records);
    return `Total Spend: IDR ${(kpis.totalSpend / 1e9).toFixed(2)} Miliar across ${kpis.totalTransactions} transactions.`;
  }

  /**
   * AI API Integration Method:
   * Returns filtered, detailed transaction line items when AI needs granular audit records
   */
  async getAIDetailedTransactions(filter?: Partial<SpendFilterCriteria>, limit = 100): Promise<SpendRecord[]> {
    const records = await this.getAllRecords();
    let filtered = records;
    if (filter?.hospitalCode) {
      filtered = filtered.filter(r => r.hospitalCode?.toLowerCase() === filter.hospitalCode?.toLowerCase());
    }
    if (filter?.vendorName) {
      filtered = filtered.filter(r => r.vendorName?.toLowerCase().includes(filter.vendorName!.toLowerCase()));
    }
    if (filter?.category) {
      filtered = filtered.filter(r => (r.procurementCategory || r.mappedCategory)?.toLowerCase().includes(filter.category!.toLowerCase()));
    }
    if (filter?.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        (r.itemName?.toLowerCase().includes(q)) || 
        (r.commodityItem?.toLowerCase().includes(q)) || 
        (r.itemId?.toLowerCase().includes(q)) ||
        (r.purchId?.toLowerCase().includes(q))
      );
    }
    return filtered.slice(0, limit);
  }


  /**
   * Manually maps all transactions containing a specific item name or item ID to an existing SKU Master.
   */
  async manuallyMapItemToSku(
    itemNameToMap: string,
    targetSkuId: string
  ): Promise<{ affectedCount: number; updatedRecords: SpendRecord[] }> {
    const targetSku = this.cacheSkuMasters.find(s => s.id === targetSkuId || s.productId === targetSkuId);
    if (!targetSku) {
      throw new Error(`Master SKU dengan ID "${targetSkuId}" tidak ditemukan.`);
    }

    const cleanTargetName = itemNameToMap.trim().toLowerCase();
    let affectedCount = 0;

    this.cacheRecords = this.cacheRecords.map(r => {
      const rName = (r.itemName || '').trim().toLowerCase();
      const rRaw = (r.rawItemName || '').trim().toLowerCase();
      const rId = (r.itemId || '').trim().toLowerCase();

      if (rName === cleanTargetName || rRaw === cleanTargetName || (r.itemId && rId === cleanTargetName)) {
        affectedCount += 1;
        const lv1 = (targetSku.purchCategoryLv1 || 'General').trim();
        const lv2 = (targetSku.purchCategoryLv2 || lv1).trim();
        const lv3 = (targetSku.purchCategoryLv3 || lv2).trim();
        const lv4 = (targetSku.purchCategoryLv4 || lv3).trim();
        return {
          ...r,
          skuMasterId: targetSku.id,
          matchTier: 'MANUAL',
          orphanStatus: 'EXACT_MATCH',
          orphanConfidenceScore: 100,
          orphanMatchReason: 'Manual mapping oleh pengguna',
          taxonomyLv1: lv1,
          taxonomyLv2: lv2,
          taxonomyLv3: lv3,
          taxonomyLv4: lv4,
          taxonomyLv5: targetSku.name || r.itemName
        };
      }
      return r;
    });

    const cacheEntry: SkuMappingCacheRecord = {
      itemKey: cleanTargetName,
      rawItemName: itemNameToMap,
      matchedSkuId: targetSku.id,
      orphanStatus: 'EXACT_MATCH',
      matchTier: 'MANUAL',
      confidenceScore: 100,
      matchReason: 'Manual mapping oleh pengguna',
      matchedSku: targetSku,
      taxonomy: {
        taxonomyLv1: (targetSku.purchCategoryLv1 || 'General').trim(),
        taxonomyLv2: (targetSku.purchCategoryLv2 || targetSku.purchCategoryLv1 || 'General').trim(),
        taxonomyLv3: (targetSku.purchCategoryLv3 || targetSku.purchCategoryLv2 || 'General').trim(),
        taxonomyLv4: (targetSku.purchCategoryLv4 || targetSku.purchCategoryLv3 || 'General').trim(),
        taxonomyLv5: targetSku.name || itemNameToMap,
        brand: targetSku.brand || '',
        spec: targetSku.generalSpec || targetSku.specification1 || '',
        partNumber: targetSku.partNumber || ''
      },
      updatedAt: Date.now()
    };
    this.skuMappingCacheMap.set(cleanTargetName, cacheEntry);
    await saveSingleSkuMappingCache(cacheEntry);

    await saveSpendRecords(this.cacheRecords);
    this.invalidateMaintenanceCache();
    return { affectedCount, updatedRecords: this.cacheRecords };
  }

  /**
   * Quickly creates a new SKU Master record from an unmatched item and links existing transactions.
   */
  async quickAddSkuFromUnmatched(
    newSkuData: Partial<SkuMasterRecord>
  ): Promise<{ savedSku: SkuMasterRecord; affectedTransactions: number; allSkus: SkuMasterRecord[] }> {
    const id = newSkuData.id || `SKU-${Date.now()}`;
    const productId = newSkuData.productId || `PRD-${Math.floor(100000 + Math.random() * 900000)}`;

    const fullSku: SkuMasterRecord = {
      id,
      productId,
      name: newSkuData.name || 'Unnamed Product',
      purchCategoryLv1: newSkuData.purchCategoryLv1 || 'Medical & Hospital Supplies',
      purchCategoryLv2: newSkuData.purchCategoryLv2 || 'Consumables',
      purchCategoryLv3: newSkuData.purchCategoryLv3 || 'General Consumables',
      purchCategoryLv4: newSkuData.purchCategoryLv4 || 'Unassigned Subcategory',
      prItemId: newSkuData.prItemId || productId,
      prFaCategory: newSkuData.prFaCategory || '',
      cprItemId: newSkuData.cprItemId || '',
      cprFaCategory: newSkuData.cprFaCategory || '',
      spItemId: newSkuData.spItemId || '',
      unitOfMeasurement: newSkuData.unitOfMeasurement || 'PCS',
      isGenericProduct: newSkuData.isGenericProduct ?? true,
      brand: newSkuData.brand || 'Generic',
      specification1: newSkuData.specification1 || '',
      specification2: newSkuData.specification2 || '',
      specification3: newSkuData.specification3 || '',
      partNumber: newSkuData.partNumber || '',
      standardPrice: Number(newSkuData.standardPrice) || 0,
      isActive: newSkuData.isActive ?? true,
      isContract: newSkuData.isContract ?? false
    };

    fullSku.formattedSkuName = getFormattedSkuName(fullSku);

    // Save to master SKU list
    const updatedSkus = await this.addSkuMasters([fullSku]);

    // Map existing transactions
    const mappingResult = await this.manuallyMapItemToSku(fullSku.name, fullSku.id);
    this.invalidateMaintenanceCache();

    return {
      savedSku: fullSku,
      affectedTransactions: mappingResult.affectedCount,
      allSkus: updatedSkus
    };
  }

  /**
   * Bulk updates taxonomy classifications for multiple item names.
   */
  async bulkMapCategory(
    itemNames: string[],
    targetTaxonomy: { lv1: string; lv2: string; lv3: string; lv4: string }
  ): Promise<{ affectedCount: number; updatedRecords: SpendRecord[] }> {
    const itemNamesSet = new Set(itemNames.map(n => n.trim().toLowerCase()));
    let affectedCount = 0;

    this.cacheRecords = this.cacheRecords.map(r => {
      const rName = (r.itemName || '').trim().toLowerCase();
      if (itemNamesSet.has(rName)) {
        affectedCount += 1;
        return {
          ...r,
          taxonomyLv1: targetTaxonomy.lv1,
          taxonomyLv2: targetTaxonomy.lv2,
          taxonomyLv3: targetTaxonomy.lv3,
          taxonomyLv4: targetTaxonomy.lv4,
          mappedCategory: targetTaxonomy.lv1
        };
      }
      return r;
    });

    await saveSpendRecords(this.cacheRecords);
    this.invalidateMaintenanceCache();
    return { affectedCount, updatedRecords: this.cacheRecords };
  }

  /**
   * Re-evaluates entire spend records against current SKU Master list in non-blocking batches.
   */
  async reconcileAllTransactionsWithSkuMasters(
    onProgress?: (pct: number, msg: string) => void
  ): Promise<{ total: number; newlyMatched: number; totalMatched: number; matchRatePct: number }> {
    onProgress?.(10, 'Memuat direktori SKU Master & database transaksi...');
    const skuMasters = await this.getSkuMasters();
    const records = await this.getAllRecords();

    const total = records.length;
    let newlyMatched = 0;
    let totalMatched = 0;

    onProgress?.(30, 'Mengindeks SKU Hash Map & menjalankan algoritma pencocokan...');
    const enriched = this.enrichRecordsWithSkuMapping(records, skuMasters);

    for (let i = 0; i < total; i++) {
      const prev = records[i];
      const next = enriched[i];

      if (next.skuMasterId) {
        totalMatched += 1;
        if (!prev.skuMasterId) {
          newlyMatched += 1;
        }
      }
    }

    onProgress?.(70, 'Menyimpan hasil sinkronisasi ke IndexedDB...');
    this.cacheRecords = enriched;
    await saveSpendRecords(enriched);
    this.invalidateMaintenanceCache();

    onProgress?.(100, 'Sinkronisasi selesai!');

    const matchRatePct = total > 0 ? (totalMatched / total) * 100 : 0;
    return {
      total,
      newlyMatched,
      totalMatched,
      matchRatePct
    };
  }
}

export const spendService = new SpendService();

