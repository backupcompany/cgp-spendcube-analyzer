import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Layers,
  ShieldCheck,
  HardDrive,
  Download,
  FileSpreadsheet,
  Cpu
} from 'lucide-react';
import {
  SpendRecord,
  SkuMasterRecord,
  SkuMappingCacheRecord,
  splitItemNameAndNotes,
  decomposeSkuString,
  normalizeSpecString
} from '../../../core/types/spend';
import { spendService } from '../services/spendService';
import { backgroundJobManager } from '../../../core/services/backgroundJobManager';
import { 
  TaxonomyMappingReviewViewProps, 
  UniqueItemMappingSummary 
} from './taxonomyReview/types';
import { AuditTableModule } from './taxonomyReview/AuditTableModule';
import { AuditDetailModal } from './taxonomyReview/AuditDetailModal';

export const TaxonomyMappingReviewView: React.FC<TaxonomyMappingReviewViewProps> = ({
  records = [],
  skuMasters = [],
  onSelectRecord,
  onOpenAiAdvisor
}) => {
  // Disk cache state
  const [diskCacheMap, setDiskCacheMap] = useState<Map<string, SkuMappingCacheRecord>>(new Map());
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UniqueItemMappingSummary | null>(null);

  // Background Web Worker progress state
  const [isSkuMappingInProgress, setIsSkuMappingInProgress] = useState(false);
  const [skuMappingProgressPercent, setSkuMappingProgressPercent] = useState(0);
  const [skuMappingMessage, setSkuMappingMessage] = useState('');
  const [skuMappingProcessed, setSkuMappingProcessed] = useState(0);
  const [skuMappingTotal, setSkuMappingTotal] = useState(0);

  // Subscribe to Background Web Worker progress
  useEffect(() => {
    const unsub = backgroundJobManager.subscribe((st) => {
      setIsSkuMappingInProgress(st.isSkuMappingInProgress);
      setSkuMappingProgressPercent(st.skuMappingProgressPercent);
      setSkuMappingMessage(st.skuMappingMessage);
      setSkuMappingProcessed(st.skuMappingProcessed);
      setSkuMappingTotal(st.skuMappingTotal);

      if (!st.isSkuMappingInProgress && st.skuMappingProgressPercent === 100) {
        refreshDiskCache();
      }
    });
    return unsub;
  }, []);

  // Load Disk Cache from IndexedDB
  const refreshDiskCache = useCallback(async () => {
    try {
      const cachedMap = await spendService.loadSkuMappingCache();
      setDiskCacheMap(new Map(cachedMap));
    } catch (err) {
      console.warn('Failed loading SKU mapping cache from disk:', err);
    }
  }, []);

  useEffect(() => {
    refreshDiskCache();
  }, [refreshDiskCache]);

  // Fast Hash Maps for O(1) Lookups instead of O(N * M) nested loops
  const skuMasterByIdMap = useMemo(() => {
    const map = new Map<string, SkuMasterRecord>();
    for (const s of skuMasters) {
      const pId = (s.productId || s.id || '').toLowerCase().trim();
      if (pId) map.set(pId, s);
      if (s.formattedSkuName) {
        map.set(s.formattedSkuName.toLowerCase().trim(), s);
      }
    }
    return map;
  }, [skuMasters]);

  const skuMasterByCommodityMap = useMemo(() => {
    const map = new Map<string, SkuMasterRecord>();
    for (const s of skuMasters) {
      if (s.commodityItem) {
        map.set(s.commodityItem.toLowerCase().trim(), s);
      }
      if (s.name) {
        map.set(s.name.toLowerCase().trim(), s);
      }
    }
    return map;
  }, [skuMasters]);

  // Memoized unique items list for the 4-pillar mapping audit table
  const uniqueItemsList: UniqueItemMappingSummary[] = useMemo(() => {
    if (!records || records.length === 0) return [];

    const groupedMap = new Map<string, UniqueItemMappingSummary>();

    for (const r of records) {
      if (!r) continue;
      const rawTarget = r.rawItemName || r.itemName || '';
      const itemKey = rawTarget.trim().toLowerCase();
      if (!itemKey) continue;

      if (!groupedMap.has(itemKey)) {
        const { itemName: cleanItemName, itemNotes, extractedSkuCode } = splitItemNameAndNotes(rawTarget);
        const poSkuCode = (r.extractedSkuCode || extractedSkuCode || '').trim();
        const primaryItemName = (cleanItemName || r.itemName || '').trim();

        const txDecomp = decomposeSkuString(primaryItemName);
        const poCommodity = r.commodityItem || txDecomp.commodityItem || primaryItemName;
        const poSpec = r.generalSpec || normalizeSpecString(txDecomp.generalSpec || txDecomp.rawSpec);
        const poBrand = r.brand || (txDecomp.brand || '').trim();
        const poPartNumber = r.partNumber || (txDecomp.partNumber || '').trim();

        const cached = diskCacheMap.get(itemKey);
        let matchedId = r.skuMasterId || cached?.matchedSkuId;
        let matchedSku = matchedId ? (skuMasterByIdMap.get(matchedId) || skuMasterByIdMap.get(matchedId.toLowerCase().trim())) : undefined;

        if (!matchedSku && cached?.matchedSku) {
          matchedSku = cached.matchedSku;
        }

        const effectiveReason = r.orphanMatchReason || cached?.matchReason || '';

        const effectiveOrphanStatus = (r.orphanStatus as any) || cached?.orphanStatus || 'FULL_ORPHAN';
        const isOrphan = effectiveOrphanStatus === 'PARTIAL_ORPHAN' || effectiveOrphanStatus === 'FULL_ORPHAN';

        // Extract candidate SKU if orphan
        let candidateSku: SkuMasterRecord | undefined = undefined;
        let candidateId: string | undefined = undefined;

        if (isOrphan) {
          // For orphans, matchedSku MUST be undefined so it doesn't display as matched
          const candCode = r.candidateSkuId || cached?.candidateSkuId;
          if (candCode) {
            candidateSku = skuMasterByIdMap.get(candCode) || skuMasterByIdMap.get(candCode.toLowerCase().trim());
            candidateId = candCode;
          }
          if (!candidateSku && effectiveReason) {
            const candidateMatch = effectiveReason.match(/(?:Kandidat:\s*\[?|\[)([a-zA-Z0-9_\-\.]+)/i);
            if (candidateMatch && candidateMatch[1]) {
              const code = candidateMatch[1].trim();
              candidateSku = skuMasterByIdMap.get(code) || skuMasterByIdMap.get(code.toLowerCase().trim());
              candidateId = code;
            }
          }
        }

        // Resolve Final Categories (Level 1 s/d Level 5): Orphans stay UNMAPPED
        let finalTax1 = 'UNMAPPED / ORPHAN PO';
        let finalTax2 = effectiveOrphanStatus === 'PARTIAL_ORPHAN' ? 'Partial Orphan' : 'Full Orphan';
        let finalTax3 = finalTax2;
        let finalTax4 = finalTax2;
        let finalTax5 = poCommodity || primaryItemName;

        if (!isOrphan && matchedSku) {
          finalTax1 = (matchedSku.purchCategoryLv1 || 'General Supplies').trim();
          finalTax2 = (matchedSku.purchCategoryLv2 || finalTax1).trim();
          finalTax3 = (matchedSku.purchCategoryLv3 || finalTax2).trim();
          finalTax4 = (matchedSku.purchCategoryLv4 || finalTax3).trim();
          finalTax5 = (matchedSku.commodityItem || matchedSku.name || poCommodity || primaryItemName).trim();
        }

        groupedMap.set(itemKey, {
          itemKey,
          rawItemName: rawTarget,
          primaryItemName,
          itemNotes: r.itemNotes || itemNotes,
          extractedSkuCode: poSkuCode || undefined,
          poCommodity,
          poSpec,
          poBrand,
          poPartNumber,
          transactionCount: 1,
          orphanStatus: effectiveOrphanStatus,
          confidenceScore: r.orphanConfidenceScore !== undefined ? r.orphanConfidenceScore : (cached?.confidenceScore || 0),
          matchReason: effectiveReason || 'Sedang dievaluasi',
          matchedSkuId: !isOrphan ? matchedId : undefined,
          matchedSku: !isOrphan ? matchedSku : undefined,
          targetSku: !isOrphan ? matchedSku : candidateSku,
          taxonomyLv1: finalTax1,
          taxonomyLv2: finalTax2,
          taxonomyLv3: finalTax3,
          taxonomyLv4: finalTax4,
          taxonomyLv5: finalTax5,
          isPersistedInDisk: diskCacheMap.has(itemKey),
          persistedCacheItem: cached
        });
      } else {
        const item = groupedMap.get(itemKey)!;
        item.transactionCount += 1;
      }
    }

    return Array.from(groupedMap.values());
  }, [records, diskCacheMap, skuMasterByIdMap, skuMasterByCommodityMap]);

  const handleTriggerReprocess = async () => {
    setIsSyncing(true);
    try {
      const unmapped = uniqueItemsList
        .filter(item => item.orphanStatus !== 'EXACT_MATCH' || !item.isPersistedInDisk)
        .map(item => ({ rawItemName: item.rawItemName, itemKey: item.itemKey }));

      if (unmapped.length > 0) {
        backgroundJobManager.runSkuMappingJob(unmapped, skuMasters);
      } else {
        await spendService.loadSkuMappingCache();
        await refreshDiskCache();
      }
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const handleExportReviewData = () => {
    const exportRows = uniqueItemsList.map(item => ({
      'Item Key': item.itemKey,
      'Item Name (Clean PO)': item.primaryItemName,
      'Extracted Notes': item.itemNotes || '',
      'Extracted SKU Code': item.extractedSkuCode || '',
      'PO Commodity': item.poCommodity,
      'PO Spec': item.poSpec,
      'PO Brand': item.poBrand,
      'PO Part Number': item.poPartNumber,
      'Transaction Frequency': item.transactionCount,
      'Mapping Status': item.orphanStatus,
      'Confidence Score (%)': item.confidenceScore,
      'Match Reason': item.matchReason,
      'Matched SKU Product ID': item.matchedSku?.productId || item.matchedSkuId || '',
      'Matched SKU Canonical Name': item.matchedSku?.formattedSkuName || item.matchedSku?.name || '',
      'Taxonomy Lv 1': item.taxonomyLv1,
      'Taxonomy Lv 2': item.taxonomyLv2,
      'Taxonomy Lv 3': item.taxonomyLv3,
      'Taxonomy Lv 4': item.taxonomyLv4,
      'Taxonomy Lv 5 (Commodity)': item.taxonomyLv5,
      'Persisted In Harddisk (IndexedDB)': item.isPersistedInDisk ? 'YES' : 'NO'
    }));

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportRows, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `Taxonomy_SKU_Mapping_Review_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="taxonomy-mapping-review-view" className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Review Pemetaan SKU & Taksonomi Master
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Data Finansial & PO Tersembunyi (Privacy-First)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <HardDrive className="w-3.5 h-3.5" />
              IndexedDB Persistent Storage
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
            Audit khusus untuk mengevaluasi akurasi pencocokan nama item dari PO dengan Master SKU dan hierarki taksonomi pengadaan (Level 1–5). Tidak ada data nomor PO maupun nilai finansial transaksi yang dimunculkan pada tabel audit ini.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-trigger-reprocess"
            onClick={handleTriggerReprocess}
            disabled={isSkuMappingInProgress || isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Sinkronisasi dan jalankan ulang worker pencocokan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSkuMappingInProgress || isSyncing ? 'animate-spin text-blue-500' : ''}`} />
            {isSkuMappingInProgress ? 'Worker Sedang Memproses...' : 'Sinkronisasi Cache'}
          </button>

          <button
            id="btn-export-review"
            onClick={handleExportReviewData}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
            title="Ekspor seluruh hasil review taksonomi dalam format JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor Review
          </button>
        </div>
      </div>

      {/* Progress banner when background worker is actively mapping */}
      {isSkuMappingInProgress && (
        <div className="p-4 rounded-xl bg-cyan-900 text-cyan-100 border border-cyan-700 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-300 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Background Web Worker: Sedang Memetakan Taksonomi SKU</p>
              <p className="text-[11px] text-cyan-200">
                {skuMappingMessage || `Memproses ${skuMappingProcessed || 0} dari ${skuMappingTotal || 0} item dengan 4 pilar bobot...`}
              </p>
            </div>
          </div>
          <div className="w-48 bg-cyan-950/80 rounded-full h-2.5 overflow-hidden border border-cyan-800 shrink-0">
            <div 
              className="bg-cyan-400 h-full transition-all duration-300"
              style={{ width: `${skuMappingProgressPercent || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Daftar Review Pemetaan (Tabel Audit 4 Pilar) */}
      <AuditTableModule
        uniqueItemsList={uniqueItemsList}
        onSelectItem={setSelectedItem}
      />

      {/* Side-by-Side Review Detail Modal */}
      {selectedItem && (
        <AuditDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          skuMasterByIdMap={skuMasterByIdMap}
          skuMasterByCommodityMap={skuMasterByCommodityMap}
        />
      )}
    </div>
  );
};
