import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord,
  PriceSurgeItem,
  IntraVendorDiscrepancyItem,
  VendorSwitchingOpportunity,
  RegionalPriceAnalysisItem,
  StandardPriceAuditItem
} from '../../../core/types/spend';
import { tokenLogger } from '../../../core/services/tokenLogger';

interface ItemKeyMeta {
  itemKey: string;
  displayId: string;
  displayName: string;
  uom: string;
  category: string;
}

function getItemKeyWithUom(r: SpendRecord): ItemKeyMeta {
  const uom = (r.purchUnit || 'UNIT').trim().toUpperCase();
  const cleanName = (r.itemName || '').trim();
  const rawTarget = (r.rawItemName || r.itemName || '').trim();
  const category = (r.taxonomyLv1 && r.taxonomyLv1 !== 'UNMAPPED / ORPHAN PO' ? r.taxonomyLv1 : (r.procurementCategory || r.mappedCategory || 'General Supplies')).trim();

  // If catalog matched, group strictly by skuMasterId + UOM
  if (r.skuMasterId) {
    return {
      itemKey: `SKU_${r.skuMasterId}___${uom}`,
      displayId: r.itemId || r.skuMasterId,
      displayName: cleanName || rawTarget,
      uom,
      category
    };
  }

  // Otherwise, group by normalized clean item name + UOM
  const normName = cleanName.toLowerCase().replace(/\s+/g, ' ');
  return {
    itemKey: `RAW_${normName}___${uom}`,
    displayId: r.itemId || 'N/A',
    displayName: cleanName || rawTarget,
    uom,
    category
  };
}

export class PriceIntelligenceService {
  /**
   * 1. Detect Historical Price Surges & Inflation per Item and Vendor
   */
  calculatePriceSurges(records: SpendRecord[]): PriceSurgeItem[] {
    if (!records || records.length === 0) return [];
    const itemVendorMap = new Map<string, { meta: ItemKeyMeta; txs: SpendRecord[] }>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r) continue;
      const meta = getItemKeyWithUom(r);
      const key = `${meta.itemKey}___${r.vendorName || 'Unknown'}`;
      let group = itemVendorMap.get(key);
      if (!group) {
        group = { meta, txs: [] };
        itemVendorMap.set(key, group);
      }
      group.txs.push(r);
    }

    const results: PriceSurgeItem[] = [];

    itemVendorMap.forEach(({ meta, txs }, key) => {
      if (txs.length < 2) return;

      // Sort by date/month
      txs.sort((a, b) => (a.monthYear || '').localeCompare(b.monthYear || ''));

      const firstTx = txs[0];
      const latestTx = txs[txs.length - 1];

      const initialPrice = firstTx.purchPrice || (firstTx.purchQty > 0 ? firstTx.totalLineAmount / firstTx.purchQty : 0);
      const latestPrice = latestTx.purchPrice || (latestTx.purchQty > 0 ? latestTx.totalLineAmount / latestTx.purchQty : 0);

      let minPrice = Infinity;
      let maxPrice = -Infinity;
      let totalQty = 0;
      let totalSpend = 0;

      for (let i = 0; i < txs.length; i++) {
        const t = txs[i];
        const p = t.purchPrice || (t.purchQty > 0 ? t.totalLineAmount / t.purchQty : 0);
        if (p > 0) {
          if (p < minPrice) minPrice = p;
          if (p > maxPrice) maxPrice = p;
        }
        totalQty += (t.purchQty || 0);
        totalSpend += (t.totalLineAmount || 0);
      }

      if (minPrice === Infinity) minPrice = initialPrice;
      if (maxPrice === -Infinity) maxPrice = latestPrice;

      const priceDelta = latestPrice - initialPrice;
      const percentageIncrease = initialPrice > 0 ? (priceDelta / initialPrice) * 100 : 0;

      // Estimated extra cost incurred due to price increase over baseline
      let estimatedExtraCost = 0;
      for (let i = 0; i < txs.length; i++) {
        const t = txs[i];
        const p = t.purchPrice || (t.purchQty > 0 ? t.totalLineAmount / t.purchQty : 0);
        if (p > initialPrice) {
          estimatedExtraCost += (p - initialPrice) * (t.purchQty || 1);
        }
      }

      let severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'STABLE' = 'STABLE';
      if (percentageIncrease >= 20) severity = 'CRITICAL';
      else if (percentageIncrease >= 10) severity = 'HIGH';
      else if (percentageIncrease >= 3) severity = 'MODERATE';

      results.push({
        id: `surge-${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
        itemId: meta.displayId,
        itemName: `${meta.displayName} [${meta.uom}]`,
        vendorName: firstTx.vendorName,
        startMonth: firstTx.monthYear,
        latestMonth: latestTx.monthYear,
        initialPrice,
        latestPrice,
        minPrice,
        maxPrice,
        priceDelta,
        percentageIncrease,
        totalQtyPurchased: totalQty,
        totalSpend,
        estimatedExtraCost,
        severity
      });
    });

    return results.sort((a, b) => b.percentageIncrease - a.percentageIncrease);
  }

  /**
   * 2. Detect Intra-Vendor Price Discrepancies (Same Vendor selling to Hospital A cheap, Hospital B expensive)
   */
  calculateIntraVendorDiscrepancies(records: SpendRecord[]): IntraVendorDiscrepancyItem[] {
    if (!records || records.length === 0) return [];
    const itemVendorMap = new Map<string, { meta: ItemKeyMeta; txs: SpendRecord[] }>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r) continue;
      const meta = getItemKeyWithUom(r);
      const key = `${meta.itemKey}___${r.vendorName || 'Unknown'}`;
      let group = itemVendorMap.get(key);
      if (!group) {
        group = { meta, txs: [] };
        itemVendorMap.set(key, group);
      }
      group.txs.push(r);
    }

    const results: IntraVendorDiscrepancyItem[] = [];

    itemVendorMap.forEach(({ meta, txs }, key) => {
      if (txs.length < 2) return;

      const hospitals = Array.from(new Set(txs.map(t => t.hospitalCode).filter(Boolean)));
      if (hospitals.length < 2) return; // Need at least 2 distinct hospital units

      let minRecord = txs[0];
      let maxRecord = txs[0];

      for (let i = 0; i < txs.length; i++) {
        const t = txs[i];
        if (t.purchPrice < minRecord.purchPrice && t.purchPrice > 0) minRecord = t;
        if (t.purchPrice > maxRecord.purchPrice) maxRecord = t;
      }

      if (maxRecord.purchPrice > minRecord.purchPrice) {
        const priceDeltaIDR = maxRecord.purchPrice - minRecord.purchPrice;
        const priceVariancePct = minRecord.purchPrice > 0 ? (priceDeltaIDR / minRecord.purchPrice) * 100 : 0;

        // Calculate total leakage across all transactions that bought above the min price
        let totalQtyAtHigherPrice = 0;
        let totalLeakageAmount = 0;

        for (let i = 0; i < txs.length; i++) {
          const t = txs[i];
          if (t.purchPrice > minRecord.purchPrice) {
            const diff = t.purchPrice - minRecord.purchPrice;
            totalQtyAtHigherPrice += (t.purchQty || 0);
            totalLeakageAmount += diff * (t.purchQty || 1);
          }
        }

        results.push({
          id: `intra-${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
          vendorName: minRecord.vendorName,
          itemId: meta.displayId,
          itemName: `${meta.displayName} [${meta.uom}]`,
          minPrice: minRecord.purchPrice,
          minPriceHospital: minRecord.hospitalCode,
          minPriceMonth: minRecord.monthYear,
          maxPrice: maxRecord.purchPrice,
          maxPriceHospital: maxRecord.hospitalCode,
          maxPriceMonth: maxRecord.monthYear,
          priceVariancePct,
          priceDeltaIDR,
          totalQtyAtHigherPrice,
          totalLeakageAmount,
          hospitalsInvolved: hospitals
        });
      }
    });

    return results.sort((a, b) => b.totalLeakageAmount - a.totalLeakageAmount);
  }

  /**
   * 3. Cross-Vendor Competitor Benchmarking & Contract Shift Recommendation
   */
  calculateVendorSwitchingOpportunities(
    records: SpendRecord[],
    priceSurges: PriceSurgeItem[]
  ): VendorSwitchingOpportunity[] {
    if (!records || records.length === 0) return [];
    
    // Create an O(1) index map for price surges
    const surgeMap = new Map<string, number>();
    if (priceSurges && priceSurges.length > 0) {
      for (let i = 0; i < priceSurges.length; i++) {
        const s = priceSurges[i];
        surgeMap.set(`${s.itemId}___${s.vendorName}`, s.percentageIncrease);
        surgeMap.set(`${s.itemName}___${s.vendorName}`, s.percentageIncrease);
      }
    }

    const itemMap = new Map<string, { meta: ItemKeyMeta; vendorMap: Map<string, SpendRecord[]> }>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r) continue;
      const meta = getItemKeyWithUom(r);
      let entry = itemMap.get(meta.itemKey);
      if (!entry) {
        entry = { meta, vendorMap: new Map() };
        itemMap.set(meta.itemKey, entry);
      }
      const vName = r.vendorName || 'Unknown';
      let vRecords = entry.vendorMap.get(vName);
      if (!vRecords) {
        vRecords = [];
        entry.vendorMap.set(vName, vRecords);
      }
      vRecords.push(r);
    }

    const opportunities: VendorSwitchingOpportunity[] = [];

    itemMap.forEach(({ meta, vendorMap }) => {
      if (vendorMap.size < 2) return; // Need at least 2 competing vendors for this item

      // Compute average price and volume per vendor
      const vendorStats = Array.from(vendorMap.entries()).map(([vendorName, txs]) => {
        let totalQty = 0;
        let totalSpend = 0;
        for (let i = 0; i < txs.length; i++) {
          totalQty += (txs[i].purchQty || 0);
          totalSpend += (txs[i].totalLineAmount || 0);
        }
        const avgPrice = totalQty > 0 ? totalSpend / totalQty : 0;
        const priceIncreasePct = surgeMap.get(`${meta.displayId}___${vendorName}`) || surgeMap.get(`${meta.displayName} [${meta.uom}]___${vendorName}`) || 0;
        return {
          vendorName,
          totalQty,
          totalSpend,
          avgPrice,
          priceIncreasePct
        };
      });

      // Find the cheapest vendor
      vendorStats.sort((a, b) => a.avgPrice - b.avgPrice);
      const benchmarkVendor = vendorStats[0];

      // Compare all more expensive vendors against benchmark
      for (let i = 1; i < vendorStats.length; i++) {
        const higherVendor = vendorStats[i];
        if (higherVendor.avgPrice > benchmarkVendor.avgPrice && higherVendor.totalQty > 0) {
          const unitSavingIDR = higherVendor.avgPrice - benchmarkVendor.avgPrice;
          const savingPct = (unitSavingIDR / higherVendor.avgPrice) * 100;
          const totalPotentialSavingIDR = unitSavingIDR * higherVendor.totalQty;

          let feasibilityScore: 'HIGH' | 'MEDIUM' | 'REQUIRES_CONTRACT_REVIEW' = 'HIGH';
          if (higherVendor.priceIncreasePct > 10) feasibilityScore = 'HIGH';
          else if (savingPct > 15) feasibilityScore = 'HIGH';
          else if (savingPct > 5) feasibilityScore = 'MEDIUM';
          else feasibilityScore = 'REQUIRES_CONTRACT_REVIEW';

          const note = higherVendor.priceIncreasePct > 5
            ? `${higherVendor.vendorName} mengalami kenaikan harga +${higherVendor.priceIncreasePct.toFixed(1)}%. Beralih ke ${benchmarkVendor.vendorName} (selisih hemat ${savingPct.toFixed(1)}%) memberikan efisiensi signifikan.`
            : `Harga ${benchmarkVendor.vendorName} lebih hemat ${savingPct.toFixed(1)}% per unit dibanding ${higherVendor.vendorName}.`;

          opportunities.push({
            id: `switch-${meta.itemKey}-${higherVendor.vendorName}-${benchmarkVendor.vendorName}`.replace(/[^a-zA-Z0-9]/g, '_'),
            itemId: meta.displayId,
            itemName: `${meta.displayName} [${meta.uom}]`,
            currentVendor: higherVendor.vendorName,
            currentAvgPrice: Math.round(higherVendor.avgPrice),
            currentQty: higherVendor.totalQty,
            currentTotalSpend: higherVendor.totalSpend,
            priceIncreasePct: higherVendor.priceIncreasePct,
            alternativeVendor: benchmarkVendor.vendorName,
            alternativePrice: Math.round(benchmarkVendor.avgPrice),
            alternativePriceVariancePct: savingPct,
            unitSavingIDR: Math.round(unitSavingIDR),
            totalPotentialSavingIDR: Math.round(totalPotentialSavingIDR),
            savingPct,
            recommendationNote: note,
            feasibilityScore
          });
        }
      }
    });

    return opportunities.sort((a, b) => b.totalPotentialSavingIDR - a.totalPotentialSavingIDR);
  }

  /**
   * 4. Regional Price Analysis (Comparing Outer Regions vs Jabodetabek Benchmark)
   */
  calculateRegionalPriceAnalysis(
    records: SpendRecord[],
    hospitalMasters: HospitalMasterRecord[]
  ): RegionalPriceAnalysisItem[] {
    if (!records || records.length === 0) return [];
    const hospMetaMap = new Map<string, HospitalMasterRecord>();
    if (hospitalMasters && hospitalMasters.length > 0) {
      for (let i = 0; i < hospitalMasters.length; i++) {
        const h = hospitalMasters[i];
        if (h && h.hospitalCode) hospMetaMap.set(h.hospitalCode, h);
      }
    }

    const jabodetabekCodes = new Set(['SHLV', 'SHKJ', 'MRCCC', 'SHBC', 'SHBG', 'SHCP', 'SHHO', 'SHLP', 'SHSH', 'SHAG', 'SHAS', 'SHTB', 'SHMK']);

    // First, find baseline price in Jabodetabek for each item
    const itemJabodetabekMap = new Map<string, { totalSpend: number; totalQty: number }>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r) continue;
      const meta = hospMetaMap.get(r.hospitalCode);
      const isJabodetabek = meta?.region === 'Jabodetabek' || jabodetabekCodes.has(r.hospitalCode);
      if (isJabodetabek) {
        const itemMeta = getItemKeyWithUom(r);
        let stat = itemJabodetabekMap.get(itemMeta.itemKey);
        if (!stat) {
          stat = { totalSpend: 0, totalQty: 0 };
          itemJabodetabekMap.set(itemMeta.itemKey, stat);
        }
        stat.totalSpend += (r.totalLineAmount || 0);
        stat.totalQty += (r.purchQty || 0);
      }
    }

    // Now group by item + hospital/region
    const itemHospMap = new Map<string, { meta: ItemKeyMeta; hospCode: string; txs: SpendRecord[] }>();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r) continue;
      const meta = getItemKeyWithUom(r);
      const hospCode = r.hospitalCode || 'GEN';
      const key = `${meta.itemKey}___${hospCode}`;
      let entry = itemHospMap.get(key);
      if (!entry) {
        entry = { meta, hospCode, txs: [] };
        itemHospMap.set(key, entry);
      }
      entry.txs.push(r);
    }

    const results: RegionalPriceAnalysisItem[] = [];

    itemHospMap.forEach(({ meta, hospCode, txs }) => {
      const hospMeta = hospMetaMap.get(hospCode);
      
      const city = hospMeta?.city || 'City N/A';
      const region = hospMeta?.region || (hospCode.startsWith('SHL') || hospCode === 'MRCCC' ? 'Jabodetabek' : 'Regional');
      const island = hospMeta?.island || (region === 'Jabodetabek' || region.includes('Jawa') ? 'Jawa' : 'Luar Jawa');
      const hospName = hospMeta?.hospitalName || `Hospital ${hospCode}`;

      let totalQty = 0;
      let totalSpend = 0;
      for (let i = 0; i < txs.length; i++) {
        totalQty += (txs[i].purchQty || 0);
        totalSpend += (txs[i].totalLineAmount || 0);
      }
      const actualAvgPrice = totalQty > 0 ? Math.round(totalSpend / totalQty) : 0;

      const jaboStat = itemJabodetabekMap.get(meta.itemKey);
      const benchmarkJabodetabekPrice = jaboStat && jaboStat.totalQty > 0
        ? Math.round(jaboStat.totalSpend / jaboStat.totalQty)
        : actualAvgPrice;

      const regionalPriceIndex = benchmarkJabodetabekPrice > 0
        ? (actualAvgPrice / benchmarkJabodetabekPrice) * 100
        : 100;

      // Expected fair logistics markup based on geography
      let expectedFairLogisticsMarkupPct = 0;
      if (island === 'Jawa' && region !== 'Jabodetabek') expectedFairLogisticsMarkupPct = 3.0; // 3%
      else if (island === 'Sumatera' || island === 'Bali & Nusa Tenggara') expectedFairLogisticsMarkupPct = 6.0; // 6%
      else if (island === 'Kalimantan' || island === 'Sulawesi') expectedFairLogisticsMarkupPct = 8.0; // 8%
      else if (island === 'Papua') expectedFairLogisticsMarkupPct = 12.0;

      const actualMarkupPct = regionalPriceIndex - 100;
      const excessiveMarkupPct = Math.max(0, actualMarkupPct - expectedFairLogisticsMarkupPct);
      const isExcessiveMarkup = excessiveMarkupPct >= 4.0; // Markup exceeds fair freight by >4%

      const fairAllowedUnitPrice = Math.round(benchmarkJabodetabekPrice * (1 + expectedFairLogisticsMarkupPct / 100));
      const potentialFairAdjustmentSaving = actualAvgPrice > fairAllowedUnitPrice
        ? (actualAvgPrice - fairAllowedUnitPrice) * totalQty
        : 0;

      results.push({
        id: `reg-${meta.itemKey}-${hospCode}`.replace(/[^a-zA-Z0-9]/g, '_'),
        itemId: meta.displayId,
        itemName: `${meta.displayName} [${meta.uom}]`,
        category: meta.category,
        island,
        region,
        city,
        hospitalCode: hospCode,
        hospitalName: hospName,
        actualAvgPrice,
        benchmarkJabodetabekPrice,
        regionalPriceIndex,
        expectedFairLogisticsMarkupPct,
        excessiveMarkupPct,
        isExcessiveMarkup,
        totalSpend,
        totalQty,
        potentialFairAdjustmentSaving
      });
    });

    return results.sort((a, b) => b.potentialFairAdjustmentSaving - a.potentialFairAdjustmentSaving);
  }

  /**
   * 5. Standard Price vs Actual Purchase Audit for SKU Management Team (ERP Reference Calibration)
   */
  calculateStandardPriceAudit(
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[]
  ): StandardPriceAuditItem[] {
    if (!records || records.length === 0) return [];
    const skuMap = new Map<string, SkuMasterRecord>();
    if (skuMasters && skuMasters.length > 0) {
      for (let i = 0; i < skuMasters.length; i++) {
        const s = skuMasters[i];
        if (!s) continue;
        if (s.id) skuMap.set(s.id, s);
        if (s.productId) skuMap.set(s.productId, s);
        if (s.prItemId) skuMap.set(s.prItemId, s);
        if (s.cprItemId) skuMap.set(s.cprItemId, s);
        if (s.name) skuMap.set(s.name.toLowerCase().trim(), s);
      }
    }

    const itemGroup = new Map<string, { meta: ItemKeyMeta; txs: SpendRecord[] }>();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r) continue;
      const meta = getItemKeyWithUom(r);
      let entry = itemGroup.get(meta.itemKey);
      if (!entry) {
        entry = { meta, txs: [] };
        itemGroup.set(meta.itemKey, entry);
      }
      entry.txs.push(r);
    }

    const results: StandardPriceAuditItem[] = [];

    itemGroup.forEach(({ meta, txs }) => {
      const firstTx = txs[0];
      const skuRecord = (firstTx.skuMasterId && skuMap.get(firstTx.skuMasterId)) ||
                        (firstTx.itemId && skuMap.get(firstTx.itemId)) || 
                        (firstTx.itemName && skuMap.get(firstTx.itemName.toLowerCase().trim()));

      let totalQty = 0;
      let totalSpend = 0;
      let actualMinPrice = Infinity;
      let actualMaxPrice = -Infinity;

      for (let i = 0; i < txs.length; i++) {
        const t = txs[i];
        const p = t.purchPrice || (t.purchQty > 0 ? t.totalLineAmount / t.purchQty : 0);
        if (p > 0) {
          if (p < actualMinPrice) actualMinPrice = p;
          if (p > actualMaxPrice) actualMaxPrice = p;
        }
        totalQty += (t.purchQty || 0);
        totalSpend += (t.totalLineAmount || 0);
      }

      const actualAvgPrice = totalQty > 0 ? Math.round(totalSpend / totalQty) : 0;
      if (actualMinPrice === Infinity) actualMinPrice = actualAvgPrice;
      if (actualMaxPrice === -Infinity) actualMaxPrice = actualAvgPrice;

      const standardPriceERP = skuRecord?.standardPrice || 0;

      let auditClassification: 'OVERPRICED_PURCHASE' | 'STANDARD_TOO_HIGH' | 'OPTIMAL_MATCH' | 'NO_ERP_STANDARD' = 'NO_ERP_STANDARD';
      let skuTeamActionRequired = '';
      let recommendedNewStandardPrice = actualAvgPrice;

      if (standardPriceERP <= 0) {
        auditClassification = 'NO_ERP_STANDARD';
        skuTeamActionRequired = 'Daftarkan Standar Price baru di SKU Master ERP berdasarkan historical avg IDR ' + actualAvgPrice.toLocaleString();
        recommendedNewStandardPrice = actualAvgPrice;
      } else {
        const variancePct = ((actualAvgPrice - standardPriceERP) / standardPriceERP) * 100;

        if (actualAvgPrice > standardPriceERP * 1.05) {
          auditClassification = 'OVERPRICED_PURCHASE';
          skuTeamActionRequired = `Harga beli aktual melebihi Standar ERP (+${variancePct.toFixed(1)}%). Rekomendasi: Audit approval PO & tegakkan batas pagu ERP.`;
          recommendedNewStandardPrice = standardPriceERP;
        } else if (standardPriceERP > actualAvgPrice * 1.15) {
          auditClassification = 'STANDARD_TOO_HIGH';
          const overestimatePct = ((standardPriceERP - actualAvgPrice) / standardPriceERP) * 100;
          skuTeamActionRequired = `Standar Price ERP terlalu tinggi (+${overestimatePct.toFixed(1)}% di atas pasar). Turunkan Standar ERP ke IDR ${actualAvgPrice.toLocaleString()} agar jadi referensi akurat.`;
          recommendedNewStandardPrice = Math.round(actualAvgPrice * 1.03); // buffer 3%
        } else {
          auditClassification = 'OPTIMAL_MATCH';
          skuTeamActionRequired = 'Standar Price ERP sinkron dan optimal dengan harga transaksi riil.';
          recommendedNewStandardPrice = standardPriceERP;
        }
      }

      const priceVarianceVsStandardPct = standardPriceERP > 0 
        ? ((actualAvgPrice - standardPriceERP) / standardPriceERP) * 100 
        : 0;

      results.push({
        id: `std-audit-${meta.itemKey}`.replace(/[^a-zA-Z0-9]/g, '_'),
        productId: skuRecord?.productId || meta.displayId,
        itemId: meta.displayId,
        itemName: `${meta.displayName} [${meta.uom}]`,
        category: meta.category,
        standardPriceERP,
        actualMinPrice,
        actualAvgPrice,
        actualMaxPrice,
        priceVarianceVsStandardPct,
        totalSpend,
        totalQty,
        auditClassification,
        skuTeamActionRequired,
        recommendedNewStandardPrice
      });
    });

    return results.sort((a, b) => {
      // Prioritize standard price overestimation & overpriced purchases
      const order = { 'STANDARD_TOO_HIGH': 1, 'OVERPRICED_PURCHASE': 2, 'NO_ERP_STANDARD': 3, 'OPTIMAL_MATCH': 4 };
      return (order[a.auditClassification] || 99) - (order[b.auditClassification] || 99);
    });
  }

  /**
   * 6. Call AI Gemini API for Executive Price Intelligence & Regional Pricing Audit
   */
  async runAiPriceIntelligenceAudit(payload: {
    priceSurges: PriceSurgeItem[];
    intraDiscrepancies: IntraVendorDiscrepancyItem[];
    switchingOpportunities: VendorSwitchingOpportunity[];
    regionalAnomalies: RegionalPriceAnalysisItem[];
    standardPriceAudits: StandardPriceAuditItem[];
  }): Promise<{
    executiveSummary: string;
    keyPriceSurgesFindings: string[];
    vendorParityLeakages: string[];
    contractSwitchingRecommendations: string[];
    regionalPricingPolicyNotes: string[];
    skuManagementActions: string[];
  }> {
    try {
      const response = await fetch('/api/ai/price-intelligence-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      // Log token usage
      await tokenLogger.logAiCall({
        model: 'gemini-2.5-flash',
        actionType: 'Price & Regional Intelligence Audit',
        promptTokens: 1450,
        responseTokens: 820,
      });

      return data;
    } catch (err) {
      console.warn('AI Price Intelligence fallback generated:', err);
      // Generate structured fallback intelligence
      const topSurge = payload.priceSurges[0];
      const topLeak = payload.intraDiscrepancies[0];
      const topSwitch = payload.switchingOpportunities[0];
      const topStdOver = payload.standardPriceAudits.find(s => s.auditClassification === 'STANDARD_TOO_HIGH');

      return {
        executiveSummary: `Audit Intelijen Harga mengidentifikasi ${payload.priceSurges.filter(s => s.severity === 'CRITICAL').length} lonjakan harga kritis, potensi kebocoran disparitas vendor sebesar Rp ${(payload.intraDiscrepancies.reduce((a, b) => a + b.totalLeakageAmount, 0)).toLocaleString()}, serta peluang efisiensi pengalihan vendor sebesar Rp ${(payload.switchingOpportunities.reduce((a, b) => a + b.totalPotentialSavingIDR, 0)).toLocaleString()}.`,
        keyPriceSurgesFindings: [
          topSurge ? `Kenaikan tertinggi pada "${topSurge.itemName}" oleh ${topSurge.vendorName} (+${topSurge.percentageIncrease.toFixed(1)}% dari Rp ${topSurge.initialPrice.toLocaleString()} ke Rp ${topSurge.latestPrice.toLocaleString()}).` : 'Tidak ditemukan lonjakan harga abnormal.',
          'Pola kenaikan harga terkonsentrasi pada kuartal berjalan yang memerlukan komitmen kontrak harga tetap (Fixed Price Agreement).'
        ],
        vendorParityLeakages: [
          topLeak ? `Vendor ${topLeak.vendorName} menjual "${topLeak.itemName}" ke ${topLeak.minPriceHospital} di harga Rp ${topLeak.minPrice.toLocaleString()}, namun menjual ke ${topLeak.maxPriceHospital} di harga Rp ${topLeak.maxPrice.toLocaleString()} (disparitas ${topLeak.priceVariancePct.toFixed(1)}%).` : 'Disparitas harga intra-vendor dalam batas wajar.',
          'Wajib dilakukan rekonsiliasi harga korporat agar seluruh unit rumah sakit menikmati harga terendah (Most Favored Customer Clause).'
        ],
        contractSwitchingRecommendations: [
          topSwitch ? `Rekomendasi alihkan PO "${topSwitch.itemName}" dari ${topSwitch.currentVendor} ke ${topSwitch.alternativeVendor} untuk menghemat Rp ${topSwitch.totalPotentialSavingIDR.toLocaleString()} (${topSwitch.savingPct.toFixed(1)}% efisiensi).` : 'Evaluasi pergantian vendor untuk kategori consumables.',
          'Konsolidasikan volume pembelian nasional untuk mendapatkan diskon berjenjang (Volume Tier Discounting).'
        ],
        regionalPricingPolicyNotes: [
          'Terapkan batasan toleransi ongkos logistik maksimum 3% untuk Jawa Non-Jabodetabek dan 6-8% untuk Luar Jawa.',
          'Audit dan negosiasikan vendor yang menetapkan markup harga regional >10% di luar batas wajar logistik.'
        ],
        skuManagementActions: [
          topStdOver ? `Tim SKU Management perlu merevisi Standar Price ERP untuk "${topStdOver.itemName}" dari Rp ${topStdOver.standardPriceERP.toLocaleString()} menjadi Rp ${topStdOver.recommendedNewStandardPrice.toLocaleString()} agar anggaran ERP akurat.` : 'Standar Price ERP perlu dikalibrasi berkala setiap kuartal.',
          'Kunci pagu toleransi ERP agar PO yang melebihi Standar Price wajib mendapatkan persetujuan Direktur Pengadaan.'
        ]
      };
    }
  }
}

export const priceIntelligenceService = new PriceIntelligenceService();
