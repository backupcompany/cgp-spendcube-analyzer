import * as XLSX from 'xlsx';
import { SpendRecord, FileSourceType, splitItemNameAndNotes, buildSpendRecordId } from '../../../core/types/spend';

export interface ParseDetailResult {
  records: SpendRecord[];
  totalRowsScanned: number;
  validRecordsCount: number;
  skippedCount: number;
  skippedReasons: {
    emptyItem: number;
    totalRow: number;
    remarkRow: number;
    headerRow: number;
  };
  totalValue: number;
  totalQty: number;
  processingEngine?: 'web-worker' | 'chunked-main-thread';
  rowsPerSec?: number;
}

/**
 * Yields execution to the browser event loop to keep the UI smooth and prevent 'Page Unresponsive'
 */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Sanitizes numeric input from Excel or CSV formats (handles '1,000.00', '1.000,00', 'Rp 50000', etc.)
 */
function cleanNumber(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;
  let str = String(val).trim().replace(/^Rp\s?/i, '').replace(/\s+/g, '');
  if (!str) return 0;
  
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    str = str.replace(/,/g, '');
  } else if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Validates if a row represents a genuine item row or a non-data row (Total, Subtotal, Remark, Note, Header, etc.)
 */
export function evaluateRowValidity(
  itemName: string,
  cleanRow: Record<string, any>
): { isValid: boolean; reason?: 'emptyItem' | 'totalRow' | 'remarkRow' | 'headerRow' } {
  const trimmedName = (itemName || '').trim();

  if (!trimmedName || trimmedName.length < 2) {
    return { isValid: false, reason: 'emptyItem' };
  }

  const lowerName = trimmedName.toLowerCase();

  const headerKeywords = [
    'item name', 'item_name', 'item description', 'description', 'nama barang',
    'deskripsi barang', 'product description', 'nama item', 'nama produk',
    'procurement category', 'item code', 'kode barang', 'uom', 'purchunit', 'satuan'
  ];
  if (headerKeywords.includes(lowerName)) {
    return { isValid: false, reason: 'headerRow' };
  }

  const totalKeywords = [
    'total', 'subtotal', 'sub total', 'sub-total', 'grand total', 'grandtotal',
    'grand-total', 'total amount', 'total nilai', 'total spend', 'total po',
    'jumlah', 'jumlah total', 'total harga', 'total keseluruhan', 'ringkasan total',
    'sum of', 'total line', 'total lines', 'sub_total'
  ];
  const isTotalName = totalKeywords.some(
    kw => lowerName === kw ||
          lowerName.startsWith(kw + ' ') ||
          lowerName.startsWith(kw + ':') ||
          lowerName.startsWith(kw + ' -') ||
          lowerName.startsWith(kw + '_') ||
          lowerName.endsWith(' ' + kw)
  );

  if (
    isTotalName ||
    lowerName.includes('grand total') ||
    lowerName.includes('sub total') ||
    lowerName.startsWith('total :') ||
    lowerName.startsWith('total:') ||
    lowerName.startsWith('jumlah :')
  ) {
    return { isValid: false, reason: 'totalRow' };
  }

  const remarkKeywords = [
    'remark', 'remarks', 'catatan', 'keterangan', 'note', 'notes', 'nb:', 'n.b.',
    'terbilang', 'amount in words', 'halaman', 'page', 'printed on', 'printed by',
    'dicetak pada', 'dicetak oleh', 'prepared by', 'approved by', 'verified by',
    'disetujui oleh', 'dibuat oleh', 'mengetahui', 'otorisasi', 'tanda tangan',
    'syarat & ketentuan', 'terms and conditions', 'perhatian:', 'attention:',
    'pembayaran ditransfer ke', 'bank transfer', 'rekening', 'informasi tambahan'
  ];
  const isRemarkName = remarkKeywords.some(
    kw => lowerName === kw ||
          lowerName.startsWith(kw + ' ') ||
          lowerName.startsWith(kw + ':') ||
          lowerName.startsWith(kw + ' -') ||
          lowerName.startsWith(kw + '_')
  );

  if (isRemarkName) {
    return { isValid: false, reason: 'remarkRow' };
  }

  const rawPurchId = String(cleanRow['purchid'] || cleanRow['purchaseid'] || cleanRow['poid'] || '').toLowerCase().trim();
  const rawVendor = String(cleanRow['vendorname'] || cleanRow['vendor'] || '').toLowerCase().trim();

  if (totalKeywords.includes(rawPurchId) || totalKeywords.includes(rawVendor)) {
    return { isValid: false, reason: 'totalRow' };
  }
  if (remarkKeywords.includes(rawPurchId) || remarkKeywords.includes(rawVendor)) {
    return { isValid: false, reason: 'remarkRow' };
  }

  return { isValid: true };
}

/**
 * Parses Excel files using a background Web Worker when available.
 */
function parseWithWebWorker(
  file: File,
  dataBuffer: ArrayBuffer,
  fileSourceType: FileSourceType,
  onProgress?: (progressPct: number, currentStatus: string, speedRowsSec?: number) => void
): Promise<ParseDetailResult> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./excelWorker.ts', import.meta.url), { type: 'module' });
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (data.requestId !== requestId) return;

        if (data.type === 'progress') {
          if (onProgress) {
            onProgress(data.progressPct, data.currentStatus, data.rowsPerSec);
          }
        } else if (data.type === 'complete') {
          worker.terminate();
          resolve({
            ...data.result,
            processingEngine: 'web-worker'
          });
        } else if (data.type === 'error') {
          worker.terminate();
          reject(new Error(data.error));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      // Transfer dataBuffer to worker for zero-copy high performance
      worker.postMessage(
        {
          requestId,
          dataBuffer,
          fileName: file.name,
          fileSourceType
        },
        [dataBuffer]
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Non-blocking chunked fallback for environments where Web Workers are restricted
 */
async function parseWithChunkedMainThread(
  file: File,
  dataBuffer: ArrayBuffer,
  fileSourceType: FileSourceType,
  onProgress?: (progressPct: number, currentStatus: string, speedRowsSec?: number) => void
): Promise<ParseDetailResult> {
  if (onProgress) onProgress(15, `Membaca struktur file ${file.name}...`);
  await yieldToMainThread();

  if (onProgress) onProgress(30, `Memuat lembar kerja Excel...`);
  await yieldToMainThread();

  const workbook = XLSX.read(dataBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  await yieldToMainThread();
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  
  if (!rawRows || rawRows.length === 0) {
    throw new Error(`File ${file.name} tidak memiliki baris data atau kosong.`);
  }

  const recordsMap = new Map<string, SpendRecord>();
  let counter = 1;
  const skippedReasons = {
    emptyItem: 0,
    totalRow: 0,
    remarkRow: 0,
    headerRow: 0
  };

  let totalValue = 0;
  let totalQty = 0;
  const totalRowsCount = rawRows.length;
  const startTime = Date.now();

  const chunkSize = 250; // Process 250 rows per batch to guarantee smooth 60fps UI

  for (let i = 0; i < totalRowsCount; i++) {
    const row = rawRows[i];

    const cleanRow: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.toLowerCase().replace(/[\s_-]+/g, '');
      cleanRow[cleanKey] = row[key];
    }

    // Guard against PR Summary files accidentally parsed as PO spend
    const isPrSummaryRow = Boolean(
      (cleanRow['purchasereqid'] || cleanRow['waitingtoapprove']) &&
      !cleanRow['purchid'] &&
      !cleanRow['purchprice']
    );
    if (isPrSummaryRow || fileSourceType === 'summary_pr') {
      skippedReasons.emptyItem++;
      continue;
    }

    const rawItemInput = String(
      cleanRow['name'] || cleanRow['itemname'] || cleanRow['subject'] || cleanRow['description'] || cleanRow['itemdescription'] || cleanRow['product'] || ''
    );

    const { itemName, itemNotes, rawItemName, extractedSkuCode } = splitItemNameAndNotes(rawItemInput);

    const validity = evaluateRowValidity(itemName, cleanRow);
    if (!validity.isValid) {
      if (validity.reason) {
        skippedReasons[validity.reason]++;
      }
      continue;
    }

    const hospitalCode = String(
      cleanRow['hospitalcode'] || cleanRow['hospital'] || cleanRow['site'] || cleanRow['unit'] || 'UNKNOWN'
    ).trim().toUpperCase();

    const archetype = String(
      cleanRow['archetype'] || cleanRow['hospitaltype'] || (hospitalCode.startsWith('SHL') || hospitalCode === 'MRCCC' || hospitalCode === '0000' ? 'Premium Speciality' : 'Community Generalist')
    ).trim();

    const rawDate = cleanRow['createddatetime'] || cleanRow['createddate'] || cleanRow['date'] || cleanRow['podate'] || cleanRow['submitteddatetime'] || new Date().toISOString();
    let dateStr = new Date().toISOString().split('T')[0];
    let monthYear = dateStr.substring(0, 7);

    try {
      if (typeof rawDate === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const parsedDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
        dateStr = parsedDate.toISOString().split('T')[0];
        monthYear = dateStr.substring(0, 7);
      } else if (rawDate) {
        const parsed = new Date(String(rawDate));
        if (!isNaN(parsed.getTime())) {
          dateStr = parsed.toISOString().split('T')[0];
          monthYear = dateStr.substring(0, 7);
        }
      }
    } catch {
      // fallback
    }

    const rawErpId = String(cleanRow['erpid'] || cleanRow['erp_id'] || '').trim();
    let purchId = String(
      cleanRow['purchid'] || cleanRow['purchaseid'] || cleanRow['poid'] || cleanRow['ponumber'] || ''
    ).trim();

    let miiReferenceReqNum = String(
      cleanRow['miireferencereqnum'] ||
      cleanRow['mifereferencereqnum'] ||
      cleanRow['miireference'] ||
      cleanRow['prqnumber'] ||
      cleanRow['prqid'] ||
      ''
    ).trim();

    // Dual-Key ERP ID Handler:
    // If ERP ID starts with PRQ, it maps to MIIREFERENCEREQNUM
    // If ERP ID starts with PO, it maps to PURCHID
    if (rawErpId) {
      if (rawErpId.toUpperCase().startsWith('PRQ')) {
        miiReferenceReqNum = rawErpId;
        if (!purchId) {
          purchId = String(cleanRow['purchasereqid'] || cleanRow['prid'] || `PRQ-${counter}`).trim();
        }
      } else {
        if (!purchId) {
          purchId = rawErpId.split(/[,;\s]+/)[0] || `PO-${counter}`;
        }
      }
    }
    if (!purchId) purchId = `PO-${counter}`;

    const lineNumber = cleanRow['linenumber'] || cleanRow['line'] || counter;
    const purchaseReqId = String(cleanRow['purchasereqid'] || cleanRow['prid'] || cleanRow['purchreqname'] || '').trim();
    const purchReqName = miiReferenceReqNum || purchaseReqId || String(cleanRow['purchreqname'] || cleanRow['requisition'] || '').trim();
    const vendorName = String(cleanRow['vendorname'] || cleanRow['vendor'] || cleanRow['supplier'] || (rawErpId ? 'Internal Siloam Procurement' : 'Unknown Vendor')).trim();
    const itemId = String(cleanRow['itemid'] || cleanRow['item'] || cleanRow['code'] || cleanRow['itemcode'] || '').trim();
    const purchUnit = String(cleanRow['purchunit'] || cleanRow['uom'] || cleanRow['unit'] || 'unit').trim();
    const paymentTerm = String(cleanRow['payment'] || cleanRow['top'] || cleanRow['paymentterm'] || 'Net 30 Days').trim();

    const rawCategory = String(cleanRow['categorytype'] || cleanRow['purchasecategory'] || cleanRow['category'] || '').toUpperCase();
    const purchaseCategory = rawCategory.includes('CAPEX') ? 'CAPEX' : 'OPEX';

    const documentState = String(cleanRow['documentstate'] || cleanRow['documentstatus'] || cleanRow['approvalstatus'] || cleanRow['status'] || 'Approved').trim();
    const purchasePool = String(cleanRow['purchasepool'] || cleanRow['purchase_pool'] || 'Ad Hoc Procurement').trim();
    const purchStatusNamePo = String(cleanRow['purchstatusnamepo'] || cleanRow['postatus'] || 'Invoiced').trim();
    
    const requester = String(cleanRow['requester'] || cleanRow['createdby'] || '').trim();
    const department = String(cleanRow['description'] || cleanRow['department'] || cleanRow['dept'] || '').trim();
    const costCenter = String(cleanRow['costcenter'] || cleanRow['cc'] || '').trim();
    const prSubject = String(cleanRow['subject'] || itemName).trim();
    const prCategoryType = String(cleanRow['categorytype'] || '').trim();
    const prDocumentStatus = documentState;
    const prPairingKeyType: 'PO' | 'PRQ' | 'UNPAIRED' = rawErpId.toUpperCase().startsWith('PRQ') 
      ? 'PRQ' 
      : (rawErpId.toUpperCase().startsWith('PO') || purchId.toUpperCase().startsWith('PO')) 
      ? 'PO' 
      : 'UNPAIRED';

    const procurementCategory = String(cleanRow['procurementcategory'] || cleanRow['categorytype'] || cleanRow['mappedcategory'] || 'General Consumables').trim();
    const mappedCategory = String(cleanRow['mappedcategory'] || procurementCategory).trim();

    const purchPrice = cleanNumber(
      cleanRow['purchprice'] || cleanRow['unitprice'] || cleanRow['price'] || cleanRow['hargasatuan']
    );

    const purchQty = cleanNumber(
      cleanRow['purchqty'] || cleanRow['purchasequantity'] || cleanRow['qty'] || cleanRow['quantity']
    ) || 1;

    const lineDisc = cleanNumber(cleanRow['linedisc'] || cleanRow['discount']);
    const linePercent = cleanNumber(cleanRow['linepercent'] || cleanRow['line_percent']);

    const rawTotalLine = cleanNumber(
      cleanRow['totallineamount'] || cleanRow['totalamount'] || cleanRow['totalspend'] || cleanRow['total']
    );

    const calculatedTotal = purchPrice > 0 ? (purchPrice * purchQty - lineDisc) : 0;
    const finalTotalAmount = rawTotalLine > 0 ? rawTotalLine : (calculatedTotal > 0 ? calculatedTotal : 0);
    const finalUnitPrice = purchPrice > 0 ? purchPrice : (purchQty > 0 ? finalTotalAmount / purchQty : 0);

    // Transaksi unik murni berdasarkan PO ID dan Line Number (Hospital code dan File source tidak relevan)
    const deterministicId = buildSpendRecordId(purchId, lineNumber, counter);

    const recordItem: SpendRecord = {
      id: deterministicId,
      sourceFile: fileSourceType,
      sourceFileName: file.name,
      hospitalCode,
      archetype,
      createdDate: dateStr,
      monthYear,
      purchId,
      lineNumber,
      purchReqName,
      miiReferenceReqNum,
      vendorName,
      itemId,
      itemName,
      rawItemName,
      itemNotes,
      extractedSkuCode,
      purchUnit,
      paymentTerm,
      purchaseCategory,
      documentState,
      purchasePool,
      purchStatusNamePo,
      procurementCategory,
      mappedCategory,
      purchPrice: finalUnitPrice,
      purchQty,
      lineDisc,
      linePercent,
      totalLineAmount: finalTotalAmount,
      currency: 'IDR',
      purchaseReqId: purchaseReqId || undefined,
      requester: requester || undefined,
      department: department || undefined,
      costCenter: costCenter || undefined,
      prSubject: prSubject || undefined,
      prCategoryType: prCategoryType || undefined,
      prDocumentStatus: prDocumentStatus || undefined,
      prPairingKeyType: prPairingKeyType
    };

    // Bila ada perpaduan PO ID dan Line Number yang sama, artinya ini adalah transaksi yang sama.
    // Gunakan yang terakhir di-upload (kurangi data lama, ganti dengan data terbaru).
    if (recordsMap.has(deterministicId)) {
      const prev = recordsMap.get(deterministicId)!;
      totalValue -= (prev.totalLineAmount || 0);
      totalQty -= (prev.purchQty || 0);
    }

    totalValue += finalTotalAmount;
    totalQty += purchQty;
    recordsMap.set(deterministicId, recordItem);

    // Yield control back to browser every chunk to prevent UI freeze
    if (i % chunkSize === 0 || i === totalRowsCount - 1) {
      const progressPct = 35 + Math.round((i / totalRowsCount) * 55);
      const rowsPerSec = Math.round((i / Math.max(0.1, (Date.now() - startTime) / 1000)));
      if (onProgress) {
        onProgress(progressPct, `Menormalisasi baris ${i.toLocaleString('id-ID')} dari ${totalRowsCount.toLocaleString('id-ID')} (${rowsPerSec.toLocaleString('id-ID')} baris/detik)...`, rowsPerSec);
      }
      await yieldToMainThread();
    }
  }

  const records = Array.from(recordsMap.values());
  const skippedTotal = skippedReasons.emptyItem + skippedReasons.totalRow + skippedReasons.remarkRow + skippedReasons.headerRow;

  return {
    records,
    totalRowsScanned: totalRowsCount,
    validRecordsCount: records.length,
    skippedCount: skippedTotal,
    skippedReasons,
    totalValue,
    totalQty,
    processingEngine: 'chunked-main-thread'
  };
}

/**
 * Main ingestion entry point with automatic Web Worker acceleration and chunked non-blocking fallback
 */
export async function parseExcelFileWithDetails(
  file: File, 
  fileSourceType: FileSourceType,
  onProgress?: (progressPct: number, currentStatus: string, speedRowsSec?: number) => void
): Promise<ParseDetailResult> {
  if (onProgress) onProgress(5, `Membaca file ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
  const data = await file.arrayBuffer();

  // Try Web Worker first
  if (typeof Worker !== 'undefined') {
    try {
      return await parseWithWebWorker(file, data, fileSourceType, onProgress);
    } catch (workerErr) {
      console.warn('Web Worker execution fallback to chunked main thread:', workerErr);
      // If buffer was transferred or detached, re-read
      const fallbackBuffer = data.byteLength === 0 ? await file.arrayBuffer() : data;
      return await parseWithChunkedMainThread(file, fallbackBuffer, fileSourceType, onProgress);
    }
  }

  return await parseWithChunkedMainThread(file, data, fileSourceType, onProgress);
}

export async function parseExcelFile(file: File, fileSourceType: FileSourceType): Promise<SpendRecord[]> {
  const result = await parseExcelFileWithDetails(file, fileSourceType);
  return result.records;
}

