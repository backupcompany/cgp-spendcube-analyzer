/**
 * Contract Opportunity & Sourcing Pipeline Service
 * Isolates data access and coordinates clustering, AI strategy, and pipeline persistence
 */

import { SpendRecord, SkuMasterRecord } from '../../../core/types/spend';
import { 
  ContractTargetingFilter, 
  ContractTargetingAnalysisResult, 
  SemanticSpendCluster,
  SourcingPipelineStage,
  DEFAULT_CONTRACT_FILTER
} from '../../../core/types/contractTargeting';
import { clusterSpendTransactions } from './semanticClusteringEngine';
import { contractAiAgentService } from './contractAiAgentService';
import { 
  getContractTargetingCache, 
  saveContractTargetingCache,
  getAllContractPipelineItems,
  saveContractPipelineItem,
  deleteContractPipelineItem,
  ContractPipelineItem
} from '../../../core/db/db';

export class ContractOpportunityService {
  /**
   * Generates a deterministic unique hash for the filter criteria
   */
  getFilterHash(filter?: ContractTargetingFilter): string {
    const f = filter ? { ...DEFAULT_CONTRACT_FILTER, ...filter } : DEFAULT_CONTRACT_FILTER;
    return [
      f.categoryLv1 || 'ALL',
      f.categoryLv2 || 'ALL',
      f.startDate || 'min',
      f.endDate || 'max',
      f.island || 'ALL',
      f.region || 'ALL',
      f.hospitalCode || 'ALL',
      f.spendType || 'all',
      f.contractStatusFilter || 'ALL',
      f.priorityFilter || 'ALL',
      f.minSpendThreshold || 0,
      f.minVolumeThreshold || 0,
      f.maxVolumeThreshold || 0,
      (f.searchQuery || '').trim().toLowerCase()
    ].join('__');
  }

  /**
   * Main scan method: clusters data and runs AI Multi-Agent strategy
   */
  async scanContractOpportunities(
    records: SpendRecord[],
    skuMasters: SkuMasterRecord[],
    filter?: ContractTargetingFilter,
    forceRefresh = false
  ): Promise<ContractTargetingAnalysisResult> {
    const safeFilter: ContractTargetingFilter = filter ? { ...DEFAULT_CONTRACT_FILTER, ...filter } : DEFAULT_CONTRACT_FILTER;
    const filterHash = this.getFilterHash(safeFilter);

    // Check IndexedDB cache first
    if (!forceRefresh) {
      try {
        const cached = await getContractTargetingCache(filterHash);
        if (cached && cached.clusters && cached.clusters.length > 0) {
          // Merge with current pipeline status
          const pipelineItems = await this.getPipelineItems();
          const pipelineMap = new Map(pipelineItems.map(p => [p.clusterId, p]));

          const enrichedClusters = cached.clusters.map(c => {
            const p = pipelineMap.get(c.id);
            return {
              ...c,
              pinnedToPipeline: Boolean(p),
              pipelineStage: p?.stage || undefined
            };
          });

          return {
            ...cached,
            clusters: enrichedClusters
          };
        }
      } catch (cacheErr) {
        console.warn('Cache lookup skipped:', cacheErr);
      }
    }

    // Step 1: Run High-Speed Client-Side Semantic Clustering
    const { clusters, summary } = clusterSpendTransactions(records, skuMasters, filter);

    // Merge with current pipeline status
    const pipelineItems = await this.getPipelineItems();
    const pipelineMap = new Map(pipelineItems.map(p => [p.clusterId, p]));

    const enrichedClusters = clusters.map(c => {
      const p = pipelineMap.get(c.id);
      return {
        ...c,
        pinnedToPipeline: Boolean(p),
        pipelineStage: p?.stage || undefined
      };
    });

    // Step 2: Multi-Agent AI Strategy Synthesis (Synthesizes TOP 12 Clusters)
    let aiStrategy;
    try {
      aiStrategy = await contractAiAgentService.generateStrategy(filter, summary, enrichedClusters);
    } catch (aiErr) {
      console.warn('Strategy fallback applied:', aiErr);
      aiStrategy = contractAiAgentService.generateHeuristicStrategy(filter, summary, enrichedClusters);
    }

    const result: ContractTargetingAnalysisResult = {
      filterHash,
      timestamp: new Date().toISOString(),
      summary,
      clusters: enrichedClusters,
      aiStrategy
    };

    // Step 3: Persist to IndexedDB
    try {
      await saveContractTargetingCache(result);
    } catch (saveErr) {
      console.warn('Failed to cache contract targeting result to IndexedDB:', saveErr);
    }

    return result;
  }

  /**
   * Retrieves all items currently pinned in the Sourcing Pipeline
   */
  async getPipelineItems(): Promise<ContractPipelineItem[]> {
    try {
      return await getAllContractPipelineItems();
    } catch (err) {
      console.warn('Failed to get pipeline items from IndexedDB, fallback to localStorage:', err);
      const raw = localStorage.getItem('contract_pipeline_items');
      return raw ? JSON.parse(raw) : [];
    }
  }

  /**
   * Pins or updates a cluster inside the Sourcing Pipeline
   */
  async pinClusterToPipeline(
    cluster: SemanticSpendCluster,
    stage: SourcingPipelineStage = 'IDENTIFIED',
    notes = '',
    assignedCategoryManager = 'Senior Category Manager'
  ): Promise<ContractPipelineItem> {
    const item: ContractPipelineItem = {
      id: `pipeline-${cluster.id}`,
      clusterId: cluster.id,
      cluster,
      stage,
      targetSavingIdr: cluster.potentialSavingsEstimate.minSavingsIdr,
      priority: cluster.opportunityPriority,
      targetVendor: cluster.uniqueVendors[0]?.vendorName || 'TBD',
      assignedCategoryManager,
      notes: notes || cluster.potentialSavingsEstimate.rationale,
      targetRfpQuarter: 'Q4-2026',
      pinnedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveContractPipelineItem(item);
    } catch (err) {
      console.warn('IndexedDB save pipeline failed, saving to localStorage fallback:', err);
      const existing = await this.getPipelineItems();
      const updated = [item, ...existing.filter(e => e.id !== item.id)];
      localStorage.setItem('contract_pipeline_items', JSON.stringify(updated));
    }

    return item;
  }

  /**
   * Updates pipeline stage
   */
  async updatePipelineStage(itemId: string, newStage: SourcingPipelineStage): Promise<void> {
    const items = await this.getPipelineItems();
    const target = items.find(i => i.id === itemId);
    if (target) {
      target.stage = newStage;
      target.updatedAt = new Date().toISOString();
      await saveContractPipelineItem(target);
    }
  }

  /**
   * Removes a cluster from the Sourcing Pipeline
   */
  async removeClusterFromPipeline(pipelineItemId: string): Promise<void> {
    try {
      await deleteContractPipelineItem(pipelineItemId);
    } catch (err) {
      console.warn('IndexedDB delete failed, updating localStorage:', err);
      const existing = await this.getPipelineItems();
      const updated = existing.filter(e => e.id !== pipelineItemId);
      localStorage.setItem('contract_pipeline_items', JSON.stringify(updated));
    }
  }

  /**
   * Generates a formal Markdown RFP Sourcing Brief for procurement teams
   */
  generateSourcingRfpBriefMarkdown(cluster: SemanticSpendCluster): string {
    const formatIDR = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

    return `# DOKUMEN BRIEF PENGADAAN & TARGET KONTRAK STRATEGIS (RFP BRIEF)
**Siloam Hospitals Group - Corporate Procurement & Supply Chain**
*Tanggal Terbit: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}*

---

### 1. INFORMASI KOMODITAS & KLUSTER BELANJA
- **Nama Kluster Barang**: **${cluster.clusterName}**
- **Klasifikasi Kategori**: ${cluster.categoryLv1} > ${cluster.categoryLv2} > ${cluster.categoryLv3}
- **Klasifikasi Portofolio Kraljic**: **${cluster.kraljicQuadrant}**
- **Status Prioritas Target**: **${cluster.opportunityPriority.replace(/_/g, ' ')}**
- **Satuan Standar (UoM)**: ${cluster.primaryUom}

### 2. DATA HISTORIS KONSOLIDASI & KEBOCORAN SPOT
- **Total Belanja Historis**: ${formatIDR(cluster.totalSpend)}
- **Total Volume Serapan**: ${cluster.totalQty.toLocaleString('id-ID')} ${cluster.primaryUom}
- **Frekuensi Order (PO Occurrences)**: ${cluster.poOccurrences} kali penerbitan PO
- **Porsi Belanja Terkontrak**: ${formatIDR(cluster.contractCoverage.contractedSpend)} (${cluster.contractCoverage.percentageContracted.toFixed(1)}%)
- **Porsi Belanja Spot Tanpa Kontrak**: **${formatIDR(cluster.contractCoverage.uncontractedSpend)}** (${(100 - cluster.contractCoverage.percentageContracted).toFixed(1)}%)
- **Disparitas Harga**: Terendah ${formatIDR(cluster.minUnitPrice)} s/d Tertinggi ${formatIDR(cluster.maxUnitPrice)} (Rentang ${(cluster.priceSpreadRatio * 100).toFixed(1)}%)
- **Sebaran Unit RS**: ${cluster.uniqueHospitals.length} Rumah Sakit

### 3. STRATEGI KONTRAK & REKOMENDASI SOURCING
- **Bentuk Kontrak Direkomendasikan**: **${cluster.potentialSavingsEstimate.recommendedContractType}**
- **Target Potensi Penghematan (Savings)**: **${formatIDR(cluster.potentialSavingsEstimate.minSavingsIdr)} - ${formatIDR(cluster.potentialSavingsEstimate.maxSavingsIdr)}** (${(cluster.potentialSavingsEstimate.targetSavingPercentage * 100).toFixed(0)}% target reduksi)
- **Dasar Rasional**:
  > ${cluster.potentialSavingsEstimate.rationale}

### 4. SEBARAN VENDOR SAAT INI (INCUMBENT SUPPLIERS)
| Nama Vendor | Total Spend | Volume (${cluster.primaryUom}) | Frekuensi PO | Rata-rata Tarif | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
${cluster.uniqueVendors.map(v => `| ${v.vendorName} | ${formatIDR(v.spend)} | ${v.qty.toLocaleString('id-ID')} | ${v.poCount}x | ${formatIDR(v.avgPrice)} | ${v.isPrimary ? 'Top Primary Vendor' : 'Secondary Supplier'} |`).join('\n')}

### 5. RINCIAN VARIASI NAMA ITEM (DIRTY DATA CONSOLIDATION)
| Nama Item Teridentifikasi | Kode Item | Belanja | Volume | Vendor Terpilih | Terkontrak? |
| :--- | :--- | :--- | :--- | :--- | :--- |
${cluster.rawItemVariations.map(iv => `| ${iv.itemName} | ${iv.itemId} | ${formatIDR(iv.spend)} | ${iv.qty.toLocaleString('id-ID')} | ${iv.sampleVendor} | ${iv.isContract ? 'Ya' : 'TIDAK (Spot)'} |`).join('\n')}

### 6. ACTION ITEM UNTUK TIM CONTRACT MANAGEMENT
1. Publikasikan paket lelang / RFP dengan kuota volume komitmen **${cluster.totalQty.toLocaleString('id-ID')} ${cluster.primaryUom}**.
2. Masukkan klausul wajib: **Most Favored Customer (MFC)** dengan batas harga tertinggi $\le$ ${formatIDR(cluster.minUnitPrice)}.
3. Syaratkan SLA pengiriman maksimal 48 jam dengan penempatan buffer stock 15%.
4. Kunci katalog harga pada ERP setelah kontrak ditandatangani.
`;
  }
}

export const contractOpportunityService = new ContractOpportunityService();
