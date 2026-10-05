import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Building2, 
  User, 
  Tag, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  Clock
} from 'lucide-react';
import { 
  PoLineComplianceRecord, 
  COMPLIANCE_CATEGORIES 
} from '../../services/skuPoComplianceService';
import { exportSpendRecordsToCsv } from '../../services/dataExportService';

interface CompliancePoLineTableProps {
  records: PoLineComplianceRecord[];
  onSelectRecord: (record: PoLineComplianceRecord) => void;
}

type SortField = 'purchId' | 'createdDate' | 'hospitalCode' | 'requesterName' | 'totalLineAmount' | 'category';

export const CompliancePoLineTable: React.FC<CompliancePoLineTableProps> = ({
  records,
  onSelectRecord
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortField, setSortField] = useState<SortField>('createdDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Format currency helpers
  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  // Sorting
  const sortedRecords = useMemo(() => {
    const list = [...records];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    return list;
  }, [records, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRecords = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, safeCurrentPage, pageSize]);

  // Adjust page if out of bounds safely via useEffect
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleExportCsv = () => {
    if (records.length === 0) {
      alert('Tidak ada baris PO untuk diekspor.');
      return;
    }

    const headers = [
      'Nomor PO',
      'PO Line',
      'Tanggal Transaksi',
      'Bulan-Tahun',
      'Hospital Unit',
      'Petugas / Pengguna Tercatat',
      'Departemen',
      'File Sumber Excel',
      'Original Cell Content (Raw Upload)',
      'Kode SKU PO',
      'Deskripsi pada PO',
      'Kode Master SKU (MDM)',
      'Deskripsi Master SKU (MDM)',
      'Hasil Pencocokan (Status)',
      'Status Compliance',
      'Kuantitas',
      'Harga Satuan',
      'Total Spend (IDR)',
      'Catatan Temuan',
      'Perbedaan Deskripsi',
      'Rekomendasi Tindakan'
    ];

    const rows = records.map(r => {
      const meta = COMPLIANCE_CATEGORIES[r.category];
      return [
        `"${r.purchId}"`,
        `"${r.lineNumber}"`,
        `"${r.createdDate}"`,
        `"${r.monthYear}"`,
        `"${r.hospitalCode}"`,
        `"${(r.requesterName || r.requester).replace(/"/g, '""')}"`,
        `"${(r.department || '').replace(/"/g, '""')}"`,
        `"${(r.sourceFileName || '').replace(/"/g, '""')}"`,
        `"${(r.poRawItemName || r.poItemName || '').replace(/"/g, '""')}"`,
        `"${(r.poSkuCode || '').replace(/"/g, '""')}"`,
        `"${(r.poItemName || '').replace(/"/g, '""')}"`,
        `"${(r.matchedMaster?.productId || r.matchedMaster?.id || '').replace(/"/g, '""')}"`,
        `"${(r.matchedMaster?.name || '').replace(/"/g, '""')}"`,
        `"${meta.label}"`,
        `"${r.isMatched ? 'MATCH' : 'BELUM MATCH'}"`,
        r.purchQty,
        r.purchPrice,
        r.totalLineAmount,
        `"${(r.findingNote || '').replace(/"/g, '""')}"`,
        `"${(r.diffDescription || '').replace(/"/g, '""')}"`,
        `"${(r.actionRequired || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Compliance_SKU_to_PO_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
      {/* Table Action Bar */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Daftar Detail Baris PO (Tingkat PO Line)</span>
          </h4>
          <p className="text-[11px] text-slate-500">
            Total {records.length.toLocaleString('id-ID')} baris transaksi sesuai kriteria filter
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Page Size Selector */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <span className="text-[11px]">Baris:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Export to CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            title="Ekspor seluruh baris transaksi terfilter ke Excel / CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th 
                onClick={() => handleSort('purchId')}
                className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Nomor PO & Line</span>
                  {sortField === 'purchId' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th 
                onClick={() => handleSort('createdDate')}
                className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Tanggal PO</span>
                  {sortField === 'createdDate' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th 
                onClick={() => handleSort('hospitalCode')}
                className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Unit RS</span>
                  {sortField === 'hospitalCode' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th 
                onClick={() => handleSort('requesterName')}
                className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Petugas / Pengguna</span>
                  {sortField === 'requesterName' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th className="px-3.5 py-3">Kode SKU PO</th>
              <th className="px-4 py-3 min-w-[200px]">Deskripsi pada PO</th>
              <th className="px-4 py-3 min-w-[200px]">Deskripsi Master SKU (MDM)</th>

              <th 
                onClick={() => handleSort('category')}
                className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 transition-colors text-center"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Hasil Pencocokan</span>
                  {sortField === 'category' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th 
                onClick={() => handleSort('totalLineAmount')}
                className="px-3.5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Spend (IDR)</span>
                  {sortField === 'totalLineAmount' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th className="px-3 py-3 text-center">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 font-medium">
            {paginatedRecords.map((r) => {
              const meta = COMPLIANCE_CATEGORIES[r.category];
              return (
                <tr 
                  key={r.id}
                  onClick={() => onSelectRecord(r)}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                >
                  {/* PO Number & Line */}
                  <td className="px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                    <div>{r.purchId}</div>
                    <span className="text-[10px] text-slate-400 font-normal">Line #{r.lineNumber}</span>
                  </td>

                  {/* Date */}
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {r.createdDate}
                  </td>

                  {/* Unit */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                      {r.hospitalCode}
                    </span>
                  </td>

                  {/* Pengguna / Petugas Tercatat */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <p className="font-semibold text-slate-800 truncate max-w-[120px]" title={r.requesterName}>
                      {r.requesterName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {r.department}
                    </p>
                  </td>

                  {/* Kode SKU PO */}
                  <td className="px-3.5 py-2.5 font-mono text-xs">
                    {r.poSkuCode ? (
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {r.poSkuCode}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        (Tanpa Kode)
                      </span>
                    )}
                  </td>

                  {/* PO Item Name */}
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-slate-900 line-clamp-2" title={r.poItemName}>
                      {r.poItemName}
                    </p>
                    {r.poRawItemName && r.poRawItemName !== r.poItemName && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 line-clamp-1 italic" title={`Konten Asli Excel: ${r.poRawItemName}`}>
                        <span className="text-slate-400 font-bold not-italic mr-1">Raw:</span>
                        {r.poRawItemName}
                      </p>
                    )}
                    {r.diffDescription && (
                      <p className="text-[10px] text-amber-700 font-mono mt-0.5 truncate" title={r.diffDescription}>
                        ⚠️ {r.diffDescription}
                      </p>
                    )}
                  </td>

                  {/* Master SKU Item Name */}
                  <td className="px-4 py-2.5">
                    {r.matchedMaster ? (
                      <div>
                        <p className="font-semibold text-slate-800 line-clamp-2" title={r.matchedMaster.name}>
                          {r.matchedMaster.name}
                        </p>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold">
                          MDM: {r.matchedMaster.productId || r.matchedMaster.id}
                        </span>
                      </div>
                    ) : (
                      <span className="text-rose-600 italic text-[11px] font-medium">
                        Tidak terdaftar di MDM
                      </span>
                    )}
                  </td>

                  {/* Hasil Pencocokan Status Badge */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                      <span className={`w-2 h-2 rounded-full ${meta.dotColor}`}></span>
                      <span>{meta.shortLabel}</span>
                    </span>
                  </td>

                  {/* Spend Amount */}
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                    {formatIDR(r.totalLineAmount)}
                  </td>

                  {/* Action Button */}
                  <td className="px-3 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onSelectRecord(r)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Lihat detail audit PO line"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {records.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 space-y-2">
                  <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    Tidak ada baris PO yang cocok dengan kriteria filter.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Coba atur ulang filter pencarian atau pilih bulan/unit lain.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {records.length > 0 && (
        <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Menampilkan baris <strong>{((currentPage - 1) * pageSize) + 1}</strong> -{' '}
            <strong>{Math.min(currentPage * pageSize, sortedRecords.length)}</strong> dari{' '}
            <strong>{sortedRecords.length.toLocaleString('id-ID')}</strong> PO Line
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
