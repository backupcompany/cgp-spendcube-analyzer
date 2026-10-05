import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, UserCheck } from 'lucide-react';
import { FileSourceType, SpendRecord, UploadedBatchMeta } from '../../../core/types/spend';
import { parseExcelFileWithDetails } from '../services/excelParser';
import { parsePrFile } from '../services/prParser';
import { spendService } from '../services/spendService';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newRecords: SpendRecord[], meta: UploadedBatchMeta) => void;
  onUploadMultipleBatches?: (batches: Array<{ records: SpendRecord[]; meta: UploadedBatchMeta }>) => void;
  records?: SpendRecord[];
  onPrUploadSuccess?: () => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onUploadMultipleBatches,
  records = [],
  onPrUploadSuccess
}) => {
  const [selectedType, setSelectedType] = useState<string>('capex_d365');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const fileTypes = [
    { type: 'capex_d365', label: 'File 1: Capex D365', desc: 'Capital expenditure from Microsoft Dynamics 365' },
    { type: 'opex_d365', label: 'File 2: Opex D365', desc: 'Operational expenditure from Microsoft Dynamics 365' },
    { type: 'capex_ax', label: 'File 3: Capex AX', desc: 'Capital expenditure from Microsoft Dynamics AX' },
    { type: 'opex_ax', label: 'File 4: Opex AX', desc: 'Operational expenditure from Microsoft Dynamics AX' },
    { type: 'pr_requisition', label: 'File 5: Data PR & Requester', desc: 'Key: Purchase Req ID. ERP ID dipairing ke PO spend data & map requester ke dept' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleProcessUpload = async () => {
    if (!file) {
      setError('Please select an Excel or CSV file to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedType === 'pr_requisition') {
        const existingPoSet = new Set(records.map(r => (r.purchId || '').trim().toUpperCase()).filter(Boolean));
        const prResult = await parsePrFile(file, existingPoSet);
        const addResult = await spendService.addPrBatch(prResult.prs, prResult.harvestedUsers);
        if (onPrUploadSuccess) {
          await onPrUploadSuccess();
        }
        setSuccessMsg(`Berhasil memuat ${prResult.prs.length} Record PR (Key: Purchase Req ID) & memetakan ${addResult.addedUserCount} Requester ke Departemen!`);
        setTimeout(() => {
          setSuccessMsg(null);
          setFile(null);
          onClose();
        }, 1800);
        return;
      }

      const result = await parseExcelFileWithDetails(file, selectedType as FileSourceType);
      const meta: UploadedBatchMeta = {
        id: `upload-${Date.now()}`,
        fileName: file.name,
        fileType: selectedType as FileSourceType,
        recordCount: result.records.length,
        totalValue: result.totalValue,
        totalQty: result.totalQty,
        skippedCount: result.skippedCount,
        uploadedAt: new Date().toISOString()
      };

      onUploadSuccess(result.records, meta);
      setSuccessMsg(`Successfully imported ${result.records.length.toLocaleString('id-ID')} records (${result.skippedCount} non-item rows ignored)!`);
      setTimeout(() => {
        setSuccessMsg(null);
        setFile(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to parse Excel file. Please check format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Upload Spend Transaction File</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Source File Type (1 of 4 Types)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {fileTypes.map(ft => (
                <button
                  key={ft.type}
                  type="button"
                  onClick={() => setSelectedType(ft.type)}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    selectedType === ft.type
                      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <p className={`text-xs font-bold ${selectedType === ft.type ? 'text-blue-900' : 'text-slate-900'}`}>
                    {ft.label}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{ft.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Choose Excel (.xlsx, .xls) or CSV File
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload-input"
              />
              <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2 shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Excel or CSV with procurement line items</p>
              </label>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || loading}
            onClick={handleProcessUpload}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center space-x-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Process & Merge SpendCube</span>
          </button>
        </div>
      </div>
    </div>
  );
};
