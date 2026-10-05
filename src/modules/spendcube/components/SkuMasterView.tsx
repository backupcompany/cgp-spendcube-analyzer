import React, { useState, useRef, useMemo } from 'react';
import { SkuMasterRecord, SpendRecord, getFormattedSkuName } from '../../../core/types/spend';
import { vectorService } from '../services/vectorService';
import { Package, Upload, Search, ShieldCheck, CheckCircle2, Tag, Layers, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Filter, FolderTree, Database, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SkuMasterViewProps {
  skuMasters: SkuMasterRecord[];
  transactions: SpendRecord[];
  onUploadSkuMasters: (newSkus: SkuMasterRecord[], meta: { id: string; fileName: string; fileType: string; recordCount: number; replaceAll?: boolean }) => void;
  onResetSkuMasters: () => void;
  onDeduplicateSkuMasters?: () => Promise<void>;
}

export const SkuMasterView: React.FC<SkuMasterViewProps> = ({
  skuMasters,
  transactions,
  onUploadSkuMasters,
  onResetSkuMasters,
  onDeduplicateSkuMasters
}) => {
  const [search, setSearch] = useState('');
  const [selectedLv1, setSelectedLv1] = useState('ALL');
  const [selectedLv2, setSelectedLv2] = useState('ALL');
  const [selectedLv3, setSelectedLv3] = useState('ALL');
  const [selectedLv4, setSelectedLv4] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [isUploading, setIsUploading] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [uploadMode, setUploadMode] = useState<'upsert' | 'replace'>('upsert');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [vectorStats, setVectorStats] = useState<{ newlyGenerated: number; reusedFromCache: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const duplicateStats = useMemo(() => {
    const seen = new Set<string>();
    let dupCount = 0;
    for (const s of skuMasters) {
      const key = (s.productId || s.id || '').trim().toLowerCase();
      if (seen.has(key)) {
        dupCount++;
      } else {
        seen.add(key);
      }
    }
    return {
      total: skuMasters.length,
      unique: seen.size,
      duplicates: dupCount
    };
  }, [skuMasters]);

  const handleDeduplicate = async () => {
    if (!onDeduplicateSkuMasters) return;
    setIsDeduplicating(true);
    try {
      await onDeduplicateSkuMasters();
    } catch (err: any) {
      console.error('Deduplication failed:', err);
      setUploadError('Gagal melakukan deduplikasi: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeduplicating(false);
    }
  };

  const vectorInfo = useMemo(() => {
    return vectorService.getVectorStats(skuMasters);
  }, [skuMasters]);

  const handleBuildVectorDatabase = () => {
    const stats = vectorService.indexSkuMasters(skuMasters);
    setVectorStats(stats);
  };

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString()}`;

  // Unique Taxonomy Options for Drill-Down
  const lv1Options = useMemo(() => {
    const set = new Set<string>();
    skuMasters.forEach(s => { if (s.purchCategoryLv1) set.add(s.purchCategoryLv1); });
    return Array.from(set).sort();
  }, [skuMasters]);

  const lv2Options = useMemo(() => {
    const set = new Set<string>();
    skuMasters.forEach(s => {
      if (selectedLv1 === 'ALL' || s.purchCategoryLv1 === selectedLv1) {
        if (s.purchCategoryLv2) set.add(s.purchCategoryLv2);
      }
    });
    return Array.from(set).sort();
  }, [skuMasters, selectedLv1]);

  const lv3Options = useMemo(() => {
    const set = new Set<string>();
    skuMasters.forEach(s => {
      if (
        (selectedLv1 === 'ALL' || s.purchCategoryLv1 === selectedLv1) &&
        (selectedLv2 === 'ALL' || s.purchCategoryLv2 === selectedLv2)
      ) {
        if (s.purchCategoryLv3) set.add(s.purchCategoryLv3);
      }
    });
    return Array.from(set).sort();
  }, [skuMasters, selectedLv1, selectedLv2]);

  const lv4Options = useMemo(() => {
    const set = new Set<string>();
    skuMasters.forEach(s => {
      if (
        (selectedLv1 === 'ALL' || s.purchCategoryLv1 === selectedLv1) &&
        (selectedLv2 === 'ALL' || s.purchCategoryLv2 === selectedLv2) &&
        (selectedLv3 === 'ALL' || s.purchCategoryLv3 === selectedLv3)
      ) {
        if (s.purchCategoryLv4) set.add(s.purchCategoryLv4);
      }
    });
    return Array.from(set).sort();
  }, [skuMasters, selectedLv1, selectedLv2, selectedLv3]);

  // Filtered SKUs based on search and taxonomy drill-down
  const filteredSkus = useMemo(() => {
    return skuMasters.filter(s => {
      if (selectedLv1 !== 'ALL' && s.purchCategoryLv1 !== selectedLv1) return false;
      if (selectedLv2 !== 'ALL' && s.purchCategoryLv2 !== selectedLv2) return false;
      if (selectedLv3 !== 'ALL' && s.purchCategoryLv3 !== selectedLv3) return false;
      if (selectedLv4 !== 'ALL' && s.purchCategoryLv4 !== selectedLv4) return false;

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.productId && s.productId.toLowerCase().includes(q)) ||
        (s.brand && s.brand.toLowerCase().includes(q)) ||
        (s.partNumber && s.partNumber.toLowerCase().includes(q)) ||
        (s.formattedSkuName && s.formattedSkuName.toLowerCase().includes(q))
      );
    });
  }, [skuMasters, search, selectedLv1, selectedLv2, selectedLv3, selectedLv4]);

  const totalPages = Math.ceil(filteredSkus.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentSkus = filteredSkus.slice(startIndex, startIndex + pageSize);

  const handleResetFilters = () => {
    setSelectedLv1('ALL');
    setSelectedLv2('ALL');
    setSelectedLv3('ALL');
    setSelectedLv4('ALL');
    setSearch('');
    setCurrentPage(1);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError(null);
    setIsUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (!json || json.length === 0) {
        throw new Error('Uploaded file contains no rows or valid headers.');
      }

      const parsedSkus: SkuMasterRecord[] = json.map((row, index) => {
        const name = row['Name'] || row['Item Name'] || row['NAME'] || 'UNNAMED SKU';
        const rawPid = row['Product ID'] || row['ProductId'] || row['PRODUCT_ID'] || row['Item ID'] || row['ItemId'] || row['ITEM_ID'];
        const productId = String(rawPid || `SKU-${Date.now()}-${index}`).trim();
        const brand = row['Brand'] || row['BRAND'] || 'GENERIC';
        const spec1 = row['Specification 1'] || row['Specification1'] || '-';
        const spec2 = row['Specification 2'] || row['Specification2'] || '-';
        const spec3 = row['Specification 3'] || row['Specification3'] || '-';
        const partNumber = row['Part Number'] || row['PartNumber'] || row['PART_NUMBER'] || 'NP';

        // Deterministic ID based on Product ID so it acts as true unique primary key
        const safeIdKey = productId.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
        const skuRecord: SkuMasterRecord = {
          id: `sku-${safeIdKey}`,
          productId,
          name,
          purchCategoryLv1: row['Purch Category Lv 1'] || row['PurchCategoryLv1'] || 'GENERAL',
          purchCategoryLv2: row['Purch Category Lv 2'] || row['PurchCategoryLv2'] || 'SUPPLIES',
          purchCategoryLv3: row['Purch Category Lv 3'] || row['PurchCategoryLv3'] || '-',
          purchCategoryLv4: row['Purch Category Lv 4'] || row['PurchCategoryLv4'] || '-',
          prItemId: String(row['PR Item Id'] || row['PRItemId'] || ''),
          prFaCategory: row['PR Fa Category'] || row['PRFaCategory'] || '',
          cprItemId: String(row['CPR Item Id'] || row['CPRItemId'] || ''),
          cprFaCategory: row['CPR Fa Category'] || row['CPRFaCategory'] || '',
          spItemId: String(row['Sp Item Id'] || row['SpItemId'] || ''),
          unitOfMeasurement: row['Unit of Measurement'] || row['UnitOfMeasurement'] || row['UOM'] || 'pcs',
          isGenericProduct: String(row['Is Generic Product'] || '').toLowerCase() === 'true' || row['Is Generic Product'] === true,
          brand,
          specification1: spec1,
          specification2: spec2,
          specification3: spec3,
          partNumber,
          standardPrice: Number(row['Standard Price'] || row['StandardPrice'] || 0),
          isActive: true,
          isContract: String(row['Is Contract'] || '').toLowerCase() === 'true' || row['Is Contract'] === true
        };

        skuRecord.formattedSkuName = getFormattedSkuName(skuRecord);
        return skuRecord;
      });

      // Deduplicate in-file if Excel contains duplicate rows for the same Product ID
      const inMap = new Map<string, SkuMasterRecord>();
      for (const s of parsedSkus) {
        const key = s.productId.toLowerCase().trim();
        const existing = inMap.get(key);
        if (!existing) {
          inMap.set(key, s);
        } else {
          if (existing.standardPrice <= 1 && s.standardPrice > 1) {
            inMap.set(key, s);
          }
        }
      }
      const newSkus = Array.from(inMap.values());

      onUploadSkuMasters(newSkus, {
        id: `batch-sku-${Date.now()}`,
        fileName: file.name,
        fileType: 'SKU Master Data',
        recordCount: newSkus.length,
        replaceAll: uploadMode === 'replace'
      });

    } catch (err: any) {
      console.error('Failed to parse SKU Master file:', err);
      setUploadError(err.message || 'Failed to parse Excel file. Please ensure columns match SKU Master format.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">SKU Master & Item Catalog</h2>
          <p className="text-xs text-slate-500">
            Unified item master with 5-Level Taxonomy (<code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded font-mono">Lv1 &rarr; Lv2 &rarr; Lv3 &rarr; Lv4 &rarr; Lv5</code>) & Syntax Formatting.
          </p>
        </div>
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <button
            type="button"
            onClick={handleBuildVectorDatabase}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all gap-1.5 shadow-xs"
            title="Generate or update vector embeddings for all uploaded SKU Masters"
          >
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>Generate / Update Vector DB</span>
          </button>

          {onDeduplicateSkuMasters && (
            <button
              type="button"
              onClick={handleDeduplicate}
              disabled={isDeduplicating}
              className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors gap-1.5 shadow-xs"
              title="Bersihkan data master SKU yang memiliki Product ID ganda"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {isDeduplicating
                  ? 'Membersihkan...'
                  : duplicateStats.duplicates > 0
                  ? `Deduplikasi (${duplicateStats.duplicates.toLocaleString()})`
                  : 'Deduplikasi SKU'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onResetSkuMasters}
            className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors gap-1.5"
            title="Reset to default sample SKUs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Sample SKUs</span>
          </button>

          {/* Upload Mode Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-normal">Mode:</span>
            <select
              value={uploadMode}
              onChange={(e) => setUploadMode(e.target.value as 'upsert' | 'replace')}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              title="Pilih mode upload: Upsert (Perbarui/Gabung) atau Replace All (Ganti Semua)"
            >
              <option value="upsert">Upsert (Perbarui & Gabung)</option>
              <option value="replace">Replace All (Ganti Semua)</option>
            </select>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'Uploading & Formatting...' : 'Upload SKU Master File'}</span>
          </button>
        </div>
      </div>

      {/* Duplicate Warning Banner */}
      {duplicateStats.duplicates > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs shadow-xs">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block text-amber-950">Terdeteksi {duplicateStats.duplicates.toLocaleString()} Data Duplikat pada Master SKU</span>
              <span className="text-amber-800 text-[11px]">
                Terdapat {duplicateStats.duplicates.toLocaleString()} baris berulang dari total {duplicateStats.total.toLocaleString()} record ({duplicateStats.unique.toLocaleString()} SKU unik). Melakukan deduplikasi akan menghapus data ganda, meringankan memori browser, dan mempercepat kalkulasi sistem.
              </span>
            </div>
          </div>
          {onDeduplicateSkuMasters && (
            <button
              type="button"
              onClick={handleDeduplicate}
              disabled={isDeduplicating}
              className="inline-flex items-center px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors shrink-0 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isDeduplicating ? 'Sedang Membersihkan...' : 'Bersihkan & Deduplikasi Sekarang'}</span>
            </button>
          )}
        </div>
      )}

      {uploadError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {vectorStats && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 text-xs shadow-xs">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold block">Vector Database Generated / Updated Successfully</span>
              <span className="text-emerald-700 font-mono">
                {vectorStats.newlyGenerated} newly vectorized SKUs | ⚡ {vectorStats.reusedFromCache} reused from cache (0 Token API Cost)
              </span>
            </div>
          </div>
          <button
            onClick={() => setVectorStats(null)}
            className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Catalog SKUs</span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1">
              {duplicateStats.unique.toLocaleString()}
              {duplicateStats.duplicates > 0 && (
                <span className="text-[11px] font-medium text-amber-600 ml-1.5" title="Total baris belum terdeduplikasi">
                  ({duplicateStats.total.toLocaleString()} raw)
                </span>
              )}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Status</span>
            <h3 className="text-xl font-extrabold text-emerald-600 mt-1">
              {skuMasters.filter(s => s.isActive).length} SKUs
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contracted Items</span>
            <h3 className="text-xl font-extrabold text-indigo-600 mt-1">
              {skuMasters.filter(s => s.isContract).length} SKUs
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unique Brands</span>
            <h3 className="text-xl font-extrabold text-blue-600 mt-1">
              {new Set(skuMasters.map(s => s.brand)).size}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between border-l-4 border-l-purple-500">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vector DB Indexed</span>
            <h3 className="text-xl font-extrabold text-purple-700 mt-1">
              {vectorInfo.vectorizedCount} <span className="text-xs font-normal">({vectorInfo.percentage.toFixed(0)}%)</span>
            </h3>
            <span className="text-[10px] text-slate-500 block mt-0.5">4-Part Cached</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Taxonomy Drill-Down Panel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <FolderTree className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Taxonomy Drill-Down Hierarchy (Lv 1 to Lv 4)</h3>
          </div>
          {(selectedLv1 !== 'ALL' || selectedLv2 !== 'ALL' || selectedLv3 !== 'ALL' || selectedLv4 !== 'ALL' || search) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Level 1 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purch Category Lv 1</label>
            <select
              value={selectedLv1}
              onChange={(e) => {
                setSelectedLv1(e.target.value);
                setSelectedLv2('ALL');
                setSelectedLv3('ALL');
                setSelectedLv4('ALL');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Level 1 Categories</option>
              {lv1Options.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Level 2 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purch Category Lv 2</label>
            <select
              value={selectedLv2}
              onChange={(e) => {
                setSelectedLv2(e.target.value);
                setSelectedLv3('ALL');
                setSelectedLv4('ALL');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Level 2 Categories</option>
              {lv2Options.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Level 3 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purch Category Lv 3</label>
            <select
              value={selectedLv3}
              onChange={(e) => {
                setSelectedLv3(e.target.value);
                setSelectedLv4('ALL');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Level 3 Categories</option>
              {lv3Options.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Level 4 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purch Category Lv 4</label>
            <select
              value={selectedLv4}
              onChange={(e) => {
                setSelectedLv4(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Level 4 Categories</option>
              {lv4Options.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search within drill-down (Product ID, Name, Brand, Part Number)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* SKU Table with Formatted Item Name & Taxonomy Lv 5 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">SKU Master & Taxonomy Drill-Down Results</h3>
            <p className="text-[11px] text-slate-500">Showing {filteredSkus.length} matched items across taxonomy hierarchy (Lv 1 - Lv 5)</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-slate-600">Auto-Formatted Syntax (Lv 5)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Product ID & Brand</th>
                <th className="py-3 px-4">Item Name (Taxonomy Lv 5)</th>
                <th className="py-3 px-4">Taxonomy Hierarchy (Lv 1 - 4)</th>
                <th className="py-3 px-4">Standardized Format Name</th>
                <th className="py-3 px-4 text-right">Standard Price</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {currentSkus.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No SKU master records found matching your taxonomy drill-down criteria.
                  </td>
                </tr>
              ) : (
                currentSkus.map((sku) => {
                  const formattedName = sku.formattedSkuName || getFormattedSkuName(sku);
                  return (
                    <tr key={sku.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">{sku.productId}</div>
                        <div className="text-[10px] text-blue-600 font-semibold">{sku.brand || 'GENERIC'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900" title={sku.name}>{sku.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Part: {sku.partNumber} | UoM: {sku.unitOfMeasurement}</div>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <div className="font-semibold text-slate-800">{sku.purchCategoryLv1}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={`${sku.purchCategoryLv2} > ${sku.purchCategoryLv3}`}>
                          {sku.purchCategoryLv2} &gt; {sku.purchCategoryLv3}
                        </div>
                        <div className="text-[10px] text-blue-600 font-medium">Lv4: {sku.purchCategoryLv4 || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="bg-slate-900 text-slate-100 px-3 py-1.5 rounded-xl font-mono text-[10px] tracking-tight max-w-xs truncate shadow-xs" title={formattedName}>
                          {formattedName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatIDR(sku.standardPrice)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {sku.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          )}
                          {sku.isContract && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-indigo-50 text-indigo-700">
                              Contract
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredSkus.length > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + pageSize, filteredSkus.length)} of {filteredSkus.length} SKUs
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
