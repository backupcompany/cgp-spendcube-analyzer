import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Treemap,
  Line,
  ComposedChart
} from 'recharts';
import { AggregatedQueryStats, SpendRecord, OrphanFilterType } from '../../../core/types/spend';
import { 
  TrendingUp, 
  Building2, 
  Package, 
  BarChart3, 
  PieChart as PieIcon,
  Layers, 
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  FolderTree,
  ChevronRight,
  RotateCcw,
  Store,
  Filter,
  X,
  PiggyBank,
  AlertCircle,
  Percent,
  SlidersHorizontal,
  Tag,
  Briefcase,
  Users
} from 'lucide-react';
import { FilteredTransactionsTable, ActiveFilterDescription } from './aiQuery/FilteredTransactionsTable';

interface FilteredDataDashboardProps {
  stats: AggregatedQueryStats;
  matchedRecords: SpendRecord[];
  queryTitle?: string;
  activeCardsCount?: number;
  onSelectRecord?: (record: SpendRecord) => void;
}

const COLORS = ['#2563eb', '#4f46e5', '#0891b2', '#0d9488', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#db2777', '#0284c7'];

export const FilteredDataDashboard: React.FC<FilteredDataDashboardProps> = ({
  stats: initialStats,
  matchedRecords,
  queryTitle,
  activeCardsCount = 1,
  onSelectRecord
}) => {
  // Treemap taxonomy state
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedLv1, setSelectedLv1] = useState<string | null>(null);
  const [selectedLv2, setSelectedLv2] = useState<string | null>(null);
  const [selectedLv3, setSelectedLv3] = useState<string | null>(null);
  const [selectedLv4, setSelectedLv4] = useState<string | null>(null);

  // Cross-Filter States (Clicking any chart elements filters all other charts)
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [spendTypeFilter, setSpendTypeFilter] = useState<'all' | 'CAPEX' | 'OPEX'>('all');
  const [orphanFilter, setOrphanFilter] = useState<OrphanFilterType>('ALL');

  // Trend chart mode
  const [trendMetric, setTrendMetric] = useState<'both' | 'value' | 'qty'>('both');

  const formatIDR = (val: number | undefined | null) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
  
  const formatIDRShort = (val: number | undefined | null) => {
    const num = Number(val) || 0;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}M`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}Jt`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}Rb`;
    return `${num}`;
  };

  const formatNumber = (val: number | undefined | null) => (Number(val) || 0).toLocaleString('id-ID');

  const getRecordDepartment = (r: SpendRecord): string => {
    let d = r.department || (r.requester ? `Dept (${r.requester})` : '');
    if (!d || d === 'Umum & Operasional') {
      const itemLower = (r.itemName || r.purchReqName || '').toLowerCase();
      if (/resep|medis|pasien|status|rm|rawat|klinik|perawat|dokter|poliklinik/i.test(itemLower)) {
        return 'Rawat Inap & Poliklinik';
      } else if (/farmasi|obat|lab|laboratorium|reagen|etiket/i.test(itemLower)) {
        return 'Farmasi & Laboratorium';
      } else if (/kasir|billing|registrasi|thermal|kwitansi|admission|struk/i.test(itemLower)) {
        return 'Administrasi & Kasir (Billing)';
      } else if (/it|komputer|edp|printer|cartridge/i.test(itemLower)) {
        return 'Teknologi Informasi (IT)';
      } else {
        return 'Umum & Operasional (GA)';
      }
    }
    return d;
  };

  // 1. Cross-Filtered Records Calculation
  const effectiveRecords = useMemo(() => {
    return matchedRecords.filter(r => {
      // OPEX / CAPEX Filter
      if (spendTypeFilter !== 'all') {
        const cat = (r.purchaseCategory || r.sourceFile || '').toUpperCase();
        if (spendTypeFilter === 'CAPEX' && !cat.includes('CAPEX')) return false;
        if (spendTypeFilter === 'OPEX' && !cat.includes('OPEX')) return false;
      }
      // Hospital Filter
      if (selectedHospital && r.hospitalCode !== selectedHospital) return false;
      // Department Filter
      if (selectedDepartment && getRecordDepartment(r) !== selectedDepartment) return false;
      // Vendor Filter
      if (selectedVendor && r.vendorName !== selectedVendor) return false;
      // SKU / Item Filter
      if (selectedSku && r.itemName !== selectedSku) return false;
      // Month Filter
      if (selectedMonth && r.monthYear !== selectedMonth) return false;

      // SKU Matching & Partial / Full Orphan Filter
      if (orphanFilter !== 'ALL') {
        const isMatched = r.orphanStatus === 'EXACT_MATCH' || (Boolean(r.skuMasterId) && r.orphanStatus !== 'PARTIAL_ORPHAN' && r.orphanStatus !== 'FULL_ORPHAN');
        const score = r.orphanConfidenceScore || 0;

        if (orphanFilter === 'EXACT_MATCH') {
          if (!isMatched) return false;
        } else if (orphanFilter === 'PARTIAL_ORPHAN') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN') return false;
        } else if (orphanFilter === 'PARTIAL_40') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score > 45) return false;
        } else if (orphanFilter === 'PARTIAL_50') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 46 || score > 59) return false;
        } else if (orphanFilter === 'PARTIAL_60') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 60 || score > 79) return false;
        } else if (orphanFilter === 'PARTIAL_80') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 80 || score > 89) return false;
        } else if (orphanFilter === 'PARTIAL_90') {
          if (r.orphanStatus !== 'PARTIAL_ORPHAN' || score < 90) return false;
        } else if (orphanFilter === 'FULL_ORPHAN') {
          if (r.orphanStatus !== 'FULL_ORPHAN' && !(!isMatched && r.orphanStatus !== 'PARTIAL_ORPHAN')) return false;
        }
      }

      // Taxonomy Drilldown Filters
      // Partial Orphan: remain in Procurement Categories (r.taxonomyLv1 or poCat)
      // Full Orphan: Level 1 must be 'ORPHAN', Levels 2 to 4 are poPurchaseCat
      const isFullOrphan = r.orphanStatus === 'FULL_ORPHAN' || (!r.skuMasterId && r.orphanStatus !== 'PARTIAL_ORPHAN' && r.orphanStatus !== 'EXACT_MATCH');
      const isPartialOrphan = r.orphanStatus === 'PARTIAL_ORPHAN';
      const poPurchaseCat = (r.purchaseCategory || r.procurementCategory || r.mappedCategory || r.commodityItem || 'General Supplies').trim();
      const poCat = (r.procurementCategory || r.mappedCategory || r.commodityItem || 'General Supplies').trim();

      let lv1 = '';
      let lv2 = '';
      let lv3 = '';
      let lv4 = '';
      const lv5 = r.taxonomyLv5 || r.itemName;

      if (isFullOrphan) {
        lv1 = 'ORPHAN';
        lv2 = poPurchaseCat;
        lv3 = poPurchaseCat;
        lv4 = poPurchaseCat;
      } else if (isPartialOrphan) {
        lv1 = r.taxonomyLv1 || poCat;
        lv2 = r.taxonomyLv2 || poPurchaseCat;
        lv3 = r.taxonomyLv3 || lv2;
        lv4 = r.taxonomyLv4 || lv3;
      } else {
        lv1 = r.taxonomyLv1 || poCat;
        lv2 = r.taxonomyLv2 || 'Medical & Hospital Supplies';
        lv3 = r.taxonomyLv3 || 'General Consumables';
        lv4 = r.taxonomyLv4 || lv1;
      }

      if (selectedLv1 && lv1 !== selectedLv1) return false;
      if (selectedLv2 && lv2 !== selectedLv2) return false;
      if (selectedLv3 && lv3 !== selectedLv3) return false;
      if (selectedLv4 && lv4 !== selectedLv4) return false;

      return true;
    });
  }, [matchedRecords, spendTypeFilter, orphanFilter, selectedHospital, selectedDepartment, selectedVendor, selectedSku, selectedMonth, selectedLv1, selectedLv2, selectedLv3, selectedLv4]);

  // 2. Computed KPI Summary from effectiveRecords
  const computedKpis = useMemo(() => {
    let totalSpend = 0;
    let totalQty = 0;
    const vendorMap = new Map<string, number>();
    const monthMap = new Map<string, { spend: number; qty: number }>();

    for (const r of effectiveRecords) {
      const amt = Number(r.totalLineAmount) || 0;
      const qty = Number(r.purchQty) || 1;
      totalSpend += amt;
      totalQty += qty;

      const v = r.vendorName || 'UNKNOWN VENDOR';
      vendorMap.set(v, (vendorMap.get(v) || 0) + amt);

      const m = r.monthYear || '2026-01';
      const mCur = monthMap.get(m) || { spend: 0, qty: 0 };
      mCur.spend += amt;
      mCur.qty += qty;
      monthMap.set(m, mCur);
    }

    let topVendorName = 'N/A';
    let topVendorSpend = 0;
    for (const [v, s] of vendorMap.entries()) {
      if (s > topVendorSpend) {
        topVendorSpend = s;
        topVendorName = v;
      }
    }

    let peakMonthName = 'N/A';
    let peakMonthSpend = 0;
    let peakMonthQty = 0;
    for (const [m, data] of monthMap.entries()) {
      if (data.spend > peakMonthSpend) {
        peakMonthSpend = data.spend;
        peakMonthQty = data.qty;
        peakMonthName = m;
      }
    }

    const avgUnitPrice = totalQty > 0 ? totalSpend / totalQty : 0;
    const avgPoAmount = effectiveRecords.length > 0 ? totalSpend / effectiveRecords.length : 0;

    return {
      totalSpend,
      totalQty,
      avgUnitPrice,
      avgPoAmount,
      topVendorName,
      topVendorSpend,
      topVendorPct: totalSpend > 0 ? (topVendorSpend / totalSpend) * 100 : 0,
      peakMonthName,
      peakMonthSpend,
      peakMonthQty,
      recordsCount: effectiveRecords.length
    };
  }, [effectiveRecords]);

  // 3. Saving Opportunities & Spend Control Analytics
  const savingsAnalysis = useMemo(() => {
    const itemMap = new Map<string, {
      itemName: string;
      totalSpend: number;
      totalQty: number;
      minPrice: number;
      maxPrice: number;
      prices: number[];
      hospitals: Set<string>;
      vendors: Set<string>;
    }>();

    for (const r of effectiveRecords) {
      const name = r.itemName || 'Unnamed Item';
      const price = Number(r.purchPrice) || (Number(r.totalLineAmount) / Math.max(1, Number(r.purchQty)));
      const qty = Number(r.purchQty) || 1;
      const amt = Number(r.totalLineAmount) || (price * qty);

      const existing = itemMap.get(name) || {
        itemName: name,
        totalSpend: 0,
        totalQty: 0,
        minPrice: price,
        maxPrice: price,
        prices: [],
        hospitals: new Set<string>(),
        vendors: new Set<string>()
      };

      existing.totalSpend += amt;
      existing.totalQty += qty;
      if (price > 0) {
        existing.minPrice = Math.min(existing.minPrice, price);
        existing.maxPrice = Math.max(existing.maxPrice, price);
        existing.prices.push(price);
      }
      if (r.hospitalCode) existing.hospitals.add(r.hospitalCode);
      if (r.vendorName) existing.vendors.add(r.vendorName);

      itemMap.set(name, existing);
    }

    // Calculate potential saving if all units of the same item were purchased at minPrice
    const itemSavings = Array.from(itemMap.values()).map(item => {
      const benchmarkSpend = item.totalQty * item.minPrice;
      const potentialSaving = Math.max(0, item.totalSpend - benchmarkSpend);
      const savingPct = item.totalSpend > 0 ? (potentialSaving / item.totalSpend) * 100 : 0;
      const priceVariancePct = item.minPrice > 0 ? ((item.maxPrice - item.minPrice) / item.minPrice) * 100 : 0;
      const avgPrice = item.totalQty > 0 ? item.totalSpend / item.totalQty : 0;

      return {
        ...item,
        avgPrice,
        potentialSaving,
        savingPct,
        priceVariancePct,
        hospitalCount: item.hospitals.size,
        vendorCount: item.vendors.size
      };
    }).sort((a, b) => b.potentialSaving - a.potentialSaving);

    const totalPotentialSaving = itemSavings.reduce((sum, i) => sum + i.potentialSaving, 0);
    const overallSavingPct = computedKpis.totalSpend > 0 ? (totalPotentialSaving / computedKpis.totalSpend) * 100 : 0;

    return {
      totalPotentialSaving,
      overallSavingPct,
      topSavingItems: itemSavings.slice(0, 5)
    };
  }, [effectiveRecords, computedKpis.totalSpend]);

  // 4. Monthly Trend Data (Spend Value, Quantity, and Unit Price)
  const monthlyTrendData = useMemo(() => {
    const map = new Map<string, { month: string; spend: number; quantity: number; transactions: number }>();
    
    for (const r of effectiveRecords) {
      const m = r.monthYear || '2026-01';
      const existing = map.get(m) || { month: m, spend: 0, quantity: 0, transactions: 0 };
      existing.spend += Number(r.totalLineAmount) || 0;
      existing.quantity += Number(r.purchQty) || 1;
      existing.transactions += 1;
      map.set(m, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        ...item,
        avgUnitPrice: item.quantity > 0 ? Math.round(item.spend / item.quantity) : 0,
        spendFormatted: formatIDRShort(item.spend)
      }));
  }, [effectiveRecords]);

  // 5. Top 10 Rankings: 6 Graphs Data
  // Pair 1: Hospitals
  const topHospitalsValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const r of effectiveRecords) {
      const h = r.hospitalCode || 'UNKNOWN';
      const cur = map.get(h) || { name: h, value: 0, count: 0 };
      cur.value += Number(r.totalLineAmount) || 0;
      cur.count += 1;
      map.set(h, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [effectiveRecords]);

  const topHospitalsQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; count: number }>();
    for (const r of effectiveRecords) {
      const h = r.hospitalCode || 'UNKNOWN';
      const cur = map.get(h) || { name: h, qty: 0, count: 0 };
      cur.qty += Number(r.purchQty) || 1;
      cur.count += 1;
      map.set(h, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [effectiveRecords]);

  // Pair 2: Departments (Requestor)
  const topDepartmentsValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const r of effectiveRecords) {
      const d = getRecordDepartment(r);
      const cur = map.get(d) || { name: d, value: 0, count: 0 };
      cur.value += Number(r.totalLineAmount) || 0;
      cur.count += 1;
      map.set(d, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [effectiveRecords]);

  const topDepartmentsQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; count: number }>();
    for (const r of effectiveRecords) {
      const d = getRecordDepartment(r);
      const cur = map.get(d) || { name: d, qty: 0, count: 0 };
      cur.qty += Number(r.purchQty) || 1;
      cur.count += 1;
      map.set(d, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [effectiveRecords]);

  // Pair 3: Vendors
  const topVendorsValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const r of effectiveRecords) {
      const v = r.vendorName || 'UNKNOWN VENDOR';
      const cur = map.get(v) || { name: v, value: 0, count: 0 };
      cur.value += Number(r.totalLineAmount) || 0;
      cur.count += 1;
      map.set(v, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [effectiveRecords]);

  const topVendorsQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; count: number }>();
    for (const r of effectiveRecords) {
      const v = r.vendorName || 'UNKNOWN VENDOR';
      const cur = map.get(v) || { name: v, qty: 0, count: 0 };
      cur.qty += Number(r.purchQty) || 1;
      cur.count += 1;
      map.set(v, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [effectiveRecords]);

  // Pair 3: SKUs / Items
  const topSkusValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const r of effectiveRecords) {
      const s = r.itemName || 'UNKNOWN SKU';
      const cur = map.get(s) || { name: s, value: 0, count: 0 };
      cur.value += Number(r.totalLineAmount) || 0;
      cur.count += 1;
      map.set(s, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [effectiveRecords]);

  const topSkusQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; count: number }>();
    for (const r of effectiveRecords) {
      const s = r.itemName || 'UNKNOWN SKU';
      const cur = map.get(s) || { name: s, qty: 0, count: 0 };
      cur.qty += Number(r.purchQty) || 1;
      cur.count += 1;
      map.set(s, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [effectiveRecords]);

  // 6. CAPEX vs OPEX Category Proportion
  const categoryDistribution = useMemo(() => {
    let capexSpend = 0;
    let opexSpend = 0;
    let otherSpend = 0;

    effectiveRecords.forEach(r => {
      const spend = Number(r.totalLineAmount) || 0;
      const cat = (r.purchaseCategory || r.sourceFile || '').toUpperCase();
      if (cat.includes('CAPEX')) {
        capexSpend += spend;
      } else if (cat.includes('OPEX')) {
        opexSpend += spend;
      } else {
        otherSpend += spend;
      }
    });

    const total = (capexSpend + opexSpend + otherSpend) || 1;
    const res = [];
    if (capexSpend > 0) res.push({ name: 'CAPEX', value: capexSpend, percentage: ((capexSpend / total) * 100).toFixed(1), color: '#2563eb' });
    if (opexSpend > 0) res.push({ name: 'OPEX', value: opexSpend, percentage: ((opexSpend / total) * 100).toFixed(1), color: '#f59e0b' });
    if (otherSpend > 0) res.push({ name: 'Lainnya', value: otherSpend, percentage: ((otherSpend / total) * 100).toFixed(1), color: '#64748b' });
    return res;
  }, [effectiveRecords]);

  // 7. Tree Map Nodes Aggregation for Commodity Taxonomy L1 to L5
  const treeMapNodes = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; count: number }>();

    for (const r of effectiveRecords) {
      const isOrphan = !r.skuMasterId || r.orphanStatus === 'FULL_ORPHAN' || r.orphanStatus === 'PARTIAL_ORPHAN';
      const poCat = (r.procurementCategory || r.mappedCategory || r.commodityItem || 'General Supplies').trim();
      const lv1 = r.taxonomyLv1 || (isOrphan ? 'UNMAPPED / ORPHAN PO' : 'General');
      const lv2 = r.taxonomyLv2 || (isOrphan ? poCat : 'Medical & Hospital Supplies');
      const lv3 = r.taxonomyLv3 || (isOrphan ? poCat : 'General Consumables');
      const lv4 = r.taxonomyLv4 || (isOrphan ? poCat : lv1);
      const lv5 = r.taxonomyLv5 || r.itemName || 'Item';
      const amt = Number(r.totalLineAmount) || 0;

      let key = '';
      let displayName = '';

      if (currentLevel === 1) {
        key = lv1;
        displayName = lv1;
      } else if (currentLevel === 2) {
        if (selectedLv1 && lv1 !== selectedLv1) continue;
        key = lv2;
        displayName = lv2;
      } else if (currentLevel === 3) {
        if (selectedLv1 && lv1 !== selectedLv1) continue;
        if (selectedLv2 && lv2 !== selectedLv2) continue;
        key = lv3;
        displayName = lv3;
      } else if (currentLevel === 4) {
        if (selectedLv1 && lv1 !== selectedLv1) continue;
        if (selectedLv2 && lv2 !== selectedLv2) continue;
        if (selectedLv3 && lv3 !== selectedLv3) continue;
        key = lv4;
        displayName = lv4;
      } else {
        if (selectedLv1 && lv1 !== selectedLv1) continue;
        if (selectedLv2 && lv2 !== selectedLv2) continue;
        if (selectedLv3 && lv3 !== selectedLv3) continue;
        if (selectedLv4 && lv4 !== selectedLv4) continue;
        key = lv5;
        displayName = lv5;
      }

      const existing = map.get(key) || { name: displayName, spend: 0, count: 0 };
      existing.spend += amt;
      existing.count += 1;
      map.set(key, existing);
    }

    const totalSpendAll = Array.from(map.values()).reduce((sum, item) => sum + item.spend, 0);

    return Array.from(map.entries()).map(([key, data]) => ({
      key,
      name: data.name,
      spend: data.spend,
      size: data.spend,
      count: data.count,
      percentage: totalSpendAll > 0 ? (data.spend / totalSpendAll) * 100 : 0
    })).sort((a, b) => b.spend - a.spend);
  }, [effectiveRecords, currentLevel, selectedLv1, selectedLv2, selectedLv3, selectedLv4]);

  const handleNodeClick = (nodeKey: string) => {
    if (currentLevel === 1) {
      setSelectedLv1(nodeKey);
      setCurrentLevel(2);
    } else if (currentLevel === 2) {
      setSelectedLv2(nodeKey);
      setCurrentLevel(3);
    } else if (currentLevel === 3) {
      setSelectedLv3(nodeKey);
      setCurrentLevel(4);
    } else if (currentLevel === 4) {
      setSelectedLv4(nodeKey);
      setCurrentLevel(5);
    }
  };

  const handleBreadcrumbClick = (targetLevel: 1 | 2 | 3 | 4 | 5) => {
    setCurrentLevel(targetLevel);
    if (targetLevel <= 1) {
      setSelectedLv1(null);
      setSelectedLv2(null);
      setSelectedLv3(null);
      setSelectedLv4(null);
    } else if (targetLevel === 2) {
      setSelectedLv2(null);
      setSelectedLv3(null);
      setSelectedLv4(null);
    } else if (targetLevel === 3) {
      setSelectedLv3(null);
      setSelectedLv4(null);
    } else if (targetLevel === 4) {
      setSelectedLv4(null);
    }
  };

  // Custom Treemap Content Renderer
  const CustomizedTreemapContent = (props: any) => {
    const { x, y, width, height, index, name, spend, percentage } = props;
    if (width < 8 || height < 8) return null;

    const bgColors = [
      '#2563eb', '#4f46e5', '#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#0284c7', '#6366f1'
    ];
    const fill = bgColors[index % bgColors.length];

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill,
            stroke: '#ffffff',
            strokeWidth: 2,
            strokeOpacity: 0.9,
            cursor: 'pointer',
            rx: 6,
            ry: 6
          }}
          onClick={() => {
            if (name) handleNodeClick(name);
          }}
        />
        {width > 55 && height > 32 && (
          <text
            x={x + width / 2}
            y={y + height / 2 - 5}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={width > 120 ? 12 : 10}
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            {name && name.length > Math.floor(width / 8) ? name.substring(0, Math.floor(width / 8)) + '...' : name}
          </text>
        )}
        {width > 65 && height > 45 && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            fill="rgba(255, 255, 255, 0.9)"
            fontSize={10}
            fontFamily="monospace"
            style={{ pointerEvents: 'none' }}
          >
            {formatIDRShort(spend)} ({percentage ? Number(percentage).toFixed(0) : 0}%)
          </text>
        )}
      </g>
    );
  };

  const handleResetAllCrossFilters = () => {
    setSelectedHospital(null);
    setSelectedDepartment(null);
    setSelectedVendor(null);
    setSelectedSku(null);
    setSelectedMonth(null);
    setSpendTypeFilter('all');
    setOrphanFilter('ALL');
    setCurrentLevel(1);
    setSelectedLv1(null);
    setSelectedLv2(null);
    setSelectedLv3(null);
    setSelectedLv4(null);
  };

  const hasActiveCrossFilters = Boolean(
    selectedHospital ||
    selectedDepartment ||
    selectedVendor ||
    selectedSku ||
    selectedMonth ||
    spendTypeFilter !== 'all' ||
    orphanFilter !== 'ALL' ||
    currentLevel > 1 ||
    selectedLv1
  );

  const activeFilterList = useMemo(() => {
    const list: ActiveFilterDescription[] = [];
    if (selectedHospital) {
      list.push({ label: 'Unit RS', value: selectedHospital, onClear: () => setSelectedHospital(null) });
    }
    if (selectedDepartment) {
      list.push({ label: 'Departemen', value: selectedDepartment, onClear: () => setSelectedDepartment(null) });
    }
    if (selectedVendor) {
      list.push({ label: 'Vendor', value: selectedVendor, onClear: () => setSelectedVendor(null) });
    }
    if (selectedSku) {
      list.push({ label: 'Item/SKU', value: selectedSku, onClear: () => setSelectedSku(null) });
    }
    if (selectedMonth) {
      list.push({ label: 'Bulan', value: selectedMonth, onClear: () => setSelectedMonth(null) });
    }
    if (spendTypeFilter !== 'all') {
      list.push({ label: 'Tipe Spend', value: spendTypeFilter, onClear: () => setSpendTypeFilter('all') });
    }
    if (orphanFilter !== 'ALL') {
      list.push({ label: 'Status Matching', value: orphanFilter, onClear: () => setOrphanFilter('ALL') });
    }
    if (selectedLv1) {
      list.push({ label: 'Taksonomi Lv1', value: selectedLv1, onClear: () => { setSelectedLv1(null); setCurrentLevel(1); } });
    }
    if (selectedLv2) {
      list.push({ label: 'Taksonomi Lv2', value: selectedLv2, onClear: () => { setSelectedLv2(null); setCurrentLevel(2); } });
    }
    if (selectedLv3) {
      list.push({ label: 'Taksonomi Lv3', value: selectedLv3, onClear: () => { setSelectedLv3(null); setCurrentLevel(3); } });
    }
    if (selectedLv4) {
      list.push({ label: 'Taksonomi Lv4', value: selectedLv4, onClear: () => { setSelectedLv4(null); setCurrentLevel(4); } });
    }
    return list;
  }, [selectedHospital, selectedDepartment, selectedVendor, selectedSku, selectedMonth, spendTypeFilter, orphanFilter, selectedLv1, selectedLv2, selectedLv3, selectedLv4]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Notice & Interactive Cross-Filter Controller */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-sm">Visual Dashboard & Spend Control Center</span>
                <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono">
                  Interactive Cross-Filtering
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Klik salah satu baris/batang grafik untuk memfilter semua grafik lainnya secara reaktif guna menemukan inefisiensi & peluang <strong>cost savings</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end sm:self-center">
            {/* SKU Matching / Orphan Status Filter Dropdown */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 pl-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Matching:</span>
              </span>
              <select
                value={orphanFilter}
                onChange={(e) => setOrphanFilter(e.target.value as OrphanFilterType)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                  orphanFilter !== 'ALL'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs font-bold'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <option value="ALL">All Status</option>
                <option value="EXACT_MATCH">Exact Match (100%)</option>
                <option value="PARTIAL_ORPHAN">Partial Orphan (All 40%–94%)</option>
                <option value="PARTIAL_40">Partial Orphan (40% - Substring/Nama Mirip)</option>
                <option value="PARTIAL_50">Partial Orphan (50% - Komoditas Cocok)</option>
                <option value="PARTIAL_60">Partial Orphan (60%–70% - Komoditas + Brand/Part#)</option>
                <option value="PARTIAL_80">Partial Orphan (80% - Komoditas + Spesifikasi)</option>
                <option value="PARTIAL_90">Partial Orphan (90%+ - High Confidence)</option>
                <option value="FULL_ORPHAN">Full Orphan (0% - Belum Cocok)</option>
              </select>
            </div>

            {/* CAPEX / OPEX quick filter switch */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSpendTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  spendTypeFilter === 'all' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSpendTypeFilter('CAPEX')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  spendTypeFilter === 'CAPEX' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                CAPEX
              </button>
              <button
                type="button"
                onClick={() => setSpendTypeFilter('OPEX')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  spendTypeFilter === 'OPEX' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                OPEX
              </button>
            </div>

            {hasActiveCrossFilters && (
              <button
                type="button"
                onClick={handleResetAllCrossFilters}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {hasActiveCrossFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-semibold flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter Aktif:</span>
            </span>

            {spendTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Tipe: {spendTypeFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-blue-900" onClick={() => setSpendTypeFilter('all')} />
              </span>
            )}
            {orphanFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-300">
                Matching: {
                  orphanFilter === 'EXACT_MATCH' ? 'Exact Match' :
                  orphanFilter === 'PARTIAL_ORPHAN' ? 'Partial Orphan (All)' :
                  orphanFilter === 'PARTIAL_40' ? 'Partial 40%' :
                  orphanFilter === 'PARTIAL_50' ? 'Partial 50%' :
                  orphanFilter === 'PARTIAL_60' ? 'Partial 60%–70%' :
                  orphanFilter === 'PARTIAL_80' ? 'Partial 80%' :
                  orphanFilter === 'PARTIAL_90' ? 'Partial 90%+' : 'Full Orphan'
                }
                <X className="w-3 h-3 cursor-pointer hover:text-amber-950" onClick={() => setOrphanFilter('ALL')} />
              </span>
            )}
            {selectedHospital && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                Unit RS: {selectedHospital}
                <X className="w-3 h-3 cursor-pointer hover:text-indigo-900" onClick={() => setSelectedHospital(null)} />
              </span>
            )}
            {selectedDepartment && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Dept: {selectedDepartment}
                <X className="w-3 h-3 cursor-pointer hover:text-emerald-900" onClick={() => setSelectedDepartment(null)} />
              </span>
            )}
            {selectedVendor && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                Vendor: {selectedVendor}
                <X className="w-3 h-3 cursor-pointer hover:text-teal-900" onClick={() => setSelectedVendor(null)} />
              </span>
            )}
            {selectedSku && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                SKU / Item: {selectedSku}
                <X className="w-3 h-3 cursor-pointer hover:text-purple-900" onClick={() => setSelectedSku(null)} />
              </span>
            )}
            {selectedMonth && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                Bulan: {selectedMonth}
                <X className="w-3 h-3 cursor-pointer hover:text-amber-900" onClick={() => setSelectedMonth(null)} />
              </span>
            )}
            {currentLevel > 1 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                Taksonomi Level {currentLevel}
                <X className="w-3 h-3 cursor-pointer hover:text-slate-900" onClick={() => handleBreadcrumbClick(1)} />
              </span>
            )}

            <span className="ml-auto text-slate-500 font-mono text-[11px]">
              Menampilkan <strong>{computedKpis.recordsCount.toLocaleString()}</strong> transaksi ({formatIDR(computedKpis.totalSpend)})
            </span>
          </div>
        )}
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Nilai Spend</span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-blue-700 font-mono truncate">
            {formatIDR(computedKpis.totalSpend)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Rata-rata {formatIDR(computedKpis.avgPoAmount)} / baris PO
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Kuantitas / Volume</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-slate-900 font-mono truncate">
            {formatNumber(computedKpis.totalQty)} <span className="text-xs font-normal text-slate-500">unit</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Avg {formatIDR(computedKpis.avgUnitPrice)} / unit
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Bulan Puncak (Peak Month)</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-sm sm:text-base font-extrabold text-amber-700 font-mono truncate">
            {computedKpis.peakMonthName}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block truncate">
            {formatIDRShort(computedKpis.peakMonthSpend)} ({formatNumber(computedKpis.peakMonthQty)} unit)
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pemasok Utama Dominan</span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate" title={computedKpis.topVendorName}>
            {computedKpis.topVendorName}
          </div>
          <span className="text-[10px] text-purple-700 font-mono font-bold mt-1 block">
            {computedKpis.topVendorPct > 0 ? `${computedKpis.topVendorPct.toFixed(1)}% pangsa spend` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Saving Opportunity & Spending Control Strip */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-5 text-white shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold tracking-tight text-white">
                  Spending Control & Potensi Penghematan Biaya (Cost Saving Opportunity)
                </h4>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                  Price Arbitrage & Benchmark
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Dihitung dari selisih variansi harga pembelian item yang sama antar unit RS & Vendor terhadap harga terendah yang pernah didapatkan.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shrink-0">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block">Total Potensi Saving</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                {formatIDR(savingsAnalysis.totalPotentialSaving)}
              </span>
            </div>
            <div className="border-l border-white/20 pl-3">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block">Rasio Saving</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-300">
                {savingsAnalysis.overallSavingPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Top Saving Items Quick Table */}
        {savingsAnalysis.topSavingItems.length > 0 && (
          <div className="bg-black/20 rounded-xl p-3 border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-white/10 text-[11px]">
                  <th className="pb-2 font-semibold">SKU / Item dengan Variansi Tertinggi</th>
                  <th className="pb-2 font-semibold text-right">Volume</th>
                  <th className="pb-2 font-semibold text-right">Harga Min (Benchmark)</th>
                  <th className="pb-2 font-semibold text-right">Harga Max</th>
                  <th className="pb-2 font-semibold text-right">Variansi (%)</th>
                  <th className="pb-2 font-semibold text-right text-emerald-400">Potensi Saving (IDR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {savingsAnalysis.topSavingItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedSku(item.itemName)}>
                    <td className="py-2 pr-3 font-sans font-bold text-white max-w-[240px] truncate" title={item.itemName}>
                      {idx + 1}. {item.itemName}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-300">
                      {formatNumber(item.totalQty)}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-300">
                      {formatIDR(item.minPrice)}
                    </td>
                    <td className="py-2 px-2 text-right text-rose-300">
                      {formatIDR(item.maxPrice)}
                    </td>
                    <td className="py-2 px-2 text-right text-amber-300 font-bold">
                      +{item.priceVariancePct.toFixed(0)}%
                    </td>
                    <td className="py-2 pl-2 text-right text-emerald-400 font-bold">
                      {formatIDR(item.potentialSaving)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Graphic Trend by Time in Qty and Value (Interactive Click-to-Filter Month) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Graphic Trend by Time: Spend Value (IDR) & Quantity (Units)</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik pada batang bulan tertentu untuk memfilter seluruh data transaksi ke periode tersebut.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTrendMetric('both')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendMetric === 'both' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dual Axis (Value & Qty)
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric('value')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendMetric === 'value' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nilai Spend Saja
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric('qty')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendMetric === 'qty' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kuantitas Saja
              </button>
            </div>

            {selectedMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(null)}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                Hapus Filter Bulan ({selectedMonth})
              </button>
            )}
          </div>
        </div>

        <div className="h-72 w-full">
          {monthlyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyTrendData}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                onClick={(e: any) => {
                  if (e && e.activeLabel) {
                    setSelectedMonth(e.activeLabel === selectedMonth ? null : e.activeLabel);
                  }
                }}
              >
                <defs>
                  <linearGradient id="spendGradientFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  stroke="#2563eb"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatIDRShort}
                />
                {(trendMetric === 'both' || trendMetric === 'qty') && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#4f46e5"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatNumber}
                  />
                )}
                <Tooltip
                  formatter={(val: any, name: string) => {
                    if (name === 'Spend (IDR)') return [formatIDR(val), name];
                    if (name === 'Quantity (Units)') return [`${formatNumber(val)} units`, name];
                    if (name === 'Avg Unit Price') return [formatIDR(val), name];
                    return [val, name];
                  }}
                  labelFormatter={(label) => `Bulan: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                {(trendMetric === 'both' || trendMetric === 'value') && (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="spend"
                    name="Spend (IDR)"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#spendGradientFill)"
                    cursor="pointer"
                  />
                )}
                {(trendMetric === 'both' || trendMetric === 'qty') && (
                  <Bar
                    yAxisId={trendMetric === 'qty' ? 'left' : 'right'}
                    dataKey="quantity"
                    name="Quantity (Units)"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                    barSize={20}
                    cursor="pointer"
                  >
                    {monthlyTrendData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={selectedMonth === entry.month ? '#f59e0b' : '#6366f1'}
                      />
                    ))}
                  </Bar>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Tidak ada data tren bulanan untuk kriteria ini
            </div>
          )}
        </div>
      </div>

      {/* Top 10 Rankings: Value & Quantity Side-by-Side (8 Graphs: Hospitals, Departments, Vendors, SKUs) */}
      <div className="space-y-4">
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>Top 10 Rankings: Value & Quantity Side-by-Side (8 Graphs: Hospitals, Departments, Vendors, SKUs)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik pada bar grafik Rumah Sakit, Departemen Requestor, Vendor, atau SKU untuk memfilter data dan melakukan komparasi volume vs spending.
            </p>
          </div>
          <span className="text-[11px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-xl">
            8 Charts Matriks Komparatif
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Hospitals by Spend (Value) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedHospital ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Top 10 Hospitals by Spend (Value)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter RS</p>
                </div>
              </div>
              {selectedHospital && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  Filter: {selectedHospital}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topHospitalsValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedHospital(e.activeLabel === selectedHospital ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={65} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [formatIDR(val), 'Spend Value']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topHospitalsValue.map((entry, idx) => (
                      <Cell
                        key={`hosp-val-${idx}`}
                        fill={selectedHospital === entry.name ? '#f59e0b' : '#2563eb'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Hospitals by Quantity (Qty) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedHospital ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Top 10 Hospitals by Quantity (Qty)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter RS</p>
                </div>
              </div>
              {selectedHospital && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  Filter: {selectedHospital}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topHospitalsQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedHospital(e.activeLabel === selectedHospital ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={65} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${formatNumber(val)} units`, 'Quantity']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topHospitalsQty.map((entry, idx) => (
                      <Cell
                        key={`hosp-qty-${idx}`}
                        fill={selectedHospital === entry.name ? '#f59e0b' : '#3b82f6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Departments by Spend (Value) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedDepartment ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Top 10 Departments by Spend (Value)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter Departemen</p>
                </div>
              </div>
              {selectedDepartment && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  Filter: {selectedDepartment}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDepartmentsValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedDepartment(e.activeLabel === selectedDepartment ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [formatIDR(val), 'Spend Value']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="value" fill="#059669" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topDepartmentsValue.map((entry, idx) => (
                      <Cell
                        key={`dept-val-${idx}`}
                        fill={selectedDepartment === entry.name ? '#f59e0b' : '#059669'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Departments by Quantity (Qty) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedDepartment ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Top 10 Departments by Quantity (Qty)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter Departemen</p>
                </div>
              </div>
              {selectedDepartment && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  Filter: {selectedDepartment}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDepartmentsQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedDepartment(e.activeLabel === selectedDepartment ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${formatNumber(val)} units`, 'Quantity']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="qty" fill="#10b981" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topDepartmentsQty.map((entry, idx) => (
                      <Cell
                        key={`dept-qty-${idx}`}
                        fill={selectedDepartment === entry.name ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. Vendors by Spend (Value) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedVendor ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">5. Top 10 Vendors by Spend (Value)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter Vendor</p>
                </div>
              </div>
              {selectedVendor && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  Filter: {selectedVendor}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVendorsValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedVendor(e.activeLabel === selectedVendor ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={85} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [formatIDR(val), 'Spend Value']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="value" fill="#4f46e5" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topVendorsValue.map((entry, idx) => (
                      <Cell
                        key={`vend-val-${idx}`}
                        fill={selectedVendor === entry.name ? '#f59e0b' : '#4f46e5'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. Vendors by Quantity (Qty) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedVendor ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">6. Top 10 Vendors by Quantity (Qty)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter Vendor</p>
                </div>
              </div>
              {selectedVendor && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  Filter: {selectedVendor}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVendorsQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedVendor(e.activeLabel === selectedVendor ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={85} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${formatNumber(val)} units`, 'Quantity']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="qty" fill="#6366f1" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topVendorsQty.map((entry, idx) => (
                      <Cell
                        key={`vend-qty-${idx}`}
                        fill={selectedVendor === entry.name ? '#f59e0b' : '#6366f1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7. SKUs by Spend (Value) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedSku ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">7. Top 10 SKUs by Spend (Value)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter SKU Item</p>
                </div>
              </div>
              {selectedSku && (
                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                  Filter: {selectedSku}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSkusValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 35, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedSku(e.activeLabel === selectedSku ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={95} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [formatIDR(val), 'Spend Value']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="value" fill="#0d9488" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topSkusValue.map((entry, idx) => (
                      <Cell
                        key={`sku-val-${idx}`}
                        fill={selectedSku === entry.name ? '#f59e0b' : '#0d9488'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 8. SKUs by Quantity (Qty) */}
          <div className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${selectedSku ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">8. Top 10 SKUs by Quantity (Qty)</h4>
                  <p className="text-[11px] text-slate-500">Klik bar untuk memfilter SKU Item</p>
                </div>
              </div>
              {selectedSku && (
                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                  Filter: {selectedSku}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSkusQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 35, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      setSelectedSku(e.activeLabel === selectedSku ? null : e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={95} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${formatNumber(val)} units`, 'Quantity']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="qty" fill="#14b8a6" radius={[0, 6, 6, 0]} cursor="pointer">
                    {topSkusQty.map((entry, idx) => (
                      <Cell
                        key={`sku-qty-${idx}`}
                        fill={selectedSku === entry.name ? '#f59e0b' : '#14b8a6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Treemap Hierarchy Section (Commodity Taxonomy L1 to L5) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <FolderTree className="w-4 h-4 text-blue-600" />
              <span>Hierarki Taksonomi & Komoditas (Treemap Level 1-5)</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik pada kotak treemap untuk melakukan drilldown ke level komoditas yang lebih dalam
            </p>
          </div>

          {/* Breadcrumb Navigation for Treemap Levels */}
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(1)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                currentLevel === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              L1: Kategori
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(2)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                currentLevel === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              L2: Grup
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(3)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                currentLevel === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              L3: Sub-Grup
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(4)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                currentLevel === 4 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              L4: Tipe
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(5)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                currentLevel === 5 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              L5: Item
            </button>

            {currentLevel > 1 && (
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(1)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 ml-1"
                title="Reset Treemap ke Level 1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Treemap Active Breadcrumb Path */}
        {(selectedLv1 || selectedLv2 || selectedLv3 || selectedLv4) && (
          <div className="flex items-center space-x-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 overflow-x-auto">
            <span className="text-slate-500 text-[11px] font-semibold">Jalur Filter:</span>
            {selectedLv1 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[11px]">
                {selectedLv1}
              </span>
            )}
            {selectedLv2 && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-[11px]">
                  {selectedLv2}
                </span>
              </>
            )}
            {selectedLv3 && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                  {selectedLv3}
                </span>
              </>
            )}
            {selectedLv4 && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[11px]">
                  {selectedLv4}
                </span>
              </>
            )}
          </div>
        )}

        {/* Treemap Visual Container */}
        <div className="h-72 w-full">
          {treeMapNodes.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treeMapNodes}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                content={<CustomizedTreemapContent />}
              >
                <Tooltip
                  formatter={(val: number, name: string, item: any) => [
                    `${formatIDR(item?.payload?.spend)} (${item?.payload?.percentage?.toFixed(1)}%)`,
                    item?.payload?.name
                  ]}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Tidak ada data komoditas untuk hierarki ini
            </div>
          )}
        </div>
      </div>

      {/* Row: Hospital Distribution & Capex vs Opex Proportion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Capex vs Opex Category Proportion Pie */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                <span>Proporsi CAPEX vs OPEX</span>
              </h4>
            </div>
            <p className="text-[11px] text-slate-500">Struktur alokasi anggaran modal vs operasional</p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {categoryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [formatIDR(val), 'Spend']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Tidak ada kategori</div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            {categoryDistribution.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="font-semibold text-slate-700">{cat.name}</span>
                </div>
                <div className="font-mono text-[11px]">
                  <span className="font-bold text-slate-900">{cat.percentage}%</span>
                  <span className="text-slate-400 ml-1">({formatIDRShort(cat.value)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Vendors Concentration with Progress Bars */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <Store className="w-4 h-4 text-purple-600" />
                <span>Konsentrasi Vendor Teratas & Kontribusi Spend</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Klik nama vendor untuk memfilter seluruh dashboard</p>
            </div>
            <span className="text-[10px] font-mono bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded border border-purple-200">
              Top 5 Vendor
            </span>
          </div>

          <div className="space-y-3">
            {topVendorsValue.slice(0, 5).map((v, idx) => {
              const pct = computedKpis.totalSpend > 0 ? ((v.value / computedKpis.totalSpend) * 100).toFixed(1) : '0';
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedVendor(v.name === selectedVendor ? null : v.name)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedVendor === v.name
                      ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-100'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 truncate" title={v.name}>
                        {v.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-blue-700 text-xs">{formatIDR(v.value)}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-sans">({pct}%)</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2">
                    <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>{v.count} Baris Transaksi PO</span>
                    <span className="text-blue-600 font-semibold">Klik untuk drilldown vendor →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daftar Transaksi Terfilter Interaktif Mengikuti Klik Grafik di Atas */}
      <FilteredTransactionsTable
        records={effectiveRecords}
        totalRecordsInQuery={matchedRecords.length}
        activeFilters={activeFilterList}
        onResetAllFilters={handleResetAllCrossFilters}
        onSelectRecord={onSelectRecord}
        queryTitle={queryTitle}
      />
    </div>
  );
};
