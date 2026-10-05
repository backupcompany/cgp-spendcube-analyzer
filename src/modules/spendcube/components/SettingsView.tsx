import React from 'react';
import { Settings, Shield, Database, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SettingsViewProps {
  onResetData: () => void;
  recordCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onResetData, recordCount }) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">System Settings & Configuration</h2>
        <p className="text-xs text-slate-500">Manage database storage, ERP integration mappings, and security preferences</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Database Engine (IndexedDB / Supabase Ready)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Currently running offline-first indexed persistence</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active ({recordCount} Records)
          </span>
        </div>

        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Reset SpendCube Dataset</h3>
            <p className="text-xs text-slate-500 mt-0.5">Hapus ledger di browser ini. Tidak mengirim apa pun ke server.</p>
          </div>
          <button
            onClick={onResetData}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Hapus data lokal</span>
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Multi-Source Schema Mapping</h3>
          <p className="text-xs text-slate-500">The platform automatically normalizes columns from 4 types:</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-blue-600 block">File 1: Capex D365</span>
              <span className="text-slate-500">HospitalCode, PurchId, VendorName, TotalLineAmount</span>
            </li>
            <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-amber-600 block">File 2: Opex D365</span>
              <span className="text-slate-500">HospitalCode, PurchId, VendorName, TotalLineAmount</span>
            </li>
            <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-indigo-600 block">File 3: Capex AX</span>
              <span className="text-slate-500">HospitalCode, MIREFERENCEREQNUM, VENDORNAME</span>
            </li>
            <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-emerald-600 block">File 4: Opex AX</span>
              <span className="text-slate-500">HospitalCode, PurchId, VendorName, TotalLineAmount</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
