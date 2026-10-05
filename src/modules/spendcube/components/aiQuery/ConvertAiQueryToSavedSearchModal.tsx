import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookmarkCheck, 
  BookmarkPlus, 
  X, 
  PlusCircle, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Check,
  Package,
  Building2,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Tag,
  ShieldCheck,
  ListFilter
} from 'lucide-react';
import { 
  SpendRecord, 
  SkuMasterRecord, 
  SavedGoogleSkuSearchItem, 
  SavedGoogleSkuSearchPreset 
} from '../../../../core/types/spend';
import { 
  extractSkuItemsFromRecords, 
  calculatePresetAppendStats, 
  mergeItemsIntoSavedPreset 
} from '../../services/skuExtractionService';
import { 
  getAllSavedSkuSearchPresets, 
  saveSavedSkuSearchPreset 
} from '../../../../core/db/db';

interface ConvertAiQueryToSavedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  matchedRecords: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  onNavigateToCatalogue?: () => void;
  onSuccess?: (preset: SavedGoogleSkuSearchPreset, mode: 'new' | 'append') => void;
}

export const ConvertAiQueryToSavedSearchModal: React.FC<ConvertAiQueryToSavedSearchModalProps> = ({
  isOpen,
  onClose,
  query,
  matchedRecords = [],
  skuMasters = [],
  onNavigateToCatalogue,
  onSuccess
}) => {
  // Existing presets from IndexedDB
  const [existingPresets, setExistingPresets] = useState<SavedGoogleSkuSearchPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  // Save Mode: 'new' vs 'append'
  const [saveMode, setSaveMode] = useState<'new' | 'append'>('new');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedTargetPresetId, setSelectedTargetPresetId] = useState<string>('');

  // Extracted SKU items from matchedRecords
  const extractedSkus = useMemo(() => {
    return extractSkuItemsFromRecords(matchedRecords, skuMasters);
  }, [matchedRecords, skuMasters]);

  // SKU Selection states: all selected by default
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [skuSearchFilter, setSkuSearchFilter] = useState('');

  // Processing & Success states
  const [isSaving, setIsSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<{
    preset: SavedGoogleSkuSearchPreset;
    mode: 'new' | 'append';
    addedCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing saved search presets on open
  useEffect(() => {
    if (isOpen) {
      setLoadingPresets(true);
      setSavedResult(null);
      setErrorMessage(null);
      setSkuSearchFilter('');
      
      const cleanTitle = query.trim() 
        ? `Kueri AI: ${query.slice(0, 50).trim()}${query.length > 50 ? '...' : ''}`
        : `Koleksi SKU dari AI Query (${new Date().toLocaleDateString('id-ID')})`;
      setNewTitle(cleanTitle);
      setNewDescription(`Koleksi SKU yang diekstraksi dari kueri AI Hub: "${query}"`);

      getAllSavedSkuSearchPresets().then(list => {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setExistingPresets(list);
        if (list.length > 0) {
          setSelectedTargetPresetId(list[0].id);
        } else {
          setSaveMode('new');
        }
      }).catch(err => {
        console.error('Failed to load saved SKU searches:', err);
      }).finally(() => {
        setLoadingPresets(false);
      });
    }
  }, [isOpen, query]);

  // Initialize selected product IDs with all extracted SKUs
  useEffect(() => {
    if (isOpen && extractedSkus.length > 0) {
      setSelectedProductIds(new Set(extractedSkus.map(s => s.productId)));
    }
  }, [isOpen, extractedSkus]);

  if (!isOpen) return null;

  // Filtered SKUs for the table display
  const displayedSkus = useMemo(() => {
    if (!skuSearchFilter.trim()) return extractedSkus;
    const q = skuSearchFilter.toLowerCase().trim();
    return extractedSkus.filter(s => 
      s.commodityItem.toLowerCase().includes(q) ||
      s.brand.toLowerCase().includes(q) ||
      s.partNumber.toLowerCase().includes(q) ||
      s.specLine.toLowerCase().includes(q) ||
      s.productId.toLowerCase().includes(q) ||
      s.purchCategoryLv1.toLowerCase().includes(q)
    );
  }, [extractedSkus, skuSearchFilter]);

  // Selected items objects
  const selectedSkuItems = useMemo(() => {
    return extractedSkus.filter(s => selectedProductIds.has(s.productId));
  }, [extractedSkus, selectedProductIds]);

  // Selection toggle handlers
  const isAllDisplayedSelected = displayedSkus.length > 0 && displayedSkus.every(s => selectedProductIds.has(s.productId));

  const handleToggleSelectAll = () => {
    const next = new Set(selectedProductIds);
    if (isAllDisplayedSelected) {
      for (const s of displayedSkus) {
        next.delete(s.productId);
      }
    } else {
      for (const s of displayedSkus) {
        next.add(s.productId);
      }
    }
    setSelectedProductIds(next);
  };

  const handleToggleSku = (productId: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setSelectedProductIds(next);
  };

  // Selected Target Preset for Append mode
  const targetPreset = existingPresets.find(p => p.id === selectedTargetPresetId);

  // Append Deduplication stats
  const appendStats = useMemo(() => {
    if (saveMode !== 'append' || !targetPreset) return null;
    return calculatePresetAppendStats(targetPreset, selectedSkuItems);
  }, [saveMode, targetPreset, selectedSkuItems]);

  // Total summary of selected items
  const totalSelectedSpend = selectedSkuItems.reduce((acc, it) => acc + (it.totalSpend || 0), 0);
  const totalSelectedTx = selectedSkuItems.reduce((acc, it) => acc + (it.transactionCount || 0), 0);

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  // Execute Save
  const handleSave = async () => {
    setErrorMessage(null);

    if (selectedSkuItems.length === 0) {
      setErrorMessage('Pilih minimal 1 item / SKU untuk disimpan.');
      return;
    }

    try {
      setIsSaving(true);

      if (saveMode === 'new') {
        if (!newTitle.trim()) {
          setErrorMessage('Nama Saved Search wajib diisi.');
          setIsSaving(false);
          return;
        }

        const newPreset: SavedGoogleSkuSearchPreset = {
          id: `sku-preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          searchQuery: query || '',
          selectedCategory: 'All',
          selectedItems: selectedSkuItems,
          selectedProductIds: selectedSkuItems.map(it => it.productId),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await saveSavedSkuSearchPreset(newPreset);
        setSavedResult({
          preset: newPreset,
          mode: 'new',
          addedCount: selectedSkuItems.length
        });
        if (onSuccess) onSuccess(newPreset, 'new');
      } else {
        // Append mode
        if (!targetPreset) {
          setErrorMessage('Pilih Saved Search tujuan yang ingin ditambahkan.');
          setIsSaving(false);
          return;
        }

        const updatedPreset = mergeItemsIntoSavedPreset(targetPreset, selectedSkuItems);
        await saveSavedSkuSearchPreset(updatedPreset);

        const newCount = appendStats?.newUniqueCount || 0;
        setSavedResult({
          preset: updatedPreset,
          mode: 'append',
          addedCount: newCount
        });
        if (onSuccess) onSuccess(updatedPreset, 'append');
      }
    } catch (err: any) {
      console.error('Error saving SKU search from AI query:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan ke IndexedDB.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 shadow-sm">
              <BookmarkPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                  AI Query to Saved Search
                </span>
                <span className="text-xs text-blue-200/80">• e-Catalogue SKU Search</span>
              </div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Convert Hasil Kueri AI ke Saved Search
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {/* SUCCESS SCREEN */}
          {savedResult ? (
            <div className="py-8 px-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="text-xl font-extrabold text-slate-900">
                  {savedResult.mode === 'new' 
                    ? 'Saved Search Baru Berhasil Dibuat!' 
                    : 'SKU Berhasil Ditambahkan ke Koleksi!'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Koleksi <span className="font-bold text-slate-900">"{savedResult.preset.title}"</span> kini memuat <span className="font-bold text-blue-600">{savedResult.preset.selectedProductIds?.length || 0} SKU</span>. Data telah persisten di IndexedDB dan langsung siap ditelusuri di modul e-Catalogue SKU Search.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-lg mx-auto flex items-center justify-between text-xs">
                <div className="text-left">
                  <span className="text-slate-500 block text-[11px]">Nama Koleksi:</span>
                  <span className="font-bold text-slate-800 truncate block max-w-[220px]">{savedResult.preset.title}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Total SKU Tersimpan:</span>
                  <span className="font-extrabold font-mono text-emerald-600 text-sm">
                    {savedResult.preset.selectedProductIds?.length || 0} SKU
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
                >
                  Selesai & Tetap di AI Hub
                </button>
                {onNavigateToCatalogue && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToCatalogue();
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <span>Buka di e-Catalogue SKU Search</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Query Summary Banner */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <Search className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sumber Kueri AI:</span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 italic">
                    "{query || 'Semua Transaksi Kueri'}"
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 bg-white px-3.5 py-2 rounded-xl border border-blue-200/60 shadow-2xs">
                  <div className="text-center px-2 border-r border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">Item / SKU Unik</span>
                    <span className="text-sm font-extrabold font-mono text-blue-700">{extractedSkus.length}</span>
                  </div>
                  <div className="text-center px-2 border-r border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">Total Baris PO</span>
                    <span className="text-sm font-extrabold font-mono text-slate-800">{matchedRecords.length}</span>
                  </div>
                  <div className="text-center px-2">
                    <span className="text-[10px] text-slate-500 font-semibold block">Total Spend</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-600">{formatIDR(totalSelectedSpend)}</span>
                  </div>
                </div>
              </div>

              {/* Mode Selection Switcher: New vs Append */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Tentukan Tindakan Penyimpanan:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSaveMode('new')}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      saveMode === 'new'
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${saveMode === 'new' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Buat Saved Search Baru</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Membuat koleksi / playlist SKU baru khusus dari hasil kueri ini.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaveMode('append')}
                    disabled={existingPresets.length === 0}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      existingPresets.length === 0 
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200' 
                        : saveMode === 'append'
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${saveMode === 'append' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900">Tambahkan ke Saved Search yang Ada</h4>
                        {existingPresets.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
                            {existingPresets.length}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {existingPresets.length === 0 
                          ? 'Belum ada saved search sebelumnya.' 
                          : 'Gabungkan ke koleksi yang sudah ada tanpa duplikasi SKU.'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Mode Specific Inputs */}
              {saveMode === 'new' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Saved Search Baru <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="e.g. Kueri AI: Pembelian ATK Non Kertas"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Deskripsi / Catatan Analisis (Opsional)
                    </label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      placeholder="e.g. Hasil kueri peralatan kantor Q2 di Siloam"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilih Saved Search Target <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedTargetPresetId}
                      onChange={e => setSelectedTargetPresetId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
                    >
                      {existingPresets.map(preset => (
                        <option key={preset.id} value={preset.id}>
                          {preset.title} ({preset.selectedProductIds?.length || 0} SKU) • {new Date(preset.createdAt).toLocaleDateString('id-ID')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {appendStats && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Deduplikasi Otomatis: <strong className="text-emerald-700">{appendStats.newUniqueCount} SKU baru</strong> akan ditambahkan,{' '}
                          <strong className="text-slate-600">{appendStats.duplicateCount} SKU</strong> sudah ada di koleksi ini.
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 shrink-0">
                        Total Akhir: {appendStats.mergedTotalCount} SKU
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* SKU Item Selection Section */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900">
                      Daftar Item / SKU yang Ditemukan ({extractedSkus.length} SKU)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                      {selectedProductIds.size} dipilih
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari SKU..."
                        value={skuSearchFilter}
                        onChange={e => setSkuSearchFilter(e.target.value)}
                        className="pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0"
                    >
                      {isAllDisplayedSelected ? 'Batal Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                </div>

                {/* SKU List Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={isAllDisplayedSelected}
                            onChange={handleToggleSelectAll}
                            className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">Komoditas / Item SKU</th>
                        <th className="py-2.5 px-3">Spesifikasi & Brand</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3 text-right">Transaksi</th>
                        <th className="py-2.5 px-3 text-right">Total Nilai Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {displayedSkus.length > 0 ? (
                        displayedSkus.map((sku) => {
                          const isSelected = selectedProductIds.has(sku.productId);
                          return (
                            <tr
                              key={sku.productId}
                              onClick={() => handleToggleSku(sku.productId)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/50 hover:bg-blue-50/80' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSku(sku.productId)}
                                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 max-w-[220px]">
                                <div className="font-bold text-slate-900 truncate" title={sku.commodityItem}>
                                  {sku.commodityItem}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                  <span>ID: {sku.productId}</span>
                                  {sku.isVirtualSku && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px]">
                                      Ad-hoc Transaksi
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 max-w-[180px]">
                                <div className="text-slate-700 truncate" title={sku.specLine}>
                                  {sku.specLine && sku.specLine !== '-' ? sku.specLine : 'Standard'}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                  <span className="font-medium text-slate-600">Brand: {sku.brand || 'NB'}</span>
                                  <span>•</span>
                                  <span>Part: {sku.partNumber || 'NP'}</span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                                  {sku.purchCategoryLv1 || 'General'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                                {sku.transactionCount} PO
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                {formatIDR(sku.totalSpend)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Tidak ada item SKU yang cocok dengan filter pencarian.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!savedResult && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              <span className="font-bold text-slate-800">{selectedProductIds.size}</span> dari{' '}
              <span className="font-bold text-slate-800">{extractedSkus.length}</span> SKU terpilih ({formatIDR(totalSelectedSpend)})
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || selectedProductIds.size === 0}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="w-4 h-4" />
                    <span>
                      {saveMode === 'new' 
                        ? `Buat Saved Search (${selectedProductIds.size} SKU)` 
                        : `Tambahkan (${selectedProductIds.size} SKU)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
