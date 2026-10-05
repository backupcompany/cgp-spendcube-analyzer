import { 
  SpendRecord, 
  SkuMasterRecord, 
  SavedGoogleSkuSearchItem, 
  SavedGoogleSkuSearchPreset,
  decomposeSkuString 
} from '../../../core/types/spend';

/**
 * Extracts distinct SKU items and their consolidated statistics from a set of transaction records.
 * Perfectly integrates transactions from AI Query Hub with the e-Catalogue SKU Search schema.
 */
export function extractSkuItemsFromRecords(
  records: SpendRecord[],
  skuMasters: SkuMasterRecord[] = []
): SavedGoogleSkuSearchItem[] {
  if (!records || records.length === 0) return [];

  // Build Master SKU lookup map for high performance
  const skuMasterMap = new Map<string, SkuMasterRecord>();
  for (const s of skuMasters) {
    if (s.productId) skuMasterMap.set(s.productId.toLowerCase().trim(), s);
    if (s.id) skuMasterMap.set(s.id.toLowerCase().trim(), s);
  }

  // Group by canonical SKU identifier
  const itemsMap = new Map<string, {
    item: SavedGoogleSkuSearchItem;
    totalSpend: number;
    totalQty: number;
    txCount: number;
  }>();

  for (const r of records) {
    // 1. Look for matched Master SKU
    // SYARAT: Kode SKU TIDAK PERNAH boleh diambil dari kolom itemId (karena itemId adalah COA akunting)
    // Kode SKU hanya diambil dari skuMasterId hasil pemetaan atau pemisah "::" (extractedSkuCode)
    let matchedMaster: SkuMasterRecord | undefined;
    if (r.skuMasterId) {
      matchedMaster = skuMasterMap.get(r.skuMasterId.toLowerCase().trim());
    }
    if (!matchedMaster && r.extractedSkuCode) {
      matchedMaster = skuMasterMap.get(r.extractedSkuCode.toLowerCase().trim());
    }

    const rawName = (r.itemName || r.purchReqName || 'Item Tanpa Nama').trim();
    const decomp = decomposeSkuString(rawName);

    let key: string;
    let productId: string;
    let commodityItem: string;
    let brand: string;
    let partNumber: string;
    let specLine: string;
    let purchCategoryLv1: string;
    let purchCategoryLv2: string;
    let unitOfMeasurement: string;
    let isVirtualSku: boolean;

    if (matchedMaster) {
      productId = matchedMaster.productId || matchedMaster.id;
      key = `MASTER-${productId.toLowerCase().trim()}`;
      commodityItem = (matchedMaster.commodityItem || decomp.commodityItem || matchedMaster.name || rawName).trim();
      brand = (matchedMaster.brand || decomp.brand || 'NB').trim();
      partNumber = (matchedMaster.partNumber || decomp.partNumber || 'NP').trim();
      specLine = (matchedMaster.specification1 || decomp.generalSpec || '-').trim();
      purchCategoryLv1 = matchedMaster.purchCategoryLv1 || r.procurementCategory || 'General Supplies';
      purchCategoryLv2 = matchedMaster.purchCategoryLv2 || r.purchaseCategory || '';
      unitOfMeasurement = matchedMaster.unitOfMeasurement || r.purchUnit || 'Unit';
      isVirtualSku = false;
    } else {
      // Unmapped transaction SKU - construct virtual SKU from decomposed components
      // Kode SKU HANYA diambil dari pemisah "::" (extractedSkuCode), TIDAK PERNAH dari r.itemId (COA akunting)
      const safeCode = r.extractedSkuCode || `tx-${encodeURIComponent(rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}`;
      productId = safeCode;
      key = `TX-${rawName.toLowerCase().trim()}`;
      commodityItem = (r.commodityItem || decomp.commodityItem || rawName).trim();
      brand = (r.brand || decomp.brand || 'NB').trim();
      partNumber = (r.partNumber || decomp.partNumber || 'NP').trim();
      specLine = (r.generalSpec || decomp.generalSpec || '-').trim();
      purchCategoryLv1 = r.procurementCategory || r.mappedCategory || 'Belum Ter-map';
      purchCategoryLv2 = r.purchaseCategory || '';
      unitOfMeasurement = r.purchUnit || 'Unit';
      isVirtualSku = true;
    }

    const lineSpend = Number(r.totalLineAmount || 0);
    const lineQty = Number(r.purchQty || 0);

    const existing = itemsMap.get(key);
    if (existing) {
      existing.totalSpend += lineSpend;
      existing.totalQty += lineQty;
      existing.txCount += 1;
      existing.item.totalSpend = existing.totalSpend;
      existing.item.totalQty = existing.totalQty;
      existing.item.transactionCount = existing.txCount;
    } else {
      itemsMap.set(key, {
        item: {
          productId,
          commodityItem,
          brand,
          partNumber,
          specLine,
          purchCategoryLv1,
          purchCategoryLv2,
          unitOfMeasurement,
          isVirtualSku,
          totalSpend: lineSpend,
          totalQty: lineQty,
          transactionCount: 1
        },
        totalSpend: lineSpend,
        totalQty: lineQty,
        txCount: 1
      });
    }
  }

  // Return items sorted by total spend descending
  return Array.from(itemsMap.values())
    .map(entry => entry.item)
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

/**
 * Calculates deduplication metrics when adding items to an existing Saved Search Preset.
 */
export function calculatePresetAppendStats(
  targetPreset: SavedGoogleSkuSearchPreset,
  newItems: SavedGoogleSkuSearchItem[]
): {
  existingCount: number;
  newUniqueCount: number;
  duplicateCount: number;
  mergedTotalCount: number;
} {
  const existingSet = new Set<string>((targetPreset.selectedProductIds || []).map(id => id.toLowerCase().trim()));
  let duplicateCount = 0;
  let newUniqueCount = 0;

  for (const item of newItems) {
    const id = (item.productId || '').toLowerCase().trim();
    if (existingSet.has(id)) {
      duplicateCount++;
    } else {
      newUniqueCount++;
    }
  }

  const existingCount = targetPreset.selectedItems?.length || existingSet.size;
  return {
    existingCount,
    newUniqueCount,
    duplicateCount,
    mergedTotalCount: existingCount + newUniqueCount
  };
}

/**
 * Merges new SKU items into an existing Saved Search Preset without duplication.
 */
export function mergeItemsIntoSavedPreset(
  targetPreset: SavedGoogleSkuSearchPreset,
  itemsToAdd: SavedGoogleSkuSearchItem[]
): SavedGoogleSkuSearchPreset {
  const map = new Map<string, SavedGoogleSkuSearchItem>();

  // Insert existing items
  for (const it of (targetPreset.selectedItems || [])) {
    const key = (it.productId || '').toLowerCase().trim();
    if (key) map.set(key, it);
  }

  // Insert or update with new items
  for (const it of itemsToAdd) {
    const key = (it.productId || '').toLowerCase().trim();
    if (key) {
      if (map.has(key)) {
        // Refresh stats
        const prev = map.get(key)!;
        map.set(key, {
          ...prev,
          totalSpend: (prev.totalSpend || 0) + (it.totalSpend || 0),
          totalQty: (prev.totalQty || 0) + (it.totalQty || 0),
          transactionCount: (prev.transactionCount || 0) + (it.transactionCount || 0)
        });
      } else {
        map.set(key, it);
      }
    }
  }

  const mergedItems = Array.from(map.values());
  const mergedProductIds = mergedItems.map(it => it.productId);

  return {
    ...targetPreset,
    selectedItems: mergedItems,
    selectedProductIds: mergedProductIds,
    updatedAt: new Date().toISOString()
  };
}
