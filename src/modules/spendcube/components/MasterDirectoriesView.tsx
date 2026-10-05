import React, { useState, useMemo } from 'react';
import { 
  HospitalMasterRecord, 
  VendorMasterRecord 
} from '../../../core/types/spend';
import { 
  Building, 
  Truck, 
  MapPin, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  Globe2, 
  Building2, 
  Phone, 
  Mail, 
  FileText, 
  Sparkles,
  Download,
  RotateCcw,
  Tag
} from 'lucide-react';

interface MasterDirectoriesViewProps {
  hospitalMasters: HospitalMasterRecord[];
  vendorMasters: VendorMasterRecord[];
  initialTab?: 'hospitals' | 'vendors';
  onSaveHospitalMasters: (records: HospitalMasterRecord[]) => void;
  onSaveVendorMasters: (records: VendorMasterRecord[]) => void;
  onResetHospitalMasters: () => void;
  onResetVendorMasters: () => void;
}

export const MasterDirectoriesView: React.FC<MasterDirectoriesViewProps> = ({
  hospitalMasters,
  vendorMasters,
  initialTab = 'hospitals',
  onSaveHospitalMasters,
  onSaveVendorMasters,
  onResetHospitalMasters,
  onResetVendorMasters
}) => {
  const [activeTab, setActiveTab] = useState<'hospitals' | 'vendors'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIsland, setSelectedIsland] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');

  // Modal / Form state for adding/editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<HospitalMasterRecord | null>(null);
  const [editingVendor, setEditingVendor] = useState<VendorMasterRecord | null>(null);

  // Filtered Hospital List
  const filteredHospitals = useMemo(() => {
    return hospitalMasters.filter(h => {
      if (selectedIsland !== 'ALL' && h.island !== selectedIsland) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          h.hospitalCode.toLowerCase().includes(q) ||
          (h.erpHospitalUnitCode && h.erpHospitalUnitCode.includes(q)) ||
          h.hospitalName.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q) ||
          h.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [hospitalMasters, selectedIsland, searchQuery]);

  // Filtered Vendor List
  const filteredVendors = useMemo(() => {
    return vendorMasters.filter(v => {
      if (selectedIsland !== 'ALL' && v.domicileIsland !== selectedIsland) return false;
      if (selectedTier !== 'ALL' && v.tierRating !== selectedTier) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.vendorName.toLowerCase().includes(q) ||
          v.vendorCode.toLowerCase().includes(q) ||
          v.domicileCity.toLowerCase().includes(q) ||
          v.primaryCategory.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vendorMasters, selectedIsland, selectedTier, searchQuery]);

  // Handle Save Hospital
  const handleSaveHospital = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = (formData.get('hospitalCode') as string || '').trim().toUpperCase();
    let erpUnitCode = (formData.get('erpHospitalUnitCode') as string || '').trim();
    
    // Validasi dan format 4 digit angka (0000 s/d 9999)
    if (erpUnitCode) {
      const num = parseInt(erpUnitCode, 10);
      if (!isNaN(num) && num >= 0 && num <= 9999) {
        erpUnitCode = String(num).padStart(4, '0');
      } else {
        erpUnitCode = erpUnitCode.replace(/\D/g, '').slice(0, 4).padStart(4, '0');
      }
    } else {
      erpUnitCode = '0000';
    }

    const name = formData.get('hospitalName') as string;
    const city = formData.get('city') as string;
    const region = formData.get('region') as string;
    const island = formData.get('island') as string;
    const tier = formData.get('hospitalTier') as any;
    const beds = Number(formData.get('bedCapacity')) || 100;
    const address = formData.get('address') as string;

    const existingIndex = hospitalMasters.findIndex(h => h.hospitalCode === code);
    let updated: HospitalMasterRecord[];
    if (existingIndex >= 0) {
      updated = [...hospitalMasters];
      updated[existingIndex] = {
        ...updated[existingIndex],
        erpHospitalUnitCode: erpUnitCode,
        hospitalName: name,
        city,
        region,
        island,
        hospitalTier: tier,
        bedCapacity: beds,
        address
      };
    } else {
      updated = [
        ...hospitalMasters,
        {
          id: `hosp-${code.toLowerCase()}`,
          hospitalCode: code,
          erpHospitalUnitCode: erpUnitCode,
          hospitalName: name,
          city,
          region,
          island,
          hospitalTier: tier,
          bedCapacity: beds,
          address,
          isActive: true
        }
      ];
    }
    onSaveHospitalMasters(updated);
    setIsModalOpen(false);
    setEditingHospital(null);
  };

  // Handle Save Vendor
  const handleSaveVendor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get('vendorCode') as string;
    const name = formData.get('vendorName') as string;
    const cat = formData.get('primaryCategory') as string;
    const city = formData.get('domicileCity') as string;
    const region = formData.get('domicileRegion') as string;
    const island = formData.get('domicileIsland') as string;
    const tier = formData.get('tierRating') as any;
    const npwp = formData.get('npwp') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;

    const existingIndex = vendorMasters.findIndex(v => v.vendorCode === code || v.vendorName === name);
    let updated: VendorMasterRecord[];
    if (existingIndex >= 0) {
      updated = [...vendorMasters];
      updated[existingIndex] = {
        ...updated[existingIndex],
        vendorName: name,
        primaryCategory: cat,
        domicileCity: city,
        domicileRegion: region,
        domicileIsland: island,
        tierRating: tier,
        npwp,
        email,
        phone
      };
    } else {
      updated = [
        ...vendorMasters,
        {
          id: `vend-${Date.now()}`,
          vendorCode: code,
          vendorName: name,
          primaryCategory: cat,
          domicileCity: city,
          domicileRegion: region,
          domicileIsland: island,
          tierRating: tier,
          npwp,
          email,
          phone,
          isActive: true
        }
      ];
    }
    onSaveVendorMasters(updated);
    setIsModalOpen(false);
    setEditingVendor(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Enterprise Master Data Management
              </h2>
              <p className="text-xs text-slate-500">
                Direktori Master Unit Rumah Sakit & Master Vendor terintegrasi informasi geografis (Kota, Region, Pulau)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === 'hospitals') {
                setEditingHospital(null);
              } else {
                setEditingVendor(null);
              }
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah {activeTab === 'hospitals' ? 'Hospital Unit' : 'Vendor'} Master</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Reset Master Data ke konfigurasi default Siloam Hospitals Group?')) {
                if (activeTab === 'hospitals') onResetHospitalMasters();
                else onResetVendorMasters();
              }
            }}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            title="Reset ke Default Sample"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setActiveTab('hospitals');
            setSelectedTier('ALL');
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'hospitals'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Master Hospital Units ({hospitalMasters.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('vendors');
            setSelectedIsland('ALL');
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'vendors'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Master Vendors & Domisili ({vendorMasters.length})</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari ${activeTab === 'hospitals' ? 'rumah sakit, kode, kota...' : 'vendor, NPWP, kategori, domisili...'}`}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs">
          <span className="text-slate-400 text-[11px] font-medium">Pulau:</span>
          {['ALL', 'Jawa', 'Sumatera', 'Bali & Nusa Tenggara', 'Sulawesi', 'Kalimantan'].map((isl) => (
            <button
              key={isl}
              onClick={() => setSelectedIsland(isl)}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                selectedIsland === isl
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isl === 'ALL' ? 'Semua' : isl}
            </button>
          ))}

          {activeTab === 'vendors' && (
            <>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <span className="text-slate-400 text-[11px] font-medium">Tier:</span>
              {['ALL', 'Tier 1 Strategic', 'Tier 2 Preferred', 'Tier 3 Tactical'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                    selectedTier === tier
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tier === 'ALL' ? 'Semua Tier' : tier.replace('Tier ', 'T')}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* TAB 1: Master Hospital Units Table */}
      {activeTab === 'hospitals' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Kode Unit</th>
                  <th className="py-3 px-4">Kode ERP (4-Digit)</th>
                  <th className="py-3 px-4">Nama Rumah Sakit</th>
                  <th className="py-3 px-4">Kota</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4">Pulau</th>
                  <th className="py-3 px-4">Klasifikasi / Tier</th>
                  <th className="py-3 px-4 text-center">Kapasitas TT</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredHospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {h.hospitalCode}
                    </td>
                    <td className="py-3 px-4">
                      <span 
                        className="font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] tracking-wider inline-flex items-center gap-1.5 shadow-2xs"
                        title="Kode Hospital Unit di ERP (0000 s/d 9999)"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        {h.erpHospitalUnitCode || '0000'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {h.hospitalName}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {h.city}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {h.region}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px]">
                        {h.island}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        h.hospitalTier === 'Tertiary Hub' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        h.hospitalTier === 'Secondary Spoke' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        {h.hospitalTier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                      {h.bedCapacity} TT
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setEditingHospital(h);
                          setIsModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Edit Master Data"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Master Vendors & Domicile Table */}
      {activeTab === 'vendors' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Kode & Nama Vendor</th>
                  <th className="py-3 px-4">Kategori Utama</th>
                  <th className="py-3 px-4">Domisili Kota</th>
                  <th className="py-3 px-4">Region & Pulau</th>
                  <th className="py-3 px-4">NPWP</th>
                  <th className="py-3 px-4">Kontak Supplier</th>
                  <th className="py-3 px-4 text-center">Strategic Tier</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{v.vendorName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">Kode: {v.vendorCode}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {v.primaryCategory}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {v.domicileCity}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{v.domicileRegion}</div>
                      <span className="text-[10px] text-slate-400 block">{v.domicileIsland}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                      {v.npwp || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="text-[11px]">{v.email || '-'}</div>
                      <div className="text-[10px] text-slate-400">{v.phone || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        v.tierRating === 'Tier 1 Strategic' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        v.tierRating === 'Tier 2 Preferred' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        {v.tierRating}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setEditingVendor(v);
                          setIsModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Edit Master Vendor"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Master Record */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              {activeTab === 'hospitals'
                ? (editingHospital ? `Edit Hospital Unit: ${editingHospital.hospitalCode}` : 'Tambah Hospital Unit Master')
                : (editingVendor ? `Edit Vendor: ${editingVendor.vendorName}` : 'Tambah Vendor Master')}
            </h3>

            {activeTab === 'hospitals' ? (
              <form onSubmit={handleSaveHospital} className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Kode Unit</label>
                    <input
                      name="hospitalCode"
                      defaultValue={editingHospital?.hospitalCode || ''}
                      required
                      placeholder="SHLV"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase font-mono font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-600 font-semibold truncate">Kode Unit ERP</label>
                      <span className="text-[9px] text-blue-700 font-mono font-bold bg-blue-50 px-1 rounded border border-blue-200">
                        0000-9999
                      </span>
                    </div>
                    <input
                      name="erpHospitalUnitCode"
                      defaultValue={editingHospital?.erpHospitalUnitCode || ''}
                      required
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      placeholder="0001"
                      title="Harus terdiri dari 4 digit angka (0000 s/d 9999)"
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg font-mono font-bold text-blue-900 bg-blue-50/30 tracking-widest text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      onChange={(e) => {
                        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Kapasitas TT</label>
                    <input
                      type="number"
                      name="bedCapacity"
                      defaultValue={editingHospital?.bedCapacity || 150}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="-mt-2 mb-1">
                  <span className="text-[10px] text-slate-400">
                    * Kode Hospital Unit di ERP adalah 4 digit angka (0000 s/d 9999) sesuai ID unit di sistem ERP Siloam.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Nama Rumah Sakit</label>
                  <input
                    name="hospitalName"
                    defaultValue={editingHospital?.hospitalName || ''}
                    required
                    placeholder="Contoh: Siloam Hospitals Lippo Village"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Kota</label>
                    <input
                      name="city"
                      defaultValue={editingHospital?.city || ''}
                      required
                      placeholder="Tangerang"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Region</label>
                    <input
                      name="region"
                      defaultValue={editingHospital?.region || 'Jabodetabek'}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Pulau</label>
                    <select
                      name="island"
                      defaultValue={editingHospital?.island || 'Jawa'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="Jawa">Jawa</option>
                      <option value="Sumatera">Sumatera</option>
                      <option value="Bali & Nusa Tenggara">Bali & Nusa Tenggara</option>
                      <option value="Sulawesi">Sulawesi</option>
                      <option value="Kalimantan">Kalimantan</option>
                      <option value="Papua">Papua</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tier Rumah Sakit</label>
                  <select
                    name="hospitalTier"
                    defaultValue={editingHospital?.hospitalTier || 'Secondary Spoke'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Tertiary Hub">Tertiary Hub (Rujukan Utama)</option>
                    <option value="Secondary Spoke">Secondary Spoke</option>
                    <option value="Primary Clinic">Primary Clinic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Alamat</label>
                  <input
                    name="address"
                    defaultValue={editingHospital?.address || ''}
                    placeholder="Alamat lengkap..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 cursor-pointer"
                  >
                    Simpan Hospital Master
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveVendor} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Kode Vendor</label>
                    <input
                      name="vendorCode"
                      defaultValue={editingVendor?.vendorCode || `VEND-${Date.now().toString().slice(-4)}`}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Kategori Utama</label>
                    <input
                      name="primaryCategory"
                      defaultValue={editingVendor?.primaryCategory || 'Medical Consumables'}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Nama Vendor</label>
                  <input
                    name="vendorName"
                    defaultValue={editingVendor?.vendorName || ''}
                    required
                    placeholder="PT / CV Nama Vendor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Kota Domisili</label>
                    <input
                      name="domicileCity"
                      defaultValue={editingVendor?.domicileCity || 'Jakarta'}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Region</label>
                    <input
                      name="domicileRegion"
                      defaultValue={editingVendor?.domicileRegion || 'Jabodetabek'}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Pulau</label>
                    <select
                      name="domicileIsland"
                      defaultValue={editingVendor?.domicileIsland || 'Jawa'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="Jawa">Jawa</option>
                      <option value="Sumatera">Sumatera</option>
                      <option value="Bali & Nusa Tenggara">Bali & Nusa Tenggara</option>
                      <option value="Sulawesi">Sulawesi</option>
                      <option value="Kalimantan">Kalimantan</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">NPWP</label>
                    <input
                      name="npwp"
                      defaultValue={editingVendor?.npwp || ''}
                      placeholder="01.234.567.8-012.000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Strategic Tier</label>
                    <select
                      name="tierRating"
                      defaultValue={editingVendor?.tierRating || 'Tier 2 Preferred'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="Tier 1 Strategic">Tier 1 Strategic</option>
                      <option value="Tier 2 Preferred">Tier 2 Preferred</option>
                      <option value="Tier 3 Tactical">Tier 3 Tactical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email</label>
                    <input
                      name="email"
                      defaultValue={editingVendor?.email || ''}
                      placeholder="sales@vendor.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Telepon</label>
                    <input
                      name="phone"
                      defaultValue={editingVendor?.phone || ''}
                      placeholder="+62 21..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 cursor-pointer"
                  >
                    Simpan Vendor Master
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
