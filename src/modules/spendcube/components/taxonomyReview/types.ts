import { SpendRecord, SkuMasterRecord, SkuMappingCacheRecord } from '../../../../core/types/spend';

export interface TaxonomyMappingReviewViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  onSelectRecord?: (record: SpendRecord) => void;
  onOpenAiAdvisor?: () => void;
}

export interface UniqueItemMappingSummary {
  itemKey: string;
  rawItemName: string;
  primaryItemName: string;
  itemNotes?: string;
  extractedSkuCode?: string;
  poCommodity: string;
  poSpec: string;
  poBrand: string;
  poPartNumber: string;
  transactionCount: number;
  orphanStatus: 'EXACT_MATCH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN';
  confidenceScore: number;
  matchReason: string;
  matchedSkuId?: string;
  matchedSku?: SkuMasterRecord;
  targetSku?: SkuMasterRecord;
  taxonomyLv1: string;
  taxonomyLv2: string;
  taxonomyLv3: string;
  taxonomyLv4: string;
  taxonomyLv5: string;
  isPersistedInDisk: boolean;
  persistedCacheItem?: SkuMappingCacheRecord;
}

export interface PillarScoreDetail {
  pillarName: string;
  score: number;
  max: number;
  pct: number;
  statusBadge: string;
  badgeClass: string;
  poValue: string;
  masterValue: string;
  explanation: string;
}

export function getPillarBreakdown(
  item: UniqueItemMappingSummary,
  targetSku?: SkuMasterRecord
): {
  pillars: PillarScoreDetail[];
  totalScore: number;
  accuracyFormula: string;
} {
  const reason = item.matchReason || '';

  const commMatch = reason.match(/Komoditas\s*\((\d+)\/(\d+)\)/i);
  const specMatch = reason.match(/Spec\w*\s*\((\d+)\/(\d+)\)/i);
  const brandMatch = reason.match(/Brand\s*\((\d+)\/(\d+)\)/i);
  const partMatch = reason.match(/Part#?\s*\((\d+)\/(\d+)\)/i);

  let commScore = commMatch ? parseInt(commMatch[1], 10) : 0;
  let commMax = commMatch ? parseInt(commMatch[2], 10) : 50;

  let specScore = specMatch ? parseInt(specMatch[1], 10) : 0;
  let specMax = specMatch ? parseInt(specMatch[2], 10) : 30;

  let brandScore = brandMatch ? parseInt(brandMatch[1], 10) : 0;
  let brandMax = brandMatch ? parseInt(brandMatch[2], 10) : 10;

  let partScore = partMatch ? parseInt(partMatch[1], 10) : 0;
  let partMax = partMatch ? parseInt(partMatch[2], 10) : 10;

  if (!commMatch && !specMatch && !brandMatch && !partMatch) {
    if (item.orphanStatus === 'EXACT_MATCH') {
      commScore = 50; commMax = 50;
      specScore = 30; specMax = 30;
      brandScore = 10; brandMax = 10;
      partScore = 10; partMax = 10;
    } else {
      const total = item.confidenceScore || 0;
      if (total >= 50) {
        commScore = 25; commMax = 50;
        specScore = total >= 70 ? 30 : (total >= 55 ? 20 : 0);
        brandScore = 10; brandMax = 10;
        partScore = 10; partMax = 10;
      } else {
        commScore = 0; commMax = 50;
        specScore = 0; specMax = 30;
        brandScore = 0; brandMax = 10;
        partScore = 0; partMax = 10;
      }
    }
  }

  const masterComm = targetSku?.commodityItem || targetSku?.name || '-';
  const masterSpec = targetSku?.generalSpec || targetSku?.specification1 || '-';
  const masterBrand = targetSku?.brand || '-';
  const masterPart = targetSku?.partNumber || '-';

  const poComm = item.poCommodity || item.primaryItemName;
  const poSpec = item.poSpec || '-';
  const poBrand = item.poBrand || 'NB';
  const poPart = item.poPartNumber || 'NP';

  let commExplanation = '';
  let commBadge = 'Tidak Cocok (0%)';
  let commBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  if (commScore >= 50) {
    commBadge = 'Cocok Penuh (50/50)';
    commBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    commExplanation = `Nama komoditas PO '${poComm}' identik secara penuh dengan komoditas Master SKU '${masterComm}'.`;
  } else if (commScore > 0) {
    commBadge = `Sebagian Cocok (${commScore}/50)`;
    commBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    commExplanation = `Nama barang PO ('${poComm}') cocok sebagian karena memuat kata kunci komoditas Master SKU ('${masterComm}'). Nilai parsial ${commScore}% diberikan dari bobot maksimal 50%.`;
  } else {
    commExplanation = `Tidak ditemukan kesamaan kata kunci komoditas Level 5 dengan Master SKU.`;
  }

  let specExplanation = '';
  let specBadge = 'Berbeda (0/30)';
  let specBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  if (specScore >= 30) {
    specBadge = 'Identik / Slot Kosong (30/30)';
    specBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    specExplanation = `Kedua data tidak mencantumkan spesifikasi varian khusus (slot umum/NA identik). Mendapatkan skor penuh +30%.`;
  } else if (specScore > 0) {
    specBadge = `Sebagian Cocok (${specScore}/30)`;
    specBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    specExplanation = `Sebagian varian spesifikasi (ukuran/tipe) bersesuaian dengan spesifikasi Master SKU.`;
  } else {
    specExplanation = `Spesifikasi barang PO berbeda dengan spesifikasi Master SKU.`;
  }

  let brandExplanation = '';
  let brandBadge = 'Berbeda (0/10)';
  let brandBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  if (brandScore >= 10) {
    brandBadge = 'Generic / NB Cocok (10/10)';
    brandBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    brandExplanation = `Keduanya berstatus Non-Brand (NB) / Generic tanpa merek terdaftar khusus. Mendapatkan skor penuh +10%.`;
  } else {
    brandExplanation = `Merek pada PO berbeda dengan merek Master SKU.`;
  }

  let partExplanation = '';
  let partBadge = 'Berbeda (0/10)';
  let partBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  if (partScore >= 10) {
    partBadge = 'Standar / NP Cocok (10/10)';
    partBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    partExplanation = `Keduanya berstatus No-Part (NP) / Standar pabrik tanpa nomor part khusus. Mendapatkan skor penuh +10%.`;
  } else {
    partExplanation = `Nomor part pada PO berbeda dengan nomor part Master SKU.`;
  }

  const pillars: PillarScoreDetail[] = [
    {
      pillarName: '1. Komoditas (Level 5)',
      score: commScore,
      max: commMax,
      pct: Math.round((commScore / commMax) * 100),
      statusBadge: commBadge,
      badgeClass: commBadgeClass,
      poValue: poComm,
      masterValue: masterComm,
      explanation: commExplanation
    },
    {
      pillarName: '2. Spesifikasi (3-Slot)',
      score: specScore,
      max: specMax,
      pct: Math.round((specScore / specMax) * 100),
      statusBadge: specBadge,
      badgeClass: specBadgeClass,
      poValue: poSpec,
      masterValue: masterSpec,
      explanation: specExplanation
    },
    {
      pillarName: '3. Brand / Merek',
      score: brandScore,
      max: brandMax,
      pct: Math.round((brandScore / brandMax) * 100),
      statusBadge: brandBadge,
      badgeClass: brandBadgeClass,
      poValue: poBrand,
      masterValue: masterBrand,
      explanation: brandExplanation
    },
    {
      pillarName: '4. Part Number',
      score: partScore,
      max: partMax,
      pct: Math.round((partScore / partMax) * 100),
      statusBadge: partBadge,
      badgeClass: partBadgeClass,
      poValue: poPart,
      masterValue: masterPart,
      explanation: partExplanation
    }
  ];

  const totalScore = commScore + specScore + brandScore + partScore;
  const accuracyFormula = `${commScore}% (Komoditas) + ${specScore}% (Spec) + ${brandScore}% (Brand) + ${partScore}% (Part#) = ${totalScore}% Total Akurasi`;

  return { pillars, totalScore, accuracyFormula };
}
