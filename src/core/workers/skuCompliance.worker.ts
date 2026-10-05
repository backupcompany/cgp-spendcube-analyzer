/**
 * Dedicated Web Worker for SKU PO Compliance Evaluation
 * Runs fully in an isolated background thread to guarantee 60 FPS UI responsiveness.
 */

import { 
  splitItemNameAndNotes, 
  computeJaroWinklerSimilarity,
  SkuMasterRecord
} from '../types/spend';
import { 
  PoLineComplianceRecord, 
  SkuComplianceCategory, 
  COMPLIANCE_CATEGORIES,
  aggregateMonthlyCompliance,
  aggregateComplianceStats,
  aggregateHospitalCompliance,
  aggregateUserCompliance
} from '../../modules/spendcube/services/skuPoComplianceService';
import type { 
  SkuComplianceWorkerIncomingMessage, 
  SkuComplianceWorkerOutgoingMessage,
  MinimalPoLineInput,
  MinimalSkuMasterInput,
  SkuCompliancePreAggregates
} from '../../modules/spendcube/services/skuComplianceTypes';

// High-speed inverted token index stop words
const STOP_WORDS = new Set([
  'dan', 'atau', 'yang', 'untuk', 'dengan', 'pada', 'dari', 'ke', 'ini', 'itu',
  'box', 'strip', 'tablet', 'tab', 'vial', 'ampul', 'kapsul', 'cap', 'btl', 'botol',
  'pcs', 'piece', 'set', 'roll', 'pack', 'unit', 'tube', 'sachet', 'jar', 'can',
  'hospital', 'rs', 'siloam', 'medis', 'alat', 'bahan', 'habis', 'pakai', 'bhp'
]);

function extractSignificantTokens(text: string): string[] {
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  const result: string[] = [];
  for (const w of words) {
    if (w.length >= 3 && !STOP_WORDS.has(w)) {
      result.push(w);
    }
  }
  return result;
}

function processComplianceInWorker(
  jobId: string, 
  records: MinimalPoLineInput[], 
  skuMasters: MinimalSkuMasterInput[]
) {
  const startTime = Date.now();
  const totalCount = records.length;

  try {
    // 1. Build Multi-Index on Master SKU
    self.postMessage({
      type: 'PROGRESS',
      jobId,
      percent: 5,
      message: `Mempersiapkan indeks data master (${skuMasters.length.toLocaleString('id-ID')} SKU)...`,
      processedCount: 0,
      totalCount
    } as SkuComplianceWorkerOutgoingMessage);

    const masterByCode = new Map<string, SkuMasterRecord>();
    const masterByName = new Map<string, SkuMasterRecord>();
    const tokenToMasters = new Map<string, SkuMasterRecord[]>();

    for (let i = 0; i < skuMasters.length; i++) {
      const s = skuMasters[i] as SkuMasterRecord;
      if (!s) continue;
      
      // Index by SKU Codes (Product ID, System ID, CPR, SPR, Part Number)
      if (s.productId) masterByCode.set(s.productId.toLowerCase().trim(), s);
      if (s.id) masterByCode.set(s.id.toLowerCase().trim(), s);
      if (s.prItemId) masterByCode.set(s.prItemId.toLowerCase().trim(), s);
      if (s.cprItemId) masterByCode.set(s.cprItemId.toLowerCase().trim(), s);
      if (s.spItemId) masterByCode.set(s.spItemId.toLowerCase().trim(), s);
      if (s.partNumber) masterByCode.set(s.partNumber.toLowerCase().trim(), s);

      // Index by Exact Normalized Names
      if (s.name) {
        const normN = s.name.toLowerCase().trim();
        masterByName.set(normN, s);
        const tokens = extractSignificantTokens(normN);
        for (const t of tokens) {
          let list = tokenToMasters.get(t);
          if (!list) {
            list = [];
            tokenToMasters.set(t, list);
          }
          if (list.length < 30) {
            list.push(s);
          }
        }
      }

      if (s.formattedSkuName) {
        const normF = s.formattedSkuName.toLowerCase().trim();
        masterByName.set(normF, s);
      }
    }

    self.postMessage({
      type: 'PROGRESS',
      jobId,
      percent: 15,
      message: `Memulai evaluasi kepatuhan ${totalCount.toLocaleString('id-ID')} baris PO...`,
      processedCount: 0,
      totalCount
    } as SkuComplianceWorkerOutgoingMessage);

    const evaluatedRecords: PoLineComplianceRecord[] = new Array(totalCount);
    const PROGRESS_STEP = Math.max(1000, Math.floor(totalCount / 10));

    // 2. Evaluate Each Record with High-Speed Inverted Index
    for (let idx = 0; idx < totalCount; idx++) {
      const record = records[idx];
      const { itemName: cleanItemName } = splitItemNameAndNotes(record.rawItemName || record.itemName || '');
      const poSkuCode = record.poSkuCode;
      const normItemName = (cleanItemName || record.itemName || '').toLowerCase().trim();

      let category: SkuComplianceCategory = 'UNMATCHED_NO_SKU';
      let matchedMaster: SkuMasterRecord | null = null;
      let findingNote = '';
      let diffDescription: string | undefined = undefined;
      let actionRequired = '';

      // RULE 1: Jika kode SKU tersedia
      if (poSkuCode) {
        const normCode = poSkuCode.toLowerCase().trim();
        matchedMaster = masterByCode.get(normCode) || null;

        if (matchedMaster) {
          // RULE 1A: Kode SKU ditemukan di MDM!
          // PO line dianggap MATCH berdasarkan kode SKU, meskipun namanya berbeda.
          const masterName = (matchedMaster.name || matchedMaster.formattedSkuName || '').toLowerCase().trim();
          const isDescIdentical = normItemName === masterName || (normItemName.length > 3 && computeJaroWinklerSimilarity(normItemName, masterName) >= 0.94);

          if (isDescIdentical) {
            category = 'MATCH_EXACT';
            findingNote = 'Kode SKU valid di MDM dan deskripsi PO identik dengan Master Data.';
            actionRequired = 'Data PO compliant dan rapi. Tidak memerlukan tindakan.';
          } else {
            category = 'MATCH_CODE_DIFF_DESC';
            findingNote = `Kode SKU valid di MDM (${matchedMaster.productId || matchedMaster.id}), namun deskripsi pada PO berbeda / diedit.`;
            diffDescription = `PO: "${cleanItemName}" vs MDM: "${matchedMaster.name}"`;
            actionRequired = 'Pertahankan kode SKU yang sama, dan sinkronkan deskripsi PO agar sesuai standar MDM.';
          }
        } else {
          // RULE 1B: Kode SKU dicantumkan tapi TIDAK DITEMUKAN di MDM!
          // "Jangan otomatis mencocokkannya berdasarkan nama. tag ini secara khusus, sehingga user harus mencari kode sku tersebut di mdm"
          category = 'CODE_NOT_IN_MDM';
          matchedMaster = null;
          findingNote = `Kode SKU "${poSkuCode}" dicantumkan pada PO namun tidak ditemukan pada katalog Master MDM.`;
          actionRequired = `Daftarkan kode SKU "${poSkuCode}" ke MDM Katalog atau koreksi penulisan kode pada PO.`;
        }
      } else {
        // RULE 2: Tanpa kode SKU
        const exactNameMatch = masterByName.get(normItemName);
        if (exactNameMatch) {
          category = 'MATCH_NAME_ONLY';
          matchedMaster = exactNameMatch;
          findingNote = `Nama barang cocok dengan Master SKU (${exactNameMatch.productId || exactNameMatch.id}), namun PO tidak mencantumkan kode SKU.`;
          actionRequired = `Lengkapi PO dengan kode SKU resmi MDM: "${exactNameMatch.productId || exactNameMatch.id}".`;
        } else {
          // Inverted Index Candidate Lookup
          const tokens = extractSignificantTokens(normItemName);
          const candidateSet = new Set<SkuMasterRecord>();

          for (const t of tokens) {
            const list = tokenToMasters.get(t);
            if (list) {
              for (const c of list) {
                candidateSet.add(c);
                if (candidateSet.size >= 35) break;
              }
            }
            if (candidateSet.size >= 35) break;
          }

          let bestCandidate: SkuMasterRecord | null = null;
          let bestScore = 0;

          for (const cand of candidateSet) {
            const candName = (cand.name || '').toLowerCase().trim();
            if (candName.length > 5 && (normItemName.includes(candName) || candName.includes(normItemName))) {
              bestCandidate = cand;
              bestScore = 0.90;
              break;
            }
            const sim = computeJaroWinklerSimilarity(normItemName, candName);
            if (sim > bestScore && sim >= 0.82) {
              bestScore = sim;
              bestCandidate = cand;
            }
          }

          if (bestCandidate && bestScore >= 0.82) {
            category = 'PARTIAL_MATCH';
            matchedMaster = bestCandidate;
            findingNote = `Kemiripan kata kunci (${Math.round(bestScore * 100)}%) dengan Master SKU "${bestCandidate.name}" (${bestCandidate.productId || bestCandidate.id}).`;
            actionRequired = `Verifikasi apakah barang ini adalah "${bestCandidate.name}". Jika ya, lampirkan kode SKU "${bestCandidate.productId || bestCandidate.id}".`;
          } else {
            category = 'UNMATCHED_NO_SKU';
            matchedMaster = null;
            findingNote = 'Transaksi PO tidak memiliki kode SKU dan namanya tidak terdaftar di katalog Master MDM.';
            actionRequired = 'Daftarkan item baru ke MDM untuk mendapatkan kode SKU resmi atau petakan ke SKU sejenis.';
          }
        }
      }

      const isMatched = COMPLIANCE_CATEGORIES[category].isCompliant;
      const isUnmatched = !isMatched;

      let monthYear = record.monthYear || '';
      if (!monthYear && record.createdDate) {
        const match = record.createdDate.match(/^(\d{4})-(\d{2})/);
        if (match) {
          monthYear = `${match[1]}-${match[2]}`;
        }
      }
      if (!monthYear) {
        monthYear = '2026-04';
      }

      evaluatedRecords[idx] = {
        id: record.id || `comp_po_${idx}`,
        purchId: record.purchId || `PO-${idx + 1}`,
        lineNumber: record.lineNumber || (idx % 10) + 1,
        createdDate: record.createdDate || monthYear,
        monthYear,
        hospitalCode: (record.hospitalCode || 'SHLV').toUpperCase(),
        requester: record.requester || 'User PO',
        requesterName: record.requesterName || record.requester || 'Petugas Pengadaan',
        department: record.department || 'General',
        vendorName: record.vendorName || 'Rekanan',
        poSkuCode,
        poItemName: cleanItemName || record.itemName || 'Item Barang',
        poRawItemName: record.rawItemName || record.itemName || '',
        purchQty: Number(record.purchQty) || 1,
        purchPrice: Number(record.purchPrice) || 0,
        totalLineAmount: Number(record.totalLineAmount) || 0,
        matchedMaster,
        category,
        isMatched,
        isUnmatched,
        findingNote,
        diffDescription,
        actionRequired,
        sourceFileName: record.sourceFileName,
        sourceFile: record.sourceFile,
        itemId: record.itemId,
        itemNotes: record.itemNotes,
        extractedSkuCode: record.extractedSkuCode || poSkuCode,
        purchUnit: record.purchUnit,
        lineDisc: record.lineDisc,
        linePercent: record.linePercent,
        purchReqName: record.purchReqName,
        costCenter: record.costCenter,
        purchStatusNamePo: record.purchStatusNamePo,
        documentState: record.documentState,
        procurementCategory: record.procurementCategory
      };

      if (idx > 0 && idx % PROGRESS_STEP === 0) {
        const pct = 15 + Math.round((idx / totalCount) * 75);
        self.postMessage({
          type: 'PROGRESS',
          jobId,
          percent: pct,
          message: `Mengevaluasi baris ${idx.toLocaleString('id-ID')} dari ${totalCount.toLocaleString('id-ID')}...`,
          processedCount: idx,
          totalCount
        } as SkuComplianceWorkerOutgoingMessage);
      }
    }

    // 3. Pre-aggregate inside the worker so main UI thread does zero heavy lifting
    self.postMessage({
      type: 'PROGRESS',
      jobId,
      percent: 92,
      message: 'Menyusun ringkasan statistik dan tren bulanan...',
      processedCount: totalCount,
      totalCount
    } as SkuComplianceWorkerOutgoingMessage);

    const monthlyTrends = aggregateMonthlyCompliance(evaluatedRecords);
    const summaryStats = aggregateComplianceStats(evaluatedRecords);
    const topHospitals = aggregateHospitalCompliance(evaluatedRecords);
    const topUsers = aggregateUserCompliance(evaluatedRecords);

    // Filter Options
    const monthOptions = monthlyTrends.map(m => ({
      value: m.monthYear,
      label: m.formattedMonth,
      count: m.totalPoLines
    }));

    const hospMap = new Map<string, number>();
    for (const r of evaluatedRecords) {
      const h = r.hospitalCode;
      hospMap.set(h, (hospMap.get(h) || 0) + 1);
    }
    const hospitalOptions = Array.from(hospMap.entries())
      .map(([code, count]) => ({ value: code, label: code, count }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const userMap = new Map<string, number>();
    for (const r of evaluatedRecords) {
      const u = r.requesterName || r.requester || 'User PO';
      userMap.set(u, (userMap.get(u) || 0) + 1);
    }
    const userOptions = Array.from(userMap.entries())
      .map(([user, count]) => ({ value: user, label: user, count }))
      .sort((a, b) => b.count - a.count);

    const aggregates: SkuCompliancePreAggregates = {
      monthlyTrends,
      summaryStats,
      topHospitals,
      topUsers,
      monthOptions,
      hospitalOptions,
      userOptions
    };

    const durationMs = Date.now() - startTime;

    self.postMessage({
      type: 'SUCCESS',
      jobId,
      evaluatedRecords,
      aggregates,
      durationMs
    } as SkuComplianceWorkerOutgoingMessage);

  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      jobId,
      error: err?.message || String(err)
    } as SkuComplianceWorkerOutgoingMessage);
  }
}

// Safely attach listener in Dedicated Worker context only
const isWorkerContext = typeof self !== 'undefined' && 
  (typeof (self as any).importScripts === 'function' || typeof (self as any).WorkerGlobalScope !== 'undefined' || !(self as any).window);

if (isWorkerContext) {
  self.onmessage = function (event: MessageEvent<SkuComplianceWorkerIncomingMessage>) {
    const msg = event.data;
    if (!msg || msg.type !== 'START_EVALUATION') return;
    processComplianceInWorker(msg.jobId, msg.records, msg.skuMasters);
  };
}
