import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { MonthlyTrendItem, HospitalSpendItem, CategorySpendItem, VendorSpendItem } from '../../../core/types/spend';

interface SpendChartsProps {
  monthlyTrend: MonthlyTrendItem[];
  hospitalSpend: HospitalSpendItem[];
  categorySpend: CategorySpendItem[];
  topVendors: VendorSpendItem[];
}

export const SpendCharts: React.FC<SpendChartsProps> = React.memo(({
  monthlyTrend,
  hospitalSpend,
  categorySpend,
  topVendors
}) => {
  const formatIDRShort = (val: number) => {
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    return `${val}`;
  };

  const COLORS = ['#2563eb', '#4f46e5', '#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#dc2626', '#9333ea'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Monthly Spend Trend */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Monthly Spend Trend (Capex vs Opex)</h3>
            <p className="text-xs text-slate-500">Automated timeline aggregation across all uploaded files</p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> CAPEX
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> OPEX
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="capexColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="opexColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={formatIDRShort} />
              <Tooltip
                formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, '']}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="capex" name="CAPEX" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#capexColor)" />
              <Area type="monotone" dataKey="opex" name="OPEX" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#opexColor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spend by Hospital Facility */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Spend by Hospital / Facility</h3>
            <p className="text-xs text-slate-500">Distribution across hospital codes and entities</p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hospitalSpend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hospitalCode" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={formatIDRShort} />
              <Tooltip
                formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Spend']}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="spend" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spend by Procurement Category */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Top Procurement Categories</h3>
            <p className="text-xs text-slate-500">Breakdown by categorized item groups</p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categorySpend.slice(0, 6)} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={formatIDRShort} />
              <YAxis dataKey="category" type="category" stroke="#64748b" fontSize={10} width={110} tickLine={false} />
              <Tooltip
                formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Spend']}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="spend" fill="#0284c7" radius={[0, 6, 6, 0]}>
                {categorySpend.slice(0, 6).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Vendors Concentration */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Top Supplier Concentration</h3>
            <p className="text-xs text-slate-500">Suppliers with highest total spend volume</p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topVendors.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={formatIDRShort} />
              <YAxis dataKey="vendorName" type="category" stroke="#64748b" fontSize={9} width={120} tickLine={false} />
              <Tooltip
                formatter={(val: any) => [`Rp ${Number(val).toLocaleString()}`, 'Spend']}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="spend" fill="#0d9488" radius={[0, 6, 6, 0]}>
                {topVendors.slice(0, 5).map((_, index) => (
                  <Cell key={`vendor-cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});
