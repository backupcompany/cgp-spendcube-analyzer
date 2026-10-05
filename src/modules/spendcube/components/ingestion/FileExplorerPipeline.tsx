import React, { useState, useRef } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  FileCheck2, 
  Trash2, 
  X, 
  ChevronRight, 
  Sparkles, 
  HardDrive,
  FileText,
  ShieldCheck,
  Package,
  Layers,
  Check
} from 'lucide-react';
import { FileSourceType, SpendRecord } from '../../../../core/types/spend';
import { QueuedUploadFile } from '../DataIngestionAuditView';

export interface ExplorerFolderDef {
  id: FileSourceType | 'sku_master';
  folderName: string;
  displayName: string;
  categoryLabel: string;
  description: string;
  nature: 'TRANSACTION_PO' | 'ENRICHMENT_REFERENCE' | 'MASTER_CATALOG';
  natureBadge: string;
  folderColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorder: string;
  expectedHeaders: string[];
  templateType: 'po' | 'pr' | 'sku';
}

export const EXPLORER_FOLDERS: ExplorerFolderDef[] = [
  {
    id: 'capex_d365',
    folderName: '01_Capex_D365/',
    displayName: 'Capex D365 (Investasi Aset Baru)',
    categoryLabel: 'Belanja Modal D365',
    description: 'Dokumen transaksi PO pengadaan aset tetap dan peralatan medis dari sistem Microsoft Dynamics 365.',
    nature: 'TRANSACTION_PO',
    natureBadge: 'PO Lines (Commercial Transaction)',
    folderColor: 'text-blue-600 bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    cardBorder: 'hover:border-blue-400 group-hover:bg-blue-50/20',
    expectedHeaders: ['PurchId', 'LineNumber', 'ItemId', 'Name / Description', 'PurchQty', 'PurchPrice', 'TotalLineAmount'],
    templateType: 'po'
  },
  {
    id: 'opex_d365',
    folderName: '02_Opex_D365/',
    displayName: 'Opex D365 (Operasional Harian D365)',
    categoryLabel: 'Belanja Operasional D365',
    description: 'Transaksi PO rutin operasional, bahan medis habis pakai (BMHP), farmasi, dan jasa dari ERP D365.',
    nature: 'TRANSACTION_PO',
    natureBadge: 'PO Lines (Commercial Transaction)',
    folderColor: 'text-amber-600 bg-amber-50 border-amber-200',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    cardBorder: 'hover:border-amber-400 group-hover:bg-amber-50/20',
    expectedHeaders: ['PurchId', 'LineNumber', 'ItemId', 'Name / Description', 'PurchQty', 'PurchPrice', 'TotalLineAmount'],
    templateType: 'po'
  },
  {
    id: 'capex_ax',
    folderName: '03_Capex_AX/',
    displayName: 'Capex AX (Legacy Capex AX 2012)',
    categoryLabel: 'Belanja Modal Legacy AX',
    description: 'Arsip transaksi belanja modal dari instalasi legacy Microsoft Dynamics AX 2012 Siloam.',
    nature: 'TRANSACTION_PO',
    natureBadge: 'PO Lines (Commercial Transaction)',
    folderColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    cardBorder: 'hover:border-indigo-400 group-hover:bg-indigo-50/20',
    expectedHeaders: ['PurchId', 'LineNumber', 'ItemId', 'Name / Description', 'PurchQty', 'PurchPrice', 'TotalLineAmount'],
    templateType: 'po'
  },
  {
    id: 'opex_ax',
    folderName: '04_Opex_AX/',
    displayName: 'Opex AX (Legacy Opex AX 2012)',
    categoryLabel: 'Belanja Operasional Legacy AX',
    description: 'Arsip transaksi belanja operasional dari sistem legacy Microsoft Dynamics AX 2012.',
    nature: 'TRANSACTION_PO',
    natureBadge: 'PO Lines (Commercial Transaction)',
    folderColor: 'text-sky-600 bg-sky-50 border-sky-200',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
    cardBorder: 'hover:border-sky-400 group-hover:bg-sky-50/20',
    expectedHeaders: ['PurchId', 'LineNumber', 'ItemId', 'Name / Description', 'PurchQty', 'PurchPrice', 'TotalLineAmount'],
    templateType: 'po'
  },
  {
    id: 'summary_pr',
    folderName: '05_PR_Summary/',
    displayName: 'Summary PR (Requisition Reference)',
    categoryLabel: 'Referensi Pengayaan PR (Non-PO)',
    description: 'Berkas rekap PR untuk pengayaan pemohon (requester), departemen, dan cost center melalui Dual-Key VLOOKUP.',
    nature: 'ENRICHMENT_REFERENCE',
    natureBadge: 'Enrichment Only (Non-Spend / Bukan PO)',
    folderColor: 'text-purple-600 bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    cardBorder: 'hover:border-purple-400 group-hover:bg-purple-50/20',
    expectedHeaders: ['Purchase Req ID', 'ERP ID (PO / PRQ)', 'Requester', 'Description / Dept', 'Cost Center', 'Document Status'],
    templateType: 'pr'
  },
  {
    id: 'sku_master',
    folderName: '06_Master_SKU_MDM/',
    displayName: 'Master SKU MDM (Katalog Barcode)',
    categoryLabel: 'Master Katalog MDM',
    description: 'Katalog acuan Master Data Management (MDM) Siloam untuk pencocokan SKU barcode & taksonomi 4-pilar.',
    nature: 'MASTER_CATALOG',
    natureBadge: 'Master SKU Reference',
    folderColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    cardBorder: 'hover:border-emerald-400 group-hover:bg-emerald-50/20',
    expectedHeaders: ['ProductID / ItemId', 'SKU Name', 'CommodityItem', 'Brand', 'PartNumber', 'PurchCategoryLv1'],
    templateType: 'sku'
  }
];

interface FileExplorerPipelineProps {
  fileQueue: QueuedUploadFile[];
  onFilesSelected: (files: FileList | File[], forceFolderId?: FileSourceType) => void;
  onRemoveQueuedFile: (id: string) => void;
  onUpdateFileSourceType: (id: string, newType: FileSourceType) => void;
  onClearQueue: () => void;
  onStartIngestion: () => void;
  isUploading: boolean;
  onDownloadSampleTemplate: () => void;
  onDownloadSummaryPrTemplate: () => void;
}

export const FileExplorerPipeline: React.FC<FileExplorerPipelineProps> = ({
  fileQueue,
  onFilesSelected,
  onRemoveQueuedFile,
  onUpdateFileSourceType,
  onClearQueue,
  onStartIngestion,
  isUploading,
  onDownloadSampleTemplate,
  onDownloadSummaryPrTemplate
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<FileSourceType | 'sku_master' | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = EXPLORER_FOLDERS.find(f => f.id === selectedFolderId) || null;

  const handleCardClick = (folder: ExplorerFolderDef) => {
    setSelectedFolderId(folder.id);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, folder: ExplorerFolderDef) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (folder.id !== 'sku_master') {
        onFilesSelected(e.dataTransfer.files, folder.id as FileSourceType);
      }
    }
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const targetType = selectedFolder && selectedFolder.id !== 'sku_master' 
        ? (selectedFolder.id as FileSourceType) 
        : undefined;
      onFilesSelected(e.target.files, targetType);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Explorer Ribbon & Breadcrumbs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-mono">
          <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-slate-400">Root</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-600 font-bold">ERP_Data_Pipeline</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {selectedFolder ? selectedFolder.folderName : '6 Direktori Format Berkas'}
          </span>
        </div>

        {/* Global Template Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onDownloadSampleTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs cursor-pointer border border-slate-200"
            title="Unduh format spreadsheet PO D365 / AX"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Template PO (D365/AX)</span>
          </button>

          <button
            type="button"
            onClick={onDownloadSummaryPrTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors shadow-2xs cursor-pointer border border-purple-200"
            title="Unduh template Dual-Key Summary PR"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Template Summary PR</span>
          </button>
        </div>
      </div>

      {/* 6 Directory Grid (Visual File Explorer Folders) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-500" />
              <span>Direktori Unggah Berkas Berdasarkan Format &amp; Sifat Data</span>
            </h3>
            <p className="text-xs text-slate-500">
              Pilih folder yang sesuai atau seret (*drag &amp; drop*) berkas langsung ke atas kartu folder tujuan untuk mencegah kesalahan tipe berkas.
            </p>
          </div>
          {selectedFolder && (
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Semua Direktori</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {EXPLORER_FOLDERS.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            const isDragOver = dragOverFolderId === folder.id;
            const queuedCount = fileQueue.filter(f => f.sourceType === folder.id).length;

            return (
              <div
                key={folder.id}
                onClick={() => handleCardClick(folder)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/40 scale-[1.01] shadow-md'
                    : isSelected
                    ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500/30 shadow-xs'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Top Folder Header */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${folder.folderColor} shadow-2xs transition-transform group-hover:scale-105`}>
                        {isSelected ? (
                          <FolderOpen className="w-5 h-5" />
                        ) : (
                          <Folder className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <span className="font-mono text-[11px] font-bold text-slate-500 block leading-tight">
                          {folder.folderName}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {folder.displayName}
                        </h4>
                      </div>
                    </div>

                    {queuedCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-600 text-white shadow-xs shrink-0 animate-in fade-in">
                        {queuedCount} Berkas
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {folder.description}
                  </p>
                </div>

                {/* Bottom Sifat & Action Pill */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3 text-[10px]">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${folder.badgeBg} ${folder.badgeText} ${folder.badgeBorder}`}>
                    {folder.nature === 'TRANSACTION_PO' && <FileCheck2 className="w-3 h-3" />}
                    {folder.nature === 'ENRICHMENT_REFERENCE' && <Layers className="w-3 h-3" />}
                    {folder.nature === 'MASTER_CATALOG' && <Package className="w-3 h-3" />}
                    <span className="truncate max-w-[170px]">{folder.natureBadge}</span>
                  </span>

                  <span className="font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    <span>{isSelected ? 'Buka Dropzone' : 'Pilih Folder'}</span>
                    <span>&rarr;</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Dropzone Area for the Selected Folder */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {selectedFolder ? selectedFolder.folderName : 'Semua Direktori'}
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                {selectedFolder ? `Dropzone Direktori: ${selectedFolder.displayName}` : 'Dropzone Global Multi-Berkas'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedFolder
                ? `Semua berkas yang dijatuhkan di sini akan otomatis terasosiasi ke direktori ${selectedFolder.folderName}`
                : 'Pilih salah satu folder di atas atau jatuhkan berkas langsung di bawah.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerFileInput}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Pilih Berkas Komputer (.xlsx / .csv)</span>
          </button>
        </div>

        {/* Drag & Drop Main Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const targetType = selectedFolder && selectedFolder.id !== 'sku_master' 
                ? (selectedFolder.id as FileSourceType) 
                : undefined;
              onFilesSelected(e.dataTransfer.files, targetType);
            }
          }}
          onClick={handleTriggerFileInput}
          className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-7 text-center transition-all bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer group"
        >
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              Tarik &amp; Lepaskan Berkas Excel / CSV ke sini, atau <span className="text-blue-600 underline">Klik untuk Telusuri</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Mendukung multi-file sekaligus. Sistem secara otomatis mendeteksi baris non-item (Total/Remark) dan melakukan validasi header.
            </p>
          </div>
        </div>
      </div>

      {/* Staged File Queue in Explorer */}
      {fileQueue.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-mono font-bold text-xs">
                {fileQueue.length}
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Antrean Berkas Siap Diproses ({fileQueue.length} Berkas)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Periksa asosiasi folder tujuan setiap berkas sebelum menjalankan pipeline ingestion.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClearQueue}
                disabled={isUploading}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer border border-rose-200"
              >
                Kosongkan Antrean
              </button>

              <button
                type="button"
                onClick={onStartIngestion}
                disabled={isUploading || fileQueue.length === 0}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>Mulai Proses Ingestion ({fileQueue.length} Berkas)</span>
              </button>
            </div>
          </div>

          {/* Queue Tabular Cards */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/30">
            {fileQueue.map((item, idx) => {
              const matchedFolder = EXPLORER_FOLDERS.find(f => f.id === item.sourceType);
              const fileSizeKb = Math.round(item.file.size / 1024);

              return (
                <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="text-[11px] font-mono font-bold text-slate-400 w-6">
                      #{idx + 1}
                    </span>
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <span className="text-[10px] font-mono text-slate-400">
                        {fileSizeKb.toLocaleString('id-ID')} KB &bull; Type: {item.file.type || 'Spreadsheet'}
                      </span>
                    </div>
                  </div>

                  {/* Folder Selector per Item */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">Folder Tujuan:</span>
                      <select
                        value={item.sourceType}
                        onChange={(e) => onUpdateFileSourceType(item.id, e.target.value as FileSourceType)}
                        className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                      >
                        <option value="capex_d365">📁 01_Capex_D365/ (PO Belanja Modal)</option>
                        <option value="opex_d365">📁 02_Opex_D365/ (PO Belanja Operasional)</option>
                        <option value="capex_ax">📁 03_Capex_AX/ (Legacy Capex)</option>
                        <option value="opex_ax">📁 04_Opex_AX/ (Legacy Opex)</option>
                        <option value="summary_pr">📁 05_PR_Summary/ (Enrichment Only)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveQueuedFile(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus dari antrean"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
