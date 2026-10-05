import * as XLSX from 'xlsx';
import { SpendRecord, FileSourceType, splitItemNameAndNotes, buildSpendRecordId } from '../../../core/types/spend';

/**
 * Web Worker for parsing Excel/CSV procurement files off the main thread.
 * This ensures the browser UI never freezes or shows "Page Unresponsive".
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

function parseExcelDateSafe(rawDate: any): { dateStr: string; monthYear: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const defaultDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (rawDate === null || rawDate === undefined || rawDate === '') {
    return { dateStr: defaultDateStr, monthYear: defaultDateStr.substring(0, 7) };
  }

  // 1. Handle Excel serial number without timezone shift
  if (typeof rawDate === 'number' && !isNaN(rawDate)) {
    const totalDays = Math.floor(rawDate);
    const adjustedDays = rawDate > 60 ? totalDays - 1 : totalDays;
    const epochUtcMs = Date.UTC(1899, 11, 31);
    const d = new Date(epochUtcMs + adjustedDays * 86400000);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = pad(d.getUTCMonth() + 1);
      const day = pad(d.getUTCDate());
      const dateStr = `${year}-${month}-${day}`;
      return { dateStr, monthYear: `${year}-${month}` };
    }
  }

  const str = String(rawDate).trim();

  // 2. Format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = pad(Number(isoMatch[2]));
    const day = pad(Number(isoMatch[3]));
    const dateStr = `${year}-${month}-${day}`;
    return { dateStr, monthYear: `${year}-${month}` };
  }

  // 3. Format DD-MM-YYYY or DD/MM/YYYY (Indonesian / UK format)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = pad(Number(dmyMatch[1]));
    const month = pad(Number(dmyMatch[2]));
    const year = dmyMatch[3];
    const dateStr = `${year}-${month}-${day}`;
    return { dateStr, monthYear: `${year}-${month}` };
  }

  // 4. Fallback Date parsing with local component getters to prevent UTC shift
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = pad(parsed.getMonth() + 1);
    const day = pad(parsed.getDate());
    const dateStr = `${year}-${month}-${day}`;
    return { dateStr, monthYear: `${year}-${month}` };
  }

  return { dateStr: defaultDateStr, monthYear: defaultDateStr.substring(0, 7) };
}

function evaluateRowValidity(
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

self.onmessage = async (e: MessageEvent) => {
  const { dataBuffer, fileName, fileSourceType, requestId } = e.data;

  try {
    const startTime = Date.now();

    // 1. Post progress: Parsing binary structure
    self.postMessage({
      type: 'progress',
      requestId,
      progressPct: 15,
      currentStatus: `[WebWorker] Membaca binary workbook ${fileName}...`,
      rowsProcessed: 0,
      totalRows: 0
    });

    const workbook = XLSX.read(dataBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 2. Post progress: Converting sheet to JSON
    self.postMessage({
      type: 'progress',
      requestId,
      progressPct: 35,
      currentStatus: `[WebWorker] Mengonversi lembar data ${firstSheetName}...`,
      rowsProcessed: 0,
      totalRows: 0
    });

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      throw new Error(`Berkas ${fileName} tidak memiliki baris data atau kosong.`);
    }

    const totalRowsCount = rawRows.length;
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

    const chunkSize = 1000;
    let lastReportTime = Date.now();

    // 3. Process rows in chunks and report progress
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
        cleanRow['name'] || cleanRow['itemname'] || cleanRow['description'] || cleanRow['itemdescription'] || cleanRow['product'] || ''
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
        cleanRow['hospitalcode'] || cleanRow['hospital'] || cleanRow['site'] || 'UNKNOWN'
      ).trim().toUpperCase();

      const archetype = String(
        cleanRow['archetype'] || cleanRow['hospitaltype'] || 'General'
      ).trim();

      const rawDate = cleanRow['createddatetime'] || cleanRow['createddate'] || cleanRow['date'] || cleanRow['podate'];
      const { dateStr, monthYear } = parseExcelDateSafe(rawDate);

      const purchId = String(
        cleanRow['purchid'] || cleanRow['purchaseid'] || cleanRow['poid'] || cleanRow['ponumber'] || `PO-${counter}`
      ).trim();

      const lineNumber = cleanRow['linenumber'] || cleanRow['line'] || counter;
      const purchReqName = String(cleanRow['purchreqname'] || cleanRow['mifereferencereqnum'] || cleanRow['requisition'] || '').trim();
      const vendorName = String(cleanRow['vendorname'] || cleanRow['vendor'] || cleanRow['supplier'] || 'Unknown Vendor').trim();
      const itemId = String(cleanRow['itemid'] || cleanRow['item'] || cleanRow['code'] || cleanRow['itemcode'] || '').trim();
      const purchUnit = String(cleanRow['purchunit'] || cleanRow['uom'] || cleanRow['unit'] || 'unit').trim();
      const paymentTerm = String(cleanRow['payment'] || cleanRow['top'] || cleanRow['paymentterm'] || 'd30').trim();

      const rawCategory = String(cleanRow['purchasecategory'] || cleanRow['category'] || '').toUpperCase();
      const purchaseCategory = rawCategory.includes('CAPEX') ? 'CAPEX' : rawCategory.includes('OPEX') ? 'OPEX' : (fileSourceType.includes('capex') ? 'CAPEX' : 'OPEX');

      const documentState = String(cleanRow['documentstate'] || cleanRow['approvalstatus'] || cleanRow['status'] || 'Invoiced').trim();
      const purchasePool = String(cleanRow['purchasepool'] || cleanRow['purchase_pool'] || 'Ad Hoc').trim();
      const purchStatusNamePo = String(cleanRow['purchstatusnamepo'] || cleanRow['postatus'] || 'Invoiced').trim();
      
      const procurementCategory = String(cleanRow['procurementcategory'] || cleanRow['geographic_category'] || cleanRow['mappedcategory'] || 'General Consumables').trim();
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
        sourceFile: fileSourceType as FileSourceType,
        sourceFileName: fileName,
        hospitalCode,
        archetype,
        createdDate: dateStr,
        monthYear,
        purchId,
        lineNumber,
        purchReqName,
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
        department: String(cleanRow['department'] || cleanRow['dept'] || cleanRow['bagian'] || cleanRow['divisi'] || '').trim() || undefined,
        requester: String(cleanRow['requester'] || cleanRow['requestor'] || cleanRow['user'] || cleanRow['createdby'] || '').trim() || undefined,
        costCenter: String(cleanRow['costcenter'] || cleanRow['cost_center'] || cleanRow['cc'] || '').trim() || undefined,
        prSubject: String(cleanRow['prsubject'] || cleanRow['subject'] || cleanRow['purpose'] || '').trim() || undefined,
        purchPrice: finalUnitPrice,
        purchQty,
        lineDisc,
        linePercent,
        totalLineAmount: finalTotalAmount,
        currency: 'IDR'
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

      // Periodically report progress back to main thread
      if (i % chunkSize === 0 || Date.now() - lastReportTime > 200) {
        lastReportTime = Date.now();
        const progressPct = 35 + Math.round((i / totalRowsCount) * 55);
        const rowsPerSec = Math.round((i / Math.max(0.1, (Date.now() - startTime) / 1000)));

        self.postMessage({
          type: 'progress',
          requestId,
          progressPct,
          currentStatus: `[WebWorker] Menormalisasi baris ${i.toLocaleString('id-ID')} dari ${totalRowsCount.toLocaleString('id-ID')} (${rowsPerSec.toLocaleString('id-ID')} baris/detik)...`,
          rowsProcessed: i,
          totalRows: totalRowsCount,
          rowsPerSec
        });
      }
    }

    const records = Array.from(recordsMap.values());
    const skippedTotal = skippedReasons.emptyItem + skippedReasons.totalRow + skippedReasons.remarkRow + skippedReasons.headerRow;

    // Send completed message
    self.postMessage({
      type: 'complete',
      requestId,
      result: {
        records,
        totalRowsScanned: totalRowsCount,
        validRecordsCount: records.length,
        skippedCount: skippedTotal,
        skippedReasons,
        totalValue,
        totalQty
      }
    });
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error.message || 'Gagal memproses file di Web Worker'
    });
  }
};
