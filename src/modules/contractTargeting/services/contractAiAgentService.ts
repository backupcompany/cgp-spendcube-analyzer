/**
 * Multi-Agent AI Procurement Strategy Service
 * Connects with server endpoint /api/ai/contract-targeting-strategy
 * Includes high-fidelity heuristic fallback for offline or token-free operation
 */

import { 
  ContractTargetingFilter, 
  ContractTargetingSummaryMetrics, 
  MultiAgentTargetingStrategy, 
  SemanticSpendCluster 
} from '../../../core/types/contractTargeting';
import { tokenLogger } from '../../../core/services/tokenLogger';

export class ContractAiAgentService {
  /**
   * Generates Multi-Agent Executive Strategy with automatic fallback
   */
  async generateStrategy(
    filter: ContractTargetingFilter,
    summary: ContractTargetingSummaryMetrics,
    clusters: SemanticSpendCluster[]
  ): Promise<MultiAgentTargetingStrategy> {
    const startTime = Date.now();
    const topClusters = clusters.slice(0, 12);

    try {
      const res = await fetch('/api/ai/contract-targeting-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterCriteria: filter,
          summaryMetrics: summary,
          topClusters
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();

      // Log token analytics
      await tokenLogger.logAiCall({
        model: 'gemini-2.5-flash',
        actionType: 'Multi-Agent Contract Targeting Strategy',
        promptTokens: 950,
        responseTokens: 420
      });

      return {
        ...data,
        generatedAt: new Date().toISOString()
      };
    } catch (err) {
      console.warn('AI Strategy server call failed, using heuristic multi-agent synthesis:', err);
      return this.generateHeuristicStrategy(filter, summary, clusters);
    }
  }

  /**
   * Deterministic Offline / Token-Free Heuristic Multi-Agent Synthesis
   */
  generateHeuristicStrategy(
    filter: ContractTargetingFilter,
    summary: ContractTargetingSummaryMetrics,
    clusters: SemanticSpendCluster[]
  ): MultiAgentTargetingStrategy {
    const p1Clusters = clusters.filter(c => c.opportunityPriority === 'P1_BLANKET_CONTRACT');
    const p2Clusters = clusters.filter(c => c.opportunityPriority === 'P2_RATE_HARMONIZATION');
    const p3Clusters = clusters.filter(c => c.opportunityPriority === 'P3_VENDOR_CONSOLIDATION');

    // Kraljic breakdown
    let leverageSpend = 0;
    let strategicSpend = 0;
    let routineSpend = 0;
    let bottleneckSpend = 0;

    clusters.forEach(c => {
      if (c.kraljicQuadrant === 'LEVERAGE') leverageSpend += c.totalSpend;
      else if (c.kraljicQuadrant === 'STRATEGIC') strategicSpend += c.totalSpend;
      else if (c.kraljicQuadrant === 'ROUTINE') routineSpend += c.totalSpend;
      else bottleneckSpend += c.totalSpend;
    });

    const topP1 = p1Clusters[0];
    const topP2 = p2Clusters[0];
    const topP3 = p3Clusters[0];

    const recommendedVehicles = clusters.slice(0, 4).map(c => {
      let vehicleType: 'MASTER_AGREEMENT' | 'CONSIGNMENT' | 'PRICE_RATE_CARD' | 'CATALOG_LOCK' = 'MASTER_AGREEMENT';
      let term = '2 Tahun (Volume Lock)';
      if (c.kraljicQuadrant === 'STRATEGIC') {
        vehicleType = 'CONSIGNMENT';
        term = '3 Tahun Partnership + VMI';
      } else if (c.opportunityPriority === 'P2_RATE_HARMONIZATION') {
        vehicleType = 'PRICE_RATE_CARD';
        term = '1 Tahun (Fixed Rate Card)';
      } else if (c.opportunityPriority === 'P4_TAIL_AUTOMATION') {
        vehicleType = 'CATALOG_LOCK';
        term = '1 Tahun Auto-Replenishment';
      }

      return {
        clusterName: c.clusterName,
        vehicleType,
        termDuration: term,
        leadHospitalOrCentralized: c.uniqueHospitals.length > 5 ? 'Centralized Sourcing (HO Procurement)' : 'Regional Hub Coordinator',
        estimatedVolumeLock: `Rp ${(c.totalSpend / 1000000).toFixed(0)} Juta (${c.totalQty.toLocaleString('id-ID')} ${c.primaryUom})`
      };
    });

    const findings: string[] = [];
    if (topP1) {
      findings.push(`Komoditas "${topP1.clusterName}" mencatat belanja spot non-kontrak terbesar (Rp ${(topP1.contractCoverage.uncontractedSpend / 1000000).toFixed(1)} Juta dari ${topP1.poOccurrences}x PO) yang sangat mendesak untuk diikat dalam Blanket Agreement.`);
    }
    if (topP2) {
      findings.push(`Disparitas tarif pada "${topP2.clusterName}" mencapai ${(topP2.priceSpreadRatio * 100).toFixed(0)}% antar ${topP2.uniqueHospitals.length} unit RS, berpotensi dihemat dengan penyamaan tarif acuan terendah.`);
    }
    if (topP3) {
      findings.push(`Komoditas "${topP3.clusterName}" saat ini dipasok oleh ${topP3.uniqueVendors.length} vendor terpisah; rasionalisasi ke dual-vendor preferred akan meningkatkan diskon kuantitas.`);
    }
    if (findings.length === 0) {
      findings.push('Struktur pengadaan pada kelompok filter ini relatif stabil dengan tingkat kepatuhan kontrak yang memadai.');
    }

    return {
      agent1CategoryStrategist: {
        title: 'Kraljic Portfolio & Demand Aggregation Strategy',
        portfolioAnalysis: `Portofolio mencakup total belanja Rp ${(summary.totalAnalyzedSpend / 1000000000).toFixed(2)} Miliar dengan porsi belanja spot tanpa kontrak sebesar Rp ${(summary.uncontractedSpotSpend / 1000000000).toFixed(2)} Miliar (${((1 - summary.overallContractCoverageRatio / 100) * 100).toFixed(1)}%). Daya tawar agregat 39 unit RS Siloam berada pada posisi sangat kuat untuk menegosiasikan diskon komitmen kuantitas korporat.`,
        volumeLeverageFindings: findings,
        kraljicBreakdownSummary: {
          leverageSpendIdr: leverageSpend,
          strategicSpendIdr: strategicSpend,
          routineSpendIdr: routineSpend,
          bottleneckSpendIdr: bottleneckSpend
        }
      },
      agent2ContractOptimizer: {
        title: 'Contract Architecture & Sourcing Vehicles',
        recommendedContractVehicles: recommendedVehicles,
        governanceActionPlan: [
          'Konsolidasi Bill of Quantities (BoQ) agregat seluruh rumah sakit untuk rilis Tender/RFP Terpadu.',
          'Penerapan struktur Dual-Sourcing (70% Alokasi Volume ke Vendor Peringkat 1, 30% ke Vendor Peringkat 2 untuk mitigasi risiko pasokan).',
          'Penguncian Katalog SKU dan Standar Price pada ERP SAP/Microsoft Dynamics untuk mencegah penerbitan PO manual di luar tarif kontrak.'
        ]
      },
      agent3NegotiationAdvisor: {
        title: 'Negotiation Levers & Value Realization Target',
        negotiationLevers: [
          'Volume Aggregation Lever: Mengunci kuota serapan tahunan seluruh rumah sakit dengan syarat diskon bertingkat (volume rebates).',
          'Cashflow & Payment Lever: Penawaran termin pembayaran terpusat (TOP 45-60 hari) sebagai timbal balik tarif fixed price tanpa penyesuaian inflasi selama 24 bulan.',
          'Consignment / Safety Stock: Kewajiban distributor menempatkan 15% buffer stock lokal di regional hub.'
        ],
        targetCostReductionIdr: summary.totalEstimatedSavingsIdr,
        keyClausesRecommended: [
          'Klausul Most Favored Customer (MFC): Vendor menjamin tarif yang diberikan ke Siloam adalah tarif termurah di Indonesia.',
          'SLA Lead Time Pasokan Maksimal 48 Jam (Jabodetabek) dan 72 Jam (Luar Jawa) dengan denda keterlambatan 0.1% per hari.',
          'Klausul Penggantian Barang Rusak/Kedaluwarsa (Expired Date < 12 bulan) dengan penukaran 1-to-1 gratis.'
        ]
      },
      overallExecutiveSummary: `Berdasarkan pemindaian ${summary.totalClusters} kelompok komoditas, ditemukan total potensi penghematan sebesar Rp ${(summary.totalEstimatedSavingsIdr / 1000000).toFixed(0)} Juta. Penargetan kontrak prioritas berfokus pada pengalihan belanja spot repetitif ke Blanket Order 2-Tahun dan penyelarasan tarif antar unit RS.`,
      generatedAt: new Date().toISOString()
    };
  }
}

export const contractAiAgentService = new ContractAiAgentService();
