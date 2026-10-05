import { 
  SpendRecord, 
  UploadedBatchMeta, 
  MonthlyIngestionRecord, 
  MonthlyIngestionYearlySummary,
  MonthlyIngestionFileContribution,
  MonthlyHospitalIngestionSummary,
  buildSpendRecordId
} from '../../../core/types/spend';

const MONTH_NAMES_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_INDO = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export class MonthlyIngestionService {
  /**
   * Helper to get total days in a Gregorian month
   */
  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  /**
   * Get list of unique available years from spend records and upload batches
   */
  getAvailableYears(records: SpendRecord[] = [], uploadedBatches: UploadedBatchMeta[] = []): number[] {
    const yearsSet = new Set<number>();

    for (const r of records) {
      if (r.createdDate) {
        const y = parseInt(r.createdDate.substring(0, 4), 10);
        if (!isNaN(y) && y >= 2000 && y <= 2100) yearsSet.add(y);
      } else if (r.monthYear) {
        const y = parseInt(r.monthYear.substring(0, 4), 10);
        if (!isNaN(y) && y >= 2000 && y <= 2100) yearsSet.add(y);
      }
    }

    for (const b of uploadedBatches) {
      if (b.uploadedAt) {
        const y = new Date(b.uploadedAt).getFullYear();
        if (!isNaN(y) && y >= 2000 && y <= 2100) yearsSet.add(y);
      }
    }

    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear());
    }

    return Array.from(yearsSet).sort((a, b) => b - a); // Descending (e.g. 2025, 2024, ...)
  }

  /**
   * Compute 12 Gregorian Months Health and Aggregation for a specific year and optional hospital
   */
  computeYearlyReconciliation(
    records: SpendRecord[] = [],
    uploadedBatches: UploadedBatchMeta[] = [],
    selectedYear: number,
    hospitalCodeFilter: string = 'ALL'
  ): MonthlyIngestionYearlySummary {
    // 1. Filter by hospital if specified
    const scopedRecords = hospitalCodeFilter === 'ALL'
      ? records
      : records.filter(r => r.hospitalCode === hospitalCodeFilter);

    // Map batch lookup for fast file metadata retrieval
    const batchLookupByFileName = new Map<string, UploadedBatchMeta>();
    for (const b of uploadedBatches) {
      if (b.fileName) {
        batchLookupByFileName.set(b.fileName.trim().toLowerCase(), b);
      }
    }

    const months: MonthlyIngestionRecord[] = [];
    let yearlyTotalSpend = 0;
    let yearlyOpexSpend = 0;
    let yearlyCapexSpend = 0;
    let yearlyTotalQty = 0;
    let yearlyPoSet = new Set<string>();
    let yearlyTotalLines = 0;
    let yearlyOverwrittenLines = 0;
    let yearlyFilesSet = new Set<string>();
    let monthsWithDataCount = 0;
    let latestOverallIngestedAt: string | null = null;

    // Process Gregorian months 1 to 12
    for (let m = 1; m <= 12; m++) {
      const monthStr = String(m).padStart(2, '0');
      const monthKey = `${selectedYear}-${monthStr}`;
      const monthNameIndo = MONTH_NAMES_INDO[m - 1];
      const monthShortIndo = MONTH_SHORT_INDO[m - 1];
      const daysInMonth = this.getDaysInMonth(selectedYear, m);
      const gregorianPeriod = `01 ${monthShortIndo} ${selectedYear} - ${daysInMonth} ${monthShortIndo} ${selectedYear}`;

      // Filter records matching this month
      const rawMonthRecords = scopedRecords.filter(r => {
        if (!r) return false;
        if (r.monthYear === monthKey) return true;
        if (r.createdDate && r.createdDate.startsWith(monthKey)) return true;
        return false;
      });

      // Transaksi unik berdasarkan PO ID dan Line Number.
      // Jika ada perpaduan PO ID dan Line Number yang sama, artinya ini adalah transaksi yang sama.
      // Gunakan yang terakhir di-upload.
      const uniqueLineMap = new Map<string, SpendRecord>();
      let duplicateOverwrites = 0;

      for (const r of rawMonthRecords) {
        const lineKey = buildSpendRecordId(r.purchId, r.lineNumber);
        if (uniqueLineMap.has(lineKey)) {
          duplicateOverwrites++;
        }
        // Selalu gunakan transaksi yang terakhir di-upload
        uniqueLineMap.set(lineKey, r);
      }

      const deduplicatedMonthRecords = Array.from(uniqueLineMap.values());

      let opexSpend = 0;
      let opexQty = 0;
      let opexRecordCount = 0;

      let capexSpend = 0;
      let capexQty = 0;
      let capexRecordCount = 0;

      const fileContribMap = new Map<string, MonthlyIngestionFileContribution>();
      const sourceTypesSet = new Set<string>();
      const uniquePoSet = new Set<string>();

      const hospitalMap = new Map<string, { opex: number; capex: number; total: number; qty: number; count: number }>();
      let latestMonthIngestedAt: string | null = null;

      for (const r of deduplicatedMonthRecords) {
        const spend = Number(r.totalLineAmount) || 0;
        const qty = Number(r.purchQty) || 0;

        // Classify OPEX vs CAPEX
        const isCapex = (r.purchaseCategory || '').toUpperCase() === 'CAPEX' || 
                        (r.sourceFile || '').toLowerCase().includes('capex');

        if (isCapex) {
          capexSpend += spend;
          capexQty += qty;
          capexRecordCount++;
        } else {
          opexSpend += spend;
          opexQty += qty;
          opexRecordCount++;
        }

        // File contribution tracking
        const fileName = r.sourceFileName || (r.sourceFile ? `${r.sourceFile.toUpperCase()}_Export.xlsx` : 'Direct_Ingestion.xlsx');
        if (r.sourceFile) sourceTypesSet.add(r.sourceFile);

        let fileEntry = fileContribMap.get(fileName);
        if (!fileEntry) {
          const batchInfo = batchLookupByFileName.get(fileName.toLowerCase());
          fileEntry = {
            fileName,
            sourceType: r.sourceFile || 'capex_d365',
            recordCount: 0,
            totalValue: 0,
            totalQty: 0,
            uploadedAt: batchInfo ? batchInfo.uploadedAt : (r.createdDate ? `${r.createdDate}T08:00:00.000Z` : new Date().toISOString())
          };
          fileContribMap.set(fileName, fileEntry);
        }
        fileEntry.recordCount++;
        fileEntry.totalValue += spend;
        fileEntry.totalQty += qty;

        // Ingestion Timestamp tracking
        if (fileEntry.uploadedAt) {
          if (!latestMonthIngestedAt || new Date(fileEntry.uploadedAt) > new Date(latestMonthIngestedAt)) {
            latestMonthIngestedAt = fileEntry.uploadedAt;
          }
        }

        // Uniqueness & PO tracking
        if (r.purchId) uniquePoSet.add(r.purchId);

        // Hospital breakdown tracking
        const hCode = r.hospitalCode || 'UNKNOWN';
        let hEntry = hospitalMap.get(hCode);
        if (!hEntry) {
          hEntry = { opex: 0, capex: 0, total: 0, qty: 0, count: 0 };
          hospitalMap.set(hCode, hEntry);
        }
        hEntry.count++;
        hEntry.total += spend;
        hEntry.qty += qty;
        if (isCapex) hEntry.capex += spend;
        else hEntry.opex += spend;
      }

      const totalSpend = opexSpend + capexSpend;
      const totalQty = opexQty + capexQty;
      const totalRecordCount = rawMonthRecords.length;
      const uniquePoCount = uniquePoSet.size;
      const uniqueLineCount = deduplicatedMonthRecords.length;
      const updatedOverwrittenCount = duplicateOverwrites;
      const uniquenessRatioPct = totalRecordCount > 0 
        ? Math.min(100, Math.round((uniqueLineCount / totalRecordCount) * 1000) / 10) 
        : 100;

      const fileContributions = Array.from(fileContribMap.values()).sort((a, b) => b.totalValue - a.totalValue);
      const filesCount = fileContributions.length;

      // Hospital breakdowns array
      const hospitalBreakdowns: MonthlyHospitalIngestionSummary[] = Array.from(hospitalMap.entries())
        .map(([hCode, stats]) => ({
          hospitalCode: hCode,
          recordCount: stats.count,
          opexSpend: stats.opex,
          capexSpend: stats.capex,
          totalSpend: stats.total,
          totalQty: stats.qty
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend);

      // Completeness Sensing logic
      let completenessStatus: 'COMPLETE' | 'PARTIAL' | 'EMPTY' = 'EMPTY';
      let completenessLabel = 'Belum Ada Ingestion';
      let completenessNote = 'Tidak ada transaksi terdeteksi pada periode Gregorian ini';

      if (totalRecordCount > 0) {
        monthsWithDataCount++;
        if (totalRecordCount >= 10 && filesCount >= 1) {
          completenessStatus = 'COMPLETE';
          completenessLabel = 'Lengkap & Terverifikasi';
          completenessNote = `${filesCount} file sumber aktif (${uniquePoCount} PO, ${hospitalBreakdowns.length} RS terwakili)`;
        } else {
          completenessStatus = 'PARTIAL';
          completenessLabel = 'Sebagian / Parsial';
          completenessNote = `Baru ${totalRecordCount} baris data (${hospitalBreakdowns.length} RS)`;
        }
      }

      // Track yearly aggregates
      yearlyTotalSpend += totalSpend;
      yearlyOpexSpend += opexSpend;
      yearlyCapexSpend += capexSpend;
      yearlyTotalQty += totalQty;
      deduplicatedMonthRecords.forEach(r => { if (r.purchId) yearlyPoSet.add(r.purchId); });
      yearlyTotalLines += totalRecordCount;
      yearlyOverwrittenLines += updatedOverwrittenCount;
      fileContributions.forEach(f => yearlyFilesSet.add(f.fileName));

      if (latestMonthIngestedAt) {
        if (!latestOverallIngestedAt || new Date(latestMonthIngestedAt) > new Date(latestOverallIngestedAt)) {
          latestOverallIngestedAt = latestMonthIngestedAt;
        }
      }

      months.push({
        year: selectedYear,
        monthIndex: m,
        monthKey,
        monthNameIndo,
        monthShortIndo,
        gregorianPeriod,
        daysInMonth,
        opexSpend,
        opexQty,
        opexRecordCount,
        capexSpend,
        capexQty,
        capexRecordCount,
        totalSpend,
        totalQty,
        totalRecordCount,
        filesCount,
        fileContributions,
        sourceTypes: Array.from(sourceTypesSet),
        uniquePoCount,
        uniqueLineCount,
        updatedOverwrittenCount,
        uniquenessRatioPct,
        latestIngestedAt: latestMonthIngestedAt,
        completenessStatus,
        completenessLabel,
        completenessNote,
        hospitalsRepresented: Array.from(hospitalMap.keys()),
        hospitalBreakdowns
      });
    }

    const opexPct = yearlyTotalSpend > 0 ? (yearlyOpexSpend / yearlyTotalSpend) * 100 : 0;
    const capexPct = yearlyTotalSpend > 0 ? (yearlyCapexSpend / yearlyTotalSpend) * 100 : 0;
    const overallFidelityPct = yearlyTotalLines > 0 
      ? Math.max(0, Math.min(100, Math.round(((yearlyTotalLines - yearlyOverwrittenLines) / yearlyTotalLines) * 1000) / 10)) 
      : 100;

    return {
      year: selectedYear,
      totalSpend: yearlyTotalSpend,
      totalOpexSpend: yearlyOpexSpend,
      totalCapexSpend: yearlyCapexSpend,
      opexPct,
      capexPct,
      totalQty: yearlyTotalQty,
      totalPoCount: yearlyPoSet.size,
      totalRecordCount: yearlyTotalLines,
      totalFilesUploaded: yearlyFilesSet.size,
      totalUniqueLines: yearlyTotalLines - yearlyOverwrittenLines,
      totalOverwrittenLines: yearlyOverwrittenLines,
      overallFidelityPct,
      monthsWithDataCount,
      latestOverallIngestedAt,
      months
    };
  }
}

export const monthlyIngestionService = new MonthlyIngestionService();
