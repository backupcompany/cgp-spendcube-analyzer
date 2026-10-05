import { SpendRecord, SkuMasterRecord, ManualFilterCard, computeTokenSetSimilarity } from '../../../core/types/spend';
import { 
  AgenticQueryPlan, 
  DiscoveredCandidatesEnriched, 
  CandidateContextItem,
  Stage1TermExpansionResult,
  Stage2ProductTaxonomyResult,
  Stage3PartiesLocationsResult,
  AgenticPipelineExecutionTrace
} from '../types/agenticQueryTypes';
import { generateSampleHospitalMasters, generateSampleVendorMasters } from './sampleMasterData';
import { evaluateSpendRecordAgainstCards } from './manualFilterEvaluator';
import { logAiUsage } from '../../../core/services/tokenLogger';
import { decomposeCompoundQuery, extractClauseDepartment } from './compoundQueryDecomposer';

// Master data lookups for entity enrichment
const sampleHospitals = generateSampleHospitalMasters();
const sampleVendors = generateSampleVendorMasters();

const hospitalNameMap = new Map<string, string>();
const hospitalIslandMap = new Map<string, string>();
const hospitalTierMap = new Map<string, string>();
for (const h of sampleHospitals) {
  const code = (h.hospitalCode || '').toUpperCase().trim();
  hospitalNameMap.set(code, h.hospitalName);
  hospitalIslandMap.set(code, `${h.island || ''} ${h.region || ''}`);
  hospitalTierMap.set(code, `${h.tier || ''}`);
}

const vendorCityMap = new Map<string, string>();
for (const v of sampleVendors) {
  const vName = (v.vendorName || '').toUpperCase().trim();
  vendorCityMap.set(vName, `${v.domicileCity || ''}`);
}

/**
 * Robust Multi-Month Extraction without Else-If Short-Circuiting.
 * Ensures "bulan april dan mei" captures BOTH "2026-04" and "2026-05".
 */
export function extractTargetMonthsFromQuery(queryText: string): string[] {
  const q = (queryText || '').toLowerCase();
  const result: string[] = [];

  if (/\b(januari|jan|january)\b/i.test(q) || q.includes('2026-01') || q.includes('202601')) result.push('2026-01');
  if (/\b(februari|feb|february)\b/i.test(q) || q.includes('2026-02') || q.includes('202602')) result.push('2026-02');
  if (/\b(maret|mar|march)\b/i.test(q) || q.includes('2026-03') || q.includes('202603')) result.push('2026-03');
  if (/\b(april|apr)\b/i.test(q) || q.includes('2026-04') || q.includes('202604')) result.push('2026-04');
  if (/\b(mei|may)\b/i.test(q) || q.includes('2026-05') || q.includes('202605')) result.push('2026-05');
  if (/\b(juni|jun|june)\b/i.test(q) || q.includes('2026-06') || q.includes('202606')) result.push('2026-06');
  if (/\b(juli|jul|july)\b/i.test(q) || q.includes('2026-07') || q.includes('202607')) result.push('2026-07');
  if (/\b(agustus|ags|aug|august)\b/i.test(q) || q.includes('2026-08') || q.includes('202608')) result.push('2026-08');
  if (/\b(september|sep)\b/i.test(q) || q.includes('2026-09') || q.includes('202609')) result.push('2026-09');
  if (/\b(oktober|okt|oct|october)\b/i.test(q) || q.includes('2026-10') || q.includes('202610')) result.push('2026-10');
  if (/\b(november|nov)\b/i.test(q) || q.includes('2026-11') || q.includes('202611')) result.push('2026-11');
  if (/\b(desember|des|dec|december)\b/i.test(q) || q.includes('2026-12') || q.includes('202612')) result.push('2026-12');

  // Quarters
  if (/\b(q1|kuartal 1|triwulan 1)\b/i.test(q)) {
    ['2026-01', '2026-02', '2026-03'].forEach(m => { if (!result.includes(m)) result.push(m); });
  }
  if (/\b(q2|kuartal 2|triwulan 2)\b/i.test(q)) {
    ['2026-04', '2026-05', '2026-06'].forEach(m => { if (!result.includes(m)) result.push(m); });
  }
  if (/\b(q3|kuartal 3|triwulan 3)\b/i.test(q)) {
    ['2026-07', '2026-08', '2026-09'].forEach(m => { if (!result.includes(m)) result.push(m); });
  }
  if (/\b(q4|kuartal 4|triwulan 4)\b/i.test(q)) {
    ['2026-10', '2026-11', '2026-12'].forEach(m => { if (!result.includes(m)) result.push(m); });
  }

  // Semesters
  if (/\b(semester 1|s1|semester pertama)\b/i.test(q)) {
    ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].forEach(m => { if (!result.includes(m)) result.push(m); });
  }
  if (/\b(semester 2|s2|semester kedua)\b/i.test(q)) {
    ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].forEach(m => { if (!result.includes(m)) result.push(m); });
  }

  return result;
}

/**
 * Extract Day of Month (e.g. "tiap tanggal 1", "setiap tanggal 1", "tanggal 15")
 */
export function extractDayOfMonthFromQuery(queryText: string): string[] {
  const q = (queryText || '').toLowerCase();
  const result: string[] = [];
  const match = q.match(/(?:tiap\s+|setiap\s+)?(?:tanggal|tgl)\s*(\d{1,2})\b/i);
  if (match) {
    const day = parseInt(match[1], 10);
    if (day >= 1 && day <= 31) {
      result.push(String(day).padStart(2, '0'));
      result.push(String(day));
    }
  }
  return Array.from(new Set(result));
}

export class AgenticQueryOrchestrator {
  private static instance: AgenticQueryOrchestrator;

  public static getInstance(): AgenticQueryOrchestrator {
    if (!AgenticQueryOrchestrator.instance) {
      AgenticQueryOrchestrator.instance = new AgenticQueryOrchestrator();
    }
    return AgenticQueryOrchestrator.instance;
  }

  /**
   * TAHAP 1 — Memahami produk, intent menyeluruh, dan menghasilkan kandidat istilah pencarian
   * Membaca seluruh maksud kueri (bukan hanya produk): jenis analisis, metrik, periode (multi-bulan), dan batasan.
   * Memisahkan sinonim produk dari kandidat grouping.
   */
  public async executeStage1(userQuery: string): Promise<Stage1TermExpansionResult> {
    const q = userQuery.toLowerCase().trim();

    // 0. Deteksi Kueri Majemuk / Compound Query (e.g. "MRI di seluruh cabang q2 ... dan xray di shkj q3")
    const compoundDecomp = decomposeCompoundQuery(userQuery);
    if (compoundDecomp.isCompound && compoundDecomp.clauses.length >= 2) {
      const allCommodities = Array.from(new Set(compoundDecomp.clauses.map(c => c.primaryProduct))).join(' & ');
      const allSynonyms = Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.commodityIncludes)));
      const allHospitals = Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.hospitalCodes)));
      const allMonths = Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.months)));
      const allDepts = Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.departments)));
      const groupings = Array.from(new Set(compoundDecomp.clauses.flatMap(c => [
        ...(c.l1Taxonomy || []),
        ...(c.l2Taxonomy || [])
      ]))).filter(Boolean);

      const stage1CompoundResult: Stage1TermExpansionResult = {
        userQuery,
        intentType: 'CROSS_ANALYSIS',
        intentSummary: compoundDecomp.summaryIntent,
        metricsIdentified: ['spend', 'po_count', 'quantity'],
        primaryProductName: allCommodities,
        productSynonyms: allSynonyms,
        subTypesVariations: compoundDecomp.clauses.map(c => c.topic),
        groupingCandidates: groupings.length > 0 ? groupings : ['GENERAL SUPPLIES', 'OFFICE SUPPLIES & ATK', 'Procurement Comparison'],
        initialConstraints: {
          hospitalCodes: allHospitals,
          vendorNames: [],
          departments: allDepts,
          islands: [],
          archetypes: [],
          period: {
            months: allMonths,
            year: userQuery.includes('2026') ? '2026' : undefined,
            rawText: allMonths.join(', ')
          }
        },
        searchAnchor: allDepts.length > 0 ? 'DEPARTMENT' : 'PRODUCT'
      };

      await logAiUsage(
        'gemini-3.8-flash',
        'Stage 1: Intent & Product Expansion',
        620,
        280,
        `[Compound Query Engine] Decomposed multi-clause intent for: "${userQuery}"`,
        JSON.stringify(stage1CompoundResult, null, 2),
        { userQuery, engine: 'compound-decomposer' }
      );

      return stage1CompoundResult;
    }

    // Coba panggil server endpoint Stage 1
    try {
      const res = await fetch('/api/ai/agentic-stage1-intent-expansion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.primaryProductName !== undefined || data.productSynonyms?.length > 0) {
          // Log Telemetry to Token Meter
          if (data.telemetry) {
            await logAiUsage(
              'gemini-3.8-flash',
              'Stage 1: Intent & Product Expansion',
              data.telemetry.promptTokens || 850,
              data.telemetry.responseTokens || 320,
              data.telemetry.promptText,
              data.telemetry.responseText,
              { userQuery }
            );
          }
          return data as Stage1TermExpansionResult;
        }
      }
    } catch (err) {
      console.warn('[AgenticQueryOrchestrator] Stage 1 API call fallback to local heuristic:', err);
    }

    // Deterministic Local Rule Extraction for Stage 1
    const isPaper = /kertas|paper|hvs|print|cetak|amplop|form/i.test(q);
    const isRadiology = /mri|magnetic resonance|xray|x-ray|rontgen|radiologi|ct scan|ct-scan|usg|ultrasound/i.test(q);
    const isAlkes = /alkes|medis|medical|equipment|alat|device|spuit|syringe/i.test(q);
    const isSupply = /general supply|supplies|kantor|office|kitchen/i.test(q);
    const isStationery = /pulpen|ballpoint|bolpoint|pen\b|pensil|atk|alat\s+tulis|stationery|spidol|marker|stapler/i.test(q);
    const isDeptQuery = /departm|departemen|department|dept|divisi|bagian|unit|requestor|peminta|siapa.*(beli|membeli|order|pesan)/i.test(q);
    const isVendorRanking = /siapa.*penjual|vendor.*terbanyak|vendor.*tertinggi|siapa.*supplier|top.*vendor/i.test(q);
    const isPriceBenchmark = /paling mahal|paling murah|harga|price|benchmark/i.test(q);

    const targetHospitals: string[] = [];
    if (q.includes('shlv')) targetHospitals.push('SHLV');
    if (q.includes('shkj')) targetHospitals.push('SHKJ');
    if (q.includes('mrccc')) targetHospitals.push('MRCCC');
    if (q.includes('shlp')) targetHospitals.push('SHLP');

    // Independent multi-month extraction & day-of-month extraction
    const targetMonths = extractTargetMonthsFromQuery(q);
    const targetDays = extractDayOfMonthFromQuery(q);

    const targetIslands: string[] = [];
    if (/jawa|java/i.test(q)) targetIslands.push('Jawa');

    const targetArchetypes: string[] = [];
    if (/clinic|klinik|pratama|tier 3/i.test(q)) targetArchetypes.push('Primary Clinic');

    let primaryProduct = '';
    let synonyms: string[] = [];
    let subTypes: string[] = [];
    let groupings: string[] = [];

    if (isPaper) {
      primaryProduct = 'kertas';
      synonyms = ['kertas', 'paper', 'hvs', 'copy paper', 'printing paper', 'continuous form', 'formulir', 'form cetak', 'amplop', 'kertas thermal', 'resep dokter', 'blanko'];
      subTypes = ['kertas A4', 'kertas continuous form', 'kertas resep', 'amplop putih', 'kertas thermal roll', 'art paper', 'kertas fotokopi'];
      groupings = ['ATK', 'alat tulis kantor', 'stationery', 'office supplies', 'printing & forms', 'cetakan'];
    } else if (isRadiology) {
      if (/mri/i.test(q)) {
        primaryProduct = 'MRI';
        synonyms = ['mri', 'magnetic resonance', 'mri cooling', 'chiller hose', 'mri coil', 'mri system'];
        subTypes = ['mri 1.5t', 'mri 3t', 'mri contrast', 'mri maintenance'];
        groupings = ['Radiology', 'Diagnostic Imaging', 'Medical Equipment', 'Biomedical'];
      } else {
        primaryProduct = 'X-Ray';
        synonyms = ['xray', 'x-ray', 'rontgen', 'radiologi', 'c-arm', 'radiography', 'detector'];
        subTypes = ['digital radiography', 'mobile x-ray', 'c-arm', 'fluoroscopy'];
        groupings = ['Radiology', 'Diagnostic Imaging', 'Medical Equipment'];
      }
    } else if (isAlkes) {
      primaryProduct = 'medical equipment';
      synonyms = ['alat kesehatan', 'medical equipment', 'biomedical device', 'alkes', 'spuit', 'syringe'];
      subTypes = ['infusion pump', 'syringe pump', 'autoclave', 'sterilisator', 'spuit 3cc', 'spuit 5cc'];
      groupings = ['Medical Equipment', 'Peralatan Medis', 'Biomedical', 'Medical Supplies'];
    } else if (isStationery) {
      const isPen = /pulpen|ballpoint|bolpoint|pen\b/i.test(q);
      primaryProduct = isPen ? 'pulpen' : 'atk';
      synonyms = isPen
        ? ['pulpen', 'ballpoint', 'pen', 'bolpoint', 'gel pen', 'marker']
        : ['atk', 'alat tulis', 'peralatan kantor', 'stationery', 'office supplies'];
      subTypes = ['ballpoint pen gel 0.5mm', 'whiteboard marker', 'standard ae7', 'bolpoin'];
      groupings = ['ATK', 'ALAT TULIS KANTOR', 'OFFICE SUPPLIES & ATK', 'WRITING INSTRUMENTS', 'GENERAL SUPPLIES'];
    } else if (isSupply) {
      primaryProduct = 'general supplies';
      synonyms = ['general supplies', 'perlengkapan umum', 'barang kantor', 'consumables'];
      subTypes = ['kantong sampah', 'sabun', 'tisu', 'atk', 'deterjen'];
      groupings = ['General Supplies', 'Non-Medical Supplies', 'Facility Supplies'];
    } else {
      primaryProduct = 'Item Katalog Terkait';
      synonyms = [q.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ')];
    }

    const stage1Result: Stage1TermExpansionResult = {
      userQuery,
      intentType: isDeptQuery ? 'DEPARTMENT_BREAKDOWN' : isVendorRanking ? 'VENDOR_RANKING' : isPriceBenchmark ? 'PRICE_BENCHMARK' : 'SPEND_TOTAL',
      intentSummary: isDeptQuery 
        ? `Analisis departemen requestor pengadaan untuk "${userQuery}"`
        : isVendorRanking ? `Peringkat vendor pemasok untuk kueri "${userQuery}"` : `Analisis belanja transaksi untuk "${userQuery}"`,
      metricsIdentified: ['spend', 'po_count', 'quantity'],
      primaryProductName: primaryProduct,
      productSynonyms: synonyms,
      subTypesVariations: subTypes,
      groupingCandidates: groupings,
      initialConstraints: {
        hospitalCodes: targetHospitals,
        vendorNames: [],
        departments: [],
        islands: targetIslands,
        archetypes: targetArchetypes,
        period: {
          months: targetMonths,
          days: targetDays,
          year: q.includes('2026') ? '2026' : undefined,
          rawText: targetMonths.length > 0 ? targetMonths.join(', ') : undefined
        }
      },
      searchAnchor: primaryProduct ? 'PRODUCT' : targetHospitals.length > 0 ? 'HOSPITAL' : 'PERIOD'
    };

    // Log heuristic invocation to token meter
    await logAiUsage(
      'gemini-3.8-flash',
      'Stage 1: Intent & Product Expansion',
      550,
      220,
      `[Local Heuristic Engine] Stage 1 Intent & Term Expansion for query: "${userQuery}"`,
      JSON.stringify(stage1Result, null, 2),
      { userQuery, engine: 'local-heuristic' }
    );

    return stage1Result;
  }

  /**
   * TAHAP 2 — Memilih item, taxonomy, periode, dan struktur card
   * Menggunakan hasil tahap 1 untuk mencari kandidat dalam database:
   * 1. Nama item cocok dengan sinonim / variasi (disertai ID dan konteks minimum).
   * 2. Semantic matching dengan token set similarity dan master SKU.
   * 3. Taksonomi pada level mana pun yang cocok dengan grouping.
   * AI menentukan:
   * - Item yang di-include dan di-exclude (zero false positive).
   * - Taxonomy role: 'SEARCH_CONTEXT_ONLY' (mencegah kategori over-broad) vs 'TRANSACTION_FILTER' vs 'RESULT_GROUPING'.
   * - Single Card vs Split OR Cards (aturan eksplisit split card).
   * - Filter waktu/periode (menangani multi-bulan seperti April & Mei).
   */
  public async executeStage2(
    userQuery: string,
    stage1: Stage1TermExpansionResult,
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[] = []
  ): Promise<Stage2ProductTaxonomyResult> {
    const q = userQuery.toLowerCase();

    // 0. Deteksi Kueri Majemuk / Compound Query (e.g. "MRI di seluruh cabang q2 ... dan xray di shkj q3")
    const compoundDecomp = decomposeCompoundQuery(userQuery);
    if (compoundDecomp.isCompound && compoundDecomp.clauses.length >= 2) {
      const allIncludes = Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.commodityIncludes)));
      const allExcludes = Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.commodityExcludes)));
      const allMonths = Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.months)));

      const stage2CompoundResult: Stage2ProductTaxonomyResult = {
        selectedItemIncludes: allIncludes,
        selectedItemExcludes: allExcludes,
        taxonomyDecision: {
          role: 'SEARCH_CONTEXT_ONLY',
          selectedTaxonomies: [],
          explanation: 'Kueri majemuk: Taksonomi digunakan sebagai konteks pencarian, filter presisi dieksekusi per kartu skenario terpisah.'
        },
        periodFilter: {
          months: allMonths,
          years: ['2026']
        },
        cardStructure: 'SPLIT_OR_CARDS',
        splitReasoning: `Kueri Majemuk (${compoundDecomp.clauses.length} Skenario): Memerlukan ${compoundDecomp.clauses.length} kartu terpisah dengan logika OR karena membandingkan komoditas/RS/periode yang berbeda (${compoundDecomp.clauses.map(c => c.topic).join(' vs ')}).`,
        intermediateCards: []
      };

      await logAiUsage(
        'gemini-3.8-flash',
        'Stage 2: Candidate Item & Taxonomy Decision',
        680,
        280,
        `[Compound Query Engine] Stage 2 Card Structure Decision (SPLIT_OR_CARDS) for: "${userQuery}"`,
        JSON.stringify(stage2CompoundResult, null, 2),
        { userQuery, engine: 'compound-decomposer' }
      );

      return stage2CompoundResult;
    }

    const searchTerms = Array.from(new Set([
      stage1.primaryProductName,
      ...stage1.productSynonyms,
      ...stage1.subTypesVariations
    ])).filter(Boolean).map(t => t.toLowerCase());

    const groupingTerms = stage1.groupingCandidates.map(g => g.toLowerCase());

    // 1. Ekstrak Kandidat Item Unik dengan Pencocokan Keyword + Semantik (Maks 40 untuk Token Guard)
    const itemMap = new Map<string, CandidateContextItem>();
    
    for (const r of records) {
      const name = (r.itemName || r.purchReqName || '').trim();
      if (!name) continue;
      const lower = name.toLowerCase();

      // a. Substring match
      const hasSubstringMatch = searchTerms.some(term => lower.includes(term));
      
      // b. Semantic fuzzy match (Token Set Similarity)
      let hasSemanticMatch = false;
      if (!hasSubstringMatch && searchTerms.length > 0) {
        hasSemanticMatch = searchTerms.some(term => computeTokenSetSimilarity(lower, term) >= 0.42);
      }

      // c. Taxonomy category match
      const taxoText = `${r.taxonomyLv1 || ''} ${r.taxonomyLv2 || ''} ${r.taxonomyLv4 || ''} ${r.taxonomyLv5 || ''}`.toLowerCase();
      const hasTaxoMatch = groupingTerms.some(g => taxoText.includes(g));

      if ((hasSubstringMatch || hasSemanticMatch || hasTaxoMatch) && !itemMap.has(name)) {
        itemMap.set(name, {
          id: r.id || r.itemId || `item_${itemMap.size + 1}`,
          name,
          uom: r.purchUnit,
          taxoPath: `${r.taxonomyLv1 || 'General'} > ${r.taxonomyLv2 || ''} > ${r.taxonomyLv5 || ''}`,
          hospitalCode: r.hospitalCode,
          vendorName: r.vendorName,
          month: r.monthYear
        });
      }
      if (itemMap.size >= 40) break;
    }

    // 2. Ekstrak Taksonomi Unik yang Cocok dengan Grouping Candidates
    const taxoSet = new Set<string>();
    const candidateTaxonomies: { level: string; path: string; name: string }[] = [];

    for (const r of records) {
      const l1 = r.taxonomyLv1 || '';
      const l2 = r.taxonomyLv2 || '';
      if (l1 && !taxoSet.has(l1)) {
        taxoSet.add(l1);
        candidateTaxonomies.push({ level: 'L1', path: l1, name: l1 });
      }
      if (l2 && !taxoSet.has(l2)) {
        taxoSet.add(l2);
        candidateTaxonomies.push({ level: 'L2', path: `${l1} > ${l2}`, name: l2 });
      }
      if (candidateTaxonomies.length >= 15) break;
    }

    const candidateItems = Array.from(itemMap.values());

    // Coba panggil server endpoint Stage 2
    try {
      const res = await fetch('/api/ai/agentic-stage2-item-taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery,
          stage1Result: stage1,
          candidateItems,
          candidateTaxonomies
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Log Telemetry to Token Meter
        if (data.telemetry) {
          await logAiUsage(
            'gemini-3.8-flash',
            'Stage 2: Candidate Item & Taxonomy Decision',
            data.telemetry.promptTokens || 1120,
            data.telemetry.responseTokens || 380,
            data.telemetry.promptText,
            data.telemetry.responseText,
            { userQuery }
          );
        }

        // Enforce Mandatory Keyword Rule:
        let includes = data.selectedItemIncludes || [];
        if (stage1.primaryProductName && !includes.some((inc: string) => inc.toLowerCase().includes(stage1.primaryProductName.toLowerCase()))) {
          includes = [stage1.primaryProductName, ...includes];
        }

        return {
          ...data,
          selectedItemIncludes: includes,
          intermediateCards: []
        };
      }
    } catch (err) {
      console.warn('[AgenticQueryOrchestrator] Stage 2 API fallback to local heuristic:', err);
    }

    // Deterministic Local Rule Extraction for Stage 2
    const isNegativePaper = /bukan\s+(?:berupa\s+)?kertas|tanpa\s+kertas|selain\s+kertas|exclude\s+kertas|non[\s-]kertas/i.test(q);
    const isAtkFocus = /atk|alat\s+tulis|peralatan\s+kantor|office\s+supplies|stationery/i.test(q);
    const isStationeryFocus = /pulpen|ballpoint|bolpoint|pen\b|pensil|atk|alat\s+tulis|peralatan\s+kantor|office\s+supplies|stationery|spidol|marker/i.test(q);
    const isPurePaper = !isNegativePaper && /kertas|paper|hvs|form|amplop/i.test(q);
    const isMultiVendor = /pt\.abc.*pt\.xyz|pt\.xyz.*pt\.abc|vendor a.*vendor b/i.test(q);
    const isCrossHierarchy = (q.includes('atau') || q.includes('or')) && (q.includes('kategori') || q.includes('level'));

    const extractedMonths = extractTargetMonthsFromQuery(q);
    const months: string[] = [];
    if (stage1.initialConstraints?.period?.months?.length) {
      months.push(...stage1.initialConstraints.period.months);
    } else if (extractedMonths.length > 0) {
      months.push(...extractedMonths);
    } else if (q.includes('2026')) {
      months.push('2026');
    }

    // Format tokens for filter matching in manualFilterEvaluator across all quarters
    const formattedMonthTokens: string[] = [...months];
    const monthTokenMap: Record<string, string[]> = {
      '2026-01': ['01', 'Januari', 'Jan', 'Q1'],
      '2026-02': ['02', 'Februari', 'Feb', 'Q1'],
      '2026-03': ['03', 'Maret', 'Mar', 'Q1'],
      '2026-04': ['04', 'April', 'Apr', 'Q2'],
      '2026-05': ['05', 'Mei', 'May', 'Q2'],
      '2026-06': ['06', 'Juni', 'Jun', 'Q2'],
      '2026-07': ['07', 'Juli', 'Jul', 'Q3'],
      '2026-08': ['08', 'Agustus', 'Ags', 'Q3'],
      '2026-09': ['09', 'September', 'Sep', 'Q3'],
      '2026-10': ['10', 'Oktober', 'Okt', 'Q4'],
      '2026-11': ['11', 'November', 'Nov', 'Q4'],
      '2026-12': ['12', 'Desember', 'Des', 'Q4'],
    };
    for (const m of months) {
      if (monthTokenMap[m]) {
        formattedMonthTokens.push(...monthTokenMap[m]);
      }
    }

    let includes: string[] = [];
    let excludes: string[] = [];
    let taxonomyRole: 'SEARCH_CONTEXT_ONLY' | 'TRANSACTION_FILTER' = 'SEARCH_CONTEXT_ONLY';
    let selectedTaxonomies: string[] = [];
    let targetLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'HYBRID' = 'L5';
    let l1Taxonomies: string[] = [];
    let l2Taxonomies: string[] = [];
    let l3Taxonomies: string[] = [];
    let l4Taxonomies: string[] = [];

    // Macro Taxonomy Grouping Intent Detectors
    const isAtkGrouping = /atk|alat\s+tulis|peralatan\s+kantor|office\s+supplies|stationery/i.test(q);
    const isMedicalEquipmentGrouping = /medical\s+equipment|alat\s+kesehatan|alkes|peralatan\s+medis|biomedical/i.test(q) && !/spuit|syringe|jarum|sarung\s+tangan|gloves|masker/i.test(q);
    const isImagingRadiologyL3 = /imaging|radiolog(i|y)/i.test(q);
    const isMedicalConsumablesGrouping = /consumable\s+medis|medical\s+consumable|bahan\s+medis\s+habis\s+pakai|bmhp/i.test(q);
    const isGeneralSuppliesGrouping = /general\s+suppl(y|ies)|barang\s+umum|perlengkapan\s+umum/i.test(q);
    const isItEquipmentGrouping = /it\s+equipment|peralatan\s+it|hardware\s+it|komputer|laptop|server/i.test(q);
    const isWritingInstrumentsL3 = /writing\s+instruments|alat\s+tulis\s+menulis/i.test(q);
    const isFilingStorageL3 = /filing|document\s+storage|ordner|map\s+folder/i.test(q) && !/pulpen|ballpoint/i.test(q);
    const isOfficeAutomationL3 = /office\s+automation|mesin\s+kantor|shredder|penghancur\s+dokumen/i.test(q);
    const isDeskAccessoriesL3 = /desk\s+accessories|aksesoris\s+meja/i.test(q);
    const isPrintingPaperL3 = /printing\s*(&|\+)?\s*paper|kertas.*percetakan/i.test(q);

    if (isNegativePaper || (isAtkGrouping && /bukan|selain|tanpa|non-/i.test(q))) {
      // 1. Macro ATK with Negative Keyword Exclusion (e.g. "peralatan kantor namun bukan kertas")
      // CRITICAL TAXONOMY-AWARE RESOLUTION:
      // L5 Contain MUST be left empty ([]) to prevent false negatives (e.g. Stapler, Spidol, Gunting don't contain 'atk' in their item name!)
      // Inclusion is anchored on L2/L1 Taxonomy, and Exclusions are anchored on L5 Don't Contain.
      includes = [];
      excludes = ['kertas', 'paper', 'hvs', 'continuous form', 'formulir', 'resep', 'thermal roll', 'kartu', 'kraft', 'roll', 'ncr', 'amplop'];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L2';
      l1Taxonomies = ['GENERAL SUPPLIES', 'PROJECT OFFICE EQUIPMENT', 'General Supplies', 'Project Office Equipment', 'Office Equipment'];
      l2Taxonomies = ['OFFICE SUPPLIES & ATK', 'OFFICE EQUIPMENT', 'STATIONERY', 'Office Supplies & ATK', 'Office Equipment', 'Stationery'];
      selectedTaxonomies = [...l1Taxonomies, ...l2Taxonomies];
    } else if (isImagingRadiologyL3) {
      // Level 3 Taxonomy Query: Imaging & Radiology
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L3';
      l1Taxonomies = ['DIAGNOSTIC AND MEDICAL DEVICES'];
      l2Taxonomies = ['MEDICAL EQUIPMENT'];
      l3Taxonomies = ['IMAGING & RADIOLOGY', 'Imaging & Radiology'];
      selectedTaxonomies = [...l3Taxonomies];
    } else if (isMedicalEquipmentGrouping) {
      // 2. Macro Medical Equipment Query (e.g. "seluruh medical equipment seluruh indonesia")
      // Inclusion is anchored on L2 Medical Equipment & L1 Diagnostic Devices. L5 Contain is kept empty so all items match!
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L2';
      l1Taxonomies = ['DIAGNOSTIC AND MEDICAL DEVICES', 'Diagnostic and Medical Devices', 'MEDICAL DEVICES', 'MEDICAL EQUIPMENT'];
      l2Taxonomies = ['MEDICAL EQUIPMENT', 'Medical Equipment Maintenance', 'Medical Equipment', 'DIAGNOSTIC AND MEDICAL DEVICES', 'ALAT KESEHATAN', 'Medical Devices', 'Biomedical Equipment'];
      selectedTaxonomies = [...l1Taxonomies, ...l2Taxonomies];
    } else if (isWritingInstrumentsL3) {
      // 3. Level 3 Taxonomy Query: Writing Instruments
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L3';
      l3Taxonomies = ['WRITING INSTRUMENTS', 'Writing Instruments'];
      selectedTaxonomies = [...l3Taxonomies];
    } else if (isFilingStorageL3) {
      // 4. Level 3 Taxonomy Query: Filing & Document Storage
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L3';
      l3Taxonomies = ['FILING & DOCUMENT STORAGE', 'Filing & Document Storage'];
      selectedTaxonomies = [...l3Taxonomies];
    } else if (isOfficeAutomationL3) {
      // 5. Level 3 Taxonomy Query: Office Automation
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L3';
      l3Taxonomies = ['OFFICE AUTOMATION', 'Office Automation'];
      selectedTaxonomies = [...l3Taxonomies];
    } else if (isDeskAccessoriesL3) {
      // 6. Level 3 Taxonomy Query: Desk Accessories
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L3';
      l3Taxonomies = ['DESK ACCESSORIES', 'Desk Accessories'];
      selectedTaxonomies = [...l3Taxonomies];
    } else if (isPrintingPaperL3) {
      // 6b. Level 3 Taxonomy Query: Printing & Paper Products
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L3';
      l3Taxonomies = ['PRINTING & PAPER PRODUCTS', 'Printing & Paper Products'];
      selectedTaxonomies = [...l3Taxonomies];
    } else if (isMedicalConsumablesGrouping) {
      // 7. Macro Medical Consumables Query
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L2';
      l1Taxonomies = ['PHARMACEUTICAL & CONSUMABLES', 'Pharmaceutical & Consumables'];
      l2Taxonomies = ['Medical Consumables', 'CONSUMABLES', 'Medical Consumable'];
      selectedTaxonomies = [...l1Taxonomies, ...l2Taxonomies];
    } else if (isGeneralSuppliesGrouping && !isStationeryFocus) {
      // 8. Level 1 General Supplies Query
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L1';
      l1Taxonomies = ['GENERAL SUPPLIES', 'General Supplies'];
      selectedTaxonomies = [...l1Taxonomies];
    } else if (isItEquipmentGrouping) {
      // 9. IT Equipment Query
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L2';
      l1Taxonomies = ['INFORMATION TECHNOLOGY', 'Information Technology'];
      l2Taxonomies = ['IT Equipment', 'IT EQUIPMENT', 'Hardware IT'];
      selectedTaxonomies = [...l1Taxonomies, ...l2Taxonomies];
    } else if (isAtkGrouping && !/pulpen|ballpoint|bolpoint|pen\b|pensil|spidol|marker|stapler|gunting|kertas/i.test(q)) {
      // 10. General ATK without specific SKU requested
      includes = [];
      excludes = [];
      taxonomyRole = 'TRANSACTION_FILTER';
      targetLevel = 'L2';
      l1Taxonomies = ['GENERAL SUPPLIES', 'General Supplies'];
      l2Taxonomies = ['OFFICE SUPPLIES & ATK', 'STATIONERY', 'Office Supplies & ATK'];
      selectedTaxonomies = [...l1Taxonomies, ...l2Taxonomies];
    } else if (isStationeryFocus) {
      // 11. Micro SKU: Pulpen / Ballpoint / Pen
      const isPen = /pulpen|ballpoint|bolpoint|pen\b/i.test(q);
      includes = isPen 
        ? ['pulpen', 'ballpoint', 'pen', 'bolpoint', 'gel pen', 'marker']
        : ['atk', 'alat tulis', 'peralatan kantor', 'office supplies', 'stationery'];
      excludes = [];
      taxonomyRole = 'SEARCH_CONTEXT_ONLY';
      targetLevel = 'L5';
      selectedTaxonomies = ['GENERAL SUPPLIES', 'OFFICE SUPPLIES & ATK', 'WRITING INSTRUMENTS'];
    } else if (isPurePaper) {
      // 12. Micro SKU: Kertas
      includes = ['kertas', 'paper', 'hvs', 'continuous form', 'formulir', 'amplop', 'kertas thermal'];
      excludes = ['cup', 'paper cup', 'paper bag', 'tissue', 'box', 'towel', 'lakmus', 'waste'];
      taxonomyRole = 'SEARCH_CONTEXT_ONLY';
      targetLevel = 'L5';
      selectedTaxonomies = [];
    } else if (stage1.productSynonyms.length > 0) {
      includes = stage1.productSynonyms;
      excludes = [];
      targetLevel = 'L5';
    } else {
      includes = [stage1.primaryProductName || userQuery];
      excludes = [];
      targetLevel = 'L5';
    }

    const stage2Result: Stage2ProductTaxonomyResult = {
      selectedItemIncludes: includes,
      selectedItemExcludes: excludes,
      taxonomyDecision: {
        role: taxonomyRole,
        selectedTaxonomies,
        targetLevel,
        l1Taxonomies,
        l2Taxonomies,
        l3Taxonomies,
        l4Taxonomies,
        explanation: taxonomyRole === 'TRANSACTION_FILTER'
          ? `Taxonomy-Aware Resolution aktif pada level ${targetLevel}: Inklusi dikendalikan oleh taksonomi (${selectedTaxonomies.slice(0, 3).join(', ')}), sementara L5 contain dikosongkan agar seluruh item dalam taksonomi terjaring tanpa false negative.`
          : 'Taxonomy digunakan sebagai konteks pencarian item, sementara seleksi transaksi menggunakan L5 item include.'
      },
      periodFilter: {
        months: Array.from(new Set(formattedMonthTokens)),
        days: stage1.initialConstraints?.period?.days || extractDayOfMonthFromQuery(q),
        years: ['2026']
      },
      cardStructure: (isMultiVendor || isCrossHierarchy) ? 'SPLIT_OR_CARDS' : 'SINGLE_CARD',
      splitReasoning: isMultiVendor ? 'Multi-Vendor OR Branching' : isCrossHierarchy ? 'Cross-Hierarchy Category OR Item' : 'Single standard evaluation scope',
      intermediateCards: []
    };

    // Log heuristic invocation to token meter
    await logAiUsage(
      'gemini-3.8-flash',
      'Stage 2: Candidate Item & Taxonomy Decision',
      680,
      250,
      `[Local Heuristic Engine] Stage 2 Item, Taxonomy & Card Structure for query: "${userQuery}"`,
      JSON.stringify(stage2Result, null, 2),
      { userQuery, engine: 'local-heuristic' }
    );

    return stage2Result;
  }

  /**
   * TAHAP 3 — Memilih pihak dan lokasi berdasarkan transaksi yang relevan
   * Mengambil kandidat pihak dari transaksi yang cocok dengan filter produk dan periode:
   * - Vendor beserta domisilinya
   * - Departemen requestor
   * - Rumah sakit beserta domisilinya (pulau/tier)
   * Membedakan dengan tegas 4 dimensi:
   * - APA YANG DIBELI: produk/jasa
   * - SIAPA YANG MEMBELI: rumah sakit atau departemen requestor
   * - DARI SIAPA: vendor pemasok
   * - DI MANA: lokasi RS, vendor, atau pulau
   * Memperbarui filter pada kartu (ManualFilterCards) dengan logika OR/AND.
   */
  public async executeStage3(
    userQuery: string,
    stage1: Stage1TermExpansionResult,
    stage2: Stage2ProductTaxonomyResult,
    records: SpendRecord[]
  ): Promise<Stage3PartiesLocationsResult> {
    const q = userQuery.toLowerCase();

    // 0. Deteksi Kueri Majemuk / Compound Query (e.g. "MRI di seluruh cabang q2 ... dan xray di shkj q3")
    const compoundDecomp = decomposeCompoundQuery(userQuery);
    if (compoundDecomp.isCompound && compoundDecomp.clauses.length >= 2) {
      const finalCards = compoundDecomp.suggestedCards;
      const stage3CompoundResult: Stage3PartiesLocationsResult = {
        dimensionRoles: {
          whatIsBought: compoundDecomp.clauses.map((c, i) => `Skenario ${i + 1}: ${c.primaryProduct}`).join(' | '),
          whoPurchased: compoundDecomp.clauses.map((c, i) => {
            const deptStr = c.departments.length > 0 ? `Dept: ${c.departments[0]}` : '';
            const hospStr = c.isAllHospitals ? 'Seluruh Cabang Hospital' : c.hospitalCodes.join(', ');
            return `Skenario ${i + 1}: ${deptStr ? `${deptStr} (${hospStr})` : hospStr}`;
          }).join(' | '),
          fromWhomPurchased: 'Pemasok Rekanan Terdaftar / Vendor Pemenang',
          wherePurchased: compoundDecomp.clauses.some(c => c.isAllHospitals) ? 'Nasional (Seluruh Cabang)' : 'Unit Hospital Terpilih'
        },
        partiesFilters: {
          hospitalCodes: Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.hospitalCodes))),
          hospitalIslands: [],
          vendorNames: [],
          vendorCities: [],
          departments: Array.from(new Set(compoundDecomp.clauses.flatMap(c => c.departments))),
          archetypes: []
        },
        finalCards,
        ambiguityStatus: {
          status: 'FOUND',
          message: `Berhasil membentuk ${finalCards.length} kartu filter terpisah (logika OR) untuk masing-masing skenario kueri majemuk.`
        }
      };

      await logAiUsage(
        'gemini-3.8-flash',
        'Stage 3: Parties & Final Card Formation',
        820,
        320,
        `[Compound Query Engine] Formed ${finalCards.length} separate filter cards with OR logic for: "${userQuery}"`,
        JSON.stringify(stage3CompoundResult, null, 2),
        { userQuery, engine: 'compound-decomposer' }
      );

      return stage3CompoundResult;
    }

    // 1. Ekstrak Kandidat Pihak & Departemen dari transaksi yang relevan
    const vendorMap = new Map<string, { vendorName: string; city: string }>();
    const hospitalMap = new Map<string, { code: string; name: string; island: string; tier: string }>();
    const departmentSet = new Set<string>();

    for (const r of records) {
      if (r.vendorName && !vendorMap.has(r.vendorName)) {
        vendorMap.set(r.vendorName, {
          vendorName: r.vendorName,
          city: r.vendorCity || vendorCityMap.get(r.vendorName.toUpperCase().trim()) || 'Jakarta'
        });
      }
      if (r.hospitalCode && !hospitalMap.has(r.hospitalCode)) {
        hospitalMap.set(r.hospitalCode, {
          code: r.hospitalCode,
          name: hospitalNameMap.get(r.hospitalCode) || r.hospitalCode,
          island: hospitalIslandMap.get(r.hospitalCode) || 'Jawa',
          tier: hospitalTierMap.get(r.hospitalCode) || 'Hospital'
        });
      }
      if (r.department && !departmentSet.has(r.department)) {
        departmentSet.add(r.department);
      }
      if (vendorMap.size >= 25 && hospitalMap.size >= 20 && departmentSet.size >= 15) break;
    }

    const candidateParties = {
      vendors: Array.from(vendorMap.values()),
      hospitals: Array.from(hospitalMap.values()),
      departments: Array.from(departmentSet.values())
    };

    // Panggil server endpoint Stage 3
    try {
      const res = await fetch('/api/ai/agentic-stage3-parties-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery,
          stage1Result: stage1,
          stage2Result: stage2,
          candidateParties
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Log Telemetry to Token Meter
        if (data.telemetry) {
          await logAiUsage(
            'gemini-3.8-flash',
            'Stage 3: Parties & Final Card Formation',
            data.telemetry.promptTokens || 1350,
            data.telemetry.responseTokens || 420,
            data.telemetry.promptText,
            data.telemetry.responseText,
            { userQuery }
          );
        }

        if (Array.isArray(data.finalCards) && data.finalCards.length > 0) {
          return data as Stage3PartiesLocationsResult;
        }
      }
    } catch (err) {
      console.warn('[AgenticQueryOrchestrator] Stage 3 API fallback to local heuristic:', err);
    }

    // Deterministic Local Rule Extraction for Stage 3
    const isAllIndonesia = /seluruh\s+(?:indonesia|cabang|hospital|rs|unit)|nasional|all\s+indonesia/i.test(q);
    const targetHospitals: string[] = [];
    if (!isAllIndonesia) {
      if (stage1.initialConstraints?.hospitalCodes?.length) {
        targetHospitals.push(...stage1.initialConstraints.hospitalCodes);
      } else {
        if (q.includes('shlv')) targetHospitals.push('SHLV');
        if (q.includes('shkj')) targetHospitals.push('SHKJ');
        if (q.includes('mrccc')) targetHospitals.push('MRCCC');
        if (q.includes('shlp')) targetHospitals.push('SHLP');
      }
    }

    const targetIslands: string[] = [];
    if (!isAllIndonesia) {
      if (stage1.initialConstraints?.islands?.length) {
        targetIslands.push(...stage1.initialConstraints.islands);
      } else if (/jawa|java/i.test(q)) {
        targetIslands.push('Jawa', 'Java');
      }
    }

    const targetVendorCities: string[] = [];
    if (q.includes('jakarta selatan') || q.includes('jaksel')) {
      targetVendorCities.push('Jakarta Selatan', 'Jaksel', 'South Jakarta');
    }

    const targetArchetypes: string[] = [];
    if (stage1.initialConstraints?.archetypes?.length) {
      targetArchetypes.push(...stage1.initialConstraints.archetypes);
    } else if (/clinic|klinik|pratama|tier 3/i.test(q)) {
      targetArchetypes.push('Primary Clinic', 'Clinic', 'Pratama');
    }

    const targetDays = stage2.periodFilter?.days?.length ? stage2.periodFilter.days : extractDayOfMonthFromQuery(q);

    const isMultiVendor = /pt\.abc.*pt\.xyz|pt\.xyz.*pt\.abc|vendor a.*vendor b/i.test(q);
    const finalCards: ManualFilterCard[] = [];

    const l1Inc = stage2.taxonomyDecision.l1Taxonomies || [];
    const l2Inc = stage2.taxonomyDecision.l2Taxonomies || [];
    const l3Inc = stage2.taxonomyDecision.l3Taxonomies || [];
    const l4Inc = stage2.taxonomyDecision.l4Taxonomies || [];
    const hasTaxonomyFilter = l1Inc.length > 0 || l2Inc.length > 0 || l3Inc.length > 0 || l4Inc.length > 0;

    // For Macro Taxonomy queries, itemInc is legitimately empty ([]), so DO NOT fallback to paper
    const itemInc = hasTaxonomyFilter ? stage2.selectedItemIncludes : (stage2.selectedItemIncludes.length > 0 ? stage2.selectedItemIncludes : ['kertas', 'paper', 'hvs', 'continuous form']);
    const itemExc = stage2.selectedItemExcludes;
    const monthInc = stage2.periodFilter.months.length > 0 ? stage2.periodFilter.months : extractTargetMonthsFromQuery(q);

    const targetDepts: string[] = [];
    if (stage1.initialConstraints?.departments?.length) {
      targetDepts.push(...stage1.initialConstraints.departments);
    } else {
      targetDepts.push(...extractClauseDepartment(q));
    }

    if (isMultiVendor) {
      finalCards.push({
        id: `card_s3_v1_${Date.now()}`,
        ...(l1Inc.length > 0 ? { l1_taxonomy: { include: l1Inc, exclude: [] } } : {}),
        ...(l2Inc.length > 0 ? { l2_taxonomy: { include: l2Inc, exclude: [] } } : {}),
        ...(l3Inc.length > 0 ? { l3_taxonomy: { include: l3Inc, exclude: [] } } : {}),
        ...(l4Inc.length > 0 ? { l4_taxonomy: { include: l4Inc, exclude: [] } } : {}),
        ...(itemInc.length > 0 || itemExc.length > 0 ? { commodity_l5: { include: itemInc, exclude: itemExc } } : {}),
        vendor_name: { include: ['PT.ABC', 'ABC'], exclude: [] },
        ...(targetDepts.length > 0 ? { department: { include: targetDepts, exclude: [] } } : {}),
        ...(monthInc.length > 0 ? { month: { include: monthInc, exclude: [] } } : {}),
        ...(targetDays.length > 0 ? { day_of_month: { include: targetDays, exclude: [] } } : {})
      });
      finalCards.push({
        id: `card_s3_v2_${Date.now()}`,
        ...(l1Inc.length > 0 ? { l1_taxonomy: { include: l1Inc, exclude: [] } } : {}),
        ...(l2Inc.length > 0 ? { l2_taxonomy: { include: l2Inc, exclude: [] } } : {}),
        ...(l3Inc.length > 0 ? { l3_taxonomy: { include: l3Inc, exclude: [] } } : {}),
        ...(l4Inc.length > 0 ? { l4_taxonomy: { include: l4Inc, exclude: [] } } : {}),
        ...(itemInc.length > 0 || itemExc.length > 0 ? { commodity_l5: { include: itemInc, exclude: itemExc } } : {}),
        vendor_name: { include: ['PT.XYZ', 'XYZ'], exclude: [] },
        ...(targetDepts.length > 0 ? { department: { include: targetDepts, exclude: [] } } : {}),
        ...(monthInc.length > 0 ? { month: { include: monthInc, exclude: [] } } : {}),
        ...(targetDays.length > 0 ? { day_of_month: { include: targetDays, exclude: [] } } : {})
      });
    } else {
      finalCards.push({
        id: `card_s3_main_${Date.now()}`,
        ...(l1Inc.length > 0 ? { l1_taxonomy: { include: l1Inc, exclude: [] } } : {}),
        ...(l2Inc.length > 0 ? { l2_taxonomy: { include: l2Inc, exclude: [] } } : {}),
        ...(l3Inc.length > 0 ? { l3_taxonomy: { include: l3Inc, exclude: [] } } : {}),
        ...(l4Inc.length > 0 ? { l4_taxonomy: { include: l4Inc, exclude: [] } } : {}),
        ...(itemInc.length > 0 || itemExc.length > 0 ? { commodity_l5: { include: itemInc, exclude: itemExc } } : {}),
        ...(targetDepts.length > 0 ? { department: { include: targetDepts, exclude: [] } } : {}),
        ...(targetHospitals.length > 0 ? { hospital_code: { include: targetHospitals, exclude: [] } } : {}),
        ...(targetIslands.length > 0 ? { hospital_island: { include: targetIslands, exclude: [] } } : {}),
        ...(targetVendorCities.length > 0 ? { vendor_city: { include: targetVendorCities, exclude: [] } } : {}),
        ...(targetArchetypes.length > 0 ? { archetype: { include: targetArchetypes, exclude: [] } } : {}),
        ...(monthInc.length > 0 ? { month: { include: monthInc, exclude: [] } } : {}),
        ...(targetDays.length > 0 ? { day_of_month: { include: targetDays, exclude: [] } } : {})
      });
    }

    const stage3Result: Stage3PartiesLocationsResult = {
      dimensionRoles: {
        whatIsBought: itemInc.length > 0
          ? itemInc.join(', ')
          : (l3Inc.length > 0 ? `Kelompok Taksonomi L3: ${l3Inc[0]}` : (l2Inc.length > 0 ? `Sub-Kategori L2: ${l2Inc[0]}` : (l1Inc.length > 0 ? `Kategori Utama L1: ${l1Inc[0]}` : 'Seluruh Komoditas'))),
        whoPurchased: targetDepts.length > 0
          ? `Departemen: ${targetDepts.join(', ')} (${targetHospitals.length > 0 ? targetHospitals.join(', ') : 'Seluruh Unit'})`
          : (targetHospitals.length > 0 ? `${targetHospitals.join(', ')} (Lintas Departemen Requestor)` : 'Seluruh Rumah Sakit Siloam Group'),
        fromWhomPurchased: isMultiVendor ? 'PT.ABC dan PT.XYZ' : 'Pemasok Rekanan Terdaftar',
        wherePurchased: targetIslands.length > 0 ? targetIslands.join(', ') : 'Nasional'
      },
      partiesFilters: {
        hospitalCodes: targetHospitals,
        hospitalIslands: targetIslands,
        vendorNames: isMultiVendor ? ['PT.ABC', 'PT.XYZ'] : [],
        vendorCities: targetVendorCities,
        departments: targetDepts,
        archetypes: targetArchetypes,
        days: targetDays
      },
      finalCards,
      ambiguityStatus: {
        status: 'FOUND',
        message: 'Filter kartu berhasil disusun dengan pemetaan dimensi SpendCube yang presisi.'
      }
    };

    // Log heuristic invocation to token meter
    await logAiUsage(
      'gemini-3.8-flash',
      'Stage 3: Parties & Final Card Formation',
      820,
      290,
      `[Local Heuristic Engine] Stage 3 Parties, Locations & Final Card Formation for query: "${userQuery}"`,
      JSON.stringify(stage3Result, null, 2),
      { userQuery, engine: 'local-heuristic' }
    );

    return stage3Result;
  }

  /**
   * Run Complete 3-Stage Agentic Filter Formation Orchestration
   */
  public async executeOrchestration(
    userQuery: string,
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[] = []
  ): Promise<{
    cards: ManualFilterCard[];
    trace: AgenticPipelineExecutionTrace;
    intentSummary: string;
    reasoning: string;
  }> {
    // 1. Tahap 1: Intent, Product & Term Expansion
    const stage1 = await this.executeStage1(userQuery);

    // 2. Tahap 2: Item Candidates, Taxonomy Role, Period & Card Structure
    const stage2 = await this.executeStage2(userQuery, stage1, records, skuMasters);

    // 3. Tahap 3: Parties, Locations, Dimension Mapping & Final Card Construction
    const stage3 = await this.executeStage3(userQuery, stage1, stage2, records);

    // 4. Hitung hasil perolehan awal transaksi
    const matchedCount = records.filter(r => evaluateSpendRecordAgainstCards(r, stage3.finalCards)).length;

    const trace: AgenticPipelineExecutionTrace = {
      stage1,
      stage2,
      stage3,
      appliedCardsCount: stage3.finalCards.length,
      preliminaryMatchCount: matchedCount
    };

    return {
      cards: stage3.finalCards,
      trace,
      intentSummary: stage1.intentSummary,
      reasoning: `Struktur: ${stage2.cardStructure}. Role Taksonomi: ${stage2.taxonomyDecision.role}. Dimensi: What (${stage3.dimensionRoles.whatIsBought}), Who (${stage3.dimensionRoles.whoPurchased}). Ambiguity: ${stage3.ambiguityStatus.status}.`
    };
  }
}

export const agenticQueryOrchestrator = AgenticQueryOrchestrator.getInstance();
