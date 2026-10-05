import React from 'react';
import { X, FileText, Building2, Calendar, DollarSign, Tag, User, CheckCircle2, AlertCircle, AlertTriangle, Layers, Info } from 'lucide-react';
import { SpendRecord, SkuMasterRecord, splitItemNameAndNotes, decomposeSkuString, parseSpecSlots } from '../../../core/types/spend';
import { spendService } from '../services/spendService';

interface TransactionDetailModalProps {
  record: SpendRecord | null;
  skuMasters: SkuMasterRecord[];
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ record, skuMasters, onClose }) => {
  if (!record) return null;

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString()}`;
  const matchedSku = spendService.matchTransactionWithSku(record, skuMasters);
  const { itemName: cleanItemName, itemNotes: extractedNotes, extractedSkuCode } = splitItemNameAndNotes(record.rawItemName || record.itemName);
  const itemNotes = record.itemNotes || extractedNotes;
  const poSkuCode = record.extractedSkuCode || extractedSkuCode;

  // Deconstruct PO item
  const poDecomp = decomposeSkuString(cleanItemName || record.itemName);
  const poSpecParsed = parseSpecSlots(poDecomp.rawSpec || poDecomp.generalSpec);

  // Deconstruct Master SKU if matched
  const masterDecomp = matchedSku ? decomposeSkuString(matchedSku.formattedSkuName || matchedSku.name) : null;
  const masterSpecParsed = matchedSku ? parseSpecSlots(
    matchedSku.generalSpec || 
    masterDecomp?.rawSpec || 
    masterDecomp?.generalSpec || 
    [matchedSku.specification1, matchedSku.specification2, matchedSku.specification3].join(',')
  ) : null;

  // Extract closest candidate SKU if partial orphan
  const candidateIdMatch = record.orphanMatchReason?.match(/(?:Kandidat:\s*\[?|\[)([a-zA-Z0-9_\-\.]+)/i);
  const candidateId = (record.orphanStatus === 'PARTIAL_ORPHAN' ? record.candidateSkuId : null) || (candidateIdMatch ? candidateIdMatch[1] : null);
  const candidateSku = candidateId ? skuMasters.find(s => s.productId === candidateId || s.id === candidateId || s.productId?.toLowerCase() === candidateId.toLowerCase()) : null;
  const candidateDecomp = candidateSku ? decomposeSkuString(candidateSku.formattedSkuName || candidateSku.name) : null;
  const candidateSpecParsed = candidateSku ? parseSpecSlots(
    candidateSku.generalSpec || 
    candidateDecomp?.rawSpec || 
    candidateDecomp?.generalSpec || 
    [candidateSku.specification1, candidateSku.specification2, candidateSku.specification3].join(',')
  ) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Purchase Order Transaction & SKU Master Matching</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* PO Header & Amount */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Purchase Order ID</span>
              <p className="text-base font-mono font-bold text-slate-900">{record.purchId}</p>
              {record.itemId && (
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Item ID: <span className="font-semibold text-slate-700">{record.itemId}</span>
                  <span className="text-[10px] text-slate-400 ml-1.5">(Finance Spending Group)</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Amount</span>
              <p className="text-lg font-bold text-blue-600 font-mono">{formatIDR(record.totalLineAmount)}</p>
            </div>
          </div>

          {/* Hospital & Vendor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Hospital Facility
              </span>
              <p className="text-sm font-bold text-slate-800">{record.hospitalCode}</p>
              <p className="text-xs text-slate-500">{record.archetype}</p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> Vendor Name
              </span>
              <p className="text-sm font-bold text-slate-800">{record.vendorName}</p>
              <p className="text-xs text-slate-500">Payment: {record.paymentTerm}</p>
            </div>
          </div>

          {/* SKU Master Match Status & Orphan Classification */}
          <div className={`p-4 rounded-xl border ${
            matchedSku 
              ? 'bg-emerald-50/60 border-emerald-200' 
              : record.orphanStatus === 'PARTIAL_ORPHAN'
                ? 'bg-amber-50/60 border-amber-300'
                : 'bg-rose-50/60 border-rose-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {matchedSku ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : record.orphanStatus === 'PARTIAL_ORPHAN' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  matchedSku 
                    ? 'text-emerald-900' 
                    : record.orphanStatus === 'PARTIAL_ORPHAN'
                      ? 'text-amber-900'
                      : 'text-rose-900'
                }`}>
                  {matchedSku 
                    ? 'Matched with SKU Master Database' 
                    : record.orphanStatus === 'PARTIAL_ORPHAN'
                      ? 'Partial Orphan Item (Komoditas Terdeteksi Sebagian)'
                      : 'Full Orphan Item (Tidak Ditemukan Kecocokan Master SKU)'}
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                matchedSku 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : record.orphanStatus === 'PARTIAL_ORPHAN'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}>
                {matchedSku 
                  ? (record.orphanStatus === 'EXACT_MATCH' || (record.orphanConfidenceScore ?? 0) === 100 
                      ? 'Exact Match (100%)' 
                      : (record.orphanMatchReason?.includes('Manual') ? 'Reconciled (Manual)' : 'Matched')) 
                  : record.orphanStatus === 'PARTIAL_ORPHAN'
                    ? `Partial Orphan (${record.orphanConfidenceScore || 0}%)`
                    : 'Full Orphan'}
              </span>
            </div>

            {matchedSku ? (
              <div className="space-y-3 text-xs text-emerald-950">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-emerald-700 block text-[11px] font-medium">Master Product ID</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{matchedSku.productId}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[11px] font-medium">Brand & Part Number</span>
                    <span className="font-semibold text-slate-800">{matchedSku.brand} ({matchedSku.partNumber})</span>
                  </div>
                </div>

                <div>
                  <span className="text-emerald-700 block text-[11px] font-medium">Formatted SKU Name Syntax</span>
                  <div className="bg-white/90 p-2 rounded-lg font-mono text-[11px] text-slate-800 border border-emerald-200 mt-0.5">
                    {matchedSku.formattedSkuName}
                  </div>
                </div>

                {/* 4-Component Matching Breakdown with 3-Slot Specification Form */}
                <div className="p-3 bg-white/95 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Komparasi 4 Komponen SKU & Form Spesifikasi 3-Slot
                    </span>
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      Cocok Sempurna
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    {/* Komoditas */}
                    <div className="flex items-start justify-between py-1 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">1. Komoditas (Level 5):</span>
                        <span className="font-semibold text-slate-800 font-mono">{poDecomp.commodityItem}</span>
                      </div>
                      <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">Identik</span>
                    </div>

                    {/* 3-Slot Specification */}
                    <div className="py-1 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">2. Spesifikasi (Form 3-Slot Comma-Separated):</span>
                        <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">Normalisasi 3-Slot Cocok</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                        <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[8px] text-slate-400 block font-semibold uppercase">Spec 1 (Utama):</span>
                          <span className="font-mono font-bold text-slate-800 text-[10px]">
                            {poSpecParsed.spec1 || masterSpecParsed?.spec1 || '-'}
                          </span>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[8px] text-slate-400 block font-semibold uppercase">Spec 2:</span>
                          <span className="font-mono text-slate-600 text-[10px]">
                            {poSpecParsed.spec2 || masterSpecParsed?.spec2 || <span className="text-slate-400 italic text-[9px]">(Blank / NA)</span>}
                          </span>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[8px] text-slate-400 block font-semibold uppercase">Spec 3:</span>
                          <span className="font-mono text-slate-600 text-[10px]">
                            {poSpecParsed.spec3 || masterSpecParsed?.spec3 || <span className="text-slate-400 italic text-[9px]">(Blank / NA)</span>}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 text-[9px] text-emerald-700 flex items-center gap-1 italic">
                        <Info className="w-3 h-3 text-emerald-500 shrink-0" />
                        Form spesifikasi terdiri dari 3 slot. Nilai strip (&quot;-&quot;) atau titik (&quot;.&quot;) dinormalkan otomatis menjadi blank/NA sehingga PO &amp; Master SKU berpasangan secara equal.
                      </div>
                    </div>

                    {/* Brand & Part Number */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">3. Brand / Label:</span>
                        <span className="font-mono text-slate-700 font-semibold">{poDecomp.brand || matchedSku.brand || 'NB'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">4. Part Number:</span>
                        <span className="font-mono text-slate-700 font-semibold">{poDecomp.partNumber || matchedSku.partNumber || 'NP'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {record.orphanStatus === 'PARTIAL_ORPHAN' && candidateId && (
                  <div className="p-2.5 bg-amber-100/70 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                        <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Kandidat Saran (Belum Dikonfirmasi):</span>
                        <span className="font-mono px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-bold">{candidateId}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                        {record.matchTier || 'PARTIAL_ORPHAN'} (Saran Manual)
                      </span>
                    </div>
                    <p className="text-[10px] mt-1 text-amber-800 leading-snug">
                      Item ini belum terhubung resmi ke Master SKU dan belum mewarisi taksonomi master. ID kandidat disimpan sebagai usulan untuk verifikasi manual di menu Data Maintenance.
                    </p>
                  </div>
                )}
                <p className={`${record.orphanStatus === 'PARTIAL_ORPHAN' ? 'text-amber-800' : 'text-rose-800'}`}>
                  {record.orphanMatchReason || (
                    record.orphanStatus === 'PARTIAL_ORPHAN'
                      ? 'Item terdeteksi memiliki kemiripan pada nama komoditas dasar (Level 5), namun spesifikasi, brand, atau part number belum cocok 100%.'
                      : 'Item tidak memiliki kecocokan terhadap seluruh komponen Master SKU (Komoditas, Spec, Brand, Part Number).'
                  )}
                </p>
                <div className="p-2.5 bg-white/80 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hasil Dekomposisi String SKU Transaksi:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px]">1. Komoditas (Lv 5):</span>
                      <strong className="text-slate-800 font-mono">{poDecomp.commodityItem || record.itemName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">2. Spesifikasi:</span>
                      <span className="text-slate-700 font-mono">{poSpecParsed.normalized || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">3. Brand/Label:</span>
                      <span className="text-slate-700 font-mono">{poDecomp.brand || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">4. Part Number:</span>
                      <span className="text-slate-700 font-mono">{poDecomp.partNumber || '-'}</span>
                    </div>
                  </div>

                  {/* 3 Spec Slots breakdown */}
                  <div className="pt-1.5 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-semibold uppercase">Slot Form Spesifikasi (3-Slot):</span>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      <div className="p-1 bg-slate-50 rounded border border-slate-200 text-[10px]">
                        <span className="text-[8px] text-slate-400 block">Spec 1:</span>
                        <span className="font-mono text-slate-700">{poSpecParsed.spec1 || <span className="text-slate-400 italic text-[9px]">(Blank / NA)</span>}</span>
                      </div>
                      <div className="p-1 bg-slate-50 rounded border border-slate-200 text-[10px]">
                        <span className="text-[8px] text-slate-400 block">Spec 2:</span>
                        <span className="font-mono text-slate-700">{poSpecParsed.spec2 || <span className="text-slate-400 italic text-[9px]">(Blank / NA)</span>}</span>
                      </div>
                      <div className="p-1 bg-slate-50 rounded border border-slate-200 text-[10px]">
                        <span className="text-[8px] text-slate-400 block">Spec 3:</span>
                        <span className="font-mono text-slate-700">{poSpecParsed.spec3 || <span className="text-slate-400 italic text-[9px]">(Blank / NA)</span>}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Scoring Diagnostic vs Closest Candidate */}
                {candidateSku && (
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-1">
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-amber-600" />
                        Analisis Skor Kecocokan vs Kandidat Terdekat [{candidateSku.productId}]
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        Skor: {record.orphanConfidenceScore || 50}%
                      </span>
                    </div>

                    <div className="space-y-1.5 text-slate-700">
                      <div className="flex items-center justify-between py-0.5 border-b border-amber-100/80">
                        <div>
                          <span className="font-semibold text-slate-800">1. Komoditas (Bobot 50%):</span>
                          <span className="font-mono ml-1.5 text-slate-600">PO: &quot;{poDecomp.commodityItem}&quot; vs Master: &quot;{candidateDecomp?.commodityItem || candidateSku.name}&quot;</span>
                        </div>
                        <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">+50% (Cocok)</span>
                      </div>

                      <div className="flex items-center justify-between py-0.5 border-b border-amber-100/80">
                        <div>
                          <span className="font-semibold text-slate-800">2. Spesifikasi (Bobot 30%):</span>
                          <span className="font-mono ml-1.5 text-slate-600">PO: &quot;{poSpecParsed.normalized || '-'}&quot; vs Master: &quot;{candidateSpecParsed?.normalized || '-'}&quot;</span>
                        </div>
                        <span className="text-rose-600 font-bold text-[10px] bg-rose-50 px-1.5 py-0.5 rounded shrink-0">0% (Berbeda)</span>
                      </div>

                      <div className="flex items-center justify-between py-0.5 border-b border-amber-100/80">
                        <div>
                          <span className="font-semibold text-slate-800">3. Brand/Label (Bobot 10%):</span>
                          <span className="font-mono ml-1.5 text-slate-600">PO: &quot;{poDecomp.brand || '-'}&quot; vs Master: &quot;{candidateDecomp?.brand || candidateSku.brand || '-'}&quot;</span>
                        </div>
                        <span className="text-rose-600 font-bold text-[10px] bg-rose-50 px-1.5 py-0.5 rounded shrink-0">0% (Berbeda)</span>
                      </div>

                      <div className="flex items-center justify-between py-0.5">
                        <div>
                          <span className="font-semibold text-slate-800">4. Part Number (Bobot 10%):</span>
                          <span className="font-mono ml-1.5 text-slate-600">PO: &quot;{poDecomp.partNumber || '-'}&quot; vs Master: &quot;{candidateDecomp?.partNumber || candidateSku.partNumber || '-'}&quot;</span>
                        </div>
                        <span className="text-rose-600 font-bold text-[10px] bg-rose-50 px-1.5 py-0.5 rounded shrink-0">0% (Berbeda)</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-amber-800 italic pt-1 border-t border-amber-200">
                      💡 <strong>Catatan:</strong> Transaksi PO memiliki spesifikasi khusus (&quot;ELECTRICAL SERVICES&quot;) dan mencantumkan nama vendor pelaksana (&quot;PT. AYUNG DEWATA MEGAPUTRA&quot;) di slot Brand, sedangkan Master SKU kandidat [{candidateSku.productId}] hanya terdaftar sebagai nama umum &quot;INSTALASI&quot; tanpa spesifikasi tersebut.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5-Level Taxonomy Hierarchy */}
          {(() => {
            const isFullOrphan = record.orphanStatus === 'FULL_ORPHAN' || (!matchedSku && record.orphanStatus !== 'PARTIAL_ORPHAN');
            const isPartialOrphan = record.orphanStatus === 'PARTIAL_ORPHAN';
            const poPurchaseCat = (record.purchaseCategory || record.procurementCategory || record.mappedCategory || 'General Supplies').trim();
            const poCategory = (record.procurementCategory || record.mappedCategory || 'General Supplies').trim();

            let taxLv1 = '';
            let taxLv2 = '';
            let taxLv3 = '';
            let taxLv4 = '';

            if (matchedSku) {
              taxLv1 = matchedSku.purchCategoryLv1 || 'General';
              taxLv2 = matchedSku.purchCategoryLv2 || 'Medical & Hospital Supplies';
              taxLv3 = matchedSku.purchCategoryLv3 || 'General Consumables';
              taxLv4 = matchedSku.purchCategoryLv4 || taxLv1;
            } else if (isPartialOrphan) {
              // Partial Orphan remains UNMAPPED / ORPHAN PO for taxonomy; candidateSku is just a suggestion
              taxLv1 = (record.taxonomyLv1 && record.taxonomyLv1 !== 'UNMAPPED / ORPHAN PO' && record.taxonomyLv1 !== 'ORPHAN') 
                ? record.taxonomyLv1 
                : 'UNMAPPED / ORPHAN PO';
              taxLv2 = (record.taxonomyLv2 && record.taxonomyLv2 !== 'UNMAPPED / ORPHAN PO' && record.taxonomyLv2 !== 'ORPHAN')
                ? record.taxonomyLv2
                : (poPurchaseCat || 'Partial Orphan');
              taxLv3 = record.taxonomyLv3 || taxLv2;
              taxLv4 = record.taxonomyLv4 || taxLv3;
            } else {
              // Full Orphan: Level 1 is UNMAPPED / ORPHAN PO
              taxLv1 = 'UNMAPPED / ORPHAN PO';
              taxLv2 = poPurchaseCat || 'Full Orphan';
              taxLv3 = poPurchaseCat || 'Full Orphan';
              taxLv4 = poPurchaseCat || 'Full Orphan';
            }

            return (
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">5-Level Procurement Taxonomy Hierarchy</h4>
                  </div>
                  {isFullOrphan && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Full Orphan: Lv 1 ORPHAN, Lv 2-4 PO Category ({poPurchaseCat})
                    </span>
                  )}
                  {isPartialOrphan && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Partial Orphan: Tetap di Kategori Pengadaan ({taxLv1})
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className={`p-2.5 rounded-lg border ${isFullOrphan ? 'bg-rose-50/60 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase flex items-center justify-between">
                      <span>Level 1 Category</span>
                      {isFullOrphan && <span className="text-rose-600 font-mono font-bold text-[9px] uppercase">Unmapped</span>}
                    </span>
                    <span className={`font-semibold ${isFullOrphan ? 'text-rose-700 font-bold' : 'text-slate-800'}`}>{taxLv1}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase flex items-center justify-between">
                      <span>Level 2 Category</span>
                      {isFullOrphan && <span className="text-slate-400 text-[9px]">PO Purchase Category</span>}
                    </span>
                    <span className="font-semibold text-slate-800">{taxLv2}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase flex items-center justify-between">
                      <span>Level 3 Category</span>
                      {isFullOrphan && <span className="text-slate-400 text-[9px]">PO Purchase Category</span>}
                    </span>
                    <span className="font-semibold text-slate-800">{taxLv3}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase flex items-center justify-between">
                      <span>Level 4 Category</span>
                      {isFullOrphan && <span className="text-slate-400 text-[9px]">PO Purchase Category</span>}
                    </span>
                    <span className="font-semibold text-slate-800">{taxLv4}</span>
                  </div>
                </div>

                {/* Level 5 */}
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                  <span className="text-[10px] text-blue-600 font-bold block uppercase">Level 5 (Item Name & Specification)</span>
                  <p className="text-sm font-extrabold text-blue-950 mt-0.5">{cleanItemName || record.itemName}</p>
                  {poSkuCode && (
                    <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs flex items-center justify-between">
                      <span className="text-indigo-700 font-medium flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        Kode SKU Master Terdeteksi (delimiter <code className="font-mono bg-indigo-100 px-1 py-0.2 rounded text-[11px]">::</code>):
                      </span>
                      <span className="font-mono font-bold text-indigo-950 bg-white px-2.5 py-0.5 rounded border border-indigo-200 shadow-2xs">
                        {poSkuCode}
                      </span>
                    </div>
                  )}
                  {itemNotes && (
                    <div className="mt-2 pt-2 border-t border-blue-200/60 text-[11px] text-slate-600">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Catatan PO (Baris Baru / Note Diabaikan dari Pencocokan Master SKU):</span>
                      <p className="italic text-slate-700 whitespace-pre-wrap mt-0.5 bg-white/70 p-2 rounded-lg border border-blue-100">{itemNotes}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Quantity: <span className="font-bold">{record.purchQty} {record.purchUnit}</span> | Unit Price: <span className="font-bold">{formatIDR(record.purchPrice)}</span>
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

