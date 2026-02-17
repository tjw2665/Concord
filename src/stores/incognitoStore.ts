import { create } from 'zustand';

export interface NetworkLogEntry {
  timestamp: number;
  direction: 'out' | 'in' | 'info' | 'error';
  label: string;
  detail: string;
}

interface IncognitoState {
  /** Whether incognito mode is active */
  isIncognito: boolean;
  /** Structured network log entries (relay calls, connections, messages) */
  networkLogs: NetworkLogEntry[];

  setIncognito: (value: boolean) => void;
  addNetworkLog: (entry: Omit<NetworkLogEntry, 'timestamp'>) => void;
  clearNetworkLogs: () => void;
}

export const useIncognitoStore = create<IncognitoState>((set) => ({
  isIncognito: false,
  networkLogs: [],

  setIncognito: (value) => set({ isIncognito: value }),

  addNetworkLog: (entry) =>
    set((state) => ({
      networkLogs: [
        ...state.networkLogs.slice(-499),
        { ...entry, timestamp: Date.now() },
      ],
    })),

  clearNetworkLogs: () => set({ networkLogs: [] }),
}));
