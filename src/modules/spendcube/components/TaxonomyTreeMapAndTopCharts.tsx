import React, { useState, useMemo, useEffect } from 'react';
import { SpendRecord, SkuMasterRecord, OrphanFilterType } from '../../../core/types/spend';
import { spendService } from '../services/spendService';
import { SpendTable } from './SpendTable';
import { FolderTree, ChevronRight, BarChart3, Building2, Store, Package, Layers, ArrowUpRight, Filter, Calendar, X, RotateCcw, Loader2, Briefcase, Tag } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Treemap
} from 'recharts';

interface TaxonomyTreeMapAndTopChartsProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  onSelectRecord: (record: SpendRecord) => void;
}

export const TaxonomyTreeMapAndTopCharts: React.FC<TaxonomyTreeMapAndTopChartsProps> = React.memo(({
  records,
  skuMasters,
  onSelectRecord
}) => {
  // Deferred mounting to prevent initial frame freeze and layout thrashing
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 120);
    return () => clearTimeout(timer);
  }, []);

  // Drill-down level & selected keys
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedLv1, setSelectedLv1] = useState<string | null>(null);
  const [selectedLv2, setSelectedLv2] = useState<string | null>(null);
  const [selectedLv3, setSelectedLv3] = useState<string | null>(null);
  const [selectedLv4, setSelectedLv4] = useState<string | null>(null);

  // Local OPEX / CAPEX filter
  const [spendTypeFilter, setSpendTypeFilter] = useState<'all' | 'CAPEX' | 'OPEX'>('all');
  
  // Local SKU Matching / Orphan Status filter
  const [orphanFilter, setOrphanFilter] = useState<OrphanFilterType>('ALL');

  // Interactive Chart Click Filters (Boolean combination)
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Loading state during drilldown & heavy in-memory multi-chart recalculations
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Mengkalkulasi taksonomi...');

  const applyHeavyOperation = (fn: () => void, message: string) => {
    setIsProcessing(true);
    setProcessingMessage(message);
    // Yield to the browser main thread so the loading spinner is painted before heavy calculation
    setTimeout(() => {
      fn();
      setTimeout(() => {
        setIsProcessing(false);
      }, 50);
    }, 20);
  };

  const formatIDR = (val: number | undefined | null) => {
    const num = Number(val) || 0;
    if (num >= 1e9) return `Rp ${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `Rp ${(num / 1e6).toFixed(2)}M`;
    return `Rp ${num.toLocaleString()}`;
  };

  const formatNumber = (val: number | undefined | null) => (Number(val) || 0).toLocaleString();

  // 1. Base filtered records (OPEX/CAPEX + Chart Click Filters + Month + Orphan Status)
  const baseFilteredRecords = useMemo(() => {
    return records.filter(r => {
      if (spendTypeFilter !== 'all' && r.purchaseCategory !== spendTypeFilter) return false;
      if (selectedHospital && r.hospitalCode !== selectedHospital) return false;
      if (selectedVendor && r.vendorName !== selectedVendor) return false;
      if (selectedSku && r.itemName !== selectedSku) return false;
      if (selectedDepartment) {
        const d = (r.department && r.department.trim()) ? r.department.trim() : 'Unassigned Dept';
        if (d !== selectedDepartment) return false;
      }
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

      return true;
    });
  }, [records, spendTypeFilter, selectedHospital, selectedVendor, selectedSku, selectedDepartment, selectedMonth, orphanFilter]);

  // Monthly timeline aggregation for timeline filter chart
  const monthlyTimelineData = useMemo(() => {
    const map = new Map<string, { month: string; value: number; qty: number }>();
    for (const r of baseFilteredRecords) {
      const m = r.monthYear || '2026-01';
      const existing = map.get(m) || { month: m, value: 0, qty: 0 };
      existing.value += Number(r.totalLineAmount) || 0;
      existing.qty += Number(r.purchQty) || 1;
      map.set(m, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [baseFilteredRecords]);

  // 2. Fully filtered records including Tree Map Drill-Down level & selected nodes (for the Table & Charts)
  const fullyFilteredRecords = useMemo(() => {
    return baseFilteredRecords.filter(r => {
      const isFullOrphan = r.orphanStatus === 'FULL_ORPHAN' || (!r.skuMasterId && r.orphanStatus !== 'PARTIAL_ORPHAN' && r.orphanStatus !== 'EXACT_MATCH');
      const isPartialOrphan = r.orphanStatus === 'PARTIAL_ORPHAN';
      const poPurchaseCat = (r.purchaseCategory || r.procurementCategory || r.mappedCategory || 'General Supplies').trim();
      const poCat = (r.procurementCategory || r.mappedCategory || 'General Supplies').trim();

      let lv1 = '';
      let lv2 = '';
      let lv3 = '';
      let lv4 = '';

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
  }, [baseFilteredRecords, selectedLv1, selectedLv2, selectedLv3, selectedLv4]);

  // Tree Map Nodes Aggregation
  const treeMapNodes = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; count: number }>();

    for (const r of baseFilteredRecords) {
      const isFullOrphan = r.orphanStatus === 'FULL_ORPHAN' || (!r.skuMasterId && r.orphanStatus !== 'PARTIAL_ORPHAN' && r.orphanStatus !== 'EXACT_MATCH');
      const isPartialOrphan = r.orphanStatus === 'PARTIAL_ORPHAN';
      const poPurchaseCat = (r.purchaseCategory || r.procurementCategory || r.mappedCategory || 'General Supplies').trim();
      const poCat = (r.procurementCategory || r.mappedCategory || 'General Supplies').trim();

      let lv1 = '';
      let lv2 = '';
      let lv3 = '';
      let lv4 = '';
      const lv5 = r.taxonomyLv5 || r.itemName;
      const amt = Number(r.totalLineAmount) || 0;

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
  }, [baseFilteredRecords, currentLevel, selectedLv1, selectedLv2, selectedLv3, selectedLv4]);

  const handleNodeClick = (nodeKey: string) => {
    applyHeavyOperation(() => {
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
    }, `Drill-down ke: ${nodeKey}`);
  };

  const handleBreadcrumbClick = (targetLevel: 1 | 2 | 3 | 4 | 5) => {
    applyHeavyOperation(() => {
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
    }, `Navigasi ke Taxonomy Level ${targetLevel}`);
  };

  // Custom Treemap Content Renderer
  const CustomizedTreemapContent = (props: any) => {
    const { x, y, width, height, index, name, spend, percentage } = props;
    if (width < 5 || height < 5) return null;

    const bgColors = [
      '#2563eb', '#4f46e5', '#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#0284c7', '#6366f1'
    ];
    const isUnmappedBlock = name === 'UNMAPPED / ORPHAN PO';
    const color = isUnmappedBlock ? '#64748b' : bgColors[index % bgColors.length];

    return (
      <g 
        onClick={() => {
          if (currentLevel < 5) {
            handleNodeClick(name);
          } else {
            applyHeavyOperation(() => {
              setSelectedSku(name === selectedSku ? null : name);
            }, `Filter SKU: ${name}`);
          }
        }} 
        className="cursor-pointer"
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          ry={6}
          style={{
            fill: color,
            stroke: '#ffffff',
            strokeWidth: 2,
            strokeOpacity: 1
          }}
          className="hover:opacity-95 transition-opacity"
        />
        {width > 65 && height > 45 && (
          <foreignObject x={x} y={y} width={width} height={height}>
            <div className="h-full w-full p-2.5 flex flex-col justify-between text-white overflow-hidden select-none pointer-events-none">
              <div>
                <div className="text-[11px] font-extrabold tracking-tight truncate" title={name}>
                  {name}
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-[11px] font-mono font-bold">
                  {formatIDR(spend)}
                </span>
                <span className="text-[10px] font-extrabold bg-white/25 px-1.5 py-0.5 rounded">
                  {percentage ? percentage.toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  // Top 10 Calculations from fullyFilteredRecords
  const topHospitalsValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const r of fullyFilteredRecords) {
      const h = r.hospitalCode || 'UNKNOWN';
      map.set(h, { name: h, value: (map.get(h)?.value || 0) + (Number(r.totalLineAmount) || 0) });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [fullyFilteredRecords]);

  const topHospitalsQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const r of fullyFilteredRecords) {
      const h = r.hospitalCode || 'UNKNOWN';
      map.set(h, { name: h, qty: (map.get(h)?.qty || 0) + (Number(r.purchQty) || 1) });
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [fullyFilteredRecords]);

  const topVendorsValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const r of fullyFilteredRecords) {
      const v = r.vendorName || 'UNKNOWN VENDOR';
      map.set(v, { name: v, value: (map.get(v)?.value || 0) + (Number(r.totalLineAmount) || 0) });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [fullyFilteredRecords]);

  const topVendorsQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const r of fullyFilteredRecords) {
      const v = r.vendorName || 'UNKNOWN VENDOR';
      map.set(v, { name: v, qty: (map.get(v)?.qty || 0) + (Number(r.purchQty) || 1) });
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [fullyFilteredRecords]);

  const topSkusValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const r of fullyFilteredRecords) {
      const s = r.itemName || 'UNKNOWN SKU';
      map.set(s, { name: s, value: (map.get(s)?.value || 0) + (Number(r.totalLineAmount) || 0) });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [fullyFilteredRecords]);

  const topSkusQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const r of fullyFilteredRecords) {
      const s = r.itemName || 'UNKNOWN SKU';
      map.set(s, { name: s, qty: (map.get(s)?.qty || 0) + (Number(r.purchQty) || 1) });
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [fullyFilteredRecords]);

  const topDepartmentsValue = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const r of fullyFilteredRecords) {
      const d = (r.department && r.department.trim()) ? r.department.trim() : 'Unassigned Dept';
      map.set(d, { name: d, value: (map.get(d)?.value || 0) + (Number(r.totalLineAmount) || 0) });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [fullyFilteredRecords]);

  const topDepartmentsQty = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const r of fullyFilteredRecords) {
      const d = (r.department && r.department.trim()) ? r.department.trim() : 'Unassigned Dept';
      map.set(d, { name: d, qty: (map.get(d)?.qty || 0) + (Number(r.purchQty) || 1) });
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [fullyFilteredRecords]);

  const handleResetAllFilters = () => {
    applyHeavyOperation(() => {
      setSelectedHospital(null);
      setSelectedVendor(null);
      setSelectedSku(null);
      setSelectedDepartment(null);
      setSelectedMonth(null);
      setSpendTypeFilter('all');
      setOrphanFilter('ALL');
      setCurrentLevel(1);
      setSelectedLv1(null);
      setSelectedLv2(null);
      setSelectedLv3(null);
      setSelectedLv4(null);
    }, 'Mereset seluruh filter taksonomi...');
  };

  const hasActiveFilters = Boolean(selectedHospital || selectedVendor || selectedSku || selectedDepartment || selectedMonth || spendTypeFilter !== 'all' || orphanFilter !== 'ALL' || currentLevel > 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Section Header & OPEX/CAPEX Filter & Active Filters Chip bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <FolderTree className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Interactive Taxonomy Tree Map & Multi-Chart Filter Engine</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Box area represents spend contribution. Click any block to drill down, or click bars in Top 10 charts and monthly timeline to filter transactions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            {/* Matching & Orphan Filter Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 pl-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Matching:</span>
              </span>
              <select
                value={orphanFilter}
                onChange={(e) => applyHeavyOperation(() => setOrphanFilter(e.target.value as any), `Memfilter status matching ${e.target.value}...`)}
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

            {/* OPEX / CAPEX Toggle */}
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => applyHeavyOperation(() => setSpendTypeFilter('all'), 'Menerapkan filter All Spend...')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  spendTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Spend
              </button>
              <button
                type="button"
                onClick={() => applyHeavyOperation(() => setSpendTypeFilter('CAPEX'), 'Menerapkan filter CAPEX Only...')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  spendTypeFilter === 'CAPEX' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                CAPEX Only
              </button>
              <button
                type="button"
                onClick={() => applyHeavyOperation(() => setSpendTypeFilter('OPEX'), 'Menerapkan filter OPEX Only...')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  spendTypeFilter === 'OPEX' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                OPEX Only
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {spendTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Type: {spendTypeFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSpendTypeFilter('all')} />
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
                <X className="w-3 h-3 cursor-pointer" onClick={() => setOrphanFilter('ALL')} />
              </span>
            )}
            {selectedHospital && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                Hospital: {selectedHospital}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedHospital(null)} />
              </span>
            )}
            {selectedVendor && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                Vendor: {selectedVendor}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedVendor(null)} />
              </span>
            )}
            {selectedSku && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                SKU: {selectedSku}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedSku(null)} />
              </span>
            )}
            {selectedDepartment && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Dept: {selectedDepartment}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedDepartment(null)} />
              </span>
            )}
            {selectedMonth && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                Month: {selectedMonth}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedMonth(null)} />
              </span>
            )}
            {currentLevel > 1 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                Taxonomy Lv {currentLevel}
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleBreadcrumbClick(1)} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Monthly Timeline Spend Filter Chart */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Timeline Spend Filter by Month</span>
            </h3>
            <p className="text-xs text-slate-500">Click any month bar below to filter transactions by month (Boolean combination)</p>
          </div>
          {selectedMonth && (
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Clear Month Filter ({selectedMonth})
            </button>
          )}
        </div>

        <div className="h-48 w-full">
          {!isReady ? (
            <div className="h-full w-full bg-slate-50/60 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium animate-pulse">Menyiapkan visualisasi timeline spend...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyTimelineData}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                onClick={(e: any) => {
                  if (e && e.activeLabel) {
                    const nextVal = e.activeLabel === selectedMonth ? null : e.activeLabel;
                    applyHeavyOperation(() => {
                      setSelectedMonth(nextVal);
                    }, `Memfilter transaksi bulan ${e.activeLabel}...`);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Total Spend']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Bar
                  dataKey="value"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tree Map Visual Container */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 relative min-h-[460px]">
        {/* Active Processing / Loading Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center rounded-2xl transition-all animate-in fade-in duration-150">
            <div className="flex items-center space-x-3 bg-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-200">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <p className="text-xs font-bold text-slate-900">{processingMessage}</p>
                <p className="text-[11px] text-slate-500">Mengkalkulasi agregasi data & memperbarui visualisasi...</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold border-b border-slate-100 pb-3">
          <button
            onClick={() => handleBreadcrumbClick(1)}
            className={`px-3 py-1 rounded-lg transition-colors ${
              currentLevel === 1 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Level 1: Category
          </button>
          {selectedLv1 && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => handleBreadcrumbClick(2)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  currentLevel === 2 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Lv2: {selectedLv1}
              </button>
            </>
          )}
          {selectedLv2 && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => handleBreadcrumbClick(3)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  currentLevel === 3 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Lv3: {selectedLv2}
              </button>
            </>
          )}
          {selectedLv3 && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => handleBreadcrumbClick(4)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  currentLevel === 4 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Lv4: {selectedLv3}
              </button>
            </>
          )}
          {selectedLv4 && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => handleBreadcrumbClick(5)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  currentLevel === 5 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Lv5: Item Name
              </button>
            </>
          )}
          {isProcessing ? (
            <span className="ml-auto inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Memproses Level {currentLevel}...</span>
            </span>
          ) : (
            <span className="ml-auto text-[11px] font-medium text-slate-400">
              Showing Taxonomy Level {currentLevel} ({treeMapNodes.length} blocks)
            </span>
          )}
        </div>

        {treeMapNodes.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No transaction records found for this drill-down level.
          </div>
        ) : !isReady ? (
          <div className="h-[420px] w-full bg-slate-50/60 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2">
            <span className="text-xs text-slate-400 font-medium animate-pulse">Menyiapkan visualisasi hierarki Taxonomy Tree Map...</span>
          </div>
        ) : (
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treeMapNodes}
                dataKey="size"
                stroke="#fff"
                content={<CustomizedTreemapContent />}
              >
                <Tooltip
                  formatter={(value: any, name: any, item: any) => [
                    `Rp ${Number(value).toLocaleString()} (${item?.payload?.percentage?.toFixed(1)}%)`,
                    item?.payload?.name || 'Spend'
                  ]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', color: '#0f172a' }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        )}

        {currentLevel < 5 && treeMapNodes.length > 0 && (
          <p className="text-[11px] text-slate-400 text-center italic mt-2">
            Tip: Click any category block above to drill down into the next taxonomy level. Box size reflects total spend contribution.
          </p>
        )}
      </div>

      {/* 6 Graphs Side-by-Side (Qty and Value Side-by-Side) */}
      <div className="space-y-4 relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-2xl pointer-events-none transition-all">
            <div className="flex items-center space-x-2 bg-white/95 px-4 py-2.5 rounded-xl shadow-md border border-slate-200 text-xs font-bold text-slate-700">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Sinkronisasi 8 grafik Top 10...</span>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Top 10 Rankings: Value & Quantity Side-by-Side (8 Graphs)</h3>
          <p className="text-xs text-slate-500">Click any bar to filter records by Hospital Unit, Vendor, SKU Item, or Department</p>
        </div>

        {!isReady ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs h-80 flex flex-col items-center justify-center space-y-2">
                <span className="text-xs text-slate-400 font-medium animate-pulse">Menyiapkan visualisasi Top 10 grafik #{i}...</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Hospitals by Spend (Value) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 Hospitals by Spend (Value)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by Hospital</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topHospitalsValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedHospital ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedHospital(nextVal);
                      }, `Memfilter RS ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={65} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Spend Value']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Hospitals by Quantity (Qty) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 Hospitals by Quantity (Qty)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by Hospital</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topHospitalsQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedHospital ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedHospital(nextVal);
                      }, `Memfilter RS ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={65} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Quantity']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Vendors by Spend (Value) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 Vendors by Spend (Value)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by Vendor</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVendorsValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedVendor ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedVendor(nextVal);
                      }, `Memfilter Vendor ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={80} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Spend Value']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="value" fill="#4f46e5" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Vendors by Quantity (Qty) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 Vendors by Quantity (Qty)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by Vendor</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVendorsQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedVendor ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedVendor(nextVal);
                      }, `Memfilter Vendor ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={80} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Quantity']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="qty" fill="#6366f1" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. SKUs by Spend (Value) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 SKUs by Spend (Value)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by SKU Item</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSkusValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 35, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedSku ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedSku(nextVal);
                      }, `Memfilter SKU ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Spend Value']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="value" fill="#0d9488" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. SKUs by Quantity (Qty) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 SKUs by Quantity (Qty)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by SKU Item</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSkusQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 35, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedSku ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedSku(nextVal);
                      }, `Memfilter SKU ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Quantity']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="qty" fill="#14b8a6" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7. Departments by Spend (Value) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 Departments by Spend (Value)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by Department</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDepartmentsValue}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 35, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedDepartment ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedDepartment(nextVal);
                      }, `Memfilter Departemen ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={95} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Spend Value']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="value" fill="#059669" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 8. Departments by Quantity (Qty) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 10 Departments by Quantity (Qty)</h4>
                <p className="text-[11px] text-slate-500">Click bar to filter by Department</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDepartmentsQty}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 35, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const nextVal = e.activeLabel === selectedDepartment ? null : e.activeLabel;
                      applyHeavyOperation(() => {
                        setSelectedDepartment(nextVal);
                      }, `Memfilter Departemen ${e.activeLabel}...`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={formatNumber} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={95} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Quantity']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="qty" fill="#10b981" radius={[0, 6, 6, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* SpendCube Transactions & SKU Matching Table (Filtered by Tree Map & Bar Chart Filters) */}
      <div className="pt-4">
        <SpendTable
          records={fullyFilteredRecords}
          skuMasters={skuMasters}
          onSelectRecord={onSelectRecord}
        />
      </div>
    </div>
  );
});
