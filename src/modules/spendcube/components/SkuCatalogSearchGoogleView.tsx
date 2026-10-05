import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  FileText
} from 'lucide-react';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  decomposeSkuString, 
  parseSpecSlots,
  SavedGoogleSkuSearchItem,
  SavedGoogleSkuSearchPreset
} from '../../../core/types/spend';
import { vectorService } from '../services/vectorService';
import { 
  SkuCatalogSearchGoogleViewProps, 
  SkuEnrichedWithStats, 
  CommodityGroup, 
  isSkuActive, 
  formatIDR,
  MatchedTransactionItem
} from './skuSearch/types';
import { GoogleSearchLanding } from './skuSearch/GoogleSearchLanding';
import { GoogleSearchResultsHeader } from './skuSearch/GoogleSearchResultsHeader';
import { SkuCommodityCard } from './skuSearch/SkuCommodityCard';
import { SkuTransactionDrillDownModal } from './skuSearch/SkuTransactionDrillDownModal';
import { SkuSearchActionBar } from './skuSearch/SkuSearchActionBar';
import { SkuSaveSearchModal } from './skuSearch/SkuSaveSearchModal';
import { SkuSavedSearchesModal } from './skuSearch/SkuSavedSearchesModal';
import { SkuExcludedNoticeBanner } from './skuSearch/SkuExcludedNoticeBanner';
import { TaxonomyTreeMapAndTopCharts } from './TaxonomyTreeMapAndTopCharts';
import { 
  saveSavedSkuSearchPreset, 
  getAllSavedSkuSearchPresets, 
  deleteSavedSkuSearchPreset 
} from '../../../core/db/db';

export const SkuCatalogSearchGoogleView: React.FC<SkuCatalogSearchGoogleViewProps> = ({
  records = [],
  skuMasters = [],
  diskCacheMap,
  onSelectRecord,
  onOpenAiAdvisor
}) => {
  // Controlled input states (does not search on keystroke)
  const [keywordInput, setKeywordInput] = useState('');
  const [brandInput, setBrandInput] = useState('');

  // Committed search states (only updated on "Cari" click or Enter)
  const [committedQuery, setCommittedQuery] = useState('');
  const [committedBrand, setCommittedBrand] = useState('');
  const [hasExecutedSearch, setHasExecutedSearch] = useState<boolean>(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [onlyWithTransactions, setOnlyWithTransactions] = useState<boolean>(false);
  const [includeUnmapped, setIncludeUnmapped] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selection & Saved Search State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<SavedGoogleSkuSearchPreset[]>([]);
  const [activeLoadedPreset, setActiveLoadedPreset] = useState<SavedGoogleSkuSearchPreset | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSavedSearchesModalOpen, setIsSavedSearchesModalOpen] = useState(false);

  // Saved Search Exclusion / Deduplication filter state
  const [excludePresetId, setExcludePresetId] = useState<string | null>(null);
  const [hideExcludedItems, setHideExcludedItems] = useState<boolean>(true);
  const [appendTargetPresetId, setAppendTargetPresetId] = useState<string | null>(null);

  // Resolve the active excluded preset object and its set of product IDs
  const excludePreset = useMemo(() => {
    if (!excludePresetId) return null;
    return savedSearches.find(p => p.id === excludePresetId) || null;
  }, [savedSearches, excludePresetId]);

  const excludedProductIdsSet = useMemo(() => {
    if (!excludePreset || !excludePreset.selectedProductIds) return new Set<string>();
    return new Set<string>(excludePreset.selectedProductIds);
  }, [excludePreset]);

  // View Mode: Google List vs Dashboard Treemap & Top 10 Charts
  const [activeResultsView, setActiveResultsView] = useState<'list' | 'dashboard'>('list');

  // Modals state
  const [activeDrillDownSku, setActiveDrillDownSku] = useState<SkuEnrichedWithStats | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load saved searches from IndexedDB on mount
  const refreshSavedSearches = useCallback(async () => {
    try {
      const presets = await getAllSavedSkuSearchPresets();
      presets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedSearches(presets);
    } catch (err) {
      console.error('Error loading saved SKU searches:', err);
    }
  }, []);

  useEffect(() => {
    refreshSavedSearches();
  }, [refreshSavedSearches]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Berhasil menyalin: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Search execution trigger
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = keywordInput.trim();
    const b = brandInput.trim();
    setCommittedQuery(q);
    setCommittedBrand(b);
    setHasExecutedSearch(true);
    setSelectedCategory('All');
    setActiveLoadedPreset(null);
  };

  // Reset back to Google Homepage screen
  const handleResetToHome = () => {
    setKeywordInput('');
    setBrandInput('');
    setCommittedQuery('');
    setCommittedBrand('');
    setHasExecutedSearch(false);
    setSelectedCategory('All');
    setSelectedProductIds(new Set());
    setActiveLoadedPreset(null);
    setActiveResultsView('list');
  };

  // Quick suggestion search trigger (populates input for review and editing)
  const handleQuickSearch = (query: string, brand = '') => {
    setKeywordInput(query);
    if (brand) setBrandInput(brand);
    showToast(`Kata kunci "${query}" dimuat ke pencarian. Anda dapat mengedit atau klik "Cari Katalog".`);
    const input = document.getElementById('input-landing-sku-search');
    if (input) {
      input.focus();
    }
  };

  // Flag determining if the view should display the clean Google Homepage without loading items
  const isLandingHome = !activeLoadedPreset && (!hasExecutedSearch || (!committedQuery.trim() && !committedBrand.trim()));

  // Master SKU lookup map
  const skuMasterMap = useMemo(() => {
    const map = new Map<string, SkuMasterRecord>();
    for (const s of skuMasters) {
      const pId = (s.productId || s.id || '').toLowerCase().trim();
      if (pId) map.set(pId, s);
      if (s.id) map.set(s.id.toLowerCase().trim(), s);
    }
    return map;
  }, [skuMasters]);

  // Build Transaction-to-SKU Index: LAZILY computed ONLY when search is executed
  const { skuStatsMap, unmappedRecords, allMatchedTransactionItems, skuToMatchedTxCount } = useMemo(() => {
    if (isLandingHome) {
      return { 
        skuStatsMap: new Map<string, {
          transactions: SpendRecord[];
          totalSpend: number;
          totalQty: number;
          minPrice: number;
          maxPrice: number;
          transactionCount: number;
        }>(), 
        unmappedRecords: [], 
        allMatchedTransactionItems: [],
        skuToMatchedTxCount: new Map<string, number>()
      };
    }

    const map = new Map<string, {
      transactions: SpendRecord[];
      totalSpend: number;
      totalQty: number;
      minPrice: number;
      maxPrice: number;
      transactionCount: number;
    }>();

    const unmapped: SpendRecord[] = [];
    const allMatched: MatchedTransactionItem[] = [];
    const txMatchCountMap = new Map<string, number>();

    const rawQuery = committedQuery.toLowerCase().trim();
    const rawBrand = committedBrand.toLowerCase().trim();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];

      // Filter by Date Range if specified
      if (startDate || endDate) {
        const docDate = r.createdDate || r.monthYear || '';
        if (startDate && docDate && docDate < startDate) continue;
        if (endDate && docDate && docDate > endDate) continue;
      }

      // Check Master SKU Mapping through all sources:
      let matchedMaster: SkuMasterRecord | undefined;
      let matchedId: string | undefined;

      const normItemKey = (r.itemName || '').toLowerCase().trim();
      if (diskCacheMap && normItemKey && diskCacheMap.has(normItemKey)) {
        const cached = diskCacheMap.get(normItemKey)!;
        if (cached.orphanStatus === 'EXACT_MATCH' && cached.matchedSkuId) {
          matchedId = cached.matchedSkuId;
          matchedMaster = cached.matchedSku || skuMasterMap.get(matchedId.toLowerCase().trim());
        }
      }

      if (!matchedMaster && r.skuMasterId) {
        matchedId = r.skuMasterId;
        matchedMaster = skuMasterMap.get(matchedId.toLowerCase().trim());
      }

      const normId = matchedId ? matchedId.toLowerCase().trim() : undefined;
      const altNormId = matchedMaster?.id ? matchedMaster.id.toLowerCase().trim() : undefined;

      if (normId) {
        let stat = map.get(normId);
        if (!stat && altNormId) {
          stat = map.get(altNormId);
        }

        if (!stat) {
          stat = {
            transactions: [],
            totalSpend: 0,
            totalQty: 0,
            minPrice: Infinity,
            maxPrice: -Infinity,
            transactionCount: 0
          };
          if (!map.has(normId)) map.set(normId, stat);
          if (altNormId && !map.has(altNormId)) map.set(altNormId, stat);
        }

        stat.transactions.push(r);
        const spend = Number(r.totalLineAmount) || 0;
        const qty = Number(r.purchQty) || 0;
        const price = Number(r.purchPrice) || (qty > 0 ? spend / qty : 0);

        stat.totalSpend += spend;
        stat.totalQty += qty;
        if (price > 0 && price < stat.minPrice) stat.minPrice = price;
        if (price > stat.maxPrice) stat.maxPrice = price;
      } else {
        unmapped.push(r);
      }

      // Check if transaction specifically matches query (100% parity with Data Ingestion Audit 9 fields)
      let isTxMatch = true;
      if (rawBrand) {
        const vName = (r.vendorName || '').toLowerCase();
        const bName = (r.brand || '').toLowerCase();
        if (!vName.includes(rawBrand) && !bName.includes(rawBrand)) isTxMatch = false;
      }
      if (isTxMatch && rawQuery) {
        isTxMatch = Boolean(
          (r.purchId && r.purchId.toLowerCase().includes(rawQuery)) ||
          (r.itemName && r.itemName.toLowerCase().includes(rawQuery)) ||
          (r.itemNotes && r.itemNotes.toLowerCase().includes(rawQuery)) ||
          (r.rawItemName && r.rawItemName.toLowerCase().includes(rawQuery)) ||
          (r.vendorName && r.vendorName.toLowerCase().includes(rawQuery)) ||
          (r.hospitalCode && r.hospitalCode.toLowerCase().includes(rawQuery)) ||
          (r.sourceFile && r.sourceFile.toLowerCase().includes(rawQuery)) ||
          (r.purchReqName && r.purchReqName.toLowerCase().includes(rawQuery)) ||
          (r.procurementCategory && r.procurementCategory.toLowerCase().includes(rawQuery))
        );
      }

      if (isTxMatch) {
        const status = r.orphanStatus === 'EXACT_MATCH'
          ? 'EXACT_MATCH'
          : (r.orphanStatus === 'PARTIAL_ORPHAN' ? 'PARTIAL_ORPHAN' : (matchedId ? 'EXACT_MATCH' : 'UNMAPPED'));

        allMatched.push({
          record: r,
          mappedSku: matchedMaster,
          status
        });

        if (normId) {
          const newCount = (txMatchCountMap.get(normId) || 0) + 1;
          txMatchCountMap.set(normId, newCount);
          if (altNormId && altNormId !== normId) {
            txMatchCountMap.set(altNormId, newCount);
          }
        }
      }
    }

    return { 
      skuStatsMap: map, 
      unmappedRecords: unmapped,
      allMatchedTransactionItems: allMatched,
      skuToMatchedTxCount: txMatchCountMap
    };
  }, [records, skuMasters, skuMasterMap, startDate, endDate, committedQuery, committedBrand, isLandingHome, diskCacheMap]);

  // Filter unmapped and orphan transactions by query with full parity
  const matchedUnmappedRecords = useMemo(() => {
    if (!includeUnmapped || isLandingHome) return [];
    return allMatchedTransactionItems
      .filter(it => it.status === 'UNMAPPED' || it.status === 'PARTIAL_ORPHAN' || !it.mappedSku)
      .map(it => it.record);
  }, [allMatchedTransactionItems, includeUnmapped, isLandingHome]);

  const unmappedStats = useMemo(() => {
    let spend = 0;
    let qty = 0;
    for (const r of matchedUnmappedRecords) {
      spend += Number(r.totalLineAmount) || 0;
      qty += Number(r.purchQty) || 0;
    }
    return { count: matchedUnmappedRecords.length, totalSpend: spend, totalQty: qty };
  }, [matchedUnmappedRecords]);

  // Multi-tier search filtering across all Master SKUs + Unmapped Groups
  const candidateMatchedSkus = useMemo(() => {
    if (isLandingHome) return [];

    const query = committedQuery.toLowerCase().trim();
    const brandQ = committedBrand.toLowerCase().trim();
    const queryTokens = query.split(/\s+/).filter(Boolean);

    const results: SkuEnrichedWithStats[] = [];

    // Helper: get stats for an SKU
    const getStats = (productId: string, id?: string) => {
      const pNorm = productId.toLowerCase().trim();
      const iNorm = id ? id.toLowerCase().trim() : '';
      const stat = skuStatsMap.get(pNorm) || (iNorm ? skuStatsMap.get(iNorm) : undefined);
      if (!stat) {
        return {
          transactionCount: 0,
          totalSpend: 0,
          totalQty: 0,
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0,
          transactions: []
        };
      }
      return {
        transactionCount: stat.transactions.length,
        totalSpend: stat.totalSpend,
        totalQty: stat.totalQty,
        minPrice: stat.minPrice === Infinity ? 0 : stat.minPrice,
        maxPrice: stat.maxPrice === -Infinity ? 0 : stat.maxPrice,
        avgPrice: stat.totalQty > 0 ? stat.totalSpend / stat.totalQty : 0,
        transactions: stat.transactions
      };
    };

    // 1. Search Master SKUs
    for (const sku of skuMasters) {
      const pId = (sku.productId || sku.id || '').toLowerCase();
      const iId = (sku.id || '').toLowerCase();
      const matchedTxCount = skuToMatchedTxCount.get(pId) || (iId ? skuToMatchedTxCount.get(iId) || 0 : 0);

      // Brand filter check
      if (brandQ) {
        const b = (sku.brand || '').toLowerCase();
        if (!b.includes(brandQ)) continue;
      }

      // Decompose SKU fields for matching
      const decomp = decomposeSkuString(sku.commodityItem || sku.name || '');
      const cName = (sku.name || sku.commodityItem || '').toLowerCase();
      const comm = (sku.commodityItem || decomp.commodityItem || '').toLowerCase();
      const s1 = (sku.specification1 || decomp.spec1 || '').toLowerCase();
      const s2 = (sku.specification2 || decomp.spec2 || '').toLowerCase();
      const s3 = (sku.specification3 || decomp.spec3 || '').toLowerCase();
      const brand = (sku.brand || decomp.brand || '').toLowerCase();
      const pn = (sku.partNumber || decomp.partNumber || '').toLowerCase();
      const cat1 = (sku.purchCategoryLv1 || '').toLowerCase();
      const cat2 = (sku.purchCategoryLv2 || '').toLowerCase();
      const cat3 = (sku.purchCategoryLv3 || '').toLowerCase();

      let matchScore = 0;
      let matchReason = '';

      const isPresetSavedSku = Boolean(
        activeLoadedPreset && 
        activeLoadedPreset.selectedProductIds && 
        (activeLoadedPreset.selectedProductIds.includes(sku.productId || '') || (sku.id && activeLoadedPreset.selectedProductIds.includes(sku.id)))
      );

      if (isPresetSavedSku) {
        matchScore = 100;
        matchReason = `Tersimpan di "${activeLoadedPreset?.title}"`;
      } else if (!query) {
        matchScore = 100;
        matchReason = 'All Catalog';
      } else {
        // Direct ID Match
        if (pId === query || iId === query) {
          matchScore = 100;
          matchReason = 'Direct ID Match';
        } else if (pId.includes(query) || iId.includes(query)) {
          matchScore = 95;
          matchReason = 'Partial ID Match';
        } else if (comm === query) {
          matchScore = 95;
          matchReason = 'Exact Commodity Match';
        } else if (comm.includes(query)) {
          matchScore = 90;
          matchReason = 'Commodity Match';
        } else if (cName.includes(query)) {
          matchScore = 85;
          matchReason = 'Canonical Match';
        } else if (s1.includes(query) || s2.includes(query) || s3.includes(query)) {
          matchScore = 80;
          matchReason = 'Specification Match';
        } else if (brand.includes(query)) {
          matchScore = 75;
          matchReason = 'Brand Match';
        } else if (pn.includes(query)) {
          matchScore = 75;
          matchReason = 'Part Number Match';
        } else if (cat1.includes(query) || cat2.includes(query) || cat3.includes(query)) {
          matchScore = 70;
          matchReason = 'Category Match';
        } else {
          // Token-based matching: all tokens must match at least one attribute
          const allTokensMatch = queryTokens.every(tok => 
            comm.includes(tok) || 
            cName.includes(tok) || 
            s1.includes(tok) || 
            s2.includes(tok) || 
            s3.includes(tok) || 
            brand.includes(tok) || 
            pn.includes(tok) || 
            pId.includes(tok) ||
            cat1.includes(tok) ||
            cat2.includes(tok) ||
            cat3.includes(tok)
          );

          if (allTokensMatch) {
            matchScore = 80;
            matchReason = 'Multi-Keyword Match';
          } else if (matchedTxCount > 0) {
            matchScore = 75;
            matchReason = `Matched in ${matchedTxCount} Transaction PO`;
          }
        }
      }

      if (matchScore > 0) {
        const stats = getStats(sku.productId || sku.id, sku.id);

        if (onlyWithTransactions && stats.transactionCount === 0) {
          continue;
        }

        const activeStatus = isSkuActive(sku);

        const slot1 = sku.specification1 && sku.specification1 !== '-' ? sku.specification1.toUpperCase() : '-';
        const slot2 = sku.specification2 && sku.specification2 !== '-' ? sku.specification2.toUpperCase() : '-';
        const slot3 = sku.specification3 && sku.specification3 !== '-' ? sku.specification3.toUpperCase() : '-';
        const specLine = `${slot1} • ${slot2} • ${slot3}`;

        results.push({
          sku,
          productId: sku.productId || sku.id,
          canonicalName: sku.name || sku.commodityItem || 'General Item',
          commodityItem: sku.commodityItem || decomp.commodityItem || 'General Item',
          specSlot1: sku.specification1 || decomp.spec1 || '-',
          specSlot2: sku.specification2 || decomp.spec2 || '-',
          specSlot3: sku.specification3 || decomp.spec3 || '-',
          specLine,
          brand: sku.brand || decomp.brand || 'NB',
          partNumber: sku.partNumber || decomp.partNumber || 'NP',
          purchCategoryLv1: sku.purchCategoryLv1 || 'General Supplies',
          purchCategoryLv2: sku.purchCategoryLv2 || 'Supplies',
          purchCategoryLv3: sku.purchCategoryLv3 || '',
          unitOfMeasurement: sku.unitOfMeasurement || 'Unit',
          transactionCount: stats.transactionCount,
          totalSpend: stats.totalSpend,
          totalQty: stats.totalQty,
          minPrice: stats.minPrice,
          maxPrice: stats.maxPrice,
          avgPrice: stats.avgPrice,
          standardPrice: Number(sku.standardPrice) || stats.avgPrice || 0,
          transactions: stats.transactions,
          matchScore,
          isSemanticMatch: false,
          matchReason,
          isActive: activeStatus,
          matchedViaTransactionCount: matchedTxCount,
          isMatchedViaTransaction: matchedTxCount > 0
        });
      }
    }

    // 2. Synthesize Unmapped Transactions into structured items
    if (includeUnmapped && matchedUnmappedRecords.length > 0) {
      const unmappedItemMap = new Map<string, SpendRecord[]>();

      for (const r of matchedUnmappedRecords) {
        const itemKey = (r.itemName || r.rawItemName || 'Item Belum Terpetakan').trim();
        const existing = unmappedItemMap.get(itemKey) || [];
        existing.push(r);
        unmappedItemMap.set(itemKey, existing);
      }

      let unmappedIndex = 0;
      unmappedItemMap.forEach((txList, rawName) => {
        unmappedIndex++;
        let totalSpend = 0;
        let totalQty = 0;
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        for (const r of txList) {
          const spend = Number(r.totalLineAmount) || 0;
          const qty = Number(r.purchQty) || 0;
          const price = Number(r.purchPrice) || (qty > 0 ? spend / qty : 0);
          totalSpend += spend;
          totalQty += qty;
          if (price > 0 && price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        }

        const sample = txList[0];
        const decomp = decomposeSkuString(rawName);
        
        // High-entropy 64-bit cyrb53 hash to prevent collision + sequence index
        let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
        for (let i = 0; i < rawName.length; i++) {
          const ch = rawName.charCodeAt(i);
          h1 = Math.imul(h1 ^ ch, 2654435761);
          h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        const nameHash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
        const virtualProductId = `UNMAPPED-${unmappedIndex}-${nameHash}`;

        const s1 = decomp.spec1 || '-';
        const s2 = decomp.spec2 || '-';
        const s3 = decomp.spec3 || '-';
        const specLine = `${s1} • ${s2} • ${s3}`;

        const virtualSku: SkuMasterRecord = {
          id: virtualProductId,
          productId: virtualProductId,
          name: rawName,
          commodityItem: decomp.commodityItem || rawName,
          purchCategoryLv1: 'Belum Ter-map',
          purchCategoryLv2: sample.procurementCategory || 'Transaksi Tanpa Master SKU',
          purchCategoryLv3: '',
          purchCategoryLv4: '',
          prItemId: '',
          prFaCategory: '',
          cprItemId: '',
          cprFaCategory: '',
          spItemId: '',
          unitOfMeasurement: sample.purchUnit || 'Unit',
          isGenericProduct: false,
          brand: sample.brand || decomp.brand || 'NB',
          specification1: s1,
          specification2: s2,
          specification3: s3,
          partNumber: sample.partNumber || decomp.partNumber || 'NP',
          standardPrice: totalQty > 0 ? totalSpend / totalQty : 0,
          isActive: true,
          isContract: false
        };

        results.push({
          sku: virtualSku,
          productId: virtualProductId,
          canonicalName: rawName,
          commodityItem: decomp.commodityItem || rawName,
          specSlot1: s1,
          specSlot2: s2,
          specSlot3: s3,
          specLine,
          brand: virtualSku.brand,
          partNumber: virtualSku.partNumber,
          purchCategoryLv1: 'Belum Ter-map',
          purchCategoryLv2: virtualSku.purchCategoryLv2,
          purchCategoryLv3: '',
          unitOfMeasurement: virtualSku.unitOfMeasurement,
          transactionCount: txList.length,
          totalSpend,
          totalQty,
          minPrice: minPrice === Infinity ? 0 : minPrice,
          maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
          avgPrice: totalQty > 0 ? totalSpend / totalQty : 0,
          standardPrice: totalQty > 0 ? totalSpend / totalQty : 0,
          transactions: txList,
          matchScore: 80,
          isSemanticMatch: false,
          matchReason: 'Unmapped Transaction Item',
          isActive: true,
          isUnmappedGroup: true,
          isVirtualSku: true,
          rawItemKey: rawName
        });
      });
    }

    // Sort results: highest match score first, then active SKU over inactive, then by transactions count
    results.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (b.transactionCount !== a.transactionCount) return b.transactionCount - a.transactionCount;
      return b.totalSpend - a.totalSpend;
    });

    return results;
  }, [skuMasters, skuStatsMap, skuToMatchedTxCount, committedQuery, committedBrand, onlyWithTransactions, isLandingHome, includeUnmapped, matchedUnmappedRecords, activeLoadedPreset]);

  // Count how many candidate matched items are already in the excluded collection
  const excludedCountInResults = useMemo(() => {
    if (!excludePresetId || excludedProductIdsSet.size === 0) return 0;
    let count = 0;
    for (const s of candidateMatchedSkus) {
      if (excludedProductIdsSet.has(s.productId) || (s.sku?.id && excludedProductIdsSet.has(s.sku.id))) {
        count++;
      }
    }
    return count;
  }, [candidateMatchedSkus, excludePresetId, excludedProductIdsSet]);

  // Displayed candidate SKUs: filter out excluded items when hideExcludedItems is active
  const displayedCandidateSkus = useMemo(() => {
    if (!excludePresetId || !hideExcludedItems || excludedProductIdsSet.size === 0) {
      return candidateMatchedSkus;
    }
    return candidateMatchedSkus.filter(s => {
      const isExcluded = excludedProductIdsSet.has(s.productId) || (s.sku?.id && excludedProductIdsSet.has(s.sku.id));
      return !isExcluded;
    });
  }, [candidateMatchedSkus, excludePresetId, hideExcludedItems, excludedProductIdsSet]);

  // Extract Dynamic Category Chips from results (Includes 'Belum Ter-map' / 'Unmapped')
  const { availableCategories, categoryCounts } = useMemo(() => {
    if (displayedCandidateSkus.length === 0) {
      return { availableCategories: ['All'], categoryCounts: { All: 0 } };
    }
    const counts: Record<string, number> = { All: displayedCandidateSkus.length };
    for (const item of displayedCandidateSkus) {
      const cat = item.purchCategoryLv1 || 'General Supplies';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    
    const sortedCats = Object.keys(counts)
      .filter(c => c !== 'All')
      .sort((a, b) => {
        if (a === 'Belum Ter-map' || a === 'Unmapped') return 1;
        if (b === 'Belum Ter-map' || b === 'Unmapped') return -1;
        return (counts[b] || 0) - (counts[a] || 0);
      });

    return {
      availableCategories: ['All', ...sortedCats],
      categoryCounts: counts
    };
  }, [displayedCandidateSkus]);

  // Group candidate SKUs by Commodity Name
  const searchResults = useMemo(() => {
    const filtered = selectedCategory === 'All' 
      ? displayedCandidateSkus 
      : displayedCandidateSkus.filter(s => s.purchCategoryLv1 === selectedCategory);

    const groupMap = new Map<string, CommodityGroup>();

    for (const item of filtered) {
      const commKey = item.commodityItem.toUpperCase().trim();
      const groupKey = item.isUnmappedGroup ? `UNMAPPED-GROUP-${commKey}` : `CATALOG-GROUP-${commKey}`;
      let group = groupMap.get(groupKey);
      if (!group) {
        group = {
          id: groupKey,
          commodityName: item.commodityItem,
          breadcrumb: `${item.purchCategoryLv1} › ${item.purchCategoryLv2}`,
          purchCategoryLv1: item.purchCategoryLv1,
          purchCategoryLv2: item.purchCategoryLv2,
          skus: [],
          totalTx: 0,
          totalSpend: 0,
          totalQty: 0,
          uom: item.unitOfMeasurement || 'Unit',
          bestScore: item.matchScore,
          isUnmappedGroup: Boolean(item.isUnmappedGroup)
        };
        groupMap.set(groupKey, group);
      }

      if (item.isUnmappedGroup) {
        group.isUnmappedGroup = true;
      }

      group.skus.push(item);
      group.totalTx += item.transactionCount;
      group.totalSpend += item.totalSpend;
      group.totalQty += item.totalQty;
      if (item.matchScore > group.bestScore) group.bestScore = item.matchScore;
    }

    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      if (b.totalTx !== a.totalTx) return b.totalTx - a.totalTx;
      return b.totalSpend - a.totalSpend;
    });

    return groups;
  }, [displayedCandidateSkus, selectedCategory]);

  // ==================== SELECTION LOGIC ====================
  const visibleSkus = useMemo(() => {
    const list: SkuEnrichedWithStats[] = [];
    for (const g of searchResults) {
      for (const s of g.skus) {
        list.push(s);
      }
    }
    return list;
  }, [searchResults]);

  // Selectable SKUs: Skips items already in the excluded collection
  const selectableSkus = useMemo(() => {
    return visibleSkus.filter(s => {
      if (excludePresetId && (excludedProductIdsSet.has(s.productId) || (s.sku?.id && excludedProductIdsSet.has(s.sku.id)))) {
        return false;
      }
      return true;
    });
  }, [visibleSkus, excludePresetId, excludedProductIdsSet]);

  const isAllSelected = useMemo(() => {
    if (selectableSkus.length === 0) return false;
    return selectableSkus.every(s => selectedProductIds.has(s.productId));
  }, [selectableSkus, selectedProductIds]);

  const handleToggleSelectAll = () => {
    if (selectableSkus.length === 0) {
      showToast('Tidak ada baris SKU baru yang dapat dipilih.');
      return;
    }

    if (isAllSelected) {
      const next = new Set(selectedProductIds);
      for (const s of selectableSkus) {
        next.delete(s.productId);
      }
      setSelectedProductIds(next);
      showToast('Pilihan baris SKU dibatalkan.');
    } else {
      const next = new Set(selectedProductIds);
      for (const s of selectableSkus) {
        next.add(s.productId);
      }
      setSelectedProductIds(next);
      showToast(`${selectableSkus.length} baris SKU dipilih.`);
    }
  };

  const handleToggleSelectSku = (sku: SkuEnrichedWithStats) => {
    if (excludePresetId && (excludedProductIdsSet.has(sku.productId) || (sku.sku?.id && excludedProductIdsSet.has(sku.sku.id)))) {
      showToast(`SKU ini sudah ada di koleksi "${excludePreset?.title}".`);
      return;
    }
    const next = new Set(selectedProductIds);
    if (next.has(sku.productId)) {
      next.delete(sku.productId);
    } else {
      next.add(sku.productId);
    }
    setSelectedProductIds(next);
  };

  const handleToggleSelectGroup = (group: CommodityGroup) => {
    const selectableGroupSkus = group.skus.filter(s => {
      if (excludePresetId && (excludedProductIdsSet.has(s.productId) || (s.sku?.id && excludedProductIdsSet.has(s.sku.id)))) {
        return false;
      }
      return true;
    });

    if (selectableGroupSkus.length === 0) {
      showToast(`Semua SKU pada ${group.commodityName} sudah terdaftar di koleksi "${excludePreset?.title}".`);
      return;
    }

    const groupPIds = selectableGroupSkus.map(s => s.productId);
    const allGroupSelected = groupPIds.every(id => selectedProductIds.has(id));
    const next = new Set(selectedProductIds);

    if (allGroupSelected) {
      for (const id of groupPIds) {
        next.delete(id);
      }
      showToast(`Batal memilih komoditas ${group.commodityName}.`);
    } else {
      for (const id of groupPIds) {
        next.add(id);
      }
      showToast(`Memilih ${groupPIds.length} SKU untuk ${group.commodityName}.`);
    }
    setSelectedProductIds(next);
  };

  // Helper to compute live transaction stats for a saved preset
  const getLivePresetStats = useCallback((preset: SavedGoogleSkuSearchPreset) => {
    let spend = 0;
    let tx = 0;
    const pIds = preset.selectedProductIds || [];
    for (const pId of pIds) {
      const norm = pId.toLowerCase().trim();
      const stat = skuStatsMap.get(norm);
      if (stat) {
        spend += stat.totalSpend;
        tx += stat.transactionCount;
      }
    }
    return { totalSpend: spend, totalTx: tx };
  }, [skuStatsMap]);

  // Helper to compute live transaction stats for an individual SKU in a preset
  const getLiveItemStats = useCallback((productId: string) => {
    const norm = productId.toLowerCase().trim();
    const stat = skuStatsMap.get(norm);
    return {
      transactionCount: stat ? stat.transactionCount : 0,
      totalSpend: stat ? stat.totalSpend : 0
    };
  }, [skuStatsMap]);

  // Triggered when user clicks "Tambah SKU" from Saved Searches modal
  const handleAppendNewSearchToPreset = (preset: SavedGoogleSkuSearchPreset) => {
    setExcludePresetId(preset.id);
    setHideExcludedItems(true);
    setAppendTargetPresetId(preset.id);
    setSelectedProductIds(new Set()); // fresh selection for new SKUs
    setActiveResultsView('list');
    showToast(`Mode Tambah SKU ke "${preset.title}" aktif. SKU yang sudah ada di koleksi ini otomatis dikecualikan.`);
  };

  // Build Selected Items Array with Stats for Saved Search modal and dashboard
  const selectedSkuItems = useMemo(() => {
    const map = new Map<string, SkuEnrichedWithStats>();
    for (const s of candidateMatchedSkus) {
      map.set(s.productId, s);
    }

    const items: SavedGoogleSkuSearchItem[] = [];
    for (const pId of selectedProductIds) {
      const s = map.get(pId);
      if (s) {
        items.push({
          productId: s.productId,
          commodityItem: s.commodityItem,
          brand: s.brand,
          partNumber: s.partNumber,
          specLine: s.specLine,
          purchCategoryLv1: s.purchCategoryLv1,
          purchCategoryLv2: s.purchCategoryLv2,
          unitOfMeasurement: s.unitOfMeasurement,
          isVirtualSku: s.isVirtualSku,
          totalSpend: s.totalSpend,
          totalQty: s.totalQty,
          transactionCount: s.transactionCount
        });
      }
    }
    return items;
  }, [candidateMatchedSkus, selectedProductIds]);

  const { selectedTotalSpend, selectedTotalTx } = useMemo(() => {
    let spend = 0;
    let tx = 0;
    for (const it of selectedSkuItems) {
      spend += it.totalSpend || 0;
      tx += it.transactionCount || 0;
    }
    return { selectedTotalSpend: spend, selectedTotalTx: tx };
  }, [selectedSkuItems]);

  // ==================== SAVED SEARCH CRUD ====================
  const handleSaveSearchSuccess = async (preset: SavedGoogleSkuSearchPreset, mode: 'new' | 'append') => {
    try {
      await saveSavedSkuSearchPreset(preset);
      await refreshSavedSearches();
      if (activeLoadedPreset?.id === preset.id) {
        setActiveLoadedPreset(preset);
        setSelectedProductIds(new Set(preset.selectedProductIds || []));
      }
      if (excludePresetId === preset.id) {
        setSelectedProductIds(new Set());
      }
      showToast(
        mode === 'append'
          ? `Berhasil ditambahkan ke "${preset.title}" (${preset.selectedProductIds?.length || 0} SKU)`
          : `Tersimpan: "${preset.title}"`
      );
    } catch (err) {
      console.error('Error saving SKU search:', err);
      showToast('Gagal menyimpan ke IndexedDB.');
    }
  };

  const handleUpdateSavedPreset = async (updatedPreset: SavedGoogleSkuSearchPreset) => {
    try {
      await saveSavedSkuSearchPreset(updatedPreset);
      await refreshSavedSearches();
      if (activeLoadedPreset?.id === updatedPreset.id) {
        setActiveLoadedPreset(updatedPreset);
        setSelectedProductIds(new Set(updatedPreset.selectedProductIds || []));
      }
      showToast(`Saved search "${updatedPreset.title}" diperbarui.`);
    } catch (err) {
      console.error('Error updating SKU search preset:', err);
      showToast('Gagal memperbarui preset.');
    }
  };

  const handleDeleteSavedPreset = async (id: string) => {
    try {
      await deleteSavedSkuSearchPreset(id);
      await refreshSavedSearches();
      if (activeLoadedPreset?.id === id) {
        setActiveLoadedPreset(null);
      }
      showToast('Rekaman pencarian berhasil dihapus.');
    } catch (err) {
      console.error('Error deleting SKU search preset:', err);
    }
  };

  const handleLoadSavedPreset = (preset: SavedGoogleSkuSearchPreset) => {
    setKeywordInput(preset.searchQuery || '');
    setBrandInput(preset.brandFilter || '');
    setCommittedQuery(preset.searchQuery || '');
    setCommittedBrand(preset.brandFilter || '');
    setSelectedCategory(preset.selectedCategory || 'All');
    setHasExecutedSearch(true);
    setSelectedProductIds(new Set(preset.selectedProductIds || []));
    setActiveLoadedPreset(preset);
    showToast(`Memuat rekaman: "${preset.title}" (${preset.selectedProductIds?.length || 0} SKU)`);
  };

  const handleClearActivePreset = () => {
    setActiveLoadedPreset(null);
    showToast('Filter Saved Search dinonaktifkan.');
  };

  // ==================== DASHBOARD DATA PREPARATION ====================
  // Extract all transactions linked to candidate results (or strictly selected SKU lines if user selected any!)
  const dashboardRecords = useMemo(() => {
    if (isLandingHome) return [];

    const targetSkus = selectedProductIds.size > 0
      ? candidateMatchedSkus.filter(s => selectedProductIds.has(s.productId))
      : (selectedCategory === 'All' ? candidateMatchedSkus : candidateMatchedSkus.filter(s => s.purchCategoryLv1 === selectedCategory));

    const recMap = new Map<string, SpendRecord>();

    for (const s of targetSkus) {
      for (const r of s.transactions) {
        recMap.set(r.id, r);
      }
    }

    return Array.from(recMap.values());
  }, [isLandingHome, candidateMatchedSkus, selectedProductIds, selectedCategory]);

  return (
    <div id="sku-catalog-search-google-view" className="space-y-3 max-w-[1400px] mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-lg text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CONDITIONAL RENDERING: Google Landing Page vs Search Results */}
      {isLandingHome ? (
        <GoogleSearchLanding
          keywordInput={keywordInput}
          setKeywordInput={setKeywordInput}
          brandInput={brandInput}
          setBrandInput={setBrandInput}
          onExecuteSearch={handleExecuteSearch}
          onQuickSearch={handleQuickSearch}
          totalSkuMasterCount={skuMasters.length}
          savedSearches={savedSearches}
          onOpenSavedSearchesModal={() => setIsSavedSearchesModalOpen(true)}
          onLoadSavedPreset={handleLoadSavedPreset}
        />
      ) : (
        <div className="space-y-2.5">
          {/* Top Search Controls Bar */}
          <GoogleSearchResultsHeader
            keywordInput={keywordInput}
            setKeywordInput={setKeywordInput}
            brandInput={brandInput}
            setBrandInput={setBrandInput}
            committedQuery={committedQuery}
            committedBrand={committedBrand}
            onExecuteSearch={handleExecuteSearch}
            onResetToHome={handleResetToHome}
            onlyWithTransactions={onlyWithTransactions}
            setOnlyWithTransactions={setOnlyWithTransactions}
            includeUnmapped={includeUnmapped}
            setIncludeUnmapped={setIncludeUnmapped}
            unmappedStats={unmappedStats}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            availableCategories={availableCategories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categoryCounts={categoryCounts}
            savedSearches={savedSearches}
            selectedExcludePresetId={excludePresetId}
            onSelectExcludePresetId={id => {
              setExcludePresetId(id);
              if (id) {
                setHideExcludedItems(true);
              } else {
                setAppendTargetPresetId(null);
              }
            }}
            hideExcluded={hideExcludedItems}
            onToggleHideExcluded={setHideExcludedItems}
            excludedCountInResults={excludedCountInResults}
          />

          {/* Excluded Saved Search Notice Banner (Active when exclusion is selected) */}
          {excludePreset && (
            <SkuExcludedNoticeBanner
              preset={excludePreset}
              excludedCount={excludedCountInResults}
              hideExcluded={hideExcludedItems}
              onToggleHideExcluded={setHideExcludedItems}
              onClearExclude={() => {
                setExcludePresetId(null);
                setAppendTargetPresetId(null);
              }}
              isAppendMode={appendTargetPresetId === excludePreset.id}
            />
          )}

          {/* Action Bar: Selection, Saved Searches & Dashboard Toggle */}
          <SkuSearchActionBar
            activeView={activeResultsView}
            setActiveView={setActiveResultsView}
            totalItemCount={visibleSkus.length}
            selectedCount={selectedProductIds.size}
            isAllSelected={isAllSelected}
            onToggleSelectAll={handleToggleSelectAll}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
            savedSearchesCount={savedSearches.length}
            onOpenSavedSearchesModal={() => setIsSavedSearchesModalOpen(true)}
            activePreset={activeLoadedPreset}
            onClearActivePreset={handleClearActivePreset}
            selectedSpend={selectedTotalSpend}
            selectedTxCount={selectedTotalTx}
            excludePreset={excludePreset}
            onClearExcludePreset={() => {
              setExcludePresetId(null);
              setAppendTargetPresetId(null);
            }}
            isAppendMode={appendTargetPresetId === excludePreset?.id}
          />

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between py-1 px-1 text-xs text-slate-600">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">
                Ditemukan <strong className="text-blue-700">{searchResults.length}</strong> kelompok komoditas ({displayedCandidateSkus.length} SKU/Item)
              </span>
              {excludePreset && excludedCountInResults > 0 && hideExcludedItems && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-purple-800 font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {excludedCountInResults} SKU disembunyikan (karena ada di "{excludePreset.title}")
                  </span>
                </>
              )}
              {allMatchedTransactionItems.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">
                    Total <strong className="text-blue-700">{allMatchedTransactionItems.length}</strong> baris transaksi PO
                  </span>
                </>
              )}
              {matchedUnmappedRecords.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {matchedUnmappedRecords.length} transaksi belum memiliki Master SKU
                  </span>
                </>
              )}
              {selectedProductIds.size > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {selectedProductIds.size} baris SKU aktif terpilih
                  </span>
                </>
              )}
            </div>

            {/* Inactive SKU legend indicator */}
            <span className="text-[11px] text-slate-500 hidden sm:inline-flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-300" />
              Baris Merah = SKU Non-Aktif
            </span>
          </div>

          {/* VIEW SWITCH: Visual Dashboard (Treemap + Top 10 + Table) vs Google Results List */}
          {activeResultsView === 'dashboard' ? (
            <div className="space-y-4 pt-1">
              {dashboardRecords.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Tidak Ada Transaksi Terkait Hasil Pencarian</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    SKU yang Anda cari atau pilih saat ini belum memiliki rekaman transaksi PO pada SpendCube. Silakan pilih SKU lain atau periksa filter tanggal.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Dashboard Header Info */}
                  <div className="p-3.5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                        <span>Visual Dashboard Kueri SKU:</span>
                        <span className="text-amber-300 font-mono">"{committedQuery || 'Semua Item'}"</span>
                      </h3>
                      <p className="text-xs text-blue-100 mt-0.5">
                        {selectedProductIds.size > 0 
                          ? `Menampilkan visualisasi grafik & tabel atas ${selectedProductIds.size} baris SKU yang dipilih (${dashboardRecords.length} transaksi PO)`
                          : `Menampilkan seluruh ${dashboardRecords.length} transaksi PO terkait kueri pencarian`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveResultsView('list')}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/20"
                    >
                      Kembali ke Daftar SKU
                    </button>
                  </div>

                  {/* Reused Full-Powered Dashboard: Treemap, Top 10 charts, cross-filters & Consolidated Spend Table */}
                  <TaxonomyTreeMapAndTopCharts
                    records={dashboardRecords}
                    skuMasters={skuMasters}
                    onSelectRecord={onSelectRecord || (() => {})}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Unified SKU Commodity Cards List */
            <div className="space-y-2.5">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map(group => (
                    <SkuCommodityCard
                      key={group.id || group.commodityName}
                      group={group}
                      onOpenDrillDown={setActiveDrillDownSku}
                      copiedKey={copiedKey}
                      onCopyText={handleCopyText}
                      selectedProductIds={selectedProductIds}
                      onToggleSelectSku={handleToggleSelectSku}
                      onToggleSelectGroup={handleToggleSelectGroup}
                      excludedProductIds={excludedProductIdsSet}
                      excludedPresetTitle={excludePreset?.title}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl p-6 sm:p-8 text-center border border-slate-200 text-xs text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Tidak ditemukan hasil untuk "{committedQuery}"
                    </p>
                    <p className="text-slate-500 mt-1">
                      Silakan periksa kata kunci kueri, merk, atau filter kategori yang aktif.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Drill-Down per Transaction Modal */}
      {activeDrillDownSku && (
        <SkuTransactionDrillDownModal
          sku={activeDrillDownSku}
          onClose={() => setActiveDrillDownSku(null)}
          onSelectRecord={onSelectRecord}
        />
      )}

      {/* Save Search Modal */}
      <SkuSaveSearchModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        selectedItems={selectedSkuItems}
        searchQuery={committedQuery}
        brandFilter={committedBrand}
        selectedCategory={selectedCategory}
        existingPresets={savedSearches}
        initialPresetId={appendTargetPresetId || undefined}
        initialSaveMode={appendTargetPresetId ? 'append' : undefined}
        onSaveSuccess={handleSaveSearchSuccess}
      />

      {/* Saved Searches Catalog Modal */}
      <SkuSavedSearchesModal
        isOpen={isSavedSearchesModalOpen}
        onClose={() => setIsSavedSearchesModalOpen(false)}
        savedSearches={savedSearches}
        onLoadPreset={handleLoadSavedPreset}
        onDeletePreset={handleDeleteSavedPreset}
        onUpdatePreset={handleUpdateSavedPreset}
        onAppendNewSearch={handleAppendNewSearchToPreset}
        getLivePresetStats={getLivePresetStats}
        getLiveItemStats={getLiveItemStats}
      />
    </div>
  );
};
