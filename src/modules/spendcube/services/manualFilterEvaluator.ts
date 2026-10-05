import { SpendRecord, ManualFilterCard, ManualFilterField } from '../../../core/types/spend';
import { generateSampleHospitalMasters, generateSampleVendorMasters } from './sampleMasterData';
import { generateSampleDepartmentMasters } from './sampleDepartmentData';

// Fast in-memory master lookups for geographical and archetype resolution
const sampleHospitals = generateSampleHospitalMasters();
const sampleVendors = generateSampleVendorMasters();
const sampleDepartments = generateSampleDepartmentMasters();

const deptAliasMap = new Map<string, string[]>();
for (const dm of sampleDepartments) {
  const allTerms = [
    dm.cleanDepartmentName.toLowerCase(),
    dm.departmentCode.toLowerCase(),
    ...(dm.rawAliases || []).map(a => a.toLowerCase()),
    ...(dm.costCenters || [])
  ];
  for (const term of allTerms) {
    deptAliasMap.set(term, allTerms);
  }
}

export function normalizeVendorKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/\b(pt|cv|tbk|ltd|inc|corp|co|ud)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const hospitalIslandMap = new Map<string, string>();
const hospitalTierMap = new Map<string, string>();
for (const h of sampleHospitals) {
  const code = (h.hospitalCode || '').toUpperCase().trim();
  hospitalIslandMap.set(code, `${h.island || ''} ${h.region || ''} ${h.city || ''}`);
  hospitalTierMap.set(code, `${h.tier || ''}`);
}

const vendorCityMap = new Map<string, string>();
const vendorNormalizedMap = new Map<string, string>();
for (const v of sampleVendors) {
  const vName = (v.vendorName || '').toUpperCase().trim();
  const vMeta = `${v.domicileCity || ''} ${v.domicileRegion || ''} ${v.domicileIsland || ''}`;
  vendorCityMap.set(vName, vMeta);
  const normKey = normalizeVendorKey(vName);
  if (normKey) {
    vendorNormalizedMap.set(normKey, vMeta);
  }
}

export interface FilterFieldDefinition {
  key: keyof Omit<ManualFilterCard, 'id'>;
  label: string;
  placeholderInclude: string;
  placeholderExclude: string;
  description: string;
}

export const AVAILABLE_FILTER_FIELDS: FilterFieldDefinition[] = [
  {
    key: 'commodity_remark_product',
    label: 'Item / Product Keyword',
    placeholderInclude: 'e.g. kertas, hvs, syringe, contrast, reagen',
    placeholderExclude: 'e.g. box, waste, tester',
    description: 'Pencarian teks pada deskripsi produk, nama barang, atau remark'
  },
  {
    key: 'commodity_l5',
    label: 'L5 Commodity / Core Product',
    placeholderInclude: 'e.g. Kertas HVS, Spuit, Kateter, Toner',
    placeholderExclude: 'e.g. Cup, Box, Bag, Container',
    description: 'Nama komoditas inti (membedakan jenis barang utama dari wadah/material)'
  },
  {
    key: 'item_specification',
    label: 'Specification & Material',
    placeholderInclude: 'e.g. 80gr, A4, 3cc, Latex-free, Paper',
    placeholderExclude: 'e.g. Recycled, Non-sterile',
    description: 'Spesifikasi teknis, gramatur, ukuran, atau bahan produk'
  },
  {
    key: 'brand_name',
    label: 'Brand / Manufacturer',
    placeholderInclude: 'e.g. PaperOne, Terumo, B.Braun, HP',
    placeholderExclude: 'Exclude brand...',
    description: 'Merek produk atau pabrikan manufaktur'
  },
  {
    key: 'part_number',
    label: 'Part Number / Item ID',
    placeholderInclude: 'e.g. SKU-10023, PR-9921',
    placeholderExclude: 'Exclude ID...',
    description: 'Nomor part number, katalog, atau SKU Item ID'
  },
  {
    key: 'vendor_name',
    label: 'Vendor Name',
    placeholderInclude: 'e.g. Medtronic, Philips, PT Bina Kertas',
    placeholderExclude: 'e.g. Internal, Dummy',
    description: 'Filtering berdasarkan nama pemasok / supplier'
  },
  {
    key: 'vendor_city',
    label: 'Vendor Domicile City',
    placeholderInclude: 'e.g. Jakarta Selatan, Jakarta Barat, Tangerang',
    placeholderExclude: 'Exclude city...',
    description: 'Filtering berdasarkan kota domisili pemasok / vendor'
  },
  {
    key: 'hospital_code',
    label: 'Hospital / Entity',
    placeholderInclude: 'e.g. SHLV, SHLP, SHDP, MRCCC',
    placeholderExclude: 'e.g. HO, HQ',
    description: 'Filtering berdasarkan kode rumah sakit / unit kerja / lokasi'
  },
  {
    key: 'hospital_island',
    label: 'Hospital Island / Region',
    placeholderInclude: 'e.g. Jawa, Sumatera, Bali, Sulawesi, NTT',
    placeholderExclude: 'Exclude island...',
    description: 'Filtering berdasarkan pulau atau wilayah geografis rumah sakit'
  },
  {
    key: 'l1_taxonomy',
    label: 'L1 Taxonomy',
    placeholderInclude: 'e.g. Medical Supplies, IT, Infrastructure',
    placeholderExclude: 'Exclude...',
    description: 'Category Level 1 (Kategori Utama)'
  },
  {
    key: 'l2_taxonomy',
    label: 'L2 Taxonomy',
    placeholderInclude: 'e.g. Consumables, Diagnostic, Equipment',
    placeholderExclude: 'Exclude...',
    description: 'Sub-category Level 2'
  },
  {
    key: 'l3_taxonomy',
    label: 'L3 Taxonomy',
    placeholderInclude: 'e.g. General Consumables, Syringes',
    placeholderExclude: 'Exclude...',
    description: 'Sub-category Level 3'
  },
  {
    key: 'l4_taxonomy',
    label: 'L4 Taxonomy',
    placeholderInclude: 'e.g. Disposable Syringes, Reagents',
    placeholderExclude: 'Exclude...',
    description: 'Commodity Level 4'
  },
  {
    key: 'month',
    label: 'Month (YYYYMM / YYYY-MM)',
    placeholderInclude: 'e.g. 202601, 202602, 2026-01',
    placeholderExclude: 'Exclude month...',
    description: 'Periode bulan transaksi (misal: 202601 atau 2026-01)'
  },
  {
    key: 'day_of_month',
    label: 'Day of Month (Tanggal / Hari)',
    placeholderInclude: 'e.g. 01, 1, 15, 28',
    placeholderExclude: 'Exclude day...',
    description: 'Penyaringan transaksi berdasarkan tanggal / hari dalam bulan (misal: tanggal 1 atau 15)'
  },
  {
    key: 'archetype',
    label: 'Archetype / Tier',
    placeholderInclude: 'e.g. Primary Clinic, Tertiary, Tier 1, Spoke',
    placeholderExclude: 'Exclude...',
    description: 'Tipe arketipe atau tier rumah sakit/unit'
  },
  {
    key: 'budget_group',
    label: 'Budget Group',
    placeholderInclude: 'e.g. Medical, Non-Medical, Operations',
    placeholderExclude: 'Exclude...',
    description: 'Kelompok anggaran pengadaan'
  },
  {
    key: 'purchase_category',
    label: 'Purchase Category',
    placeholderInclude: 'e.g. CAPEX, OPEX, Strategic',
    placeholderExclude: 'Exclude...',
    description: 'Kategori pengeluaran pembelian'
  },
  {
    key: 'department',
    label: 'Requestor Department',
    placeholderInclude: 'e.g. Rawat Inap, Farmasi, Umum, IT, Keuangan, Operasional',
    placeholderExclude: 'Exclude department...',
    description: 'Departemen pemohon / requestor pada Purchase Requisition (PR)'
  }
];

/**
 * Evaluates whether a single SpendRecord matches a set of ManualFilterCard conditions.
 * Rule:
 * - Inter-Card Logic: OR (Match Any Group)
 * - Intra-Card (Field-level) Logic: AND (All active fields in the card must match)
 */
export function evaluateSpendRecordAgainstCards(record: SpendRecord, cards: ManualFilterCard[]): boolean {
  if (!cards || cards.length === 0) return true;

  // Filter out completely empty cards
  const validCards = cards.filter(card => {
    return AVAILABLE_FILTER_FIELDS.some(f => {
      const fieldData = card[f.key] as ManualFilterField | undefined;
      return fieldData && ((fieldData.include && fieldData.include.length > 0) || (fieldData.exclude && fieldData.exclude.length > 0));
    });
  });

  if (validCards.length === 0) return true;

  // OR across cards: return true if ANY card matches
  return validCards.some(card => {
    return evaluateSpendRecordAgainstSingleCard(record, card);
  });
}

/**
 * Checks a single card (AND across all defined fields inside this card)
 */
export function evaluateSpendRecordAgainstSingleCard(record: SpendRecord, card: ManualFilterCard): boolean {
  for (const fieldDef of AVAILABLE_FILTER_FIELDS) {
    const fieldData = card[fieldDef.key] as ManualFilterField | undefined;
    if (!fieldData) continue;

    const includes = (fieldData.include || []).map(s => s.trim().toLowerCase()).filter(Boolean);
    const excludes = (fieldData.exclude || []).map(s => s.trim().toLowerCase()).filter(Boolean);

    // If both include and exclude are empty, this field doesn't restrict anything
    if (includes.length === 0 && excludes.length === 0) continue;

    let targetValue = '';

    switch (fieldDef.key) {
      case 'commodity_remark_product':
        targetValue = `${record.itemName || ''} ${record.purchReqName || ''} ${record.itemId || ''} ${record.procurementCategory || ''} ${record.purchaseCategory || ''}`.toLowerCase();
        break;
      case 'commodity_l5':
        // Pure commodity name / L5 product focus
        targetValue = `${record.taxonomyLv5 || ''} ${record.itemName || ''}`.toLowerCase();
        break;
      case 'item_specification':
        // Specific material, spec, size
        targetValue = `${record.purchReqName || ''} ${record.itemName || ''}`.toLowerCase();
        break;
      case 'brand_name':
        targetValue = `${record.vendorName || ''} ${record.itemName || ''}`.toLowerCase();
        break;
      case 'part_number':
        targetValue = `${record.itemId || ''} ${record.skuMasterId || ''}`.toLowerCase();
        break;
      case 'vendor_name':
        targetValue = `${record.vendorName || ''} ${normalizeVendorKey(record.vendorName || '')}`.toLowerCase();
        break;
      case 'vendor_city': {
        const vNorm = (record.vendorName || '').toUpperCase().trim();
        const vKey = normalizeVendorKey(record.vendorName || '');
        const vMeta = vendorCityMap.get(vNorm) || vendorNormalizedMap.get(vKey) || '';
        targetValue = `${vMeta} ${record.vendorName || ''} ${record.vendorCity || ''}`.toLowerCase();
        break;
      }
      case 'hospital_code':
        targetValue = `${record.hospitalCode || ''} ${record.archetype || ''}`.toLowerCase();
        break;
      case 'hospital_island': {
        const code = (record.hospitalCode || '').toUpperCase().trim();
        const hMeta = hospitalIslandMap.get(code) || '';
        const javaCodes = ['SHLV', 'SHLP', 'SHKJ', 'MRCCC', 'SHBC', 'SHSH', 'SHBG', 'SHCP', 'SHAG', 'SHAS', 'SHTB', 'SHMK', 'SHCL', 'RSUSW', 'SHAB', 'SHJK', 'SHHO'];
        const isJava = javaCodes.includes(code) || hMeta.toLowerCase().includes('jawa') || hMeta.toLowerCase().includes('jabodetabek');
        targetValue = `${hMeta} ${record.hospitalCode || ''} ${record.island || ''} ${record.region || ''} ${isJava ? 'jawa java pulau jawa' : ''}`.toLowerCase();
        break;
      }
      case 'l1_taxonomy': {
        const rawL1 = `${record.taxonomyLv1 || ''} ${record.procurementCategory || ''} ${record.purchaseCategory || ''} ${record.mappedCategory || ''}`.toLowerCase();
        let synonyms = '';
        if (rawL1.includes('diagnostic') || rawL1.includes('medical device')) synonyms += ' medical devices peralatan diagnostik medis alkes';
        if (rawL1.includes('general suppl')) synonyms += ' perlengkapan umum barang umum general supplies';
        if (rawL1.includes('information tech') || rawL1.includes('it')) synonyms += ' teknologi informasi it hardware software';
        targetValue = `${rawL1} ${synonyms}`.toLowerCase();
        break;
      }
      case 'l2_taxonomy': {
        const rawL2 = `${record.taxonomyLv2 || ''} ${record.procurementCategory || ''} ${record.mappedCategory || ''} ${record.commodityItem || ''}`.toLowerCase();
        let synonyms = '';
        if (rawL2.includes('medical equipment') || rawL2.includes('diagnostic')) synonyms += ' alat kesehatan alkes peralatan medis medical devices biomedical equipment';
        if (rawL2.includes('office suppl') || rawL2.includes('atk')) synonyms += ' peralatan kantor alat tulis stationery atk office supplies';
        if (rawL2.includes('office equipment')) synonyms += ' peralatan kantor mesin kantor office equipment';
        targetValue = `${rawL2} ${synonyms}`.toLowerCase();
        break;
      }
      case 'l3_taxonomy': {
        const rawL3 = `${record.taxonomyLv3 || ''} ${record.procurementCategory || ''}`.toLowerCase();
        let synonyms = '';
        if (rawL3.includes('imaging') || rawL3.includes('radiology')) synonyms += ' radiologi imaging radiology rontgen usg mri xray';
        if (rawL3.includes('stationery') || rawL3.includes('desk')) synonyms += ' perlengkapan meja stationery atk stapler dispenser';
        if (rawL3.includes('filing') || rawL3.includes('storage')) synonyms += ' dokumen arsip filing storage map ordner folder';
        if (rawL3.includes('writing')) synonyms += ' alat tulis menulis pulpen pen ballpoint marker spidol';
        if (rawL3.includes('automation')) synonyms += ' mesin kantor shredder penghancur dokumen laminating';
        if (rawL3.includes('printing') || rawL3.includes('paper')) synonyms += ' percetakan formulir kertas paper printing hvs';
        targetValue = `${rawL3} ${synonyms}`.toLowerCase();
        break;
      }
      case 'l4_taxonomy':
        targetValue = `${record.taxonomyLv4 || ''} ${record.taxonomyLv5 || ''}`.toLowerCase();
        break;
      case 'month': {
        const rawMonth = record.monthYear || (record.createdDate ? record.createdDate.slice(0, 7) : '');
        const my = rawMonth.replace(/[^0-9]/g, ''); // 2026-04 -> 202604
        const cd = (record.createdDate || '').replace(/[^0-9]/g, '').slice(0, 6);
        const monthNum = rawMonth.includes('-') ? rawMonth.split('-')[1] : '';
        const monthNamesMap: Record<string, string> = {
          '01': 'januari jan january q1 kuartal 1 triwulan 1 s1',
          '02': 'februari feb february q1 kuartal 1 triwulan 1 s1',
          '03': 'maret mar march q1 kuartal 1 triwulan 1 s1',
          '04': 'april apr q2 kuartal 2 triwulan 2 s1',
          '05': 'mei may q2 kuartal 2 triwulan 2 s1',
          '06': 'juni jun june q2 kuartal 2 triwulan 2 s1',
          '07': 'juli jul july q3 kuartal 3 triwulan 3 s2',
          '08': 'agustus ags aug august q3 kuartal 3 triwulan 3 s2',
          '09': 'september sep q3 kuartal 3 triwulan 3 s2',
          '10': 'oktober okt oct october q4 kuartal 4 triwulan 4 s2',
          '11': 'november nov q4 kuartal 4 triwulan 4 s2',
          '12': 'desember des dec december q4 kuartal 4 triwulan 4 s2'
        };
        const mName = monthNamesMap[monthNum] || '';
        targetValue = `${rawMonth} ${my} ${cd} ${mName}`.toLowerCase();
        break;
      }
      case 'day_of_month': {
        const cd = record.createdDate || '';
        let dayNum: number | null = null;
        const isoMatch = cd.match(/^\d{4}[-/]\d{1,2}[-/](\d{1,2})/);
        if (isoMatch) {
          dayNum = parseInt(isoMatch[1], 10);
        } else {
          const generalMatch = cd.match(/[-/](\d{1,2})(?:T|\s|$)/);
          if (generalMatch) {
            dayNum = parseInt(generalMatch[1], 10);
          } else {
            const parsed = new Date(cd);
            if (!isNaN(parsed.getTime())) {
              dayNum = parsed.getUTCDate();
            }
          }
        }
        if (dayNum !== null && !isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
          const dPadded = String(dayNum).padStart(2, '0');
          targetValue = `${dPadded} ${dayNum} tanggal ${dayNum} tanggal ${dPadded} tgl ${dayNum} tgl ${dPadded} tgl-${dPadded} day ${dayNum}`.toLowerCase();
        } else {
          targetValue = '';
        }
        break;
      }
      case 'archetype': {
        const code = (record.hospitalCode || '').toUpperCase().trim();
        const tier = hospitalTierMap.get(code) || '';
        const isClinic = code === 'SHCP' || tier.toLowerCase().includes('community') || tier.toLowerCase().includes('pratama') || (record.archetype || '').toLowerCase().includes('clinic');
        targetValue = `${record.archetype || ''} ${tier} ${isClinic ? 'primary clinic primary klinik pratama community generalist tier 3' : ''}`.toLowerCase();
        break;
      }
      case 'budget_group':
        targetValue = `${record.budgetGroup || ''} ${record.budgetCode || ''} ${record.procurementCategory || ''}`.toLowerCase();
        break;
      case 'purchase_category':
        targetValue = `${record.purchaseCategory || ''} ${record.sourceFile || ''}`.toLowerCase();
        break;
      case 'department':
        targetValue = `${record.department || ''} ${record.requester || ''} ${record.requesterName || ''} ${record.costCenter || ''} ${record.prSubject || ''}`.toLowerCase();
        break;
      default:
        targetValue = '';
    }

    // 1. Exclude check: If targetValue contains ANY exclude keyword, the card FAILS (AND violation)
    if (excludes.length > 0) {
      const hasExcluded = excludes.some(exc => {
        const e = exc.trim().toLowerCase();
        if (!e) return false;
        if (e.length <= 3) {
          const regex = new RegExp(`(^|[^a-z0-9])${e}([^a-z0-9]|$)`, 'i');
          return regex.test(targetValue);
        }
        return targetValue.includes(e);
      });
      if (hasExcluded) return false;
    }

    // 2. Include check: targetValue MUST contain at least one include keyword (if includes array is specified)
    if (includes.length > 0) {
      if (fieldDef.key === 'day_of_month') {
        const targetClean = targetValue.replace(/[^0-9]/g, ' ').trim().split(/\s+/);
        const hasDay = includes.some(inc => {
          const incNum = parseInt(inc.replace(/[^0-9]/g, ''), 10);
          if (isNaN(incNum)) return false;
          return targetClean.some(t => parseInt(t, 10) === incNum);
        });
        if (!hasDay) return false;
      } else {
        const hasIncluded = includes.some(inc => {
          const kw = inc.trim().toLowerCase();
          if (!kw) return false;

          // Short keywords (<= 3 chars, e.g. "pen", "atk", "box", "mri") must match on word boundaries
          // to avoid false positives (e.g. "pen" matching "penghancur" or "dispenser")
          if (kw.length <= 3) {
            const regex = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, 'i');
            if (regex.test(targetValue)) return true;
          } else {
            if (targetValue.includes(kw) || kw.includes(targetValue)) return true;
          }

          // If department field, also check aliases from Clean Department Master Registry
          if (fieldDef.key === 'department') {
            const aliases = deptAliasMap.get(kw) || [];
            return aliases.some(alias => {
              const a = alias.toLowerCase();
              if (a.length <= 3) {
                const r = new RegExp(`(^|[^a-z0-9])${a}([^a-z0-9]|$)`, 'i');
                return r.test(targetValue);
              }
              return targetValue.includes(a) || a.includes(targetValue);
            });
          }
          return false;
        });
        if (!hasIncluded) return false;
      }
    }
  }

  // All fields in this card passed
  return true;
}
