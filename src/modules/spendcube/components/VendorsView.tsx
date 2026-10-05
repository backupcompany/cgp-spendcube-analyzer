import React from 'react';
import { SpendRecord, VendorSpendItem } from '../../../core/types/spend';
import { Building2, Search, ExternalLink, ShieldCheck, Award } from 'lucide-react';

interface VendorsViewProps {
  records: SpendRecord[];
  topVendors: VendorSpendItem[];
}

export const VendorsView: React.FC<VendorsViewProps> = ({ records, topVendors }) => {
  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString()}`;

  const totalSpend = topVendors.reduce((acc, v) => acc + v.spend, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Vendor Directory & Spend Concentration</h2>
          <p className="text-xs text-slate-500">Consolidated supplier performance and expenditure breakdown across D365 & AX</p>
        </div>
        <div className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-200">
          {topVendors.length} Active Suppliers Tracked
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topVendors.slice(0, 3).map((v, i) => {
          const share = totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0;
          return (
            <div key={v.vendorName} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Rank #{i + 1}
                  </span>
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 line-clamp-1" title={v.vendorName}>
                  {v.vendorName}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{v.transactionsCount} Purchase Orders</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Total Spend</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">{formatIDR(v.spend)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Share</span>
                  <span className="text-xs font-bold text-blue-600">{share.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Complete Supplier Spend Summary</h3>
          <span className="text-xs text-slate-500">Sorted by highest expenditure</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4 text-center">PO Count</th>
                <th className="py-3 px-4 text-right">Total Spend (IDR)</th>
                <th className="py-3 px-4 text-right">% of Total Spend</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {topVendors.map((v, i) => {
                const share = totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0;
                return (
                  <tr key={v.vendorName} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span>{v.vendorName}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-600">{v.transactionsCount}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatIDR(v.spend)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-600">{share.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" /> Verified Vetted
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
