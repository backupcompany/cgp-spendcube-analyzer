import { SpendRecord, FileSourceType, buildSpendRecordId } from '../../../core/types/spend';

export function generateSampleSpendRecords(): SpendRecord[] {
  const hospitals = [
    'SHLV', 'SHKJ', 'MRCCC', 'SHBC', 'SHBG', 
    'RSUSW', 'SHAB', 'SHJK', 'SHMDN', 'SHPLB', 
    'SHBALI', 'SHMKS', 'SHBPP'
  ];

  const itemsCatalog = [
    { 
      code: '810000921', 
      name: 'Surgical Glove Powder-Free Box of 100', 
      cat: 'Medical Consumables', 
      basePrice: 120000, 
      type: 'OPEX' as const,
      skuMasterId: '121107092048',
      standardPrice: 125000,
      vendors: [
        { name: 'MEDIKA SARANA SEJAHTERA', trendMultiplier: [1.0, 1.08, 1.15, 1.22, 1.30, 1.37], regionalMarkup: { 'SHBALI': 1.15, 'SHMDN': 1.12, 'SHMKS': 1.18, 'SHBPP': 1.20 } },
        { name: 'PRIMA MEDIKA UTAMA', trendMultiplier: [0.98, 0.99, 1.0, 1.01, 1.01, 1.02], regionalMarkup: { 'SHBALI': 1.04, 'SHMDN': 1.05, 'SHMKS': 1.05, 'SHBPP': 1.06 } }
      ]
    },
    { 
      code: '710000013', 
      name: 'LAPTOP ; INTEL ULTRA 5 125U, RAM 16GB SSD 512GB', 
      cat: 'IT Equipment', 
      basePrice: 12500000, 
      type: 'CAPEX' as const,
      skuMasterId: '710000013',
      standardPrice: 12000000,
      vendors: [
        { name: 'BHAKTI SOLUSINDO, PT', trendMultiplier: [1.0, 1.02, 1.05, 1.07, 1.09, 1.12], regionalMarkup: { 'SHMKS': 1.08, 'SHMDN': 1.06, 'SHBPP': 1.09, 'SHBALI': 1.05 } },
        { name: 'MEDIA KARYA UTAMA, PT', trendMultiplier: [0.97, 0.97, 0.98, 0.98, 0.98, 0.99], regionalMarkup: { 'SHMKS': 1.02, 'SHMDN': 1.02, 'SHBPP': 1.03, 'SHBALI': 1.02 } }
      ]
    },
    { 
      code: '910000112', 
      name: 'Pharmaceutical Reagents - BioChemistry Panel', 
      cat: 'Laboratory Supplies', 
      basePrice: 5800000, 
      type: 'OPEX' as const,
      skuMasterId: '910000112',
      standardPrice: 6500000, // Standard in ERP is currently set too high at 6.5M vs actual 5.8M
      vendors: [
        { name: 'FARMA SEHAT INDONESIA', trendMultiplier: [1.0, 1.04, 1.08, 1.12, 1.18, 1.24], regionalMarkup: { 'RSUSW': 1.15, 'SHMDN': 1.20, 'SHBALI': 1.12 } },
        { name: 'CITRA DIAGNOSTIKA', trendMultiplier: [0.96, 0.97, 0.97, 0.98, 0.98, 0.99], regionalMarkup: { 'RSUSW': 1.03, 'SHMDN': 1.04, 'SHBALI': 1.03 } }
      ]
    },
    { 
      code: '710000025', 
      name: 'INFUSION PUMP SINGLE CHANNEL TOUCH SCREEN', 
      cat: 'Medical Equipment Maintenance', 
      basePrice: 18500000, 
      type: 'CAPEX' as const,
      skuMasterId: '141020050012',
      standardPrice: 19000000,
      vendors: [
        { name: 'GLOBAL PRATAMA MEDIKA', trendMultiplier: [1.0, 1.01, 1.02, 1.03, 1.03, 1.04], regionalMarkup: { 'SHBPP': 1.05, 'SHMKS': 1.04, 'SHMDN': 1.03 } }
      ]
    },
    { 
      code: '490110017', 
      name: 'GREETING CARDS ; CNY, IDUL FITRI, CHRISTMAS', 
      cat: 'General Supplies', 
      basePrice: 8500, 
      type: 'OPEX' as const,
      skuMasterId: '490110017',
      standardPrice: 12000, // Standard price in ERP is 12,000 (overestimated reference)
      vendors: [
        { name: 'DRIYATA MA LESTARI', trendMultiplier: [1.0, 1.05, 1.10, 1.15, 1.20, 1.28], regionalMarkup: { 'RSUSW': 1.18, 'SHJK': 1.15, 'SHBALI': 1.22 } }
      ]
    },
    { 
      code: '720000019', 
      name: 'TEMPAT SAMPAH MEDIS PEDAL PLASTIK 20L Shinpo', 
      cat: 'Project Office Equipment', 
      basePrice: 115000, 
      type: 'CAPEX' as const,
      skuMasterId: '720000019',
      standardPrice: 110000,
      vendors: [
        { name: 'SUMBER ANUGRAH PLASINDO, PT', trendMultiplier: [1.0, 1.02, 1.03, 1.04, 1.05, 1.06], regionalMarkup: { 'SHMDN': 1.08, 'SHMKS': 1.07 } }
      ]
    },
    { 
      code: '510110014', 
      name: 'RENEWAL ISO 27001 & JCI STANDART AUDIT', 
      cat: 'Professional Services', 
      basePrice: 48000000, 
      type: 'OPEX' as const,
      skuMasterId: '510110014',
      standardPrice: 50000000,
      vendors: [
        { name: 'TUV SUD Indonesia, PT', trendMultiplier: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0], regionalMarkup: {} }
      ]
    },
    { 
      code: '810000452', 
      name: 'MRI Cooling Valve Replacement Kit & Chiller Hose', 
      cat: 'Medical Equipment Maintenance', 
      basePrice: 82000000, 
      type: 'CAPEX' as const,
      skuMasterId: '810000452',
      standardPrice: 85000000,
      taxonomyLv1: 'DIAGNOSTIC AND MEDICAL DEVICES',
      taxonomyLv2: 'MEDICAL EQUIPMENT',
      taxonomyLv3: 'IMAGING & RADIOLOGY',
      defaultDepartment: 'Radiologi & Diagnostic Imaging',
      defaultRequester: 'Radiografer Senior',
      vendors: [
        { name: 'GLOBAL PRATAMA MEDIKA', trendMultiplier: [1.0, 1.02, 1.04, 1.05, 1.07, 1.08], regionalMarkup: { 'SHMKS': 1.06, 'SHMDN': 1.05 } }
      ]
    },
    {
      code: '310110021',
      name: 'Kertas HVS 80gr A4 PaperOne Box 5 Rim',
      cat: 'General Supplies',
      basePrice: 245000,
      type: 'OPEX' as const,
      skuMasterId: '310110021',
      standardPrice: 250000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'PRINTING & PAPER PRODUCTS',
      defaultDepartment: 'Umum & Operasional (GA)',
      defaultRequester: 'Staff Logistik GA',
      vendors: [
        { name: 'PT SURYA CIPTA CEMERLANG', trendMultiplier: [1.0, 1.01, 1.01, 1.02, 1.02, 1.03], regionalMarkup: {} },
        { name: 'CV KARYA MANDIRI KERTAS', trendMultiplier: [0.98, 0.99, 1.0, 1.01, 1.01, 1.02], regionalMarkup: {} }
      ]
    },
    {
      code: '310110022',
      name: 'Formulir Resep Dokter & Rawat Inap (Kertas NCR 3 Ply)',
      cat: 'General Supplies',
      basePrice: 185000,
      type: 'OPEX' as const,
      skuMasterId: '310110022',
      standardPrice: 190000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'PRINTING & PAPER PRODUCTS',
      defaultDepartment: 'Rawat Inap & Poliklinik',
      defaultRequester: 'Head Nurse Poliklinik',
      vendors: [
        { name: 'PT SURYA CIPTA CEMERLANG', trendMultiplier: [1.0, 1.0, 1.01, 1.01, 1.02, 1.02], regionalMarkup: {} },
        { name: 'PT GRAFIKA UTAMA PRIMA', trendMultiplier: [0.97, 0.98, 0.98, 0.99, 0.99, 1.0], regionalMarkup: {} }
      ]
    },
    {
      code: '310110023',
      name: 'Kertas Thermal Roll 80x80mm Struk Kasir & Registrasi',
      cat: 'General Supplies',
      basePrice: 12500,
      type: 'OPEX' as const,
      skuMasterId: '310110023',
      standardPrice: 13000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'PRINTING & PAPER PRODUCTS',
      defaultDepartment: 'Administrasi & Kasir (Billing)',
      defaultRequester: 'Billing & Admission Staff',
      vendors: [
        { name: 'CV KARYA MANDIRI KERTAS', trendMultiplier: [1.0, 1.0, 1.01, 1.01, 1.02, 1.02], regionalMarkup: {} }
      ]
    },
    {
      code: '310110024',
      name: 'Kertas Continuous Form 9.5 x 11 inch 3 Ply Wartel',
      cat: 'General Supplies',
      basePrice: 195000,
      type: 'OPEX' as const,
      skuMasterId: '310110024',
      standardPrice: 200000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'PRINTING & PAPER PRODUCTS',
      defaultDepartment: 'Farmasi & Laboratorium',
      defaultRequester: 'Apoteker Penanggung Jawab',
      vendors: [
        { name: 'PT SURYA CIPTA CEMERLANG', trendMultiplier: [1.0, 1.01, 1.01, 1.02, 1.02, 1.03], regionalMarkup: {} },
        { name: 'PT GRAFIKA UTAMA PRIMA', trendMultiplier: [0.98, 0.99, 1.0, 1.0, 1.01, 1.01], regionalMarkup: {} }
      ]
    },
    {
      code: '810000453',
      name: 'X-Ray Mobile Digital Radiography System & Detector C-Arm',
      cat: 'Medical Equipment Maintenance',
      basePrice: 65000000,
      type: 'CAPEX' as const,
      skuMasterId: '810000453',
      standardPrice: 68000000,
      taxonomyLv1: 'DIAGNOSTIC AND MEDICAL DEVICES',
      taxonomyLv2: 'MEDICAL EQUIPMENT',
      taxonomyLv3: 'IMAGING & RADIOLOGY',
      defaultDepartment: 'Radiologi & Diagnostic Imaging',
      defaultRequester: 'Radiografer Senior',
      vendors: [
        { name: 'PHILIPS HEALTHCARE INDONESIA', trendMultiplier: [1.0, 1.01, 1.02, 1.02, 1.03, 1.03, 1.04, 1.04, 1.05], regionalMarkup: { 'SHKJ': 1.0, 'SHLV': 1.0 } },
        { name: 'SIEMENS HEALTHINEERS INDONESIA', trendMultiplier: [0.98, 0.99, 1.0, 1.01, 1.01, 1.02, 1.02, 1.03, 1.03], regionalMarkup: { 'SHKJ': 1.0, 'SHLV': 1.0 } }
      ]
    },
    {
      code: '310110031',
      name: 'Heavy Duty Stapler Meja & Perforator HD-50',
      cat: 'General Supplies',
      basePrice: 85000,
      type: 'OPEX' as const,
      skuMasterId: '310110031',
      standardPrice: 90000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'STATIONERY & DESK SUPPLIES',
      defaultDepartment: 'Front Office',
      defaultRequester: 'nadia.frontoffice',
      vendors: [
        { name: 'PT SURYA CIPTA CEMERLANG', trendMultiplier: [1.0, 1.0, 1.01, 1.01, 1.02, 1.02], regionalMarkup: {} },
        { name: 'MEDIA KARYA UTAMA, PT', trendMultiplier: [0.98, 0.99, 1.0, 1.0, 1.01, 1.01], regionalMarkup: {} }
      ]
    },
    {
      code: '310110032',
      name: 'Map Folder PP Plastik & Ordner Bantex Folio',
      cat: 'General Supplies',
      basePrice: 42000,
      type: 'OPEX' as const,
      skuMasterId: '310110032',
      standardPrice: 45000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'FILING & DOCUMENT STORAGE',
      defaultDepartment: 'Facility Management Service & General Affair (FMS - GA)',
      defaultRequester: 'bambang.fmsga',
      vendors: [
        { name: 'PT SURYA CIPTA CEMERLANG', trendMultiplier: [1.0, 1.0, 1.01, 1.01, 1.02, 1.02], regionalMarkup: {} },
        { name: 'MEDIA KARYA UTAMA, PT', trendMultiplier: [0.97, 0.98, 0.99, 1.0, 1.0, 1.01], regionalMarkup: {} }
      ]
    },
    {
      code: '310110033',
      name: 'Ballpoint Pen Gel 0.5mm & Whiteboard Marker Box 12 pcs',
      cat: 'General Supplies',
      basePrice: 65000,
      type: 'OPEX' as const,
      skuMasterId: '310110033',
      standardPrice: 68000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'WRITING INSTRUMENTS',
      defaultDepartment: 'Front Office',
      defaultRequester: 'nadia.frontoffice',
      vendors: [
        { name: 'PT SURYA CIPTA CEMERLANG', trendMultiplier: [1.0, 1.01, 1.01, 1.02, 1.02, 1.03], regionalMarkup: {} }
      ]
    },
    {
      code: '710000034',
      name: 'Paper Shredder Mesin Penghancur Dokumen Kantor Cross Cut',
      cat: 'Project Office Equipment',
      basePrice: 3185000,
      type: 'CAPEX' as const,
      skuMasterId: '710000034',
      standardPrice: 3250000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE EQUIPMENT',
      taxonomyLv3: 'OFFICE AUTOMATION',
      defaultDepartment: 'Facility Management Service & General Affair (FMS - GA)',
      defaultRequester: 'bambang.fmsga',
      vendors: [
        { name: 'MEDIA KARYA UTAMA, PT', trendMultiplier: [1.0, 1.0, 1.01, 1.01, 1.02, 1.02], regionalMarkup: {} },
        { name: 'BHAKTI SOLUSINDO, PT', trendMultiplier: [0.99, 1.0, 1.0, 1.01, 1.01, 1.02], regionalMarkup: {} }
      ]
    },
    {
      code: '310110035',
      name: 'Tape Dispenser Meja & Gunting Kantor Stainless Steel',
      cat: 'General Supplies',
      basePrice: 38000,
      type: 'OPEX' as const,
      skuMasterId: '310110035',
      standardPrice: 40000,
      taxonomyLv1: 'GENERAL SUPPLIES',
      taxonomyLv2: 'OFFICE SUPPLIES & ATK',
      taxonomyLv3: 'DESK ACCESSORIES',
      defaultDepartment: 'Front Office',
      defaultRequester: 'nadia.frontoffice',
      vendors: [
        { name: 'PT SURYA CIPTA CEMERLANG', trendMultiplier: [1.0, 1.0, 1.01, 1.01, 1.02, 1.02], regionalMarkup: {} }
      ]
    }
  ];

  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
  const records: SpendRecord[] = [];
  let idCounter = 1;

  months.forEach((month, monthIndex) => {
    hospitals.forEach((hospCode, hospIndex) => {
      itemsCatalog.forEach((item, itemIndex) => {
        // Generate transactions for each item across vendors and hospitals
        item.vendors.forEach((vendorObj, vIndex) => {
          // Spread out transactions to make rich realistic density
          if ((hospIndex + itemIndex + vIndex + monthIndex) % 2 === 0) {
            const trend = vendorObj.trendMultiplier[monthIndex] || 1.0;
            const regMarkup = (vendorObj.regionalMarkup as Record<string, number>)[hospCode] || 1.0;
            
            // Calculate actual purchase price
            const calculatedPrice = Math.round(item.basePrice * trend * regMarkup);
            const qty = item.type === 'CAPEX' 
              ? Math.max(1, (hospIndex % 3) + 1)
              : Math.max(5, ((hospIndex * 7 + itemIndex * 13 + monthIndex * 5) % 45) + 10);
            
            const totalLineAmount = qty * calculatedPrice;
            const day = String(((hospIndex * 3 + itemIndex * 7) % 27) + 1).padStart(2, '0');
            const createdDate = `${month}-${day}T09:15:00Z`;
            const purchId = `PO-${month.replace('-', '')}-${String(1000 + idCounter)}`;
            const purchReqName = `PRQ-${month.replace('-', '')}-${String(500 + idCounter)}`;

            const sourceFile: FileSourceType = item.type === 'CAPEX'
              ? (idCounter % 2 === 0 ? 'capex_d365' : 'capex_ax')
              : (idCounter % 2 === 0 ? 'opex_d365' : 'opex_ax');

            const sourceFileName = sourceFile.includes('capex') 
              ? (sourceFile.includes('d365') ? 'File_1_Capex_D365.xlsx' : 'File_3_Capex_AX.xlsx')
              : (sourceFile.includes('d365') ? 'File_2_Opex_D365.xlsx' : 'File_4_Opex_AX.xlsx');

            idCounter++;
            records.push({
              id: buildSpendRecordId(purchId, 1, idCounter),
              sourceFile,
              sourceFileName,
              hospitalCode: hospCode,
              archetype: hospCode.startsWith('SHL') || hospCode === 'MRCCC' ? 'Premium Speciality' : 'Community Generalist',
              createdDate,
              monthYear: month,
              purchId,
              lineNumber: 1,
              purchReqName,
              miiReferenceReqNum: (idCounter === 3 ? 'PRQ-2601-0003644' : idCounter === 4 ? 'PRQ-2601-0003646' : purchReqName),
              vendorName: vendorObj.name,
              itemId: item.code,
              itemName: item.name,
              purchUnit: item.type === 'CAPEX' ? 'unit' : 'box / pack',
              paymentTerm: 'Net 30 Days',
              purchaseCategory: item.type,
              documentState: 'Invoiced',
              purchasePool: 'Ad Hoc Procurement',
              purchStatusNamePo: 'Invoiced',
              procurementCategory: item.cat,
              mappedCategory: item.cat,
              department: (item as any).defaultDepartment || undefined,
              requester: (item as any).defaultRequester || undefined,
              purchPrice: calculatedPrice,
              purchQty: qty,
              lineDisc: 0,
              linePercent: 0,
              totalLineAmount,
              currency: 'IDR',
              skuMasterId: item.skuMasterId,
              budgetGroup: item.type === 'CAPEX' ? 'Fixed Asset Medical / IT' : 'Operational Consumables',
              taxonomyLv1: (item as any).taxonomyLv1 || (item.cat === 'Medical Consumables' ? 'PHARMACEUTICAL & CONSUMABLES' : item.cat === 'IT Equipment' ? 'INFORMATION TECHNOLOGY' : (item.cat === 'Medical Equipment Maintenance' || item.cat === 'Medical Equipment') ? 'DIAGNOSTIC AND MEDICAL DEVICES' : 'GENERAL SUPPLIES'),
              taxonomyLv2: (item as any).taxonomyLv2 || ((item.cat === 'Medical Equipment Maintenance' || item.cat === 'Medical Equipment') ? 'MEDICAL EQUIPMENT' : item.cat === 'General Supplies' ? 'OFFICE SUPPLIES & ATK' : item.cat),
              taxonomyLv3: (item as any).taxonomyLv3 || ((item.cat === 'Medical Equipment Maintenance' || item.cat === 'Medical Equipment') ? 'IMAGING & RADIOLOGY' : item.cat === 'General Supplies' ? 'STATIONERY & DESK SUPPLIES' : item.cat),
              taxonomyLv4: item.name,
              taxonomyLv5: item.name,
              commodityItem: item.name
            });
          }
        });
      });
    });
  });

  return records;
}
