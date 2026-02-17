import { useEffect, useRef } from 'react';
import { useIncognitoStore, type NetworkLogEntry } from '../stores/incognitoStore';

const DIRECTION_STYLES: Record<NetworkLogEntry['direction'], { icon: string; color: string }> = {
  out: { icon: '↑', color: 'text-blue-400' },
  in: { icon: '↓', color: 'text-green-400' },
  info: { icon: '●', color: 'text-concord-text-secondary' },
  error: { icon: '✕', color: 'text-red-400' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function NetworkLog() {
  const { networkLogs, clearNetworkLogs } = useIncognitoStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [networkLogs.length]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-concord-bg-secondary">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-concord-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-concord-text-primary">Network Log</span>
          <span className="text-xs text-concord-text-secondary">({networkLogs.length} entries)</span>
        </div>
        <button
          onClick={clearNetworkLogs}
          className="text-xs px-2 py-1 rounded bg-concord-bg-tertiary text-concord-text-secondary hover:text-concord-text-primary transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5 bg-concord-bg-primary">
        {networkLogs.length === 0 && (
          <div className="text-concord-text-secondary text-center py-8">
            No network activity yet. Connect to a peer to see traffic.
          </div>
        )}
        {networkLogs.map((entry, i) => {
          const style = DIRECTION_STYLES[entry.direction];
          return (
            <div key={i} className="flex gap-2 leading-relaxed hover:bg-concord-bg-secondary/50 px-1 rounded">
              <span className="text-concord-text-secondary flex-shrink-0 w-[68px]">
                {formatTime(entry.timestamp)}
              </span>
              <span className={`flex-shrink-0 w-3 ${style.color}`}>{style.icon}</span>
              <span className="text-concord-text-primary flex-shrink-0 font-semibold min-w-[100px]">
                {entry.label}
              </span>
              <span className="text-concord-text-secondary break-all">{entry.detail}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
