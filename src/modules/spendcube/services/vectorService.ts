import { SkuMasterRecord, SpendRecord } from '../../../core/types/spend';

export interface VectorSearchResult<T> {
  item: T;
  score: number; // Cosine similarity score between 0 and 1
  matchedReason: string;
}

const BILINGUAL_SYNONYMS: Record<string, string[]> = {
  // Medical
  'syringe': ['jarum', 'suntik', 'spuit', 'syringe'],
  'jarum': ['syringe', 'needle', 'jarum', 'suntik'],
  'needle': ['jarum', 'needle', 'suntik'],
  'surgical': ['bedah', 'operasi', 'surgical', 'surgery'],
  'bedah': ['surgical', 'surgery', 'bedah', 'operasi'],
  'medicine': ['obat', 'farmasi', 'medication', 'drug', 'medicine'],
  'obat': ['medicine', 'drug', 'medication', 'pharmacy', 'farmasi', 'obat'],
  'hospital': ['rumah sakit', 'hospital', 'klinik', 'rs'],
  'rumah sakit': ['hospital', 'rs', 'klinik'],
  'equipment': ['alat', 'mesin', 'device', 'equipment', 'instrument'],
  'alat': ['equipment', 'device', 'instrument', 'alat'],
  'consumables': ['habis pakai', 'bhp', 'consumables', 'disposable'],
  'gloves': ['sarung tangan', 'handscoon', 'gloves'],
  'sarung tangan': ['gloves', 'handscoon'],
  'infus': ['infusion', 'iv set', 'infus', 'cairan'],
  'infusion': ['infus', 'iv set', 'cairan'],
  'blood': ['darah', 'blood', 'hematology'],
  'darah': ['blood'],
  'heart': ['jantung', 'cardiac', 'heart'],
  'jantung': ['cardiac', 'heart'],
  'scan': ['scanning', 'radiology', 'imaging', 'scan'],
  'bed': ['tempat tidur', 'bed', 'tt'],

  // IT & Technology
  'it': ['information technology', 'teknologi', 'komputer', 'it', 'digital', 'software', 'hardware'],
  'computer': ['komputer', 'pc', 'laptop', 'desktop', 'computer'],
  'laptop': ['notebook', 'laptop', 'komputer jinjing'],
  'server': ['server', 'storage', 'rack', 'datacenter', 'cloud'],
  'software': ['licensing', 'license', 'aplikasi', 'software', 'subscriptions'],
  'license': ['lisensi', 'license', 'subscription', 'software'],
  'network': ['jaringan', 'cisco', 'switch', 'router', 'cable', 'network', 'lan', 'wifi'],
  'printer': ['printer', 'scanner', 'tinta', 'toner', 'print'],

  // Construction & Civil / Facilities
  'construction': ['kontruksi', 'konstruksi', 'sipil', 'building', 'renovasi', 'remodel', 'civil'],
  'kontruksi': ['konstruksi', 'construction', 'sipil', 'renovasi', 'building'],
  'sipil': ['civil', 'construction', 'kontruksi', 'bangunan'],
  'renovasi': ['renovation', 'repair', 'maintenance', 'perbaikan', 'fitout'],
  'material': ['semen', 'besi', 'pasir', 'cat', 'building material', 'bahan bangunan'],
  'facilities': ['fasilitas', 'mep', 'hvac', 'ac', 'chiller', 'lift', 'elevator', 'plumbing', 'electrical', 'listrik'],

  // General Supplies & Office
  'general': ['umum', 'general', 'other', 'lainnya'],
  'atk': ['stationery', 'alat tulis', 'kertas', 'paper', 'pen', 'office supplies'],
  'stationery': ['atk', 'alat tulis kantor', 'stationery', 'kertas'],
  'cleaning': ['housekeeping', 'cleaning service', 'pembersih', 'chemical', 'tissue', 'trash bag'],
  'pantry': ['konsumsi', 'snack', 'makanan', 'minuman', 'coffee', 'pantry'],
  'furniture': ['meja', 'kursi', 'cabinet', 'lemari', 'furniture', 'desk', 'chair'],

  // Services
  'service': ['jasa', 'layanan', 'service', 'maintenance', 'repair', 'cleaning', 'security'],
  'jasa': ['service', 'services', 'layanan', 'outsourcing', 'konsultan', 'consultant'],
  'consultant': ['konsultan', 'advisor', 'consultant', 'professional fee'],
  'outsourcing': ['tenaga kerja', 'alih daya', 'outsourcing', 'contractor', 'vendor'],
  'maintenance': ['pemeliharaan', 'perawatan', 'maintenance', 'service', 'calibration', 'kalibrasi'],

  // Financial & General
  'capex': ['capital', 'investasi', 'aset', 'capex'],
  'opex': ['operasional', 'routine', 'opex'],
};

export class VectorDatabaseService {
  private static instance: VectorDatabaseService;

  // 4-Part separated vector caches: Name, Spec, Brand, PartNumber
  // Eliminates redundant API calls for duplicate names with different specs/brands
  private nameEmbeddings: Map<string, { vector: number[]; hash: string }> = new Map();
  private specEmbeddings: Map<string, { vector: number[]; hash: string }> = new Map();
  private brandEmbeddings: Map<string, { vector: number[]; hash: string }> = new Map();
  private partNumberEmbeddings: Map<string, { vector: number[]; hash: string }> = new Map();
  private indexedSkuIds: Set<string> = new Set();
  private lastIndexedSkuCount = 0;

  private constructor() {}

  public static getInstance(): VectorDatabaseService {
    if (!VectorDatabaseService.instance) {
      VectorDatabaseService.instance = new VectorDatabaseService();
    }
    return VectorDatabaseService.instance;
  }

  private expandBilingualText(text: string): string {
    const cleaned = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const expandedTokens: string[] = [...tokens];

    for (const token of tokens) {
      const synonyms = BILINGUAL_SYNONYMS[token];
      if (synonyms) {
        expandedTokens.push(...synonyms);
      }
    }

    return expandedTokens.join(' ');
  }

  private calculateHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  private textToVector(text: string): number[] {
    const expanded = this.expandBilingualText(text);
    const tokens = expanded.split(/\s+/).filter(Boolean);
    const vector = new Array(32).fill(0);
    
    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash * 31 + token.charCodeAt(i)) % 32;
      }
      vector[Math.abs(hash)] += 1;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Index SKU Masters split across 4 distinct parts:
   * 1. Name
   * 2. Spec (specification1, 2, 3)
   * 3. Brand
   * 4. Part Number
   * Reuses cache per part so items sharing names but differing in specs do not trigger duplicate API/compute calls.
   */
  public indexSkuMasters(skuMasters: SkuMasterRecord[]): { newlyGenerated: number; reusedFromCache: number; totalVectorized: number } {
    let newlyGenerated = 0;
    let reusedFromCache = 0;
    this.indexedSkuIds.clear();

    for (const sku of skuMasters) {
      const id = sku.id || sku.productId;
      if (id) this.indexedSkuIds.add(id);

      const nameText = (sku.name || '').trim();
      const specText = `${sku.specification1 || ''} ${sku.specification2 || ''} ${sku.specification3 || ''}`.trim();
      const brandText = (sku.brand || '').trim();
      const partNumText = (sku.partNumber || sku.productId || '').trim();

      // 1. Name part
      if (nameText) {
        const key = nameText.toLowerCase();
        const hash = this.calculateHash(nameText);
        const existing = this.nameEmbeddings.get(key);
        if (existing && existing.hash === hash) {
          reusedFromCache += 1;
        } else {
          this.nameEmbeddings.set(key, { vector: this.textToVector(nameText), hash });
          newlyGenerated += 1;
        }
      }

      // 2. Spec part
      if (specText) {
        const key = specText.toLowerCase();
        const hash = this.calculateHash(specText);
        const existing = this.specEmbeddings.get(key);
        if (existing && existing.hash === hash) {
          reusedFromCache += 1;
        } else {
          this.specEmbeddings.set(key, { vector: this.textToVector(specText), hash });
          newlyGenerated += 1;
        }
      }

      // 3. Brand part
      if (brandText) {
        const key = brandText.toLowerCase();
        const hash = this.calculateHash(brandText);
        const existing = this.brandEmbeddings.get(key);
        if (existing && existing.hash === hash) {
          reusedFromCache += 1;
        } else {
          this.brandEmbeddings.set(key, { vector: this.textToVector(brandText), hash });
          newlyGenerated += 1;
        }
      }

      // 4. Part Number part
      if (partNumText) {
        const key = partNumText.toLowerCase();
        const hash = this.calculateHash(partNumText);
        const existing = this.partNumberEmbeddings.get(key);
        if (existing && existing.hash === hash) {
          reusedFromCache += 1;
        } else {
          this.partNumberEmbeddings.set(key, { vector: this.textToVector(partNumText), hash });
          newlyGenerated += 1;
        }
      }
    }

    this.lastIndexedSkuCount = skuMasters.length;
    console.log(`[VectorEngine 4-Part] Indexed SKU Masters: ${newlyGenerated} newly generated parts, ${reusedFromCache} reused from cache.`);
    return { newlyGenerated, reusedFromCache, totalVectorized: this.indexedSkuIds.size };
  }

  public getVectorStats(skuMasters: SkuMasterRecord[]) {
    const totalSkuCount = skuMasters.length;
    let vectorizedCount = 0;
    for (const sku of skuMasters) {
      const id = sku.id || sku.productId;
      const nameKey = (sku.name || '').trim().toLowerCase();
      if ((id && this.indexedSkuIds.has(id)) || (nameKey && this.nameEmbeddings.has(nameKey))) {
        vectorizedCount++;
      }
    }
    return {
      totalSkuCount,
      vectorizedCount,
      percentage: totalSkuCount > 0 ? (vectorizedCount / totalSkuCount) * 100 : 0
    };
  }

  public getUnmappedTransactionStats(records: SpendRecord[], skuMasters: SkuMasterRecord[]) {
    if (records.length === 0) return { unmappedCount: 0, unmappedSpend: 0, percentageTransactions: 0, percentageSpend: 0 };

    const skuProductIds = new Set(skuMasters.map(s => (s.productId || s.id || '').toLowerCase()).filter(Boolean));
    const skuNames = new Set(skuMasters.map(s => (s.name || '').toLowerCase()).filter(Boolean));

    let unmappedCount = 0;
    let unmappedSpend = 0;
    let totalSpend = 0;

    for (const r of records) {
      const spend = Number(r.totalLineAmount) || 0;
      totalSpend += spend;

      // Fast-path: Check pre-enriched orphanStatus or skuMasterId
      if (r.orphanStatus !== undefined) {
        if (r.orphanStatus !== 'EXACT_MATCH' && !r.skuMasterId) {
          unmappedCount++;
          unmappedSpend += spend;
        }
        continue;
      }

      const itemId = (r.itemId || '').toLowerCase();
      const itemName = (r.itemName || r.purchReqName || '').toLowerCase();

      const isMapped = (itemId && skuProductIds.has(itemId)) || 
                       (itemName && (skuNames.has(itemName) || this.nameEmbeddings.has(itemName))) || 
                       this.indexedSkuIds.has(r.id);

      if (!isMapped) {
        unmappedCount++;
        unmappedSpend += spend;
      }
    }

    return {
      unmappedCount,
      unmappedSpend,
      percentageTransactions: (unmappedCount / records.length) * 100,
      percentageSpend: totalSpend > 0 ? (unmappedSpend / totalSpend) * 100 : 0
    };
  }

  public searchSkusSemantic(query: string, skuMasters: SkuMasterRecord[], limit: number = 10, excludeKeywords: string[] = []): VectorSearchResult<SkuMasterRecord>[] {
    if (this.nameEmbeddings.size === 0 && skuMasters.length > 0) {
      this.indexSkuMasters(skuMasters);
    }

    const queryVec = this.textToVector(query);
    const normalizedExcludes = excludeKeywords.map(e => e.trim().toLowerCase()).filter(Boolean);
    const results: VectorSearchResult<SkuMasterRecord>[] = [];

    for (const sku of skuMasters) {
      const nameKey = (sku.name || '').trim().toLowerCase();
      const specKey = `${sku.specification1 || ''} ${sku.specification2 || ''} ${sku.specification3 || ''}`.trim().toLowerCase();
      const brandKey = (sku.brand || '').trim().toLowerCase();
      const partKey = (sku.partNumber || sku.productId || '').trim().toLowerCase();

      // Check Excludes first (Zero false positives)
      const fullCorpus = `${nameKey} ${specKey} ${brandKey} ${partKey}`;
      if (normalizedExcludes.length > 0 && normalizedExcludes.some(exc => fullCorpus.includes(exc))) {
        continue;
      }

      const nameCached = this.nameEmbeddings.get(nameKey);
      const specCached = this.specEmbeddings.get(specKey);
      const brandCached = this.brandEmbeddings.get(brandKey);
      const partCached = this.partNumberEmbeddings.get(partKey);

      let maxScore = 0;
      let matchedPart = 'Name';

      // 1. Primary Commodity Name Match (Highest priority)
      if (nameCached) {
        const score = this.cosineSimilarity(queryVec, nameCached.vector);
        if (score > maxScore) {
          maxScore = score;
          matchedPart = 'Commodity Name';
        }
      }

      // 2. Part Number Match
      if (partCached) {
        const score = this.cosineSimilarity(queryVec, partCached.vector) * 0.95;
        if (score > maxScore) {
          maxScore = score;
          matchedPart = 'Part Number';
        }
      }

      // 3. Brand Match
      if (brandCached) {
        const score = this.cosineSimilarity(queryVec, brandCached.vector) * 0.8;
        if (score > maxScore) {
          maxScore = score;
          matchedPart = 'Brand';
        }
      }

      // 4. Spec Match (If only spec matches but name doesn't, penalize to prevent false positive commodities like Paper Cup for Kertas)
      if (specCached) {
        let specScore = this.cosineSimilarity(queryVec, specCached.vector);
        // If name had no match at all, down-weight spec so cups/containers don't overtake actual paper products
        if (maxScore < 0.2) {
          specScore = specScore * 0.4;
        } else {
          specScore = specScore * 0.75;
        }
        if (specScore > maxScore) {
          maxScore = specScore;
          matchedPart = 'Specification';
        }
      }

      if (maxScore > 0.15) {
        results.push({
          item: sku,
          score: maxScore,
          matchedReason: `${matchedPart} Match (${(maxScore * 100).toFixed(1)}%)`
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  public searchTaxonomySemantic(query: string, records: SpendRecord[], limit: number = 10): VectorSearchResult<{ taxonomyLv1: string; taxonomyLv2: string; count: number; spend: number }>[] {
    const taxMap = new Map<string, { lv1: string; lv2: string; count: number; spend: number }>();
    for (const r of records) {
      const isOrphan = !r.skuMasterId || r.orphanStatus === 'FULL_ORPHAN' || r.orphanStatus === 'PARTIAL_ORPHAN';
      const lv1 = r.taxonomyLv1 || (isOrphan ? 'UNMAPPED / ORPHAN PO' : 'General');
      const lv2 = r.taxonomyLv2 || r.procurementCategory || 'General Supplies';
      const key = `${lv1}___${lv2}`;
      const existing = taxMap.get(key) || { lv1, lv2, count: 0, spend: 0 };
      existing.count += 1;
      existing.spend += Number(r.totalLineAmount) || 0;
      taxMap.set(key, existing);
    }

    const queryVec = this.textToVector(query);
    const results: VectorSearchResult<any>[] = [];

    for (const [key, data] of taxMap.entries()) {
      const corpus = `${data.lv1} ${data.lv2} procurement hospital kategori pengadaan`;
      const vec = this.textToVector(corpus);
      const score = this.cosineSimilarity(queryVec, vec);
      results.push({
        item: { taxonomyLv1: data.lv1, taxonomyLv2: data.lv2, count: data.count, spend: data.spend },
        score,
        matchedReason: `Bilingual taxonomy index match (${(score * 100).toFixed(1)}%)`
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export const vectorService = VectorDatabaseService.getInstance();
