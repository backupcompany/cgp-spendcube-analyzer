import { FileSourceType } from './spend';

export interface MonthlyIngestionFileContribution {
  fileName: string;
  sourceType: FileSourceType | string;
  recordCount: number;
  totalValue: number;
  totalQty: number;
  uploadedAt: string;
}

export interface MonthlyHospitalIngestionSummary {
  hospitalCode: string;
  recordCount: number;
  opexSpend: number;
  capexSpend: number;
  totalSpend: number;
  totalQty: number;
}

export interface MonthlyIngestionRecord {
  year: number;
  monthIndex: number; // 1 - 12
  monthKey: string; // 'YYYY-MM'
  monthNameIndo: string; // 'Januari', 'Februari', etc.
  monthShortIndo: string; // 'Jan', 'Feb', etc.
  gregorianPeriod: string; // '01 Jan 2025 - 31 Jan 2025'
  daysInMonth: number; // 28, 29, 30, 31
  
  // Spending Breakdown
  opexSpend: number;
  opexQty: number;
  opexRecordCount: number;
  
  capexSpend: number;
  capexQty: number;
  capexRecordCount: number;
  
  totalSpend: number;
  totalQty: number;
  totalRecordCount: number;
  
  // File Contributions
  filesCount: number;
  fileContributions: MonthlyIngestionFileContribution[];
  sourceTypes: string[]; // ['capex_d365', 'opex_d365', etc.]
  
  // Uniqueness & Ingestion Profile
  uniquePoCount: number;
  uniqueLineCount: number;
  updatedOverwrittenCount: number;
  uniquenessRatioPct: number; // e.g. 96.5%
  
  // Latest Ingested Timestamp
  latestIngestedAt: string | null;
  
  // Completeness & Sensing Status
  completenessStatus: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
  completenessLabel: string;
  completenessNote: string;
  
  // Hospital Participation
  hospitalsRepresented: string[];
  hospitalBreakdowns: MonthlyHospitalIngestionSummary[];
}

export interface MonthlyIngestionYearlySummary {
  year: number;
  totalSpend: number;
  totalOpexSpend: number;
  totalCapexSpend: number;
  opexPct: number;
  capexPct: number;
  totalQty: number;
  totalPoCount: number;
  totalRecordCount: number;
  totalFilesUploaded: number;
  totalUniqueLines: number;
  totalOverwrittenLines: number;
  overallFidelityPct: number;
  monthsWithDataCount: number;
  latestOverallIngestedAt: string | null;
  months: MonthlyIngestionRecord[];
}
