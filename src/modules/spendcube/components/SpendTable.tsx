import React, { useState } from 'react';
import { SpendRecord, SkuMasterRecord } from '../../../core/types/spend';
import { spendService } from '../services/spendService';
import { ChevronLeft, ChevronRight, Eye, FileText, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface SpendTableProps {
  records: SpendRecord[];
  skuMasters: SkuMasterRecord[];
  onSelectRecord: (record: SpendRecord) => void;
}

export const SpendTable: React.FC<SpendTableProps> = React.memo(({ records, skuMasters, onSelectRecord }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const totalPages = Math.ceil(records.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentRecords = records.slice(startIndex, startIndex + pageSize);

  const skuMap = React.useMemo(() => {
    const map = new Map<string, SkuMasterRecord>();
    for (const s of skuMasters) {
      if (s.id) map.set(s.id, s);
      if (s.productId) map.set(s.productId.toLowerCase().trim(), s);
    }
    return map;
  }, [skuMasters]);

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString()}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Consolidated SpendCube Transactions & SKU Matching</h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Showing {records.length > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + pageSize, records.length)} of {records.length} items
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
              <th className="py-3 px-4">PO ID</th>
              <th className="py-3 px-4">Hospital</th>
              <th className="py-3 px-4">Vendor Name</th>
              <th className="py-3 px-4">Item Name (Taxonomy Lv 5)</th>
              <th className="py-3 px-4">SKU Master Match</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">Total Amount (IDR)</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {currentRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No spend transactions match the current filter criteria.
                </td>
              </tr>
            ) : (
              currentRecords.map(r => {
                const matchedSku = (r.skuMasterId && skuMap.get(r.skuMasterId)) || spendService.matchTransactionWithSku(r, skuMasters);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{r.purchId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {r.hospitalCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-[160px] truncate" title={r.vendorName}>
                      {r.vendorName}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]" title={r.itemName}>
                      <div className="font-bold text-slate-900 truncate">{r.itemName}</div>
                      <div className="text-[10px] text-slate-400">Lv 5 Taxonomy Name</div>
                    </td>
                    <td className="py-3 px-4">
                      {matchedSku ? (
                        <div className="group relative">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer" title={`Matched with ${matchedSku.name}`}>
                            <CheckCircle2 className="w-3 h-3" /> {matchedSku.productId}
                          </span>
                        </div>
                      ) : r.orphanStatus === 'PARTIAL_ORPHAN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300" title={r.orphanMatchReason || 'Partial Orphan: Commodity Level 5 matches partially'}>
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Partial Orphan</span>
                          {r.orphanConfidenceScore ? <span className="text-[9px] font-bold text-amber-700">({r.orphanConfidenceScore}%)</span> : null}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200" title={r.orphanMatchReason || 'Full Orphan: Tidak ada kecocokan master SKU'}>
                          <AlertCircle className="w-3 h-3 text-rose-500" />
                          <span>Full Orphan</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.purchaseCategory === 'CAPEX'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {r.purchaseCategory}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatIDR(r.totalLineAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectRecord(r)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details & SKU Match"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

