/**
 * React Hook for Background Staging & Web Worker Status
 */

import { useState, useEffect, useCallback } from 'react';
import { backgroundJobManager } from '../services/backgroundJobManager';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord 
} from '../types/spend';
import { ContractTargetingFilter } from '../types/contractTargeting';
import { StagingStatusState } from '../types/staging';

export function useTriggerBackgroundStaging() {
  const triggerStaging = useCallback(async (
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[] = [],
    hospitalMasters: HospitalMasterRecord[] = [],
    vendorMasters: VendorMasterRecord[] = [],
    contractFilter?: ContractTargetingFilter,
    forceRefresh = false
  ) => {
    return backgroundJobManager.startFullStaging(
      records,
      skuMasters,
      hospitalMasters,
      vendorMasters,
      contractFilter,
      forceRefresh
    );
  }, []);

  return { triggerStaging };
}

export function useBackgroundStaging() {
  const [stagingState, setStagingState] = useState<StagingStatusState>(() => backgroundJobManager.getState());

  useEffect(() => {
    const unsubscribe = backgroundJobManager.subscribe((newState) => {
      setStagingState(newState);
    });
    return () => unsubscribe();
  }, []);

  const triggerStaging = useCallback(async (
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[] = [],
    hospitalMasters: HospitalMasterRecord[] = [],
    vendorMasters: VendorMasterRecord[] = [],
    contractFilter?: ContractTargetingFilter,
    forceRefresh = false
  ) => {
    return backgroundJobManager.startFullStaging(
      records,
      skuMasters,
      hospitalMasters,
      vendorMasters,
      contractFilter,
      forceRefresh
    );
  }, []);

  return {
    ...stagingState,
    triggerStaging,
    stagedPriceIntelligence: stagingState.stagedPriceIntelligence,
    stagedContractTargeting: stagingState.stagedContractTargeting,
    stagedKPIs: stagingState.stagedKPIs,
    stagedMaintenanceCache: stagingState.stagedMaintenanceCache,
    stagedCubeAggregates: stagingState.stagedCubeAggregates
  };
}
