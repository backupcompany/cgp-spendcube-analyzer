import React from 'react';
import { 
  X, 
  Sparkles, 
  FileSpreadsheet, 
  Database, 
  HelpCircle, 
  Calculator, 
  ChevronRight, 
  HardDrive, 
  Tag, 
  FolderTree 
} from 'lucide-react';
import { SkuMasterRecord } from '../../../../core/types/spend';
import { UniqueItemMappingSummary, getPillarBreakdown } from './types';
import { getUnifiedStatusBadge } from './AuditTableModule';

interface AuditDetailModalProps {
  item: UniqueItemMappingSummary;
  onClose: () => void;
  skuMasterByIdMap: Map<string, SkuMasterRecord>;
  skuMasterByCommodityMap: Map<string, SkuMasterRecord>;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
  item,
  onClose,
  skuMasterByIdMap,
  skuMasterByCommodityMap
}) => {
  let activeTargetSku = item.matchedSku || item.targetSku;
  if (!activeTargetSku && item.matchedSkuId) {
    activeTargetSku = skuMasterByIdMap.get(item.matchedSkuId) || skuMasterByIdMap.get(item.matchedSkuId.toLowerCase().trim());
  }
  if (!activeTargetSku && item.matchReason) {
    const candidateMatch = item.matchReason.match(/(?:Kandidat:\s*\[?|\[)([a-zA-Z0-9_\-\.]+)/i);
    if (candidateMatch && candidateMatch[1]) {
      const candId = candidateMatch[1].trim();
      activeTargetSku = skuMasterByIdMap.get(candId) || skuMasterByIdMap.get(candId.toLowerCase().trim());
    }
  }
  if (!activeTargetSku && (item.poCommodity || item.primaryItemName)) {
    const commSearch = (item.poCommodity || item.primaryItemName).toLowerCase().trim();
    activeTargetSku = skuMasterByCommodityMap.get(commSearch);
  }

  // Resolve Final Category & Taxonomy
  const finalCategoryLv1 = (
    activeTargetSku?.purchCategoryLv1 || 
    (item.taxonomyLv1 && item.taxonomyLv1 !== 'UNMAPPED / ORPHAN PO' && item.taxonomyLv1 !== 'ORPHAN' ? item.taxonomyLv1 : '') || 
    'General Supplies'
  ).trim();
  const finalCategoryLv2 = (activeTargetSku?.purchCategoryLv2 || (item.taxonomyLv2 !== '-' ? item.taxonomyLv2 : '') || finalCategoryLv1).trim();
  const finalCategoryLv3 = (activeTargetSku?.purchCategoryLv3 || (item.taxonomyLv3 !== '-' ? item.taxonomyLv3 : '') || finalCategoryLv2).trim();
  const finalCategoryLv4 = (activeTargetSku?.purchCategoryLv4 || (item.taxonomyLv4 !== '-' ? item.taxonomyLv4 : '') || finalCategoryLv3).trim();
  const finalCategoryLv5 = (activeTargetSku?.commodityItem || activeTargetSku?.name || item.taxonomyLv5 || item.poCommodity || item.primaryItemName).trim();

  // Compute 4 Pillar details & reasons
  const { pillars, accuracyFormula } = getPillarBreakdown(item, activeTargetSku);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              Audit Hasil Pencocokan 4 Pilar
            </span>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {item.primaryItemName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Top Score Summary Banner */}
          {(() => {
            const status = getUnifiedStatusBadge(item);
            return (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.badgeBg} ${status.badgeText} ${status.badgeBorder} shadow-2xs`}>
                      <span className={`w-2 h-2 rounded-full ${status.dotColor} shrink-0`}></span>
                      <span>{status.fullLabel}</span>
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">
                      Akurasi: {item.confidenceScore}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {item.matchReason}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2 text-xs font-semibold">
                  <span className="text-slate-500">Status Harddisk:</span>
                  {item.isPersistedInDisk ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      <HardDrive className="w-3.5 h-3.5" />
                      Tersimpan di IndexedDB
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Final Category & Taxonomy Resolution Card */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Klasifikasi Kategori & Taksonomi Akhir (Final Resolved Category)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Kategori hasil standarisasi pengadaan berdasarkan pemetaan Master Data SKU
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className="text-[10px] uppercase font-bold text-slate-500">Kategori Pengadaan Lv 1:</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-600 text-white shadow-xs">
                  {finalCategoryLv1}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* 5-Level Hierarchy Breadcrumb */}
              <div className="bg-white p-3 rounded-lg border border-indigo-100 space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-500" />
                  Alur Hierarki Taksonomi Standar (Level 1 s/d Level 5):
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-800 font-medium">
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200">
                    Lv 1: {finalCategoryLv1}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Lv 2: {finalCategoryLv2}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Lv 3: {finalCategoryLv3}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Lv 4: {finalCategoryLv4}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-900 font-bold border border-blue-200">
                    Lv 5: {finalCategoryLv5}
                  </span>
                </div>
              </div>

              {/* Origin and Justification */}
              <div className="bg-white p-3 rounded-lg border border-indigo-100 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Dasar Penentuan Kategori:
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {activeTargetSku ? (
                    <>
                      Kategori ini diadopsi langsung dari <strong className="text-indigo-900 font-bold">Master Data SKU [{activeTargetSku.productId || activeTargetSku.id}]</strong> karena tingkat kecocokan sebesar <strong className="text-emerald-700 font-bold">{item.confidenceScore}%</strong>. Seluruh laporan spendcube mengelompokkan item transaksi ini ke dalam kategori <strong>{finalCategoryLv1}</strong>.
                    </>
                  ) : (
                    <>
                      Belum ada kandidat Master SKU yang cocok. Kategori mengacu pada klasifikasi bawaan transaksi Purchase Order (PO).
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Side-by-Side Comparison Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: PO Item Components */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  Input dari Transaksi PO
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  Frekuensi: {item.transactionCount}x Transaksi
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Nama Barang Bersih (Dibersihkan dari PO):</span>
                  <p className="font-semibold text-slate-900">{item.primaryItemName}</p>
                </div>

                {item.itemNotes && (
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Catatan Baris Baru (Terpisah):</span>
                    <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] whitespace-pre-line">
                      {item.itemNotes}
                    </p>
                  </div>
                )}

                {item.extractedSkuCode && (
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Kode SKU Terekstrak (::):</span>
                    <p className="font-mono text-blue-700 font-semibold">{item.extractedSkuCode}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">1. Komoditas PO:</span>
                    <p className="font-semibold text-slate-800">{item.poCommodity || '-'}</p>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">2. Spec PO:</span>
                    <p className="font-semibold text-slate-800">{item.poSpec || '-'}</p>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">3. Brand PO:</span>
                    <p className="font-semibold text-slate-800">{item.poBrand || '-'}</p>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">4. Part Number PO:</span>
                    <p className="font-semibold text-slate-800">{item.poPartNumber || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Master SKU Components */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Target Master Data SKU
                  </h4>
                </div>
                {activeTargetSku && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    item.orphanStatus === 'EXACT_MATCH'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {item.orphanStatus === 'EXACT_MATCH' ? 'Master Identik' : 'Kandidat Terdekat'} [{activeTargetSku.productId || activeTargetSku.id}]
                  </span>
                )}
              </div>

              {activeTargetSku ? (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Nama Standar Kanonikal Master:</span>
                    <p className="font-semibold text-slate-900">
                      {activeTargetSku.formattedSkuName || activeTargetSku.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">1. Komoditas Master:</span>
                      <p className="font-semibold text-slate-800">{activeTargetSku.commodityItem || activeTargetSku.name || '-'}</p>
                    </div>
                    <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">2. Spec Master:</span>
                      <p className="font-semibold text-slate-800">{activeTargetSku.generalSpec || activeTargetSku.specification1 || '-'}</p>
                    </div>
                    <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">3. Brand Master:</span>
                      <p className="font-semibold text-slate-800">{activeTargetSku.brand || '-'}</p>
                    </div>
                    <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">4. Part Number Master:</span>
                      <p className="font-semibold text-slate-800">{activeTargetSku.partNumber || '-'}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-slate-400">Kategori Master: </span>
                      <strong className="text-slate-800">{activeTargetSku.purchCategoryLv1 || '-'}</strong>
                    </div>
                    {activeTargetSku.unitOfMeasurement && (
                      <div>
                        <span className="text-slate-400">Satuan (UOM): </span>
                        <span className="font-mono font-bold text-blue-700">{activeTargetSku.unitOfMeasurement}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
                  Belum ada Master SKU yang dipasangkan (Full Orphan).
                </div>
              )}
            </div>
          </div>

          {/* Dynamic 4-Pillar Score Breakdown: Mengapa Akurasi 75% */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Analisis Bobot Algoritma 4 Pilar (Mengapa Akurasi {item.confidenceScore}%)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Rincian skor per komponen berdasarkan evaluasi PO vs Master Data SKU
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                {accuracyFormula}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {pillars.map((p, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">{p.pillarName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${p.badgeClass}`}>
                        {p.statusBadge}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-500">Skor Diperoleh:</span>
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {p.score} / {p.max}%
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          p.pct === 100 ? 'bg-emerald-500' : p.pct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                    {p.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
