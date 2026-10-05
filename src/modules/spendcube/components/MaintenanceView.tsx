import React, { useState, useMemo, useDeferredValue } from 'react';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  HospitalMasterRecord, 
  VendorMasterRecord, 
  UnmatchedItemSummary, 
  SuggestedSkuMatch,
  MaintenanceHealthStats,
  MaintenanceCacheData
} from '../../../core/types/spend';
import { spendService } from '../services/spendService';
import { 
  Wrench, 
  AlertTriangle, 
  Search, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Plus, 
  Layers, 
  Building2, 
  ChevronRight, 
  ChevronLeft,
  ExternalLink, 
  Tag, 
  ArrowRight, 
  Sparkles, 
  ShieldAlert, 
  FileSpreadsheet, 
  FileCheck, 
  HelpCircle, 
  X, 
  Filter, 
  SlidersHorizontal,
  Package,
  Eye,
  Check,
  CheckSquare,
  Square,
  TrendingUp,
  Cpu,
  Info,
  Calendar,
  DollarSign,
  Zap,
  Database,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MaintenanceViewProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  hospitalMasters: HospitalMasterRecord[];
  vendorMasters: VendorMasterRecord[];
  onRefreshData: () => Promise<void>;
  onSelectRecord?: (record: SpendRecord) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  records,
  skuMasters,
  hospitalMasters,
  vendorMasters,
  onRefreshData,
  onSelectRecord
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'unmatched' | 'health_sync' | 'bulk_mapper' | 'guide'>('unmatched');

  // Cached Maintenance Data state
  const [maintenanceCache, setMaintenanceCache] = useState<MaintenanceCacheData | null>(null);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);
  const [isCalculatingProgress, setIsCalculatingProgress] = useState(false);
  const [calcPct, setCalcPct] = useState(0);
  const [calcMessage, setCalcMessage] = useState('');

  // Pagination for Unmatched list
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Search & Filters for Unmatched Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrphanFilter, setSelectedOrphanFilter] = useState<'ALL' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedHospital, setSelectedHospital] = useState('ALL');
  const [selectedSpendRange, setSelectedSpendRange] = useState<'ALL' | 'OVER_100M' | 'OVER_500M' | 'UNDER_100M'>('ALL');
  const [sortBy, setSortBy] = useState<'spend_desc' | 'qty_desc' | 'tx_desc' | 'name_asc'>('spend_desc');

  // Selected items for bulk operations
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Modals & Action States
  const [mappingModalItem, setMappingModalItem] = useState<UnmatchedItemSummary | null>(null);
  const [selectedTargetSkuId, setSelectedTargetSkuId] = useState<string>('');
  const [skuSearchQuery, setSkuSearchQuery] = useState('');

  const [createSkuModalItem, setCreateSkuModalItem] = useState<UnmatchedItemSummary | null>(null);
  const [newSkuFormData, setNewSkuFormData] = useState<Partial<SkuMasterRecord>>({});

  const [viewTxModalItem, setViewTxModalItem] = useState<UnmatchedItemSummary | null>(null);

  // Re-sync progress state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncResult, setSyncResult] = useState<{ total: number; newlyMatched: number; totalMatched: number; matchRatePct: number } | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Bulk Category Mapper State
  const [bulkKeyword, setBulkKeyword] = useState('');
  const [bulkTargetLv1, setBulkTargetLv1] = useState('Medical & Hospital Supplies');
  const [bulkTargetLv2, setBulkTargetLv2] = useState('Consumables');
  const [bulkTargetLv3, setBulkTargetLv3] = useState('General Consumables');
  const [bulkTargetLv4, setBulkTargetLv4] = useState('Medical Consumables');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Fetch or retrieve cached maintenance data
  const loadMaintenanceData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsCalculatingProgress(true);
        setCalcPct(10);
        setCalcMessage('Mempersiapkan data...');
      } else {
        setIsLoadingMaintenance(true);
      }

      const data = await spendService.getMaintenanceData({
        forceRefresh,
        inMemoryData: {
          records,
          skus: skuMasters,
          hospitals: hospitalMasters,
          vendors: vendorMasters
        },
        onProgress: (pct, msg) => {
          setCalcPct(pct);
          setCalcMessage(msg);
        }
      });
      setMaintenanceCache(data);
    } catch (err) {
      console.error('Failed to load maintenance data', err);
    } finally {
      setIsLoadingMaintenance(false);
      setIsCalculatingProgress(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    loadMaintenanceData(false);
  }, [records.length, skuMasters.length, hospitalMasters.length, vendorMasters.length]);

  // Derived Unmatched list and Health stats from persistent cache (or fallback)
  const unmatchedList = useMemo(() => {
    if (maintenanceCache?.unmatchedList) return maintenanceCache.unmatchedList;
    return [];
  }, [maintenanceCache]);

  const healthStats = useMemo<MaintenanceHealthStats>(() => {
    if (maintenanceCache?.healthStats) return maintenanceCache.healthStats;
    return {
      totalTransactions: records.length,
      matchedTransactions: 0,
      unmatchedTransactions: records.length,
      transactionMatchRatePct: 0,
      totalSpendAmount: 0,
      matchedSpendAmount: 0,
      unmatchedSpendAmount: 0,
      spendMatchRatePct: 0,
      totalUniqueItemsInTx: 0,
      matchedUniqueItems: 0,
      unmatchedUniqueItems: 0,
      itemMatchRatePct: 0,
      totalMasterSkus: skuMasters.length,
      skusWithStandardPrice: 0,
      skusMissingStandardPrice: skuMasters.length,
      skusWithFullTaxonomy: 0,
      skusMissingTaxonomy: skuMasters.length,
      totalMasterHospitals: hospitalMasters.length,
      totalMasterVendors: vendorMasters.length
    };
  }, [maintenanceCache, records.length, skuMasters.length, hospitalMasters.length, vendorMasters.length]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, selectedOrphanFilter, selectedCategory, selectedHospital, selectedSpendRange, sortBy, pageSize]);

  // Orphan breakdown counts for quick status filtering
  const orphanStats = useMemo(() => {
    let partial = 0;
    let full = 0;
    let partialSpend = 0;
    let fullSpend = 0;
    for (const item of unmatchedList) {
      if (item.orphanStatus === 'PARTIAL_ORPHAN') {
        partial++;
        partialSpend += item.totalSpend;
      } else {
        full++;
        fullSpend += item.totalSpend;
      }
    }
    return { partial, full, partialSpend, fullSpend };
  }, [unmatchedList]);

  // Category & Hospital Filter Options
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    unmatchedList.forEach(item => {
      if (item.procurementCategory) set.add(item.procurementCategory);
    });
    return Array.from(set).sort();
  }, [unmatchedList]);

  const hospitalOptions = useMemo(() => {
    const set = new Set<string>();
    unmatchedList.forEach(item => {
      item.hospitals.forEach(h => {
        if (h.code) set.add(h.code);
      });
    });
    return Array.from(set).sort();
  }, [unmatchedList]);

  // Filtered and sorted unmatched items
  const filteredUnmatched = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();

    return unmatchedList.filter(item => {
      // Orphan classification filter
      if (selectedOrphanFilter === 'PARTIAL_ORPHAN') {
        if (item.orphanStatus !== 'PARTIAL_ORPHAN') return false;
      } else if (selectedOrphanFilter === 'FULL_ORPHAN') {
        if (item.orphanStatus !== 'FULL_ORPHAN') return false;
      }

      // Search
      if (q) {
        const nameMatch = item.itemName.toLowerCase().includes(q);
        const codeMatch = item.itemIds.some(id => id.toLowerCase().includes(q));
        const vendorMatch = item.vendors.some(v => v.name.toLowerCase().includes(q));
        const hospMatch = item.hospitals.some(h => h.code.toLowerCase().includes(q));
        const catMatch = item.procurementCategory.toLowerCase().includes(q);
        const commMatch = item.commodityItem?.toLowerCase().includes(q);
        const specMatch = item.generalSpec?.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !vendorMatch && !hospMatch && !catMatch && !commMatch && !specMatch) return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && item.procurementCategory !== selectedCategory) {
        return false;
      }

      // Hospital
      if (selectedHospital !== 'ALL') {
        const hasHosp = item.hospitals.some(h => h.code === selectedHospital);
        if (!hasHosp) return false;
      }

      // Spend range
      if (selectedSpendRange === 'OVER_100M' && item.totalSpend < 100_000_000) return false;
      if (selectedSpendRange === 'OVER_500M' && item.totalSpend < 500_000_000) return false;
      if (selectedSpendRange === 'UNDER_100M' && item.totalSpend >= 100_000_000) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'spend_desc') return b.totalSpend - a.totalSpend;
      if (sortBy === 'qty_desc') return b.totalQty - a.totalQty;
      if (sortBy === 'tx_desc') return b.transactionCount - a.transactionCount;
      if (sortBy === 'name_asc') return a.itemName.localeCompare(b.itemName);
      return 0;
    });
  }, [unmatchedList, deferredSearchQuery, selectedOrphanFilter, selectedCategory, selectedHospital, selectedSpendRange, sortBy]);

  // Paginated Items for High Rendering Performance
  const totalPages = Math.max(1, Math.ceil(filteredUnmatched.length / pageSize));
  const paginatedUnmatched = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUnmatched.slice(start, start + pageSize);
  }, [filteredUnmatched, currentPage, pageSize]);

  // Fast pre-indexed SKU cache for suggestions
  const skuIndex = useMemo(() => {
    return spendService.getSkuIndex(skuMasters);
  }, [skuMasters]);

  // Enrich only visible page items with smart SKU recommendations (< 1ms execution)
  const enrichedPaginatedUnmatched = useMemo(() => {
    return paginatedUnmatched.map(item => {
      if (item.suggestedMatches && item.suggestedMatches.length > 0) return item;
      const suggestions = spendService.getSuggestionsForItem(item.itemName, item.itemIds, skuIndex);
      return {
        ...item,
        suggestedMatches: suggestions
      };
    });
  }, [paginatedUnmatched, skuIndex]);

  // Filtered SKU list for mapping modal
  const filteredModalSkus = useMemo(() => {
    if (!skuSearchQuery.trim()) return skuMasters.slice(0, 25);
    const q = skuSearchQuery.toLowerCase();
    return skuMasters.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.productId && s.productId.toLowerCase().includes(q)) ||
      (s.brand && s.brand.toLowerCase().includes(q)) ||
      (s.purchCategoryLv1 && s.purchCategoryLv1.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [skuMasters, skuSearchQuery]);

  // Affected transactions for Detail Modal
  const affectedTransactions = useMemo(() => {
    if (!viewTxModalItem) return [];
    const targetName = viewTxModalItem.itemName.trim().toLowerCase();
    const targetIds = new Set(viewTxModalItem.itemIds.map(i => i.toLowerCase()));

    return records.filter(r => {
      const rName = (r.itemName || '').trim().toLowerCase();
      const rId = (r.itemId || '').trim().toLowerCase();
      return rName === targetName || (r.itemId && targetIds.has(rId));
    });
  }, [records, viewTxModalItem]);

  const formatIDR = (val: number) => {
    if (val >= 1_000_000_000) {
      return `Rp ${(val / 1_000_000_000).toFixed(2)} Miliar`;
    }
    if (val >= 1_000_000) {
      return `Rp ${(val / 1_000_000).toFixed(1)} Juta`;
    }
    return `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
  };

  const formatNumber = (num: number) => Number(num || 0).toLocaleString('id-ID');

  // --- Handlers ---

  // Export Unmatched Items to Excel Template
  const handleExportUnmatchedExcel = () => {
    const dataToExport = (selectedItemIds.size > 0 
      ? unmatchedList.filter(i => selectedItemIds.has(i.id))
      : unmatchedList);

    if (dataToExport.length === 0) {
      alert('Tidak ada data item unmatched untuk diekspor.');
      return;
    }

    // 1. Sheet 1: Template SKU Master Siap Upload
    const skuMasterRows = dataToExport.map((item, index) => {
      const cleanCode = item.itemIds[0] || `PRD-REV-${String(index + 1).padStart(4, '0')}`;
      const suggestions = (item.suggestedMatches && item.suggestedMatches.length > 0)
        ? item.suggestedMatches
        : spendService.getSuggestionsForItem(item.itemName, item.itemIds, skuIndex);
      const bestSuggestion = suggestions[0]?.sku;

      return {
        'Product ID': cleanCode,
        'Item Name': item.itemName,
        'Komoditas (Lv 5)': item.commodityItem || item.itemName,
        'Spesifikasi Umum': item.generalSpec || '',
        'Brand': item.brand || bestSuggestion?.brand || 'Generic',
        'Part Number': item.partNumber || '',
        'Status Orphan': item.orphanStatus === 'PARTIAL_ORPHAN' ? 'Partial Orphan' : 'Full Orphan',
        'Purch Category Lv1': bestSuggestion?.purchCategoryLv1 || item.procurementCategory || 'Medical & Hospital Supplies',
        'Purch Category Lv2': bestSuggestion?.purchCategoryLv2 || 'Consumables',
        'Purch Category Lv3': bestSuggestion?.purchCategoryLv3 || 'General Consumables',
        'Purch Category Lv4': bestSuggestion?.purchCategoryLv4 || 'Unassigned',
        'PR Item ID': cleanCode,
        'PR FA Category': '',
        'CPR Item ID': '',
        'CPR FA Category': '',
        'SP Item ID': '',
        'Unit of Measurement': item.purchUnits[0] || 'PCS',
        'Is Generic Product': 'TRUE',
        'Specification 1': item.generalSpec || '',
        'Specification 2': '',
        'Specification 3': '',
        'Standard Price': item.avgUnitPrice || 0,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
        'Catatan Transaksi SpendCube': `Total Belanja: Rp ${Math.round(item.totalSpend).toLocaleString('id-ID')} (${item.transactionCount} Transaksi, ${item.totalQty} Unit)`
      };
    });

    // 2. Sheet 2: Rekapitulasi Audit Item Transaksi
    const auditRows = dataToExport.map((item) => {
      const suggestions = (item.suggestedMatches && item.suggestedMatches.length > 0)
        ? item.suggestedMatches
        : spendService.getSuggestionsForItem(item.itemName, item.itemIds, skuIndex);
      const topMatch = suggestions[0];

      return {
        'Nama Item Transaksi': item.itemName,
        'Status Klasifikasi': item.orphanStatus === 'PARTIAL_ORPHAN' ? 'Partial Orphan (Komoditas Mirip)' : 'Full Orphan (Tidak Ada Kecocokan)',
        'Confidence Score (%)': item.orphanConfidenceScore || 0,
        'Alasan / Penjelasan': item.orphanExplanation || '-',
        'Komoditas Terdeteksi': item.commodityItem || item.itemName,
        'Spesifikasi Terdeteksi': item.generalSpec || '-',
        'Brand Terdeteksi': item.brand || '-',
        'Part Number Terdeteksi': item.partNumber || '-',
        'Kode Barang Asal': item.itemIds.join(', '),
        'Kategori Pengadaan': item.procurementCategory,
        'Total Transaksi PO': item.transactionCount,
        'Total Nilai Belanja (IDR)': item.totalSpend,
        'Total Kuantitas': item.totalQty,
        'Satuan Unit (UOM)': item.purchUnits.join(', '),
        'Rata-rata Harga Satuan': item.avgUnitPrice,
        'Harga Satuan Terendah': item.minUnitPrice,
        'Harga Satuan Tertinggi': item.maxUnitPrice,
        'Rumah Sakit Pemesan': item.hospitals.map(h => `${h.code} (${h.count}x)`).join('; '),
        'Vendor Pengirim': item.vendors.map(v => `${v.name} (${v.count}x)`).join('; '),
        'Contoh Nomor PO': item.samplePurchIds.join(', '),
        'Saran SKU Master Terdekat': topMatch?.sku ? `${topMatch.sku.productId} - ${topMatch.sku.name} (${topMatch.similarityScore}%)` : 'Belum Ada'
      };
    });

    // 3. Sheet 3: Panduan Pengisian & Kategori Referensi
    const guideRows = [
      { 'Langkah': '1', 'Instruksi': 'Review nama barang pada sheet "Template SKU Master". Lengkapi kolom Purch Category Lv1 s/d Lv4, Brand, dan Standard Price.' },
      { 'Langkah': '2', 'Instruksi': 'Pastikan kolom Product ID terisi dengan kode unik (atau gunakan kode default yang sudah digenerate).' },
      { 'Langkah': '3', 'Instruksi': 'Simpan file Excel ini di komputer Anda.' },
      { 'Langkah': '4', 'Instruksi': 'Buka menu "SKU Master & Catalog" di aplikasi SpendCube, lalu klik "Upload SKU Master File".' },
      { 'Langkah': '5', 'Instruksi': 'Kembali ke menu "Data Maintenance" dan klik "Sinkronisasi Ulang Semua Transaksi" agar seluruh transaksi lama terhubung otomatis.' }
    ];

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(skuMasterRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Template SKU Master Siap Upload');

    const ws2 = XLSX.utils.json_to_sheet(auditRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Detail Audit Item Unmatched');

    const ws3 = XLSX.utils.json_to_sheet(guideRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Panduan Upload Ulang');

    const fileName = `Review_Master_SKU_Unmatched_Items_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Export CSV
  const handleExportUnmatchedCsv = () => {
    const dataToExport = unmatchedList;
    const header = [
      'Item Name',
      'Komoditas Lv5',
      'Spesifikasi Umum',
      'Brand',
      'Part Number',
      'Orphan Status',
      'Confidence Score (%)',
      'Original Item IDs',
      'Procurement Category',
      'Transactions Count',
      'Total Spend IDR',
      'Total Qty',
      'Avg Unit Price',
      'Hospitals',
      'Top Vendors'
    ];
    const rows = dataToExport.map(i => [
      `"${i.itemName.replace(/"/g, '""')}"`,
      `"${(i.commodityItem || i.itemName).replace(/"/g, '""')}"`,
      `"${(i.generalSpec || '').replace(/"/g, '""')}"`,
      `"${(i.brand || '').replace(/"/g, '""')}"`,
      `"${(i.partNumber || '').replace(/"/g, '""')}"`,
      `"${i.orphanStatus === 'PARTIAL_ORPHAN' ? 'Partial Orphan' : 'Full Orphan'}"`,
      i.orphanConfidenceScore || 0,
      `"${i.itemIds.join('; ')}"`,
      `"${i.procurementCategory}"`,
      i.transactionCount,
      i.totalSpend,
      i.totalQty,
      i.avgUnitPrice,
      `"${i.hospitals.map(h => h.code).join(', ')}"`,
      `"${i.vendors.map(v => v.name).join(', ')}"`
    ]);

    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Unmatched_Items_SpendCube_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle Manual Mapping to existing SKU
  const handleConfirmMapping = async () => {
    if (!mappingModalItem || !selectedTargetSkuId) {
      alert('Silakan pilih salah satu Master SKU tujuan.');
      return;
    }

    try {
      const res = await spendService.manuallyMapItemToSku(mappingModalItem.itemName, selectedTargetSkuId);
      alert(`Berhasil memetakan "${mappingModalItem.itemName}" ke Master SKU! Sebanyak ${res.affectedCount} baris transaksi telah diperbarui.`);
      setMappingModalItem(null);
      setSelectedTargetSkuId('');
      await onRefreshData();
      await loadMaintenanceData(true);
    } catch (err: any) {
      alert(err.message || 'Gagal memetakan item.');
    }
  };

  // Handle Quick Create SKU Master
  const handleOpenCreateSkuModal = (item: UnmatchedItemSummary) => {
    const bestSuggestion = item.suggestedMatches[0]?.sku;
    setCreateSkuModalItem(item);
    setNewSkuFormData({
      productId: item.itemIds[0] || `PRD-${Math.floor(100000 + Math.random() * 900000)}`,
      name: item.itemName,
      purchCategoryLv1: bestSuggestion?.purchCategoryLv1 || item.procurementCategory || 'Medical & Hospital Supplies',
      purchCategoryLv2: bestSuggestion?.purchCategoryLv2 || 'Consumables',
      purchCategoryLv3: bestSuggestion?.purchCategoryLv3 || 'General Consumables',
      purchCategoryLv4: bestSuggestion?.purchCategoryLv4 || 'Unassigned Subcategory',
      unitOfMeasurement: item.purchUnits[0] || 'PCS',
      brand: bestSuggestion?.brand || 'Generic',
      standardPrice: item.avgUnitPrice || 0,
      isActive: true,
      isContract: false,
      isGenericProduct: true
    });
  };

  const handleSaveQuickSku = async () => {
    if (!createSkuModalItem || !newSkuFormData.name) {
      alert('Nama item wajib diisi.');
      return;
    }

    try {
      const res = await spendService.quickAddSkuFromUnmatched(newSkuFormData);
      alert(`Master SKU "${res.savedSku.name}" (${res.savedSku.productId}) berhasil dibuat dan ${res.affectedTransactions} baris transaksi telah ditautkan secara instan!`);
      setCreateSkuModalItem(null);
      await onRefreshData();
      await loadMaintenanceData(true);
    } catch (err: any) {
      alert(err.message || 'Gagal membuat Master SKU.');
    }
  };

  // Run Full Re-Sync
  const handleRunFullReSync = async () => {
    setIsSyncModalOpen(true);
    setIsSyncing(true);
    setSyncProgress(5);
    setSyncMessage('Menginisialisasi pencocokan master data...');
    setSyncResult(null);

    try {
      const res = await spendService.reconcileAllTransactionsWithSkuMasters((pct, msg) => {
        setSyncProgress(pct);
        setSyncMessage(msg);
      });
      setSyncResult(res);
      await onRefreshData();
      await loadMaintenanceData(true);
    } catch (err: any) {
      setSyncMessage(`Terjadi kesalahan: ${err.message || 'Gagal sinkronisasi'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Bulk category mapper
  const handleExecuteBulkCategory = async () => {
    if (!bulkKeyword.trim()) {
      alert('Masukkan kata kunci pencarian nama barang.');
      return;
    }

    const matchingItems = unmatchedList.filter(item => 
      item.itemName.toLowerCase().includes(bulkKeyword.toLowerCase().trim())
    );

    if (matchingItems.length === 0) {
      alert(`Tidak ditemukan item transaksi unmatched yang mengandung kata kunci "${bulkKeyword}".`);
      return;
    }

    if (!window.confirm(`Yakin ingin memperbarui klasifikasi taksonomi untuk ${matchingItems.length} kelompok item yang mengandung "${bulkKeyword}"?`)) {
      return;
    }

    try {
      const itemNames = matchingItems.map(m => m.itemName);
      const res = await spendService.bulkMapCategory(itemNames, {
        lv1: bulkTargetLv1,
        lv2: bulkTargetLv2,
        lv3: bulkTargetLv3,
        lv4: bulkTargetLv4
      });

      setBulkSuccessMsg(`Berhasil memperbarui ${res.affectedCount} baris transaksi untuk kata kunci "${bulkKeyword}" ke kategori "${bulkTargetLv1} > ${bulkTargetLv4}".`);
      setBulkKeyword('');
      await onRefreshData();
      await loadMaintenanceData(true);
      setTimeout(() => setBulkSuccessMsg(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan bulk re-mapping.');
    }
  };

  // Handle Quick Accept Suggestion for a single item
  const handleAcceptSuggestion = async (item: UnmatchedItemSummary, targetSkuId: string) => {
    if (!targetSkuId) {
      alert('ID Master SKU kandidat tidak valid.');
      return;
    }
    try {
      const res = await spendService.manuallyMapItemToSku(item.itemName, targetSkuId);
      alert(`Berhasil memetakan "${item.itemName}" ke Master SKU [${targetSkuId}]! Sebanyak ${res.affectedCount} baris transaksi telah diperbarui.`);
      await onRefreshData();
      await loadMaintenanceData(true);
    } catch (err: any) {
      alert(err.message || 'Gagal menerima saran mapping.');
    }
  };

  // Handle Bulk Accept Suggestions for selected items that have a candidate/suggestion
  const handleBulkAcceptSuggestions = async () => {
    const selectedList = enrichedPaginatedUnmatched.length > 0
      ? unmatchedList.filter(i => selectedItemIds.has(i.id))
      : [];
    const itemsWithCandidates = selectedList.filter(i => i.candidateSkuId || i.suggestedMatches?.[0]?.sku?.id);

    if (itemsWithCandidates.length === 0) {
      alert('Tidak ada item terpilih yang memiliki saran kandidat Master SKU.');
      return;
    }

    if (!window.confirm(`Konfirmasi: Petakan ${itemsWithCandidates.length} item yang dipilih ke Master SKU kandidat yang disarankan?`)) {
      return;
    }

    let totalAffected = 0;
    let successCount = 0;

    for (const item of itemsWithCandidates) {
      const targetId = item.candidateSkuId || item.suggestedMatches?.[0]?.sku?.id;
      if (!targetId) continue;
      try {
        const res = await spendService.manuallyMapItemToSku(item.itemName, targetId);
        totalAffected += res.affectedCount;
        successCount += 1;
      } catch (err) {
        console.error(`Gagal mapping item ${item.itemName}:`, err);
      }
    }

    alert(`Selesai! Sebanyak ${successCount} kelompok item (${totalAffected} baris transaksi) berhasil dipetakan ke Master SKU.`);
    setSelectedItemIds(new Set());
    await onRefreshData();
    await loadMaintenanceData(true);
  };

  // Checkbox toggle helpers
  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === filteredUnmatched.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredUnmatched.map(i => i.id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItemIds(next);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Data Maintenance & Master SKU Reconciliation
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {unmatchedList.length} Item Belum Terpetakan
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span>Cache DB Aktif</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Pusat pemeliharaan data pengadaan: identifikasi item transaksi yang belum memiliki kecocokan (*unmatched*) dengan Master SKU, unduh berkas template Excel untuk dilengkapi, dan lakukan sinkronisasi otomatis transaksi secara instan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              disabled={isCalculatingProgress || isLoadingMaintenance}
              onClick={() => loadMaintenanceData(true)}
              className="inline-flex items-center px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700 gap-1.5 disabled:opacity-60"
              title="Hitung ulang analisis master data dan perbarui cache database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCalculatingProgress ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isCalculatingProgress ? 'Menghitung...' : 'Hitung Ulang Analisis'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportUnmatchedExcel}
              className="inline-flex items-center px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm shadow-emerald-600/20 gap-2"
              title="Unduh template Excel berisi item unmatched yang siap diisi dan diupload ulang ke Master SKU"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template Excel Master SKU</span>
            </button>

            <button
              type="button"
              onClick={handleRunFullReSync}
              className="inline-flex items-center px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm shadow-blue-600/20 gap-2"
              title="Jalankan algoritma pencocokan ulang seluruh transaksi dengan Master SKU terkini"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sinkronisasi Ulang Transaksi</span>
            </button>
          </div>
        </div>

        {/* Database Cache Metadata Banner */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>
              Performa Dioptimalkan: Hasil analisis disimpan secara persisten di <strong>IndexedDB (maintenanceCache)</strong> sehingga berpindah halaman instan tanpa beban komputasi berulang.
            </span>
          </div>
          {maintenanceCache?.lastUpdated && (
            <div className="flex items-center gap-1.5 font-mono text-slate-400">
              <Clock className="w-3 h-3" />
              <span>Terakhir dihitung: {new Date(maintenanceCache.lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
        </div>

        {/* Active Non-Blocking Calculation Progress Banner */}
        {isCalculatingProgress && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1.5">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>{calcMessage || 'Menganalisis data transaksi & SKU Master...'}</span>
              </div>
              <span className="font-mono">{calcPct}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${calcPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick Tabs Bar */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('unmatched')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'unmatched'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Daftar Item Unmatched</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'unmatched' ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {unmatchedList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('health_sync')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'health_sync'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Kesehatan & Sinkronisasi Master Data</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'health_sync' ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {healthStats.transactionMatchRatePct.toFixed(1)}% Match
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bulk_mapper')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'bulk_mapper'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Pemetaan Kategori Massal (Bulk Mapper)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'guide'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Panduan Review & Upload Ulang</span>
          </button>
        </div>
      </div>

      {/* TAB 1: UNMATCHED ITEMS REVIEW & EXPORT */}
      {activeTab === 'unmatched' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Unmatched */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Item Unmatched</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatNumber(unmatchedList.length)}
                </span>
                <span className="text-xs text-slate-500 ml-1.5 font-medium">item unik</span>
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3" />
                Belum terhubung ke katalog Master SKU
              </p>
            </div>

            {/* Card 2: Partial Orphan */}
            <div 
              onClick={() => setSelectedOrphanFilter(prev => prev === 'PARTIAL_ORPHAN' ? 'ALL' : 'PARTIAL_ORPHAN')}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs cursor-pointer transition-all hover:border-amber-400 ${
                selectedOrphanFilter === 'PARTIAL_ORPHAN' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20' : 'border-slate-200 dark:border-slate-800'
              }`}
              title="Klik untuk filter Partial Orphan saja (Komoditas Lv 5 cocok, spec/brand berbeda)"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Partial Orphan (Komoditas)</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">
                    {formatNumber(orphanStats.partial)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1.5 font-medium">item ({unmatchedList.length > 0 ? Math.round((orphanStats.partial / unmatchedList.length) * 100) : 0}%)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                Belanja: <strong className="text-slate-700 dark:text-slate-300">{formatIDR(orphanStats.partialSpend)}</strong>
              </p>
            </div>

            {/* Card 3: Full Orphan */}
            <div 
              onClick={() => setSelectedOrphanFilter(prev => prev === 'FULL_ORPHAN' ? 'ALL' : 'FULL_ORPHAN')}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs cursor-pointer transition-all hover:border-rose-400 ${
                selectedOrphanFilter === 'FULL_ORPHAN' ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/20' : 'border-slate-200 dark:border-slate-800'
              }`}
              title="Klik untuk filter Full Orphan saja (Tidak ada kemiripan komoditas/spec)"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Full Orphan (No Match)</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                    {formatNumber(orphanStats.full)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1.5 font-medium">item ({unmatchedList.length > 0 ? Math.round((orphanStats.full / unmatchedList.length) * 100) : 0}%)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                Belanja: <strong className="text-slate-700 dark:text-slate-300">{formatIDR(orphanStats.fullSpend)}</strong>
              </p>
            </div>

            {/* Card 4: Nilai Belanja Total Unmatched */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nilai Belanja Unmatched</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatIDR(healthStats.unmatchedSpendAmount)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                {(100 - healthStats.spendMatchRatePct).toFixed(1)}% dari total belanja terdata
              </p>
            </div>
          </div>

          {/* Action Bar & Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama item, kode barang asal, vendor, atau rumah sakit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handleExportUnmatchedExcel}
                  className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors gap-1.5"
                  title="Ekspor template Excel lengkap dengan estimasi harga dan taksonomi"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ekspor Excel Template ({selectedItemIds.size > 0 ? `${selectedItemIds.size} Terpilih` : 'Semua'})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportUnmatchedCsv}
                  className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Sub-Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              {/* Orphan Status Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Status Orphan
                </label>
                <select
                  value={selectedOrphanFilter}
                  onChange={(e) => setSelectedOrphanFilter(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">Semua Status ({unmatchedList.length})</option>
                  <option value="PARTIAL_ORPHAN">Partial Orphan ({orphanStats.partial})</option>
                  <option value="FULL_ORPHAN">Full Orphan ({orphanStats.full})</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Kategori Pengadaan
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">Semua Kategori ({categoryOptions.length})</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Hospital Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Rumah Sakit Pemesan
                </label>
                <select
                  value={selectedHospital}
                  onChange={(e) => setSelectedHospital(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">Semua Unit RS ({hospitalOptions.length})</option>
                  {hospitalOptions.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Spend Range */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Besaran Nilai Belanja
                </label>
                <select
                  value={selectedSpendRange}
                  onChange={(e) => setSelectedSpendRange(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">Semua Nilai Belanja</option>
                  <option value="OVER_500M">&gt; Rp 500 Juta (High Spend)</option>
                  <option value="OVER_100M">&gt; Rp 100 Juta (Medium Spend)</option>
                  <option value="UNDER_100M">&lt; Rp 100 Juta (Low Spend)</option>
                </select>
              </div>

              {/* Sorting */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Urutkan Berdasarkan
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="spend_desc">Nilai Belanja Terbesar (Desc)</option>
                  <option value="qty_desc">Kuantitas Unit Terbanyak (Desc)</option>
                  <option value="tx_desc">Frekuensi PO Terbanyak (Desc)</option>
                  <option value="name_asc">Nama Barang (A &rarr; Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table / List of Unmatched Items */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Header info & Select All */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600"
                >
                  {selectedItemIds.size > 0 && selectedItemIds.size === filteredUnmatched.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Pilih Semua ({filteredUnmatched.length} Item Sesuai Filter)</span>
                </button>
                {selectedItemIds.size > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-[11px] font-bold">
                      {selectedItemIds.size} item dipilih
                    </span>
                    <button
                      type="button"
                      onClick={handleBulkAcceptSuggestions}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Petakan Massal Item Terpilih ke Saran Master SKU</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Menampilkan <strong>{paginatedUnmatched.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filteredUnmatched.length)}</strong> dari <strong>{filteredUnmatched.length}</strong> item
                </span>
                
                {/* Page Size Selector */}
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span>Per hal:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>

            {isLoadingMaintenance ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Memuat Data Maintenance...</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Membaca direktori Master SKU dan cache transaksi IndexedDB...
                </p>
              </div>
            ) : filteredUnmatched.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Tidak Ada Item Unmatched</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Semua item transaksi sesuai dengan kriteria filter saat ini telah terhubung dengan direktori Master SKU.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {enrichedPaginatedUnmatched.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const topSuggestion = item.suggestedMatches[0];

                  return (
                    <div 
                      key={item.id}
                      className={`p-5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Left Side: Checkbox & Item Details */}
                        <div className="flex items-start gap-3.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectItem(item.id)}
                            className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            )}
                          </button>

                          <div className="space-y-2 flex-1 min-w-0">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                                  {item.itemName}
                                </h3>

                                {/* Orphan Status Badge */}
                                {item.orphanStatus === 'PARTIAL_ORPHAN' ? (
                                  <span 
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1"
                                    title={item.orphanExplanation || 'Komoditas Level 5 terdeteksi mirip dengan master SKU'}
                                  >
                                    <Tag className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    <span>Partial Orphan</span>
                                    {item.orphanConfidenceScore ? <span className="text-[9px] font-extrabold text-amber-700 dark:text-amber-400">({item.orphanConfidenceScore}%)</span> : null}
                                  </span>
                                ) : (
                                  <span 
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                                    title={item.orphanExplanation || 'Tidak ditemukan kecocokan komponen komoditas atau spesifikasi'}
                                  >
                                    <ShieldAlert className="w-3 h-3 text-rose-500" />
                                    <span>Full Orphan</span>
                                  </span>
                                )}

                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {item.procurementCategory}
                                </span>
                                {item.itemIds.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    ID: {item.itemIds.join(', ')}
                                  </span>
                                )}
                              </div>

                              {/* Decomposed SKU Structure: [ItemKomoditas];[Spec umum];[Brand];[PartNumber] */}
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Komponen SKU:</span>
                                
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium">
                                  <span className="text-[9px] text-blue-500 font-bold uppercase">Lv5 Komoditas:</span>
                                  <strong className="font-mono">{item.commodityItem || item.itemName}</strong>
                                </span>

                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Spec:</span>
                                  <span className="font-mono">{item.generalSpec || '-'}</span>
                                </span>

                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Brand:</span>
                                  <span className="font-mono">{item.brand || '-'}</span>
                                </span>

                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Part#:</span>
                                  <span className="font-mono">{item.partNumber || '-'}</span>
                                </span>

                                {item.orphanExplanation && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-auto italic">
                                    {item.orphanExplanation}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Metrics Strip */}
                            <div className="flex items-center gap-4 text-xs flex-wrap">
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                                <span className="text-slate-400 font-normal">Total Belanja:</span>
                                <strong className="text-blue-600 dark:text-blue-400">{formatIDR(item.totalSpend)}</strong>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                <span>Vol:</span>
                                <strong className="font-semibold text-slate-800 dark:text-slate-200">{formatNumber(item.totalQty)} {item.purchUnits[0] || 'Unit'}</strong>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                <span>Rata-rata Harga:</span>
                                <strong className="font-semibold text-slate-800 dark:text-slate-200">{formatIDR(item.avgUnitPrice)}</strong>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                <span>Frekuensi:</span>
                                <strong className="font-semibold text-slate-800 dark:text-slate-200">{item.transactionCount} Transaksi</strong>
                              </div>
                            </div>

                            {/* Hospitals and Vendors */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="text-slate-400">RS Pemesan:</span>
                              {item.hospitals.slice(0, 5).map(h => (
                                <span key={h.code} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono">
                                  {h.code} ({h.count}x)
                                </span>
                              ))}
                              {item.hospitals.length > 5 && (
                                <span className="text-slate-400 text-[10px]">+{item.hospitals.length - 5} RS lainnya</span>
                              )}

                              <span className="text-slate-300 dark:text-slate-700">|</span>

                              <span className="text-slate-400">Vendor:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-xs">
                                {item.vendors[0]?.name || 'Tidak tercatat'}
                              </span>
                            </div>

                            {/* AI / Smart SKU Suggestion Strip (for PARTIAL_ORPHAN or items with suggestions) */}
                            {(() => {
                              const candSku = item.candidateSku || (item.candidateSkuId ? skuMasters.find(s => s.id === item.candidateSkuId || s.productId === item.candidateSkuId) : undefined);
                              const targetSku = candSku || topSuggestion?.sku;
                              const score = item.orphanConfidenceScore || topSuggestion?.similarityScore || 0;
                              const reason = item.candidateMatchReason || item.orphanExplanation;

                              if (!targetSku) return null;

                              return (
                                <div className="mt-2.5 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/90 dark:border-blue-800/80 flex items-center justify-between gap-3 flex-wrap">
                                  <div className="space-y-1 min-w-0 max-w-2xl">
                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                      <span className="text-slate-600 dark:text-slate-300 font-medium">Saran Master SKU:</span>
                                      <strong className="text-blue-900 dark:text-blue-200 font-bold truncate">
                                        [{targetSku.productId}] {targetSku.name}
                                      </strong>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-200/90 dark:bg-blue-900 text-blue-800 dark:text-blue-200 shrink-0">
                                        {score}% Match
                                      </span>
                                      {item.orphanStatus === 'PARTIAL_ORPHAN' && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                          Menunggu Konfirmasi
                                        </span>
                                      )}
                                    </div>
                                    {reason && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pl-6">
                                        {reason}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptSuggestion(item, targetSku.id)}
                                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                                      title="Terima saran ini dan petakan seluruh transaksi item ini langsung ke Master SKU kandidat"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Terima Saran</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMappingModalItem(item);
                                        setSelectedTargetSkuId(targetSku.id);
                                        setSkuSearchQuery(targetSku.name || '');
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                                      title="Buka dialog pencarian Master SKU untuk memilih SKU lain"
                                    >
                                      <span>Pilih Lainnya...</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Right Side: Quick Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 lg:flex-col lg:items-end">
                          <button
                            type="button"
                            onClick={() => {
                              setMappingModalItem(item);
                              setSelectedTargetSkuId(topSuggestion?.sku?.id || '');
                              setSkuSearchQuery(topSuggestion?.sku?.name || item.itemName);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <Tag className="w-3.5 h-3.5 text-blue-600" />
                            <span>Petakan ke Master SKU</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenCreateSkuModal(item)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Buat Master SKU Baru</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewTxModalItem(item)}
                            className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors flex items-center gap-1"
                            title="Lihat seluruh baris transaksi yang menggunakan nama barang ini"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat PO ({item.transactionCount})</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls Bar */}
            {filteredUnmatched.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs">
                <div className="text-slate-500 dark:text-slate-400">
                  Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredUnmatched.length} total item)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HEALTH & RE-SYNC */}
      {activeTab === 'health_sync' && (
        <div className="space-y-6">
          {/* Health Score Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Match Rate Transaksi</span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                  {healthStats.transactionMatchRatePct.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">terpetakan</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${healthStats.transactionMatchRatePct}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-slate-500 flex justify-between">
                <span>{formatNumber(healthStats.matchedTransactions)} Cocok</span>
                <span>{formatNumber(healthStats.unmatchedTransactions)} Unmatched</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Match Rate Nilai Belanja (IDR)</span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {healthStats.spendMatchRatePct.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">terpetakan</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${healthStats.spendMatchRatePct}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-slate-500 flex justify-between">
                <span>{formatIDR(healthStats.matchedSpendAmount)}</span>
                <span>{formatIDR(healthStats.unmatchedSpendAmount)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Kelengkapan Master SKU</span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {formatNumber(healthStats.totalMasterSkus)}
                </span>
                <span className="text-xs text-slate-500">total item master</span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Standard Price Lengkap:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{healthStats.skusWithStandardPrice} ({((healthStats.skusWithStandardPrice / Math.max(1, healthStats.totalMasterSkus)) * 100).toFixed(0)}%)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Taksonomi 5-Level Lengkap:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{healthStats.skusWithFullTaxonomy} ({((healthStats.skusWithFullTaxonomy / Math.max(1, healthStats.totalMasterSkus)) * 100).toFixed(0)}%)</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Master Re-sync Card */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-7 text-white shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-bold">Sinkronisasi & Rekonsiliasi Otomatis Transaksi</h3>
                </div>
                <p className="text-xs text-blue-200 max-w-2xl leading-relaxed">
                  Menjalankan kembali algoritma pencocokan O(1) Hash Map & Vector Embedding di seluruh {formatNumber(records.length)} baris transaksi transaksi IndexedDB menggunakan direktori Master SKU terkini.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunFullReSync}
                className="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-md transition-all shrink-0 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Jalankan Sinkronisasi Ulang Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BULK CATEGORY MAPPER */}
      {activeTab === 'bulk_mapper' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Pemetaan Taksonomi Massal Berdasarkan Kata Kunci (Bulk Taxonomy Mapper)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Petakan kelompok item transaksi unmatched yang memiliki pola kata kunci tertentu ke 4-Level Taksonomi standar secara massal.
            </p>
          </div>

          {bulkSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bulkSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* Input Keyword */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                1. Kata Kunci Nama Barang (Case-Insensitive)
              </label>
              <input
                type="text"
                placeholder="Contoh: Spuit, Infus, Handscoon, Masker, Catheter, USG..."
                value={bulkKeyword}
                onChange={(e) => setBulkKeyword(e.target.value)}
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Sistem akan mencari seluruh transaksi unmatched yang mengandung kata kunci ini.
              </p>
            </div>

            {/* Target Taxonomy */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                2. Taksonomi Tujuan (Level 1 s/d Level 4)
              </label>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Purch Category Lv1"
                  value={bulkTargetLv1}
                  onChange={(e) => setBulkTargetLv1(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Purch Category Lv2"
                  value={bulkTargetLv2}
                  onChange={(e) => setBulkTargetLv2(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Purch Category Lv3"
                  value={bulkTargetLv3}
                  onChange={(e) => setBulkTargetLv3(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Purch Category Lv4"
                  value={bulkTargetLv4}
                  onChange={(e) => setBulkTargetLv4(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExecuteBulkCategory}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Terapkan Pemetaan Massal</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: RECONCILIATION & RE-UPLOAD GUIDE */}
      {activeTab === 'guide' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Panduan Review Item Unmatched & Upload Ulang Master Data
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ikuti alur kerja berikut untuk me-review item yang belum terdaftar di Master SKU dan mengunggahnya kembali ke sistem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                1
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Unduh Template Excel</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Klik tombol <strong>"Unduh Template Excel Master SKU"</strong> pada tab Daftar Item Unmatched. Sistem akan menghasilkan file Excel berisi seluruh item yang belum terdaftar beserta estimasi harga dan saran kategori.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Review & Lengkapi Data</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Buka file Excel di Microsoft Excel / Google Sheets. Lengkapi kolom <code>Purch Category Lv1..Lv4</code>, <code>Brand</code>, <code>Standard Price</code>, dan <code>Unit of Measurement</code> sesuai standar katalog rumah sakit.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                3
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Upload & Sinkronisasi</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Buka menu <strong>"SKU Master & Catalog"</strong> &rarr; klik <strong>"Upload SKU Master File"</strong>. Setelah selesai, klik <strong>"Sinkronisasi Ulang Transaksi"</strong> di halaman Maintenance ini agar seluruh transaksi lama terhubung 100%!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: MAP TO EXISTING MASTER SKU */}
      {mappingModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Petakan Item ke Master SKU
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Item Transaksi: <strong className="text-blue-600">{mappingModalItem.itemName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMappingModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama master SKU, Product ID, atau Brand..."
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {filteredModalSkus.map((sku) => {
                  const isSelected = selectedTargetSkuId === sku.id;
                  return (
                    <div
                      key={sku.id}
                      onClick={() => setSelectedTargetSkuId(sku.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          [{sku.productId}] {sku.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {sku.unitOfMeasurement || 'PCS'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>{sku.purchCategoryLv1} &rarr; {sku.purchCategoryLv4 || 'Unassigned'}</span>
                        {sku.brand && <span>| Brand: {sku.brand}</span>}
                        {sku.standardPrice > 0 && <span>| Std: {formatIDR(sku.standardPrice)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setMappingModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmMapping}
                disabled={!selectedTargetSkuId}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
              >
                Tautkan & Perbarui Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK CREATE SKU MASTER */}
      {createSkuModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Buat Master SKU Baru dari Item Unmatched
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Item akan langsung ditambahkan ke Master SKU dan seluruh transaksi terkait akan ditautkan otomatis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateSkuModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Barang (SKU Name) *
                </label>
                <input
                  type="text"
                  value={newSkuFormData.name || ''}
                  onChange={(e) => setNewSkuFormData({ ...newSkuFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Product ID (Kode SKU)
                  </label>
                  <input
                    type="text"
                    value={newSkuFormData.productId || ''}
                    onChange={(e) => setNewSkuFormData({ ...newSkuFormData, productId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Satuan (UOM)
                  </label>
                  <input
                    type="text"
                    value={newSkuFormData.unitOfMeasurement || 'PCS'}
                    onChange={(e) => setNewSkuFormData({ ...newSkuFormData, unitOfMeasurement: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Purch Category Lv1
                  </label>
                  <input
                    type="text"
                    value={newSkuFormData.purchCategoryLv1 || ''}
                    onChange={(e) => setNewSkuFormData({ ...newSkuFormData, purchCategoryLv1: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Purch Category Lv4
                  </label>
                  <input
                    type="text"
                    value={newSkuFormData.purchCategoryLv4 || ''}
                    onChange={(e) => setNewSkuFormData({ ...newSkuFormData, purchCategoryLv4: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Standard Price (IDR)
                  </label>
                  <input
                    type="number"
                    value={newSkuFormData.standardPrice || 0}
                    onChange={(e) => setNewSkuFormData({ ...newSkuFormData, standardPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand / Merek
                  </label>
                  <input
                    type="text"
                    value={newSkuFormData.brand || 'Generic'}
                    onChange={(e) => setNewSkuFormData({ ...newSkuFormData, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setCreateSkuModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveQuickSku}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                Simpan & Tautkan ke Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW AFFECTED TRANSACTIONS */}
      {viewTxModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Daftar Transaksi PO untuk "{viewTxModalItem.itemName}"
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total {affectedTransactions.length} baris PO dengan akumulasi nilai belanja {formatIDR(viewTxModalItem.totalSpend)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewTxModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full min-w-[800px] text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500">
                    <tr>
                      <th className="p-3">Tanggal / Bulan</th>
                      <th className="p-3">No. PO (Purch ID)</th>
                      <th className="p-3">Rumah Sakit</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Harga Satuan</th>
                      <th className="p-3 text-right">Total Line Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {affectedTransactions.map((tx) => (
                      <tr 
                        key={tx.id}
                        onClick={() => onSelectRecord?.(tx)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                      >
                        <td className="p-3 font-mono text-[11px]">{tx.createdDate || tx.monthYear}</td>
                        <td className="p-3 font-mono font-semibold text-blue-600">{tx.purchId || '-'}</td>
                        <td className="p-3 font-semibold">{tx.hospitalCode}</td>
                        <td className="p-3 truncate max-w-xs">{tx.vendorName}</td>
                        <td className="p-3 text-right font-mono">{formatNumber(tx.purchQty)} {tx.purchUnit}</td>
                        <td className="p-3 text-right font-mono">{formatIDR(tx.purchPrice)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatIDR(tx.totalLineAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setViewTxModalItem(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SYNC PROGRESS MODAL */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 mx-auto flex items-center justify-center">
              {isSyncing ? (
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isSyncing ? 'Menyinkronkan Transaksi...' : 'Sinkronisasi Selesai!'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {syncMessage}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${isSyncing ? 'bg-blue-600' : 'bg-emerald-600'}`}
                style={{ width: `${syncProgress}%` }}
              />
            </div>

            {syncResult && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1.5 text-left border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Transaksi:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{formatNumber(syncResult.total)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Terpetakan (Matched):</span>
                  <strong className="text-emerald-600">{formatNumber(syncResult.totalMatched)} ({syncResult.matchRatePct.toFixed(1)}%)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Baru Berhasil Dicocokkan:</span>
                  <strong className="text-blue-600">+{formatNumber(syncResult.newlyMatched)}</strong>
                </div>
              </div>
            )}

            {!isSyncing && (
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs hover:bg-blue-700 transition-colors"
              >
                Selesai & Tutup
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
