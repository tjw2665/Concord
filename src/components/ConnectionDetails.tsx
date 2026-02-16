import type { NetStats } from '../hooks/useP2P';

interface ConnectionDetailsProps {
  p2pStatus: string;
  p2pError?: string | null;
  myAddress?: string | null;
  lanAddress?: string | null;
  peerCount: number;
  debugLog?: string[];
  sidecarLog?: string;
  netStats?: NetStats;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-1.5 ${ok ? 'bg-green-400' : 'bg-red-400'}`}
    />
  );
}

export function ConnectionDetails({
  p2pStatus,
  p2pError,
  myAddress,
  lanAddress,
  peerCount,
  debugLog = [],
  sidecarLog = '',
  netStats,
}: ConnectionDetailsProps) {
  const s = netStats?.stats;

  return (
    <div className="space-y-3 text-xs font-mono">
      <div>
        <StatusDot ok={p2pStatus === 'ready'} />
        <span className="text-concord-text-secondary">Status:</span>{' '}
        <span className={p2pError ? 'text-red-400' : 'text-concord-text-primary'}>
          {p2pStatus}
        </span>
      </div>
      {p2pError && (
        <div>
          <span className="text-red-400">Error:</span>
          <pre className="mt-1 p-2 rounded bg-red-500/10 text-red-400 whitespace-pre-wrap break-words text-[11px]">
            {p2pError}
          </pre>
        </div>
      )}

      <div className="border border-[var(--border)] rounded p-2 space-y-1.5 bg-concord-bg-secondary">
        <div className="text-concord-accent-primary font-semibold text-[11px] uppercase tracking-wide mb-1">
          Network
        </div>
        <div>
          <span className="text-concord-text-secondary">Listen port:</span>{' '}
          <span className="text-yellow-300 font-bold">{netStats?.listenPort ?? '...'}</span>
        </div>
        <div className="flex gap-3">
          <div>
            <span className="text-concord-text-secondary">Sent:</span>{' '}
            <span className="text-green-400">{s?.sent ?? 0}</span>
          </div>
          <div>
            <span className="text-concord-text-secondary">Recv:</span>{' '}
            <span className="text-blue-400">{s?.recv ?? 0}</span>
          </div>
        </div>
        <div>
          <span className="text-concord-text-secondary">Peers:</span>{' '}
          <span className="text-concord-text-primary">{peerCount}</span>
        </div>
        {netStats?.connections && netStats.connections.length > 0 && (
          <div className="space-y-1.5 mt-1">
            {netStats.connections.map((conn) => (
              <div
                key={conn.peerId}
                className="border border-[var(--border)] rounded p-1.5 bg-concord-bg-tertiary text-[10px]"
              >
                <div className="flex items-center gap-1">
                  <span className={conn.direction === 'outbound' ? 'text-green-400' : 'text-blue-400'}>
                    {conn.direction === 'outbound' ? '→' : '←'}
                  </span>
                  <span className="text-concord-text-primary font-medium">{conn.peerIdShort}...</span>
                </div>
                <div className="text-concord-text-secondary break-all mt-0.5">{conn.remoteAddr}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <span className="text-concord-text-secondary">Local address:</span>
        <p className="mt-0.5 text-concord-text-primary break-all">{myAddress ?? '(waiting)'}</p>
      </div>
      {lanAddress && (
        <div>
          <span className="text-concord-text-secondary">LAN address:</span>
          <p className="mt-0.5 text-concord-text-primary break-all">{lanAddress}</p>
        </div>
      )}

      {sidecarLog && (
        <div>
          <span className="text-concord-text-secondary">Sidecar log:</span>
          <pre className="mt-1 p-2 rounded bg-concord-bg-secondary text-concord-text-secondary whitespace-pre-wrap break-words text-[10px] max-h-32 overflow-y-auto">
            {sidecarLog}
          </pre>
        </div>
      )}

      {debugLog.length > 0 && (
        <div>
          <span className="text-concord-text-secondary">Event log:</span>
          <pre className="mt-1 p-2 rounded bg-concord-bg-secondary text-concord-text-secondary whitespace-pre-wrap break-words text-[10px] max-h-48 overflow-y-auto">
            {debugLog.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
