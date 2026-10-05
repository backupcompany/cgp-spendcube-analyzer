import { currentUser } from '../../../core/auth/auth';

export interface QueryHistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  matchedCount?: number;
  totalSpend?: number;
  intent?: string;
}

function historyKey() {
  return `spendcube_ai_query_history_v1:${currentUser() || 'anon'}`;
}
const MAX_HISTORY_ITEMS = 30;

export const queryHistoryService = {
  getHistory(): QueryHistoryEntry[] {
    try {
      const raw = localStorage.getItem(historyKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const real = parsed.filter((item) => item && !String(item.id || '').startsWith('hist_seed_'));
      if (real.length !== parsed.length) {
        if (real.length === 0) localStorage.removeItem(historyKey());
        else localStorage.setItem(historyKey(), JSON.stringify(real));
      }
      return real;
    } catch (err) {
      console.warn('Failed to read query history from localStorage:', err);
      return [];
    }
  },

  addEntry(query: string, matchedCount?: number, totalSpend?: number, intent?: string): QueryHistoryEntry[] {
    const trimmed = (query || '').trim();
    if (!trimmed) return this.getHistory();

    try {
      const current = this.getHistory();
      // Remove duplicate if same query already exists recently
      const filtered = current.filter(item => item.query.toLowerCase().trim() !== trimmed.toLowerCase());

      const newEntry: QueryHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        query: trimmed,
        timestamp: new Date().toISOString(),
        matchedCount,
        totalSpend,
        intent
      };

      const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(historyKey(), JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.warn('Failed to save query history:', err);
      return this.getHistory();
    }
  },

  deleteEntry(id: string): QueryHistoryEntry[] {
    try {
      const current = this.getHistory();
      const updated = current.filter(item => item.id !== id);
      localStorage.setItem(historyKey(), JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.warn('Failed to delete query history item:', err);
      return this.getHistory();
    }
  },

  clearHistory(): void {
    try {
      localStorage.removeItem(historyKey());
    } catch (err) {
      console.warn('Failed to clear query history:', err);
    }
  }
};
