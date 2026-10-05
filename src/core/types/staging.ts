/**
 * Types for Background Web Worker Staging & Job Management
 */

import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord,
  PriceSurgeItem,
  IntraVendorDiscrepancyItem,
  VendorSwitchingOpportunity,
  RegionalPriceAnalysisItem,
  StandardPriceAuditItem,
  SpendSummaryKPIs,
  MaintenanceCacheData,
  PrecalculatedCubeAggregates,
  SkuMappingCacheRecord,
  DepartmentMasterRecord,
  RawDepartmentDiscoveryItem,
  PurchaseRequisitionRecord,
  UserDepartmentMappingRecord
} from './spend';
import { 
  ContractTargetingFilter, 
  ContractTargetingAnalysisResult, 
  SemanticSpendCluster,
  ContractTargetingSummaryMetrics
} from './contractTargeting';

export type BackgroundJobType = 
  | 'FULL_STAGING_PIPELINE'
  | 'CONTRACT_CLUSTERING'
  | 'PRICE_INTELLIGENCE'
  | 'TAXONOMY_AGGREGATION'
  | 'SKU_MAPPING_PIPELINE'
  | 'DEPARTMENT_COMPILATION';

export interface WorkerProgressMessage {
  type: 'PROGRESS';
  jobId: string;
  jobType: BackgroundJobType;
  stage: string;
  percent: number; // 0 to 100
  message: string;
  processedItems: number;
  totalItems: number;
  timestamp: number;
}

export interface PrecomputedPriceIntelligence {
  priceSurges: PriceSurgeItem[];
  intraVendorDiscrepancies: IntraVendorDiscrepancyItem[];
  switchingOpportunities: VendorSwitchingOpportunity[];
  regionalAnalysis: RegionalPriceAnalysisItem[];
  standardPriceAudits: StandardPriceAuditItem[];
  computedAt: number;
}

export interface PrecomputedContractTargeting {
  clusters: SemanticSpendCluster[];
  summary: ContractTargetingSummaryMetrics;
  filterHash: string;
  computedAt: number;
}

export interface FullStagingResultPayload {
  jobId: string;
  status: 'SUCCESS' | 'ERROR';
  durationMs: number;
  priceIntelligence: PrecomputedPriceIntelligence;
  contractTargeting: PrecomputedContractTargeting;
  kpis: SpendSummaryKPIs;
  maintenanceCache?: MaintenanceCacheData;
  cubeAggregates?: PrecalculatedCubeAggregates;
  totalRecordsProcessed: number;
  totalSkusProcessed: number;
  error?: string;
}

export interface SkuMappingJobInputPayload {
  jobId: string;
  itemsToMap: { rawItemName: string; itemKey: string }[];
  skuMasters: SkuMasterRecord[];
}

export interface SkuMappingJobResultPayload {
  jobId: string;
  status: 'SUCCESS' | 'ERROR';
  durationMs: number;
  mappings: SkuMappingCacheRecord[];
  totalMapped: number;
  error?: string;
}

export interface DepartmentCompilationJobInputPayload {
  jobId: string;
  records: SpendRecord[];
  prs: PurchaseRequisitionRecord[];
  userMappings: UserDepartmentMappingRecord[];
  existingMasters: DepartmentMasterRecord[];
}

export interface DepartmentCompilationJobResultPayload {
  jobId: string;
  status: 'SUCCESS' | 'ERROR';
  durationMs: number;
  masters: DepartmentMasterRecord[];
  unmapped: RawDepartmentDiscoveryItem[];
  totalRecordsScanned: number;
  totalPrsScanned: number;
  error?: string;
}

export interface WorkerSuccessMessage {
  type: 'SUCCESS';
  jobId: string;
  jobType: BackgroundJobType;
  durationMs: number;
  payload: 
    | FullStagingResultPayload 
    | ContractTargetingAnalysisResult 
    | PrecomputedPriceIntelligence 
    | SkuMappingJobResultPayload
    | DepartmentCompilationJobResultPayload;
}

export interface WorkerErrorMessage {
  type: 'ERROR';
  jobId: string;
  jobType: BackgroundJobType;
  error: string;
  durationMs: number;
}

export type WorkerOutgoingMessage = 
  | WorkerProgressMessage 
  | WorkerSuccessMessage 
  | WorkerErrorMessage;

export interface FullStagingInputPayload {
  jobId: string;
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  hospitalMasters: HospitalMasterRecord[];
  vendorMasters: VendorMasterRecord[];
  contractFilter?: ContractTargetingFilter;
}

export type WorkerIncomingMessage = 
  | { type: 'START_JOB'; jobType: 'FULL_STAGING_PIPELINE'; jobId: string; payload: FullStagingInputPayload }
  | { type: 'START_JOB'; jobType: 'SKU_MAPPING_PIPELINE'; jobId: string; payload: SkuMappingJobInputPayload }
  | { type: 'START_JOB'; jobType: 'DEPARTMENT_COMPILATION'; jobId: string; payload: DepartmentCompilationJobInputPayload }
  | { type: 'START_JOB'; jobType: BackgroundJobType; jobId: string; payload: any }
  | { type: 'CANCEL_JOB'; jobId: string };

export interface StagingStatusState {
  isStagingReady: boolean;
  isStagingInProgress: boolean;
  progressPercent: number;
  currentStage: string;
  currentMessage: string;
  recordsCount: number;
  skusCount: number;
  lastStagedTimestamp: number | null;
  lastDurationMs: number | null;
  activeJobId: string | null;
  stagedPriceIntelligence: PrecomputedPriceIntelligence | null;
  stagedContractTargeting: PrecomputedContractTargeting | null;
  stagedKPIs: SpendSummaryKPIs | null;
  stagedMaintenanceCache?: MaintenanceCacheData | null;
  stagedCubeAggregates?: PrecalculatedCubeAggregates | null;
  // SKU Background Mapping state
  isSkuMappingInProgress?: boolean;
  skuMappingProgressPercent?: number;
  skuMappingMessage?: string;
  skuMappingProcessed?: number;
  skuMappingTotal?: number;
  lastSkuMappingTimestamp?: number | null;
  // Department Background Compilation state
  isDepartmentCompiling?: boolean;
  departmentCompilationProgressPercent?: number;
  departmentCompilationMessage?: string;
  lastDepartmentCompiledTimestamp?: number | null;
  compiledDepartmentCount?: number;
  error: string | null;
}
