import { 
  DepartmentMasterRecord, 
  RawDepartmentDiscoveryItem, 
  SpendRecord, 
  PurchaseRequisitionRecord, 
  UserDepartmentMappingRecord 
} from '../../../core/types/spend';

/**
 * Standard Canonical Departments for Siloam Hospitals Group
 * Built for enterprise clarity, AI Copilot reference matching, and transaction aggregation.
 */
export function generateSampleDepartmentMasters(): DepartmentMasterRecord[] {
  return [
    {
      id: 'dept-fo',
      departmentCode: 'FO',
      cleanDepartmentName: 'Front Office',
      divisionCategory: 'Frontlines, Hospitality & Customer Care',
      rawAliases: [
        'front office',
        'fo',
        'admission',
        'admisi',
        'customer care',
        'reception',
        'receptionist',
        'front desk',
        'pendaftaran',
        'customer service'
      ],
      costCenters: ['1035', '1036'],
      assignedHospitalCodes: ['ALL'],
      description: 'Layanan terdepan registrasi pasien, admisi rawat inap/jalan, resepsionis, dan customer care rumah sakit.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['nadia.frontoffice'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-fms-ga',
      departmentCode: 'FMS-GA',
      cleanDepartmentName: 'Facility Management Service & General Affair (FMS - GA)',
      divisionCategory: 'General Affairs, Facilities & Operational',
      rawAliases: [
        'facility management service & general affair (fms - ga)',
        'facility management service & general affair',
        'fms ga',
        'fms - ga',
        'fms',
        'facility management',
        'facility management services',
        'general affairs & facilities',
        'general affairs',
        'ga',
        'fasilitas & umum',
        'umum & operasional',
        'umum & operasional (ga)',
        'supporting & facilities',
        'housekeeping & ga'
      ],
      costCenters: ['5000', '1010', '1020'],
      assignedHospitalCodes: ['ALL'],
      description: 'Pengelolaan operasional gedung, fasilitas pendukung, general affairs, pemeliharaan utilitas, dan perbekalan umum.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['bambang.fmsga', 'tri.wahyuni', 'i.wayan.suwena'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-pharm',
      departmentCode: 'PHARM',
      cleanDepartmentName: 'Pharmacy & Therapeutics',
      divisionCategory: 'Diagnostic & Ancillary',
      rawAliases: [
        'pharmacy & therapeutics',
        'pharmacy',
        'farmasi',
        'therapeutics',
        'apotek',
        'instalasi farmasi',
        'gudang farmasi',
        'depo farmasi',
        'farmasi & laboratorium'
      ],
      costCenters: ['1002'],
      assignedHospitalCodes: ['ALL'],
      description: 'Instalasi farmasi rumah sakit, perbekalan obat, BHP medis farmasi, dan manajemen depo rawat inap/jalan.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['apt.maya.pratiwi'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-rad',
      departmentCode: 'RAD',
      cleanDepartmentName: 'Radiology & Diagnostic Imaging',
      divisionCategory: 'Diagnostic & Ancillary',
      rawAliases: [
        'radiology & diagnostic imaging',
        'radiology',
        'radiologi',
        'diagnostic imaging',
        'x-ray unit',
        'mri unit',
        'rontgen',
        'ct scan unit',
        'imaging',
        'radiologi & diagnostic imaging'
      ],
      costCenters: ['1014'],
      assignedHospitalCodes: ['ALL'],
      description: 'Instalasi radiologi dan diagnostik pencitraan (X-Ray, MRI, CT-Scan, USG, C-Arm, Mammografi).',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['agus.hermawan'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-icu',
      departmentCode: 'ICU',
      cleanDepartmentName: 'Medical Services & ICU',
      divisionCategory: 'Clinical Inpatient & Critical Care',
      rawAliases: [
        'medical services & icu',
        'medical services',
        'icu',
        'critical care',
        'rawat intensif',
        'intensive care unit',
        'hcu',
        'picu',
        'nicu',
        'critical care & anaesthesia'
      ],
      costCenters: ['1001', '1025'],
      assignedHospitalCodes: ['ALL'],
      description: 'Pelayanan medis rawat intensif (ICU/HCU/PICU/NICU) dan peralatan pendukung kehidupan pasien kritis.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['dr.hendra.setiawan', 'muhammad.hasan'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-ok',
      departmentCode: 'OK',
      cleanDepartmentName: 'Operating Theatre & Nursing',
      divisionCategory: 'Surgical & Central Sterile',
      rawAliases: [
        'operating theatre & nursing',
        'operating theatre',
        'kamar bedah',
        'kamar operasi',
        'bedah sentral',
        'ok',
        'cssd',
        'nursing surgical',
        'central sterile supply'
      ],
      costCenters: ['1012'],
      assignedHospitalCodes: ['ALL'],
      description: 'Kamar operasi bedah sentral dan unit sterilisasi instrumen bedah (CSSD).',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['siti.aminah'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-lab',
      departmentCode: 'LAB',
      cleanDepartmentName: 'Central Laboratory & Pathology',
      divisionCategory: 'Diagnostic & Ancillary',
      rawAliases: [
        'central laboratory & pathology',
        'laboratory',
        'laboratorium',
        'pathology',
        'patologi klinik',
        'lab sentral',
        'analis kesehatan',
        'lab',
        'bank darah'
      ],
      costCenters: ['1018'],
      assignedHospitalCodes: ['ALL'],
      description: 'Laboratorium patologi klinik, analisis hematologi, kimia darah, reagensia diagnostik, dan bank darah.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['kartika.dewi'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-it',
      departmentCode: 'IT-BIOMED',
      cleanDepartmentName: 'IT & Biomedical Engineering',
      divisionCategory: 'Information Technology & Engineering',
      rawAliases: [
        'it & biomedical engineering',
        'it',
        'biomedical',
        'teknologi informasi',
        'edp',
        'biomedis',
        'teknik biomedika',
        'sistem informasi',
        'ict'
      ],
      costCenters: ['1005'],
      assignedHospitalCodes: ['ALL'],
      description: 'Departemen teknologi informasi, infrastruktur jaringan, hardware/software ERP, dan pemeliharaan alat elektromedik biomedik.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['budi.santoso'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-igd',
      departmentCode: 'IGD',
      cleanDepartmentName: 'Emergency & Trauma Center',
      divisionCategory: 'Emergency & Acute Care',
      rawAliases: [
        'emergency & trauma center',
        'emergency',
        'trauma center',
        'igd',
        'ugd',
        'instalasi gawat darurat',
        'emergency department',
        'gawat darurat'
      ],
      costCenters: ['1028'],
      assignedHospitalCodes: ['ALL'],
      description: 'Instalasi gawat darurat (IGD), trauma center 24 jam, ambulans gawat darurat, dan penanganan akut.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['dr.dedy.kurniawan'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-cgp',
      departmentCode: 'PROC',
      cleanDepartmentName: 'Group Procurement (CGP)',
      divisionCategory: 'Supply Chain & Procurement',
      rawAliases: [
        'group procurement (cgp)',
        'group procurement',
        'cgp',
        'procurement',
        'pengadaan',
        'purchasing',
        'logistik pusat',
        'supply chain'
      ],
      costCenters: ['0015'],
      assignedHospitalCodes: ['0000', 'ALL'],
      description: 'Divisi pengadaan korporat Siloam Head Office (Corporate Group Procurement) untuk kontrak strategis dan tender nasional.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['florencia.elnidwya'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-legal',
      departmentCode: 'LEGAL',
      cleanDepartmentName: 'Legal & Corporate Governance',
      divisionCategory: 'Corporate & Governance',
      rawAliases: [
        'legal & corporate governance',
        'legal',
        'corporate governance',
        'hukum',
        'compliance',
        'legal counsel'
      ],
      costCenters: ['0003'],
      assignedHospitalCodes: ['0000', 'ALL'],
      description: 'Divisi hukum korporat, kepatuhan regulasi kesehatan, lisensi rumah sakit, dan perikatan kontrak hukum.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['carren.mokalu'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-strat',
      departmentCode: 'STRAT',
      cleanDepartmentName: 'Strategy & Commercial',
      divisionCategory: 'Corporate & Commercial Strategy',
      rawAliases: [
        'strategy & commercial',
        'strategy & commercial (digital)',
        'commercial',
        'strategic',
        'digital business',
        'bisnis komersial'
      ],
      costCenters: ['0013'],
      assignedHospitalCodes: ['0000', 'ALL'],
      description: 'Pengembangan strategi komersial, kemitraan korporat asuransi, dan inisiatif transformasi digital bisnis Siloam.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['angelina.wijaya', 'digitalbusiness'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-onco',
      departmentCode: 'ONCO',
      cleanDepartmentName: 'Oncology Division',
      divisionCategory: 'Specialized Clinical Center',
      rawAliases: [
        'oncology division',
        'oncology',
        'onkologi',
        'radioterapi',
        'cancer center',
        'kemoterapi'
      ],
      costCenters: ['1008'],
      assignedHospitalCodes: ['0003', 'ALL'],
      description: 'Pusat perawatan kanker komprehensif, radioterapi, kemoterapi, dan onkologi terpadu (khususnya MRCCC Semanggi).',
      isActive: true,
      isAiReference: true,
      sampleRequesters: ['dr.rachel.ong'],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-ranap',
      departmentCode: 'RANAP',
      cleanDepartmentName: 'Inpatient Nursing Care (Rawat Inap)',
      divisionCategory: 'Clinical Inpatient & Critical Care',
      rawAliases: [
        'rawat inap',
        'inpatient',
        'ranap',
        'bangsal',
        'ruang perawatan',
        'nursing inpatient',
        'rawat inap & poliklinik'
      ],
      costCenters: ['1003'],
      assignedHospitalCodes: ['ALL'],
      description: 'Pelayanan keperawatan rawat inap, bangsal pasien, dan perlengkapan asuhan keperawatan harian.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: [],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-rajal',
      departmentCode: 'RAJAL',
      cleanDepartmentName: 'Outpatient Clinics (Rawat Jalan)',
      divisionCategory: 'Outpatient & Ambulatory Care',
      rawAliases: [
        'rawat jalan',
        'outpatient',
        'rajal',
        'poliklinik',
        'poli spesialis',
        'ambulatory care',
        'klinik spesialis'
      ],
      costCenters: ['1004'],
      assignedHospitalCodes: ['ALL'],
      description: 'Klinik rawat jalan, ruang konsultasi dokter spesialis, dan poli poliklinik terpadu.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: [],
      updatedAt: '2026-10-01T00:00:00Z'
    },
    {
      id: 'dept-fin',
      departmentCode: 'FIN',
      cleanDepartmentName: 'Finance, Accounting & Billing',
      divisionCategory: 'Finance & Accounting',
      rawAliases: [
        'finance',
        'accounting',
        'keuangan',
        'akuntansi',
        'kasir',
        'billing',
        'administrasi & kasir (billing)',
        'piutang'
      ],
      costCenters: ['0020', '1030'],
      assignedHospitalCodes: ['ALL'],
      description: 'Pengelolaan keuangan rumah sakit, verifikasi klaim asuransi, billing kasir rawat inap/jalan, dan akuntansi pengeluaran.',
      isActive: true,
      isAiReference: true,
      sampleRequesters: [],
      updatedAt: '2026-10-01T00:00:00Z'
    }
  ];
}

/**
 * Normalizes string for department comparison
 */
export function normalizeDepartmentText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[()&/,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Standardizes a raw department name into a clean, professional canonical name
 */
export function formatCleanDepartmentName(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'General Administration';

  if (/\bfront\s*office\b/i.test(trimmed)) return 'Front Office';
  if (/\b(fms|facility\s+management|general\s+affair)/i.test(trimmed)) return 'Facility Management Service & General Affair (FMS - GA)';
  if (/\b(pharmacy|farmasi|apotek)\b/i.test(trimmed)) return 'Pharmacy & Therapeutics';
  if (/\b(radiology|radiologi|imaging)\b/i.test(trimmed)) return 'Radiology & Diagnostic Imaging';
  if (/\b(icu|critical\s*care)\b/i.test(trimmed)) return 'Medical Services & ICU';
  if (/\b(operating\s*theatre|kamar\s*bedah|ok\b|cssd)/i.test(trimmed)) return 'Operating Theatre & Nursing';
  if (/\b(laboratory|laboratorium|patologi|pathology)\b/i.test(trimmed)) return 'Central Laboratory & Pathology';
  if (/\b(it\b|ict\b|biomedical|teknologi\s*informasi)/i.test(trimmed)) return 'IT & Biomedical Engineering';
  if (/\b(emergency|igd\b|ugd\b|trauma)/i.test(trimmed)) return 'Emergency & Trauma Center';
  if (/\b(procurement|cgp|pengadaan|purchasing)/i.test(trimmed)) return 'Group Procurement (CGP)';
  if (/\b(legal|hukum|governance)/i.test(trimmed)) return 'Legal & Corporate Governance';
  if (/\b(strategy|commercial|komersial)/i.test(trimmed)) return 'Strategy & Commercial';
  if (/\b(oncology|onkologi|kanker)/i.test(trimmed)) return 'Oncology Division';
  if (/\b(rawat\s*inap|inpatient|ranap)\b/i.test(trimmed)) return 'Inpatient Nursing Care (Rawat Inap)';
  if (/\b(rawat\s*jalan|outpatient|rajal|poliklinik)\b/i.test(trimmed)) return 'Outpatient Clinics (Rawat Jalan)';
  if (/\b(finance|accounting|keuangan|akuntansi|billing|kasir)\b/i.test(trimmed)) return 'Finance, Accounting & Billing';

  // Fallback: Capitalize words cleanly
  return trimmed
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Derives a standard ERP code for a clean department name
 */
export function deriveDepartmentCode(cleanName: string): string {
  if (cleanName.includes('Front Office')) return 'FO';
  if (cleanName.includes('Facility Management') || cleanName.includes('FMS')) return 'FMS-GA';
  if (cleanName.includes('Pharmacy') || cleanName.includes('Farmasi')) return 'PHARM';
  if (cleanName.includes('Radiology') || cleanName.includes('Radiologi')) return 'RAD';
  if (cleanName.includes('ICU')) return 'ICU';
  if (cleanName.includes('Operating') || cleanName.includes('Bedah')) return 'OK';
  if (cleanName.includes('Laboratory') || cleanName.includes('Laboratorium')) return 'LAB';
  if (cleanName.includes('IT & Biomedical')) return 'IT-BIOMED';
  if (cleanName.includes('Emergency') || cleanName.includes('IGD')) return 'IGD';
  if (cleanName.includes('Procurement') || cleanName.includes('CGP')) return 'PROC';
  if (cleanName.includes('Legal')) return 'LEGAL';
  if (cleanName.includes('Strategy')) return 'STRAT';
  if (cleanName.includes('Oncology')) return 'ONCO';
  if (cleanName.includes('Rawat Inap')) return 'RANAP';
  if (cleanName.includes('Rawat Jalan')) return 'RAJAL';
  if (cleanName.includes('Finance') || cleanName.includes('Keuangan')) return 'FIN';

  const words = cleanName.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    return words.map(w => w[0].toUpperCase()).slice(0, 4).join('');
  }
  return cleanName.slice(0, 4).toUpperCase();
}

/**
 * Derives a standard division category for a department
 */
export function deriveDivisionCategory(cleanName: string): string {
  const lower = cleanName.toLowerCase();
  if (lower.includes('front') || lower.includes('admisi') || lower.includes('customer')) return 'Frontlines, Hospitality & Customer Care';
  if (lower.includes('facility') || lower.includes('fms') || lower.includes('general affair')) return 'General Affairs, Facilities & Operational';
  if (lower.includes('pharmacy') || lower.includes('farmasi') || lower.includes('radiology') || lower.includes('laboratory')) return 'Diagnostic & Ancillary';
  if (lower.includes('icu') || lower.includes('inpatient') || lower.includes('rawat inap')) return 'Clinical Inpatient & Critical Care';
  if (lower.includes('bedah') || lower.includes('operating') || lower.includes('surgery')) return 'Surgical & Central Sterile';
  if (lower.includes('emergency') || lower.includes('igd')) return 'Emergency & Acute Care';
  if (lower.includes('it') || lower.includes('biomedical') || lower.includes('teknologi')) return 'Information Technology & Engineering';
  if (lower.includes('procurement') || lower.includes('pengadaan') || lower.includes('supply')) return 'Supply Chain & Procurement';
  if (lower.includes('legal') || lower.includes('hukum') || lower.includes('governance')) return 'Corporate & Governance';
  if (lower.includes('strategy') || lower.includes('commercial')) return 'Corporate & Commercial Strategy';
  if (lower.includes('finance') || lower.includes('keuangan') || lower.includes('accounting') || lower.includes('billing')) return 'Finance & Accounting';
  return 'General Operations & Administration';
}

/**
 * Finds matching department master record from raw string
 */
export function findMatchingDepartment(
  rawDept: string, 
  masters: DepartmentMasterRecord[]
): { department: DepartmentMasterRecord; confidence: number } | null {
  if (!rawDept) return null;
  const rawNorm = normalizeDepartmentText(rawDept);
  if (!rawNorm) return null;

  // 1. Exact match on clean name or code
  for (const m of masters) {
    if (normalizeDepartmentText(m.cleanDepartmentName) === rawNorm || m.departmentCode.toLowerCase() === rawNorm) {
      return { department: m, confidence: 1.0 };
    }
  }

  // 2. Exact match on one of the aliases
  for (const m of masters) {
    for (const alias of m.rawAliases) {
      const aliasNorm = normalizeDepartmentText(alias);
      if (aliasNorm === rawNorm) {
        return { department: m, confidence: 0.95 };
      }
    }
  }

  // 3. Substring / Token inclusion match
  for (const m of masters) {
    for (const alias of m.rawAliases) {
      const aliasNorm = normalizeDepartmentText(alias);
      if (rawNorm.length >= 4 && aliasNorm.length >= 4) {
        if (rawNorm.includes(aliasNorm) || aliasNorm.includes(rawNorm)) {
          return { department: m, confidence: 0.85 };
        }
      }
    }
  }

  return null;
}

/**
 * Scans uploaded records, PRs, and user mappings to discover departments,
 * aggregate live stats (transaction count, spend, requesters, hospitals),
 * and detect new unmapped departments.
 *
 * CRITICAL RULE: Derives departments and requesters strictly from uploaded PR & CPR files.
 * NEVER fabricates fake seed departments with 0 transactions.
 */
export function discoverDepartmentsFromRecords(
  records: SpendRecord[] = [],
  prs: PurchaseRequisitionRecord[] = [],
  userMappings: UserDepartmentMappingRecord[] = [],
  existingMasters: DepartmentMasterRecord[] = []
): {
  updatedMasters: DepartmentMasterRecord[];
  unmappedItems: RawDepartmentDiscoveryItem[];
} {
  // If we already have stored masters in IndexedDB, use them as baseline to preserve custom aliases/edits
  // Otherwise, construct clean masters directly from the unique departments discovered in the uploaded PR/CPR records!
  const hasUploadedData = records.length > 0 || prs.length > 0;
  
  // Step 1: Collect all distinct raw department strings and their metrics strictly from the uploaded data
  const rawOccurrences = new Map<string, { 
    count: number; 
    spend: number; 
    source: 'SPEND_UPLOAD' | 'PR_UPLOAD' | 'USER_DIRECTORY';
    costCenters: Set<string>;
    requesters: Set<string>;
    hospitals: Set<string>;
  }>();

  // Ingest from SpendRecords (CPR / PO transactions)
  for (const r of records) {
    const raw = (r.department || '').trim();
    const spend = r.totalLineAmount || 0;
    const hosp = (r.hospitalCode || '').trim();
    const req = (r.requester || r.requesterName || '').trim();
    const cc = (r.costCenter || '').trim();

    if (raw) {
      if (!rawOccurrences.has(raw)) {
        rawOccurrences.set(raw, { 
          count: 0, 
          spend: 0, 
          source: 'SPEND_UPLOAD',
          costCenters: new Set(),
          requesters: new Set(),
          hospitals: new Set()
        });
      }
      const cur = rawOccurrences.get(raw)!;
      cur.count += 1;
      cur.spend += spend;
      if (cc) cur.costCenters.add(cc);
      if (req) cur.requesters.add(req);
      if (hosp) cur.hospitals.add(hosp);
    }
  }

  // Ingest from PR Records (uploaded PR files)
  for (const p of prs) {
    const raw = (p.description || '').trim();
    const spend = p.totalAmount || 0;
    const req = (p.requester || '').trim();
    const unit = (p.unit || '').trim();
    const cc = (p.costCenter || '').trim();

    if (raw) {
      if (!rawOccurrences.has(raw)) {
        rawOccurrences.set(raw, { 
          count: 1, 
          spend, 
          source: 'PR_UPLOAD',
          costCenters: new Set(),
          requesters: new Set(),
          hospitals: new Set()
        });
      }
      const cur = rawOccurrences.get(raw)!;
      if (cc) cur.costCenters.add(cc);
      if (req) cur.requesters.add(req);
      if (unit) cur.hospitals.add(unit);
    }
  }

  // Ingest from User Mappings (harvested from uploaded PR files)
  for (const u of userMappings) {
    const raw = (u.department || '').trim();
    const username = (u.username || u.fullName || '').trim();
    const hosp = (u.hospitalName || u.hospitalUnitCode || '').trim();
    const cc = (u.costCenter || '').trim();

    if (raw) {
      if (!rawOccurrences.has(raw)) {
        rawOccurrences.set(raw, { 
          count: 0, 
          spend: 0, 
          source: 'USER_DIRECTORY',
          costCenters: new Set(),
          requesters: new Set(),
          hospitals: new Set()
        });
      }
      const cur = rawOccurrences.get(raw)!;
      if (cc) cur.costCenters.add(cc);
      if (username) cur.requesters.add(username);
      if (hosp) cur.hospitals.add(hosp);
    }
  }

  // Step 2: Establish Master Departments
  let masters: DepartmentMasterRecord[];

  if (existingMasters && existingMasters.length > 0) {
    // Preserve existing master configurations (user custom aliases, descriptions)
    masters = [...existingMasters];
  } else if (hasUploadedData) {
    // Dynamically build masters strictly from the unique departments discovered in uploaded files!
    const groupedDepts = new Map<string, {
      canonicalName: string;
      code: string;
      division: string;
      rawAliases: Set<string>;
      costCenters: Set<string>;
      requesters: Set<string>;
      hospitals: Set<string>;
      count: number;
      spend: number;
    }>();

    for (const [rawName, meta] of rawOccurrences.entries()) {
      const canonical = formatCleanDepartmentName(rawName);
      const code = deriveDepartmentCode(canonical);
      const division = deriveDivisionCategory(canonical);

      if (!groupedDepts.has(canonical)) {
        groupedDepts.set(canonical, {
          canonicalName: canonical,
          code,
          division,
          rawAliases: new Set([rawName.toLowerCase(), canonical.toLowerCase()]),
          costCenters: new Set(meta.costCenters),
          requesters: new Set(meta.requesters),
          hospitals: new Set(meta.hospitals),
          count: meta.count,
          spend: meta.spend
        });
      } else {
        const cur = groupedDepts.get(canonical)!;
        cur.rawAliases.add(rawName.toLowerCase());
        meta.costCenters.forEach(c => cur.costCenters.add(c));
        meta.requesters.forEach(r => cur.requesters.add(r));
        meta.hospitals.forEach(h => cur.hospitals.add(h));
        cur.count += meta.count;
        cur.spend += meta.spend;
      }
    }

    masters = Array.from(groupedDepts.values()).map(g => ({
      id: `dept-${g.code.toLowerCase().replace(/[^a-z0-9]/g, '-') || Date.now()}`,
      departmentCode: g.code,
      cleanDepartmentName: g.canonicalName,
      divisionCategory: g.division,
      rawAliases: Array.from(g.rawAliases),
      costCenters: Array.from(g.costCenters),
      assignedHospitalCodes: Array.from(g.hospitals).length > 0 ? Array.from(g.hospitals) : ['ALL'],
      description: `Departemen ${g.canonicalName} yang teridentifikasi dari file PR / CPR yang diupload.`,
      isActive: true,
      isAiReference: true,
      transactionCount: g.count,
      totalSpend: g.spend,
      requesterCount: g.requesters.size,
      sampleRequesters: Array.from(g.requesters).slice(0, 10),
      sampleHospitals: Array.from(g.hospitals).slice(0, 10),
      updatedAt: new Date().toISOString()
    }));
  } else {
    // Zero data uploaded yet: use standard empty state
    masters = [];
  }

  // Step 3: Recalculate metrics per master from the actual records
  const updatedMasters: DepartmentMasterRecord[] = masters.map(m => {
    let txCount = 0;
    let totalSpend = 0;
    const reqSet = new Set<string>();
    const hospSet = new Set<string>();
    const ccSet = new Set<string>(m.costCenters || []);

    // Match raw occurrences to this master
    for (const [rawName, meta] of rawOccurrences.entries()) {
      const match = findMatchingDepartment(rawName, [m]);
      if (match && match.confidence >= 0.8) {
        txCount += meta.count;
        totalSpend += meta.spend;
        meta.requesters.forEach(r => reqSet.add(r));
        meta.hospitals.forEach(h => hospSet.add(h));
        meta.costCenters.forEach(c => ccSet.add(c));
      }
    }

    const sampleReqs = m.sampleRequesters || [];
    const combinedReqs = Array.from(new Set([...sampleReqs, ...Array.from(reqSet)])).filter(Boolean);

    return {
      ...m,
      transactionCount: txCount || m.transactionCount || 0,
      totalSpend: totalSpend || m.totalSpend || 0,
      costCenters: Array.from(ccSet),
      requesterCount: combinedReqs.length,
      sampleRequesters: combinedReqs.slice(0, 10),
      sampleHospitals: Array.from(hospSet).slice(0, 12)
    };
  });

  // Step 4: Identify any raw strings from upload that are still unmapped
  const unmappedItems: RawDepartmentDiscoveryItem[] = [];

  for (const [rawName, meta] of rawOccurrences.entries()) {
    const match = findMatchingDepartment(rawName, updatedMasters);
    if (!match || match.confidence < 0.8) {
      unmappedItems.push({
        rawName,
        source: meta.source,
        occurrences: meta.count,
        totalSpend: meta.spend,
        isMapped: false,
        matchConfidence: match ? match.confidence : 0,
        matchedCleanName: match ? match.department.cleanDepartmentName : undefined,
        matchedDepartmentId: match ? match.department.id : undefined,
        suggestedAliases: [normalizeDepartmentText(rawName)]
      });
    }
  }

  return {
    updatedMasters,
    unmappedItems
  };
}
