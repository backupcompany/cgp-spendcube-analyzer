import React from 'react';
import { 
  ContractPipelineItem, 
  SourcingPipelineStage, 
  SemanticSpendCluster 
} from '../../../core/types/contractTargeting';
import { PriorityBadge, KraljicBadge } from './badges/ContractBadges';
import { 
  BookmarkCheck, 
  Trash2, 
  Sparkles, 
  ChevronRight, 
  User, 
  Calendar, 
  PiggyBank, 
  ArrowRight,
  Eye,
  Layers
} from 'lucide-react';

interface PipelineBoardProps {
  pipelineItems: ContractPipelineItem[];
  onUpdateStage: (itemId: string, newStage: SourcingPipelineStage) => void;
  onRemoveItem: (itemId: string) => void;
  onOpenSourcingBrief: (cluster: SemanticSpendCluster) => void;
  onSelectCluster: (cluster: SemanticSpendCluster) => void;
}

const STAGES: { key: SourcingPipelineStage; label: string; color: string; bg: string; border: string }[] = [
  { key: 'IDENTIFIED', label: '1. Peluang Teridentifikasi', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'SOURCING_RFP', label: '2. Proses Tender & RFP', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'RATE_NEGOTIATION', label: '3. Negosiasi Tarif & MFC', color: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'CONTRACTED_ACTIVE', label: '4. Kontrak Aktif Terbit', color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' }
];

export const TargetingPipelineBoard: React.FC<PipelineBoardProps> = ({
  pipelineItems,
  onUpdateStage,
  onRemoveItem,
  onOpenSourcingBrief,
  onSelectCluster
}) => {
  const formatIDR = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  const totalPipelineSavings = pipelineItems.reduce((acc, item) => acc + (item.targetSavingIdr || 0), 0);

  if (pipelineItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
        <BookmarkCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="font-bold text-slate-800 text-sm">Belum Ada Komoditas di Pipeline Sourcing</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
          Gunakan tombol "Pin ke Pipeline" pada tabel kluster komoditas untuk menandai dan melacak progres inisiasi kontrak payung tim Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline Header Summary */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center font-bold text-sm shadow-2xs">
            {pipelineItems.length}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Sourcing &amp; Contract Management Pipeline
            </h3>
            <p className="text-[11px] text-slate-500">
              Pelacakan progres lelang tender dan standardisasi kontrak korporat
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2">
          <PiggyBank className="w-5 h-5 text-emerald-600" />
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800">Total Target Savings Pipeline</div>
            <div className="text-sm font-black text-emerald-700">{formatIDR(totalPipelineSavings)}</div>
          </div>
        </div>
      </div>

      {/* 4-Stage Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAGES.map((stage) => {
          const itemsInStage = pipelineItems.filter((i) => i.stage === stage.key);

          return (
            <div
              key={stage.key}
              className={`rounded-2xl border ${stage.border} ${stage.bg} p-3.5 flex flex-col space-y-3 shadow-2xs min-h-[400px]`}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between border-b border-black/5 pb-2">
                <span className={`font-extrabold text-xs ${stage.color}`}>
                  {stage.label}
                </span>
                <span className="w-5 h-5 rounded-full bg-white text-slate-800 text-[10px] font-bold flex items-center justify-center shadow-2xs">
                  {itemsInStage.length}
                </span>
              </div>

              {/* Items in stage */}
              <div className="space-y-2.5 flex-1 overflow-y-auto">
                {itemsInStage.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-[11px] italic">
                    Belum ada item di tahapan ini
                  </div>
                ) : (
                  itemsInStage.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2.5 hover:shadow-sm transition-shadow"
                    >
                      {/* Top badging */}
                      <div className="flex items-center justify-between">
                        <PriorityBadge priority={item.cluster.opportunityPriority} />
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          title="Hapus dari Pipeline"
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Cluster Name */}
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-2">
                          {item.cluster.clusterName}
                        </h4>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {item.cluster.categoryLv1} &gt; {item.cluster.categoryLv2}
                        </div>
                      </div>

                      {/* Numbers */}
                      <div className="bg-slate-50 rounded-lg p-2 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Total Belanja:</span>
                          <span className="font-bold text-slate-900">{formatIDR(item.cluster.totalSpend)}</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-700 font-bold">
                          <span>Target Hemat:</span>
                          <span>{formatIDR(item.targetSavingIdr)}</span>
                        </div>
                      </div>

                      {/* Stage Selector Dropdown */}
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                          Pindah Tahapan:
                        </label>
                        <select
                          value={item.stage}
                          onChange={(e) => onUpdateStage(item.id, e.target.value as SourcingPipelineStage)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          {STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <button
                          onClick={() => onSelectCluster(item.cluster)}
                          className="text-[10px] font-bold text-slate-600 hover:text-blue-600 flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Detail</span>
                        </button>

                        <button
                          onClick={() => onOpenSourcingBrief(item.cluster)}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>RFP Brief</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
