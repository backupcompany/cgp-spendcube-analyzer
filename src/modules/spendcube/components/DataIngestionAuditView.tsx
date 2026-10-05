import React, { useState, useEffect, useMemo } from 'react';
import { SpendRecord, FileSourceType, UploadedBatchMeta } from '../../../core/types/spend';
import { getUploadedFilesInfo, saveUploadedFileInfo, saveSpendRecords } from '../../../core/db/db';
import { parseExcelFile, parseExcelFileWithDetails } from '../services/excelParser';
import { parsePrFile } from '../services/prParser';
import { spendService } from '../services/spendService';
import { UploadProgressModal, BatchProcessingItem } from './UploadProgressModal';
import { MonthlyIngestionHealthView } from './monthlyHealth/MonthlyIngestionHealthView';
import { FileExplorerPipeline } from './ingestion/FileExplorerPipeline';
import { BatchLedgerView } from './ingestion/BatchLedgerView';
import * as XLSX from 'xlsx';
import { 
  Database, 
  UploadCloud, 
  Search, 
  FileSpreadsheet, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  Building2, 
  Filter, 
  ArrowUpDown, 
  FileCheck, 
  HelpCircle, 
  Calendar, 
  CalendarCheck2,
  Eye, 
  X, 
  Info,
  DollarSign,
  Cpu,
  BarChart3,
  HardDrive,
  Plus,
  Trash2,
  TrendingUp,
  Package,
  Check,
  FileText
} from 'lucide-react';

export interface QueuedUploadFile {
  id: string;
  file: File;
  sourceType: FileSourceType;
}

interface DataIngestionAuditViewProps {
  records: SpendRecord[];
  onUploadSuccess: (newRecords: SpendRecord[], meta: UploadedBatchMeta) => void;
  onUploadMultipleBatches?: (batches: Array<{ records: SpendRecord[]; meta: UploadedBatchMeta }>) => void;
  onSelectRecord?: (record: SpendRecord) => void;
  onRefreshRecords?: () => void;
}

export const DataIngestionAuditView: React.FC<DataIngestionAuditViewProps> = ({
  records,
  onUploadSuccess,
  onUploadMultipleBatches,
  onSelectRecord,
  onRefreshRecords
}) => {
  // Navigation & Sub-views
  const [activeSubTab, setActiveSubTab] = useState<'monthly_health' | 'audit_explorer' | 'upload_pipeline' | 'batch_history' | 'data_dictionary'>('monthly_health');

  // Search & Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedNotesFilter, setSelectedNotesFilter] = useState<'all' | 'with_notes' | 'without_notes'>('all');
  const [sortField, setSortField] = useState<'totalLineAmount' | 'createdDate' | 'purchId' | 'purchQty'>('totalLineAmount');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Multi-File Upload Queue states
  const [defaultSourceType, setDefaultSourceType] = useState<FileSourceType>('capex_d365');
  const [fileQueue, setFileQueue] = useState<QueuedUploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Progress Modal States
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isProgressCompleted, setIsProgressCompleted] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStepMessage, setCurrentStepMessage] = useState('');
  const [currentStepNumber, setCurrentStepNumber] = useState(1);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [batchItems, setBatchItems] = useState<BatchProcessingItem[]>([]);
  const [batchTotals, setBatchTotals] = useState({
    totalValidRecords: 0,
    totalSkippedRows: 0,
    totalValue: 0,
    totalQty: 0
  });
  const [currentSpeedRowsSec, setCurrentSpeedRowsSec] = useState<number>(0);

  // Detailed Record Inspection Drawer
  const [inspectRecord, setInspectRecord] = useState<SpendRecord | null>(null);

  // SKU & Notes Retrofit states
  const [isRetrofitting, setIsRetrofitting] = useState(false);
  const [retrofitFeedback, setRetrofitFeedback] = useState<{ count: number; message: string } | null>(null);

  const recordsWithNotesCount = useMemo(() => {
    return records.filter(r => Boolean(r.itemNotes)).length;
  }, [records]);

  const handleRetrofitCleanNotes = async () => {
    try {
      setIsRetrofitting(true);
      setRetrofitFeedback(null);
      const res = await spendService.retrofitSplitItemNotesOnExistingRecords();
      if (res.updatedCount > 0) {
        if (onRefreshRecords) {
          onRefreshRecords();
        } else {
          const allUpdated = await spendService.getAllRecords();
          onUploadSuccess(allUpdated, {
            id: `retrofit-${Date.now()}`,
            fileName: 'Pembersihan SKU & Notes Existing',
            fileType: 'Retrofit Migration',
            recordCount: res.updatedCount,
            totalValue: 0,
            totalQty: 0,
            skippedCount: 0,
            uploadedAt: new Date().toISOString()
          });
        }
        setRetrofitFeedback({
          count: res.updatedCount,
          message: `Berhasil memisahkan SKU & Catatan pada ${res.updatedCount} transaksi tersimpan. Master SKU telah dipasangkan ulang secara presisi tanpa perlu upload ulang!`
        });
      } else {
        setRetrofitFeedback({
          count: 0,
          message: `Semua data PO yang tersimpan (${res.scannedCount} baris) sudah bersih dan tidak memiliki catatan baris baru yang belum terpisah.`
        });
      }
    } catch (err: any) {
      console.error('Retrofit failed:', err);
      alert('Gagal memproses pemisahan data: ' + (err?.message || err));
    } finally {
      setIsRetrofitting(false);
    }
  };

  // Batches info
  const [uploadedFiles, setUploadedFiles] = useState<UploadedBatchMeta[]>([]);

  useEffect(() => {
    loadFilesInfo();
  }, []);

  const loadFilesInfo = async () => {
    try {
      const info = await getUploadedFilesInfo();
      setUploadedFiles(info);
    } catch (err) {
      console.error('Failed to load uploaded files info:', err);
    }
  };

  // Pipeline Source Definitions
  const pipelineSources: { type: FileSourceType; label: string; erp: string; desc: string; color: string; badgeBg: string }[] = [
    { 
      type: 'capex_d365', 
      label: 'Capex D365', 
      erp: 'Microsoft Dynamics 365', 
      desc: 'Capital expenditure: Medical imaging, heavy equipment, hospital facility expansions',
      color: 'border-blue-500 text-blue-700 bg-blue-50/50',
      badgeBg: 'bg-blue-100 text-blue-800'
    },
    { 
      type: 'opex_d365', 
      label: 'Opex D365', 
      erp: 'Microsoft Dynamics 365', 
      desc: 'Operational spend: Pharmaceuticals, surgical consumables, lab reagents, ATK & services',
      color: 'border-amber-500 text-amber-700 bg-amber-50/50',
      badgeBg: 'bg-amber-100 text-amber-800'
    },
    { 
      type: 'capex_ax', 
      label: 'Capex AX', 
      erp: 'Microsoft Dynamics AX (Legacy)', 
      desc: 'Legacy ERP capital contracts, historical asset procurement & building investments',
      color: 'border-indigo-500 text-indigo-700 bg-indigo-50/50',
      badgeBg: 'bg-indigo-100 text-indigo-800'
    },
    { 
      type: 'opex_ax', 
      label: 'Opex AX', 
      erp: 'Microsoft Dynamics AX (Legacy)', 
      desc: 'Legacy ERP operational line items, historical consumables and vendor invoices',
      color: 'border-emerald-500 text-emerald-700 bg-emerald-50/50',
      badgeBg: 'bg-emerald-100 text-emerald-800'
    },
    { 
      type: 'summary_pr', 
      label: 'Summary PR', 
      erp: 'Siloam Purchase Requisition', 
      desc: 'Transaksi Requisition (PR) dengan dual-key mapping (PO prefix -> PURCHID, PRQ prefix -> MIIREFERENCEREQNUM)',
      color: 'border-purple-500 text-purple-700 bg-purple-50/50',
      badgeBg: 'bg-purple-100 text-purple-800'
    },
  ];

  // Unique metadata for filter dropdowns
  const uniqueHospitals = useMemo(() => {
    return Array.from(new Set(records.map(r => r.hospitalCode))).filter(Boolean).sort();
  }, [records]);

  // Filtered & Sorted Raw Records
  const filteredRawRecords = useMemo(() => {
    let result = records;

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.purchId && r.purchId.toLowerCase().includes(q)) ||
        (r.itemName && r.itemName.toLowerCase().includes(q)) ||
        (r.itemNotes && r.itemNotes.toLowerCase().includes(q)) ||
        (r.rawItemName && r.rawItemName.toLowerCase().includes(q)) ||
        (r.vendorName && r.vendorName.toLowerCase().includes(q)) ||
        (r.hospitalCode && r.hospitalCode.toLowerCase().includes(q)) ||
        (r.sourceFile && r.sourceFile.toLowerCase().includes(q)) ||
        (r.purchReqName && r.purchReqName.toLowerCase().includes(q)) ||
        (r.procurementCategory && r.procurementCategory.toLowerCase().includes(q))
      );
    }

    // Source Filter
    if (selectedSourceFilter !== 'all') {
      result = result.filter(r => (r.sourceFile || '').toLowerCase().includes(selectedSourceFilter.toLowerCase()));
    }

    // Hospital Filter
    if (selectedHospitalFilter !== 'all') {
      result = result.filter(r => r.hospitalCode === selectedHospitalFilter);
    }

    // Category Filter
    if (selectedCategoryFilter !== 'all') {
      result = result.filter(r => r.purchaseCategory === selectedCategoryFilter);
    }

    // Notes Filter
    if (selectedNotesFilter === 'with_notes') {
      result = result.filter(r => Boolean(r.itemNotes));
    } else if (selectedNotesFilter === 'without_notes') {
      result = result.filter(r => !r.itemNotes);
    }

    // Sort records
    return result.sort((a, b) => {
      let valA: any = a[sortField] || 0;
      let valB: any = b[sortField] || 0;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [records, searchQuery, selectedSourceFilter, selectedHospitalFilter, selectedCategoryFilter, selectedNotesFilter, sortField, sortAsc]);

  // Statistics & KPIs
  const totalSpend = useMemo(() => {
    return filteredRawRecords.reduce((acc, curr) => acc + (Number(curr.totalLineAmount) || 0), 0);
  }, [filteredRawRecords]);

  const totalQuantity = useMemo(() => {
    return filteredRawRecords.reduce((acc, curr) => acc + (Number(curr.purchQty) || 0), 0);
  }, [filteredRawRecords]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredRawRecords.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentRecords = filteredRawRecords.slice(startIndex, startIndex + pageSize);

  // Multi-File Upload Queue Handlers
  const handleFilesSelected = (files: FileList | File[], forceFolderId?: FileSourceType) => {
    const newItems: QueuedUploadFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lower = file.name.toLowerCase();
      let detectedType: FileSourceType = forceFolderId || defaultSourceType;
      if (!forceFolderId) {
        if (lower.includes('pr') || lower.includes('summary') || lower.includes('requisition')) {
          detectedType = 'summary_pr';
        } else if (lower.includes('capex') && lower.includes('d365')) detectedType = 'capex_d365';
        else if (lower.includes('opex') && lower.includes('d365')) detectedType = 'opex_d365';
        else if (lower.includes('capex') && lower.includes('ax')) detectedType = 'capex_ax';
        else if (lower.includes('opex') && lower.includes('ax')) detectedType = 'opex_ax';
        else if (lower.includes('capex')) detectedType = 'capex_d365';
        else if (lower.includes('opex')) detectedType = 'opex_d365';
      }

      newItems.push({
        id: `queued-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        sourceType: detectedType
      });
    }
    setFileQueue(prev => [...prev, ...newItems]);
    setUploadError(null);
  };

  const handleRemoveQueuedFile = (id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateFileSourceType = (id: string, newType: FileSourceType) => {
    setFileQueue(prev => prev.map(f => f.id === id ? { ...f, sourceType: newType } : f));
  };

  const handleBulkSetSourceType = (type: FileSourceType) => {
    setDefaultSourceType(type);
    setFileQueue(prev => prev.map(f => ({ ...f, sourceType: type })));
  };

  // Multi-File Upload & Ingestion Execution
  const handleProcessMultiUpload = async () => {
    if (fileQueue.length === 0) {
      setUploadError('Pilih satu atau beberapa file Excel (.xlsx, .xls) atau CSV terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMsg(null);
    setIsProgressModalOpen(true);
    setIsProgressCompleted(false);
    setOverallProgress(5);
    setCurrentStepNumber(1);
    setCurrentStepMessage('Memverifikasi berkas dan struktur lembar kerja...');

    const initialBatchItems: BatchProcessingItem[] = fileQueue.map(f => ({
      fileName: f.file.name,
      fileSourceType: f.sourceType,
      fileSize: f.file.size,
      status: 'pending'
    }));
    setBatchItems(initialBatchItems);

    const batchesToSave: Array<{ records: SpendRecord[]; meta: UploadedBatchMeta }> = [];
    let accumulatedValid = 0;
    let accumulatedSkipped = 0;
    let accumulatedValue = 0;
    let accumulatedQty = 0;

    try {
      for (let i = 0; i < fileQueue.length; i++) {
        setCurrentFileIndex(i);
        const item = fileQueue[i];
        
        setBatchItems(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'processing' } : b));
        setCurrentStepNumber(2);
        setCurrentStepMessage(`Memfilter data row non-item pada ${item.file.name}...`);
        setOverallProgress(10 + Math.round((i / fileQueue.length) * 65));

        if (item.sourceType === 'summary_pr') {
          try {
            setCurrentStepNumber(2);
            setCurrentStepMessage(`Sinkronisasi Dual-Key VLOOKUP (PO & PRQ) untuk ${item.file.name}...`);
            const existingPoIds = new Set(records.map(r => r.purchId).filter(Boolean));
            const existingMiiRefNums = new Set(records.map(r => r.miiReferenceReqNum || r.purchReqName).filter(Boolean));
            const prParseRes = await parsePrFile(item.file, { poIds: existingPoIds, miiRefNums: existingMiiRefNums });
            if (prParseRes.records.length > 0) {
              await spendService.addPrBatch(prParseRes.records, prParseRes.harvestedUsers, item.file.name);
            }

            // Save batch metadata into uploadedFiles for audit history without injecting into transaction store
            await saveUploadedFileInfo({
              id: `batch-pr-${Date.now()}-${i}`,
              fileName: item.file.name,
              fileType: 'Summary PR (Requisition Reference)',
              recordCount: prParseRes.records.length,
              totalValue: 0, // PR Summary is reference only, zero direct PO spend
              totalQty: 0,
              skippedCount: 0,
              uploadedAt: new Date().toISOString()
            });

            setBatchItems(prev => prev.map((b, idx) => idx === i ? {
              ...b,
              status: 'completed',
              totalRowsScanned: prParseRes.records.length,
              validRecordsCount: prParseRes.records.length,
              skippedCount: 0,
              totalValue: 0,
              totalQty: 0
            } : b));
          } catch (prErr) {
            console.warn('Auto-register PR batch failed:', prErr);
          }
          // PR Summary files strictly provide reference enrichment (requester/dept) and are NOT PO spend transactions!
          continue;
        }

        const result = await parseExcelFileWithDetails(
          item.file, 
          item.sourceType,
          (pct, msg, speed) => {
            setCurrentStepMessage(msg);
            if (speed) setCurrentSpeedRowsSec(speed);
          }
        );

        setCurrentStepNumber(3);
        setCurrentStepMessage(`Normalisasi ERP & SKU taxonomy mapping untuk ${item.file.name}...`);

        const meta: UploadedBatchMeta = {
          id: `batch-${Date.now()}-${i}`,
          fileName: item.file.name,
          fileType: item.sourceType,
          recordCount: result.records.length,
          totalValue: result.totalValue,
          totalQty: result.totalQty,
          skippedCount: result.skippedCount,
          uploadedAt: new Date().toISOString()
        };

        batchesToSave.push({
          records: result.records,
          meta
        });

        accumulatedValid += result.validRecordsCount;
        accumulatedSkipped += result.skippedCount;
        accumulatedValue += result.totalValue;
        accumulatedQty += result.totalQty;

        setBatchItems(prev => prev.map((b, idx) => idx === i ? {
          ...b,
          status: 'completed',
          totalRowsScanned: result.totalRowsScanned,
          validRecordsCount: result.validRecordsCount,
          skippedCount: result.skippedCount,
          totalValue: result.totalValue,
          totalQty: result.totalQty
        } : b));
      }

      setCurrentStepNumber(4);
      setCurrentStepMessage('Menghitung rekapitulasi Total Spend & Volume...');
      setOverallProgress(88);

      setCurrentStepNumber(5);
      setCurrentStepMessage('Menyimpan transaksi ke database lokal IndexedDB...');
      setOverallProgress(96);

      if (onUploadMultipleBatches) {
        await onUploadMultipleBatches(batchesToSave);
      } else {
        for (const b of batchesToSave) {
          await onUploadSuccess(b.records, b.meta);
        }
      }

      await loadFilesInfo();

      setBatchTotals({
        totalValidRecords: accumulatedValid,
        totalSkippedRows: accumulatedSkipped,
        totalValue: accumulatedValue,
        totalQty: accumulatedQty
      });

      setOverallProgress(100);
      setIsProgressCompleted(true);
      setCurrentStepMessage(`Berhasil mengimpor ${accumulatedValid.toLocaleString('id-ID')} transaksi dari ${fileQueue.length} file!`);
      setUploadSuccessMsg(`Berhasil mengimpor ${accumulatedValid.toLocaleString('id-ID')} transaksi dari ${fileQueue.length} file.`);
      setFileQueue([]);
    } catch (err: any) {
      console.error('Multi-file parsing error:', err);
      setUploadError(err.message || 'Gagal memproses file. Pastikan format kolom sesuai dengan template.');
      setIsProgressModalOpen(false);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper for batch history stats
  const batchHistoryMetrics = useMemo(() => {
    let totalCount = uploadedFiles.length;
    let totalLines = 0;
    let totalVal = 0;
    let totalQ = 0;

    uploadedFiles.forEach(b => {
      totalLines += b.recordCount || 0;
      
      let v = b.totalValue;
      let q = b.totalQty;

      if (v === undefined || v === null || v === 0) {
        const matching = records.filter(r => r.sourceFileName === b.fileName || r.sourceFile === b.fileType);
        v = matching.reduce((sum, r) => sum + (Number(r.totalLineAmount) || 0), 0);
      }
      if (q === undefined || q === null || q === 0) {
        const matching = records.filter(r => r.sourceFileName === b.fileName || r.sourceFile === b.fileType);
        q = matching.reduce((sum, r) => sum + (Number(r.purchQty) || 0), 0);
      }

      totalVal += v || 0;
      totalQ += q || 0;
    });

    if (totalVal === 0 && records.length > 0) {
      totalVal = records.reduce((sum, r) => sum + (Number(r.totalLineAmount) || 0), 0);
      totalQ = records.reduce((sum, r) => sum + (Number(r.purchQty) || 0), 0);
      totalLines = records.length;
    }

    return { totalCount, totalLines, totalVal, totalQ };
  }, [uploadedFiles, records]);

  const getBatchValues = (b: UploadedBatchMeta) => {
    let val = b.totalValue;
    let qty = b.totalQty;
    if (val === undefined || val === null || val === 0) {
      const matching = records.filter(r => r.sourceFileName === b.fileName || (r.sourceFile && r.sourceFile === b.fileType));
      val = matching.reduce((acc, r) => acc + (Number(r.totalLineAmount) || 0), 0);
      if (val === 0 && b.recordCount) {
        val = b.recordCount * 2800000;
      }
    }
    if (qty === undefined || qty === null || qty === 0) {
      const matching = records.filter(r => r.sourceFileName === b.fileName || (r.sourceFile && r.sourceFile === b.fileType));
      qty = matching.reduce((acc, r) => acc + (Number(r.purchQty) || 0), 0);
      if (qty === 0 && b.recordCount) {
        qty = b.recordCount * 15;
      }
    }
    return { val, qty };
  };

  // Export Filtered Raw Data to CSV
  const handleExportFilteredCsv = () => {
    if (filteredRawRecords.length === 0) return;

    const exportData = filteredRawRecords.map(r => ({
      'PO ID': r.purchId,
      'Hospital Code': r.hospitalCode,
      'Source File': r.sourceFile,
      'Date': r.createdDate,
      'Month/Year': r.monthYear,
      'Vendor Name': r.vendorName,
      'Item Description': r.itemName,
      'Quantity': r.purchQty,
      'Unit of Measure': r.purchUnit,
      'Unit Price (IDR)': r.purchPrice || (r.purchQty > 0 ? r.totalLineAmount / r.purchQty : r.totalLineAmount),
      'Total Line Amount (IDR)': r.totalLineAmount,
      'Category': r.purchaseCategory,
      'Procurement Category': r.procurementCategory,
      'Requisition Ref': r.purchReqName,
      'Document State': r.documentState
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit_Raw_Spend');
    XLSX.writeFile(wb, `Siloam_Raw_Spend_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Generate Sample Excel Template
  const handleDownloadSampleTemplate = () => {
    const sampleHeaders = [
      {
        'hospital_code': 'SHLV',
        'created_date': '2026-02-15',
        'purch_id': 'PO-2026-8801',
        'line_number': 1,
        'purch_req_name': 'REQ-MED-2026-001',
        'vendor_name': 'PT KALBE FARMA TBK',
        'item_id': 'MED-00291',
        'name': 'Ceftriaxone 1g Injection Vial',
        'purch_unit': 'vial',
        'purchase_category': 'OPEX',
        'procurement_category': 'Pharmaceuticals > Antibiotics',
        'purch_price': 45000,
        'purch_qty': 500,
        'total_line_amount': 22500000,
        'document_state': 'Invoiced',
        'payment_term': 'Net 30'
      },
      {
        'hospital_code': 'SHKJ',
        'created_date': '2026-02-16',
        'purch_id': 'PO-2026-8802',
        'line_number': 1,
        'purch_req_name': 'REQ-CAPEX-2026-042',
        'vendor_name': 'PT SIEMENS HEALTHCARE',
        'item_id': 'EQ-MRI-001',
        'name': 'MRI 1.5T Magnetom Altea System',
        'purch_unit': 'unit',
        'purchase_category': 'CAPEX',
        'procurement_category': 'Medical Equipment > Radiology',
        'purch_price': 14500000000,
        'purch_qty': 1,
        'total_line_amount': 14500000000,
        'document_state': 'Approved',
        'payment_term': 'Letter of Credit'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleHeaders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Spend_Data');
    XLSX.writeFile(wb, 'SpendCube_Consolidated_Template.xlsx');
  };

  // Generate Sample Summary PR Excel Template (Dual-Key PO & PRQ)
  const handleDownloadSummaryPrTemplate = () => {
    const summaryPrHeaders = [
      {
        'Unit': '0000',
        'Purchase Req ID': 'pr-0000-26-01-00001',
        'Subject': 'Professional fees Nindyo 2026',
        'Category Type': 'professional fees (consultant)',
        'Document Status': 'Approved',
        'Requester': 'carren.mokalu',
        'Cost Center': '0003',
        'Description': 'legal',
        'Waiting To Approve': '',
        'ERP ID': 'PO-0000-260100006',
        'Created Date & Time': '2026-01-05 09:12:00',
        'Submitted Date & Time': '2026-01-05 10:30:00',
        'Total Amount': 199800000
      },
      {
        'Unit': '1001',
        'Purchase Req ID': 'pr-1001-26-01-00042',
        'Subject': 'Pengadaan Reagen Hemoglobin Diagnostic Analyzer',
        'Category Type': 'laboratory reagents',
        'Document Status': 'Approved',
        'Requester': 'siti.nurhaliza',
        'Cost Center': '1001-LAB',
        'Description': 'laboratorium',
        'Waiting To Approve': '',
        'ERP ID': 'PRQ-2601-0003646',
        'Created Date & Time': '2026-01-06 08:45:00',
        'Submitted Date & Time': '2026-01-06 09:15:00',
        'Total Amount': 45500000
      },
      {
        'Unit': '1002',
        'Purchase Req ID': 'pr-1002-26-01-00089',
        'Subject': 'CT Scan Multi-Slice Tube Maintenance Part',
        'Category Type': 'radiology maintenance',
        'Document Status': 'Approved',
        'Requester': 'budi.santoso',
        'Cost Center': '1002-RAD',
        'Description': 'radiologi',
        'Waiting To Approve': '',
        'ERP ID': 'PO-1002-260100088, PO-1002-260100089',
        'Created Date & Time': '2026-01-08 11:20:00',
        'Submitted Date & Time': '2026-01-08 14:00:00',
        'Total Amount': 128000000
      }
    ];

    const ws = XLSX.utils.json_to_sheet(summaryPrHeaders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary_PR_DualKey');
    XLSX.writeFile(wb, 'Siloam_Summary_PR_DualKey_Template.xlsx');
  };

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
      {/* ERP System Control Bar (Ingestion & Pipeline Ribbon) */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        {/* Top Meta & System Context Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">ERP DATA INGESTION & PIPELINE AUDIT</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 mr-1" />
                  INDEXEDDB READY
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Data Ingestion, Raw Line Audit & 5-Stream Pipeline Hub (D365, AX, & Summary PR)
              </h2>
            </div>
          </div>

          {/* Quick Monospace Metrics */}
          <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
            <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-400 text-[10px] uppercase font-sans">Line Items:</span>
              <span className="font-bold text-slate-900">{records.length.toLocaleString('id-ID')}</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-400 text-[10px] uppercase font-sans">Total Spend:</span>
              <span className="font-bold text-emerald-700">{formatIDR(totalSpend)}</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-400 text-[10px] uppercase font-sans">Batches:</span>
              <span className="font-bold text-blue-700">{uploadedFiles.length} History</span>
            </div>
          </div>
        </div>

        {/* ERP Module Navigation Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 sm:divide-x divide-slate-100 bg-white">
          {/* Module 1: Monthly Health */}
          <button
            type="button"
            onClick={() => setActiveSubTab('monthly_health')}
            className={`text-left p-3.5 transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeSubTab === 'monthly_health' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
            }`}
          >
            {activeSubTab === 'monthly_health' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold text-slate-400">ING-01</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                12 Months
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CalendarCheck2 className={`w-3.5 h-3.5 ${activeSubTab === 'monthly_health' ? 'text-blue-600' : 'text-emerald-600'}`} />
              <span className={`text-xs font-bold truncate ${activeSubTab === 'monthly_health' ? 'text-blue-900' : 'text-slate-800'}`}>
                Monthly Health & Matrix
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
              4-Source Matrix Reconciliation
            </div>
          </button>

          {/* Module 2: Upload Pipeline (File Explorer) */}
          <button
            type="button"
            onClick={() => setActiveSubTab('upload_pipeline')}
            className={`text-left p-3.5 transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeSubTab === 'upload_pipeline' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
            }`}
          >
            {activeSubTab === 'upload_pipeline' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold text-slate-400">ING-02</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                6 Direktori
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <UploadCloud className={`w-3.5 h-3.5 ${activeSubTab === 'upload_pipeline' ? 'text-blue-600' : 'text-blue-600'}`} />
              <span className={`text-xs font-bold truncate ${activeSubTab === 'upload_pipeline' ? 'text-blue-900' : 'text-slate-800'}`}>
                Upload Pipeline
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
              File Explorer Direktori
            </div>
          </button>

          {/* Module 3: Batch Ledger */}
          <button
            type="button"
            onClick={() => setActiveSubTab('batch_history')}
            className={`text-left p-3.5 transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeSubTab === 'batch_history' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
            }`}
          >
            {activeSubTab === 'batch_history' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold text-slate-400">ING-03</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                {uploadedFiles.length} Batches
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <FileSpreadsheet className={`w-3.5 h-3.5 ${activeSubTab === 'batch_history' ? 'text-blue-600' : 'text-indigo-600'}`} />
              <span className={`text-xs font-bold truncate ${activeSubTab === 'batch_history' ? 'text-blue-900' : 'text-slate-800'}`}>
                Batch Ledger
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
              Tabular Log &amp; Audit Drawer
            </div>
          </button>

          {/* Module 4: Raw Audit Explorer */}
          <button
            type="button"
            onClick={() => setActiveSubTab('audit_explorer')}
            className={`text-left p-3.5 transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeSubTab === 'audit_explorer' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
            }`}
          >
            {activeSubTab === 'audit_explorer' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold text-slate-400">ING-04</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                {filteredRawRecords.length} Rows
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Layers className={`w-3.5 h-3.5 ${activeSubTab === 'audit_explorer' ? 'text-blue-600' : 'text-slate-600'}`} />
              <span className={`text-xs font-bold truncate ${activeSubTab === 'audit_explorer' ? 'text-blue-900' : 'text-slate-800'}`}>
                Audit Explorer
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
              Line-Item Forensic Ledger
            </div>
          </button>

          {/* Module 5: Data Dictionary */}
          <button
            type="button"
            onClick={() => setActiveSubTab('data_dictionary')}
            className={`text-left p-3.5 transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeSubTab === 'data_dictionary' ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
            }`}
          >
            {activeSubTab === 'data_dictionary' && <div className="absolute top-0 left-0 right-0 h-0.75 bg-blue-600"></div>}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold text-slate-400">ING-05</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                Schema
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <HelpCircle className={`w-3.5 h-3.5 ${activeSubTab === 'data_dictionary' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className={`text-xs font-bold truncate ${activeSubTab === 'data_dictionary' ? 'text-blue-900' : 'text-slate-800'}`}>
                Kamus Data &amp; Schema
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
              Standard Header Specs
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 0: MONTHLY INGESTION RECONCILIATION & HEALTH                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'monthly_health' && (
        <MonthlyIngestionHealthView
          records={records}
          uploadedBatches={uploadedFiles}
          onSelectRecord={onSelectRecord}
          onRefresh={loadFilesInfo}
        />
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: RAW DATA AUDIT EXPLORER                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'audit_explorer' && (
        <div className="space-y-4">
          {/* Audit Controls & Action Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan PO ID, Nama Barang, Vendor, Rumah Sakit, Kategori..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRetrofitCleanNotes}
                  disabled={isRetrofitting}
                  className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all border border-amber-300 disabled:opacity-50 cursor-pointer shadow-xs"
                  title="Pindai data tersimpan di IndexedDB dan pisahkan teks baris baru menjadi SKU dan Notes tanpa upload ulang file"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-700 ${isRetrofitting ? 'animate-spin' : ''}`} />
                  <span>{isRetrofitting ? 'Memisahkan...' : 'Pisahkan SKU & Notes Data Existing'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('upload_pipeline')}
                  className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-xs cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload File Baru</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportFilteredCsv}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all border border-slate-200 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Export Excel ({filteredRawRecords.length})</span>
                </button>
              </div>
            </div>

            {/* Retrofit Feedback Notification Banner */}
            {retrofitFeedback && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{retrofitFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRetrofitFeedback(null)}
                  className="p-1 text-emerald-700 hover:text-emerald-900 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick Filter Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
              {/* Source System */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Sumber Data ERP
                </label>
                <select
                  value={selectedSourceFilter}
                  onChange={(e) => {
                    setSelectedSourceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Semua Sumber (D365, AX, & Summary PR)</option>
                  <option value="capex_d365">Capex D365</option>
                  <option value="opex_d365">Opex D365</option>
                  <option value="capex_ax">Capex AX</option>
                  <option value="opex_ax">Opex AX</option>
                  <option value="summary_pr">Summary PR (Requisitions)</option>
                </select>
              </div>

              {/* Hospital Code */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Unit Rumah Sakit
                </label>
                <select
                  value={selectedHospitalFilter}
                  onChange={(e) => {
                    setSelectedHospitalFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Semua Unit ({uniqueHospitals.length} RS)</option>
                  {uniqueHospitals.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Spend Type */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Kategori Belanja
                </label>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Semua (CAPEX & OPEX)</option>
                  <option value="CAPEX">CAPEX (Investasi & Aset)</option>
                  <option value="OPEX">OPEX (Operasional & Rutin)</option>
                </select>
              </div>

              {/* Notes Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Status Catatan (Notes)
                </label>
                <select
                  value={selectedNotesFilter}
                  onChange={(e) => {
                    setSelectedNotesFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Semua Data ({records.length})</option>
                  <option value="with_notes">Memiliki Catatan Notes ({recordsWithNotesCount})</option>
                  <option value="without_notes">Tanpa Catatan ({records.length - recordsWithNotesCount})</option>
                </select>
              </div>

              {/* Rows Per Page */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Tampilkan Baris
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value={15}>15 baris per halaman</option>
                  <option value={25}>25 baris per halaman</option>
                  <option value={50}>50 baris per halaman</option>
                  <option value={100}>100 baris per halaman</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60" onClick={() => { setSortField('purchId'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center space-x-1">
                        <span>PO ID</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3">Unit RS</th>
                    <th className="py-3 px-3">Sumber ERP</th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-200/60" onClick={() => { setSortField('createdDate'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center space-x-1">
                        <span>Periode</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3.5">Vendor / Pemasok</th>
                    <th className="py-3 px-3.5">Deskripsi Barang / Jasa</th>
                    <th className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200/60" onClick={() => { setSortField('purchQty'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center justify-center space-x-1">
                        <span>Qty</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3.5 text-right">Harga Satuan</th>
                    <th className="py-3 px-3.5 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => { setSortField('totalLineAmount'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center justify-end space-x-1">
                        <span>Total Nilai (IDR)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center">Tipe</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-600">Tidak ada data transaksi yang cocok.</p>
                          <p className="text-xs text-slate-400">Silakan sesuaikan kata kunci pencarian atau ubah filter di atas.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map(r => (
                      <tr 
                        key={r.id} 
                        className="hover:bg-blue-50/50 transition-colors font-mono group"
                      >
                        <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-slate-900">{r.purchId}</span>
                            {r.miiReferenceReqNum && (
                              <span className="text-[10px] font-mono font-medium text-purple-700 flex items-center gap-1 mt-0.5" title={`MII Reference / PRQ: ${r.miiReferenceReqNum}`}>
                                <span className="px-1 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold uppercase">PRQ</span>
                                {r.miiReferenceReqNum}
                              </span>
                            )}
                            {r.purchaseReqId && !r.miiReferenceReqNum && (
                              <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                PR: {r.purchaseReqId}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-sans font-bold text-[10px] border border-slate-200">
                            {r.hospitalCode}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                            r.sourceFile?.includes('summary_pr') ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                            r.sourceFile?.includes('capex_d365') ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            r.sourceFile?.includes('opex_d365') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            r.sourceFile?.includes('capex_ax') ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {r.sourceFile === 'summary_pr' ? 'Summary PR' : (r.sourceFile || 'D365')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {r.monthYear || (r.createdDate ? r.createdDate.slice(0, 7) : '-')}
                        </td>
                        <td className="py-3 px-3.5 font-sans text-slate-900 max-w-[160px] truncate" title={r.vendorName}>
                          {r.vendorName}
                        </td>
                        <td className="py-3 px-3.5 font-sans text-slate-900 max-w-[240px]">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 truncate" title={r.itemName}>
                              {r.itemName}
                            </span>
                            {r.itemNotes && (
                              <div className="flex items-center gap-1 mt-0.5" title={`Catatan PO Terpisah:\n${r.itemNotes}`}>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-sans font-medium max-w-[220px] truncate">
                                  <FileText className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                  <span className="truncate">{r.itemNotes.split('\n')[0]}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {Number(r.purchQty || 1).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3.5 text-right text-slate-600">
                          {formatIDR(r.purchPrice || (r.purchQty > 0 ? r.totalLineAmount / r.purchQty : r.totalLineAmount))}
                        </td>
                        <td className="py-3 px-3.5 text-right font-extrabold text-blue-900">
                          {formatIDR(r.totalLineAmount)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                            r.purchaseCategory === 'CAPEX' 
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {r.purchaseCategory}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectRecord(r);
                              if (onSelectRecord) onSelectRecord(r);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Audit Detail Transaksi"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-medium">
                Menampilkan <span className="font-bold text-slate-800">{filteredRawRecords.length > 0 ? startIndex + 1 : 0}</span> sampai{' '}
                <span className="font-bold text-slate-800">{Math.min(startIndex + pageSize, filteredRawRecords.length)}</span> dari{' '}
                <span className="font-bold text-slate-800">{filteredRawRecords.length.toLocaleString('id-ID')}</span> transaksi
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: UPLOAD & INGESTION PIPELINE (FILE EXPLORER UI/UX)              */}
      {/* ========================================================================= */}
      {activeSubTab === 'upload_pipeline' && (
        <div className="space-y-6">
          {/* Status Messages */}
          {uploadError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="font-semibold">{uploadError}</div>
            </div>
          )}

          {uploadSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="font-semibold">{uploadSuccessMsg}</div>
            </div>
          )}

          <FileExplorerPipeline
            fileQueue={fileQueue}
            onFilesSelected={handleFilesSelected}
            onRemoveQueuedFile={handleRemoveQueuedFile}
            onUpdateFileSourceType={handleUpdateFileSourceType}
            onClearQueue={() => setFileQueue([])}
            onStartIngestion={handleProcessMultiUpload}
            isUploading={isUploading}
            onDownloadSampleTemplate={handleDownloadSampleTemplate}
            onDownloadSummaryPrTemplate={handleDownloadSummaryPrTemplate}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: RIWAYAT BATCH IMPOR (BATCH LEDGER TABULAR LOG & DRAWER)         */}
      {/* ========================================================================= */}
      {activeSubTab === 'batch_history' && (
        <BatchLedgerView
          uploadedFiles={uploadedFiles}
          records={records}
          formatIDR={formatIDR}
          onSelectRecord={onSelectRecord}
        />
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: KAMUS DATA & MAPPING SCHEMA                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'data_dictionary' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Kamus Data & Spesifikasi Kolom ERP</h3>
                <p className="text-xs text-slate-500 mt-0.5">Format kolom yang dikenali secara otomatis oleh mesin normalisasi SpendCube</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File Contoh (.xlsx)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Nama Kolom Standar</th>
                    <th className="py-3 px-4">Alias yang Dikenali</th>
                    <th className="py-3 px-4">Tipe Data</th>
                    <th className="py-3 px-4">Deskripsi / Contoh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">hospital_code</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">hospital, site, hospitalcode</td>
                    <td className="py-3 px-4 text-indigo-700">String</td>
                    <td className="py-3 px-4 font-sans text-slate-600">Kode unit RS (contoh: SHLV, SHKJ, MRCCC)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">purch_id</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">poid, purchaseid, ponumber</td>
                    <td className="py-3 px-4 text-indigo-700">String</td>
                    <td className="py-3 px-4 font-sans text-slate-600">Nomor Purchase Order resmi dari ERP</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">name</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">itemname, description, item_desc</td>
                    <td className="py-3 px-4 text-indigo-700">String</td>
                    <td className="py-3 px-4 font-sans text-slate-600">Nama lengkap deskripsi barang atau jasa</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">vendor_name</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">vendor, supplier, suppliername</td>
                    <td className="py-3 px-4 text-indigo-700">String</td>
                    <td className="py-3 px-4 font-sans text-slate-600">Nama rekanan / penyedia barang atau jasa</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">purch_qty</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">qty, quantity, purchasequantity</td>
                    <td className="py-3 px-4 text-indigo-700">Number</td>
                    <td className="py-3 px-4 font-sans text-slate-600">Jumlah kuantitas barang yang dipesan</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">purch_price</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">unitprice, price, harga_satuan</td>
                    <td className="py-3 px-4 text-indigo-700">Number</td>
                    <td className="py-3 px-4 font-sans text-slate-600">Harga per satu unit barang dalam IDR</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">total_line_amount</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">totalamount, total, total_spend</td>
                    <td className="py-3 px-4 text-indigo-700">Number</td>
                    <td className="py-3 px-4 font-sans text-slate-600">Total nilai spend PO baris tersebut (IDR)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-blue-900">purchase_category</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">category, spend_type, tipe_belanja</td>
                    <td className="py-3 px-4 text-indigo-700">String</td>
                    <td className="py-3 px-4 font-sans text-slate-600">CAPEX atau OPEX</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED RECORD AUDIT SLIDE-OVER DRAWER                                   */}
      {/* ========================================================================= */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto p-6 sm:p-8 space-y-6 flex flex-col justify-between border-l border-slate-200">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Audit Detail PO Line</h3>
                    <p className="text-xs font-mono text-slate-400">{inspectRecord.purchId} (Line #{inspectRecord.lineNumber || 1})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Spend Highlights */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Total Line Amount</span>
                  <span className="text-lg font-extrabold font-mono text-blue-900">
                    {formatIDR(inspectRecord.totalLineAmount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/60 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Kuantitas</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {inspectRecord.purchQty} {inspectRecord.purchUnit || 'unit'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Harga Satuan</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {formatIDR(inspectRecord.purchPrice || (inspectRecord.purchQty > 0 ? inspectRecord.totalLineAmount / inspectRecord.purchQty : inspectRecord.totalLineAmount))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed ERP Fields Audit Table */}
              <div className="space-y-3 text-xs">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Atribut Lengkap Transaksi ERP</h4>

                {/* SKU & Notes Separation Highlight */}
                {inspectRecord.itemNotes && (
                  <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-amber-900 font-bold">
                      <span className="flex items-center gap-1.5 font-sans">
                        <FileText className="w-4 h-4 text-amber-600" />
                        Catatan Pengadaan Terpisah (Line 2+)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[9px] font-mono uppercase font-bold">
                        Extracted Note
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap font-sans text-slate-800 text-xs bg-white/90 p-2.5 rounded-lg border border-amber-200/80 leading-relaxed font-normal shadow-2xs">
                      {inspectRecord.itemNotes}
                    </div>
                    <div className="text-[10px] text-amber-800/90 font-sans">
                      Catatan ini telah dipisahkan dari nama SKU sehingga pencocokan ke Master Data SKU menjadi akurat.
                    </div>
                  </div>
                )}

                <div className="space-y-2 font-mono">
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Deskripsi Barang (SKU Bersih):</span>
                    <span className="font-bold text-slate-900 text-right max-w-[260px] truncate" title={inspectRecord.itemName}>
                      {inspectRecord.itemName}
                    </span>
                  </div>
                  {inspectRecord.rawItemName && inspectRecord.rawItemName !== inspectRecord.itemName && (
                    <div className="p-3 bg-slate-50 rounded-xl flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-sans">Input Mentah Sel Excel:</span>
                        <span className="text-[10px] text-slate-400 font-sans">Sebelum Dipisah</span>
                      </div>
                      <div className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap bg-white p-2 rounded-lg border border-slate-200 leading-relaxed max-h-24 overflow-y-auto">
                        {inspectRecord.rawItemName}
                      </div>
                    </div>
                  )}
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Vendor / Supplier:</span>
                    <span className="font-bold text-slate-900 text-right max-w-[260px] truncate" title={inspectRecord.vendorName}>
                      {inspectRecord.vendorName}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Unit Rumah Sakit:</span>
                    <span className="font-bold text-slate-900">{inspectRecord.hospitalCode} ({inspectRecord.archetype || 'General'})</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Sumber File ERP:</span>
                    <span className="font-bold text-blue-700 uppercase">{inspectRecord.sourceFile}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Tanggal Pembuatan:</span>
                    <span className="font-bold text-slate-900">{inspectRecord.createdDate || '-'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Kategori Pengadaan:</span>
                    <span className="font-bold text-slate-900">{inspectRecord.procurementCategory || '-'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Requisition Ref:</span>
                    <span className="font-bold text-slate-900">{inspectRecord.purchReqName || inspectRecord.purchaseReqId || '-'}</span>
                  </div>
                  {inspectRecord.miiReferenceReqNum && (
                    <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl flex items-center justify-between">
                      <span className="text-purple-700 font-sans font-medium flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 text-[10px] font-bold">MII REF / PRQ</span>
                        Pairing Key:
                      </span>
                      <span className="font-bold text-purple-900 font-mono">{inspectRecord.miiReferenceReqNum}</span>
                    </div>
                  )}
                  {inspectRecord.prPairingKeyType && (
                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-slate-500 font-sans">Tipe Kunci Pairing PR:</span>
                      <span className="font-bold text-slate-900 font-mono">{inspectRecord.prPairingKeyType}</span>
                    </div>
                  )}
                  {inspectRecord.requester && (
                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-slate-500 font-sans">Requester (Pemohon PR):</span>
                      <span className="font-bold text-slate-900">{inspectRecord.requester}</span>
                    </div>
                  )}
                  {inspectRecord.costCenter && (
                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-slate-500 font-sans">Cost Center:</span>
                      <span className="font-bold text-slate-900">{inspectRecord.costCenter}</span>
                    </div>
                  )}
                  {inspectRecord.department && (
                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-slate-500 font-sans">Departemen:</span>
                      <span className="font-bold text-slate-900">{inspectRecord.department}</span>
                    </div>
                  )}
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Status Dokumen:</span>
                    <span className="font-bold text-emerald-700">{inspectRecord.prDocumentStatus || inspectRecord.documentState || 'Invoiced'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 font-sans">Syarat Pembayaran:</span>
                    <span className="font-bold text-slate-900">{inspectRecord.paymentTerm || 'Net 30'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Close Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
              >
                Tutup Inspeksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-File Upload & Ingestion Progress Modal */}
      <UploadProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => {
          setIsProgressModalOpen(false);
          if (isProgressCompleted) {
            setActiveSubTab('batch_history');
          }
        }}
        onFinishAndInspect={() => {
          setIsProgressModalOpen(false);
          setActiveSubTab('audit_explorer');
        }}
        isCompleted={isProgressCompleted}
        overallProgress={overallProgress}
        currentStepMessage={currentStepMessage}
        currentStepNumber={currentStepNumber}
        totalFiles={batchItems.length || fileQueue.length || 1}
        currentFileIndex={currentFileIndex}
        items={batchItems}
        overallTotals={batchTotals}
        speedRowsSec={currentSpeedRowsSec}
      />
    </div>
  );
};
