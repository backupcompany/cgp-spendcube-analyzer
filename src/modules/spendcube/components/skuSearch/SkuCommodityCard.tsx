import React from 'react';
import { 
  Copy, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Search, 
  HelpCircle,
  CheckSquare,
  Square
} from 'lucide-react';
import { CommodityGroup, SkuEnrichedWithStats, formatIDR } from './types';

interface SkuCommodityCardProps {
  group: CommodityGroup;
  onOpenDrillDown: (sku: SkuEnrichedWithStats) => void;
  copiedKey: string | null;
  onCopyText: (text: string, key: string) => void;
  selectedProductIds?: Set<string>;
  onToggleSelectSku?: (sku: SkuEnrichedWithStats) => void;
  onToggleSelectGroup?: (group: CommodityGroup) => void;
  excludedProductIds?: Set<string>;
  excludedPresetTitle?: string;
}

export const SkuCommodityCard: React.FC<SkuCommodityCardProps> = ({
  group,
  onOpenDrillDown,
  copiedKey,
  onCopyText,
  selectedProductIds,
  onToggleSelectSku,
  onToggleSelectGroup,
  excludedProductIds,
  excludedPresetTitle
}) => {
  const isUnmappedCommodity = group.isUnmappedGroup || group.purchCategoryLv1 === 'Belum Ter-map' || group.purchCategoryLv1 === 'Unmapped';
  const isGroupCopied = copiedKey === group.commodityName;

  // Check how many skus in this group are selected
  const groupSelectedCount = selectedProductIds 
    ? group.skus.filter(s => selectedProductIds.has(s.productId)).length 
    : 0;
  const isAllGroupSelected = group.skus.length > 0 && groupSelectedCount === group.skus.length;
  const isPartialGroupSelected = groupSelectedCount > 0 && !isAllGroupSelected;

  // Format breadcrumb in uppercase with chevron arrow matching screenshot: "DIAGNOSTIC AND MEDICAL DEVICES › TROLLEYS & CARTS"
  const breadcrumbText = group.breadcrumb 
    ? group.breadcrumb.toUpperCase()
    : `${group.purchCategoryLv1 || ''} › ${group.purchCategoryLv2 || ''}`.toUpperCase();

  return (
    <div className={`bg-white rounded-lg p-3 sm:p-4 border transition-colors ${
      groupSelectedCount > 0 ? 'border-blue-300 bg-blue-50/10 shadow-xs' : 'border-slate-200/80 hover:border-slate-300 shadow-xs'
    }`}>
      {/* 1. Header: Breadcrumb in uppercase muted gray + Group checkbox */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] sm:text-[11px] font-medium tracking-wide text-slate-500 uppercase select-none">
          {breadcrumbText}
        </div>
        {onToggleSelectGroup && (
          <button
            type="button"
            onClick={() => onToggleSelectGroup(group)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-slate-100"
            title={isAllGroupSelected ? 'Batalkan pilihan komoditas ini' : 'Pilih semua baris SKU komoditas ini'}
          >
            {isAllGroupSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-blue-600 fill-blue-50" />
            ) : isPartialGroupSelected ? (
              <div className="w-3.5 h-3.5 border-2 border-blue-600 rounded bg-blue-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-xs" />
              </div>
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="text-[10px]">
              {groupSelectedCount > 0 ? `${groupSelectedCount}/${group.skus.length} dipilih` : 'Pilih Komoditas'}
            </span>
          </button>
        )}
      </div>

      {/* 2. Commodity Title: Bold Royal Blue + Copy icon */}
      <div className="mt-0.5 flex items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a56db] uppercase leading-tight">
          {group.commodityName}
        </h2>
        <button
          type="button"
          onClick={() => onCopyText(group.commodityName, group.commodityName)}
          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer inline-flex items-center"
          title={`Salin nama komoditas: ${group.commodityName}`}
        >
          {isGroupCopied ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>

        {isUnmappedCommodity && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase">
            Belum Terpetakan
          </span>
        )}
      </div>

      {/* 3. SKU Items Container: Indented with left vertical line matching the screenshot */}
      <div className="mt-3 pl-4 sm:pl-5 border-l border-slate-200 space-y-4">
        {group.skus.map((sku, skuIdx) => {
          const isCopied = copiedKey === sku.productId;
          const isInactive = !sku.isActive;
          const isVirtual = sku.isVirtualSku || sku.isUnmappedGroup;
          const isSkuSelected = selectedProductIds ? selectedProductIds.has(sku.productId) : false;

          // Price range string calculation
          let priceDisplay = '-';
          if (sku.minPrice > 0 && sku.maxPrice > 0) {
            if (Math.round(sku.minPrice) === Math.round(sku.maxPrice)) {
              priceDisplay = formatIDR(sku.minPrice);
            } else {
              priceDisplay = `${formatIDR(sku.minPrice)} - ${formatIDR(sku.maxPrice)}`;
            }
          } else if (sku.standardPrice > 0) {
            priceDisplay = formatIDR(sku.standardPrice);
          } else if (sku.avgPrice > 0) {
            priceDisplay = formatIDR(sku.avgPrice);
          } else {
            priceDisplay = 'Rp 0';
          }

          // Format specification text: e.g. "STYLEVIEW • - • -"
          let specLine = sku.specLine;
          if (isVirtual) {
            specLine = sku.canonicalName;
          } else if (!specLine || specLine === '-') {
            const s1 = sku.specSlot1 && sku.specSlot1 !== '-' ? sku.specSlot1.toUpperCase() : '-';
            const s2 = sku.specSlot2 && sku.specSlot2 !== '-' ? sku.specSlot2.toUpperCase() : '-';
            const s3 = sku.specSlot3 && sku.specSlot3 !== '-' ? sku.specSlot3.toUpperCase() : '-';
            specLine = `${s1} • ${s2} • ${s3}`;
          }

          const matchScoreDisplay = `${sku.matchScore || 100}% Match`;
          const rawBrand = (sku.brand || '').trim();
          const hasRealBrand = rawBrand !== '' && rawBrand !== '-' && rawBrand.toUpperCase() !== 'NB' && rawBrand.toUpperCase() !== 'GENERIC';
          const brandDisplay = hasRealBrand ? rawBrand : 'NB';

          const rawPartNumber = (sku.partNumber || '').trim();
          const hasRealPartNumber = rawPartNumber !== '' && rawPartNumber !== '-' && rawPartNumber.toUpperCase() !== 'NP' && rawPartNumber.toUpperCase() !== 'NIHIL';
          const partDisplay = hasRealPartNumber ? rawPartNumber : 'NP';

          const isAlreadyInExcludedCollection = Boolean(
            excludedProductIds && (excludedProductIds.has(sku.productId) || (sku.sku?.id && excludedProductIds.has(sku.sku.id)))
          );

          return (
            <div 
              key={`${sku.productId}-${skuIdx}`} 
              className={`group relative p-1.5 -ml-1.5 rounded-lg transition-colors ${
                isSkuSelected 
                  ? 'bg-blue-50/70 border border-blue-200' 
                  : (isAlreadyInExcludedCollection ? 'bg-purple-50/40 border border-purple-200/60' : 'hover:bg-slate-50/60')
              }`}
            >
              {/* Line 1: Checkbox + Specification name in dark slate */}
              <div className="flex items-center gap-2 flex-wrap">
                {onToggleSelectSku && (
                  isAlreadyInExcludedCollection ? (
                    <span 
                      className="inline-flex items-center p-0.5 text-purple-600 cursor-default"
                      title={`SKU ini sudah ada di Saved Search "${excludedPresetTitle || 'Koleksi'}"`}
                    >
                      <CheckSquare className="w-4 h-4 text-purple-600 fill-purple-100" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleSelectSku(sku)}
                      className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center p-0.5"
                      title={isSkuSelected ? 'Batalkan pilihan SKU ini' : 'Pilih baris SKU ini untuk disimpan'}
                    >
                      {isSkuSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-50" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  )
                )}

                <span className={`text-[13px] sm:text-[14px] font-semibold tracking-wide ${
                  isInactive 
                    ? 'text-rose-700 line-through' 
                    : (isVirtual ? 'text-amber-900' : 'text-slate-800')
                }`}>
                  {specLine}
                </span>

                {/* Status Badges */}
                {isAlreadyInExcludedCollection && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                    <Check className="w-2.5 h-2.5 text-purple-700" />
                    Sudah di "{excludedPresetTitle || 'Koleksi'}"
                  </span>
                )}

                {isVirtual ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    <HelpCircle className="w-2.5 h-2.5 text-amber-700" />
                    Belum Ada Master SKU
                  </span>
                ) : isInactive ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                    Non-Aktif
                  </span>
                ) : null}

                {sku.isSemanticMatch && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                    Semantic
                  </span>
                )}

                {sku.isMatchedViaTransaction && !isVirtual && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    <Search className="w-2.5 h-2.5 text-teal-600" />
                    {sku.matchedViaTransactionCount || sku.transactionCount} PO
                  </span>
                )}
              </div>

              {/* Line 2: Price in Teal/Emerald Bold + metadata items in muted gray */}
              <div className={`mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap leading-relaxed ${
                onToggleSelectSku ? 'pl-6' : ''
              }`}>
                {/* Price in Teal/Green */}
                <span className="font-bold text-[#0d9488] sm:text-[13px]">
                  {priceDisplay}
                </span>
                <span className="text-slate-500 font-normal">
                  / {sku.unitOfMeasurement?.toLowerCase() || 'unit'}
                </span>

                <span className="text-slate-300 font-light">•</span>
                <span className="inline-flex items-center gap-1">
                  Brand: 
                  {hasRealBrand ? (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded font-semibold text-[11px] bg-blue-50 text-blue-700 border border-blue-200/70 shadow-2xs">
                      {brandDisplay}
                    </span>
                  ) : (
                    <span className="font-normal text-slate-400">{brandDisplay}</span>
                  )}
                </span>

                <span className="text-slate-300 font-light">•</span>
                <span>
                  PN: 
                  {hasRealPartNumber ? (
                    <strong className="font-bold text-slate-800 ml-1">{partDisplay}</strong>
                  ) : (
                    <span className="font-normal text-slate-400 ml-1">{partDisplay}</span>
                  )}
                </span>

                <span className="text-slate-300 font-light">•</span>
                <span>
                  ID: <span className="font-mono text-slate-600">{sku.productId}</span>
                  {!isVirtual && (
                    <button
                      type="button"
                      onClick={() => onCopyText(sku.productId, sku.productId)}
                      className="ml-1 text-slate-400 hover:text-slate-700 inline-flex align-middle cursor-pointer"
                      title="Salin ID"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </span>

                <span className="text-slate-300 font-light">•</span>
                <span className="text-slate-500 font-medium">{matchScoreDisplay}</span>

                {/* Drill-down link/button with total Qty & Spend summary */}
                {sku.transactionCount > 0 && (
                  <>
                    <span className="text-slate-300 font-light">•</span>
                    <span className="text-slate-600 font-medium inline-flex items-center gap-1">
                      <span>Total:</span>
                      <strong className="font-semibold text-slate-800">
                        {sku.totalQty.toLocaleString('id-ID')} {sku.unitOfMeasurement || 'Unit'}
                      </strong>
                      <span className="text-slate-500">
                        ({formatIDR(sku.totalSpend)})
                      </span>
                    </span>

                    <span className="text-slate-300 font-light">•</span>
                    <button
                      type="button"
                      onClick={() => onOpenDrillDown(sku)}
                      className="text-[#1a56db] hover:underline font-semibold text-xs cursor-pointer inline-flex items-center gap-0.5"
                      title={`Buka rincian ${sku.transactionCount} transaksi PO`}
                    >
                      <span>Lihat PO ({sku.transactionCount})</span>
                    </button>
                  </>
                )}
              </div>

              {/* Optional: Show full item name from transaction if it is a Virtual/Unmapped SKU */}
              {isVirtual && (
                <div className={`mt-0.5 text-[11px] text-amber-800/90 italic ${onToggleSelectSku ? 'pl-6' : ''}`}>
                  Sumber item transaksi: "{sku.canonicalName}"
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
