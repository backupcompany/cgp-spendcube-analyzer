import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';
import { clearAllSpendRecords, clearSkuMasterRecords, clearHospitalMasterRecords, clearVendorMasterRecords, clearMaintenanceCache } from '../db/db';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isResetting: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isResetting: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SpendCube Uncaught Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetDatabase = async () => {
    try {
      this.setState({ isResetting: true });
      await clearAllSpendRecords();
      await clearSkuMasterRecords();
      await clearHospitalMasterRecords();
      await clearVendorMasterRecords();
      await clearMaintenanceCache();
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset DB from error boundary:', err);
      window.location.reload();
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-700 pb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Terjadi Kendala Saat Memuat SpendCube</h1>
                <p className="text-xs text-slate-400">Sistem mendeteksi galat eksekusi aplikasi atau cache browser</p>
              </div>
            </div>

            <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 text-xs font-mono text-rose-300 overflow-x-auto max-h-48 space-y-2">
              <p className="font-bold">{this.state.error?.name}: {this.state.error?.message}</p>
              {this.state.error?.stack && (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </pre>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Halaman (Reload)</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetDatabase}
                disabled={this.state.isResetting}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-600"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{this.state.isResetting ? 'Mereset Data...' : 'Reset & Pulihkan Sample Data'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
