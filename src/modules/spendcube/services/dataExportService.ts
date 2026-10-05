import { SpendRecord } from '../../../core/types/spend';

/**
 * Clean & Format raw string to CSV-safe string
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export raw spend records to a CSV file compatible with Excel
 */
export function exportSpendRecordsToCsv(
  records: SpendRecord[], 
  filenamePrefix: string = 'Siloam_SpendData_Export'
): void {
  if (!records || records.length === 0) {
    alert('Tidak ada data transaksi yang dapat diexport.');
    return;
  }

  // Define comprehensive columns for Excel Analysis
  const headers = [
    'PO Number',
    'PO Line Number',
    'Created Date',
    'Month-Year',
    'Unit / Hospital Code',
    'Vendor Name',
    'Item ID',
    'Item Name (Deskripsi Barang)',
    'Purchase Request Name',
    'Purchase Category (CAPEX/OPEX)',
    'Procurement Category',
    'Quantity',
    'Unit (UOM)',
    'Currency',
    'Unit Price',
    'Total Line Amount (IDR)',
    'Source File',
    'Taxonomy Lv1',
    'Taxonomy Lv2',
    'Taxonomy Lv3',
    'Taxonomy Lv4',
    'Taxonomy Lv5'
  ];

  const csvRows: string[] = [];
  
  // Add UTF-8 BOM so Excel opens Indonesian characters properly without weird encoding
  const BOM = '\uFEFF';
  csvRows.push(headers.map(escapeCsvCell).join(','));

  records.forEach(r => {
    const row = [
      r.purchId || '',
      r.lineNumber !== undefined ? r.lineNumber : '',
      r.createdDate || '',
      r.monthYear || '',
      r.hospitalCode || '',
      r.vendorName || '',
      r.itemId || '',
      r.itemName || '',
      r.purchReqName || '',
      r.purchaseCategory || '',
      r.procurementCategory || '',
      r.purchQty !== undefined ? r.purchQty : '',
      r.purchUnit || '',
      r.currency || 'IDR',
      r.purchPrice !== undefined ? r.purchPrice : '',
      r.totalLineAmount !== undefined ? r.totalLineAmount : '',
      r.sourceFile || '',
      r.taxonomyLv1 || '',
      r.taxonomyLv2 || '',
      r.taxonomyLv3 || '',
      r.taxonomyLv4 || '',
      r.taxonomyLv5 || ''
    ];
    csvRows.push(row.map(escapeCsvCell).join(','));
  });

  const csvString = BOM + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `${filenamePrefix}_${timestamp}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export raw spend records to JSON
 */
export function exportSpendRecordsToJson(
  records: SpendRecord[],
  filenamePrefix: string = 'Siloam_SpendData_Export'
): void {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(records, null, 2)
  )}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `${filenamePrefix}_${timestamp}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
