import React, { useState, useMemo, useEffect } from 'react';
import { 
  DepartmentMasterRecord, 
  RawDepartmentDiscoveryItem, 
  SpendRecord, 
  HospitalMasterRecord 
} from '../../../core/types/spend';
import { spendService } from '../services/spendService';
import { backgroundJobManager } from '../../../core/services/backgroundJobManager';
import { 
  Building2, 
  Sparkles, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  RotateCcw, 
  Tag, 
  Layers, 
  Users, 
  CreditCard, 
  FileText, 
  ArrowRight, 
  Check, 
  X, 
  Info,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  FolderPlus
} from 'lucide-react';

interface DepartmentMasterViewProps {
  records: SpendRecord[];
  hospitalMasters: HospitalMasterRecord[];
  onRefreshData?: () => Promise<void> | void;
}

export const DepartmentMasterView: React.FC<DepartmentMasterViewProps> = ({
  records,
  hospitalMasters,
  onRefreshData
}) => {
  const [departments, setDepartments] = useState<DepartmentMasterRecord[]>([]);
  const [unmappedItems, setUnmappedItems] = useState<RawDepartmentDiscoveryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'clean_directory' | 'raw_discovery'>('clean_directory');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [aiFilter, setAiFilter] = useState<'ALL' | 'AI_ONLY' | 'NON_AI'>('ALL');

  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentMasterRecord | null>(null);
  const [mappingModalItem, setMappingModalItem] = useState<RawDepartmentDiscoveryItem | null>(null);
  const [selectedTargetDeptId, setSelectedTargetDeptId] = useState('');

  // Fast inline alias add
  const [inlineAliasDeptId, setInlineAliasDeptId] = useState<string | null>(null);
  const [inlineAliasText, setInlineAliasText] = useState('');

  // Load department data instantly from persistent IndexedDB
  const loadDepartmentData = async () => {
    setIsLoading(true);
    try {
      const [masters, cache] = await Promise.all([
        spendService.getDepartmentMasters(),
        spendService.getDepartmentDiscoveryCache()
      ]);
      setDepartments(masters);
      if (cache?.unmappedItems) {
        setUnmappedItems(cache.unmappedItems);
      }
      // If masters are empty and records exist, schedule background Web Worker compilation
      if (masters.length === 0 && records.length > 0) {
        spendService.scheduleBackgroundDepartmentCompilation(records);
      }
    } catch (err) {
      console.error('Failed to load department masters:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDepartmentData();
  }, []);

  // Listen for Background Web Worker compilation updates
  useEffect(() => {
    let lastHandled = 0;
    const unsub = backgroundJobManager.subscribe((st) => {
      setIsSyncing(Boolean(st.isDepartmentCompiling));
      if (st.lastDepartmentCompiledTimestamp && st.lastDepartmentCompiledTimestamp > lastHandled) {
        lastHandled = st.lastDepartmentCompiledTimestamp;
        Promise.all([
          spendService.getDepartmentMasters(),
          spendService.getDepartmentDiscoveryCache()
        ]).then(([masters, cache]) => {
          if (masters && masters.length > 0) {
            setDepartments(masters);
          }
          if (cache?.unmappedItems) {
            setUnmappedItems(cache.unmappedItems);
          }
        }).catch(err => {
          console.warn('[DepartmentMasterView] Error updating masters after worker job:', err);
        });
      }
    });
    return unsub;
  }, []);

  // Aggregate KPI Stats
  const stats = useMemo(() => {
    const totalDepts = departments.length;
    const aiActiveCount = departments.filter(d => d.isActive && d.isAiReference).length;
    const divisions = new Set(departments.map(d => d.divisionCategory).filter(Boolean)).size;
    const totalTxCovered = departments.reduce((acc, d) => acc + (d.transactionCount || 0), 0);
    const totalSpendCovered = departments.reduce((acc, d) => acc + (d.totalSpend || 0), 0);
    const totalAliases = departments.reduce((acc, d) => acc + (d.rawAliases?.length || 0), 0);
    const unmappedCount = unmappedItems.length;

    return {
      totalDepts,
      aiActiveCount,
      divisions,
      totalTxCovered,
      totalSpendCovered,
      totalAliases,
      unmappedCount
    };
  }, [departments, unmappedItems]);

  // Unique Divisions for Filter
  const divisionList = useMemo(() => {
    const divs = new Set<string>();
    departments.forEach(d => {
      if (d.divisionCategory) divs.add(d.divisionCategory);
    });
    return Array.from(divs).sort();
  }, [departments]);

  // Filtered Department List
  const filteredDepartments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return departments.filter(d => {
      // Search
      const matchSearch = !q ||
        d.cleanDepartmentName.toLowerCase().includes(q) ||
        d.departmentCode.toLowerCase().includes(q) ||
        d.divisionCategory.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.costCenters || []).some(cc => cc.includes(q)) ||
        (d.rawAliases || []).some(a => a.toLowerCase().includes(q)) ||
        (d.sampleRequesters || []).some(r => r.toLowerCase().includes(q));

      // Division
      const matchDiv = selectedDivision === 'ALL' || d.divisionCategory === selectedDivision;

      // AI Filter
      const matchAi = aiFilter === 'ALL' ||
        (aiFilter === 'AI_ONLY' && d.isActive && d.isAiReference) ||
        (aiFilter === 'NON_AI' && (!d.isActive || !d.isAiReference));

      return matchSearch && matchDiv && matchAi;
    });
  }, [departments, searchQuery, selectedDivision, aiFilter]);

  // Filtered Unmapped / Discovery Items
  const filteredRawItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return unmappedItems;
    return unmappedItems.filter(item => 
      item.rawName.toLowerCase().includes(q) ||
      (item.matchedCleanName && item.matchedCleanName.toLowerCase().includes(q))
    );
  }, [unmappedItems, searchQuery]);

  // Handlers
  const handleToggleAiReference = async (dept: DepartmentMasterRecord) => {
    const updated: DepartmentMasterRecord = {
      ...dept,
      isAiReference: !dept.isAiReference,
      updatedAt: new Date().toISOString()
    };
    await spendService.saveSingleDepartmentMaster(updated);
    await loadDepartmentData();
  };

  const handleToggleActive = async (dept: DepartmentMasterRecord) => {
    const updated: DepartmentMasterRecord = {
      ...dept,
      isActive: !dept.isActive,
      updatedAt: new Date().toISOString()
    };
    await spendService.saveSingleDepartmentMaster(updated);
    await loadDepartmentData();
  };

  const handleDeleteDepartment = async (id: string) => {
    if (window.confirm('Hapus departemen ini dari Master Data? Tindakan ini akan menghapus alias yang terkait.')) {
      await spendService.deleteDepartmentMaster(id);
      await loadDepartmentData();
    }
  };

  const handleResetToStandard = async () => {
    if (window.confirm('Reset Master Departemen kembali ke standar Siloam Hospitals Group?')) {
      setIsSyncing(true);
      try {
        await spendService.resetDepartmentMasters();
        await loadDepartmentData();
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleAutoSync = async () => {
    setIsSyncing(true);
    try {
      const discovery = await spendService.discoverAndSyncDepartments(records);
      setDepartments(discovery.masters);
      setUnmappedItems(discovery.unmapped);
      if (onRefreshData) await onRefreshData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveInlineAlias = async (deptId: string) => {
    if (!inlineAliasText.trim()) {
      setInlineAliasDeptId(null);
      return;
    }
    const targetDept = departments.find(d => d.id === deptId);
    if (!targetDept) return;

    const newAlias = inlineAliasText.trim().toLowerCase();
    const existing = new Set((targetDept.rawAliases || []).map(a => a.toLowerCase()));
    if (!existing.has(newAlias)) {
      const updatedAliases = [...(targetDept.rawAliases || []), newAlias];
      const updatedDept: DepartmentMasterRecord = {
        ...targetDept,
        rawAliases: updatedAliases,
        updatedAt: new Date().toISOString()
      };
      await spendService.saveSingleDepartmentMaster(updatedDept);
      await loadDepartmentData();
    }
    setInlineAliasDeptId(null);
    setInlineAliasText('');
  };

  const handleOpenEdit = (dept: DepartmentMasterRecord) => {
    setEditingDept(dept);
    setIsDeptModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingDept(null);
    setIsDeptModalOpen(true);
  };

  const handleSaveModalForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cleanName = (formData.get('cleanDepartmentName') as string).trim();
    const code = (formData.get('departmentCode') as string).trim().toUpperCase();
    const division = (formData.get('divisionCategory') as string).trim();
    const rawAliasesStr = (formData.get('rawAliases') as string) || '';
    const costCentersStr = (formData.get('costCenters') as string) || '';
    const description = (formData.get('description') as string) || '';
    const isAiRef = formData.get('isAiReference') === 'on';

    const parsedAliases = Array.from(new Set(
      rawAliasesStr.split(/[\n,]/).map(s => s.trim().toLowerCase()).filter(Boolean)
    ));
    const parsedCostCenters = Array.from(new Set(
      costCentersStr.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
    ));

    const recordToSave: DepartmentMasterRecord = {
      id: editingDept ? editingDept.id : `dept-${code.toLowerCase().replace(/[^a-z0-9]/g, '-') || Date.now()}`,
      departmentCode: code || 'DEPT',
      cleanDepartmentName: cleanName,
      divisionCategory: division || 'General Affairs, Facilities & Operational',
      rawAliases: parsedAliases,
      costCenters: parsedCostCenters,
      assignedHospitalCodes: ['ALL'],
      description,
      isActive: true,
      isAiReference: isAiRef,
      transactionCount: editingDept?.transactionCount || 0,
      totalSpend: editingDept?.totalSpend || 0,
      requesterCount: editingDept?.requesterCount || 0,
      sampleRequesters: editingDept?.sampleRequesters || [],
      sampleHospitals: editingDept?.sampleHospitals || [],
      updatedAt: new Date().toISOString()
    };

    await spendService.saveSingleDepartmentMaster(recordToSave);
    await loadDepartmentData();
    setIsDeptModalOpen(false);
    setEditingDept(null);
  };

  // Map raw discovery item to existing clean department
  const handleMapRawToDept = async () => {
    if (!mappingModalItem || !selectedTargetDeptId) return;
    const targetDept = departments.find(d => d.id === selectedTargetDeptId);
    if (!targetDept) return;

    const newAlias = mappingModalItem.rawName.trim().toLowerCase();
    const existing = new Set((targetDept.rawAliases || []).map(a => a.toLowerCase()));
    existing.add(newAlias);

    const updatedDept: DepartmentMasterRecord = {
      ...targetDept,
      rawAliases: Array.from(existing),
      updatedAt: new Date().toISOString()
    };

    await spendService.saveSingleDepartmentMaster(updatedDept);
    await loadDepartmentData();
    setMappingModalItem(null);
    setSelectedTargetDeptId('');
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'Department Code',
      'Clean Department Name',
      'Division Category',
      'AI Reference Active',
      'Cost Centers',
      'Transaction Count',
      'Total Spend IDR',
      'Raw Aliases (Variations)'
    ];

    const rows = departments.map(d => [
      `"${d.departmentCode}"`,
      `"${d.cleanDepartmentName.replace(/"/g, '""')}"`,
      `"${d.divisionCategory.replace(/"/g, '""')}"`,
      `"${d.isAiReference ? 'YES' : 'NO'}"`,
      `"${(d.costCenters || []).join('; ')}"`,
      d.transactionCount || 0,
      d.totalSpend || 0,
      `"${(d.rawAliases || []).join('; ').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Siloam_Department_Master_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Enterprise Control Bar & KPI Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/90 text-white flex items-center justify-center shadow-xs">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono tracking-wider text-blue-300 font-bold uppercase">
                    ERP MASTER DIRECTORY
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Sparkles className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                    AI REFERENCE REGISTRY
                  </span>
                </div>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Direktori Master Departemen Standar Siloam & Referensi AI
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Daftar unik dan terstandarisasi atas departemen yang masuk dari data upload PO & PR. 
                Data ini menjadi sumber kebenaran tunggal (*Single Source of Truth*) bagi AI Copilot 
                dalam pencocokan kueri semantik dan isolasi filter transaksi.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center flex-wrap gap-2 shrink-0">
              <button
                onClick={handleOpenAdd}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Departemen
              </button>
              <button
                onClick={handleAutoSync}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Pindai data transaksi & PR yang baru diupload"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                {isSyncing ? 'Memindai...' : 'Sinkronisasi Upload'}
              </button>
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Ekspor CSV
              </button>
              <button
                onClick={handleResetToStandard}
                disabled={isSyncing}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-200 border border-slate-700 text-xs transition-colors cursor-pointer"
                title="Reset ke Standar Default Siloam"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Metric KPI Cards in Header */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-slate-800/80">
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Departemen Bersih</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-white font-mono">{stats.totalDepts}</span>
                <span className="text-[10px] text-slate-400 font-sans">Unit</span>
              </div>
            </div>

            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-mono text-emerald-300 block flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Referensi AI Aktif
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-emerald-400 font-mono">{stats.aiActiveCount}</span>
                <span className="text-[10px] text-slate-400 font-sans">Aktif</span>
              </div>
            </div>

            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Variasi Alias</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-blue-400 font-mono">{stats.totalAliases}</span>
                <span className="text-[10px] text-slate-400 font-sans">Pola Kata</span>
              </div>
            </div>

            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Transaksi Tercover</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-white font-mono">{stats.totalTxCovered.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400 font-sans">PO Line</span>
              </div>
            </div>

            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Spend Tercover</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-amber-300 font-mono">
                  Rp {(stats.totalSpendCovered / 1_000_000).toFixed(1)}M
                </span>
              </div>
            </div>

            <div className={`rounded-lg p-2.5 border ${
              stats.unmappedCount > 0 
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' 
                : 'bg-slate-800/70 border-slate-700/60 text-slate-300'
            }`}>
              <span className="text-[10px] uppercase font-mono block">Data Belum Terpetakan</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-base font-bold font-mono ${stats.unmappedCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {stats.unmappedCount}
                </span>
                <span className="text-[10px] font-sans">
                  {stats.unmappedCount > 0 ? 'Perlu Ditinjau' : '100% Bersih'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs between Clean Registry & Raw Discovery */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          <button
            onClick={() => setActiveTab('clean_directory')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'clean_directory'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Master Departemen Bersih & Terstandarisasi</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-800 font-semibold">
              {departments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('raw_discovery')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'raw_discovery'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Audit Variasi Nama Departemen dari File Upload</span>
            {stats.unmappedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 font-semibold animate-pulse">
                {stats.unmappedCount} baru
              </span>
            )}
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'clean_directory'
                    ? 'Cari nama, kode (FO/FMS), alias, cost center...'
                    : 'Cari teks departemen mentah di file upload...'
                }
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {activeTab === 'clean_directory' && (
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px] font-medium">Divisi:</span>
                <select
                  value={selectedDivision}
                  onChange={e => setSelectedDivision(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Divisi ({divisionList.length})</option>
                  {divisionList.map(div => (
                    <option key={div} value={div}>{div}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px] font-medium">Status AI:</span>
                <select
                  value={aiFilter}
                  onChange={e => setAiFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="AI_ONLY">Referensi AI Aktif Saja</option>
                  <option value="NON_AI">Non-Referensi</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Body */}
      {activeTab === 'clean_directory' ? (
        /* TAB 1: Master Departemen Bersih & Terstandarisasi */
        <div className="space-y-3">
          {filteredDepartments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada departemen yang cocok dengan filter</p>
              <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau reset filter divisi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredDepartments.map(dept => {
                const isAddingAlias = inlineAliasDeptId === dept.id;

                return (
                  <div
                    key={dept.id}
                    className={`bg-white border rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all relative flex flex-col justify-between ${
                      dept.isAiReference 
                        ? 'border-slate-200 hover:border-blue-300' 
                        : 'border-slate-200/60 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-white shadow-2xs">
                            {dept.departmentCode}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full truncate max-w-[200px]" title={dept.divisionCategory}>
                            {dept.divisionCategory}
                          </span>
                        </div>

                        {/* AI Status Toggle Pill */}
                        <button
                          onClick={() => handleToggleAiReference(dept)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                            dept.isAiReference
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                          title={dept.isAiReference ? 'Klik untuk nonaktifkan sebagai referensi AI' : 'Klik untuk jadikan referensi resmi AI'}
                        >
                          <Sparkles className={`w-3 h-3 ${dept.isAiReference ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>{dept.isAiReference ? 'AI Reference' : 'Non-AI'}</span>
                        </button>
                      </div>

                      {/* Clean Department Title */}
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {dept.cleanDepartmentName}
                      </h3>

                      {dept.description && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {dept.description}
                        </p>
                      )}

                      {/* Aliases Tag Cloud (Pola yang dikenali AI) */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5 text-blue-500" />
                            Pola Kata Kunci AI ({dept.rawAliases?.length || 0})
                          </span>
                          {!isAddingAlias && (
                            <button
                              onClick={() => {
                                setInlineAliasDeptId(dept.id);
                                setInlineAliasText('');
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Alias
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 items-center">
                          {(dept.rawAliases || []).map((alias, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80"
                            >
                              {alias}
                            </span>
                          ))}

                          {isAddingAlias && (
                            <div className="flex items-center gap-1 w-full mt-1.5">
                              <input
                                type="text"
                                value={inlineAliasText}
                                onChange={e => setInlineAliasText(e.target.value)}
                                placeholder="Tambah variasi nama..."
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveInlineAlias(dept.id);
                                  if (e.key === 'Escape') setInlineAliasDeptId(null);
                                }}
                                autoFocus
                                className="flex-1 text-xs px-2 py-1 bg-white border border-blue-400 rounded focus:outline-hidden"
                              />
                              <button
                                onClick={() => handleSaveInlineAlias(dept.id)}
                                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[10px] font-bold"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setInlineAliasDeptId(null)}
                                className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 text-[10px]"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cost Centers & Requesters */}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-[10px] uppercase font-mono text-slate-400 block">Cost Center:</span>
                          <span className="font-mono font-bold text-slate-700 text-xs">
                            {(dept.costCenters || []).length > 0 ? dept.costCenters?.join(', ') : '-'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-mono text-slate-400 block">Requesters Terkait:</span>
                          <span className="font-semibold text-slate-700 text-xs">
                            {dept.requesterCount || (dept.sampleRequesters?.length || 0)} User
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Row: Live Data Activity Metrics & Action Buttons */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 block">Aktivitas di Upload:</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-slate-900">{dept.transactionCount || 0} PO</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-emerald-700">
                            Rp {((dept.totalSpend || 0) / 1_000_000).toFixed(1)}M
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(dept)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          title="Edit Master Departemen"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDepartment(dept.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Hapus Departemen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: Audit Variasi Nama Departemen dari File Upload */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Audit Variasi Teks Departemen yang Masuk dari Data Upload
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar string departemen mentah yang ditemukan di file transaksi PO dan PR. 
                Sistem secara otomatis memetakannya ke Master Departemen Bersih. 
                Variasi baru dapat langsung ditambahkan ke alias dengan satu klik.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 shrink-0 self-start sm:self-center">
              {filteredRawItems.length} Variasi Teridentifikasi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-[10px] font-mono uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Teks Mentah di Upload</th>
                  <th className="py-2.5 px-3">Sumber Data</th>
                  <th className="py-2.5 px-3 text-right">Jumlah PO</th>
                  <th className="py-2.5 px-3 text-right">Total Nilai Spend</th>
                  <th className="py-2.5 px-3">Status Pemetaan ke Master</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredRawItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada variasi departemen yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredRawItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.rawName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          item.source === 'SPEND_UPLOAD' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : item.source === 'PR_UPLOAD'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.source}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-medium text-slate-800">
                        {item.occurrences.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-900">
                        Rp {item.totalSpend.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.matchedCleanName ? (
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="font-semibold">{item.matchedCleanName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-700">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="font-semibold">Belum Terpetakan</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setMappingModalItem(item);
                            setSelectedTargetDeptId(item.matchedDepartmentId || departments[0]?.id || '');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          {item.matchedCleanName ? 'Ubah Mapping' : 'Petakan ke Master'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Add / Edit Clean Department Master */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingDept ? 'Edit Master Departemen' : 'Tambah Departemen Standar Baru'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsDeptModalOpen(false);
                  setEditingDept(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalForm} className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase font-mono block mb-1">
                  Nama Departemen Bersih (Canonical Name) *
                </label>
                <input
                  type="text"
                  name="cleanDepartmentName"
                  defaultValue={editingDept?.cleanDepartmentName || ''}
                  required
                  placeholder="e.g. Front Office, Pharmacy & Therapeutics"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase font-mono block mb-1">
                    Kode Singkatan ERP *
                  </label>
                  <input
                    type="text"
                    name="departmentCode"
                    defaultValue={editingDept?.departmentCode || ''}
                    required
                    placeholder="e.g. FO, FMS-GA, PHARM"
                    className="w-full text-xs font-mono font-bold uppercase px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase font-mono block mb-1">
                    Divisi / Direktorat
                  </label>
                  <input
                    type="text"
                    name="divisionCategory"
                    defaultValue={editingDept?.divisionCategory || 'General Affairs, Facilities & Operational'}
                    placeholder="e.g. Frontlines, Hospitality & Customer Care"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase font-mono block mb-1">
                  Pola Alias & Variasi Penulisan di Upload (Pisahkan koma atau baris baru)
                </label>
                <textarea
                  name="rawAliases"
                  defaultValue={(editingDept?.rawAliases || []).join(', ')}
                  rows={3}
                  placeholder="e.g. front office, fo, admission, admisi, customer care, resepsionis"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  AI Copilot akan mengenali semua variasi teks di atas dan memetakan pencarian ke departemen ini.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase font-mono block mb-1">
                    Cost Center (Koma)
                  </label>
                  <input
                    type="text"
                    name="costCenters"
                    defaultValue={(editingDept?.costCenters || []).join(', ')}
                    placeholder="e.g. 1035, 1036"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center mt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isAiReference"
                      defaultChecked={editingDept ? editingDept.isAiReference : true}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Aktifkan sebagai Referensi AI
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase font-mono block mb-1">
                  Deskripsi / Ruang Lingkup Operasional
                </label>
                <input
                  type="text"
                  name="description"
                  defaultValue={editingDept?.description || ''}
                  placeholder="e.g. Layanan terdepan registrasi pasien dan admisi..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeptModalOpen(false);
                    setEditingDept(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Simpan Departemen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Map Raw Upload Item to Clean Department */}
      {mappingModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Petakan Variasi Teks ke Master Departemen
                </h3>
              </div>
              <button
                onClick={() => setMappingModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Teks Mentah di File Upload:
                </span>
                <span className="text-sm font-bold text-slate-900 font-mono block">
                  "{mappingModalItem.rawName}"
                </span>
                <div className="flex items-center gap-3 mt-1.5 text-slate-500 font-mono text-[11px]">
                  <span>{mappingModalItem.occurrences} PO Lines</span>
                  <span>•</span>
                  <span>Rp {mappingModalItem.totalSpend.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase font-mono block mb-1.5">
                  Pilih Master Departemen Standar Tujuan:
                </label>
                <select
                  value={selectedTargetDeptId}
                  onChange={e => setSelectedTargetDeptId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.departmentCode}] {d.cleanDepartmentName} ({d.divisionCategory})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Teks mentah ini akan otomatis didaftarkan sebagai alias pada departemen terpilih, 
                  sehingga AI dan filter query langsung mengenali transaksi ini.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMappingModalItem(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleMapRawToDept}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Konfirmasi Pemetaan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
