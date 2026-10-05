import React, { useState, useMemo } from 'react';
import { SpendRecord, UploadedBatchMeta, MonthlyIngestionRecord } from '../../../../core/types/spend';
import { monthlyIngestionService } from '../../services/monthlyIngestionService';
import { MonthlySummaryCards } from './molecules/MonthlySummaryCards';
import { MonthSelectorBar } from './molecules/MonthSelectorBar';
import { MonthlyChartVisualizer } from './molecules/MonthlyChartVisualizer';
import { MonthlyIngestionTable } from './organisms/MonthlyIngestionTable';
import { MonthlyDetailDrawer } from './organisms/MonthlyDetailDrawer';
import { 
  FileCheck2, 
  CalendarCheck2, 
  Layers, 
  ArrowRight,
  Info,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  records: SpendRecord[];
  uploadedBatches?: UploadedBatchMeta[];
  onSelectRecord?: (record: SpendRecord) => void;
  onRefresh?: () => void;
}

export const MonthlyIngestionHealthView: React.FC<Props> = ({
  records = [],
  uploadedBatches = [],
  onSelectRecord,
  onRefresh
}) => {
  // Available Years
  const availableYears = useMemo(() => {
    return monthlyIngestionService.getAvailableYears(records, uploadedBatches);
  }, [records, uploadedBatches]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return availableYears[0] || new Date().getFullYear();
  });

  // Available Hospitals
  const availableHospitals = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.hospitalCode && r.hospitalCode !== 'UNKNOWN') set.add(r.hospitalCode);
    });
    return Array.from(set).sort();
  }, [records]);

  const [selectedHospital, setSelectedHospital] = useState<string>('ALL');
  const [searchQuery, setSearchTerm] = useState<string>('');
  const [selectedMonthForDetail, setSelectedMonthForDetail] = useState<MonthlyIngestionRecord | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute yearly summary & monthly metrics
  const yearlySummary = useMemo(() => {
    return monthlyIngestionService.computeYearlyReconciliation(
      records,
      uploadedBatches,
      selectedYear,
      selectedHospital
    );
  }, [records, uploadedBatches, selectedYear, selectedHospital]);

  // Filter months if search term is active
  const displayedMonths = useMemo(() => {
    if (!searchQuery.trim()) return yearlySummary.months;
    const q = searchQuery.toLowerCase();
    return yearlySummary.months.filter(m => 
      m.monthNameIndo.toLowerCase().includes(q) ||
      m.monthShortIndo.toLowerCase().includes(q) ||
      m.gregorianPeriod.toLowerCase().includes(q) ||
      m.fileContributions.some(f => f.fileName.toLowerCase().includes(q))
    );
  }, [yearlySummary.months, searchQuery]);

  // Handle Export to Excel/CSV
  const handleExportCsv = () => {
    const exportData = yearlySummary.months.map(m => ({
      'Tahun': m.year,
      'Bulan': m.monthNameIndo,
      'Periode Gregorian': m.gregorianPeriod,
      'Hari Kalender': m.daysInMonth,
      'Belanja OPEX (IDR)': Math.round(m.opexSpend),
      'Qty OPEX (Unit)': m.opexQty,
      'Baris OPEX': m.opexRecordCount,
      'Belanja CAPEX (IDR)': Math.round(m.capexSpend),
      'Qty CAPEX (Unit)': m.capexQty,
      'Baris CAPEX': m.capexRecordCount,
      'Total Belanja (IDR)': Math.round(m.totalSpend),
      'Total Qty (Unit)': m.totalQty,
      'Total Baris Transaksi': m.totalRecordCount,
      'Jumlah Berkas Upload': m.filesCount,
      'Baris Unik': m.uniqueLineCount,
      'Baris Ditimpa / Revisi': m.updatedOverwrittenCount,
      'Rasio Keunikan (%)': m.uniquenessRatioPct,
      'Waktu Update Terakhir': m.latestIngestedAt || '-',
      'Status Kelengkapan': m.completenessLabel
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rekonsiliasi_${selectedYear}`);
    XLSX.writeFile(workbook, `Rekonsiliasi_Ingestion_Bulanan_${selectedYear}_${selectedHospital}.xlsx`);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header Guidance Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-blue-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[10px] font-extrabold uppercase tracking-wider">
              Data Ingestion Sensing
            </span>
            <span className="text-xs text-blue-200/80 font-mono">
              Standar Kalender Gregorian (Tgl 1 - 31)
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-white">
            Rekonsiliasi &amp; Kesehatan Ingestion Bulanan
          </h2>
          <p className="text-xs text-blue-100/80 leading-relaxed">
            Pantau ringkasan belanja OPEX dan CAPEX bulanan, volume unit, jumlah berkas sumber, serta keunikan data transaksi untuk memastikan kelengkapan aggregate sebelum dibandingkan secara manual dengan laporan ERP.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-right">
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Total Transaksi Aktif</span>
            <span className="text-base font-black text-white font-mono">
              {records.length.toLocaleString('id-ID')} <span className="text-xs font-sans font-normal text-blue-200">baris</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <MonthlySummaryCards summary={yearlySummary} />

      {/* Filter & Action Bar */}
      <MonthSelectorBar
        availableYears={availableYears}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        availableHospitals={availableHospitals}
        selectedHospital={selectedHospital}
        onSelectHospital={setSelectedHospital}
        searchQuery={searchQuery}
        onSearchChange={setSearchTerm}
        onExportCsv={handleExportCsv}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Visualizer: Monthly Spend & Volume Trends */}
      <MonthlyChartVisualizer
        months={yearlySummary.months}
        onSelectMonth={(m) => setSelectedMonthForDetail(m)}
      />

      {/* Detailed Monthly Gregorian Table */}
      <MonthlyIngestionTable
        months={displayedMonths}
        onSelectMonth={(m) => setSelectedMonthForDetail(m)}
      />

      {/* Slide-over Detail Drawer */}
      <MonthlyDetailDrawer
        month={selectedMonthForDetail}
        records={records}
        onClose={() => setSelectedMonthForDetail(null)}
        onSelectRecord={onSelectRecord}
      />
    </div>
  );
};
