import React from 'react';
import { 
  Building2, 
  User, 
  AlertTriangle, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  FileText,
  HelpCircle
} from 'lucide-react';
import { EntityComplianceSummary } from '../../services/skuPoComplianceService';

interface ComplianceFollowUpCardsProps {
  topHospitals: EntityComplianceSummary[];
  topUsers: EntityComplianceSummary[];
  onSelectHospital: (hCode: string) => void;
  onSelectUser: (user: string) => void;
}

export const ComplianceFollowUpCards: React.FC<ComplianceFollowUpCardsProps> = ({
  topHospitals,
  topUsers,
  onSelectHospital,
  onSelectUser
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Unit RS yang Memerlukan Tindak Lanjut Standarisasi SKU */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Unit RS Perlu Tindak Lanjut
              </h4>
              <p className="text-[11px] text-slate-500">
                Peringkat cabang RS dengan PO line belum match terbanyak
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
            Audit Prioritas
          </span>
        </div>

        <div className="space-y-2">
          {topHospitals.slice(0, 5).map((h, idx) => (
            <div
              key={h.key}
              onClick={() => onSelectHospital(h.key)}
              className="p-2.5 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/40 transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  idx === 0 ? 'bg-rose-600 text-white' : idx === 1 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {h.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Total {h.totalPoLines} PO Line • {h.codeNotInMdmCount} Kode Belum di MDM
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 flex items-center space-x-3">
                <div>
                  <span className="text-xs font-bold text-rose-700 font-mono">
                    {h.unmatchedCount} Belum Match
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {h.unmatchedPercent}% Non-Compliant
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
          {topHospitals.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Semua unit RS 100% compliant.</p>
          )}
        </div>
      </div>

      {/* 2. Pengguna / Petugas Tercatat yang Memerlukan Pembinaan Disiplin SKU */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Pengguna / Petugas Tercatat
              </h4>
              <p className="text-[11px] text-slate-500">
                Akun requester pada transaksi yang membutuhkan panduan katalog
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
            Pendampingan
          </span>
        </div>

        <div className="space-y-2">
          {topUsers.slice(0, 5).map((u, idx) => (
            <div
              key={u.key}
              onClick={() => onSelectUser(u.key)}
              className="p-2.5 rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  idx === 0 ? 'bg-indigo-600 text-white' : idx === 1 ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                    {u.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Total {u.totalPoLines} PO Line • {u.codeDiffDescCount} Deskripsi Diedit
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 flex items-center space-x-3">
                <div>
                  <span className="text-xs font-bold text-rose-700 font-mono">
                    {u.unmatchedCount} Belum Match
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {u.unmatchedPercent}% Non-Compliant
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
          {topUsers.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Semua pengguna 100% compliant.</p>
          )}
        </div>

        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-[10px] text-slate-500 flex items-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>Catatan Audit:</strong> Menampilkan nama pengguna yang tercatat pada PO (Requester). Data ini adalah titik kontak koordinasi untuk sosialisasi katalog MDM, bukan penetapan kesalahan sepihak.
          </span>
        </div>
      </div>
    </div>
  );
};
