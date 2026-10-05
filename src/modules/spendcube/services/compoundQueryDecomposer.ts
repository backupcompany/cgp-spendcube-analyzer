import { ManualFilterCard } from '../../../core/types/spend';

export interface ClauseDecomposition {
  rawClauseText: string;
  topic: string;
  primaryProduct: string;
  commodityIncludes: string[];
  commodityExcludes: string[];
  l1Taxonomy?: string[];
  l2Taxonomy?: string[];
  l3Taxonomy?: string[];
  hospitalCodes: string[];
  isAllHospitals: boolean;
  hospitalIslands: string[];
  months: string[];
  departments: string[];
  targetVendors: string[];
  intentType: 'VENDOR_RANKING' | 'DEPARTMENT_BREAKDOWN' | 'PRICE_BENCHMARK' | 'SPEND_TOTAL' | 'GENERAL_SEARCH';
}

export interface CompoundDecompositionResult {
  isCompound: boolean;
  conjunctionFound?: string;
  clauses: ClauseDecomposition[];
  suggestedCards: ManualFilterCard[];
  summaryIntent: string;
}

/**
 * Universal Multi-Month & Quarter Extractor
 * Supports Q1, Q2, Q3, Q4, Semester, and individual months.
 */
export function extractTargetMonthsDetailed(text: string): { months: string[]; tokens: string[] } {
  const q = (text || '').toLowerCase();
  const months: string[] = [];
  const tokens: string[] = [];

  // Individual months
  if (/\b(januari|jan|january)\b/i.test(q) || q.includes('2026-01') || q.includes('202601')) {
    months.push('2026-01');
    tokens.push('2026-01', '01', 'Januari', 'Jan');
  }
  if (/\b(februari|feb|february)\b/i.test(q) || q.includes('2026-02') || q.includes('202602')) {
    months.push('2026-02');
    tokens.push('2026-02', '02', 'Februari', 'Feb');
  }
  if (/\b(maret|mar|march)\b/i.test(q) || q.includes('2026-03') || q.includes('202603')) {
    months.push('2026-03');
    tokens.push('2026-03', '03', 'Maret', 'Mar');
  }
  if (/\b(april|apr)\b/i.test(q) || q.includes('2026-04') || q.includes('202604')) {
    months.push('2026-04');
    tokens.push('2026-04', '04', 'April', 'Apr');
  }
  if (/\b(mei|may)\b/i.test(q) || q.includes('2026-05') || q.includes('202605')) {
    months.push('2026-05');
    tokens.push('2026-05', '05', 'Mei', 'May');
  }
  if (/\b(juni|jun|june)\b/i.test(q) || q.includes('2026-06') || q.includes('202606')) {
    months.push('2026-06');
    tokens.push('2026-06', '06', 'Juni', 'Jun');
  }
  if (/\b(juli|jul|july)\b/i.test(q) || q.includes('2026-07') || q.includes('202607')) {
    months.push('2026-07');
    tokens.push('2026-07', '07', 'Juli', 'Jul');
  }
  if (/\b(agustus|ags|aug|august)\b/i.test(q) || q.includes('2026-08') || q.includes('202608')) {
    months.push('2026-08');
    tokens.push('2026-08', '08', 'Agustus', 'Ags', 'Aug');
  }
  if (/\b(september|sep)\b/i.test(q) || q.includes('2026-09') || q.includes('202609')) {
    months.push('2026-09');
    tokens.push('2026-09', '09', 'September', 'Sep');
  }
  if (/\b(oktober|okt|oct|october)\b/i.test(q) || q.includes('2026-10') || q.includes('202610')) {
    months.push('2026-10');
    tokens.push('2026-10', '10', 'Oktober', 'Okt');
  }
  if (/\b(november|nov)\b/i.test(q) || q.includes('2026-11') || q.includes('202611')) {
    months.push('2026-11');
    tokens.push('2026-11', '11', 'November', 'Nov');
  }
  if (/\b(desember|des|dec|december)\b/i.test(q) || q.includes('2026-12') || q.includes('202612')) {
    months.push('2026-12');
    tokens.push('2026-12', '12', 'Desember', 'Des');
  }

  // Quarters
  if (/\b(q1|kuartal 1|triwulan 1)\b/i.test(q)) {
    ['2026-01', '2026-02', '2026-03'].forEach(m => { if (!months.includes(m)) months.push(m); });
    ['2026-01', '2026-02', '2026-03', '01', '02', '03', 'Januari', 'Februari', 'Maret', 'Q1'].forEach(t => { if (!tokens.includes(t)) tokens.push(t); });
  }
  if (/\b(q2|kuartal 2|triwulan 2)\b/i.test(q)) {
    ['2026-04', '2026-05', '2026-06'].forEach(m => { if (!months.includes(m)) months.push(m); });
    ['2026-04', '2026-05', '2026-06', '04', '05', '06', 'April', 'Mei', 'Juni', 'Q2'].forEach(t => { if (!tokens.includes(t)) tokens.push(t); });
  }
  if (/\b(q3|kuartal 3|triwulan 3)\b/i.test(q)) {
    ['2026-07', '2026-08', '2026-09'].forEach(m => { if (!months.includes(m)) months.push(m); });
    ['2026-07', '2026-08', '2026-09', '07', '08', '09', 'Juli', 'Agustus', 'September', 'Q3'].forEach(t => { if (!tokens.includes(t)) tokens.push(t); });
  }
  if (/\b(q4|kuartal 4|triwulan 4)\b/i.test(q)) {
    ['2026-10', '2026-11', '2026-12'].forEach(m => { if (!months.includes(m)) months.push(m); });
    ['2026-10', '2026-11', '2026-12', '10', '11', '12', 'Oktober', 'November', 'Desember', 'Q4'].forEach(t => { if (!tokens.includes(t)) tokens.push(t); });
  }

  // Semesters
  if (/\b(semester 1|s1|h1)\b/i.test(q)) {
    ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].forEach(m => { if (!months.includes(m)) months.push(m); });
  }
  if (/\b(semester 2|s2|h2)\b/i.test(q)) {
    ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].forEach(m => { if (!months.includes(m)) months.push(m); });
  }

  if (months.length === 0 && q.includes('2026')) {
    tokens.push('2026');
  }

  return { months, tokens };
}

/**
 * Intelligent Extraction of Salient Commodity Keywords for a Single Clause
 */
export function extractClauseCommodity(clauseText: string): { 
  primaryProduct: string; 
  includes: string[]; 
  excludes: string[]; 
  l1Taxonomy?: string[]; 
  l2Taxonomy?: string[]; 
  l3Taxonomy?: string[]; 
} {
  const q = clauseText.toLowerCase();

  // 1. Radiology / High-Tech Medical
  if (/\bmri\b|magnetic resonance/i.test(q)) {
    return {
      primaryProduct: 'MRI',
      includes: ['mri', 'magnetic resonance', 'mri cooling', 'chiller hose', 'mri coil', 'mri system'],
      excludes: []
    };
  }

  if (/\b(xray|x-ray|rontgen|radiologi|c-arm|fluoroscopy)\b/i.test(q)) {
    return {
      primaryProduct: 'X-Ray',
      includes: ['xray', 'x-ray', 'rontgen', 'radiologi', 'c-arm', 'radiography', 'detector'],
      excludes: []
    };
  }

  if (/\b(ct scan|ct-scan|computed tomography)\b/i.test(q)) {
    return {
      primaryProduct: 'CT Scan',
      includes: ['ct scan', 'ct-scan', 'computed tomography', 'somatom'],
      excludes: []
    };
  }

  if (/\b(usg|ultrasound|echocardiography)\b/i.test(q)) {
    return {
      primaryProduct: 'USG / Ultrasound',
      includes: ['usg', 'ultrasound', 'echocardiography', 'transducer', 'probe'],
      excludes: []
    };
  }

  if (/\b(infusion pump|syringe pump|infus pump)\b/i.test(q)) {
    return {
      primaryProduct: 'Infusion Pump',
      includes: ['infusion pump', 'syringe pump', 'pump single channel', 'touch screen'],
      excludes: []
    };
  }

  // 1b. Macro Medical Equipment Query (Taxonomy-Aware: Include is empty, anchored on L2 & L1)
  if (/\b(medical equipment|alat kesehatan|peralatan medis|biomedical|alkes)\b/i.test(q) && !/\b(spuit|syringe|jarum|sarung tangan|masker)\b/i.test(q)) {
    return {
      primaryProduct: 'Medical Equipment',
      includes: [],
      excludes: [],
      l1Taxonomy: ['DIAGNOSTIC AND MEDICAL DEVICES', 'Diagnostic and Medical Devices', 'MEDICAL DEVICES', 'MEDICAL EQUIPMENT'],
      l2Taxonomy: ['MEDICAL EQUIPMENT', 'Medical Equipment Maintenance', 'Medical Equipment', 'DIAGNOSTIC AND MEDICAL DEVICES', 'ALAT KESEHATAN', 'Medical Devices', 'Biomedical Equipment']
    };
  }

  // 1c. Level 3 Taxonomy Query: Imaging & Radiology
  if (/\b(imaging & radiology|radiologi & diagnostic|peralatan radiologi)\b/i.test(q)) {
    return {
      primaryProduct: 'Imaging & Radiology',
      includes: [],
      excludes: [],
      l1Taxonomy: ['DIAGNOSTIC AND MEDICAL DEVICES'],
      l2Taxonomy: ['MEDICAL EQUIPMENT'],
      l3Taxonomy: ['IMAGING & RADIOLOGY', 'Imaging & Radiology']
    };
  }

  // 2. Negative Paper & ATK Focus: "bukan berupa kertas", "bukan kertas", "hanya atk saja", "non-kertas"
  const isNegativePaper = /bukan\s+(?:berupa\s+)?kertas|tanpa\s+kertas|selain\s+kertas|exclude\s+kertas|non[\s-]kertas/i.test(q);
  const isAtkFocus = /atk|alat\s+tulis|peralatan\s+kantor|office\s+supplies|stationery/i.test(q);

  if (isNegativePaper || (isAtkFocus && /bukan|non|exclude|tanpa/i.test(q))) {
    return {
      primaryProduct: 'Peralatan Kantor / ATK (Non-Kertas)',
      // Taxonomy-Aware Resolution: L5 contain MUST be empty ([]) so that all items in L2 (Stapler, Spidol, Gunting, dll) match without false negatives!
      includes: [],
      excludes: ['kertas', 'paper', 'hvs', 'continuous form', 'formulir', 'resep', 'thermal roll', 'kartu', 'kraft', 'roll', 'ncr', 'amplop'],
      l1Taxonomy: ['GENERAL SUPPLIES', 'PROJECT OFFICE EQUIPMENT', 'General Supplies', 'Project Office Equipment', 'Office Equipment'],
      l2Taxonomy: ['OFFICE SUPPLIES & ATK', 'OFFICE EQUIPMENT', 'STATIONERY', 'Office Supplies & ATK', 'Office Equipment', 'Stationery']
    };
  }

  // 3. Paper & Form (Zero False Positive Mode for Pure Paper Queries)
  if (/\b(kertas|paper|hvs|continuous form|formulir|amplop)\b/i.test(q)) {
    return {
      primaryProduct: 'Kertas & Form',
      includes: ['kertas', 'paper', 'hvs', 'continuous form', 'formulir', 'amplop', 'kertas thermal', 'resep dokter', 'blanko'],
      excludes: ['cup', 'paper cup', 'paper bag', 'tissue', 'box', 'towel', 'lakmus', 'waste'],
      l1Taxonomy: ['GENERAL SUPPLIES', 'General Supplies'],
      l2Taxonomy: ['OFFICE SUPPLIES & ATK', 'PRINTING & FORMS', 'General Supplies']
    };
  }

  // 4. IT & Hardware
  if (/\b(laptop|notebook|pc|komputer|intel|thinkpad)\b/i.test(q)) {
    return {
      primaryProduct: 'Laptop & Komputer',
      includes: ['laptop', 'notebook', 'pc', 'komputer', 'intel ultra', 'thinkpad', 'ssd'],
      excludes: [],
      l1Taxonomy: ['INFORMATION TECHNOLOGY', 'IT Equipment'],
      l2Taxonomy: ['HARDWARE & COMPUTING', 'IT Hardware']
    };
  }

  // 5. Medical Consumables
  if (/\b(glove|sarung tangan|latex|nitrile)\b/i.test(q)) {
    return {
      primaryProduct: 'Surgical Gloves',
      includes: ['surgical glove', 'powder-free', 'glove', 'latex', 'nitrile'],
      excludes: [],
      l1Taxonomy: ['PHARMACEUTICAL & CONSUMABLES', 'Medical Consumables'],
      l2Taxonomy: ['PERSONAL PROTECTIVE EQUIPMENT', 'Medical Consumables']
    };
  }

  if (/\b(spuit|syringe|jarum|needle)\b/i.test(q)) {
    return {
      primaryProduct: 'Spuit & Jarum',
      includes: ['spuit', 'syringe', 'jarum', 'needle', 'terumo', 'b.braun'],
      excludes: [],
      l1Taxonomy: ['PHARMACEUTICAL & CONSUMABLES', 'Medical Consumables'],
      l2Taxonomy: ['INJECTION & INFUSION', 'Medical Consumables']
    };
  }

  if (/\b(reagen|reagent|biochemistry|panel lab)\b/i.test(q)) {
    return {
      primaryProduct: 'Reagen Laboratorium',
      includes: ['pharmaceutical reagents', 'reagent', 'biochemistry panel', 'reagen'],
      excludes: [],
      l1Taxonomy: ['DIAGNOSTIC AND MEDICAL DEVICES', 'Laboratory Supplies'],
      l2Taxonomy: ['LABORATORY REAGENTS', 'Laboratory Supplies']
    };
  }

  if (/\b(tempat sampah|waste bin|trash bin|shinpo)\b/i.test(q)) {
    return {
      primaryProduct: 'Tempat Sampah Medis',
      includes: ['tempat sampah medis', 'pedal plastik', 'shinpo', 'waste bin'],
      excludes: [],
      l1Taxonomy: ['GENERAL SUPPLIES', 'Project Office Equipment'],
      l2Taxonomy: ['FACILITY & HYGIENE', 'Project Office Equipment']
    };
  }

  if (/\b(general supply|general supplies|perlengkapan umum|kantor)\b/i.test(q)) {
    return {
      primaryProduct: 'General Supplies',
      includes: ['general supplies', 'perlengkapan umum', 'consumables', 'barang kantor'],
      excludes: [],
      l1Taxonomy: ['GENERAL SUPPLIES', 'General Supplies'],
      l2Taxonomy: ['OFFICE SUPPLIES & ATK', 'General Supplies']
    };
  }

  // Dynamic Salient Keyword Extraction (Stopword Removal)
  const stopWords = new Set([
    'siapa', 'vendor', 'penjual', 'terbanyak', 'tertinggi', 'pemenang', 'terbesar', 'di', 
    'seluruh', 'cabang', 'hospital', 'rumah', 'sakit', 'siloam', 'selama', 'pada', 'bulan', 
    'tahun', 'q1', 'q2', 'q3', 'q4', '2026', 'dan', 'atau', 'yang', 'membeli', 'beli', 
    'belanja', 'pengadaan', 'berapa', 'banyak', 'total', 'nilai', 'spend', 'adalah', 
    'apakah', 'ada', 'ke', 'dari', 'unit', 'mana', 'dimana', 'jumlah', 'po', 'peralatan',
    'kantor', 'namun', 'bukan', 'berupa', 'kertas', 'hanya', 'atk', 'saja', 'analisa',
    'pembeliannya', 'department', 'departemen', 'dept', 'front', 'office', 'fms', 'ga',
    'juga', 'serta', 'bagian', 'divisi', 'lihat', 'pada', 'cara', 'ai'
  ]);

  const cleanWords = q.replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (cleanWords.length > 0) {
    const candidate = cleanWords.slice(0, 3).join(' ');
    return {
      primaryProduct: candidate,
      includes: cleanWords.slice(0, 3),
      excludes: []
    };
  }

  return {
    primaryProduct: 'Item Terkait',
    includes: ['medis', 'equipment', 'supplies'],
    excludes: []
  };
}

/**
 * Intelligent Extraction of Master Requester Departments from text
 */
export function extractClauseDepartment(clauseText: string): string[] {
  const q = (clauseText || '').toLowerCase();
  const depts: string[] = [];

  if (/\b(front\s*office|reception|admission)\b/i.test(q)) {
    depts.push('Front Office');
  }
  if (/\b(fms|general\s+affair|general\s+affairs|ga\b|facility\s+management|fasilitas)/i.test(q)) {
    depts.push('Facility Management Service & General Affair (FMS - GA)', 'FMS - GA', 'General Affairs & Facilities', 'Umum & Operasional (GA)');
  }
  if (/\b(rawat\s*inap|poliklinik|poli|inpatient)\b/i.test(q)) {
    depts.push('Rawat Inap & Poliklinik');
  }
  if (/\b(kasir|billing)\b/i.test(q)) {
    depts.push('Administrasi & Kasir (Billing)');
  }
  if (/\b(farmasi|pharmacy|apotek)\b/i.test(q)) {
    depts.push('Farmasi & Laboratorium', 'Pharmacy & Therapeutics');
  }
  if (/\b(radiologi|radiology|imaging)\b/i.test(q)) {
    depts.push('Radiologi & Diagnostic Imaging');
  }
  if (/\b(laboratorium|laboratory|lab|pathology|patologi)\b/i.test(q)) {
    depts.push('Central Laboratory & Pathology');
  }
  if (/\b(icu|critical\s*care)\b/i.test(q)) {
    depts.push('Medical Services & ICU');
  }
  if (/\b(procurement|cgp|pengadaan)\b/i.test(q)) {
    depts.push('Group Procurement (CGP)');
  }
  if (/\b(legal|hukum)\b/i.test(q)) {
    depts.push('Legal & Corporate Governance');
  }
  if (/\b(it|ict|teknologi\s*informasi|biomedical)\b/i.test(q)) {
    depts.push('IT & Biomedical Engineering');
  }

  return Array.from(new Set(depts));
}

/**
 * Intelligent Extraction of Hospital Codes for a Single Clause
 */
export function extractClauseHospital(clauseText: string): { hospitalCodes: string[]; isAllHospitals: boolean } {
  const q = clauseText.toLowerCase();

  // Explicit mention of all branches / nationwide
  if (/seluruh\s+(?:indonesia|cabang|hospital|rs|unit)|semua\s+(?:indonesia|cabang|hospital|rs|unit)|nasional|group|all\s+indonesia/i.test(q)) {
    return { hospitalCodes: [], isAllHospitals: true };
  }

  const codes: string[] = [];
  const knownHospitals = [
    'shlv', 'shkj', 'mrccc', 'shlp', 'shbc', 'shsh', 'shbg', 'shcp', 'shag', 'shas', 
    'shtb', 'shmk', 'shcl', 'rsusw', 'shab', 'shjk', 'shho', 'shbali', 'shmdn', 'shmks', 
    'shbpp', 'shplm'
  ];

  for (const h of knownHospitals) {
    const regex = new RegExp(`\\b${h}\\b`, 'i');
    if (regex.test(q)) {
      codes.push(h.toUpperCase());
    }
  }

  // Alias lookup
  if (/kebon jeruk/i.test(q) && !codes.includes('SHKJ')) codes.push('SHKJ');
  if (/lippo village/i.test(q) && !codes.includes('SHLV')) codes.push('SHLV');
  if (/semanggi/i.test(q) && !codes.includes('MRCCC')) codes.push('MRCCC');
  if (/tb simatupang/i.test(q) && !codes.includes('SHTB')) codes.push('SHTB');

  return { hospitalCodes: codes, isAllHospitals: codes.length === 0 };
}

/**
 * Decomposes a potentially compound query into multi-intent clauses and creates corresponding filter cards.
 */
export function decomposeCompoundQuery(userQuery: string): CompoundDecompositionResult {
  const q = (userQuery || '').trim();

  // Pattern matching compound conjunctions separating two logical questions
  // e.g., "... selama q2 2026 dan siapa penjual xray selama q3 di siloam shkj"
  // e.g., "... sedangkan untuk xray ..."
  // DO NOT match simple lists like "di front office dan juga di fms ga" or "april dan mei"
  const splitRegex = /[,;?]?\s+(?:dan\s+(?:siapa|berapa|apa|manakah|bagaimana|bagaimanakah|dimana|kapan|vendor|supplier|pemasok)|sedangkan|sementara|komparasi(?:kan)?|bandingkan(?:\s+dengan)?)\s+/i;

  let match = q.match(splitRegex);
  let isCompound = Boolean(match && match.index && match.index > 5 && (q.length - match.index) > 5);

  const rawClauses: string[] = [];
  let conjunctionFound: string | undefined = undefined;

  // Check if query is a multi-department comparison (e.g. Front Office vs FMS GA)
  const hasFrontOffice = /\b(front\s*office|reception|admission)\b/i.test(q);
  const hasFmsGa = /\b(fms|general\s+affair|general\s+affairs|ga\b|facility\s+management)/i.test(q);
  const isMultiDeptComparison = hasFrontOffice && hasFmsGa;

  if (isMultiDeptComparison && !isCompound) {
    // Multi-department comparison query
    isCompound = true;
    conjunctionFound = 'dan juga di fms GA';
    const comm = extractClauseCommodity(q);
    const hosp = extractClauseHospital(q);
    const time = extractTargetMonthsDetailed(q);

    const clauseDecompositions: ClauseDecomposition[] = [
      {
        rawClauseText: `${q} (Department: Front Office)`,
        topic: `${comm.primaryProduct} @ Dept Front Office`,
        primaryProduct: comm.primaryProduct,
        commodityIncludes: comm.includes,
        commodityExcludes: comm.excludes,
        l1Taxonomy: comm.l1Taxonomy || ['GENERAL SUPPLIES', 'PROJECT OFFICE EQUIPMENT', 'General Supplies', 'Project Office Equipment', 'Office Equipment'],
        l2Taxonomy: comm.l2Taxonomy || ['OFFICE SUPPLIES & ATK', 'OFFICE EQUIPMENT', 'STATIONERY', 'Office Supplies & ATK', 'Office Equipment', 'Stationery'],
        hospitalCodes: hosp.hospitalCodes,
        isAllHospitals: hosp.isAllHospitals,
        hospitalIslands: /jawa|java/i.test(q) ? ['Jawa'] : [],
        months: time.tokens,
        departments: ['Front Office'],
        targetVendors: [],
        intentType: 'DEPARTMENT_BREAKDOWN'
      },
      {
        rawClauseText: `${q} (Department: FMS GA)`,
        topic: `${comm.primaryProduct} @ Dept FMS GA`,
        primaryProduct: comm.primaryProduct,
        commodityIncludes: comm.includes,
        commodityExcludes: comm.excludes,
        l1Taxonomy: comm.l1Taxonomy || ['GENERAL SUPPLIES', 'PROJECT OFFICE EQUIPMENT', 'General Supplies', 'Project Office Equipment', 'Office Equipment'],
        l2Taxonomy: comm.l2Taxonomy || ['OFFICE SUPPLIES & ATK', 'OFFICE EQUIPMENT', 'STATIONERY', 'Office Supplies & ATK', 'Office Equipment', 'Stationery'],
        hospitalCodes: hosp.hospitalCodes,
        isAllHospitals: hosp.isAllHospitals,
        hospitalIslands: /jawa|java/i.test(q) ? ['Jawa'] : [],
        months: time.tokens,
        departments: ['Facility Management Service & General Affair (FMS - GA)', 'FMS - GA', 'General Affairs & Facilities', 'Umum & Operasional (GA)'],
        targetVendors: [],
        intentType: 'DEPARTMENT_BREAKDOWN'
      }
    ];

    const now = Date.now();
    const suggestedCards: ManualFilterCard[] = clauseDecompositions.map((clause, idx) => {
      return {
        id: `card_compound_${now}_${idx + 1}`,
        ...(clause.l1Taxonomy && clause.l1Taxonomy.length > 0 ? {
          l1_taxonomy: {
            include: clause.l1Taxonomy,
            exclude: []
          }
        } : {}),
        ...(clause.l2Taxonomy && clause.l2Taxonomy.length > 0 ? {
          l2_taxonomy: {
            include: clause.l2Taxonomy,
            exclude: []
          }
        } : {}),
        commodity_l5: {
          include: clause.commodityIncludes,
          exclude: clause.commodityExcludes
        },
        department: {
          include: clause.departments,
          exclude: []
        },
        ...(clause.hospitalCodes.length > 0 ? {
          hospital_code: {
            include: clause.hospitalCodes,
            exclude: []
          }
        } : {}),
        ...(clause.months.length > 0 ? {
          month: {
            include: clause.months,
            exclude: []
          }
        } : {})
      };
    });

    return {
      isCompound: true,
      conjunctionFound,
      clauses: clauseDecompositions,
      suggestedCards,
      summaryIntent: `Analisis Komparasi Pembelian ${comm.primaryProduct} di Departemen Front Office vs FMS GA`
    };
  }

  if (isCompound && match) {
    conjunctionFound = match[0].trim();
    const parts = q.split(splitRegex).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      rawClauses.push(...parts);
    } else {
      rawClauses.push(q);
    }
  } else if (q.includes('?') && q.indexOf('?') < q.length - 3) {
    // Two questions separated by '?'
    const parts = q.split('?').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      isCompound = true;
      conjunctionFound = '?';
      rawClauses.push(...parts);
    } else {
      rawClauses.push(q);
    }
  } else {
    rawClauses.push(q);
  }

  const clauseDecompositions: ClauseDecomposition[] = rawClauses.map((clauseText, idx) => {
    const comm = extractClauseCommodity(clauseText);
    const hosp = extractClauseHospital(clauseText);
    const time = extractTargetMonthsDetailed(clauseText);
    const depts = extractClauseDepartment(clauseText);

    const isDept = depts.length > 0 || /departm|departemen|department|dept|divisi|bagian|unit|requestor|peminta/i.test(clauseText);
    const isVendor = /siapa.*penjual|penjual|vendor|supplier|pemasok/i.test(clauseText);
    const isPrice = /harga|price|mahal|murah|benchmark/i.test(clauseText);

    const intentType: ClauseDecomposition['intentType'] = isDept 
      ? 'DEPARTMENT_BREAKDOWN' 
      : isVendor ? 'VENDOR_RANKING' : isPrice ? 'PRICE_BENCHMARK' : 'SPEND_TOTAL';

    return {
      rawClauseText: clauseText,
      topic: `${comm.primaryProduct} ${hosp.isAllHospitals ? '(Seluruh Cabang)' : `(${hosp.hospitalCodes.join(', ')})`} ${depts.length > 0 ? `[${depts[0]}]` : ''} ${time.months.length > 0 ? time.months.slice(0, 3).join('/') : ''}`.trim(),
      primaryProduct: comm.primaryProduct,
      commodityIncludes: comm.includes,
      commodityExcludes: comm.excludes,
      l1Taxonomy: comm.l1Taxonomy,
      l2Taxonomy: comm.l2Taxonomy,
      hospitalCodes: hosp.hospitalCodes,
      isAllHospitals: hosp.isAllHospitals,
      hospitalIslands: /jawa|java/i.test(clauseText) ? ['Jawa'] : [],
      months: time.tokens,
      departments: depts,
      targetVendors: [],
      intentType
    };
  });

  // Construct ManualFilterCard array (1 card per clause, evaluated with OR logic across cards)
  const now = Date.now();
  const suggestedCards: ManualFilterCard[] = clauseDecompositions.map((clause, idx) => {
    return {
      id: `card_compound_${now}_${idx + 1}`,
      ...(clause.l1Taxonomy && clause.l1Taxonomy.length > 0 ? {
        l1_taxonomy: {
          include: clause.l1Taxonomy,
          exclude: []
        }
      } : {}),
      ...(clause.l2Taxonomy && clause.l2Taxonomy.length > 0 ? {
        l2_taxonomy: {
          include: clause.l2Taxonomy,
          exclude: []
        }
      } : {}),
      ...(clause.l3Taxonomy && clause.l3Taxonomy.length > 0 ? {
        l3_taxonomy: {
          include: clause.l3Taxonomy,
          exclude: []
        }
      } : {}),
      commodity_l5: {
        include: clause.commodityIncludes,
        exclude: clause.commodityExcludes
      },
      ...(clause.hospitalCodes.length > 0 ? {
        hospital_code: {
          include: clause.hospitalCodes,
          exclude: []
        }
      } : {}),
      ...(clause.months.length > 0 ? {
        month: {
          include: clause.months,
          exclude: []
        }
      } : {}),
      ...(clause.departments.length > 0 ? {
        department: {
          include: clause.departments,
          exclude: []
        }
      } : {})
    };
  });

  const summaryIntent = clauseDecompositions.length > 1
    ? `Komparasi 2 Skenario Pengadaan: (1) ${clauseDecompositions[0].topic} dan (2) ${clauseDecompositions[1].topic}`
    : `Analisis pengadaan untuk "${clauseDecompositions[0]?.topic || userQuery}"`;

  return {
    isCompound: clauseDecompositions.length > 1,
    conjunctionFound,
    clauses: clauseDecompositions,
    suggestedCards,
    summaryIntent
  };
}
