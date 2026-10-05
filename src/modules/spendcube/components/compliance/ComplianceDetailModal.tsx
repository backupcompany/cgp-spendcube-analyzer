import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Building2, 
  User, 
  Calendar, 
  Copy, 
  ExternalLink,
  Layers,
  ArrowRight,
  Info,
  DollarSign,
  Package,
  ShieldCheck,
  Tag,
  FileSpreadsheet,
  Terminal,
  Check,
  HelpCircle,
  Hash,
  Database,
  SearchCode,
  FileCheck2,
  FileX2,
  Sparkles
} from 'lucide-react';
import { 
  PoLineComplianceRecord, 
  COMPLIANCE_CATEGORIES 
} from '../../services/skuPoComplianceService';

interface ComplianceDetailModalProps {
  record: PoLineComplianceRecord | null;
  onClose: () => void;
}

export const ComplianceDetailModal: React.FC<ComplianceDetailModalProps> = ({
  record,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'comparison' | 'rawTracing'>('comparison');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedRawCell, setCopiedRawCell] = useState(false);

  if (!record) return null;

  const categoryMeta = COMPLIANCE_CATEGORIES[record.category];
  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  const rawCellText = record.poRawItemName || record.poItemName || '';
  const isRawDifferentFromClean = Boolean(record.poRawItemName && record.poRawItemName !== record.poItemName);
  const hasExtractedNotes = Boolean(record.itemNotes);
  const hasRawItemId = Boolean(record.itemId && record.itemId.trim() && !['ITEM-MISC', 'GENERAL', 'MISC', 'UNKNOWN', '-', 'NONE', '0', '0000'].includes(record.itemId.toUpperCase()));

  // Intelligent Root Cause & File Integrity Diagnosis
  const getFileIntegrityDiagnosis = () => {
    switch (record.category) {
      case 'MATCH_EXACT':
        return {
          verdict: 'Data Valid & Format File Unggahan Sudah Benar',
          badgeText: 'File Unggahan Sesuai Standar',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: FileCheck2,
          iconClass: 'text-emerald-600',
          analysis: 'Data pada file upload yang diunggah pengguna sudah benar dan memenuhi tata kelola katalog MDM Siloam. Kode SKU valid dan teks deskripsi identik dengan master data.',
          isUploadError: false,
          recommendation: 'Data sudah akurat. Tidak ada kesalahan pada file Excel maupun master data.'
        };
      case 'MATCH_CODE_DIFF_DESC':
        return {
          verdict: 'File Upload Memuat Perbedaan Teks Deskripsi (Diedit Manual)',
          badgeText: 'Deskripsi File Diubah Manual',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: AlertTriangle,
          iconClass: 'text-amber-600',
          analysis: 'Kode SKU pada file upload sudah benar dan terdaftar di MDM, namun teks pada kolom deskripsi file Excel telah diedit atau menyimpang dari nama standar katalog.',
          isUploadError: true,
          recommendation: 'Periksa file asal Excel. Pastikan nama barang tidak ditambahkan singkatan atau keterangan custom yang mengubah nama baku MDM.'
        };
      case 'CODE_NOT_IN_MDM':
        return {
          verdict: 'Anomali File Upload: Kode SKU Tidak Terdaftar di MDM',
          badgeText: 'Kemungkinan Salah Ketik pada File Upload',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: FileX2,
          iconClass: 'text-rose-600',
          analysis: `File upload mencantumkan kode "${record.poSkuCode}", namun kode tersebut tidak ditemukan pada database Master MDM Siloam. Hal ini mengindikasikan salah ketik kode pada file Excel atau SKU baru belum didaftarkan.`,
          isUploadError: true,
          recommendation: 'Lacak cell asli pada file upload. Jika salah ketik, perbaiki kode SKU di file PO. Jika kode sudah benar dari vendor/ERP tetapi belum ada di MDM, daftarkan ke Master Data Hub.'
        };
      case 'MATCH_NAME_ONLY':
        return {
          verdict: 'File Upload Tanpa Kode SKU (Nama Barang Cocok)',
          badgeText: 'File Belum Mencantumkan Kode SKU',
          badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
          icon: Info,
          iconClass: 'text-sky-600',
          analysis: 'Nama barang pada cell file Excel sudah cocok persis dengan Master SKU, tetapi penginput dokumen tidak mencantumkan kode SKU resmi pada baris PO ini.',
          isUploadError: false,
          recommendation: 'Data barang di file upload sebenarnya sudah benar secara substansi. Untuk penertiban ke depan, koordinasikan dengan petugas agar selalu memilih kode SKU resmi.'
        };
      case 'PARTIAL_MATCH':
        return {
          verdict: 'File Upload Menggunakan Teks Bebas Mirip Master SKU',
          badgeText: 'Format Teks Kurang Spesifik',
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: AlertTriangle,
          iconClass: 'text-purple-600',
          analysis: 'Cell file upload memuat kata kunci yang mirip dengan Master SKU katalog, namun tidak menggunakan tata nama baku sehingga sistem hanya dapat mencocokkan secara parsial.',
          isUploadError: true,
          recommendation: 'Cek isi cell asli pada file Excel. Konfirmasikan apakah barang yang dimaksud identik dengan Master SKU yang disarankan dan lengkapi kode resminya.'
        };
      case 'UNMATCHED_NO_SKU':
      default:
        return {
          verdict: 'Item Bebas (Free-Text): Tidak Ada Kode & Belum di MDM',
          badgeText: 'Item Belum Terdaftar di MDM / Free-Text',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: HelpCircle,
          iconClass: 'text-slate-600',
          analysis: 'Cell pada file upload hanya berisi teks pengadaan umum tanpa kode SKU dan tidak ditemukan padanan nama pada katalog Master MDM yang saat ini aktif.',
          isUploadError: false,
          recommendation: 'Telusuri apakah transaksi ini merupakan pengadaan ad-hoc/jasa non-katalog atau barang operasional baru yang memerlukan nomor SKU resmi dari tim MDM.'
        };
    }
  };

  const diagnosis = getFileIntegrityDiagnosis();

  const handleCopySummary = () => {
    const summary = `
[Audit Compliance SKU to PO]
Nomor PO: ${record.purchId} (Line ${record.lineNumber})
Tanggal: ${record.createdDate}
Hospital: ${record.hospitalCode}
Petugas / Requester: ${record.requesterName || record.requester}
Status: ${categoryMeta.label}
Kode SKU PO: ${record.poSkuCode || '(Tidak ada)'}
Deskripsi PO: ${record.poItemName}
Original Cell (Excel): ${rawCellText}
File Sumber: ${record.sourceFileName || 'ERP Ingestion'}
Master SKU: ${record.matchedMaster?.name || '(Tidak ada / Belum terdaftar)'}
Temuan: ${record.findingNote}
Diagnosa Integritas: ${diagnosis.verdict}
Tindakan: ${record.actionRequired}
    `.trim();

    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyRawCell = () => {
    navigator.clipboard.writeText(rawCellText);
    setCopiedRawCell(true);
    setTimeout(() => setCopiedRawCell(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-start justify-between shrink-0">
          <div className="space-y-1.5">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-mono text-xs font-bold text-blue-300 bg-blue-950/80 px-2.5 py-0.5 rounded-lg border border-blue-800">
                PO: {record.purchId} • Line #{record.lineNumber}
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${categoryMeta.badgeBg} ${categoryMeta.badgeText} ${categoryMeta.badgeBorder}`}>
                {categoryMeta.shortLabel}
              </span>
              {record.sourceFileName && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 truncate max-w-[220px]" title={record.sourceFileName}>
                  📁 {record.sourceFileName}
                </span>
              )}
            </div>
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Audit Kesesuaian Master SKU terhadap PO Line
            </h3>
            <p className="text-xs text-slate-400">
              Evaluasi kepatuhan penggunaan katalog MDM & pelacakan konten asli cell unggahan
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100/90 px-6 pt-2 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'comparison'
                ? 'bg-white text-slate-900 border-slate-200 shadow-2xs -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Komparasi MDM & Temuan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rawTracing')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'rawTracing'
                ? 'bg-white text-slate-900 border-slate-200 shadow-2xs -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Original Cell Content & Tracing Upload</span>
            {isRawDifferentFromClean && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Teks asli berbeda dari hasil ekstraksi" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Finding & Status Banner */}
          <div className={`p-4 rounded-2xl border ${categoryMeta.badgeBorder} ${categoryMeta.badgeBg} space-y-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {record.isMatched ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <h4 className="text-sm font-extrabold text-slate-900">
                  {categoryMeta.label}
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diagnosis.badgeClass}`}>
                {diagnosis.badgeText}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {record.findingNote}
            </p>
            {record.diffDescription && (
              <div className="p-2.5 bg-white/80 rounded-xl border border-amber-200 text-xs text-amber-900 font-mono">
                {record.diffDescription}
              </div>
            )}
            <div className="pt-1 text-[11px] text-slate-600 flex items-center gap-1.5">
              <strong className="text-slate-800">Rekomendasi Tindakan:</strong>
              <span>{record.actionRequired}</span>
            </div>
          </div>

          {/* TAB 1: Komparasi MDM & Temuan */}
          {activeTab === 'comparison' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Quick Tracing Highlight Callout */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <SearchCode className="w-4 h-4 text-blue-600" />
                    <span>Tracing Konten Cell Asli (Raw Excel):</span>
                  </div>
                  <p className="text-xs font-mono text-slate-600 line-clamp-1 max-w-xl" title={rawCellText}>
                    "{rawCellText}"
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('rawTracing')}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
                >
                  <span>Buka Tracing Lengkap</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Card: Dokumen PO Line */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Data Dokumen PO Line</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white text-blue-700 px-2 py-0.5 rounded border border-slate-200">
                      Unit: {record.hospitalCode}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Deskripsi pada PO:</span>
                      <p className="font-bold text-slate-900 mt-0.5">{record.poItemName}</p>
                      {record.poRawItemName && record.poRawItemName !== record.poItemName && (
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 italic">
                          Raw Cell: {record.poRawItemName}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Kode SKU PO:</span>
                        <p className="font-mono font-bold text-blue-700 mt-0.5">
                          {record.poSkuCode || <span className="text-slate-400 font-normal italic">Tidak tercantum</span>}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tanggal PO:</span>
                        <p className="font-mono text-slate-800 mt-0.5">{record.createdDate}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Pengguna / Requester:</span>
                        <p className="font-semibold text-slate-800 mt-0.5 truncate" title={record.requesterName}>
                          {record.requesterName}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Departemen:</span>
                        <p className="text-slate-700 mt-0.5 truncate">{record.department}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Kuantitas & Harga:</span>
                        <p className="font-mono text-slate-800 mt-0.5">
                          {record.purchQty} {record.purchUnit || 'unit'} x {formatIDR(record.purchPrice)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Spend Line:</span>
                        <p className="font-mono font-bold text-emerald-700 mt-0.5">
                          {formatIDR(record.totalLineAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Master Data SKU (MDM) */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Katalog Master SKU MDM</span>
                    </span>
                    {record.matchedMaster ? (
                      <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                        MDM Terdaftar
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                        Tidak Ditemukan
                      </span>
                    )}
                  </div>

                  {record.matchedMaster ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Nama Master SKU MDM:</span>
                        <p className="font-bold text-slate-900 mt-0.5">{record.matchedMaster.name}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Product ID Resmi:</span>
                          <p className="font-mono font-bold text-emerald-700 mt-0.5">
                            {record.matchedMaster.productId || record.matchedMaster.id}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Brand / Pabrikan:</span>
                          <p className="text-slate-800 mt-0.5">{record.matchedMaster.brand || '-'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Kategori Lv1:</span>
                          <p className="text-slate-700 mt-0.5 truncate">{record.matchedMaster.purchCategoryLv1 || '-'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Komoditas Lv5:</span>
                          <p className="text-slate-700 mt-0.5 truncate">{record.matchedMaster.commodityItem || '-'}</p>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Harga Standar ERP:</span>
                        <p className="font-mono font-semibold text-slate-800 mt-0.5">
                          {record.matchedMaster.standardPrice ? formatIDR(record.matchedMaster.standardPrice) : '-'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 mx-auto flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          Master SKU Belum Ditemukan
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                          Item ini belum terdaftar pada file katalog MDM yang diunggah ke aplikasi. Daftarkan terlebih dahulu di Master Data Hub.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* User Disclaimer Note */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Pemberitahuan Audit:</strong> Petugas/Pengguna yang ditampilkan adalah pihak yang tercatat pada dokumen pengadaan (Requester / PO Preparer). Informasi ini dimaksudkan untuk memfasilitasi koordinasi dan pelatihan pemakaian katalog SKU, bukan untuk menetapkan kesalahan sepihak.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Original Cell Content & Tracing Upload */}
          {activeTab === 'rawTracing' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* 1. Tracing Root Cause & Data Integrity Verdict */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <SearchCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Diagnosa Tracing: Integritas File Upload vs Master Data
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Analisis apakah kendala kepatuhan disebabkan oleh file yang diunggah atau memang data sudah benar
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${diagnosis.badgeClass} flex items-center gap-1`}>
                    <diagnosis.icon className="w-3 h-3" />
                    <span>{diagnosis.badgeText}</span>
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>{diagnosis.verdict}</span>
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      {diagnosis.analysis}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 space-y-1">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-amber-800">
                      Rekomendasi Tindak Lanjut Tracing:
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      {diagnosis.recommendation}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Original Raw Cell Inspector (Column Item Description / Name) */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-lg space-y-3 border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Konten Mentah Sel Excel (Kolom: Item Description / Name)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      {rawCellText.length} Karakter
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRawCell}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      {copiedRawCell ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedRawCell ? 'Tersalin!' : 'Salin Sel Mentah'}</span>
                    </button>
                  </div>
                </div>

                {/* Monospace Raw View */}
                <div className="p-3.5 bg-black/60 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all leading-relaxed select-all">
                  {rawCellText || '(Cell kosong / tidak ada data teks)'}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>File Asal: <strong className="text-slate-200 font-mono">{record.sourceFileName || 'Data Upload ERP'}</strong></span>
                  <span>Row Line: <strong className="text-slate-200 font-mono">#{record.lineNumber}</strong></span>
                </div>
              </div>

              {/* 3. Dissection & Parsing Breakdown */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <SearchCode className="w-4 h-4 text-blue-600" />
                    <span>Dekomposisi Hasil Pembacaan Parser Sistem</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Struktur Sel
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Clean Item Name */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">1. Nama Barang Bersih:</span>
                    <p className="font-bold text-slate-900">{record.poItemName}</p>
                    <p className="text-[10px] text-slate-500">Teks setelah penghapusan kode SKU prefix / catatan</p>
                  </div>

                  {/* Extracted SKU Code */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">2. Kode SKU Terdeteksi:</span>
                    <p className="font-mono font-bold text-blue-700">
                      {record.poSkuCode || <span className="text-slate-400 font-normal italic">Tidak ada (Tanpa format ::)</span>}
                    </p>
                    <p className="text-[10px] text-slate-500">Diekstrak murni dari pemisah '::' pada nama item</p>
                  </div>

                  {/* Extracted Notes */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">3. Catatan Operasional:</span>
                    <p className="text-slate-800 font-medium">
                      {record.itemNotes || <span className="text-slate-400 italic">Tidak ada catatan sel</span>}
                    </p>
                    <p className="text-[10px] text-slate-500">Baris catatan operasional setelah pemisah baris</p>
                  </div>
                </div>
              </div>

              {/* 4. Complete Uploaded Excel Row Data Grid */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Matriks Seluruh Nilai Sel dari Baris Unggahan (Row Forensics)</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    PO {record.purchId} • Line #{record.lineNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">File Sumber:</span>
                    <span className="font-mono text-slate-800 font-semibold truncate block" title={record.sourceFileName}>
                      {record.sourceFileName || 'Upload ERP'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tipe File:</span>
                    <span className="font-mono text-slate-800 font-semibold truncate block">
                      {record.sourceFile ? record.sourceFile.toUpperCase() : 'ERP D365 / AX'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Nomor PO (PurchId):</span>
                    <span className="font-mono text-blue-700 font-bold block">{record.purchId}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">PO Line Number:</span>
                    <span className="font-mono text-slate-800 font-bold block">Line #{record.lineNumber}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Kolom Item ID (COA Akunting):</span>
                    <span className="font-mono text-slate-800 font-semibold block">
                      {record.itemId || <span className="text-slate-400 italic">Kosong di Excel</span>}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">COA Keuangan, Bukan Kode SKU</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Kuantitas (Qty):</span>
                    <span className="font-mono text-slate-800 font-bold block">
                      {record.purchQty} {record.purchUnit || 'Unit'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Harga Satuan:</span>
                    <span className="font-mono text-slate-800 font-semibold block">
                      {formatIDR(record.purchPrice)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Spend Line:</span>
                    <span className="font-mono text-emerald-700 font-bold block">
                      {formatIDR(record.totalLineAmount)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Diskon / Potongan:</span>
                    <span className="font-mono text-slate-700 block">
                      {record.lineDisc ? formatIDR(record.lineDisc) : '0'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Hospital Unit:</span>
                    <span className="font-mono text-slate-900 font-bold block">{record.hospitalCode}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Petugas Requester:</span>
                    <span className="text-slate-800 font-semibold truncate block" title={record.requesterName || record.requester}>
                      {record.requesterName || record.requester}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Departemen:</span>
                    <span className="text-slate-800 truncate block" title={record.department}>
                      {record.department || '-'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Cost Center:</span>
                    <span className="font-mono text-slate-700 block">{record.costCenter || '-'}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Referensi PR / MII:</span>
                    <span className="font-mono text-slate-700 truncate block" title={record.purchReqName}>
                      {record.purchReqName || '-'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Dokumen:</span>
                    <span className="text-slate-800 block">
                      {record.purchStatusNamePo || record.documentState || 'Invoiced'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Procurement Category:</span>
                    <span className="text-slate-800 truncate block" title={record.procurementCategory}>
                      {record.procurementCategory || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Checklist Panduan Tracing Bagi Auditor */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 text-xs space-y-2">
                <span className="font-bold text-blue-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Petunjuk Verifikasi Fisik File Excel:</span>
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed pl-1">
                  <li>
                    Buka file spreadsheet fisik <strong className="font-mono text-blue-950">{record.sourceFileName || 'file upload'}</strong> pada penyimpanan lokal Anda.
                  </li>
                  <li>
                    Filter kolom nomor PO pada nilai <strong className="font-mono text-blue-950">{record.purchId}</strong> dan Line <strong className="font-mono text-blue-950">#{record.lineNumber}</strong>.
                  </li>
                  <li>
                    Periksa kolom <strong className="font-mono">Name / ItemDescription</strong>. Bandingkan nilainya dengan blok "Konten Mentah Sel Excel" di atas.
                  </li>
                  <li>
                    <strong>Jika isi file upload keliru:</strong> Penginput dapat memperbaiki sel tersebut dan melakukan upload revisi di Ingestion Hub.
                  </li>
                  <li>
                    <strong>Jika isi file upload sudah benar tetapi status belum match:</strong> Hubungi tim Master Data Hub untuk mendaftarkan barang ini ke katalog baku MDM.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>{copiedSummary ? 'Tersalin!' : 'Salin Ringkasan Audit'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyRawCell}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Salin isi teks asli sel Excel"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-600" />
              <span>{copiedRawCell ? 'Sel Tersalin!' : 'Salin Raw Cell'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
