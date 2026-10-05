/**
 * Dedicated Web Worker for Spend Analytics & Staging Pre-computation
 * Runs fully in a separate background thread to keep the main UI thread at 60 FPS
 */

import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord, 
  SpendSummaryKPIs,
  decomposeSkuString,
  ParsedSkuComponents,
  normalizeSkuSyntax,
  normalizeSpecString,
  isSpecSlotEmpty,
  splitItemNameAndNotes,
  UnmatchedItemSummary,
  MaintenanceHealthStats,
  MaintenanceCacheData,
  PrecalculatedCubeAggregates,
  HospitalSpendItem,
  CategorySpendItem,
  VendorSpendItem,
  MonthlyTrendItem,
  computeWeightedSkuSimilarity,
  computeTokenSetSimilarity,
  hasConflictingNumbers,
  hasConflictingModifiers,
  SkuMappingCacheRecord
} from '../types/spend';
import { priceIntelligenceService } from '../../modules/spendcube/services/priceIntelligenceService';
import { clusterSpendTransactions } from '../../modules/contractTargeting/services/semanticClusteringEngine';
import { discoverDepartmentsFromRecords } from '../../modules/spendcube/services/sampleDepartmentData';
import { 
  WorkerIncomingMessage, 
  FullStagingResultPayload, 
  PrecomputedPriceIntelligence, 
  PrecomputedContractTargeting,
  BackgroundJobType
} from '../types/staging';

// Helper to post progress back to main thread
function notifyProgress(
  jobId: string,
  stage: string,
  percent: number,
  message: string,
  processedItems: number,
  totalItems: number,
  jobType: BackgroundJobType = 'FULL_STAGING_PIPELINE'
) {
  self.postMessage({
    type: 'PROGRESS',
    jobId,
    jobType,
    stage,
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    message,
    processedItems,
    totalItems,
    timestamp: Date.now()
  });
}

interface PrecomputedSkuInfo {
  sku: SkuMasterRecord;
  decomp: ParsedSkuComponents;
  commodityClean: string;
  spec: string;
  spec1?: string | null;
  spec2?: string | null;
  spec3?: string | null;
  brand: string;
  part: string;
}

/**
 * Computes Master Data Maintenance Cache, Orphan Classification & Health Stats
 * High-speed background computation with O(1) indexed lookup
 */
async function computeWorkerMaintenanceCache(
  records: SpendRecord[],
  skuMasters: SkuMasterRecord[]
): Promise<{ maintenanceCache: MaintenanceCacheData; healthStats: MaintenanceHealthStats }> {
  const validSkuIds = new Set<string>();
  const precomputedSkus: PrecomputedSkuInfo[] = [];
  const commodityMap = new Map<string, PrecomputedSkuInfo[]>();
  const tokenToSkuMap = new Map<string, PrecomputedSkuInfo[]>();
  const partToSkuMap = new Map<string, PrecomputedSkuInfo>();

  for (const s of skuMasters) {
    if (!s) continue;
    if (s.id) validSkuIds.add(s.id);
    if (s.productId) validSkuIds.add(s.productId.toLowerCase().trim());

    const skuDecomp = decomposeSkuString(s.formattedSkuName || s.name);
    const commClean = (s.commodityItem || skuDecomp.commodityItem || s.name || '').replace(/\s+/g, ' ').toLowerCase().trim();
    const info: PrecomputedSkuInfo = {
      sku: s,
      decomp: skuDecomp,
      commodityClean: commClean,
      spec: normalizeSpecString(s.generalSpec || skuDecomp.generalSpec || s.specification1),
      spec1: skuDecomp.spec1,
      spec2: skuDecomp.spec2,
      spec3: skuDecomp.spec3,
      brand: (s.brand || skuDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim(),
      part: (s.partNumber || skuDecomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim()
    };
    precomputedSkus.push(info);

    if (commClean) {
      let list = commodityMap.get(commClean);
      if (!list) {
        list = [];
        commodityMap.set(commClean, list);
      }
      list.push(info);

      const tokens = commClean.split(/\s+/).filter(t => t.length > 2);
      for (const t of tokens) {
        let tList = tokenToSkuMap.get(t);
        if (!tList) {
          tList = [];
          tokenToSkuMap.set(t, tList);
        }
        if (tList.length < 35) {
          tList.push(info);
        }
      }
    }

    if (info.part && info.part.length > 2 && info.part !== 'np') {
      partToSkuMap.set(info.part, info);
    }
  }

  // Group unmatched transactions by itemName
  const unmatchedGroups = new Map<string, {
    itemName: string;
    itemIds: Set<string>;
    procurementCategory: string;
    mappedCategory: string;
    purchUnits: Set<string>;
    transactionCount: number;
    totalSpend: number;
    totalQty: number;
    sumUnitPrice: number;
    countUnitPrice: number;
    minUnitPrice: number;
    maxUnitPrice: number;
    hospitals: Map<string, { count: number; spend: number }>;
    vendors: Map<string, { count: number; spend: number }>;
    samplePurchIds: Set<string>;
    firstSeenDate?: string;
    lastSeenDate?: string;
  }>();

  const totalTransactions = records.length;
  let matchedTransactions = 0;
  let partialOrphanTransactions = 0;
  let fullOrphanTransactions = 0;
  let totalSpendAmount = 0;
  let matchedSpendAmount = 0;
  let partialOrphanSpendAmount = 0;
  let fullOrphanSpendAmount = 0;

  const uniqueItemsMap = new Map<string, { isMatched: boolean; orphanStatus?: 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' }>();

  // Pass 1: Build groups and track matched vs unmatched
  for (const r of records) {
    const spend = Number(r.totalLineAmount) || 0;
    totalSpendAmount += spend;

    const isMatched = Boolean(r.skuMasterId && validSkuIds.has(r.skuMasterId) && r.orphanStatus === 'EXACT_MATCH');
    if (isMatched) {
      matchedTransactions += 1;
      matchedSpendAmount += spend;
    } else {
      const { itemName: cleanItemName } = splitItemNameAndNotes(r.rawItemName || r.itemName);
      const rawName = (cleanItemName || r.itemName || 'UNSPECIFIED ITEM').trim();
      const groupKey = rawName.toLowerCase();
      let group = unmatchedGroups.get(groupKey);
      if (!group) {
        group = {
          itemName: rawName,
          itemIds: new Set<string>(),
          procurementCategory: r.procurementCategory || 'General',
          mappedCategory: r.mappedCategory || 'General Consumables',
          purchUnits: new Set<string>(),
          transactionCount: 0,
          totalSpend: 0,
          totalQty: 0,
          sumUnitPrice: 0,
          countUnitPrice: 0,
          minUnitPrice: Infinity,
          maxUnitPrice: -Infinity,
          hospitals: new Map(),
          vendors: new Map(),
          samplePurchIds: new Set()
        };
        unmatchedGroups.set(groupKey, group);
      }

      group.transactionCount += 1;
      group.totalSpend += spend;
      group.totalQty += (Number(r.purchQty) || 0);

      if (r.itemId) group.itemIds.add(r.itemId);
      if (r.purchUnit) group.purchUnits.add(r.purchUnit);
      if (r.purchId) group.samplePurchIds.add(r.purchId);

      const price = Number(r.purchPrice || (r as any).unitPrice) || 0;
      if (price > 0) {
        group.sumUnitPrice += price;
        group.countUnitPrice += 1;
        if (price < group.minUnitPrice) group.minUnitPrice = price;
        if (price > group.maxUnitPrice) group.maxUnitPrice = price;
      }

      const hosp = r.hospitalCode || 'UNKNOWN';
      const hData = group.hospitals.get(hosp) || { count: 0, spend: 0 };
      hData.count += 1;
      hData.spend += spend;
      group.hospitals.set(hosp, hData);

      const vend = r.vendorName || 'UNKNOWN VENDOR';
      const vData = group.vendors.get(vend) || { count: 0, spend: 0 };
      vData.count += 1;
      vData.spend += spend;
      group.vendors.set(vend, vData);

      if (r.createdDate) {
        if (!group.firstSeenDate || r.createdDate < group.firstSeenDate) group.firstSeenDate = r.createdDate;
        if (!group.lastSeenDate || r.createdDate > group.lastSeenDate) group.lastSeenDate = r.createdDate;
      }
    }

    const itemKey = (r.itemName || 'UNKNOWN').trim().toLowerCase();
    const existing = uniqueItemsMap.get(itemKey);
    if (!existing || (!existing.isMatched && isMatched)) {
      uniqueItemsMap.set(itemKey, {
        isMatched: isMatched || (existing?.isMatched ?? false),
        orphanStatus: undefined
      });
    }
  }

  // Pass 2: Deconstruct unmatched items and classify Orphan Status
  const unmatchedList: UnmatchedItemSummary[] = [];
  let unmatchedIndex = 0;

  for (const [key, val] of unmatchedGroups.entries()) {
    unmatchedIndex++;
    if (unmatchedIndex % 1000 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }

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

    const decomp = decomposeSkuString(val.itemName);
    const commodityClean = decomp.commodityItem.replace(/\s+/g, ' ').toLowerCase().trim();

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
      const candidateList = commodityMap.get(commodityClean) || [];
      if (candidateList.length > 0) {
        const txSpec = normalizeSpecString(decomp.generalSpec || decomp.rawSpec);
        const txBrand = (decomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
        const txPart = (decomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

        const isTxSpecEmpty = !txSpec || isSpecSlotEmpty(txSpec);
        const isTxBrandEmpty = !txBrand || isSpecSlotEmpty(txBrand) || txBrand === 'generic' || txBrand === 'nb';
        const isTxPartEmpty = !txPart || isSpecSlotEmpty(txPart) || txPart === 'np';

        for (const cand of candidateList) {
          let score = 50;
          const isCandSpecEmpty = !cand.spec || isSpecSlotEmpty(cand.spec);
          const spec1Match = decomp.spec1 && cand.spec1 && decomp.spec1.toLowerCase() === cand.spec1.toLowerCase();
          const spec2Match = (!decomp.spec2 && !cand.spec2) || (decomp.spec2 && cand.spec2 && decomp.spec2.toLowerCase() === cand.spec2.toLowerCase());
          const spec3Match = (!decomp.spec3 && !cand.spec3) || (decomp.spec3 && cand.spec3 && decomp.spec3.toLowerCase() === cand.spec3.toLowerCase());
          const specMatches = Boolean((!isTxSpecEmpty && !isCandSpecEmpty && (txSpec === cand.spec || cand.spec.includes(txSpec) || txSpec.includes(cand.spec) || (spec1Match && spec2Match && spec3Match))) || (isTxSpecEmpty && isCandSpecEmpty));

          const isCandBrandEmpty = !cand.brand || isSpecSlotEmpty(cand.brand) || cand.brand === 'generic' || cand.brand === 'nb';
          const brandMatches = Boolean((!isTxBrandEmpty && !isCandBrandEmpty && (txBrand === cand.brand || cand.brand.includes(txBrand) || txBrand.includes(cand.brand))) || (isTxBrandEmpty && isCandBrandEmpty));

          const isCandPartEmpty = !cand.part || isSpecSlotEmpty(cand.part) || cand.part === 'np';
          const partMatches = Boolean((!isTxPartEmpty && !isCandPartEmpty && (txPart === cand.part || cand.part.includes(txPart) || txPart.includes(cand.part))) || (isTxPartEmpty && isCandPartEmpty));

          if (specMatches) score += 30;
          if (brandMatches) score += 10;
          if (partMatches) score += 10;

          if (score > orphanConfidenceScore) {
            orphanStatus = 'PARTIAL_ORPHAN';
            orphanConfidenceScore = score;
            bestMatchedSku = cand.sku;
            bestMatchedComponents = {
              commodityMatch: true,
              specMatch: specMatches,
              brandMatch: brandMatches,
              partNumberMatch: partMatches
            };
            orphanExplanation = `Partial Orphan (${score}%): Komoditas '${decomp.commodityItem}' cocok dengan Master SKU [${cand.sku.productId}] ${cand.sku.name}.`;
          }
        }
      }

      // Tahap 5 Weighted Fuzzy fallback jika skor belum tinggi (O(1) Candidate pruning via inverted index)
      if (orphanConfidenceScore < 70) {
        const candidateSet = new Set<PrecomputedSkuInfo>();
        const txPart = (decomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();
        if (txPart && txPart.length > 2 && txPart !== 'np') {
          const directPart = partToSkuMap.get(txPart);
          if (directPart) candidateSet.add(directPart);
        }
        const commTokens = commodityClean.split(/\s+/).filter(t => t.length > 2);
        for (const t of commTokens) {
          const list = tokenToSkuMap.get(t);
          if (list) {
            for (const item of list) {
              candidateSet.add(item);
              if (candidateSet.size >= 40) break;
            }
          }
          if (candidateSet.size >= 40) break;
        }

        for (const cand of candidateSet) {
          const sim = computeWeightedSkuSimilarity(decomp, cand.sku, cand.decomp);
          if (sim.totalScore > orphanConfidenceScore) {
            orphanConfidenceScore = sim.totalScore;
            bestMatchedSku = cand.sku;
            orphanStatus = 'PARTIAL_ORPHAN';
            bestMatchedComponents = {
              commodityMatch: sim.commodityScore >= 35,
              specMatch: sim.specScore >= 20,
              brandMatch: sim.brandScore >= 8 || sim.isBrandInSpec,
              partNumberMatch: sim.partNumberScore >= 8 || sim.goldenBoostApplied
            };
            orphanExplanation = `Tahap 5 Partial Match (${sim.totalScore}%): ${sim.matchExplanation} [${cand.sku.productId}]`;
            if (sim.totalScore >= 90) break;
          }
        }
      }
    }

    if (orphanStatus === 'PARTIAL_ORPHAN') {
      partialOrphanTransactions += val.transactionCount;
      partialOrphanSpendAmount += val.totalSpend;
    } else {
      fullOrphanTransactions += val.transactionCount;
      fullOrphanSpendAmount += val.totalSpend;
    }

    const uniqueEntry = uniqueItemsMap.get(key);
    if (uniqueEntry && !uniqueEntry.isMatched) {
      uniqueEntry.orphanStatus = orphanStatus;
    }

    unmatchedList.push({
      id: key,
      itemName: val.itemName,
      itemIds: Array.from(val.itemIds),
      commodityItem: decomp.commodityItem || val.itemName,
      generalSpec: decomp.generalSpec,
      brand: decomp.brand,
      partNumber: decomp.partNumber,
      orphanStatus,
      orphanConfidenceScore,
      orphanExplanation,
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
      suggestedMatches: []
    });
  }

  unmatchedList.sort((a, b) => b.totalSpend - a.totalSpend);

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
  const unmatchedTransactions = totalTransactions - matchedTransactions;
  const unmatchedSpendAmount = totalSpendAmount - matchedSpendAmount;

  let skusWithStandardPrice = 0;
  let skusWithFullTaxonomy = 0;

  skuMasters.forEach(s => {
    if (s.standardPrice && s.standardPrice > 0) skusWithStandardPrice += 1;
    if (s.purchCategoryLv1 && s.purchCategoryLv2 && s.purchCategoryLv3 && s.purchCategoryLv4) {
      skusWithFullTaxonomy += 1;
    }
  });

  const healthStats: MaintenanceHealthStats = {
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
    totalMasterSkus: skuMasters.length,
    skusWithStandardPrice,
    skusMissingStandardPrice: skuMasters.length - skusWithStandardPrice,
    skusWithFullTaxonomy,
    skusMissingTaxonomy: skuMasters.length - skusWithFullTaxonomy,
    totalMasterHospitals: 0,
    totalMasterVendors: 0
  };

  const maintenanceCache: MaintenanceCacheData = {
    id: 'maintenance_summary',
    unmatchedList,
    healthStats,
    lastUpdated: new Date().toISOString(),
    recordsCount: totalTransactions,
    skusCount: skuMasters.length,
    hospitalsCount: 0,
    vendorsCount: 0
  };

  return { maintenanceCache, healthStats };
}

/**
 * Generates concise Markdown summary optimized for AI API context consumption (< 400 tokens)
 */
function generateAiSummaryPromptContext(
  kpis: SpendSummaryKPIs,
  topVendors: VendorSpendItem[],
  topCategories: CategorySpendItem[],
  hospitalSpend: HospitalSpendItem[],
  monthlyTrend: MonthlyTrendItem[],
  healthStats: MaintenanceHealthStats,
  prPairingStats?: PrecalculatedCubeAggregates['prPairingStats']
): string {
  const topV = topVendors.slice(0, 5).map((v, i) => `${i + 1}. **${v.vendorName}**: IDR ${(v.spend / 1e9).toFixed(2)} Miliar (${v.transactionsCount} PO)`).join('\n');
  const topC = topCategories.slice(0, 5).map((c, i) => `${i + 1}. **${c.category}**: IDR ${(c.spend / 1e9).toFixed(2)} Miliar (${c.percentage.toFixed(1)}%)`).join('\n');
  const topH = hospitalSpend.slice(0, 5).map((h, i) => `${i + 1}. **${h.hospitalCode}**: IDR ${(h.spend / 1e9).toFixed(2)} Miliar (${h.percentage.toFixed(1)}%)`).join('\n');

  const prText = prPairingStats 
    ? `- **Kepatuhan PO-PR (Tanpa Heuristik)**: ${prPairingStats.pairedPercentage.toFixed(1)}% Belanja Ber-PR (IDR ${(prPairingStats.pairedSpend / 1e9).toFixed(2)} Miliar) | ${prPairingStats.unpairedTransactions.toLocaleString('id-ID')} PO Tanpa PR (IDR ${(prPairingStats.unpairedSpend / 1e9).toFixed(2)} Miliar)`
    : '';

  return `### Ringkasan Eksekutif Pengadaan Rumah Sakit (Precalculated SpendCube)
- **Total Belanja (Spend)**: IDR ${(kpis.totalSpend / 1e9).toFixed(2)} Miliar | **Total Transaksi**: ${kpis.totalTransactions.toLocaleString('id-ID')} PO
- **Struktur Belanja**: CAPEX IDR ${(kpis.totalCapexSpend / 1e9).toFixed(2)} Miliar (${((kpis.totalCapexSpend / Math.max(1, kpis.totalSpend)) * 100).toFixed(1)}%) | OPEX IDR ${(kpis.totalOpexSpend / 1e9).toFixed(2)} Miliar (${((kpis.totalOpexSpend / Math.max(1, kpis.totalSpend)) * 100).toFixed(1)}%)
- **Entitas & Rekanan**: ${kpis.uniqueVendors} Vendor Aktif di ${kpis.uniqueHospitals} Unit Rumah Sakit | Rata-rata Nilai PO: IDR ${(kpis.averagePoAmount / 1e6).toFixed(2)} Juta
${prText ? prText + '\n' : ''}- **Kualitas Sinkronisasi Master Data**: Item Match Rate: ${healthStats.itemMatchRatePct.toFixed(1)}% | Spend Match Rate: ${healthStats.spendMatchRatePct.toFixed(1)}%
  - Partial Orphan (Komoditas Cocok, Varian Berbeda): ${healthStats.partialOrphanTransactions} transaksi (IDR ${(healthStats.partialOrphanSpendAmount / 1e9).toFixed(2)} Miliar)
  - Full Orphan (Item Baru/Belum Terdaftar): ${healthStats.fullOrphanTransactions} transaksi (IDR ${(healthStats.fullOrphanSpendAmount / 1e9).toFixed(2)} Miliar)

#### 5 Vendor Terbesar:
${topV}

#### 5 Kategori Terbesar:
${topC}

#### 5 Unit RS Terbesar:
${topH}
`;
}

/**
 * Computes precalculated dimensional aggregates for instant UI rendering and AI API consumption
 */
function computeWorkerCubeAggregates(
  records: SpendRecord[],
  kpis: SpendSummaryKPIs,
  healthStats: MaintenanceHealthStats,
  prPairingStats?: PrecalculatedCubeAggregates['prPairingStats']
): PrecalculatedCubeAggregates {
  const monthMap = new Map<string, { capex: number; opex: number; total: number }>();
  const hospMap = new Map<string, number>();
  const catMap = new Map<string, number>();
  const vendorMap = new Map<string, { spend: number; count: number }>();

  for (const r of records) {
    const amt = Number(r.totalLineAmount) || 0;
    const m = r.monthYear || '2026-01';
    const mEntry = monthMap.get(m) || { capex: 0, opex: 0, total: 0 };
    if (r.purchaseCategory === 'CAPEX' || (r.sourceFile && r.sourceFile.startsWith('capex'))) {
      mEntry.capex += amt;
    } else {
      mEntry.opex += amt;
    }
    mEntry.total += amt;
    monthMap.set(m, mEntry);

    const h = r.hospitalCode || 'UNKNOWN';
    hospMap.set(h, (hospMap.get(h) || 0) + amt);

    const isFullOrphan = r.orphanStatus === 'FULL_ORPHAN' || (!r.skuMasterId && r.orphanStatus !== 'PARTIAL_ORPHAN' && r.orphanStatus !== 'EXACT_MATCH');
    const cat = isFullOrphan ? 'ORPHAN' : (r.taxonomyLv1 || r.procurementCategory || r.mappedCategory || 'General');
    catMap.set(cat, (catMap.get(cat) || 0) + amt);

    const v = r.vendorName || 'Unknown Vendor';
    const vEntry = vendorMap.get(v) || { spend: 0, count: 0 };
    vEntry.spend += amt;
    vEntry.count += 1;
    vendorMap.set(v, vEntry);
  }

  const monthlyTrend: MonthlyTrendItem[] = Array.from(monthMap.keys()).sort().map(month => ({
    month,
    capex: monthMap.get(month)!.capex,
    opex: monthMap.get(month)!.opex,
    total: monthMap.get(month)!.total
  }));

  const totalSpend = kpis.totalSpend || 1;
  const hospitalSpend: HospitalSpendItem[] = Array.from(hospMap.entries())
    .map(([hospitalCode, spend]) => ({
      hospitalCode,
      spend,
      percentage: (spend / totalSpend) * 100
    }))
    .sort((a, b) => b.spend - a.spend);

  const topCategories: CategorySpendItem[] = Array.from(catMap.entries())
    .map(([category, spend]) => ({
      category,
      spend,
      percentage: (spend / totalSpend) * 100
    }))
    .sort((a, b) => b.spend - a.spend);

  const topVendors: VendorSpendItem[] = Array.from(vendorMap.entries())
    .map(([vendorName, data]) => ({
      vendorName,
      spend: data.spend,
      transactionsCount: data.count
    }))
    .sort((a, b) => b.spend - a.spend);

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

  const aiSummaryPromptContext = generateAiSummaryPromptContext(
    kpis,
    topVendors,
    topCategories,
    hospitalSpend,
    monthlyTrend,
    healthStats,
    prPairingStats
  );

  return {
    id: 'latest_aggregates',
    computedAt: new Date().toISOString(),
    recordsCount: records.length,
    skusCount: healthStats.totalMasterSkus,
    kpis,
    monthlyTrend,
    hospitalSpend,
    topCategories,
    topVendors,
    orphanStats,
    healthStats,
    prPairingStats,
    aiSummaryPromptContext
  };
}

async function processWorkerSkuMapping(
  jobId: string,
  itemsToMap: { rawItemName: string; itemKey: string }[],
  skuMasters: SkuMasterRecord[]
): Promise<SkuMappingCacheRecord[]> {
  const total = itemsToMap.length;
  if (total === 0) return [];

  // 1. Build Index Maps
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

    if (sku.name) byExactNameMap.set(sku.name.toLowerCase().trim(), sku);
    if (sku.formattedSkuName) byExactNameMap.set(sku.formattedSkuName.toLowerCase().trim(), sku);

    const normSkuName = normalizeSkuSyntax(sku.name);
    if (normSkuName) byExactNameMap.set(normSkuName, sku);
    const normFormatted = normalizeSkuSyntax(sku.formattedSkuName);
    if (normFormatted) byExactNameMap.set(normFormatted, sku);

    const synthSyntax = normalizeSkuSyntax(
      `${sku.commodityItem || sku.name};${sku.specification1 || sku.generalSpec || ''};${sku.brand || ''};${sku.partNumber || ''}`
    );
    if (synthSyntax) byExactNameMap.set(synthSyntax, sku);

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

  const precomputedSkuData = skuMasters.map(s => {
    const decomp = decomposeSkuString(s.formattedSkuName || s.name);
    return {
      sku: s,
      decomp,
      lowerName: (s.name || '').toLowerCase(),
      lowerComm: (s.commodityItem || decomp.commodityItem || s.name || '').replace(/\s+/g, ' ').toLowerCase().trim(),
      cleanPart: (s.partNumber || decomp.partNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    };
  });

  // Inverted Candidate Index on Master SKUs (sub-millisecond token & part lookup)
  const tokenToSkuIndicesMap = new Map<string, number[]>();
  const partToSkuIndicesMap = new Map<string, number[]>();

  for (let idx = 0; idx < precomputedSkuData.length; idx++) {
    const item = precomputedSkuData[idx];
    if (item.cleanPart && item.cleanPart.length >= 3 && item.cleanPart !== 'np') {
      let partList = partToSkuIndicesMap.get(item.cleanPart);
      if (!partList) {
        partList = [];
        partToSkuIndicesMap.set(item.cleanPart, partList);
      }
      partList.push(idx);
    }

    const words = `${item.lowerComm} ${item.lowerName}`.split(/[\s,;./\-_]+/).filter(w => w.length >= 3);
    const seenWords = new Set<string>();
    for (const w of words) {
      if (!seenWords.has(w)) {
        seenWords.add(w);
        let list = tokenToSkuIndicesMap.get(w);
        if (!list) {
          list = [];
          tokenToSkuIndicesMap.set(w, list);
        }
        list.push(idx);
      }
    }
  }

  const results: SkuMappingCacheRecord[] = [];
  const chunkSize = 150; // Optimized chunk size for fast processing

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = itemsToMap.slice(i, i + chunkSize);

    for (const item of chunk) {
      const rawTarget = item.rawItemName || '';
      const { itemName: cleanItemName, extractedSkuCode } = splitItemNameAndNotes(rawTarget);
      const poSkuCode = (extractedSkuCode || '').trim();
      const primaryItemName = (cleanItemName || rawTarget).trim();

      const txDecomp = decomposeSkuString(primaryItemName);
      const txCommodity = txDecomp.commodityItem.replace(/\s+/g, ' ').trim();
      const txSpec = normalizeSpecString(txDecomp.generalSpec || txDecomp.rawSpec);
      const txBrand = (txDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
      const txPartNumber = (txDecomp.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

      let matched: SkuMasterRecord | null = null;
      let bestCandidate: SkuMasterRecord | null = null;
      let orphanStatus: 'EXACT_MATCH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' = 'FULL_ORPHAN';
      let matchTier: 'DIRECT_CODE' | 'DIRECT_ID' | 'EXACT_SYNTAX' | 'COMPONENT_EXACT' | 'FUZZY_HIGH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' | 'MANUAL' | undefined = undefined;
      let confidenceScore = 0;
      let matchReason = '';

      // TAHAP 1: Ekstraksi Langsung Kode SKU Master (::skuCode)
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

      // TAHAP 2: Direct ID Match
      if (!matched && primaryItemName) {
        const directKey = primaryItemName.toLowerCase().trim();
        if (bySkuCodeMap.has(directKey)) {
          matched = bySkuCodeMap.get(directKey)!;
          orphanStatus = 'EXACT_MATCH';
          matchTier = 'DIRECT_ID';
          confidenceScore = 100;
          matchReason = `Kecocokan Langsung Kode/ID Item (${matched.productId || matched.id})`;
        }
      }

      // TAHAP 3: Exact Full Name / Canonical Syntax Match
      if (!matched) {
        const exactKey = primaryItemName.toLowerCase().trim();
        if (byExactNameMap.has(exactKey)) {
          matched = byExactNameMap.get(exactKey)!;
          orphanStatus = 'EXACT_MATCH';
          matchTier = 'EXACT_SYNTAX';
          confidenceScore = 100;
          matchReason = 'Kecocokan Tepat Nama Master SKU';
        } else {
          const normTx = normalizeSkuSyntax(primaryItemName);
          if (normTx && byExactNameMap.has(normTx)) {
            matched = byExactNameMap.get(normTx)!;
            orphanStatus = 'EXACT_MATCH';
            matchTier = 'EXACT_SYNTAX';
            confidenceScore = 100;
            matchReason = 'Kecocokan Sintaks Kanonikal 4 Pilar SKU (Exact Match)';
          }
        }
      }

      // TAHAP 4 & 5: Component Matching
      if (!matched) {
        const commClean = txCommodity.toLowerCase().trim();
        const candidateSkus = commClean ? (byCommodityMap.get(commClean) || []) : [];
        let bestScore = 0;
        let bestReason = '';

        if (candidateSkus.length > 0) {
          for (const cand of candidateSkus) {
            const candSpec = normalizeSpecString(cand.generalSpec || cand.specification1);
            const candBrand = (cand.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
            const candPart = (cand.partNumber || '').replace(/\s+/g, ' ').toLowerCase().trim();

            const txFull = `${txCommodity} ${txSpec}`.toLowerCase();
            const candFull = `${cand.name} ${candSpec}`.toLowerCase();

            // Safety guard: reject candidates with conflicting numbers or antonyms
            if (
              hasConflictingNumbers(txSpec, candSpec) ||
              hasConflictingNumbers(txFull, candFull) ||
              hasConflictingModifiers(txFull, candFull)
            ) {
              continue;
            }

            // Brand conflict guard: if both brands are non-generic and differ
            const isTxBrandGeneric = !txBrand || isSpecSlotEmpty(txBrand) || txBrand === 'generic' || txBrand === 'nb';
            const isCandBrandGeneric = !candBrand || isSpecSlotEmpty(candBrand) || candBrand === 'generic' || candBrand === 'nb';
            if (!isTxBrandGeneric && !isCandBrandGeneric && txBrand !== candBrand && !candBrand.includes(txBrand) && !txBrand.includes(candBrand)) {
              continue; // Different explicit brands cannot be component exact match
            }

            let score = 50;
            let reasonParts = ['Komoditas cocok (50%)'];

            const isTxSpecEmpty = isSpecSlotEmpty(txSpec);
            const isCandSpecEmpty = isSpecSlotEmpty(candSpec);

            if (txSpec && candSpec) {
              if (txSpec === candSpec) {
                score += 30;
                reasonParts.push('Spesifikasi cocok (+30%)');
              } else {
                const sTokensA = txSpec.split(/[\s,;./\-_]+/).filter(Boolean);
                const sTokensB = candSpec.split(/[\s,;./\-_]+/).filter(Boolean);
                const overlap = sTokensA.filter(t => sTokensB.includes(t));
                if (overlap.length === Math.max(sTokensA.length, sTokensB.length) && overlap.length > 0) {
                  score += 28;
                  reasonParts.push('Spesifikasi token identik (+28%)');
                }
              }
            } else if (isTxSpecEmpty && isCandSpecEmpty) {
              score += 30;
              reasonParts.push('Spesifikasi NA/Universal cocok (+30%)');
            }

            if (txBrand && candBrand && txBrand === candBrand) {
              score += 10;
              reasonParts.push('Brand cocok (+10%)');
            } else if (isTxBrandGeneric && isCandBrandGeneric) {
              score += 10;
              reasonParts.push('Brand NB/Generic cocok (+10%)');
            }

            const isTxPartEmpty = isSpecSlotEmpty(txPartNumber);
            const isCandPartEmpty = isSpecSlotEmpty(candPart);

            if (txPartNumber && candPart && txPartNumber === candPart) {
              score += 10;
              reasonParts.push('Part Number cocok (+10%)');
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

          if (bestCandidate && bestScore >= 95) {
            matched = bestCandidate;
            orphanStatus = 'EXACT_MATCH';
            matchTier = 'COMPONENT_EXACT';
            confidenceScore = bestScore;
            matchReason = bestReason;
          }
        }

        // TAHAP 5: Weighted Component Fuzzy Multiplier dengan Candidate Pool Terindeks (Inverted Index)
        if (!matched) {
          let fuzzyBestScore = 0;
          let fuzzyBestCandidate: SkuMasterRecord | null = null;
          let fuzzyBestExplanation = '';

          // 1. Part Number Golden Anchor via O(1) Index
          const cleanPoPart = (txPartNumber || '').replace(/[^a-z0-9]/g, '');
          if (cleanPoPart && cleanPoPart !== 'np' && cleanPoPart.length >= 3) {
            const partIndices = partToSkuIndicesMap.get(cleanPoPart);
            if (partIndices && partIndices.length > 0) {
              for (let pi = 0; pi < partIndices.length; pi++) {
                const pItem = precomputedSkuData[partIndices[pi]];
                const simResult = computeWeightedSkuSimilarity(txDecomp, pItem.sku, pItem.decomp);
                if (simResult.totalScore > fuzzyBestScore) {
                  fuzzyBestScore = simResult.totalScore;
                  fuzzyBestCandidate = pItem.sku;
                  fuzzyBestExplanation = simResult.matchExplanation;
                  if (fuzzyBestScore >= 95) break;
                }
              }
            }
          }

          // 2. Evaluasi Fuzzy Multiplier HANYA pada kandidat terindeks (Token Overlap Candidate Pool)
          if (fuzzyBestScore < 85) {
            const STOP_WORDS = new Set([
              'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'yang', 'ini', 'itu',
              'jasa', 'pekerjaan', 'biaya', 'pengadaan', 'pembelian', 'pemeliharaan', 'perbaikan',
              'alat', 'barang', 'unit', 'set', 'item', 'paket', 'all', 'etc', 'dll'
            ]);

            const txTokens = `${txCommodity} ${primaryItemName}`
              .toLowerCase()
              .split(/[\s,;./\-_]+/)
              .filter(t => t.length >= 3 && !STOP_WORDS.has(t));

            // Sort tokens by frequency ascending (rarest tokens first for targeted indexing)
            txTokens.sort((a, b) => {
              const countA = tokenToSkuIndicesMap.get(a)?.length || 0;
              const countB = tokenToSkuIndicesMap.get(b)?.length || 0;
              return countA - countB;
            });

            const candidateIndices = new Set<number>();

            for (let m = 0; m < txTokens.length; m++) {
              const matchedIdxs = tokenToSkuIndicesMap.get(txTokens[m]);
              if (matchedIdxs) {
                for (let k = 0; k < matchedIdxs.length; k++) {
                  candidateIndices.add(matchedIdxs[k]);
                  if (candidateIndices.size >= 60) break; // Maksimal 60 kandidat relevan
                }
              }
              if (candidateIndices.size >= 60) break;
            }

            if (candidateIndices.size > 0) {
              for (const candIdx of candidateIndices) {
                const pItem = precomputedSkuData[candIdx];
                const simResult = computeWeightedSkuSimilarity(txDecomp, pItem.sku, pItem.decomp);
                if (simResult.totalScore > fuzzyBestScore) {
                  fuzzyBestScore = simResult.totalScore;
                  fuzzyBestCandidate = pItem.sku;
                  fuzzyBestExplanation = simResult.matchExplanation;
                  if (fuzzyBestScore >= 95) break;
                }
              }
            }
          }

          if (fuzzyBestCandidate && fuzzyBestScore >= 85) {
            matched = fuzzyBestCandidate;
            orphanStatus = 'EXACT_MATCH';
            matchTier = 'FUZZY_HIGH';
            confidenceScore = fuzzyBestScore;
            matchReason = `Tahap 5 (Weighted Fuzzy ${fuzzyBestScore}%): ${fuzzyBestExplanation} [${matched.productId}]`;
          } else {
            // Fallback Komoditas: Gunakan fuzzyBestCandidate (atau bestCandidate) yang sudah ditemukan
            const candidateToTest = fuzzyBestCandidate || bestCandidate;
            let commoditySim = 0;
            if (candidateToTest) {
              const candCommodity = (candidateToTest.commodityItem || decomposeSkuString(candidateToTest.formattedSkuName || candidateToTest.name).commodityItem || candidateToTest.name || '').replace(/\s+/g, ' ').trim();
              commoditySim = computeTokenSetSimilarity(txCommodity, candCommodity);
            }

            if (candidateToTest && commoditySim >= 0.90) {
              orphanStatus = 'PARTIAL_ORPHAN';
              matchTier = 'PARTIAL_ORPHAN';
              bestCandidate = candidateToTest;
              confidenceScore = Math.round(commoditySim * 100);
              matchReason = `Partial Orphan (Kemiripan Komoditas ${confidenceScore}% >= 90%): Menunggu konfirmasi manual (Kandidat: [${bestCandidate.productId}] ${bestCandidate.name})`;
            } else {
              orphanStatus = 'FULL_ORPHAN';
              matchTier = 'FULL_ORPHAN';
              bestCandidate = null;
              confidenceScore = 0;
              matchReason = 'Full Orphan: Tidak ada kecocokan komoditas, spesifikasi, brand, atau part number';
            }
          }
        }
      }

      // Final resolved taxonomy: Partial & Full Orphan stay strictly unmapped to prevent catalog pollution
      let tax1 = 'UNMAPPED / ORPHAN PO';
      let tax2 = orphanStatus === 'PARTIAL_ORPHAN' ? 'Partial Orphan' : 'Full Orphan';
      let tax3 = tax2;
      let tax4 = tax2;
      let tax5 = txCommodity || primaryItemName;
      let brand = txBrand;
      let spec = txSpec;
      let partNumber = txPartNumber;

      if (matched && orphanStatus === 'EXACT_MATCH') {
        tax1 = (matched.purchCategoryLv1 || 'General').trim();
        tax2 = (matched.purchCategoryLv2 || tax1).trim();
        tax3 = (matched.purchCategoryLv3 || tax2).trim();
        tax4 = (matched.purchCategoryLv4 || tax3).trim();
        tax5 = (matched.commodityItem || matched.name || txCommodity).trim();
        brand = matched.brand || txBrand;
        spec = matched.generalSpec || matched.specification1 || txSpec;
        partNumber = matched.partNumber || txPartNumber;
      }

      results.push({
        itemKey: item.itemKey,
        rawItemName: rawTarget,
        matchedSkuId: matched ? matched.id : null, // Crucial: ONLY exact matched SKUs populate matchedSkuId
        candidateSkuId: !matched && bestCandidate ? bestCandidate.id : null,
        orphanStatus,
        matchTier,
        confidenceScore,
        matchReason,
        matchedSku: matched ? matched : null,
        candidateSku: !matched && bestCandidate ? bestCandidate : null,
        taxonomy: {
          taxonomyLv1: tax1,
          taxonomyLv2: tax2,
          taxonomyLv3: tax3,
          taxonomyLv4: tax4,
          taxonomyLv5: tax5,
          brand,
          spec,
          partNumber
        },
        updatedAt: Date.now()
      });
    }

    const processed = Math.min(total, i + chunkSize);
    const pct = Math.round((processed / total) * 100);
    notifyProgress(
      jobId,
      'MAPPING_SKUS',
      pct,
      `Menyelaraskan taksonomi SKU di latar belakang: ${processed.toLocaleString()}/${total.toLocaleString()} item (${pct}%)...`,
      processed,
      total,
      'SKU_MAPPING_PIPELINE'
    );

    // Yield thread to keep UI smooth and prevent worker lockup
    await new Promise(r => setTimeout(r, 2));
  }

  return results;
}

self.onmessage = async function (event: MessageEvent<WorkerIncomingMessage>) {
  const msg = event.data;
  if (msg.type !== 'START_JOB') return;
  const { jobType, jobId, payload } = msg;
  const startTime = Date.now();

  // Handle SKU_MAPPING_PIPELINE dedicated background job
  if (jobType === 'SKU_MAPPING_PIPELINE') {
    try {
      const itemsToMap = (payload as any).itemsToMap || [];
      const skuMasters = (payload as any).skuMasters || [];
      notifyProgress(jobId, 'INITIALIZE_MAPPING', 2, `Mempersiapkan indeks data master (${skuMasters.length} SKU)...`, 0, itemsToMap.length, 'SKU_MAPPING_PIPELINE');

      const mappings = await processWorkerSkuMapping(jobId, itemsToMap, skuMasters);

      self.postMessage({
        type: 'SUCCESS',
        jobId,
        jobType: 'SKU_MAPPING_PIPELINE',
        durationMs: Date.now() - startTime,
        payload: {
          jobId,
          status: 'SUCCESS',
          durationMs: Date.now() - startTime,
          mappings,
          totalMapped: mappings.length
        }
      });
      return;
    } catch (err: any) {
      console.error('[Worker] SKU Mapping Pipeline Error:', err);
      self.postMessage({
        type: 'ERROR',
        jobId,
        jobType: 'SKU_MAPPING_PIPELINE',
        error: err?.message || 'Unknown error in SKU background mapping',
        durationMs: Date.now() - startTime
      });
      return;
    }
  }

  // Handle DEPARTMENT_COMPILATION dedicated background job
  if (jobType === 'DEPARTMENT_COMPILATION') {
    try {
      const records = (payload as any).records || [];
      const prs = (payload as any).prs || [];
      const userMappings = (payload as any).userMappings || [];
      const existingMasters = (payload as any).existingMasters || [];
      const totalItems = records.length + prs.length;

      notifyProgress(
        jobId, 
        'INIT_DEPT_DISCOVERY', 
        5, 
        `Memindai variasi departemen dari ${records.length.toLocaleString('id-ID')} transaksi & ${prs.length.toLocaleString('id-ID')} PR...`, 
        0, 
        totalItems, 
        'DEPARTMENT_COMPILATION'
      );
      await new Promise(r => setTimeout(r, 10));

      notifyProgress(
        jobId, 
        'PROCESSING_DEPT_DISCOVERY', 
        45, 
        `Mengelompokkan canonical departemen dan menghitung metrik spend...`, 
        Math.round(totalItems * 0.45), 
        totalItems, 
        'DEPARTMENT_COMPILATION'
      );
      await new Promise(r => setTimeout(r, 10));

      const discovery = discoverDepartmentsFromRecords(records, prs, userMappings, existingMasters);

      notifyProgress(
        jobId, 
        'FINALIZING_DEPT_DISCOVERY', 
        95, 
        `Menyusun ${discovery.updatedMasters.length} direktori departemen kanonikal...`, 
        totalItems, 
        totalItems, 
        'DEPARTMENT_COMPILATION'
      );

      self.postMessage({
        type: 'SUCCESS',
        jobId,
        jobType: 'DEPARTMENT_COMPILATION',
        durationMs: Date.now() - startTime,
        payload: {
          jobId,
          status: 'SUCCESS',
          durationMs: Date.now() - startTime,
          masters: discovery.updatedMasters,
          unmapped: discovery.unmappedItems,
          totalRecordsScanned: records.length,
          totalPrsScanned: prs.length
        }
      });
      return;
    } catch (err: any) {
      console.error('[Worker] Department Compilation Error:', err);
      self.postMessage({
        type: 'ERROR',
        jobId,
        jobType: 'DEPARTMENT_COMPILATION',
        error: err?.message || 'Gagal menyusun master departemen di background worker',
        durationMs: Date.now() - startTime
      });
      return;
    }
  }

  try {
    const records = payload.records || [];
    const skuMasters = payload.skuMasters || [];
    const hospitalMasters = payload.hospitalMasters || [];
    const totalCount = records.length;

    notifyProgress(jobId, 'INITIALIZATION', 5, `Memulai Background Worker (${totalCount.toLocaleString()} transaksi)...`, 0, totalCount);
    await new Promise(r => setTimeout(r, 15));

    // Stage 1: Price Surges & Inflation
    notifyProgress(jobId, 'PRICE_SURGES', 15, 'Menghitung lonjakan harga historis per item & vendor...', Math.round(totalCount * 0.15), totalCount);
    await new Promise(r => setTimeout(r, 15));
    const priceSurges = priceIntelligenceService.calculatePriceSurges(records);

    // Stage 2: Intra-Vendor Discrepancies
    notifyProgress(jobId, 'INTRA_VENDOR', 30, 'Mendeteksi disparitas tarif intra-vendor antar rumah sakit...', Math.round(totalCount * 0.3), totalCount);
    await new Promise(r => setTimeout(r, 15));
    const intraVendorDiscrepancies = priceIntelligenceService.calculateIntraVendorDiscrepancies(records);

    // Stage 3: Vendor Switching & Regional Arbitrage
    notifyProgress(jobId, 'SWITCHING_REGIONAL', 45, 'Menganalisis peluang substitusi vendor & markup regional...', Math.round(totalCount * 0.45), totalCount);
    await new Promise(r => setTimeout(r, 15));
    const switchingOpportunities = priceIntelligenceService.calculateVendorSwitchingOpportunities(records, priceSurges);
    const regionalAnalysis = priceIntelligenceService.calculateRegionalPriceAnalysis(records, hospitalMasters);
    const standardPriceAudits = priceIntelligenceService.calculateStandardPriceAudit(records, skuMasters);

    const priceIntelligenceResult: PrecomputedPriceIntelligence = {
      priceSurges,
      intraVendorDiscrepancies,
      switchingOpportunities,
      regionalAnalysis,
      standardPriceAudits,
      computedAt: Date.now()
    };

    // Stage 4: Semantic Clustering & Contract Opportunity Matrix
    notifyProgress(jobId, 'SEMANTIC_CLUSTERING', 60, 'Mengelompokkan klaster semantik transaksi & Kraljic Matrix...', Math.round(totalCount * 0.6), totalCount);
    await new Promise(r => setTimeout(r, 15));
    const { clusters, summary } = clusterSpendTransactions(records, skuMasters, payload.contractFilter);

    const contractTargetingResult: PrecomputedContractTargeting = {
      clusters,
      summary,
      filterHash: 'DEFAULT_STAGING',
      computedAt: Date.now()
    };

    // Stage 5: Master Data Reconciliation & Orphan Classification (Background Materialized View)
    notifyProgress(jobId, 'RECONCILIATION', 75, 'Melakukan rekonsiliasi Master SKU & klasifikasi Partial/Full Orphan...', Math.round(totalCount * 0.75), totalCount);
    await new Promise(r => setTimeout(r, 15));
    const { maintenanceCache, healthStats } = await computeWorkerMaintenanceCache(records, skuMasters);

    // Stage 6: KPIs & Dimensional Aggregates (Including Strict PO-PR Pairing Metrics)
    notifyProgress(jobId, 'KPIS', 88, 'Menyusun ringkasan matriks belanja & audit pairing PO-PR...', Math.round(totalCount * 0.88), totalCount);
    await new Promise(r => setTimeout(r, 15));
    let totalSpend = 0;
    let totalQty = 0;
    const vendorSet = new Set<string>();
    const hospSet = new Set<string>();

    let totalCapexSpend = 0;
    let totalOpexSpend = 0;

    let pairedTransactions = 0;
    let unpairedTransactions = 0;
    let pairedSpend = 0;
    let unpairedSpend = 0;
    let pairedByPrqCount = 0;
    let pairedByPoCount = 0;
    const requesterSet = new Set<string>();
    const departmentSet = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const amt = (r.totalLineAmount || 0);
      totalSpend += amt;
      totalQty += (r.purchQty || 0);
      if (r.purchaseCategory === 'CAPEX' || (r.sourceFile && r.sourceFile.startsWith('capex'))) {
        totalCapexSpend += amt;
      } else {
        totalOpexSpend += amt;
      }
      if (r.vendorName) vendorSet.add(r.vendorName);
      if (r.hospitalCode) hospSet.add(r.hospitalCode);

      // Exact PO-PR Pairing check
      const isPaired = r.prPairingKeyType === 'PO' || r.prPairingKeyType === 'PRQ' || (Boolean(r.purchaseReqId) && r.prPairingKeyType !== 'UNPAIRED');
      if (isPaired) {
        pairedTransactions++;
        pairedSpend += amt;
        if (r.prPairingKeyType === 'PRQ') {
          pairedByPrqCount++;
        } else {
          pairedByPoCount++;
        }
        if (r.requester) requesterSet.add(r.requester.toLowerCase().trim());
        if (r.department) departmentSet.add(r.department.toLowerCase().trim());
      } else {
        unpairedTransactions++;
        unpairedSpend += amt;
      }
    }

    const prPairingStats: PrecalculatedCubeAggregates['prPairingStats'] = {
      totalTransactions: records.length,
      pairedTransactions,
      unpairedTransactions,
      pairedSpend,
      unpairedSpend,
      pairedPercentage: totalSpend > 0 ? (pairedSpend / totalSpend) * 100 : 0,
      pairedByPrqCount,
      pairedByPoCount,
      uniqueRequesters: requesterSet.size,
      uniqueDepartments: departmentSet.size
    };

    const kpis: SpendSummaryKPIs = {
      totalSpend,
      totalTransactions: records.length,
      uniqueVendors: vendorSet.size,
      uniqueHospitals: hospSet.size,
      totalCapexSpend,
      totalOpexSpend,
      averagePoAmount: records.length > 0 ? totalSpend / records.length : 0,
      pairedTransactions,
      unpairedTransactions,
      pairedSpend,
      unpairedSpend,
      pairingRatePct: totalSpend > 0 ? (pairedSpend / totalSpend) * 100 : 0
    };

    // Stage 7: Precalculated Cube Aggregates & AI Context Generation
    notifyProgress(jobId, 'AGGREGATES', 95, 'Menyimpan Materialized Views & AI Summary Context...', totalCount, totalCount);
    const cubeAggregates = computeWorkerCubeAggregates(records, kpis, healthStats, prPairingStats);

    const fullResult: FullStagingResultPayload = {
      jobId,
      status: 'SUCCESS',
      durationMs: Date.now() - startTime,
      priceIntelligence: priceIntelligenceResult,
      contractTargeting: contractTargetingResult,
      kpis,
      maintenanceCache,
      cubeAggregates,
      totalRecordsProcessed: records.length,
      totalSkusProcessed: skuMasters.length
    };

    notifyProgress(jobId, 'COMPLETE', 100, `Staging selesai dalam ${(Date.now() - startTime)}ms. Materialized Views tersimpan.`, totalCount, totalCount);

    self.postMessage({
      type: 'SUCCESS',
      jobId,
      jobType,
      durationMs: Date.now() - startTime,
      payload: fullResult
    });

  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      jobId,
      jobType,
      error: err?.message || String(err),
      durationMs: Date.now() - startTime
    });
  }
};
