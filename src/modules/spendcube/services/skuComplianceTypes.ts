/**
 * Shared Types for SKU Compliance Web Worker and Client Service
 * Separated into an independent module to prevent circular bundling and value imports.
 */

import { SkuMasterRecord } from '../../../core/types/spend';
import { 
  PoLineComplianceRecord, 
  MonthlyComplianceTrend, 
  ComplianceSummaryStats, 
  EntityComplianceSummary 
} from './skuPoComplianceService';

export interface MinimalPoLineInput {
  id: string;
  purchId: string;
  lineNumber?: number | string;
  createdDate?: string;
  monthYear?: string;
  hospitalCode?: string;
  requester?: string;
  requesterName?: string;
  department?: string;
  vendorName?: string;
  poSkuCode?: string;
  itemName?: string;
  rawItemName?: string;
  itemNotes?: string;
  extractedSkuCode?: string;
  sourceFileName?: string;
  sourceFile?: string;
  itemId?: string;
  purchUnit?: string;
  lineDisc?: number;
  linePercent?: number;
  purchReqName?: string;
  costCenter?: string;
  purchStatusNamePo?: string;
  documentState?: string;
  procurementCategory?: string;
  purchQty?: number;
  purchPrice?: number;
  totalLineAmount?: number;
}

export interface MinimalSkuMasterInput {
  id: string;
  productId?: string;
  name: string;
  formattedSkuName?: string;
  purchCategoryLv1?: string;
  purchCategoryLv2?: string;
  purchCategoryLv3?: string;
  purchCategoryLv4?: string;
  commodityItem?: string;
  prItemId?: string;
  cprItemId?: string;
  spItemId?: string;
  partNumber?: string;
}

export interface SkuComplianceWorkerIncomingMessage {
  type: 'START_EVALUATION';
  jobId: string;
  records: MinimalPoLineInput[];
  skuMasters: MinimalSkuMasterInput[];
}

export interface SkuCompliancePreAggregates {
  monthlyTrends: MonthlyComplianceTrend[];
  summaryStats: ComplianceSummaryStats;
  topHospitals: EntityComplianceSummary[];
  topUsers: EntityComplianceSummary[];
  monthOptions: Array<{ value: string; label: string; count: number }>;
  hospitalOptions: Array<{ value: string; label: string; count: number }>;
  userOptions: Array<{ value: string; label: string; count: number }>;
}

export type SkuComplianceWorkerOutgoingMessage = 
  | {
      type: 'PROGRESS';
      jobId: string;
      percent: number;
      message: string;
      processedCount: number;
      totalCount: number;
    }
  | {
      type: 'SUCCESS';
      jobId: string;
      evaluatedRecords: PoLineComplianceRecord[];
      aggregates: SkuCompliancePreAggregates;
      durationMs: number;
    }
  | {
      type: 'ERROR';
      jobId: string;
      error: string;
    };
