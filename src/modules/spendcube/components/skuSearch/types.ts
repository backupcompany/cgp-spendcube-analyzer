import { SpendRecord, SkuMasterRecord, SkuMappingCacheRecord } from '../../../../core/types/spend';

export interface SkuCatalogSearchGoogleViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  diskCacheMap?: Map<string, SkuMappingCacheRecord>;
  onSelectRecord?: (record: SpendRecord) => void;
  onOpenAiAdvisor?: () => void;
}

export interface SkuEnrichedWithStats {
  sku: SkuMasterRecord;
  productId: string;
  canonicalName: string;
  commodityItem: string;
  specSlot1: string;
  specSlot2: string;
  specSlot3: string;
  specLine: string;
  brand: string;
  partNumber: string;
  purchCategoryLv1: string;
  purchCategoryLv2: string;
  purchCategoryLv3: string;
  unitOfMeasurement: string;
  transactionCount: number;
  totalSpend: number;
  totalQty: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  standardPrice: number;
  transactions: SpendRecord[];
  matchScore: number;
  isSemanticMatch: boolean;
  matchReason: string;
  isActive: boolean;
  matchedViaTransactionCount?: number;
  isMatchedViaTransaction?: boolean;
  isUnmappedGroup?: boolean;
  isVirtualSku?: boolean;
  rawItemKey?: string;
}

export type GoogleSearchViewMode = 'CATALOG' | 'ALL_TRANSACTIONS' | 'UNMAPPED';

export interface MatchedTransactionItem {
  record: SpendRecord;
  mappedSku?: SkuMasterRecord;
  status: 'EXACT_MATCH' | 'PARTIAL_ORPHAN' | 'UNMAPPED';
}

export interface CommodityGroup {
  id: string;
  commodityName: string;
  breadcrumb: string;
  purchCategoryLv1: string;
  purchCategoryLv2: string;
  skus: SkuEnrichedWithStats[];
  totalTx: number;
  totalSpend: number;
  totalQty: number;
  uom: string;
  bestScore: number;
  isUnmappedGroup?: boolean;
}

export interface UnmappedStats {
  count: number;
  totalSpend: number;
  totalQty: number;
}

export const isSkuActive = (sku: SkuMasterRecord): boolean => {
  if (sku.isActive === undefined || sku.isActive === null) return true;
  if (typeof sku.isActive === 'boolean') return sku.isActive;
  const str = String(sku.isActive).trim().toLowerCase();
  return str !== 'false' && str !== '0' && str !== 'n' && str !== 'inactive' && str !== 'tidak aktif';
};

export const formatIDR = (val: number): string => {
  return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');
};
