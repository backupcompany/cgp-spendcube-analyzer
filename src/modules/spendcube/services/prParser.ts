import * as XLSX from 'xlsx';
import { PurchaseRequisitionRecord, UserDepartmentMappingRecord } from '../../../core/types/spend';

export interface PrParseResult {
  records: PurchaseRequisitionRecord[];
  prs: PurchaseRequisitionRecord[];
  harvestedUsers: UserDepartmentMappingRecord[];
  pairedCount: number;
  pairedViaPoCount: number;
  pairedViaPrqCount: number;
  unpairedCount: number;
  totalAmount: number;
  uniqueUnits: string[];
  uniqueRequesters: string[];
  uniqueDepartments: string[];
  errors: string[];
}

/**
 * Parses an Excel or CSV file containing PR data matching the Siloam ERP export (Summary PR)
 * Supports dual-key pairing:
 * - 'PO' prefix -> pairs with PURCHID in SpendRecord
 * - 'PRQ' prefix -> pairs with MIIREFERENCEREQNUM in SpendRecord
 */
export async function parsePrFile(
  file: File,
  existingSpendKeys: Set<string> | { poIds?: Set<string>; miiRefNums?: Set<string> } = new Set()
): Promise<PrParseResult> {
  const poSet = existingSpendKeys instanceof Set 
    ? existingSpendKeys 
    : (existingSpendKeys.poIds || new Set<string>());
  const miiSet = existingSpendKeys instanceof Set 
    ? existingSpendKeys 
    : (existingSpendKeys.miiRefNums || new Set<string>());
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const records: PurchaseRequisitionRecord[] = [];
  const harvestedUsersMap = new Map<string, UserDepartmentMappingRecord>();
  const errors: string[] = [];

  let pairedCount = 0;
  let pairedViaPoCount = 0;
  let pairedViaPrqCount = 0;
  let unpairedCount = 0;
  let totalAmount = 0;

  const unitSet = new Set<string>();
  const requesterSet = new Set<string>();
  const deptSet = new Set<string>();

  rawRows.forEach((row, idx) => {
    // Flexible header lookup
    const getVal = (keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
        // Case-insensitive lookup
        const lowerKey = k.toLowerCase();
        for (const rowProp of Object.keys(row)) {
          if (rowProp.toLowerCase() === lowerKey && String(row[rowProp]).trim() !== '') {
            return String(row[rowProp]).trim();
          }
        }
      }
      return '';
    };

    let unit = getVal(['Unit', 'Hospital Unit', 'HospitalUnit', 'Unit Code', 'Kode Unit']);
    if (unit) {
      // Ensure 4 digits 0000 - 9999
      const num = parseInt(unit, 10);
      if (!isNaN(num) && num >= 0 && num <= 9999) {
        unit = String(num).padStart(4, '0');
      } else {
        unit = unit.replace(/\D/g, '').slice(0, 4).padStart(4, '0');
      }
    } else {
      unit = '0000';
    }

    const prId = getVal(['Purchase Req ID', 'PurchaseReqID', 'Purchase Req Id', 'PR ID', 'No PR', 'Purchase Req', 'PR Number']) || `pr-${unit}-26-${idx + 1}`;
    const subject = getVal(['Subject', 'Project Name', 'Project', 'Nama Project', 'Keterangan Project', 'Title']) || 'Pengadaan Operasional';
    const categoryType = getVal(['Category Type', 'CategoryType', 'Kategori PR', 'Tipe Kategori']) || 'other opex';
    const documentStatus = getVal(['Document Status', 'Status', 'Doc Status']) || 'Approved';
    const requester = getVal(['Requester', 'Requestor', 'User', 'Username', 'Dibuat Oleh', 'Pemohon']) || 'system.user';
    let costCenter = getVal(['Cost Center', 'CostCenter', 'Cost Centre', 'CC', 'Kode Cost Center']) || '0000';
    if (costCenter && !isNaN(parseInt(costCenter, 10))) {
      costCenter = String(parseInt(costCenter, 10)).padStart(4, '0');
    }

    const description = getVal(['Description', 'Dept', 'Department', 'Nama Dept', 'Cost Center Name']) || 'General Administration';
    const waitingTo = getVal(['Waiting To Approve', 'Waiting To', 'WaitingTo', 'Approver', 'Next Approver']) || '';
    const erpId = getVal(['ERP ID', 'ERPID', 'No PO', 'PO Number', 'Purchase Order', 'PO ID', 'PurchId']);
    const createdDate = getVal(['Created Date & Time', 'Created Date', 'CreatedDate', 'Tanggal Buat', 'Date Created']) || new Date().toISOString().split('T')[0];
    const submittedDate = getVal(['Submitted Date & Time', 'Submitted', 'Submitted Date', 'Tanggal Submit']) || createdDate;

    // Parse amount
    let rawAmount = getVal(['Total Amount', 'TotalAmount', 'Amount', 'Total Nilai', 'Nilai PR', 'Total']);
    let parsedAmount = 0;
    if (rawAmount) {
      // Remove Rp, commas, dots
      const cleanNum = rawAmount.replace(/[Rp\s,]/g, '');
      parsedAmount = parseFloat(cleanNum) || 0;
    }

    totalAmount += parsedAmount;
    unitSet.add(unit);
    requesterSet.add(requester);
    deptSet.add(description);

    // Support comma-separated ERP IDs (e.g. "PO-0000-260100001,PO-0000-260100002" or "PRQ-2601-0003646")
    const erpTokens = erpId ? erpId.split(/[,;\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean) : [];
    let isMatchedViaPo = false;
    let isMatchedViaPrq = false;

    for (const token of erpTokens) {
      if (token.startsWith('PO') || (!token.startsWith('PRQ') && poSet.has(token))) {
        if (poSet.has(token)) {
          isMatchedViaPo = true;
          break;
        }
      } else if (token.startsWith('PRQ') || miiSet.has(token)) {
        if (miiSet.has(token)) {
          isMatchedViaPrq = true;
          break;
        }
      }
      // Fallback cross check
      if (poSet.has(token)) {
        isMatchedViaPo = true;
        break;
      }
      if (miiSet.has(token)) {
        isMatchedViaPrq = true;
        break;
      }
    }

    const pairingStatus: 'PAIRED_PO' | 'PAIRED_PRQ' | 'UNPAIRED' = isMatchedViaPo 
      ? 'PAIRED_PO' 
      : isMatchedViaPrq 
      ? 'PAIRED_PRQ' 
      : 'UNPAIRED';

    if (isMatchedViaPo) {
      pairedCount++;
      pairedViaPoCount++;
    } else if (isMatchedViaPrq) {
      pairedCount++;
      pairedViaPrqCount++;
    } else {
      unpairedCount++;
    }

    const prRecord: PurchaseRequisitionRecord = {
      id: prId,
      unit,
      purchaseReqId: prId,
      subject,
      categoryType,
      documentStatus,
      requester,
      costCenter,
      description,
      waitingTo,
      erpId,
      createdDate,
      submittedDate,
      totalAmount: parsedAmount,
      pairingStatus,
      pairedPoCount: erpTokens.length
    };

    records.push(prRecord);

    // Harvest username to department mapping
    if (requester && requester !== 'system.user' && !harvestedUsersMap.has(requester.toLowerCase())) {
      // Format human-friendly name from username (e.g. carren.mokalu -> Carren Mokalu)
      const formattedName = requester
        .split(/[._-]/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      // Capitalize department
      const formattedDept = description
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      harvestedUsersMap.set(requester.toLowerCase(), {
        id: `map-${requester.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        username: requester.toLowerCase(),
        fullName: formattedName,
        department: formattedDept || 'General Operations',
        costCenter,
        hospitalUnitCode: unit,
        hospitalName: unit === '0000' ? 'Siloam Hospitals Head Office CGP' : `Unit RS Siloam (${unit})`,
        email: `${requester.toLowerCase()}@siloamhospitals.com`,
        title: `${formattedDept} Staff / Requester`,
        isActive: true,
      });
    }
  });

  return {
    records,
    prs: records,
    harvestedUsers: Array.from(harvestedUsersMap.values()),
    pairedCount,
    pairedViaPoCount,
    pairedViaPrqCount,
    unpairedCount,
    totalAmount,
    uniqueUnits: Array.from(unitSet),
    uniqueRequesters: Array.from(requesterSet),
    uniqueDepartments: Array.from(deptSet),
    errors,
  };
}

/**
 * Downloads a sample Excel file formatted exactly like the user's screenshot
 */
export function downloadPrExcelTemplate(): void {
  const sampleRows = [
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
      'Created Date & Time': '2026-01-02 10:25:16',
      'Submitted Date & Time': '2026-01-02 10:28:51',
      'Total Amount': 199800000
    },
    {
      'Unit': '0000',
      'Purchase Req ID': 'pr-0000-26-01-00002',
      'Subject': 'Ecat: Shutterstock dan iStock Desember 2025',
      'Category Type': 'other opex',
      'Document Status': 'Approved',
      'Requester': 'angelina.wijaya',
      'Cost Center': '0013',
      'Description': 'strategy and commercial',
      'Waiting To Approve': '',
      'ERP ID': 'PO-0000-260100001,PO-0000-260100002',
      'Created Date & Time': '2026-01-05 11:00:38',
      'Submitted Date & Time': '2026-01-05 11:00:43',
      'Total Amount': 3501708
    },
    {
      'Unit': '0000',
      'Purchase Req ID': 'pr-0000-26-01-00003',
      'Subject': 'Ecat: Monthly Subscription Cursor AI',
      'Category Type': 'contract service / repair & maintenance',
      'Document Status': 'Approved',
      'Requester': 'florencia.elnidwya',
      'Cost Center': '0015',
      'Description': 'procurement',
      'Waiting To Approve': '',
      'ERP ID': 'PO-0000-260100003',
      'Created Date & Time': '2026-01-05 13:05:18',
      'Submitted Date & Time': '2026-01-05 13:05:21',
      'Total Amount': 1250625
    },
    {
      'Unit': '0000',
      'Purchase Req ID': 'pr-0000-26-01-00004',
      'Subject': 'HBI-24-010 - Ultra Plan (DB Jan Subscription Ultra 2026)',
      'Category Type': 'other opex',
      'Document Status': 'Approved',
      'Requester': 'digitalbusiness',
      'Cost Center': '0013',
      'Description': 'strategy and commercial',
      'Waiting To Approve': '',
      'ERP ID': 'PO-0000-260100004',
      'Created Date & Time': '2026-01-05 13:31:42',
      'Submitted Date & Time': '2026-01-05 13:34:47',
      'Total Amount': 18880101
    },
    {
      'Unit': '0000',
      'Purchase Req ID': 'pr-0000-26-01-00005',
      'Subject': 'HBI-24-010 - Ultra Plan (DB Feb Subscription Ultra 2026)',
      'Category Type': 'other opex',
      'Document Status': 'Approved',
      'Requester': 'digitalbusiness',
      'Cost Center': '0013',
      'Description': 'strategy and commercial',
      'Waiting To Approve': '',
      'ERP ID': 'PO-0000-260100005',
      'Created Date & Time': '2026-01-05 13:35:17',
      'Submitted Date & Time': '2026-01-05 13:39:14',
      'Total Amount': 18880101
    },
    {
      'Unit': '0000',
      'Purchase Req ID': 'pr-0000-26-01-00006',
      'Subject': 'Ecat: Kartu Nama - Sales Team (new logo)',
      'Category Type': 'other opex',
      'Document Status': 'Approved',
      'Requester': 'thenia.thenia',
      'Cost Center': '0013',
      'Description': 'strategy and commercial',
      'Waiting To Approve': '',
      'ERP ID': 'PO-0000-260100009',
      'Created Date & Time': '2026-01-05 17:05:05',
      'Submitted Date & Time': '2026-01-05 17:05:08',
      'Total Amount': 4329000
    },
    {
      'Unit': '0000',
      'Purchase Req ID': 'pr-0000-26-01-00007',
      'Subject': 'Ecat: CAP STEMPEL - NEW LOGO SILOAM - NEW LOGO SILOAM',
      'Category Type': 'other opex',
      'Document Status': 'Approved',
      'Requester': 'thenia.thenia',
      'Cost Center': '0013',
      'Description': 'strategy and commercial',
      'Waiting To Approve': '',
      'ERP ID': 'PO-0000-260100025',
      'Created Date & Time': '2026-01-05 17:10:04',
      'Submitted Date & Time': '2026-01-05 17:10:06',
      'Total Amount': 111000
    },
    {
      'Unit': '0000',
      'Purchase Req ID': 'pr-0000-26-01-00008',
      'Subject': 'Ecat: Emplifi - Social media analytic tools',
      'Category Type': 'other opex',
      'Document Status': 'Approved',
      'Requester': 'hervira.veronica',
      'Cost Center': '0013',
      'Description': 'strategy and commercial',
      'Waiting To Approve': '',
      'ERP ID': 'PO-0000-260100016',
      'Created Date & Time': '2026-01-06 13:25:05',
      'Submitted Date & Time': '2026-01-06 13:25:08',
      'Total Amount': 251775000
    },
    {
      'Unit': '1001',
      'Purchase Req ID': 'pr-1001-26-01-00001',
      'Subject': 'Seng Plastik Bening',
      'Category Type': 'contract service / repair & maintenance',
      'Document Status': 'Approved',
      'Requester': 'jeremiah.panggabean',
      'Cost Center': '5000',
      'Description': 'facility management service & general affair',
      'Waiting To Approve': '',
      'ERP ID': 'PRQ-2601-0003644',
      'Created Date & Time': '2026-01-05 13:06:14',
      'Submitted Date & Time': '2026-01-05 13:10:58',
      'Total Amount': 240000
    },
    {
      'Unit': '1001',
      'Purchase Req ID': 'pr-1001-26-01-00002',
      'Subject': 'Perbaikan sofa IPD Genezaret',
      'Category Type': 'contract service / repair & maintenance',
      'Document Status': 'Approved',
      'Requester': 'yuni.mulyanti',
      'Cost Center': '5000',
      'Description': 'facility management service & general affair',
      'Waiting To Approve': '',
      'ERP ID': 'PRQ-2601-0003646',
      'Created Date & Time': '2026-01-05 14:48:46',
      'Submitted Date & Time': '2026-01-05 14:50:57',
      'Total Amount': 1500000
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PR_Requisitions');
  XLSX.writeFile(wb, 'Template_Data_PR_Siloam_ERP.xlsx');
}
