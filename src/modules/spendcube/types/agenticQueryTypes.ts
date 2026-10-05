import { ManualFilterCard, SpendRecord, SkuMasterRecord } from '../../../core/types/spend';

export interface AgenticQueryPlan {
  anchorType: 'PRODUCT' | 'VENDOR' | 'HOSPITAL' | 'ANOMALY_TREND';
  intentSummary: string;
  mandatoryKeywords: string[];
  productKeywords: {
    include: string[];
    exclude: string[];
  };
  taxonomyStrategy: {
    role: 'SEARCH_CONTEXT_ONLY' | 'TRANSACTION_FILTER';
    l1: string[];
    l2: string[];
    l3?: string[];
  };
  parties: {
    hospitalCodes: string[];
    vendorNames: string[];
    vendorCities: string[];
    islands: string[];
    archetypes: string[];
  };
  temporal: {
    months: string[];
    rawYear?: string;
  };
  cardStrategy: 'SINGLE_CARD' | 'SPLIT_OR_CARDS';
  splitReasons?: string;
  suggestedCards: ManualFilterCard[];
}

export interface CandidateContextItem {
  id: string;
  name: string;
  uom?: string;
  taxoPath?: string;
  hospitalCode?: string;
  vendorName?: string;
  month?: string;
}

export interface DiscoveredCandidatesEnriched {
  mandatoryBaseTerms: string[];
  candidateItems: CandidateContextItem[];
  candidateTaxonomies: { level: string; path: string; name: string }[];
  candidateVendors: { vendorName: string; city?: string }[];
  candidateHospitals: { code: string; name: string; island?: string; tier?: string }[];
  candidateMonths: string[];
  synonymsExpanded: string[];
  taxonomyRole: 'SEARCH_CONTEXT_ONLY' | 'TRANSACTION_FILTER';
}

/**
 * TAHAP 1: Memahami produk, intent, dan menghasilkan kandidat istilah pencarian
 */
export interface Stage1TermExpansionResult {
  userQuery: string;
  intentType: 'DEPARTMENT_BREAKDOWN' | 'VENDOR_RANKING' | 'PRICE_BENCHMARK' | 'SPEND_TOTAL' | 'PURCHASE_COUNT' | 'CROSS_ANALYSIS' | 'GENERAL_SEARCH';
  intentSummary: string;
  metricsIdentified: ('spend' | 'quantity' | 'po_count' | 'unit_price')[];
  primaryProductName: string;
  productSynonyms: string[]; // Bahasa Indonesia & English, abbreviations
  subTypesVariations: string[]; // Specific variants, e.g., A4, A3, continuous form
  groupingCandidates: string[]; // ATK, stationery, general supplies, office supplies
  initialConstraints: {
    hospitalCodes?: string[];
    vendorNames?: string[];
    islands?: string[];
    archetypes?: string[];
    departments?: string[];
    period?: {
      months?: string[];
      days?: string[];
      year?: string;
      rawText?: string;
    };
  };
  searchAnchor: 'PRODUCT' | 'VENDOR' | 'HOSPITAL' | 'PERIOD' | 'DEPARTMENT';
}

/**
 * TAHAP 2: Memilih item, taxonomy, periode, dan struktur card
 */
export interface Stage2ProductTaxonomyResult {
  selectedItemIncludes: string[];
  selectedItemExcludes: string[];
  taxonomyDecision: {
    role: 'SEARCH_CONTEXT_ONLY' | 'TRANSACTION_FILTER' | 'RESULT_GROUPING';
    selectedTaxonomies?: string[];
    targetLevel?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'HYBRID';
    l1Taxonomies?: string[];
    l2Taxonomies?: string[];
    l3Taxonomies?: string[];
    l4Taxonomies?: string[];
    explanation: string;
  };
  periodFilter: {
    months: string[];
    days?: string[];
    years: string[];
  };
  cardStructure: 'SINGLE_CARD' | 'SPLIT_OR_CARDS';
  splitReasoning?: string;
  intermediateCards: ManualFilterCard[];
}

/**
 * TAHAP 3: Memilih pihak dan lokasi berdasarkan transaksi yang relevan
 */
export interface Stage3PartiesLocationsResult {
  dimensionRoles: {
    whatIsBought: string; // Produk atau jasa
    whoPurchased: string; // RS atau departemen requestor
    fromWhomPurchased: string; // Vendor
    wherePurchased: string; // Lokasi RS, vendor, atau pengiriman
  };
  partiesFilters: {
    hospitalCodes: string[];
    hospitalIslands: string[];
    vendorNames: string[];
    vendorCities: string[];
    departments?: string[];
    archetypes: string[];
    days?: string[];
  };
  finalCards: ManualFilterCard[];
  ambiguityStatus: {
    status: 'FOUND' | 'PARTIAL' | 'NOT_FOUND' | 'AMBIGUOUS';
    message: string;
  };
}

/**
 * Full Agentic Pipeline Trace for Triage Inspector & Transparency
 */
export interface AgenticPipelineExecutionTrace {
  stage1: Stage1TermExpansionResult;
  stage2: Stage2ProductTaxonomyResult;
  stage3: Stage3PartiesLocationsResult;
  appliedCardsCount?: number;
  preliminaryMatchCount?: number;
  candidateItemsCount?: number;
  candidateTaxonomiesCount?: number;
  candidatePartiesCount?: number;
  matchedCount?: number;
  totalRecordsCount?: number;
}
