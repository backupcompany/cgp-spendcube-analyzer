import React, { useState } from 'react';
import { ManualFilterCard, ManualFilterField } from '../../../core/types/spend';
import { AVAILABLE_FILTER_FIELDS, FilterFieldDefinition } from '../services/manualFilterEvaluator';
import { Plus, Trash2, Copy, X, Check, Filter, Layers, ChevronDown, Sparkles, AlertCircle } from 'lucide-react';

interface ManualFilterCardsBuilderProps {
  cards: ManualFilterCard[];
  onChange: (cards: ManualFilterCard[]) => void;
  onApply?: () => void;
  onSavePreset?: () => void;
  onReset?: () => void;
  matchedCount?: number;
  totalRecordsCount?: number;
}

export const ManualFilterCardsBuilder: React.FC<ManualFilterCardsBuilderProps> = ({
  cards,
  onChange,
  onApply,
  onSavePreset,
  onReset,
  matchedCount,
  totalRecordsCount
}) => {
  const [selectedFieldToAdd, setSelectedFieldToAdd] = useState<Record<string, string>>({});

  const handleAddCard = () => {
    const newCard: ManualFilterCard = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      commodity_remark_product: { include: [], exclude: [] },
      vendor_name: { include: [], exclude: [] },
      hospital_code: { include: [], exclude: [] }
    };
    onChange([...cards, newCard]);
  };

  const handleDuplicateCard = (cardIndex: number) => {
    const sourceCard = cards[cardIndex];
    const duplicatedCard: ManualFilterCard = {
      ...JSON.parse(JSON.stringify(sourceCard)),
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    };
    const nextCards = [...cards];
    nextCards.splice(cardIndex + 1, 0, duplicatedCard);
    onChange(nextCards);
  };

  const handleRemoveCard = (cardIndex: number) => {
    if (cards.length <= 1) {
      // Clear current card instead of empty
      onChange([{
        id: `group_${Date.now()}`,
        commodity_remark_product: { include: [], exclude: [] }
      }]);
      return;
    }
    const nextCards = cards.filter((_, idx) => idx !== cardIndex);
    onChange(nextCards);
  };

  const handleFieldChange = (
    cardIndex: number,
    fieldKey: keyof Omit<ManualFilterCard, 'id'>,
    type: 'include' | 'exclude',
    rawText: string
  ) => {
    // Parse comma-separated or semicolon-separated tokens, while preserving raw typing experience
    const tokens = rawText
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const nextCards = [...cards];
    const currentCard = { ...nextCards[cardIndex] };
    const currentField: ManualFilterField = (currentCard[fieldKey] as ManualFilterField) || { include: [], exclude: [] };

    currentCard[fieldKey] = {
      ...currentField,
      [type]: tokens
    };

    nextCards[cardIndex] = currentCard;
    onChange(nextCards);
  };

  const handleAddFieldToCard = (cardIndex: number, fieldKey: string) => {
    if (!fieldKey) return;
    const nextCards = [...cards];
    const currentCard = { ...nextCards[cardIndex] };
    const key = fieldKey as keyof Omit<ManualFilterCard, 'id'>;

    if (!currentCard[key]) {
      currentCard[key] = { include: [], exclude: [] };
    }
    nextCards[cardIndex] = currentCard;
    onChange(nextCards);

    // Reset dropdown
    setSelectedFieldToAdd(prev => ({ ...prev, [currentCard.id]: '' }));
  };

  const handleRemoveFieldFromCard = (cardIndex: number, fieldKey: keyof Omit<ManualFilterCard, 'id'>) => {
    const nextCards = [...cards];
    const currentCard = { ...nextCards[cardIndex] };
    delete currentCard[fieldKey];
    nextCards[cardIndex] = currentCard;
    onChange(nextCards);
  };

  // Helper to format values for comma-separated display
  const getFieldTextValue = (field?: ManualFilterField, type: 'include' | 'exclude' = 'include'): string => {
    if (!field || !field[type]) return '';
    return field[type].join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">Card-Based Condition Groups</h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                {cards.length} Filter Group{cards.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Logic: <span className="font-semibold text-blue-700">AND</span> within each group &bull; <span className="font-semibold text-amber-700">OR</span> across groups
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {matchedCount !== undefined && totalRecordsCount !== undefined && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 mr-2">
              Match: <span className="font-bold text-blue-700">{matchedCount.toLocaleString()}</span> / {totalRecordsCount.toLocaleString()} rows
            </div>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Reset Filters
            </button>
          )}

          <button
            type="button"
            onClick={handleAddCard}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Filter Group</span>
          </button>

          {onSavePreset && (
            <button
              type="button"
              onClick={onSavePreset}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-all"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Save as Preset</span>
            </button>
          )}

          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20"
            >
              <Check className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Cards List with OR Dividers */}
      <div className="space-y-6">
        {cards.map((card, cardIndex) => {
          // Identify which fields are active in this card
          const activeFields = AVAILABLE_FILTER_FIELDS.filter(fieldDef => {
            return card[fieldDef.key] !== undefined;
          });

          // Unused fields that can be added
          const unusedFields = AVAILABLE_FILTER_FIELDS.filter(fieldDef => {
            return card[fieldDef.key] === undefined;
          });

          return (
            <React.Fragment key={card.id || cardIndex}>
              {/* Filter Card Container */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300">
                {/* Card Header (Matching user's exact mockup) */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center shadow-2xs font-mono">
                      {cardIndex + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      Filter Group #{cardIndex + 1}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold">
                      AND logic within group
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicateCard(cardIndex)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-blue-700 transition-all shadow-2xs"
                      title="Duplicate this group"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveCard(cardIndex)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                      title="Remove Filter Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Column Table Header (Contain vs Don't Contain) */}
                <div className="grid grid-cols-12 gap-3 px-6 py-2.5 bg-slate-100/50 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-3">Field Attribute (11 Available)</div>
                  <div className="col-span-4 text-emerald-800 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Contain (Multi comma-separated)</span>
                  </div>
                  <div className="col-span-4 text-rose-800 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                    <span>Don't Contain (Exclude)</span>
                  </div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {/* Active Fields List inside Card */}
                <div className="divide-y divide-slate-100 px-6 py-2">
                  {activeFields.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs">No active condition fields in this group.</p>
                      <p className="text-[11px] text-slate-400">Click below to add conditions.</p>
                    </div>
                  ) : (
                    activeFields.map((fieldDef, fieldIdx) => {
                      const fieldData = card[fieldDef.key] as ManualFilterField | undefined;
                      const includeVal = getFieldTextValue(fieldData, 'include');
                      const excludeVal = getFieldTextValue(fieldData, 'exclude');

                      return (
                        <div key={fieldDef.key} className="py-3">
                          {/* Visual AND divider between rows if > 0 */}
                          {fieldIdx > 0 && (
                            <div className="relative flex py-2 items-center">
                              <div className="flex-grow border-t border-slate-100"></div>
                              <span className="flex-shrink mx-4 px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-extrabold font-mono border border-blue-200/50">
                                AND
                              </span>
                              <div className="flex-grow border-t border-slate-100"></div>
                            </div>
                          )}

                          <div className="grid grid-cols-12 gap-3 items-center">
                            {/* Field Label */}
                            <div className="col-span-3">
                              <span className="text-xs font-bold text-slate-800 block">
                                {fieldDef.label}
                              </span>
                              <span className="text-[10px] text-slate-400 line-clamp-1">
                                {fieldDef.description}
                              </span>
                            </div>

                            {/* Contain (Include) input */}
                            <div className="col-span-4">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder={fieldDef.placeholderInclude}
                                  value={includeVal}
                                  onChange={(e) => handleFieldChange(cardIndex, fieldDef.key, 'include', e.target.value)}
                                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-800 placeholder:text-slate-400 transition-all font-mono"
                                />
                                {fieldData?.include && fieldData.include.length > 0 && (
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {fieldData.include.length}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Don't Contain (Exclude) input */}
                            <div className="col-span-4">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder={fieldDef.placeholderExclude}
                                  value={excludeVal}
                                  onChange={(e) => handleFieldChange(cardIndex, fieldDef.key, 'exclude', e.target.value)}
                                  className="w-full px-3 py-2 text-xs rounded-xl bg-rose-50/20 border border-rose-200/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900 placeholder:text-rose-300 transition-all font-mono"
                                />
                                {fieldData?.exclude && fieldData.exclude.length > 0 && (
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                                    {fieldData.exclude.length}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Remove Field Button */}
                            <div className="col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveFieldFromCard(cardIndex, fieldDef.key)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Remove condition field"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Card Footer: Add more condition fields */}
                {unusedFields.length > 0 && (
                  <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-semibold text-slate-500">+ Add Condition Field:</span>
                      <select
                        value={selectedFieldToAdd[card.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleAddFieldToCard(cardIndex, val);
                          }
                        }}
                        className="text-xs py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">-- Select Field Attribute --</option>
                        {unusedFields.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {activeFields.length} of 11 fields configured
                    </span>
                  </div>
                )}
              </div>

              {/* High-Contrast Prominent OR Divider Between Cards */}
              {cardIndex < cards.length - 1 && (
                <div className="relative flex py-2 items-center justify-center my-2">
                  <div className="flex-grow border-t-2 border-dashed border-amber-300"></div>
                  <div className="mx-6 px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-black tracking-wider shadow-md uppercase flex items-center space-x-1.5 ring-4 ring-amber-100">
                    <span>OR (Match Any Group)</span>
                  </div>
                  <div className="flex-grow border-t-2 border-dashed border-amber-300"></div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Quick Add Filter Group Button at the bottom */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={handleAddCard}
          className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 text-slate-600 hover:text-blue-700 text-xs font-bold transition-all shadow-xs"
        >
          <Plus className="w-4 h-4 text-blue-600" />
          <span>Add Another Filter Group (OR Logic)</span>
        </button>
      </div>
    </div>
  );
};
