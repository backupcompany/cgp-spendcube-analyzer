import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, 
  FileText, 
  Upload, 
  Download, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Briefcase, 
  RotateCcw,
  Sparkles,
  Link,
  ChevronRight,
  ExternalLink,
  X
} from 'lucide-react';
import { 
  PurchaseRequisitionRecord, 
  UserDepartmentMappingRecord, 
  HospitalMasterRecord, 
  SpendRecord 
} from '../../../core/types/spend';
import { spendService } from '../services/spendService';
import { parsePrFile, downloadPrExcelTemplate, PrParseResult } from '../services/prParser';

interface RequesterDeptMappingViewProps {
  records: SpendRecord[];
  hospitalMasters: HospitalMasterRecord[];
  onRefreshData?: () => Promise<void> | void;
}

export const RequesterDeptMappingView: React.FC<RequesterDeptMappingViewProps> = ({
  records,
  hospitalMasters,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'user_mapping' | 'pr_registry' | 'po_pairing_audit'>('user_mapping');
  const [userMappings, setUserMappings] = useState<UserDepartmentMappingRecord[]>([]);
  const [prRecords, setPrRecords] = useState<PurchaseRequisitionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [pairingAuditFilter, setPairingAuditFilter] = useState<'ALL' | 'PAIRED' | 'UNPAIRED'>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 50;

  // Modal states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDepartmentMappingRecord | null>(null);

  // Upload modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<PrParseResult | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Load initial data from service
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [users, prs] = await Promise.all([
        spendService.getUserDepartmentMappings(),
        spendService.getPrRecords(),
      ]);
      setUserMappings(users);
      setPrRecords(prs);
    } catch (err) {
      console.error('Failed to load user mappings and PR records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Hospital code map for easy lookup
  const hospitalMap = useMemo(() => {
    const map = new Map<string, HospitalMasterRecord>();
    hospitalMasters.forEach(h => {
      if (h.hospitalCode) map.set(h.hospitalCode.toUpperCase(), h);
      if (h.erpHospitalUnitCode) map.set(h.erpHospitalUnitCode, h);
    });
    return map;
  }, [hospitalMasters]);

  // Existing PO numbers in spend database for pairing evaluation (only when audit/PR tab is active)
  const existingPoSet = useMemo(() => {
    if (activeTab === 'user_mapping') return new Set<string>();
    return new Set(records.map(r => (r.purchId || '').trim().toUpperCase()).filter(Boolean));
  }, [records, activeTab]);

  // Derived lists for filters (from User mappings and PR registry, zero lag)
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    userMappings.forEach(u => {
      if (u.department) depts.add(u.department);
    });
    prRecords.forEach(p => {
      if (p.description) depts.add(p.description);
    });
    return Array.from(depts).sort();
  }, [userMappings, prRecords]);

  // Filtered User Mappings (only evaluated when user_mapping tab is active)
  const filteredUsers = useMemo(() => {
    if (activeTab !== 'user_mapping') return [];
    const q = searchQuery.toLowerCase().trim();
    return userMappings.filter(u => {
      const matchSearch = !q || 
        u.username.toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.costCenter || '').toLowerCase().includes(q) ||
        (u.hospitalUnitCode || '').toLowerCase().includes(q);

      const matchUnit = selectedUnit === 'ALL' || u.hospitalUnitCode === selectedUnit;
      const matchDept = selectedDept === 'ALL' || u.department.toLowerCase() === selectedDept.toLowerCase();

      return matchSearch && matchUnit && matchDept;
    });
  }, [userMappings, searchQuery, selectedUnit, selectedDept, activeTab]);

  // Filtered PR Records (only evaluated when pr_registry tab is active)
  const filteredPrs = useMemo(() => {
    if (activeTab !== 'pr_registry') return [];
    const q = searchQuery.toLowerCase().trim();
    return prRecords.filter(p => {
      const matchSearch = !q ||
        p.purchaseReqId.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.requester.toLowerCase().includes(q) ||
        (p.costCenter || '').toLowerCase().includes(q) ||
        (p.erpId || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);

      const matchUnit = selectedUnit === 'ALL' || p.unit === selectedUnit;
      const matchDept = selectedDept === 'ALL' || (p.description || '').toLowerCase() === selectedDept.toLowerCase();

      return matchSearch && matchUnit && matchDept;
    });
  }, [prRecords, searchQuery, selectedUnit, selectedDept, activeTab]);

  // Pairing Stats (Dual Perspective: PR Master Registry & PO Spend Transactions)
  const pairingStats = useMemo(() => {
    const totalPrs = prRecords.length;
    const pairedPrs = prRecords.filter(p => p.erpId && existingPoSet.has(p.erpId.trim().toUpperCase())).length;
    const pairingRatio = totalPrs > 0 ? ((pairedPrs / totalPrs) * 100).toFixed(1) : '0.0';

    // Transactions perspective
    const totalTx = records.length;
    let pairedTx = 0;
    let unpairedTx = 0;
    let pairedSpend = 0;
    let unpairedSpend = 0;
    let pairedByPo = 0;
    let pairedByPrq = 0;

    for (const r of records) {
      const amt = Number(r.totalLineAmount) || 0;
      const isPaired = r.prPairingKeyType === 'PO' || r.prPairingKeyType === 'PRQ' || (Boolean(r.purchaseReqId) && r.prPairingKeyType !== 'UNPAIRED');
      if (isPaired) {
        pairedTx++;
        pairedSpend += amt;
        if (r.prPairingKeyType === 'PRQ') pairedByPrq++;
        else pairedByPo++;
      } else {
        unpairedTx++;
        unpairedSpend += amt;
      }
    }

    const totalSpend = pairedSpend + unpairedSpend;
    const txPairingPct = totalTx > 0 ? ((pairedTx / totalTx) * 100).toFixed(1) : '0.0';
    const spendPairingPct = totalSpend > 0 ? ((pairedSpend / totalSpend) * 100).toFixed(1) : '0.0';

    return {
      totalUsers: userMappings.length,
      totalDepts: uniqueDepartments.length,
      totalPrs,
      pairedPrs,
      pairingRatio,
      totalTx,
      pairedTx,
      unpairedTx,
      pairedSpend,
      unpairedSpend,
      totalSpend,
      txPairingPct,
      spendPairingPct,
      pairedByPo,
      pairedByPrq,
    };
  }, [prRecords, userMappings, uniqueDepartments, existingPoSet, records]);

  // Filtered PO Transactions for Audit Tab (only evaluated when audit tab is active)
  const filteredPoAuditRecords = useMemo(() => {
    if (activeTab !== 'po_pairing_audit') return [];
    const q = searchQuery.toLowerCase().trim();
    return records.filter(r => {
      const isPaired = r.prPairingKeyType === 'PO' || r.prPairingKeyType === 'PRQ' || (Boolean(r.purchaseReqId) && r.prPairingKeyType !== 'UNPAIRED');
      
      if (pairingAuditFilter === 'PAIRED' && !isPaired) return false;
      if (pairingAuditFilter === 'UNPAIRED' && isPaired) return false;

      const matchUnit = selectedUnit === 'ALL' || r.hospitalCode === selectedUnit;
      const matchDept = selectedDept === 'ALL' || (r.department || '').toLowerCase() === selectedDept.toLowerCase();

      if (!matchUnit || !matchDept) return false;

      if (!q) return true;

      return (
        (r.purchId || '').toLowerCase().includes(q) ||
        (r.purchaseReqId || '').toLowerCase().includes(q) ||
        (r.requester || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.itemName || '').toLowerCase().includes(q) ||
        (r.vendorName || '').toLowerCase().includes(q) ||
        (r.costCenter || '').toLowerCase().includes(q)
      );
    });
  }, [records, pairingAuditFilter, selectedUnit, selectedDept, searchQuery]);

  const totalAuditPages = Math.ceil(filteredPoAuditRecords.length / AUDIT_PAGE_SIZE) || 1;
  const paginatedAuditRecords = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PAGE_SIZE;
    return filteredPoAuditRecords.slice(start, start + AUDIT_PAGE_SIZE);
  }, [filteredPoAuditRecords, auditPage]);

  // Handle Save User Mapping
  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = (formData.get('username') as string || '').toLowerCase().trim();
    const fullName = formData.get('fullName') as string || '';
    const department = formData.get('department') as string || '';
    let costCenter = formData.get('costCenter') as string || '0001';
    if (!isNaN(parseInt(costCenter, 10))) {
      costCenter = String(parseInt(costCenter, 10)).padStart(4, '0');
    }
    const hospitalUnitCode = formData.get('hospitalUnitCode') as string || '0000';
    const email = formData.get('email') as string || `${username}@siloamhospitals.com`;
    const title = formData.get('title') as string || `${department} Specialist`;

    const hospObj = hospitalMap.get(hospitalUnitCode);
    const hospitalName = hospObj ? hospObj.hospitalName : 'Siloam Hospitals Unit';

    const recordToSave: UserDepartmentMappingRecord = {
      id: editingUser ? editingUser.id : `usr-map-${Date.now()}`,
      username,
      fullName,
      department,
      costCenter,
      hospitalUnitCode,
      hospitalName,
      email,
      title,
      isActive: true,
    };

    await spendService.saveSingleUserDepartmentMapping(recordToSave);
    const updated = await spendService.getUserDepartmentMappings();
    setUserMappings(updated);
    setIsUserModalOpen(false);
    setEditingUser(null);

    if (onRefreshData) {
      await onRefreshData();
    }
  };

  // Handle Delete User Mapping
  const handleDeleteUser = async (id: string, username: string) => {
    if (confirm(`Hapus mapping untuk user "${username}"?`)) {
      await spendService.deleteUserDepartmentMapping(id);
      const updated = await spendService.getUserDepartmentMappings();
      setUserMappings(updated);
      if (onRefreshData) {
        await onRefreshData();
      }
    }
  };

  // Handle Reset User Mappings
  const handleResetUsers = async () => {
    if (confirm('Kembalikan direktori mapping user ke data standar Siloam ERP?')) {
      const resetList = await spendService.resetUserDepartmentMappings();
      setUserMappings(resetList);
      if (onRefreshData) {
        await onRefreshData();
      }
    }
  };

  // Handle PR File Selection
  const handleFileChange = async (file: File) => {
    setUploadFile(file);
    setIsParsing(true);
    setParseResult(null);
    try {
      const res = await parsePrFile(file, existingPoSet);
      setParseResult(res);
    } catch (err: any) {
      alert(`Gagal memproses file Excel PR: ${err.message || err}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Commit PR Batch to DB
  const handleCommitPrUpload = async () => {
    if (!parseResult || parseResult.records.length === 0) return;
    setIsParsing(true);
    try {
      const result = await spendService.addPrBatch(parseResult.records, parseResult.harvestedUsers);
      const [updatedUsers, updatedPrs] = await Promise.all([
        spendService.getUserDepartmentMappings(),
        spendService.getPrRecords(),
      ]);
      setUserMappings(updatedUsers);
      setPrRecords(updatedPrs);
      setUploadSuccessMsg(`Berhasil memuat ${result.addedPrCount} data PR & memperbarui ${result.addedUserCount} mapping requester!`);
      
      if (onRefreshData) {
        await onRefreshData();
      }

      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadFile(null);
        setParseResult(null);
        setUploadSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      alert(`Error saat menyimpan batch PR: ${err.message || err}`);
    } finally {
      setIsParsing(false);
    }
  };

  const formatIDR = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;

  return (
    <div className="space-y-5">
      {/* Top Banner & Action Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
                MD-05 PR & Requester Engine
              </span>
              <span className="text-xs font-semibold text-slate-500">
                • Pairing PO ERP ID ke Requisition & Departemen
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-purple-600" />
              Direktori Requester & Mapping Departemen Hospital
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
              Mengidentifikasi siapa user (requester) yang mengajukan pembelian, subject/nama proyek pengadaan, 
              cost center, serta asosiasi departemen pada masing-masing unit rumah sakit.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => downloadPrExcelTemplate()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
              title="Unduh Format Excel Data PR (Sesuai Kolom Sistem ERP)"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              Template Excel PR
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Data PR (Excel)
            </button>

            <button
              onClick={() => {
                setEditingUser(null);
                setIsUserModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              Tambah User Mapping
            </button>
          </div>
        </div>

        {/* Metric Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Requester & Dept Terdaftar</span>
            <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">{pairingStats.totalUsers} User / {pairingStats.totalDepts} Dept</div>
            <span className="text-[10px] text-purple-600 font-medium">{pairingStats.totalPrs} Dokumen PR di Registry</span>
          </div>

          <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-200/70">
            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">PO Berpasangan (Paired)</span>
            <div className="text-xl font-bold text-emerald-900 font-mono mt-0.5">{pairingStats.pairedTx.toLocaleString('id-ID')} PO ({pairingStats.txPairingPct}%)</div>
            <span className="text-[10px] text-emerald-700 font-medium">Rp {(pairingStats.pairedSpend / 1e9).toFixed(2)} Miliar (Exact Key Match)</span>
          </div>

          <div className="bg-rose-50/60 rounded-xl p-3 border border-rose-200/70">
            <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider block">PO Tanpa PR (Unpaired)</span>
            <div className="text-xl font-bold text-rose-900 font-mono mt-0.5">{pairingStats.unpairedTx.toLocaleString('id-ID')} PO ({((pairingStats.unpairedTx / Math.max(1, pairingStats.totalTx)) * 100).toFixed(1)}%)</div>
            <span className="text-[10px] text-rose-700 font-medium">Rp {(pairingStats.unpairedSpend / 1e9).toFixed(2)} Miliar (Tanpa Asumsi/Fallback)</span>
          </div>

          <div className="bg-purple-50/60 rounded-xl p-3 border border-purple-200/70">
            <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider block">Akurasi Spend Ber-PR</span>
            <div className="text-xl font-bold text-purple-900 font-mono mt-0.5">{pairingStats.spendPairingPct}%</div>
            <span className="text-[10px] text-purple-700 font-medium">Audit Kepatuhan Dokumen Pengadaan</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            onClick={() => setActiveTab('user_mapping')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'user_mapping'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-purple-600" />
            Mapping User ke Dept ({filteredUsers.length})
          </button>

          <button
            onClick={() => setActiveTab('pr_registry')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pr_registry'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-purple-600" />
            Registry PR & Master PO ({filteredPrs.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('po_pairing_audit');
              setAuditPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'po_pairing_audit'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link className="w-3.5 h-3.5 text-purple-600" />
            Audit Pairing Transaksi PO ({filteredPoAuditRecords.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'po_pairing_audit' && (
            <select
              value={pairingAuditFilter}
              onChange={(e) => {
                setPairingAuditFilter(e.target.value as any);
                setAuditPage(1);
              }}
              className="px-3 py-1.5 bg-purple-50/70 border border-purple-200 text-purple-900 font-bold rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">Semua Status Pairing ({records.length})</option>
              <option value="PAIRED">Hanya Ter-Pair (Exact Match) ({pairingStats.pairedTx})</option>
              <option value="UNPAIRED">Hanya Tanpa PR (Unpaired) ({pairingStats.unpairedTx})</option>
            </select>
          )}

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={activeTab === 'user_mapping' ? "Cari user, dept, cost center..." : activeTab === 'pr_registry' ? "Cari no PR, PO, subject, requester..." : "Cari PO, PR, requester, item..."}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setAuditPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Unit Filter */}
          <select
            value={selectedUnit}
            onChange={(e) => {
              setSelectedUnit(e.target.value);
              setAuditPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">Semua Unit (0000 - 9999)</option>
            {hospitalMasters.map(h => (
              <option key={h.id} value={h.erpHospitalUnitCode || '0000'}>
                [{h.erpHospitalUnitCode || '0000'}] {h.hospitalName}
              </option>
            ))}
          </select>

          {/* Dept Filter */}
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setAuditPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer max-w-[170px]"
          >
            <option value="ALL">Semua Departemen</option>
            {uniqueDepartments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {activeTab === 'user_mapping' && (
            <button
              onClick={handleResetUsers}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reset ke Default Sample Mapping"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: Mapping User ke Dept Table */}
      {activeTab === 'user_mapping' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Username Requester</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Departemen Terpetakan</th>
                  <th className="py-3 px-4 text-center">Cost Center</th>
                  <th className="py-3 px-4">Unit Rumah Sakit (ERP)</th>
                  <th className="py-3 px-4">Email & Jabatan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada user mapping yang sesuai kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const hosp = hospitalMap.get(u.hospitalUnitCode || '0000');
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-purple-900 bg-purple-50/60 px-2 py-0.5 rounded border border-purple-200/60">
                            {u.username}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {u.fullName || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 inline-flex items-center gap-1.5">
                            <Briefcase className="w-3 h-3 text-indigo-500" />
                            {u.department}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {u.costCenter || '0000'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px]">
                              {u.hospitalUnitCode || '0000'}
                            </span>
                            <span className="text-slate-800 font-medium text-xs truncate max-w-[200px]" title={hosp?.hospitalName || u.hospitalName}>
                              {hosp?.hospitalName || u.hospitalName || 'Siloam Unit'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="truncate max-w-[180px] font-mono text-[11px] text-slate-500">
                            {u.email || '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                            {u.title || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Aktif
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setIsUserModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                              title="Edit Mapping"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Hapus Mapping"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Data PR & Pairing PO Table */}
      {activeTab === 'pr_registry' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Unit ERP</th>
                  <th className="py-3 px-4">No PR (Purchase Req ID)</th>
                  <th className="py-3 px-4">Subject (Nama Project Pembelian)</th>
                  <th className="py-3 px-4">Category Type</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4 text-center">Cost Center</th>
                  <th className="py-3 px-4">Departemen</th>
                  <th className="py-3 px-4">ERP ID (No PO Terhubung)</th>
                  <th className="py-3 px-4 text-right">Nilai PR</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPrs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Belum ada data PR yang sesuai kriteria. Silakan upload file Excel PR.
                    </td>
                  </tr>
                ) : (
                  filteredPrs.map((pr) => {
                    const isPaired = pr.erpId && existingPoSet.has(pr.erpId.trim().toUpperCase());
                    return (
                      <tr key={pr.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px]">
                            {pr.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {pr.purchaseReqId}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 max-w-[240px]">
                          <span className="line-clamp-2" title={pr.subject}>
                            {pr.subject}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 capitalize">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {pr.categoryType || 'other opex'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[11px]">
                            {pr.requester}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {pr.costCenter}
                          </span>
                        </td>
                        <td className="py-3 px-4 capitalize font-medium text-slate-800">
                          {pr.description}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900">
                              {pr.erpId || '-'}
                            </span>
                            {isPaired ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Paired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Standalone
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatIDR(pr.totalAmount || 0)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {pr.documentStatus || 'Approved'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Audit Pairing PO Transaksi (Strict Matching Verification) */}
      {activeTab === 'po_pairing_audit' && (
        <div className="space-y-4">
          {/* Transparency & Integrity Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800">Prinsip Audit Pairing PO-PR: 100% Akurat Tanpa Heuristik Fallback.</span>{' '}
              Sistem mencocokkan Purchase Order (PO) ke Purchase Requisition (PR) hanya berdasarkan kunci unik pasti: 
              <span className="font-mono font-semibold text-purple-800 bg-purple-100/70 px-1 mx-0.5 rounded">PURCHID</span> (No PO ERP) atau{' '}
              <span className="font-mono font-semibold text-indigo-800 bg-indigo-100/70 px-1 mx-0.5 rounded">MIIREFERENCEREQNUM</span> (Token PRQ). 
              Transaksi tanpa dokumen PR yang cocok ditandai secara jujur dan transparan sebagai <span className="font-bold text-rose-700">UNPAIRED</span> tanpa menggunakan tebakan, modulo, atau pemaksaan data.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">No PO (Purch ID)</th>
                    <th className="py-3 px-4">Unit RS</th>
                    <th className="py-3 px-4">Item Transaksi</th>
                    <th className="py-3 px-4 text-right">Nilai Belanja</th>
                    <th className="py-3 px-4 text-center">Status Pairing PO-PR</th>
                    <th className="py-3 px-4">No PR Terhubung</th>
                    <th className="py-3 px-4">Requester (Pemohon)</th>
                    <th className="py-3 px-4">Departemen & Cost Center</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedAuditRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Tidak ada transaksi yang sesuai kriteria filter audit.
                      </td>
                    </tr>
                  ) : (
                    paginatedAuditRecords.map((r, idx) => {
                      const isPaired = r.prPairingKeyType === 'PO' || r.prPairingKeyType === 'PRQ' || (Boolean(r.purchaseReqId) && r.prPairingKeyType !== 'UNPAIRED');
                      return (
                        <tr key={r.id || `po-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {r.purchId || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px]">
                              {r.hospitalCode || '0000'}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-[260px]">
                            <div className="font-semibold text-slate-800 truncate" title={r.itemName}>
                              {r.itemName}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              Vendor: {r.vendorName || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatIDR(r.totalLineAmount || 0)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isPaired ? (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.prPairingKeyType === 'PRQ'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                <CheckCircle2 className="w-3 h-3" />
                                {r.prPairingKeyType === 'PRQ' ? 'PAIRED (PRQ Key)' : 'PAIRED (PO Key)'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Tidak ada PR yang cocok di database (Strict Zero-Assumption)">
                                <AlertCircle className="w-3 h-3" />
                                UNPAIRED (Tanpa PR)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {r.purchaseReqId ? (
                              <span className="font-bold text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                {r.purchaseReqId}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">Belum Ber-PR</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {r.requester ? (
                              <span className="font-mono font-semibold text-purple-800 bg-purple-50/70 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">
                                {r.requester}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {r.department && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {r.department}
                                </span>
                              )}
                              {r.costCenter && (
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded border border-slate-200">
                                  CC:{r.costCenter}
                                </span>
                              )}
                              {!r.department && !r.costCenter && (
                                <span className="text-slate-400 text-[10px]">-</span>
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

            {/* Pagination Controls */}
            {filteredPoAuditRecords.length > AUDIT_PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/60">
                <div className="text-xs text-slate-500">
                  Menampilkan <span className="font-semibold text-slate-700">{((auditPage - 1) * AUDIT_PAGE_SIZE) + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(auditPage * AUDIT_PAGE_SIZE, filteredPoAuditRecords.length)}</span> dari <span className="font-bold text-slate-900">{filteredPoAuditRecords.length.toLocaleString('id-ID')}</span> transaksi PO
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    disabled={auditPage <= 1}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-700 px-2">
                    {auditPage} / {totalAuditPages}
                  </span>
                  <button
                    onClick={() => setAuditPage(p => Math.min(totalAuditPages, p + 1))}
                    disabled={auditPage >= totalAuditPages}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-600" />
                {editingUser ? `Edit Mapping: ${editingUser.username}` : 'Tambah Mapping User ke Departemen'}
              </h3>
              <button 
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Username Requester</label>
                  <input
                    name="username"
                    defaultValue={editingUser?.username || ''}
                    required
                    placeholder="Contoh: carren.mokalu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Cost Center (4-Digit)</label>
                  <input
                    name="costCenter"
                    defaultValue={editingUser?.costCenter || '0003'}
                    required
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="0003"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nama Lengkap Requester</label>
                <input
                  name="fullName"
                  defaultValue={editingUser?.fullName || ''}
                  required
                  placeholder="Contoh: Carren Mokalu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Departemen / Divisi</label>
                <input
                  name="department"
                  defaultValue={editingUser?.department || ''}
                  required
                  placeholder="Contoh: Legal & Corporate Governance"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Hospital Unit (ERP Code)</label>
                <select
                  name="hospitalUnitCode"
                  defaultValue={editingUser?.hospitalUnitCode || '0000'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {hospitalMasters.map(h => (
                    <option key={h.id} value={h.erpHospitalUnitCode || '0000'}>
                      [{h.erpHospitalUnitCode || '0000'}] {h.hospitalName} ({h.hospitalCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingUser?.email || ''}
                    placeholder="user@siloamhospitals.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Jabatan / Role</label>
                  <input
                    name="title"
                    defaultValue={editingUser?.title || ''}
                    placeholder="Senior Buyer"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Simpan Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Upload Data PR File */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-600" />
                  Upload Data PR (Purchase Requisitions)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mendukung file Excel (.xlsx, .xls) atau CSV sesuai format export ERP Siloam.
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setParseResult(null);
                  setUploadSuccessMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadSuccessMsg ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">{uploadSuccessMsg}</h4>
                <p className="text-xs text-slate-500">Database SpendCube berhasil disinkronkan dengan data PR baru.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                    dragActive 
                      ? 'border-purple-500 bg-purple-50/50' 
                      : uploadFile 
                      ? 'border-emerald-300 bg-emerald-50/30' 
                      : 'border-slate-300 hover:border-purple-400 bg-slate-50/50'
                  }`}
                >
                  <input
                    type="file"
                    id="pr-file-input"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="pr-file-input" className="cursor-pointer block">
                    <FileText className={`w-10 h-10 mx-auto mb-2 ${uploadFile ? 'text-emerald-600' : 'text-purple-500'}`} />
                    <span className="text-xs font-bold text-slate-800 block">
                      {uploadFile ? uploadFile.name : 'Klik untuk memilih file Excel PR atau tarik file ke sini'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Kolom yang dibaca: Unit, Purchase Req ID, Subject, Category Type, Requester, Cost Center, Description, ERP ID (No PO), Total Amount
                    </span>
                  </label>
                </div>

                {isParsing && (
                  <div className="py-3 text-center text-xs text-purple-700 font-semibold animate-pulse flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Sedang membaca dan memvalidasi file PR...
                  </div>
                )}

                {parseResult && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2.5">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Hasil Analisis File PR:</span>
                      <span className="text-emerald-700 font-mono font-bold bg-emerald-100 px-2 py-0.5 rounded">
                        {parseResult.records.length} Baris Ditemukan
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Pairing ke PO</span>
                        <span className="font-bold text-emerald-700">{parseResult.pairedCount} Terhubung</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Requester Baru</span>
                        <span className="font-bold text-purple-700">+{parseResult.harvestedUsers.length} Dihimpun</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Total Nilai PR</span>
                        <span className="font-bold text-slate-900 font-mono">{formatIDR(parseResult.totalAmount)}</span>
                      </div>
                    </div>

                    {parseResult.harvestedUsers.length > 0 && (
                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-800 block mb-1">
                          Auto-Harvest Requester ke Master Mapping:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {parseResult.harvestedUsers.slice(0, 5).map(u => (
                            <span key={u.username} className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px]">
                              {u.username} ({u.department})
                            </span>
                          ))}
                          {parseResult.harvestedUsers.length > 5 && (
                            <span className="text-[10px] text-slate-400">+{parseResult.harvestedUsers.length - 5} lainnya</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => downloadPrExcelTemplate()}
                    className="text-xs text-purple-700 hover:text-purple-900 font-semibold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Contoh Template
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer text-xs"
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      disabled={!parseResult || parseResult.records.length === 0 || isParsing}
                      onClick={handleCommitPrUpload}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold shadow-xs cursor-pointer text-xs flex items-center gap-1.5"
                    >
                      <Link className="w-3.5 h-3.5" />
                      Terapkan & Hubungkan ke PO
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
