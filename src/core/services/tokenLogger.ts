import { TokenLogEntry } from '../types/spend';
import { saveTokenLog, getAllTokenLogs, clearTokenLogs } from '../db/db';

const USD_TO_IDR = 18000;

// Gemini 3.8 / 2.5 Flash pricing per 1M tokens approx: Input $0.075, Output $0.30
const COST_PER_INPUT_TOKEN = 0.075 / 1000000;
const COST_PER_OUTPUT_TOKEN = 0.30 / 1000000;

export async function logAiUsage(
  model: string,
  actionType: string,
  promptTokens: number,
  responseTokens: number,
  promptText?: string,
  responseText?: string,
  metadata?: Record<string, any>
): Promise<TokenLogEntry> {
  const totalTokens = promptTokens + responseTokens;
  const costUsd = (promptTokens * COST_PER_INPUT_TOKEN) + (responseTokens * COST_PER_OUTPUT_TOKEN);
  const costIdr = costUsd * USD_TO_IDR;

  const entry: TokenLogEntry = {
    id: `tok_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    model,
    actionType,
    promptTokens,
    responseTokens,
    totalTokens,
    costUsd,
    costIdr,
    promptText,
    responseText,
    metadata
  };

  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    try {
      await saveTokenLog(entry);
    } catch (err) {
      console.warn('Failed to save token log:', err);
    }
  }

  return entry;
}

export async function ensureInitialTokenLogs(): Promise<void> {
  try {
    const existing = await getAllTokenLogs();
    if (existing.length > 0 && existing.every((entry) => entry.id.startsWith('tok_seed_'))) {
      await clearTokenLogs();
    }
  } catch (err) {
    console.error('Failed to clear demo token logs:', err);
  }
}

export const tokenLogger = {
  logAiCall: async ({
    model,
    actionType,
    promptTokens,
    responseTokens,
    promptText,
    responseText,
    metadata
  }: {
    model: string;
    actionType: string;
    promptTokens: number;
    responseTokens: number;
    promptText?: string;
    responseText?: string;
    metadata?: Record<string, any>;
  }) => {
    return logAiUsage(model, actionType, promptTokens, responseTokens, promptText, responseText, metadata);
  },
  ensureInitialLogs: ensureInitialTokenLogs
};
