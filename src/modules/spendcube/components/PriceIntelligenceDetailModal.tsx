import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Building2, 
  Calendar, 
  DollarSign, 
  Tag, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Repeat, 
  Globe2, 
  SlidersHorizontal, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Search, 
  ArrowRight, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Layers,
  Scale,
  Briefcase,
  UserCheck,
  Send,
  MessageSquare,
  Clock,
  CheckCheck,
  FileCheck,
  Info
} from 'lucide-react';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord,
  PriceSurgeItem,
  IntraVendorDiscrepancyItem,
  VendorSwitchingOpportunity,
  RegionalPriceAnalysisItem,
  StandardPriceAuditItem
} from '../../../core/types/spend';

export type DiagnosticCode = 'PI-01' | 'PI-02' | 'PI-03' | 'PI-04' | 'PI-05' | 'PI-06';

interface PriceIntelligenceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosticType: DiagnosticCode;
  selectedItem: PriceSurgeItem | IntraVendorDiscrepancyItem | VendorSwitchingOpportunity | RegionalPriceAnalysisItem | StandardPriceAuditItem | any;
  allSpendRecords: SpendRecord[];
  skuMasters?: SkuMasterRecord[];
  hospitalMasters?: HospitalMasterRecord[];
  vendorMasters?: VendorMasterRecord[];
  onFollowUpPO?: (poNumber: string) => void;
}

export const PriceIntelligenceDetailModal: React.FC<PriceIntelligenceDetailModalProps> = ({
  isOpen,
  onClose,
  diagnosticType,
  selectedItem,
  allSpendRecords,
  skuMasters = [],
  hospitalMasters = [],
  vendorMasters = [],
  onFollowUpPO
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [poSearch, setPoSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'evidence' | 'formula' | 'actionScript'>('evidence');
  const [viewedFormula, setViewedFormula] = useState<DiagnosticCode>(diagnosticType);

  // Operational follow-up states
  const [followUpRecord, setFollowUpRecord] = useState<SpendRecord | null>(null);
  const [followUpStatuses, setFollowUpStatuses] = useState<Record<string, { status: string; note: string }>>({});
  const [followUpToast, setFollowUpToast] = useState<string | null>(null);

  // Synchronize viewed formula when diagnosticType changes
  React.useEffect(() => {
    setViewedFormula(diagnosticType);
  }, [diagnosticType]);

  const hospMap = useMemo(() => {
    const map = new Map<string, HospitalMasterRecord>();
    (hospitalMasters || []).forEach(h => {
      if (h.hospitalCode) map.set(h.hospitalCode.toUpperCase(), h);
    });
    return map;
  }, [hospitalMasters]);

  if (!isOpen || !selectedItem) return null;

  const formatIDR = (val: number) => `Rp ${Math.round(Number(val || 0)).toLocaleString('id-ID')}`;

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  // Find all matching Spend PO records related to this item & vendor
  const relevantRecords = useMemo(() => {
    if (!allSpendRecords || allSpendRecords.length === 0) return [];
    
    const targetItemId = selectedItem.itemId || selectedItem.productId || '';
    const targetItemName = (selectedItem.itemName || '').toLowerCase().trim();
    const targetVendor = (selectedItem.vendorName || selectedItem.currentVendor || '').toLowerCase().trim();
    const altVendor = (selectedItem.alternativeVendor || '').toLowerCase().trim();

    return allSpendRecords.filter(r => {
      const rName = (r.itemName || '').toLowerCase().trim();
      const rId = r.itemId || '';
      const rVendor = (r.vendorName || '').toLowerCase().trim();

      const isItemMatch = (targetItemId && rId === targetItemId) || (targetItemName && rName === targetItemName);
      if (!isItemMatch) return false;

      if (diagnosticType === 'PI-01' || diagnosticType === 'PI-02') {
        return !targetVendor || rVendor === targetVendor;
      } else if (diagnosticType === 'PI-03') {
        return !targetVendor || rVendor === targetVendor || (altVendor && rVendor === altVendor);
      } else if (diagnosticType === 'PI-04') {
        const targetHospital = (selectedItem.hospitalCode || '').toLowerCase().trim();
        return !targetHospital || r.hospitalCode?.toLowerCase() === targetHospital;
      }
      return true;
    }).sort((a, b) => (a.monthYear || '').localeCompare(b.monthYear || '') || (b.purchPrice || 0) - (a.purchPrice || 0));
  }, [allSpendRecords, selectedItem, diagnosticType]);

  // Compute key min and max reference records
  const minRecord = useMemo(() => {
    if (relevantRecords.length === 0) return null;
    let min = relevantRecords[0];
    for (const r of relevantRecords) {
      if ((r.purchPrice || 0) > 0 && ((r.purchPrice || 0) < (min.purchPrice || Infinity))) {
        min = r;
      }
    }
    return min;
  }, [relevantRecords]);

  const maxRecord = useMemo(() => {
    if (relevantRecords.length === 0) return null;
    let max = relevantRecords[0];
    for (const r of relevantRecords) {
      if ((r.purchPrice || 0) > (max.purchPrice || -Infinity)) {
        max = r;
      }
    }
    return max;
  }, [relevantRecords]);

  // Filtered POs by search input (now includes PR and Requester/Dept fields)
  const filteredRecords = useMemo(() => {
    if (!poSearch.trim()) return relevantRecords;
    const q = poSearch.toLowerCase();
    return relevantRecords.filter(r => 
      (r.purchId && r.purchId.toLowerCase().includes(q)) ||
      (r.purchaseReqId && r.purchaseReqId.toLowerCase().includes(q)) ||
      (r.requester && r.requester.toLowerCase().includes(q)) ||
      (r.requesterName && r.requesterName.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q)) ||
      (r.costCenter && r.costCenter.toLowerCase().includes(q)) ||
      (r.prSubject && r.prSubject.toLowerCase().includes(q)) ||
      (r.hospitalCode && r.hospitalCode.toLowerCase().includes(q)) ||
      (r.vendorName && r.vendorName.toLowerCase().includes(q)) ||
      (r.monthYear && r.monthYear.toLowerCase().includes(q))
    );
  }, [relevantRecords, poSearch]);

  // Diagnostic metadata configuration for current item
  const diagnosticConfig = useMemo(() => {
    switch (diagnosticType) {
      case 'PI-01':
        return {
          code: 'PI-01',
          title: 'Historical Price Surge & Inflation Spike',
          category: 'Kenaikan Harga Unilateral Vendor',
          color: 'rose',
          icon: Flame,
          formulaDisplay: 'ΔP = ((P_latest - P_baseline) / P_baseline) × 100%',
          formulaExplanation: 'Menghitung persentase eskalasi harga satuan dari transaksi awal/baseline terhadap transaksi PO terbaru pada vendor yang sama.',
          thresholdRule: 'Severity CRITICAL jika ΔP ≥ +20.0%, HIGH jika ΔP ≥ +10.0%, MODERATE jika ΔP ≥ +3.0%.',
          rootCauseText: `Vendor menaikkan harga dari baseline ${formatIDR(selectedItem.initialPrice || minRecord?.purchPrice || 0)} menjadi ${formatIDR(selectedItem.latestPrice || maxRecord?.purchPrice || 0)} (+${(selectedItem.percentageIncrease || 0).toFixed(1)}%).`,
          financialImpactLabel: 'Estimasi Ekstra Biaya Pembengkakan',
          financialImpactValue: formatIDR(selectedItem.estimatedExtraCost || 0),
          actionGuidance: 'Terbitkan surat klarifikasi kenaikan tarif ke vendor, minta pembatalan eskalasi sepihak, atau batasi PO baru hingga harga dikembalikan ke tarif baseline.'
        };
      case 'PI-02':
        return {
          code: 'PI-02',
          title: 'Intra-Vendor Cross-Hospital Price Disparity',
          category: 'Diskriminasi Tarif Antar-Unit RS (Vendor Sama)',
          color: 'amber',
          icon: Repeat,
          formulaDisplay: 'Disparity Rate = ((P_max_RS - P_min_RS) / P_min_RS) × 100%',
          formulaExplanation: 'Menghitung variansi harga satuan ketika vendor yang sama menjual komoditas identik dengan harga murah di satu unit RS dan mahal di unit RS lain.',
          thresholdRule: 'Disparitas > 0% lintas ≥2 unit RS. Klausul Most Favored Customer (MFC) dilanggar.',
          rootCauseText: `Vendor menjual dengan tarif termurah di unit ${selectedItem.minPriceHospital || minRecord?.hospitalCode || 'RS A'} (${formatIDR(selectedItem.minPrice || minRecord?.purchPrice || 0)}), namun menjual lebih mahal di ${selectedItem.maxPriceHospital || maxRecord?.hospitalCode || 'RS B'} (${formatIDR(selectedItem.maxPrice || maxRecord?.purchPrice || 0)}).`,
          financialImpactLabel: 'Potensi Kebocoran (Leakage Rupiah)',
          financialImpactValue: formatIDR(selectedItem.totalLeakageAmount || 0),
          actionGuidance: 'Terapkan Klausul Most Favored Customer (MFC) secara sentral. Tagihkan kredit nota/restitusi untuk selisih transaksi masa lalu dan kunci tarif seragam nasional.'
        };
      case 'PI-03':
        return {
          code: 'PI-03',
          title: 'Strategic Vendor Switching & Price Creep Arbitrage',
          category: 'Peluang Pengalihan Kontrak ke Kompetitor',
          color: 'emerald',
          icon: TrendingUp,
          formulaDisplay: 'Arbitrage Saving = (P_current_vendor - P_alt_vendor) × Qty_Annual',
          formulaExplanation: 'Menghitung potensi penghematan tahunan dengan mengalihkan volume PO dari vendor eksisting yang menaikkan harga ke vendor kompetitor yang terbukti menawarkan harga lebih kompetitif.',
          thresholdRule: 'Vendor kompetitor terdaftar memiliki harga ≥5% lebih rendah untuk SKU setara.',
          rootCauseText: `Vendor eksisting (${selectedItem.currentVendor}) memiliki rata-rata harga ${formatIDR(selectedItem.currentAvgPrice)}/unit, sedangkan ${selectedItem.alternativeVendor} menawarkan ${formatIDR(selectedItem.alternativePrice)}/unit (hemat ${formatIDR(selectedItem.unitSavingIDR)}/unit).`,
          financialImpactLabel: 'Potensi Penghematan Tahunan',
          financialImpactValue: formatIDR(selectedItem.totalPotentialSavingIDR || 0),
          actionGuidance: 'Alihkan alokasi PO baru ke vendor alternatif atau gunakan penawaran vendor alternatif sebagai leverage negosiasi tender tahunan.'
        };
      case 'PI-04':
        return {
          code: 'PI-04',
          title: 'Regional Logistics Index & Geography Benchmark',
          category: 'Audit Efisiensi Ongkos Logistik Wilayah',
          color: 'blue',
          icon: Globe2,
          formulaDisplay: 'Excessive Markup = Actual Regional Index - Benchmark (100%) - Fair Logistics Tolerance%',
          formulaExplanation: 'Mengaudit harga unit RS di luar Jabodetabek terhadap patokan harga Jabodetabek setelah dikurangi batas wajar toleransi logistik (3% Jawa, 6-8% Luar Jawa).',
          thresholdRule: 'Markup Berlebih jika selisih harga regional melampaui plafon ongkir resmi.',
          rootCauseText: `Harga aktual di ${selectedItem.hospitalName || selectedItem.city} adalah ${formatIDR(selectedItem.actualAvgPrice)} (${(selectedItem.regionalPriceIndex || 100).toFixed(1)}% vs Jabodetabek ${formatIDR(selectedItem.benchmarkJabodetabekPrice)}). Markup berlebih: +${(selectedItem.excessiveMarkupPct || 0).toFixed(1)}%.`,
          financialImpactLabel: 'Potensi Efisiensi Penyesuaian Wilayah',
          financialImpactValue: formatIDR(selectedItem.potentialFairAdjustmentSaving || 0),
          actionGuidance: 'Negosiasikan kontrak pengiriman Franco (bebas ongkir ke seluruh cabang) atau tetapkan matriks ongkos logistik transparan berbasis jarak riil.'
        };
      case 'PI-05':
        return {
          code: 'PI-05',
          title: 'ERP Standard Price Governance & SKU Master Calibration',
          category: 'Tata Kelola Standar Price ERP (HPS/Pagu)',
          color: 'indigo',
          icon: SlidersHorizontal,
          formulaDisplay: 'ERP Variance = ((P_actual_avg - P_standard_ERP) / P_standard_ERP) × 100%',
          formulaExplanation: 'Mendeteksi inkonsistensi antara Standar Price di ERP Master SKU dengan realitas harga transaksi faktual di lapangan.',
          thresholdRule: 'Standar Terlalu Tinggi jika variansi < -15% (perlu diturunkan); Pembelian Over-Price jika transaksi > Standar ERP.',
          rootCauseText: `Standar Price ERP tercatat ${formatIDR(selectedItem.standardPriceERP || 0)}, sedangkan rata-rata harga beli riil adalah ${formatIDR(selectedItem.actualAvgPrice || 0)} (Variansi: ${(selectedItem.priceVarianceVsStandardPct || 0).toFixed(1)}%).`,
          financialImpactLabel: 'Rekomendasi Standar Price Baru',
          financialImpactValue: formatIDR(selectedItem.recommendedNewStandardPrice || selectedItem.actualAvgPrice || 0),
          actionGuidance: 'Instruksikan tim Master SKU Data Governance untuk memperbarui Standar Price di Microsoft Dynamics/SAP agar pagu anggaran akurat.'
        };
      case 'PI-06':
      default:
        return {
          code: 'PI-06',
          title: 'Deep AI Spend Anomaly & Packaging Conversion Distortion',
          category: 'Audit Algoritmik Multi-Dimensi',
          color: 'purple',
          icon: Sparkles,
          formulaDisplay: 'Outlier Score = |Price - Median| / MAD_Sigma',
          formulaExplanation: 'Pendeteksian anomali statistik berbasis Z-score dan divergensi rasio konversi satuan (misal harga Box ter-input sebagai Pcs).',
          thresholdRule: 'Anomali terdeteksi dengan tingkat keyakinan AI > 90%.',
          rootCauseText: 'Pola transaksi menunjukkan deviasi harga ekstrem yang tidak lazim dibanding median kluster pengadaan.',
          financialImpactLabel: 'Estimasi Risiko Anomali',
          financialImpactValue: formatIDR(selectedItem.totalSpend || 0),
          actionGuidance: 'Lakukan verifikasi fisik Surat Jalan dan Faktur Pajak untuk memastikan tidak ada kesalahan input satuan kemasan.'
        };
    }
  }, [diagnosticType, selectedItem, minRecord, maxRecord]);

  // Catalog of ALL calculation methods PI-01 to PI-06 for formula browser
  const allFormulasCatalog: Record<DiagnosticCode, {
    title: string;
    subtitle: string;
    formula: string;
    steps: string[];
    exampleCalc: string;
    rule: string;
    impactLabel: string;
  }> = {
    'PI-01': {
      title: 'PI-01: Historical Price Surge & Inflation Spike',
      subtitle: 'Kenaikan Harga Sepihak / Tren Inflasi Vendor',
      formula: 'ΔP (%) = ((Harga PO Terkini - Harga PO Baseline) / Harga PO Baseline) × 100%',
      steps: [
        '1. Sortir semua transaksi PO untuk SKU & Vendor yang sama berdasarkan tanggal PO.',
        '2. Ambil transaksi PO tertua sebagai Baseline (P_base) dan transaksi terbaru sebagai P_latest.',
        '3. Hitung selisih nominal: ΔP_IDR = P_latest - P_base.',
        '4. Hitung persentase lonjakan: ΔP% = (ΔP_IDR / P_base) × 100%.',
        '5. Estimasi pembengkakan biaya (Leakage) = ΔP_IDR × Total Qty PO Terkini.'
      ],
      exampleCalc: `P_base = ${formatIDR(selectedItem.initialPrice || minRecord?.purchPrice || 50000)}, P_latest = ${formatIDR(selectedItem.latestPrice || maxRecord?.purchPrice || 62500)} → ΔP = +25.0%. Ekstra biaya = ${diagnosticConfig.financialImpactValue}.`,
      rule: 'Severity: CRITICAL jika ΔP ≥ 20%, HIGH jika ΔP ≥ 10%, MODERATE jika ΔP ≥ 3%.',
      impactLabel: 'Ekstra Biaya Lonjakan Harga'
    },
    'PI-02': {
      title: 'PI-02: Intra-Vendor Cross-Hospital Price Disparity',
      subtitle: 'Disparitas Harga Antar Unit RS pada Vendor yang Sama',
      formula: 'Disparitas (%) = ((Harga Satuan Tertinggi - Harga Satuan Termurah) / Harga Satuan Termurah) × 100%',
      steps: [
        '1. Kelompokkan seluruh PO berdasarkan pasangan (Vendor, SKU).',
        '2. Identifikasi unit RS dengan harga terendah (P_min_RS) sebagai acuan Benchmark Nasional (Best Rate).',
        '3. Identifikasi unit RS lain yang membeli dengan harga lebih tinggi (P_unit_RS).',
        '4. Hitung selisih per unit = P_unit_RS - P_min_RS.',
        '5. Total Kebocoran Dana = Σ (Qty_transaksi_RS × (P_unit_RS - P_min_RS)) untuk seluruh transaksi di atas harga terbaik.'
      ],
      exampleCalc: `P_min (${selectedItem.minPriceHospital || 'RS Lippo'}) = ${formatIDR(selectedItem.minPrice || minRecord?.purchPrice || 80000)}, P_max (${selectedItem.maxPriceHospital || 'RS Kebon Jeruk'}) = ${formatIDR(selectedItem.maxPrice || maxRecord?.purchPrice || 95000)} → Disparitas: +18.8%. Total Leakage = ${formatIDR(selectedItem.totalLeakageAmount || 0)}.`,
      rule: 'Setiap variansi harga > 0% antar unit RS melanggar Klausul Most Favored Customer (MFC) korporasi Siloam.',
      impactLabel: 'Total Kebocoran Harga (Leakage MFC)'
    },
    'PI-03': {
      title: 'PI-03: Strategic Vendor Switching & Price Creep Arbitrage',
      subtitle: 'Pengalihan Kontrak ke Vendor Alternatif / Kompetitor',
      formula: 'Potensi Hemat = (Harga Rata-rata Vendor Eksisting - Harga Penawaran Vendor Alternatif) × Volume Tahunan',
      steps: [
        '1. Untuk setiap SKU, petakan seluruh vendor yang pernah menyuplai atau memasukkan penawaran.',
        '2. Hitung harga rata-rata tertimbang vendor eksisting (P_current).',
        '3. Bandingkan dengan vendor terdaftar lain yang memiliki harga terendah (P_alt).',
        '4. Hitung selisih hemat per unit: Unit_Saving = P_current - P_alt.',
        '5. Proyeksikan penghematan tahunan: Annual_Saving = Unit_Saving × Total Volume Pembelian 12 Bulan.'
      ],
      exampleCalc: `P_current = ${formatIDR(selectedItem.currentAvgPrice || 120000)}, P_alt = ${formatIDR(selectedItem.alternativePrice || 102000)} → Hemat: ${formatIDR(selectedItem.unitSavingIDR || 18000)}/unit (-15.0%). Proyeksi penghematan = ${formatIDR(selectedItem.totalPotentialSavingIDR || 0)}.`,
      rule: 'Trigger rekomendasi switching bila penghematan ≥ 5% dan vendor alternatif terverifikasi aktif di ERP.',
      impactLabel: 'Potensi Penghematan Tahunan'
    },
    'PI-04': {
      title: 'PI-04: Regional Logistics Index & Geography Benchmark',
      subtitle: 'Audit Efisiensi Ongkos Kirim & Toleransi Geografis',
      formula: 'Indeks Regional (%) = (Harga Rata-rata Unit Regional / Harga Patokan Jabodetabek) × 100%',
      steps: [
        '1. Hitung harga rata-rata benchmark di kluster Jabodetabek (Indeks = 100%).',
        '2. Hitung harga rata-rata aktual di unit RS regional (P_regional).',
        '3. Hitung selisih persentase markup = ((P_regional - P_jabodetabek) / P_jabodetabek) × 100%.',
        '4. Bandingkan dengan toleransi logistik wajar: Jawa (+3%), Sumatera/Bali (+6%), Kalimantan/Sulawesi (+8%), Papua (+12%).',
        '5. Markup Berlebih (Excessive Markup) = Selisih Persentase - Toleransi Wajar Wilayah.'
      ],
      exampleCalc: `Jabodetabek = ${formatIDR(selectedItem.benchmarkJabodetabekPrice || 100000)}, Regional = ${formatIDR(selectedItem.actualAvgPrice || 112000)} (112%). Toleransi = 6%. Markup Berlebih = +6.0%. Potensi Penyesuaian = ${formatIDR(selectedItem.potentialFairAdjustmentSaving || 0)}.`,
      rule: 'Penetapan tarif regional wajib mengacu pada matriks ongkir resmi atau dinegosiasikan Franco.',
      impactLabel: 'Potensi Efisiensi Penyesuaian Wilayah'
    },
    'PI-05': {
      title: 'PI-05: ERP Standard Price Governance & SKU Master Calibration',
      subtitle: 'Kalibrasi Standar Price ERP Master terhadap Realitas Transaksi',
      formula: 'Variansi ERP (%) = ((Harga Beli Aktual Rata-rata - Standar Price ERP) / Standar Price ERP) × 100%',
      steps: [
        '1. Tarik Standar Price resmi dari tabel Master SKU ERP (P_standard_ERP).',
        '2. Hitung harga beli faktual rata-rata dari seluruh transaksi PO periode berjalan (P_actual_avg).',
        '3. Hitung deviasi: Deviasi = P_actual_avg - P_standard_ERP.',
        '4. Jika P_actual_avg > P_standard_ERP: Terjadi pembengkakan anggaran (Over-budget).',
        '5. Jika P_actual_avg < P_standard_ERP secara persisten (>15%): Standar Price ERP ketinggian dan perlu dikalibrasi turun.'
      ],
      exampleCalc: `Standar ERP = ${formatIDR(selectedItem.standardPriceERP || 150000)}, Riil Transaksi = ${formatIDR(selectedItem.actualAvgPrice || 122000)} → Deviasi: -18.7%. Standar Baru Disarankan = ${formatIDR(selectedItem.recommendedNewStandardPrice || selectedItem.actualAvgPrice || 122000)}.`,
      rule: 'Pembaruan Standar Price di ERP memastikan pagu HPS saat pembuatan PR tidak over-budget atau artificial surplus.',
      impactLabel: 'Rekomendasi Standar Price Baru'
    },
    'PI-06': {
      title: 'PI-06: Deep AI Spend Anomaly & Packaging Conversion Distortion',
      subtitle: 'Deteksi Anomali Multi-Dimensi & Salah Input Satuan Kemasan',
      formula: 'Skor Anomali = |Harga Transaksi - Median Kluster| / Nilai Deviasi MAD',
      steps: [
        '1. Hitung nilai Median dan MAD (Median Absolute Deviation) untuk kluster komoditas sejenis.',
        '2. Cari transaksi dengan harga satuan ekstrem (misal 10x atau 0.1x dari median).',
        '3. Evaluasi anomali kemasan (Packaging Distortion): Contoh harga Box (isi 100 pcs) dimasukkan sebagai harga Pcs.',
        '4. Verifikasi field konversi satuan di master ERP dan cross-check Surat Jalan.',
        '5. Tandai transaksi untuk audit fisik operasional tim logistik/gudang RS.'
      ],
      exampleCalc: `Harga Transaksi = ${formatIDR(selectedItem.purchPrice || 450000)}, Median = ${formatIDR(selectedItem.medianPrice || 45000)} (Faktor 10x terdeteksi) → Indikasi salah satuan kemasan (Pack vs Pcs).`,
      rule: 'Tingkat keyakinan AI > 90% mengindikasikan kekeliruan administrasi input PO yang harus segera direvisi.',
      impactLabel: 'Estimasi Risiko Anomali'
    }
  };

  // Generate complete PO Audit Sheet text for copying (now including PR & Requester/Dept info)
  const generateAuditSheetText = () => {
    const poListText = relevantRecords.map(r => {
      const hosp = hospMap.get((r.hospitalCode || '').toUpperCase());
      const unitCode = hosp?.erpHospitalUnitCode || '0000';
      return `- PO: ${r.purchId} | PR: ${r.purchaseReqId || 'N/A'} | Pemohon: ${r.requesterName || r.requester || 'User'} (${r.department || 'Dept'}) | CC: ${r.costCenter || '0000'} | RS: ${r.hospitalCode} [ERP:${unitCode}] | Vendor: ${r.vendorName} | Qty: ${r.purchQty} ${r.purchUnit || 'Unit'} | Harga: ${formatIDR(r.purchPrice)} | Total: ${formatIDR(r.totalLineAmount)}`;
    }).join('\n');

    return `=== AUDIT OPERASIONAL PENGADAAN [${diagnosticConfig.code}] ===
Nama Komoditas : ${selectedItem.itemName}
Kode SKU / ID  : ${selectedItem.itemId || selectedItem.productId || 'N/A'}
Vendor Utama   : ${selectedItem.vendorName || selectedItem.currentVendor || 'N/A'}
Kategori Audit : ${diagnosticConfig.title}
Rumus Diagnosa : ${diagnosticConfig.formulaDisplay}
Dampak Finansial: ${diagnosticConfig.financialImpactValue}

BUKTI TRANSAKSI PO & REQUISITION (PR):
${poListText || 'Tidak ada detail transaksi spesifik.'}

INSTRUKSI OPERASIONAL TIM PROCUREMENT:
${diagnosticConfig.actionGuidance}
Dicetak otomatis dari Sistem Price Intelligence SpendCube.`;
  };

  // Generate Official Negotiation / Clarification Letter Draft with PO, PR, and Department reference
  const generateNegotiationDraft = () => {
    const minPo = minRecord ? `${minRecord.purchId} (PR: ${minRecord.purchaseReqId || '-'}, ${minRecord.hospitalCode}, ${minRecord.monthYear}, ${formatIDR(minRecord.purchPrice)})` : 'N/A';
    const maxPo = maxRecord ? `${maxRecord.purchId} (PR: ${maxRecord.purchaseReqId || '-'}, ${maxRecord.hospitalCode}, ${maxRecord.monthYear}, ${formatIDR(maxRecord.purchPrice)})` : 'N/A';

    return `Kepada Yth.
Tim Komersial & Manajemen Akun
${selectedItem.vendorName || selectedItem.currentVendor || 'Mitra Vendor'}

Perihal: Permohonan Klarifikasi & Penyelarasan Harga Transaksi Pengadaan (Ref: ${diagnosticConfig.code})

Dengan hormat,
Berdasarkan audit komparasi sistem Price Intelligence kami untuk komoditas:
- Nama Barang : ${selectedItem.itemName} (Kode: ${selectedItem.itemId || selectedItem.productId || 'N/A'})

Kami menemukan catatan anomali harga pada transaksi Purchase Order (PO) berikut:
1. PO Acuan / Tarif Terbaik : PO No. ${minPo}
2. PO Kenaikan / Disparitas : PO No. ${maxPo}

${diagnosticConfig.rootCauseText}

Sehubungan dengan prinsip tata kelola pengadaan korporasi serta klausul Most Favored Customer (MFC), kami memohon:
1. Klarifikasi tertulis mengenai dasar perhitungan selisih/kenaikan tarif tersebut.
2. Penyesuaian tarif faktur berjalan dan penerbitan Nota Kredit atas transaksi terdampak dengan estimasi selisih ${diagnosticConfig.financialImpactValue}.
3. Penyeragaman tarif kontrak nasional mengacu pada harga terbaik yang pernah disepakati.

Mohon konfirmasi tanggapan sebelum pemrosesan siklus PO berikutnya.

Hormat kami,
Tim Procurement & Strategic Sourcing
Siloam Hospitals Group`;
  };

  // Generate Internal Memo for Requester and HOD
  const generateInternalMemo = (r: SpendRecord) => {
    const hosp = hospMap.get((r.hospitalCode || '').toUpperCase());
    const unitCode = hosp?.erpHospitalUnitCode || '0000';
    return `*MEMORANDUM INTERNAL PROCUREMENT SILOAM*
Kepada : ${r.requesterName || r.requester || 'Requester'} (${r.department || 'Departemen Terkait'})
Tembusan : Head of Department (HOD) & Finance Hospital Unit
Dari : Tim Procurement Intelligence (CGP)
Perihal : Tindak Lanjut Audit Harga Transaksi PO ${r.purchId}

Rincian Transaksi:
- No PO : ${r.purchId} (Tanggal: ${r.monthYear || r.createdDate})
- No PR : ${r.purchaseReqId || 'PR-Terkait'}
- Nama Proyek : ${r.prSubject || 'Pengadaan Operasional'}
- Unit RS : ${r.hospitalCode} (Kode Unit ERP: ${unitCode})
- Cost Center : ${r.costCenter || '0000'}
- Komoditas : ${r.itemName}
- Vendor : ${r.vendorName}
- Harga Satuan : ${formatIDR(r.purchPrice)} (Total: ${formatIDR(r.totalLineAmount)})

Catatan Audit [${diagnosticConfig.code}]:
${diagnosticConfig.rootCauseText}

Rekomendasi Tindakan:
1. Mohon konfirmasi apakah terdapat spesifikasi khusus yang menyebabkan perbedaan harga tersebut.
2. Tim Procurement Pusat sedang memproses negosiasi penyesuaian tarif dan klaim restitusi nota kredit kepada vendor ${r.vendorName}.
3. Untuk pengadaan selanjutnya, mohon menggunakan referensi standar harga ${formatIDR(selectedItem.minPrice || minRecord?.purchPrice || selectedItem.initialPrice || 0)}.`;
  };

  // Handle setting follow-up status
  const handleUpdateFollowUpStatus = (poNumber: string, status: string, note: string) => {
    setFollowUpStatuses(prev => ({
      ...prev,
      [poNumber]: { status, note }
    }));
    setFollowUpToast(`Status PO ${poNumber} diperbarui menjadi: ${status}`);
    setTimeout(() => setFollowUpToast(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between shrink-0">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-xs border border-purple-200">
              <diagnosticConfig.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                  {diagnosticConfig.code}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {diagnosticConfig.category}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-mono text-slate-500">
                  SKU: {selectedItem.itemId || selectedItem.productId || 'GENERIC'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight mt-0.5">
                {selectedItem.itemName || 'Item Audit'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Vendor: <strong className="text-slate-800">{selectedItem.vendorName || selectedItem.currentVendor || 'Semua Vendor'}</strong>
                {selectedItem.hospitalName && ` • Unit: ${selectedItem.hospitalName}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('evidence')}
              className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'evidence'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Daftar Transaksi PO & PR ({relevantRecords.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('formula')}
              className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'formula'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Cara Perhitungan PI-01 s/d PI-06</span>
            </button>

            <button
              onClick={() => setActiveTab('actionScript')}
              className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'actionScript'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Surat Negosiasi & Memo Internal</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-2">
            <button
              onClick={() => copyToClipboard(generateAuditSheetText(), 'audit_summary')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
            >
              {copiedField === 'audit_summary' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Ringkasan Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Toast Notification */}
          {followUpToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{followUpToast}</span>
            </div>
          )}

          {/* TAB 1: EVIDENCE & TRANSACTIONS TABLE */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              {/* Metric Impact Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    {diagnosticConfig.financialImpactLabel}
                  </span>
                  <div className="text-lg font-mono font-bold text-rose-600 mt-0.5">
                    {diagnosticConfig.financialImpactValue}
                  </div>
                  <span className="text-[10px] text-slate-500">Estimasi variansi dari patokan harga wajar</span>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Harga Baseline Acuan (Termurah)
                  </span>
                  <div className="text-lg font-mono font-bold text-emerald-700 mt-0.5">
                    {formatIDR(selectedItem.minPrice || selectedItem.initialPrice || minRecord?.purchPrice || 0)}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {minRecord ? `PO: ${minRecord.purchId} (${minRecord.hospitalCode})` : 'Baseline historis'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Harga Transaksi Tertinggi
                  </span>
                  <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                    {formatIDR(selectedItem.maxPrice || selectedItem.latestPrice || maxRecord?.purchPrice || 0)}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {maxRecord ? `PO: ${maxRecord.purchId} (${maxRecord.hospitalCode})` : 'Puncak kenaikan'}
                  </span>
                </div>
              </div>

              {/* Table Search & Tools */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={poSearch}
                    onChange={(e) => setPoSearch(e.target.value)}
                    placeholder="Cari No PO, No PR, Requester, Dept, Cost Center, RS..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
                  <span>Menampilkan <strong>{filteredRecords.length}</strong> transaksi</span>
                  {relevantRecords.length > 0 && (
                    <button
                      onClick={() => {
                        const poList = relevantRecords.map(r => r.purchId).join(', ');
                        copyToClipboard(poList, 'all_pos_string');
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition-colors cursor-pointer border border-slate-200"
                    >
                      {copiedField === 'all_pos_string' ? 'Tersalin!' : 'Salin Semua No PO'}
                    </button>
                  )}
                </div>
              </div>

              {/* PO & PR Transactions Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Nomor PO & PR ID</th>
                        <th className="py-2.5 px-3">Requester & Departemen</th>
                        <th className="py-2.5 px-3">Unit RS (Kode ERP)</th>
                        <th className="py-2.5 px-3">Vendor</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                        <th className="py-2.5 px-3 text-right">Total Nilai</th>
                        <th className="py-2.5 px-3 text-center">Status Audit</th>
                        <th className="py-2.5 px-3 text-center">Tindak Lanjut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            Tidak ada transaksi PO spesifik yang cocok dengan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r, idx) => {
                          const isMin = minRecord && r.purchId === minRecord.purchId;
                          const isMax = maxRecord && r.purchId === maxRecord.purchId;
                          const hosp = hospMap.get((r.hospitalCode || '').toUpperCase());
                          const erpUnit = hosp?.erpHospitalUnitCode || '0000';
                          const poStatus = followUpStatuses[r.purchId]?.status;

                          return (
                            <tr 
                              key={`${r.purchId}_${idx}`} 
                              className={`transition-colors ${
                                isMax ? 'bg-rose-50/40 hover:bg-rose-50' :
                                isMin ? 'bg-emerald-50/40 hover:bg-emerald-50' :
                                'hover:bg-slate-50'
                              }`}
                            >
                              {/* PO and PR ID Column */}
                              <td className="py-2.5 px-3 font-mono">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-bold text-slate-900">{r.purchId}</span>
                                  <button
                                    onClick={() => copyToClipboard(r.purchId, `po_${r.purchId}`)}
                                    title="Salin Nomor PO"
                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                  >
                                    {copiedField === `po_${r.purchId}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                {r.purchaseReqId && (
                                  <div className="text-[10px] text-purple-700 font-semibold mt-0.5 flex items-center gap-1">
                                    <span className="px-1 py-0.2 bg-purple-50 rounded border border-purple-200">
                                      PR: {r.purchaseReqId}
                                    </span>
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {r.monthYear || r.createdDate}
                                </div>
                              </td>

                              {/* Requester & Department Column */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-purple-500 shrink-0" />
                                  <span className="font-semibold text-slate-900 truncate max-w-[130px]" title={r.requesterName || r.requester || 'User'}>
                                    {r.requesterName || r.requester || 'User Requester'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[130px]" title={r.department || 'General'}>
                                    {r.department || 'General'}
                                  </span>
                                  {r.costCenter && (
                                    <span className="font-mono text-[9px] text-slate-500 bg-slate-50 px-1 py-0.2 rounded border border-slate-200" title={`Cost Center: ${r.costCenter}`}>
                                      CC:{r.costCenter}
                                    </span>
                                  )}
                                </div>
                                {r.prSubject && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-[150px] mt-0.5" title={r.prSubject}>
                                    {r.prSubject}
                                  </div>
                                )}
                              </td>

                              {/* Hospital Unit & ERP Code Column */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-900">{r.hospitalCode}</span>
                                  <span 
                                    className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200"
                                    title={`Kode Unit ERP: ${erpUnit}`}
                                  >
                                    [{erpUnit}]
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block">{hosp?.hospitalName || r.archetype || ''}</span>
                              </td>

                              {/* Vendor Column */}
                              <td className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[130px]" title={r.vendorName}>
                                {r.vendorName}
                              </td>

                              {/* Qty Column */}
                              <td className="py-2.5 px-3 text-right font-mono">
                                {r.purchQty?.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{r.purchUnit || 'unit'}</span>
                              </td>

                              {/* Unit Price Column */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span className={isMax ? 'text-rose-700' : isMin ? 'text-emerald-700' : 'text-slate-900'}>
                                  {formatIDR(r.purchPrice)}
                                </span>
                              </td>

                              {/* Total Amount Column */}
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                {formatIDR(r.totalLineAmount)}
                              </td>

                              {/* Audit Status Badge */}
                              <td className="py-2.5 px-3 text-center">
                                {isMin ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Baseline Termurah
                                  </span>
                                ) : isMax ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Spike Termahal
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] text-slate-500 bg-slate-100">
                                    Transaksional
                                  </span>
                                )}
                              </td>

                              {/* Operational Follow-up Action Column */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setFollowUpRecord(r);
                                    if (onFollowUpPO) onFollowUpPO(r.purchId);
                                  }}
                                  className={`px-2 py-1 font-sans font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto ${
                                    poStatus === 'RESOLVED' 
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                      : poStatus === 'IN_CLARIFICATION'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                                  }`}
                                  title="Buka Mekanisme Tindak Lanjut PO & PR"
                                >
                                  {poStatus === 'RESOLVED' ? (
                                    <>
                                      <CheckCheck className="w-3 h-3 text-emerald-600" />
                                      Selesai
                                    </>
                                  ) : poStatus === 'IN_CLARIFICATION' ? (
                                    <>
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      Klarifikasi
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3 h-3 text-purple-600" />
                                      Follow-up
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OPERATIONAL FOLLOW-UP DOSSIER PANEL (When a PO is selected for follow-up) */}
              {followUpRecord && (
                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 shadow-xs space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                        PO
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Mekanisme Tindak Lanjut Operasional: {followUpRecord.purchId}
                        </h4>
                        <span className="text-[11px] text-purple-800 font-medium">
                          Terhubung ke PR: {followUpRecord.purchaseReqId || 'PR-0000'} • Pemohon: {followUpRecord.requesterName || followUpRecord.requester || 'User'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setFollowUpRecord(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      Tutup Panel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-3 rounded-xl border border-purple-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Requester & User ID</span>
                      <strong className="text-slate-800 font-semibold">{followUpRecord.requesterName || followUpRecord.requester}</strong>
                      <span className="block text-[10px] font-mono text-purple-700">@{followUpRecord.requester}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Departemen & Cost Center</span>
                      <strong className="text-slate-800 font-semibold">{followUpRecord.department || 'General'}</strong>
                      <span className="block text-[10px] font-mono text-slate-600">CC: {followUpRecord.costCenter || '0000'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Unit RS & Kode ERP</span>
                      <strong className="text-slate-800 font-semibold">{followUpRecord.hospitalCode}</strong>
                      <span className="block text-[10px] font-mono text-blue-700">
                        ERP: {hospMap.get((followUpRecord.hospitalCode || '').toUpperCase())?.erpHospitalUnitCode || '0000'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Subject / Project Pembelian</span>
                      <strong className="text-slate-800 font-semibold truncate block" title={followUpRecord.prSubject}>
                        {followUpRecord.prSubject || 'Pengadaan Operasional Unit'}
                      </strong>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">Status Tindak Lanjut:</span>
                      <button
                        onClick={() => handleUpdateFollowUpStatus(followUpRecord.purchId, 'IN_CLARIFICATION', 'Surat klarifikasi diterbitkan ke vendor')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors cursor-pointer border border-amber-200"
                      >
                        Sedang Diklarifikasi
                      </button>
                      <button
                        onClick={() => handleUpdateFollowUpStatus(followUpRecord.purchId, 'RESOLVED', 'Nota kredit / pengembalian selisih disetujui')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors cursor-pointer border border-emerald-200"
                      >
                        Selesai (Nota Kredit)
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(generateInternalMemo(followUpRecord), `memo_${followUpRecord.purchId}`)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        {copiedField === `memo_${followUpRecord.purchId}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Memo Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Salin Memo ke Requester & HOD</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MATHEMATICAL FORMULA & ALL CALCULATION METHODS PI-01 S/D PI-06 */}
          {activeTab === 'formula' && (
            <div className="space-y-5">
              {/* Method Selector Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(['PI-01', 'PI-02', 'PI-03', 'PI-04', 'PI-05', 'PI-06'] as DiagnosticCode[]).map(code => (
                  <button
                    key={code}
                    onClick={() => setViewedFormula(code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      viewedFormula === code
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{code}</span>
                    {viewedFormula === code && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                ))}
              </div>

              {/* Selected Formula Breakdown Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider font-bold">
                    METODOLOGI PERHITUNGAN RESMI
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-bold border border-purple-500/40">
                    {viewedFormula}
                  </span>
                </div>

                <h4 className="text-base font-bold text-white mb-1">
                  {allFormulasCatalog[viewedFormula].title}
                </h4>
                <p className="text-xs text-slate-300 mb-4">
                  {allFormulasCatalog[viewedFormula].subtitle}
                </p>

                {/* Mathematical Formula Display */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-sm sm:text-base font-bold text-purple-300 mb-4">
                  {allFormulasCatalog[viewedFormula].formula}
                </div>

                {/* Calculation Steps */}
                <div className="space-y-1.5 mb-4">
                  <span className="text-xs font-bold text-slate-300 block">Langkah-Langkah Perhitungan Sistem:</span>
                  {allFormulasCatalog[viewedFormula].steps.map((step, sIdx) => (
                    <div key={sIdx} className="text-xs text-slate-300 pl-2">
                      {step}
                    </div>
                  ))}
                </div>

                {/* Real Number Simulation */}
                <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-purple-300 block">Simulasi Perhitungan Riil (Data Terpilih):</span>
                  <p className="text-slate-200 font-mono">{allFormulasCatalog[viewedFormula].exampleCalc}</p>
                </div>
              </div>

              {/* Rules and Governance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Ketentuan Ambang Batas (Threshold Rule)
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                    {allFormulasCatalog[viewedFormula].rule}
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Dampak Finansial & Parameter Audit
                  </h5>
                  <div className="text-xs text-slate-700 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 space-y-1">
                    <span className="font-semibold block text-emerald-900">
                      Metrik: {allFormulasCatalog[viewedFormula].impactLabel}
                    </span>
                    <span className="text-emerald-700 text-xs">
                      Digunakan untuk validasi tagihan faktur, pengajuan nota kredit, dan mitigasi pemborosan biaya pengadaan.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROCUREMENT NEGOTIATION & CLARIFICATION DRAFT */}
          {activeTab === 'actionScript' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Draft Surat Negosiasi & Nota Kredit Vendor
                  </h4>
                  <p className="text-xs text-slate-500">
                    Format surat resmi yang siap dikirimkan kepada tim komersial vendor mencantumkan nomor PO, PR, dan rincian selisih harga.
                  </p>
                </div>

                <button
                  onClick={() => copyToClipboard(generateNegotiationDraft(), 'negotiation_draft')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {copiedField === 'negotiation_draft' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Draft Disalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Surat Resmi</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {generateNegotiationDraft()}
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Audit ID: <span className="font-mono text-slate-700 font-semibold">{diagnosticConfig.code}_{selectedItem.id || 'ITEM'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Tutup Audit
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
