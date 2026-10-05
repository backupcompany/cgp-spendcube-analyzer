/**
 * High-Performance Semantic Clustering & Opportunity Engine
 * Deterministic, Client-Side, Zero Token Overhead, Sub-millisecond Execution
 */

import { SpendRecord, SkuMasterRecord } from '../../../core/types/spend';
import { 
  SemanticSpendCluster, 
  KraljicQuadrant, 
  OpportunityPriority, 
  ContractTargetingFilter,
  ContractTargetingSummaryMetrics,
  DEFAULT_CONTRACT_FILTER
} from '../../../core/types/contractTargeting';

// Stop words for clean semantic normalization
const NOISE_WORDS = new Set([
  'dan', 'atau', 'dengan', 'untuk', 'yang', 'dari', 'ke', 'di', 'pada', 
  'pt', 'cv', 'tbk', 'indonesia', 'jaya', 'medika', 'utama', 'abadi', 
  'the', 'and', 'or', 'for', 'with', 'by', 'of', 'in', 'on', 'at', 'to',
  'item', 'barang', 'alat', 'bahan', 'tipe', 'type', 'no', 'nomor', 'isi'
]);

// Domain Synonym Dictionary for Medical, Surgical, Office, & IT Commodities
const SYNONYM_MAP: Record<string, string> = {
  // Consumables & Surgical
  'spuit': 'syringe',
  'suntikan': 'syringe',
  'jarum suntik': 'syringe',
  'handscoon': 'glove',
  'sarung tangan': 'glove',
  'latex glove': 'glove_latex',
  'nitrile glove': 'glove_nitrile',
  'abocath': 'iv_catheter',
  'surflo': 'iv_catheter',
  'iv cath': 'iv_catheter',
  'iv catheter': 'iv_catheter',
  'infus set': 'infusion_set',
  'infusion set': 'infusion_set',
  'blood set': 'transfusion_set',
  'transfusi set': 'transfusion_set',
  'underpad': 'underpad_medical',
  'perlak': 'underpad_medical',
  'kasa': 'gauze_sterile',
  'gauze': 'gauze_sterile',
  'kasa steril': 'gauze_sterile',
  'alkohol': 'alcohol_70',
  'alcohol': 'alcohol_70',
  'ethanol': 'alcohol_70',
  'povidone': 'povidone_iodine',
  'betadine': 'povidone_iodine',
  'masker': 'surgical_mask',
  'mask': 'surgical_mask',
  'surgical mask': 'surgical_mask',
  
  // Pharma & Fluids
  'paracetamol': 'paracetamol',
  'pct': 'paracetamol',
  'sanmol': 'paracetamol',
  'pamol': 'paracetamol',
  'ceftriaxone': 'ceftriaxone',
  'ceftri': 'ceftriaxone',
  'ceftriaxon': 'ceftriaxone',
  'rl': 'ringer_lactate',
  'ringer laktat': 'ringer_lactate',
  'ringer lactate': 'ringer_lactate',
  'ns': 'normal_saline_09',
  'nacl': 'normal_saline_09',
  'nacl 0.9%': 'normal_saline_09',
  'nacl 0,9%': 'normal_saline_09',
  'd5': 'dextrose_5',
  'dextrose 5%': 'dextrose_5',

  // Office & General
  'kertas hvs': 'paper_hvs',
  'hvs': 'paper_hvs',
  'paper a4': 'paper_hvs_a4',
  'hvs a4': 'paper_hvs_a4',
  'sidu': 'sinardunia',
  'sinar dunia': 'sinardunia',
  'thermal paper': 'thermal_paper_roll',
  'kertas thermal': 'thermal_paper_roll',
  'toner': 'printer_toner',
  'catridge': 'printer_cartridge',
  'cartridge': 'printer_cartridge',
};

/**
 * Normalizes item names to standard canonical tokens
 */
export function normalizeSemanticToken(rawName: string): { normalized: string; canonicalKey: string; tokens: string[] } {
  if (!rawName) return { normalized: '', canonicalKey: 'unnamed_item', tokens: [] };

  // Lowercase & remove non-alphanumeric except dots/percentages
  let text = rawName.toLowerCase()
    .replace(/[^\w\s\d.,%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Replace common unit abbreviations
  text = text
    .replace(/\b(\d+)\s*(gr|gram|gms)\b/g, '$1g')
    .replace(/\b(\d+)\s*(ml|mililiter|cc)\b/g, '$1ml')
    .replace(/\b(\d+)\s*(l|ltr|liter)\b/g, '$1l')
    .replace(/\b(\d+)\s*(mg|miligram)\b/g, '$1mg')
    .replace(/\b(box|bx|dos|kotak)\b/g, 'box')
    .replace(/\b(pcs|pc|bh|buah|biji)\b/g, 'pcs')
    .replace(/\b(btl|botol|bottle)\b/g, 'btl')
    .replace(/\b(vial|vl)\b/g, 'vial')
    .replace(/\b(amp|ampul)\b/g, 'amp');

  // Replace synonyms
  for (const [key, replacement] of Object.entries(SYNONYM_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    text = text.replace(regex, replacement);
  }

  // Extract clean tokens filtering out noise words
  const rawTokens = text.split(/[\s-]+/).filter(t => t.length > 1 && !NOISE_WORDS.has(t));
  
  // Create sorted unique token key for similarity hash
  const canonicalKey = rawTokens.slice(0, 4).sort().join('_') || text.slice(0, 20);

  return {
    normalized: text,
    canonicalKey,
    tokens: rawTokens
  };
}

/**
 * Calculates Token Jaccard Overlap Similarity (0.0 to 1.0)
 */
export function calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  
  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionCount++;
  }
  
  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize === 0 ? 0 : intersectionCount / unionSize;
}

/**
 * Executes high-speed deterministic semantic grouping across transaction records
 */
export function clusterSpendTransactions(
  records: SpendRecord[],
  skuMasters: SkuMasterRecord[] = [],
  filter?: ContractTargetingFilter
): { clusters: SemanticSpendCluster[]; summary: ContractTargetingSummaryMetrics } {
  const safeFilter: ContractTargetingFilter = {
    ...DEFAULT_CONTRACT_FILTER,
    ...(filter || {})
  };

  if (!records || records.length === 0) {
    return {
      clusters: [],
      summary: {
        totalClusters: 0,
        totalAnalyzedSpend: 0,
        uncontractedSpotSpend: 0,
        contractedSpend: 0,
        overallContractCoverageRatio: 0,
        totalEstimatedSavingsIdr: 0,
        totalPoTransactions: 0,
        totalDistinctVendors: 0,
        totalHospitalUnits: 0,
        priorityCounts: {
          p1Blanket: 0,
          p2RateHarmonization: 0,
          p3VendorConsolidation: 0,
          p4TailAutomation: 0,
          monitored: 0
        }
      }
    };
  }

  // Step 1: Filter records based on criteria
  const filtered = records.filter(r => {
    if (!r) return false;

    // Category Level 1
    if (safeFilter.categoryLv1 && safeFilter.categoryLv1 !== 'ALL') {
      const cat1 = (r.taxonomyLv1 || r.procurementCategory || r.mappedCategory || r.purchaseCategory || '').toUpperCase();
      if (!cat1.includes(safeFilter.categoryLv1.toUpperCase())) return false;
    }

    // Category Level 2
    if (safeFilter.categoryLv2 && safeFilter.categoryLv2 !== 'ALL') {
      const cat2 = (r.taxonomyLv2 || '').toUpperCase();
      if (!cat2.includes(safeFilter.categoryLv2.toUpperCase())) return false;
    }

    // Spend Type (OPEX / CAPEX)
    if (safeFilter.spendType && safeFilter.spendType !== 'all') {
      const isCapex = (r.sourceFile && r.sourceFile.includes('capex')) || 
                      (r.procurementCategory || '').toUpperCase().includes('CAPEX') || 
                      (r.totalLineAmount >= 50000000 && (r.taxonomyLv1 || '').toUpperCase().includes('ASSET'));
      if (safeFilter.spendType === 'CAPEX' && !isCapex) return false;
      if (safeFilter.spendType === 'OPEX' && isCapex) return false;
    }

    // Island Filter
    if (safeFilter.island && safeFilter.island !== 'ALL') {
      const isl = (r.hospitalCode || '').toUpperCase();
      if (!isl.includes(safeFilter.island.toUpperCase())) {
        // pass through if no island field
      }
    }

    // Region Filter
    if (safeFilter.region && safeFilter.region !== 'ALL') {
      const reg = (r.hospitalCode || '').toUpperCase();
      if (!reg.includes(safeFilter.region.toUpperCase())) {
        // pass through if no direct region field
      }
    }

    // Hospital Code
    if (safeFilter.hospitalCode && safeFilter.hospitalCode !== 'ALL') {
      if (r.hospitalCode !== safeFilter.hospitalCode) return false;
    }

    // Date Range
    if (safeFilter.startDate) {
      const recDate = r.createdDate || '';
      if (recDate && recDate < safeFilter.startDate) return false;
    }
    if (safeFilter.endDate) {
      const recDate = r.createdDate || '';
      if (recDate && recDate > safeFilter.endDate) return false;
    }

    // Search Query
    if (safeFilter.searchQuery && safeFilter.searchQuery.trim()) {
      const q = safeFilter.searchQuery.toLowerCase();
      const match = (r.itemName || '').toLowerCase().includes(q) ||
                    (r.vendorName || '').toLowerCase().includes(q) ||
                    (r.itemId || '').toLowerCase().includes(q) ||
                    (r.procurementCategory || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // SKU Master Lookup Map for fast O(1) matching
  const skuLookup = new Map<string, SkuMasterRecord>();
  if (skuMasters && skuMasters.length > 0) {
    skuMasters.forEach(s => {
      if (s.id) skuLookup.set(s.id, s);
      if (s.productId) skuLookup.set(s.productId, s);
      if (s.prItemId) skuLookup.set(s.prItemId, s);
    });
  }

  // Step 2: Semantic Grouping via O(1) Hash Map & Inverted Token Index
  interface TempClusterGroup {
    clusterId: string;
    clusterName: string;
    canonicalKey: string;
    tokens: string[];
    records: SpendRecord[];
    categoryLv1: string;
    categoryLv2: string;
    categoryLv3: string;
    primaryUom: string;
  }

  const clusterGroups: TempClusterGroup[] = [];
  const directKeyMap = new Map<string, TempClusterGroup>();
  const tokenCandidateMap = new Map<string, TempClusterGroup[]>();

  for (let i = 0; i < filtered.length; i++) {
    const record = filtered[i];
    const itemName = (record.itemName || record.itemId || 'Unnamed Product').trim();
    const { canonicalKey, tokens } = normalizeSemanticToken(itemName);
    const cat1 = record.taxonomyLv1 || record.procurementCategory || record.mappedCategory || record.purchaseCategory || 'General Goods';
    const cat2 = record.taxonomyLv2 || 'General Category';
    const cat3 = record.taxonomyLv3 || 'General Subcategory';
    const uom = record.purchUnit || 'Unit';

    const hashKey = `${cat1}____${canonicalKey}`;
    let matchedCluster: TempClusterGroup | undefined = directKeyMap.get(hashKey);

    // Strategy B: If no direct hash match, check only candidate groups that share primary tokens
    if (!matchedCluster && tokens.length > 0) {
      const candidates: TempClusterGroup[] = [];
      const seenCandidates = new Set<string>();

      for (let tIdx = 0; tIdx < Math.min(tokens.length, 3); tIdx++) {
        const t = tokens[tIdx];
        const list = tokenCandidateMap.get(`${cat1}__${t}`);
        if (list) {
          for (let lIdx = 0; lIdx < list.length; lIdx++) {
            const cand = list[lIdx];
            if (!seenCandidates.has(cand.clusterId)) {
              seenCandidates.add(cand.clusterId);
              candidates.push(cand);
            }
          }
        }
      }

      for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
        const cand = candidates[cIdx];
        const sim = calculateJaccardSimilarity(cand.tokens, tokens);
        if (sim >= 0.65) {
          matchedCluster = cand;
          break;
        }
      }
    }

    if (matchedCluster) {
      matchedCluster.records.push(record);
      if (itemName.length > matchedCluster.clusterName.length && itemName.length < 75) {
        matchedCluster.clusterName = itemName;
      }
    } else {
      const newId = `cluster-${canonicalKey.replace(/[^\w-]/g, '_')}-${clusterGroups.length + 1}`;
      const newGroup: TempClusterGroup = {
        clusterId: newId,
        clusterName: itemName,
        canonicalKey,
        tokens,
        records: [record],
        categoryLv1: cat1,
        categoryLv2: cat2,
        categoryLv3: cat3,
        primaryUom: uom
      };

      clusterGroups.push(newGroup);
      directKeyMap.set(hashKey, newGroup);

      // Index tokens for fast candidate lookup (limit to top 4 tokens)
      for (let tIdx = 0; tIdx < Math.min(tokens.length, 4); tIdx++) {
        const t = tokens[tIdx];
        const tKey = `${cat1}__${t}`;
        let list = tokenCandidateMap.get(tKey);
        if (!list) {
          list = [];
          tokenCandidateMap.set(tKey, list);
        }
        if (list.length < 10) {
          list.push(newGroup);
        }
      }
    }
  }

  // Calculate Median Spend across clusters for Kraljic calibration
  const clusterTotalSpends = clusterGroups.map(g => g.records.reduce((acc, r) => acc + (r.totalLineAmount || 0), 0));
  const sortedSpends = [...clusterTotalSpends].sort((a, b) => a - b);
  const medianSpend = sortedSpends.length > 0 ? sortedSpends[Math.floor(sortedSpends.length / 2)] : 50000000;
  const highSpendThreshold = Math.max(medianSpend * 1.5, 75000000); // 75jt or 1.5x median

  // Step 3: Compute Deep Metrics & Strategic Priorities for each Cluster
  const computedClusters: SemanticSpendCluster[] = [];

  for (const group of clusterGroups) {
    const recs = group.records;
    const totalSpend = recs.reduce((acc, r) => acc + (r.totalLineAmount || 0), 0);
    
    // Apply Minimum Spend Threshold filter
    if (totalSpend < (safeFilter.minSpendThreshold || 0)) {
      continue;
    }

    const totalQty = recs.reduce((acc, r) => acc + (r.purchQty || 1), 0);
    const poOccurrences = recs.length;

    // Price Analysis & Date Tracking
    const prices = recs.map(r => r.purchPrice > 0 ? r.purchPrice : ((r.totalLineAmount || 0) / Math.max(1, r.purchQty || 1)));
    const validPrices = prices.filter(p => p > 0);
    const minUnitPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
    const maxUnitPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;
    const avgUnitPrice = totalQty > 0 ? totalSpend / totalQty : (validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0);
    const priceSpreadRatio = minUnitPrice > 0 ? Math.max(0, (maxUnitPrice - minUnitPrice) / minUnitPrice) : 0;

    // Transaction Date Range
    const dates = recs
      .map(r => r.createdDate || r.monthYear || '')
      .filter(d => Boolean(d))
      .sort();
    const earliestDate = dates.length > 0 ? dates[0] : undefined;
    const latestDate = dates.length > 0 ? dates[dates.length - 1] : undefined;
    const dateRangeFormatted = earliestDate && latestDate
      ? (earliestDate === latestDate ? earliestDate : `${earliestDate} s/d ${latestDate}`)
      : (latestDate || '-');

    // Vendor Aggregation with item variations
    const vendorMap = new Map<string, { spend: number; qty: number; poCount: number; sumPrice: number; items: Set<string> }>();
    recs.forEach(r => {
      const vName = r.vendorName || 'Unknown Vendor';
      const itName = (r.itemName || r.itemId || 'Item').trim();
      const curr = vendorMap.get(vName) || { spend: 0, qty: 0, poCount: 0, sumPrice: 0, items: new Set<string>() };
      curr.spend += (r.totalLineAmount || 0);
      curr.qty += (r.purchQty || 1);
      curr.poCount += 1;
      curr.sumPrice += (r.purchPrice || 0);
      if (itName) curr.items.add(itName);
      vendorMap.set(vName, curr);
    });

    const uniqueVendors = Array.from(vendorMap.entries()).map(([vendorName, stats]) => ({
      vendorName,
      spend: stats.spend,
      qty: stats.qty,
      poCount: stats.poCount,
      avgPrice: stats.qty > 0 ? stats.spend / stats.qty : (stats.sumPrice / stats.poCount),
      isPrimary: false,
      itemNames: Array.from(stats.items)
    })).sort((a, b) => b.spend - a.spend);

    if (uniqueVendors.length > 0) {
      uniqueVendors[0].isPrimary = true;
    }

    // Hospital Aggregation with vendor and item mapping
    const hospitalMap = new Map<string, { hospitalName?: string; spend: number; qty: number; sumPrice: number; poCount: number; vendors: Set<string>; items: Set<string> }>();
    recs.forEach(r => {
      const hCode = r.hospitalCode || 'HO';
      const vName = r.vendorName || 'Unknown Vendor';
      const itName = (r.itemName || r.itemId || 'Item').trim();
      const curr = hospitalMap.get(hCode) || { hospitalName: r.hospitalCode, spend: 0, qty: 0, sumPrice: 0, poCount: 0, vendors: new Set<string>(), items: new Set<string>() };
      curr.spend += (r.totalLineAmount || 0);
      curr.qty += (r.purchQty || 1);
      curr.sumPrice += (r.purchPrice || 0);
      curr.poCount += 1;
      if (vName) curr.vendors.add(vName);
      if (itName) curr.items.add(itName);
      hospitalMap.set(hCode, curr);
    });

    const uniqueHospitals = Array.from(hospitalMap.entries()).map(([hospitalCode, stats]) => ({
      hospitalCode,
      hospitalName: stats.hospitalName,
      spend: stats.spend,
      qty: stats.qty,
      avgPrice: stats.qty > 0 ? stats.spend / stats.qty : (stats.sumPrice / stats.poCount),
      poCount: stats.poCount,
      vendorNames: Array.from(stats.vendors),
      itemNames: Array.from(stats.items)
    })).sort((a, b) => b.spend - a.spend);

    // Contract Coverage Computation
    let contractedSpend = 0;
    let uncontractedSpend = 0;
    let contractedQty = 0;
    let uncontractedQty = 0;
    let contractedPoCount = 0;
    let uncontractedPoCount = 0;

    // Item Variations inside cluster
    const itemVarMap = new Map<string, {
      itemName: string;
      spend: number;
      qty: number;
      uom: string;
      sampleVendor: string;
      isContract: boolean;
      skuMasterId?: string;
      hospitalCodes: Set<string>;
    }>();

    recs.forEach(r => {
      const skuRec = r.skuMasterId ? skuLookup.get(r.skuMasterId) : undefined;
      const isContract = Boolean(
        (skuRec && (skuRec.isContract === true || String(skuRec.isContract).toUpperCase() === 'YES' || String(skuRec.isContract).toUpperCase() === 'TRUE'))
      );

      const spend = r.totalLineAmount || 0;
      const qty = r.purchQty || 1;

      if (isContract) {
        contractedSpend += spend;
        contractedQty += qty;
        contractedPoCount += 1;
      } else {
        uncontractedSpend += spend;
        uncontractedQty += qty;
        uncontractedPoCount += 1;
      }

      // Variation grouping
      const varKey = (r.itemName || r.itemId || 'Item').trim();
      const currVar = itemVarMap.get(varKey) || {
        itemName: varKey,
        spend: 0,
        qty: 0,
        uom: r.purchUnit || group.primaryUom,
        sampleVendor: r.vendorName || 'Vendor',
        isContract,
        skuMasterId: r.skuMasterId,
        hospitalCodes: new Set<string>()
      };
      currVar.spend += spend;
      currVar.qty += qty;
      currVar.hospitalCodes.add(r.hospitalCode || 'HO');
      itemVarMap.set(varKey, currVar);
    });

    const percentageContracted = totalSpend > 0 ? (contractedSpend / totalSpend) * 100 : 0;

    const rawItemVariations = Array.from(itemVarMap.entries()).map(([itemId, v]) => ({
      itemId,
      itemName: v.itemName,
      spend: v.spend,
      qty: v.qty,
      uom: v.uom,
      sampleVendor: v.sampleVendor,
      isContract: v.isContract,
      skuMasterId: v.skuMasterId,
      hospitalCount: v.hospitalCodes.size
    })).sort((a, b) => b.spend - a.spend);

    // Kraljic Classification
    let kraljicQuadrant: KraljicQuadrant = 'ROUTINE';
    const isHighSpend = totalSpend >= highSpendThreshold;
    const isHighSupplyRisk = uniqueVendors.length <= 1; // Few vendors = high supply risk

    if (isHighSpend && !isHighSupplyRisk) {
      kraljicQuadrant = 'LEVERAGE'; // High spend, multiple suppliers -> Perfect for Volume Blanket Contract
    } else if (isHighSpend && isHighSupplyRisk) {
      kraljicQuadrant = 'STRATEGIC'; // High spend, single/few supplier -> Long-term Partnership / Consignment
    } else if (!isHighSpend && !isHighSupplyRisk) {
      kraljicQuadrant = 'ROUTINE'; // Low spend, many suppliers -> Catalog / e-Procurement
    } else {
      kraljicQuadrant = 'BOTTLENECK'; // Low spend, single supplier -> Standardize or find substitute
    }

    // Opportunity Priority & Sourcing Recommendation
    let opportunityPriority: OpportunityPriority = 'MONITORED_STANDARD';
    let priorityScore = 0;
    let targetSavingPercentage = 0.08; // 8% default
    let recommendedContractType = 'Corporate Master Agreement (MSA)';
    let rationale = '';

    const isUncontractedSpotDominant = percentageContracted < 40 && (uncontractedSpend >= 30000000 || poOccurrences >= 5);
    const hasHighPriceVariance = priceSpreadRatio >= 0.20 && uniqueHospitals.length >= 2;
    const hasHighVendorFragmentation = uniqueVendors.length >= 3 && totalSpend >= 40000000;
    const isHighFreqTail = poOccurrences >= 8 && percentageContracted < 70;

    if (isUncontractedSpotDominant && (isHighSpend || poOccurrences >= 6)) {
      opportunityPriority = 'P1_BLANKET_CONTRACT';
      priorityScore = 95 + Math.min(5, Math.floor(totalSpend / 100000000));
      targetSavingPercentage = 0.12; // 12% savings potential from spot to bulk contract
      recommendedContractType = 'Corporate Blanket Order (2-Year Volume Lock)';
      rationale = `Item memiliki belanja spot tanpa kontrak sebesar Rp ${Math.round(uncontractedSpend).toLocaleString('id-ID')} dengan ${poOccurrences} kali PO berulang. Segera terbitkan Tender/RFP Blanket Kontrak untuk mengunci diskon volume.`;
    } else if (hasHighPriceVariance) {
      opportunityPriority = 'P2_RATE_HARMONIZATION';
      priorityScore = 85 + Math.min(10, Math.floor(priceSpreadRatio * 20));
      targetSavingPercentage = Math.min(0.20, Math.max(0.06, priceSpreadRatio * 0.5));
      recommendedContractType = 'Master Rate Card Harmonization (MFC Clause)';
      rationale = `Terdapat rentang disparitas harga ${(priceSpreadRatio * 100).toFixed(1)}% antar ${uniqueHospitals.length} unit RS. Negosiasikan Klausul Most Favored Customer (MFC) untuk menyamakan tarif termurah Rp ${Math.round(minUnitPrice).toLocaleString('id-ID')}.`;
    } else if (hasHighVendorFragmentation) {
      opportunityPriority = 'P3_VENDOR_CONSOLIDATION';
      priorityScore = 75 + Math.min(10, uniqueVendors.length * 2);
      targetSavingPercentage = 0.09; // 9% savings from supplier consolidation
      recommendedContractType = 'Preferred Vendor Dual-Sourcing Program';
      rationale = `Pengadaan terpecah ke ${uniqueVendors.length} vendor berbeda untuk komoditas serupa. Konsolidasikan volume ke 1-2 Preferred Vendor untuk mendapatkan tier diskon tertinggi.`;
    } else if (isHighFreqTail) {
      opportunityPriority = 'P4_TAIL_AUTOMATION';
      priorityScore = 65 + Math.min(10, poOccurrences);
      targetSavingPercentage = 0.05; // 5% savings + administrative efficiency
      recommendedContractType = 'e-Catalog Price Lock & Auto-Replenishment';
      rationale = `Frekuensi pemesanan sangat tinggi (${poOccurrences}x PO) dengan pola rutin. Kunci harga di e-Katalog internal untuk memangkas biaya administrasi dan lead time PO.`;
    } else {
      opportunityPriority = 'MONITORED_STANDARD';
      priorityScore = 40;
      targetSavingPercentage = 0.04;
      recommendedContractType = 'Annual Price Maintenance Review';
      rationale = `Tingkat kepatuhan kontrak memadai (${percentageContracted.toFixed(0)}% terkontrak). Lakukan review berkala menjelang masa perpanjangan kontrak.`;
    }

    // Savings Calculation
    const targetBaseSpend = opportunityPriority === 'P1_BLANKET_CONTRACT' ? uncontractedSpend : totalSpend;
    const minSavingsIdr = Math.round(targetBaseSpend * (targetSavingPercentage * 0.7));
    const maxSavingsIdr = Math.round(targetBaseSpend * (targetSavingPercentage * 1.3));

    // Min Spend Threshold check
    if (safeFilter.minSpendThreshold > 0 && totalSpend < safeFilter.minSpendThreshold) {
      continue;
    }

    // Volume Threshold check (Min & Max Range)
    if (safeFilter.minVolumeThreshold && safeFilter.minVolumeThreshold > 0 && totalQty < safeFilter.minVolumeThreshold) {
      continue;
    }
    if (safeFilter.maxVolumeThreshold && safeFilter.maxVolumeThreshold > 0 && totalQty > safeFilter.maxVolumeThreshold) {
      continue;
    }

    // Contract Status Filter check
    if (safeFilter.contractStatusFilter === 'UNCONTRACTED_ONLY' && percentageContracted > 20) {
      continue;
    }
    if (safeFilter.contractStatusFilter === 'CONTRACTED_ONLY' && percentageContracted < 80) {
      continue;
    }
    if (safeFilter.contractStatusFilter === 'MIXED_ONLY' && (percentageContracted <= 20 || percentageContracted >= 80)) {
      continue;
    }

    // Priority Filter check
    if (safeFilter.priorityFilter !== 'ALL' && opportunityPriority !== safeFilter.priorityFilter) {
      continue;
    }

    // Map detailed PO Transactions for granular Drill Down
    const poTransactions = group.records.map((r, rIdx) => {
      const isItemContract = Boolean(
        skuLookup.get(r.itemId)?.isContract ||
        (r.documentState && r.documentState.toLowerCase().includes('contract')) ||
        (r.purchasePool && r.purchasePool.toLowerCase().includes('contract'))
      );
      const qty = r.purchQty || 1;
      const unitPrice = r.purchPrice || (qty > 0 ? r.totalLineAmount / qty : 0);
      const totalAmount = r.totalLineAmount || (unitPrice * qty);
      const isCapex = (r.sourceFile && r.sourceFile.includes('capex')) || 
                      (r.procurementCategory || '').toUpperCase().includes('CAPEX');

      return {
        id: r.id || `${r.purchId || 'PO'}_${r.lineNumber || rIdx}`,
        purchId: r.purchId || 'PO-SPOT',
        createdDate: r.createdDate || r.monthYear || '-',
        hospitalCode: r.hospitalCode || 'HO',
        vendorName: r.vendorName || 'Vendor N/A',
        itemId: r.itemId || '-',
        itemName: r.itemName || r.itemId || 'Item N/A',
        purchQty: qty,
        purchUnit: r.purchUnit || group.primaryUom,
        purchPrice: unitPrice,
        totalLineAmount: totalAmount,
        isContract: isItemContract,
        documentState: r.documentState || r.purchStatusNamePo || (isItemContract ? 'Terkontrak' : 'Spot Buy'),
        spendType: isCapex ? 'CAPEX' : 'OPEX'
      };
    });

    computedClusters.push({
      id: group.clusterId,
      clusterName: group.clusterName,
      canonicalKeyword: group.canonicalKey,
      categoryLv1: group.categoryLv1,
      categoryLv2: group.categoryLv2,
      categoryLv3: group.categoryLv3,
      totalSpend,
      totalQty,
      primaryUom: group.primaryUom,
      poOccurrences,
      avgUnitPrice,
      minUnitPrice,
      maxUnitPrice,
      priceSpreadRatio,
      earliestDate,
      latestDate,
      dateRangeFormatted,
      uniqueVendors,
      uniqueHospitals,
      contractCoverage: {
        contractedSpend,
        uncontractedSpend,
        contractedQty,
        uncontractedQty,
        contractedPoCount,
        uncontractedPoCount,
        percentageContracted
      },
      kraljicQuadrant,
      opportunityPriority,
      priorityScore,
      potentialSavingsEstimate: {
        minSavingsIdr,
        maxSavingsIdr,
        targetSavingPercentage,
        recommendedContractType,
        rationale
      },
      rawItemVariations,
      poTransactions
    });
  }

  // Sort clusters by Priority Score & Total Spend
  computedClusters.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return b.totalSpend - a.totalSpend;
  });

  // Step 4: Overall Summary Metrics
  const totalAnalyzedSpend = computedClusters.reduce((acc, c) => acc + c.totalSpend, 0);
  const uncontractedSpotSpend = computedClusters.reduce((acc, c) => acc + c.contractCoverage.uncontractedSpend, 0);
  const contractedSpend = computedClusters.reduce((acc, c) => acc + c.contractCoverage.contractedSpend, 0);
  const totalEstimatedSavingsIdr = computedClusters.reduce((acc, c) => acc + c.potentialSavingsEstimate.minSavingsIdr, 0);
  const totalPoTransactions = computedClusters.reduce((acc, c) => acc + c.poOccurrences, 0);

  const distinctVendors = new Set<string>();
  const distinctHospitals = new Set<string>();
  const priorityCounts = {
    p1Blanket: 0,
    p2RateHarmonization: 0,
    p3VendorConsolidation: 0,
    p4TailAutomation: 0,
    monitored: 0
  };

  computedClusters.forEach(c => {
    c.uniqueVendors.forEach(v => distinctVendors.add(v.vendorName));
    c.uniqueHospitals.forEach(h => distinctHospitals.add(h.hospitalCode));
    
    if (c.opportunityPriority === 'P1_BLANKET_CONTRACT') priorityCounts.p1Blanket++;
    else if (c.opportunityPriority === 'P2_RATE_HARMONIZATION') priorityCounts.p2RateHarmonization++;
    else if (c.opportunityPriority === 'P3_VENDOR_CONSOLIDATION') priorityCounts.p3VendorConsolidation++;
    else if (c.opportunityPriority === 'P4_TAIL_AUTOMATION') priorityCounts.p4TailAutomation++;
    else priorityCounts.monitored++;
  });

  const summary: ContractTargetingSummaryMetrics = {
    totalClusters: computedClusters.length,
    totalAnalyzedSpend,
    uncontractedSpotSpend,
    contractedSpend,
    overallContractCoverageRatio: totalAnalyzedSpend > 0 ? (contractedSpend / totalAnalyzedSpend) * 100 : 0,
    totalEstimatedSavingsIdr,
    totalPoTransactions,
    totalDistinctVendors: distinctVendors.size,
    totalHospitalUnits: distinctHospitals.size,
    priorityCounts
  };

  return {
    clusters: computedClusters,
    summary
  };
}
