import { 
  SpendRecord, 
  SkuMasterRecord, 
  splitItemNameAndNotes, 
  computeJaroWinklerSimilarity,
  isPrSummaryRecord 
} from '../../../core/types/spend';

/**
 * Compliance finding categories for each PO Line against MDM Master SKU
 */
export type SkuComplianceCategory = 
  | 'MATCH_EXACT'               // Kode SKU Cocok & Deskripsi Sesuai
  | 'MATCH_CODE_DIFF_DESC'      // Kode SKU Cocok, Tapi Deskripsi PO Berbeda / Diedit
  | 'CODE_NOT_IN_MDM'           // Kode SKU Ada, Tapi Tidak Ditemukan di MDM (Belum Match)
  | 'MATCH_NAME_ONLY'           // Tanpa Kode SKU, Cocok Berdasarkan Nama Master
  | 'PARTIAL_MATCH'             // Tanpa Kode SKU, Kemiripan Nama Parsial (Perlu Konfirmasi)
  | 'UNMATCHED_NO_SKU';         // Tanpa Kode SKU & Tidak Terdaftar di MDM (Belum Match)

export interface CategoryMetadata {
  id: SkuComplianceCategory;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  isCompliant: boolean; // Counted as Match in compliance rate
  description: string;
}

export const COMPLIANCE_CATEGORIES: Record<SkuComplianceCategory, CategoryMetadata> = {
  MATCH_EXACT: {
    id: 'MATCH_EXACT',
    label: '1A. Match Sempurna (Kode & Deskripsi Sesuai)',
    shortLabel: '1A. Match Sempurna',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    isCompliant: true,
    description: 'Kode SKU terdaftar di Master MDM dan deskripsi PO identik dengan Master.'
  },
  MATCH_CODE_DIFF_DESC: {
    id: 'MATCH_CODE_DIFF_DESC',
    label: '1B. Match Kode SKU (Deskripsi PO Diedit)',
    shortLabel: '1B. Deskripsi Diedit',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    isCompliant: true, // Dihitung match sesuai instruksi
    description: 'Kode SKU valid di MDM, namun deskripsi teks pada PO line berbeda atau telah diedit dari Master.'
  },
  MATCH_NAME_ONLY: {
    id: 'MATCH_NAME_ONLY',
    label: '1C. Match Nama Saja (Tanpa Kode SKU)',
    shortLabel: '1C. Match Nama Saja',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
    dotColor: 'bg-sky-500',
    isCompliant: true,
    description: 'PO tidak memiliki kode SKU, namun nama barang cocok persis dengan Master SKU.'
  },
  CODE_NOT_IN_MDM: {
    id: 'CODE_NOT_IN_MDM',
    label: '2A. Kode SKU Belum di MDM (Anomali File Upload)',
    shortLabel: '2A. Kode Belum di MDM',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    dotColor: 'bg-rose-500',
    isCompliant: false,
    description: 'PO mencantumkan kode SKU tertentu, namun kode tersebut tidak terdaftar di katalog Master MDM.'
  },
  PARTIAL_MATCH: {
    id: 'PARTIAL_MATCH',
    label: '3. Partial Orphan (Kemiripan Parsial Perlu Konfirmasi)',
    shortLabel: '3. Partial Orphan',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    dotColor: 'bg-purple-500',
    isCompliant: false,
    description: 'Tidak ada kode SKU, nama barang memiliki kemiripan kata kunci namun belum definitif.'
  },
  UNMATCHED_NO_SKU: {
    id: 'UNMATCHED_NO_SKU',
    label: '4A. Belum Terdaftar (Full Orphan 0% / Free-Text)',
    shortLabel: '4A. Belum Terdaftar',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    dotColor: 'bg-slate-500',
    isCompliant: false,
    description: 'PO tidak mencantumkan kode SKU dan deskripsinya tidak ditemukan pada katalog Master MDM.'
  }
};

export interface PoLineComplianceRecord {
  id: string;
  purchId: string;
  lineNumber: number | string;
  createdDate: string;
  monthYear: string;
  hospitalCode: string;
  requester: string;
  requesterName: string;
  department: string;
  vendorName: string;
  poSkuCode?: string;
  poItemName: string;
  poRawItemName: string;
  purchQty: number;
  purchPrice: number;
  totalLineAmount: number;
  matchedMaster: SkuMasterRecord | null;
  category: SkuComplianceCategory;
  isMatched: boolean;
  isUnmatched: boolean;
  findingNote: string;
  diffDescription?: string;
  actionRequired: string;
  // Tracing & provenance fields for audit
  sourceFileName?: string;
  sourceFile?: string;
  itemId?: string;
  itemNotes?: string;
  extractedSkuCode?: string;
  purchUnit?: string;
  lineDisc?: number;
  linePercent?: number;
  purchReqName?: string;
  costCenter?: string;
  purchStatusNamePo?: string;
  documentState?: string;
  procurementCategory?: string;
}

export interface MonthlyComplianceTrend {
  monthYear: string;
  formattedMonth: string;
  totalPoLines: number;
  matchedCount: number;
  unmatchedCount: number;
  unmatchedPercent: number;
  matchedPercent: number;
  exactMatchCount: number;
  codeDiffDescCount: number;
  codeNotInMdmCount: number;
  nameOnlyMatchCount: number;
  partialMatchCount: number;
  unmatchedNoSkuCount: number;
}

export interface ComplianceSummaryStats {
  totalPoLines: number;
  totalSpend: number;
  matchedCount: number;
  matchedRate: number;
  unmatchedCount: number;
  unmatchedRate: number;
  codeDiffDescCount: number;
  codeDiffDescRate: number;
  codeNotInMdmCount: number;
  codeNotInMdmRate: number;
  exactMatchCount: number;
  nameOnlyMatchCount: number;
  partialMatchCount: number;
  unmatchedNoSkuCount: number;
  totalHospitals: number;
  totalUsers: number;
  totalMonths: number;
}

export interface EntityComplianceSummary {
  key: string;
  name: string;
  totalPoLines: number;
  totalSpend: number;
  matchedCount: number;
  unmatchedCount: number;
  unmatchedPercent: number;
  codeDiffDescCount: number;
  codeNotInMdmCount: number;
  priorityScore: number; // Higher means urgent follow-up required
}

/**
 * Extracts candidate SKU code from SpendRecord
 * PERATURAN MUTLAK SILOAM ERP:
 * Kolom "item ID" pada record PO TIDAK PERNAH boleh diambil sebagai kode SKU,
 * karena kolom item ID digunakan untuk COA (Chart of Accounts) akunting dan tidak ada hubungannya dengan kode SKU.
 * Kode SKU HANYA diambil dari pemisah "::" saja.
 */
export function extractPoSkuCode(record: SpendRecord): string | undefined {
  if (record.extractedSkuCode && record.extractedSkuCode.trim()) {
    return record.extractedSkuCode.trim();
  }
  const { extractedSkuCode } = splitItemNameAndNotes(record.rawItemName || record.itemName || '');
  if (extractedSkuCode && extractedSkuCode.trim()) {
    return extractedSkuCode.trim();
  }
  return undefined;
}

/**
 * Evaluates all PO lines against Master Data SKU catalogue with Siloam MDM compliance rules
 */
export function evaluatePoCompliance(
  records: SpendRecord[], 
  skuMasters: SkuMasterRecord[]
): PoLineComplianceRecord[] {
  if (!records || records.length === 0) return [];

  // 1. Build Multi-Index on Master SKU
  const masterByCode = new Map<string, SkuMasterRecord>();
  const masterByName = new Map<string, SkuMasterRecord>();
  const tokenToMasters = new Map<string, SkuMasterRecord[]>();

  for (let i = 0; i < skuMasters.length; i++) {
    const s = skuMasters[i];
    if (!s) continue;
    if (s.productId) masterByCode.set(s.productId.toLowerCase().trim(), s);
    if (s.id) masterByCode.set(s.id.toLowerCase().trim(), s);
    if (s.prItemId) masterByCode.set(s.prItemId.toLowerCase().trim(), s);
    if (s.cprItemId) masterByCode.set(s.cprItemId.toLowerCase().trim(), s);
    if (s.spItemId) masterByCode.set(s.spItemId.toLowerCase().trim(), s);
    if (s.partNumber) masterByCode.set(s.partNumber.toLowerCase().trim(), s);

    if (s.name) {
      const normN = s.name.toLowerCase().trim();
      masterByName.set(normN, s);
      const words = normN.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
      for (const w of words) {
        if (w.length >= 3) {
          let list = tokenToMasters.get(w);
          if (!list) {
            list = [];
            tokenToMasters.set(w, list);
          }
          if (list.length < 30) list.push(s);
        }
      }
    }
    if (s.formattedSkuName) masterByName.set(s.formattedSkuName.toLowerCase().trim(), s);
  }

  // 2. Evaluate Each Record (PO Lines only, exclude PR summary reference records)
  const poOnlyRecords = records.filter(r => !isPrSummaryRecord(r));

  return poOnlyRecords.map((record, idx) => {
    const { itemName: cleanItemName } = splitItemNameAndNotes(record.rawItemName || record.itemName || '');
    const poSkuCode = extractPoSkuCode(record);
    const normItemName = cleanItemName.toLowerCase().trim();

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
        const isDescIdentical = normItemName === masterName || computeJaroWinklerSimilarity(normItemName, masterName) >= 0.94;

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
        // Cek kemiripan kata kunci untuk partial match via inverted index
        const words = normItemName.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
        const candidateSet = new Set<SkuMasterRecord>();
        for (const w of words) {
          if (w.length >= 3) {
            const list = tokenToMasters.get(w);
            if (list) {
              for (const c of list) {
                candidateSet.add(c);
                if (candidateSet.size >= 40) break;
              }
            }
          }
          if (candidateSet.size >= 40) break;
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

    // Normalizing Month-Year (YYYY-MM)
    let monthYear = record.monthYear || '';
    if (!monthYear && record.createdDate) {
      const match = record.createdDate.match(/^(\d{4})-(\d{2})/);
      if (match) {
        monthYear = `${match[1]}-${match[2]}`;
      }
    }
    if (!monthYear) {
      monthYear = '2026-04'; // Default fallback
    }

    return {
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
      // Tracing & provenance fields
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
  });
}

/**
 * Aggregates monthly compliance metrics with trend towards 0% non-compliance
 */
export function aggregateMonthlyCompliance(
  evaluatedRecords: PoLineComplianceRecord[]
): MonthlyComplianceTrend[] {
  const monthMap = new Map<string, {
    total: number;
    matched: number;
    unmatched: number;
    exact: number;
    codeDiffDesc: number;
    codeNotInMdm: number;
    nameOnly: number;
    partial: number;
    unmatchedNoSku: number;
  }>();

  for (const r of evaluatedRecords) {
    const m = r.monthYear || '2026-04';
    let data = monthMap.get(m);
    if (!data) {
      data = {
        total: 0,
        matched: 0,
        unmatched: 0,
        exact: 0,
        codeDiffDesc: 0,
        codeNotInMdm: 0,
        nameOnly: 0,
        partial: 0,
        unmatchedNoSku: 0
      };
      monthMap.set(m, data);
    }

    data.total += 1;
    if (r.isMatched) data.matched += 1;
    if (r.isUnmatched) data.unmatched += 1;

    if (r.category === 'MATCH_EXACT') data.exact += 1;
    else if (r.category === 'MATCH_CODE_DIFF_DESC') data.codeDiffDesc += 1;
    else if (r.category === 'CODE_NOT_IN_MDM') data.codeNotInMdm += 1;
    else if (r.category === 'MATCH_NAME_ONLY') data.nameOnly += 1;
    else if (r.category === 'PARTIAL_MATCH') data.partial += 1;
    else if (r.category === 'UNMATCHED_NO_SKU') data.unmatchedNoSku += 1;
  }

  // Sort months chronologically
  const sortedMonths = Array.from(monthMap.keys()).sort();

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  return sortedMonths.map(m => {
    const data = monthMap.get(m)!;
    const parts = m.split('-');
    const year = parts[0] || '2026';
    const monthIdx = parseInt(parts[1] || '1', 10) - 1;
    const formattedMonth = `${monthNames[monthIdx] || parts[1]} ${year}`;

    const unmatchedPercent = data.total > 0 ? Number(((data.unmatched / data.total) * 100).toFixed(1)) : 0;
    const matchedPercent = data.total > 0 ? Number(((data.matched / data.total) * 100).toFixed(1)) : 0;

    return {
      monthYear: m,
      formattedMonth,
      totalPoLines: data.total,
      matchedCount: data.matched,
      unmatchedCount: data.unmatched,
      unmatchedPercent,
      matchedPercent,
      exactMatchCount: data.exact,
      codeDiffDescCount: data.codeDiffDesc,
      codeNotInMdmCount: data.codeNotInMdm,
      nameOnlyMatchCount: data.nameOnly,
      partialMatchCount: data.partial,
      unmatchedNoSkuCount: data.unmatchedNoSku
    };
  });
}

/**
 * Calculates overall summary statistics
 */
export function aggregateComplianceStats(
  evaluatedRecords: PoLineComplianceRecord[]
): ComplianceSummaryStats {
  const totalPoLines = evaluatedRecords.length;
  let totalSpend = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;
  let exactMatchCount = 0;
  let codeDiffDescCount = 0;
  let codeNotInMdmCount = 0;
  let nameOnlyMatchCount = 0;
  let partialMatchCount = 0;
  let unmatchedNoSkuCount = 0;

  const hospitals = new Set<string>();
  const users = new Set<string>();
  const months = new Set<string>();

  for (const r of evaluatedRecords) {
    totalSpend += r.totalLineAmount || 0;
    hospitals.add(r.hospitalCode);
    users.add(r.requesterName || r.requester);
    months.add(r.monthYear);

    if (r.isMatched) matchedCount += 1;
    if (r.isUnmatched) unmatchedCount += 1;

    switch (r.category) {
      case 'MATCH_EXACT': exactMatchCount += 1; break;
      case 'MATCH_CODE_DIFF_DESC': codeDiffDescCount += 1; break;
      case 'CODE_NOT_IN_MDM': codeNotInMdmCount += 1; break;
      case 'MATCH_NAME_ONLY': nameOnlyMatchCount += 1; break;
      case 'PARTIAL_MATCH': partialMatchCount += 1; break;
      case 'UNMATCHED_NO_SKU': unmatchedNoSkuCount += 1; break;
    }
  }

  const matchedRate = totalPoLines > 0 ? Number(((matchedCount / totalPoLines) * 100).toFixed(1)) : 0;
  const unmatchedRate = totalPoLines > 0 ? Number(((unmatchedCount / totalPoLines) * 100).toFixed(1)) : 0;
  const codeDiffDescRate = totalPoLines > 0 ? Number(((codeDiffDescCount / totalPoLines) * 100).toFixed(1)) : 0;
  const codeNotInMdmRate = totalPoLines > 0 ? Number(((codeNotInMdmCount / totalPoLines) * 100).toFixed(1)) : 0;

  return {
    totalPoLines,
    totalSpend,
    matchedCount,
    matchedRate,
    unmatchedCount,
    unmatchedRate,
    codeDiffDescCount,
    codeDiffDescRate,
    codeNotInMdmCount,
    codeNotInMdmRate,
    exactMatchCount,
    nameOnlyMatchCount,
    partialMatchCount,
    unmatchedNoSkuCount,
    totalHospitals: hospitals.size,
    totalUsers: users.size,
    totalMonths: months.size
  };
}

/**
 * Aggregates Hospital Unit compliance rank (identifies units requiring follow-up)
 */
export function aggregateHospitalCompliance(
  evaluatedRecords: PoLineComplianceRecord[]
): EntityComplianceSummary[] {
  const map = new Map<string, {
    total: number;
    spend: number;
    matched: number;
    unmatched: number;
    codeDiffDesc: number;
    codeNotInMdm: number;
  }>();

  for (const r of evaluatedRecords) {
    const h = r.hospitalCode || 'UNKNOWN';
    let data = map.get(h);
    if (!data) {
      data = { total: 0, spend: 0, matched: 0, unmatched: 0, codeDiffDesc: 0, codeNotInMdm: 0 };
      map.set(h, data);
    }
    data.total += 1;
    data.spend += r.totalLineAmount || 0;
    if (r.isMatched) data.matched += 1;
    if (r.isUnmatched) data.unmatched += 1;
    if (r.category === 'MATCH_CODE_DIFF_DESC') data.codeDiffDesc += 1;
    if (r.category === 'CODE_NOT_IN_MDM') data.codeNotInMdm += 1;
  }

  const list: EntityComplianceSummary[] = [];
  for (const [key, val] of map.entries()) {
    const unmatchedPercent = val.total > 0 ? Number(((val.unmatched / val.total) * 100).toFixed(1)) : 0;
    // Priority score combines unmatched volume and non-compliance %
    const priorityScore = val.unmatched * (1 + unmatchedPercent / 100);
    list.push({
      key,
      name: key,
      totalPoLines: val.total,
      totalSpend: val.spend,
      matchedCount: val.matched,
      unmatchedCount: val.unmatched,
      unmatchedPercent,
      codeDiffDescCount: val.codeDiffDesc,
      codeNotInMdmCount: val.codeNotInMdm,
      priorityScore
    });
  }

  return list.sort((a, b) => b.unmatchedCount - a.unmatchedCount || b.unmatchedPercent - a.unmatchedPercent);
}

/**
 * Aggregates User/Petugas compliance rank (identifies user accounts recorded on non-compliant PO lines)
 */
export function aggregateUserCompliance(
  evaluatedRecords: PoLineComplianceRecord[]
): EntityComplianceSummary[] {
  const map = new Map<string, {
    name: string;
    total: number;
    spend: number;
    matched: number;
    unmatched: number;
    codeDiffDesc: number;
    codeNotInMdm: number;
  }>();

  for (const r of evaluatedRecords) {
    const uKey = (r.requesterName || r.requester || 'User PO').trim();
    let data = map.get(uKey);
    if (!data) {
      data = { 
        name: uKey, 
        total: 0, 
        spend: 0, 
        matched: 0, 
        unmatched: 0, 
        codeDiffDesc: 0, 
        codeNotInMdm: 0 
      };
      map.set(uKey, data);
    }
    data.total += 1;
    data.spend += r.totalLineAmount || 0;
    if (r.isMatched) data.matched += 1;
    if (r.isUnmatched) data.unmatched += 1;
    if (r.category === 'MATCH_CODE_DIFF_DESC') data.codeDiffDesc += 1;
    if (r.category === 'CODE_NOT_IN_MDM') data.codeNotInMdm += 1;
  }

  const list: EntityComplianceSummary[] = [];
  for (const [key, val] of map.entries()) {
    const unmatchedPercent = val.total > 0 ? Number(((val.unmatched / val.total) * 100).toFixed(1)) : 0;
    const priorityScore = val.unmatched * (1 + unmatchedPercent / 100);
    list.push({
      key,
      name: val.name,
      totalPoLines: val.total,
      totalSpend: val.spend,
      matchedCount: val.matched,
      unmatchedCount: val.unmatched,
      unmatchedPercent,
      codeDiffDescCount: val.codeDiffDesc,
      codeNotInMdmCount: val.codeNotInMdm,
      priorityScore
    });
  }

  return list.sort((a, b) => b.unmatchedCount - a.unmatchedCount || b.unmatchedPercent - a.unmatchedPercent);
}
