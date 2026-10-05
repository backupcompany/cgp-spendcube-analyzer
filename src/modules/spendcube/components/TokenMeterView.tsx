import React, { useState, useEffect, useMemo } from 'react';
import { TokenLogEntry } from '../../../core/types/spend';
import { getAllTokenLogs, clearTokenLogs } from '../../../core/db/db';
import { ensureInitialTokenLogs, logAiUsage } from '../../../core/services/tokenLogger';
import { 
  Cpu, 
  Coins, 
  DollarSign, 
  Activity, 
  RefreshCw, 
  Trash2, 
  Zap, 
  ShieldCheck, 
  ArrowUpRight, 
  BarChart3, 
  Database,
  Eye,
  X,
  Copy,
  Check,
  Terminal,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';

export const TokenMeterView: React.FC = () => {
  const [logs, setLogs] = useState<TokenLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<TokenLogEntry | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'prompt' | 'response' | 'both'>('both');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      await ensureInitialTokenLogs();
      const data = await getAllTokenLogs();
      // Sort descending by timestamp
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(data);
    } catch (err) {
      console.error('Failed to load token logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all token usage logs?')) {
      await clearTokenLogs();
      await loadLogs();
      setSelectedLog(null);
      setNotification('Token usage logs cleared successfully.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSimulateCall = async () => {
    const actions = [
      {
        action: 'Stage 1: Intent & Product Expansion',
        prompt: `Anda adalah AI Procurement Engine Siloam Hospitals SpendCube.\nKueri: "departmen apa yang membeli kertas dan bahan sejenisnya di rumah sakit SHLV selama bulan april dan mei"\nTugas: Ekstrak intent, produk primer, sinonim bilingual, multi-bulan, dan batasan awal.`,
        response: JSON.stringify({
          userQuery: "departmen apa yang membeli kertas dan bahan sejenisnya di rumah sakit SHLV selama bulan april dan mei",
          intentType: "DEPARTMENT_BREAKDOWN",
          primaryProductName: "kertas",
          productSynonyms: ["kertas", "paper", "hvs", "continuous form", "amplop", "kertas thermal", "blanko"],
          initialConstraints: {
            hospitalCodes: ["SHLV"],
            period: { months: ["2026-04", "2026-05"] }
          }
        }, null, 2)
      },
      {
        action: 'Stage 2: Candidate Item & Taxonomy Decision',
        prompt: `Pertanyaan Pengguna: "departmen apa yang membeli kertas dan bahan sejenisnya di rumah sakit SHLV selama bulan april dan mei"\nKandidat Item: ["Kertas HVS A4 80gr", "Continuous Form 4 Ply", "Amplop Putih", "Paper Cup 8oz"]\nTugas: Tentukan item include/exclude (Zero False Positive) dan Taxonomy Role.`,
        response: JSON.stringify({
          selectedItemIncludes: ["kertas", "paper", "hvs", "continuous form", "amplop"],
          selectedItemExcludes: ["cup", "paper cup", "tissue", "box"],
          taxonomyDecision: { role: "SEARCH_CONTEXT_ONLY", explanation: "ATK hanya sebagai konteks pencarian item." },
          periodFilter: { months: ["2026-04", "2026-05"] }
        }, null, 2)
      },
      {
        action: 'Stage 4: Executive Narrative Synthesis',
        prompt: `Pertanyaan Pengguna: "departmen apa yang membeli kertas dan bahan sejenisnya di rumah sakit SHLV selama bulan april dan mei"\nStatistik Terhitung: Total Spend Rp 48.750.000, 18 PO, 45 PO Lines. Distribusi Departemen: Rawat Inap (Rp 22.500.000), Farmasi (Rp 14.200.000), Umum & GA (Rp 12.050.000).`,
        response: `### Jawaban Eksekutif Langsung\nTercatat ada 3 departemen di Siloam Hospitals Lippo Village (SHLV) yang melakukan pengadaan kertas dan bahan sejenisnya selama bulan April dan Mei 2026 senilai Rp 48.750.000 (18 PO unik).\n\n1. Rawat Inap: Rp 22.500.000\n2. Farmasi: Rp 14.200.000\n3. Umum & GA: Rp 12.050.000`
      }
    ];

    const pick = actions[Math.floor(Math.random() * actions.length)];
    const promptTok = Math.floor(Math.random() * 1200) + 600;
    const respTok = Math.floor(Math.random() * 500) + 200;

    await logAiUsage('gemini-3.8-flash', pick.action, promptTok, respTok, pick.prompt, pick.response);
    await loadLogs();
    setNotification(`Simulated AI invocation recorded: ${pick.action} (${promptTok + respTok} tokens)`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCopyText = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const totals = useMemo(() => {
    let totalPrompt = 0;
    let totalResp = 0;
    let totalTokens = 0;
    let totalUsd = 0;
    let totalIdr = 0;

    for (const log of logs) {
      totalPrompt += log.promptTokens || 0;
      totalResp += log.responseTokens || 0;
      totalTokens += log.totalTokens || 0;
      totalUsd += log.costUsd || 0;
      totalIdr += log.costIdr || 0;
    }

    return { totalPrompt, totalResp, totalTokens, totalUsd, totalIdr };
  }, [logs]);

  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatUSD = (val: number) => `$ ${Number(val || 0).toFixed(4)}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
      {/* ERP System Control Bar (Token Accounting Ribbon) */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        {/* Top Meta & System Context Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">ERP AI TELEMETRY & AUDIT LEDGER</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>
                  FX: 1 USD = Rp 18,000
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Gemini Model Inference Consumption, Token Meter & Audit Ledger
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSimulateCall}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Simulate AI Call</span>
            </button>
            <button
              onClick={loadLogs}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-all shadow-2xs cursor-pointer"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="p-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg transition-all shadow-2xs cursor-pointer"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* High-Density KPI Ledger Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 sm:divide-x divide-slate-100 bg-white">
          <div className="p-3.5">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 uppercase">
              <span>Total Cost (IDR)</span>
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-700 mt-1">
              {formatIDR(totals.totalIdr)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
              Fixed rate @ Rp 18,000 / USD
            </div>
          </div>

          <div className="p-3.5">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 uppercase">
              <span>Total Cost (USD)</span>
              <DollarSign className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-blue-700 mt-1">
              {formatUSD(totals.totalUsd)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
              Gemini 3.8 / 2.5 Flash Pricing
            </div>
          </div>

          <div className="p-3.5">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 uppercase">
              <span>Total Tokens</span>
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
              {totals.totalTokens.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-sans truncate">
              Prompt: {totals.totalPrompt.toLocaleString()} | Resp: {totals.totalResp.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 uppercase">
              <span>Total Invocations</span>
              <Activity className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-purple-700 mt-1">
              {logs.length} Calls
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
              Click any row to inspect prompt & response
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-900 text-xs shadow-xs animate-in fade-in">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{notification}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">Granular AI Invocation Ledger</h3>
            <p className="text-[11px] text-slate-500">Klik baris mana saja untuk melihat prompt yang dikirim ke AI dan respons jawabannya secara lengkap</p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-0.5 bg-slate-200/70 text-slate-800 rounded-md font-bold">
            {logs.length} Entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200 font-mono text-[11px]">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Model</th>
                <th className="py-2.5 px-4">Action Type</th>
                <th className="py-2.5 px-4 text-right">Prompt Tokens</th>
                <th className="py-2.5 px-4 text-right">Response Tokens</th>
                <th className="py-2.5 px-4 text-right">Total Tokens</th>
                <th className="py-2.5 px-4 text-right">Cost (USD)</th>
                <th className="py-2.5 px-4 text-right">Cost (IDR)</th>
                <th className="py-2.5 px-4 text-center">Prompt / Resp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                    <Cpu className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-1" />
                    <p className="font-bold text-slate-700 text-xs">No token usage logs recorded</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Execute AI analysis or simulate a call to record telemetry.</p>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2.5 px-4 font-bold text-indigo-700">{log.model}</td>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-900">{log.actionType}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{log.promptTokens?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{log.responseTokens?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">{log.totalTokens?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-blue-600">{formatUSD(log.costUsd)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-600">{formatIDR(log.costIdr)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white rounded text-[11px] font-sans font-semibold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL: PROMPT & RESPONSE AUDIT INSPECTOR */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-mono shadow-xs">
                  <Terminal className="w-4 h-4 text-indigo-200" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-bold">AI INVOCATION AUDIT</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                      {selectedLog.model}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {selectedLog.actionType}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-slate-400 text-[10px] block">TIMESTAMP</span>
                  <span className="font-semibold text-slate-700">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div>
                  <span className="text-slate-400 text-[10px] block">TOTAL TOKENS</span>
                  <span className="font-bold text-indigo-700">{selectedLog.totalTokens?.toLocaleString()}</span>
                  <span className="text-slate-400 text-[10px] ml-1">({selectedLog.promptTokens} in / {selectedLog.responseTokens} out)</span>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div>
                  <span className="text-slate-400 text-[10px] block">INFERENCE COST</span>
                  <span className="font-bold text-emerald-700">{formatIDR(selectedLog.costIdr)}</span>
                  <span className="text-slate-400 text-[10px] ml-1">({formatUSD(selectedLog.costUsd)})</span>
                </div>
              </div>

              {/* View Switcher */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs text-[11px] font-sans font-semibold">
                <button
                  onClick={() => setActiveModalTab('both')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${activeModalTab === 'both' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setActiveModalTab('prompt')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${activeModalTab === 'prompt' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Prompt Sent
                </button>
                <button
                  onClick={() => setActiveModalTab('response')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${activeModalTab === 'response' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  AI Response
                </button>
              </div>
            </div>

            {/* Modal Body: Prompt & Response */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              <div className={`grid gap-4 ${activeModalTab === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* PROMPT PANEL */}
                {(activeModalTab === 'both' || activeModalTab === 'prompt') && (
                  <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 flex flex-col overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-mono font-bold text-slate-300">Prompt Sent to AI</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {selectedLog.promptTokens} Tokens
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyText(selectedLog.promptText || 'No prompt recorded', 'prompt')}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors cursor-pointer"
                      >
                        {copiedSection === 'prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSection === 'prompt' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="p-4 overflow-x-auto text-[11px] font-mono leading-relaxed max-h-[420px] overflow-y-auto whitespace-pre-wrap selection:bg-indigo-600 text-slate-200">
                      {selectedLog.promptText || (
                        <div className="text-slate-500 italic py-8 text-center">
                          Tidak ada teks prompt mentah yang terekam pada pemanggilan ini.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* RESPONSE PANEL */}
                {(activeModalTab === 'both' || activeModalTab === 'response') && (
                  <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 flex flex-col overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-mono font-bold text-slate-300">Response Received</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {selectedLog.responseTokens} Tokens
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyText(selectedLog.responseText || 'No response recorded', 'response')}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors cursor-pointer"
                      >
                        {copiedSection === 'response' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSection === 'response' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="p-4 overflow-x-auto text-[11px] font-mono leading-relaxed max-h-[420px] overflow-y-auto whitespace-pre-wrap selection:bg-emerald-600 text-emerald-300">
                      {selectedLog.responseText || (
                        <div className="text-slate-500 italic py-8 text-center">
                          Tidak ada respons teks mentah yang terekam pada pemanggilan ini.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                ID Invocations: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">{selectedLog.id}</code>
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                Tutup Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
