/**
 * Contract Opportunity & Semantic Category Targeting Types
 * Supporting Feature-Sliced Design and Multi-Agent Procurement Strategy
 */

export type KraljicQuadrant = 'LEVERAGE' | 'STRATEGIC' | 'ROUTINE' | 'BOTTLENECK';

export type OpportunityPriority = 
  | 'P1_BLANKET_CONTRACT'      // High Spend + High Frequency + Uncontracted (Urgent Spot Leakage)
  | 'P2_RATE_HARMONIZATION'     // High Hospital Dispersion + Significant Price Variance
  | 'P3_VENDOR_CONSOLIDATION'   // High Vendor Fragmentation (>2-3 vendors for homogeneous commodity)
  | 'P4_TAIL_AUTOMATION'        // High PO Frequency + Low/Medium Spend (Catalog Automation)
  | 'MONITORED_STANDARD';       // Well-contracted and stable

export type SourcingPipelineStage = 
  | 'IDENTIFIED' 
  | 'SOURCING_RFP' 
  | 'RATE_NEGOTIATION' 
  | 'CONTRACTED_ACTIVE';

export interface ContractPipelineItem {
  id: string;
  clusterId: string;
  cluster: SemanticSpendCluster;
  stage: SourcingPipelineStage;
  targetSavingIdr: number;
  priority: OpportunityPriority;
  targetVendor: string;
  assignedCategoryManager: string;
  notes: string;
  targetRfpQuarter: string;
  pinnedAt: string;
  updatedAt: string;
}

export interface ClusterPoTransaction {
  id: string;
  purchId: string;
  createdDate: string;
  hospitalCode: string;
  vendorName: string;
  itemId: string;
  itemName: string;
  purchQty: number;
  purchUnit: string;
  purchPrice: number;
  totalLineAmount: number;
  isContract: boolean;
  documentState?: string;
  spendType?: string;
}

export interface ContractTargetingFilter {
  categoryLv1: string;
  categoryLv2: string;
  startDate: string;
  endDate: string;
  island: string;
  region: string;
  hospitalCode: string;
  spendType: 'all' | 'OPEX' | 'CAPEX';
  contractStatusFilter: 'ALL' | 'UNCONTRACTED_ONLY' | 'CONTRACTED_ONLY' | 'MIXED_ONLY';
  minSpendThreshold: number;
  minVolumeThreshold?: number;
  maxVolumeThreshold?: number;
  searchQuery: string;
  priorityFilter: 'ALL' | OpportunityPriority;
}

export const DEFAULT_CONTRACT_FILTER: ContractTargetingFilter = {
  categoryLv1: 'ALL',
  categoryLv2: 'ALL',
  startDate: '',
  endDate: '',
  island: 'ALL',
  region: 'ALL',
  hospitalCode: 'ALL',
  spendType: 'all',
  contractStatusFilter: 'ALL',
  minSpendThreshold: 0,
  minVolumeThreshold: 0,
  maxVolumeThreshold: 0,
  searchQuery: '',
  priorityFilter: 'ALL'
};

export interface SemanticSpendCluster {
  id: string;
  clusterName: string;
  canonicalKeyword: string;
  categoryLv1: string;
  categoryLv2: string;
  categoryLv3: string;
  totalSpend: number;
  totalQty: number;
  primaryUom: string;
  poOccurrences: number;
  avgUnitPrice: number;
  minUnitPrice: number;
  maxUnitPrice: number;
  priceSpreadRatio: number; // e.g. 0.35 = 35% difference between lowest and highest
  
  earliestDate?: string;
  latestDate?: string;
  dateRangeFormatted?: string;
  
  uniqueVendors: Array<{
    vendorName: string;
    spend: number;
    qty: number;
    poCount: number;
    avgPrice: number;
    isPrimary?: boolean;
    itemNames?: string[];
  }>;
  
  uniqueHospitals: Array<{
    hospitalCode: string;
    hospitalName?: string;
    spend: number;
    qty: number;
    avgPrice: number;
    poCount: number;
    vendorNames?: string[];
    itemNames?: string[];
  }>;

  contractCoverage: {
    contractedSpend: number;
    uncontractedSpend: number;
    contractedQty: number;
    uncontractedQty: number;
    contractedPoCount: number;
    uncontractedPoCount: number;
    percentageContracted: number; // 0 to 100
  };

  kraljicQuadrant: KraljicQuadrant;
  opportunityPriority: OpportunityPriority;
  priorityScore: number; // 0 - 100 ranking algorithm

  potentialSavingsEstimate: {
    minSavingsIdr: number;
    maxSavingsIdr: number;
    targetSavingPercentage: number;
    recommendedContractType: string;
    rationale: string;
  };

  rawItemVariations: Array<{
    itemId: string;
    itemName: string;
    spend: number;
    qty: number;
    uom: string;
    sampleVendor: string;
    isContract: boolean;
    skuMasterId?: string;
    hospitalCount: number;
  }>;

  poTransactions?: ClusterPoTransaction[];

  pipelineStage?: SourcingPipelineStage;
  pinnedToPipeline?: boolean;
}

export interface MultiAgentTargetingStrategy {
  agent1CategoryStrategist: {
    title: string;
    portfolioAnalysis: string;
    volumeLeverageFindings: string[];
    kraljicBreakdownSummary: {
      leverageSpendIdr: number;
      strategicSpendIdr: number;
      routineSpendIdr: number;
      bottleneckSpendIdr: number;
    };
  };
  agent2ContractOptimizer: {
    title: string;
    recommendedContractVehicles: Array<{
      clusterName: string;
      vehicleType: 'MASTER_AGREEMENT' | 'CONSIGNMENT' | 'PRICE_RATE_CARD' | 'CATALOG_LOCK';
      termDuration: string;
      leadHospitalOrCentralized: string;
      estimatedVolumeLock: string;
    }>;
    governanceActionPlan: string[];
  };
  agent3NegotiationAdvisor: {
    title: string;
    negotiationLevers: string[];
    targetCostReductionIdr: number;
    keyClausesRecommended: string[];
  };
  overallExecutiveSummary: string;
  generatedAt: string;
}

export interface ContractTargetingSummaryMetrics {
  totalClusters: number;
  totalAnalyzedSpend: number;
  uncontractedSpotSpend: number;
  contractedSpend: number;
  overallContractCoverageRatio: number;
  totalEstimatedSavingsIdr: number;
  totalPoTransactions: number;
  totalDistinctVendors: number;
  totalHospitalUnits: number;
  priorityCounts: {
    p1Blanket: number;
    p2RateHarmonization: number;
    p3VendorConsolidation: number;
    p4TailAutomation: number;
    monitored: number;
  };
}

export interface ContractTargetingAnalysisResult {
  filterHash: string;
  timestamp: string;
  summary: ContractTargetingSummaryMetrics;
  clusters: SemanticSpendCluster[];
  aiStrategy?: MultiAgentTargetingStrategy;
}
