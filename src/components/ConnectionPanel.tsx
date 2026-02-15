import { useState } from 'react';

interface ConnectionPanelProps {
  onDialPeer: (peerAddr: string) => void;
  myAddress?: string;
  lanAddress?: string;
  peerId?: string;
  onOpenChat: () => void;
  connectionError?: string;
  onClearConnectionError?: () => void;
  peerCount?: number;
  overallStatus?: string;
  p2pStatus?: string;
}

export function ConnectionPanel({
  onDialPeer,
  myAddress,
  lanAddress,
  peerId,
  onOpenChat,
  connectionError,
  onClearConnectionError,
  peerCount = 0,
  overallStatus = '',
  p2pStatus = 'idle',
}: ConnectionPanelProps) {
  const [peerAddr, setPeerAddr] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleCopy = async (addr: string, field: string) => {
    await navigator.clipboard.writeText(addr);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConnect = async () => {
    if (!peerAddr.trim()) return;
    setConnecting(true);
    try {
      await onDialPeer(peerAddr.trim());
      setPeerAddr('');
    } finally {
      setConnecting(false);
    }
  };

  const isInitializing = p2pStatus === 'idle' || p2pStatus === 'connecting';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-0">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-2">
          <img src="/Concord_Logo.png" alt="Concord" className="h-12 w-auto mb-3" />
          <h1 className="text-2xl font-bold text-concord-text-primary">
            Concord
          </h1>
        </div>
        <p className="text-concord-text-secondary text-center mb-8">
          Connect to others. Copy your address, paste theirs.
        </p>

        {/* ── Initializing spinner ── */}
        {isInitializing && (
          <div className="py-8 flex flex-col items-center gap-4 text-concord-text-secondary">
            <div className="w-10 h-10 border-2 border-concord-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-lg">{overallStatus}</span>
          </div>
        )}

        {/* ── Connection error banner ── */}
        {connectionError && (
          <div className="mb-6 p-5 rounded-xl bg-red-500/20 text-red-400 flex justify-between items-start gap-4">
            <div>
              <p className="text-sm font-medium mb-1">Connection error</p>
              <p className="text-sm break-all">{connectionError}</p>
            </div>
            {onClearConnectionError && (
              <button
                onClick={onClearConnectionError}
                className="text-sm text-concord-accent hover:underline shrink-0"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* ── Ready state: show identity + address + peer connection ── */}
        {myAddress && (
          <div className="space-y-6">
            {/* Stable Peer ID */}
            {peerId && (
              <div>
                <label className="text-xs font-medium text-concord-text-secondary uppercase tracking-wider block mb-1">
                  Your Peer ID (stable across restarts)
                </label>
                <div className="flex gap-2 items-center">
                  <p className="flex-1 min-w-0 rounded-lg bg-concord-bg-tertiary px-3 py-2 text-concord-accent font-mono text-xs break-all select-text border border-[var(--border)]">
                    {peerId}
                  </p>
                  <button
                    onClick={() => handleCopy(peerId, 'peerId')}
                    className="px-3 py-2 rounded-lg bg-concord-bg-tertiary hover:bg-concord-bg-secondary border border-[var(--border)] text-xs font-medium text-concord-text-secondary shrink-0"
                  >
                    {copiedField === 'peerId' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* mDNS auto-discovery note */}
            <div className="rounded-lg bg-concord-accent/10 border border-concord-accent/30 px-4 py-3">
              <p className="text-sm text-concord-accent font-medium">
                LAN auto-discovery is active
              </p>
              <p className="text-xs text-concord-text-secondary mt-1">
                Peers on the same network are found automatically via mDNS. For remote connections, share your address below.
              </p>
            </div>

            {/* Local address */}
            <div>
              <label className="text-base font-semibold text-concord-text-primary block mb-2">
                Your address — share this for remote connections
              </label>
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0 rounded-xl bg-concord-bg-tertiary px-4 py-3 border-2 border-concord-accent">
                  <p className="text-concord-text-primary font-mono text-base break-all select-text leading-relaxed">
                    {myAddress}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(myAddress, 'local')}
                  className={`px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${
                    copiedField === 'local'
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-concord-accent hover:bg-[var(--accent-hover)] text-white'
                  }`}
                >
                  {copiedField === 'local' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {lanAddress && (
                <div className="mt-2">
                  <p className="text-xs text-concord-text-secondary mb-1">
                    LAN address (for other machines on your network):
                  </p>
                  <div className="flex gap-2 items-start">
                    <p className="flex-1 min-w-0 rounded-lg bg-concord-bg-tertiary px-3 py-2 text-concord-text-secondary font-mono text-xs break-all select-text">
                      {lanAddress}
                    </p>
                    <button
                      onClick={() => handleCopy(lanAddress, 'lan')}
                      className="px-4 py-2 rounded-lg bg-concord-bg-tertiary hover:bg-concord-bg-secondary border border-[var(--border)] text-xs font-medium text-concord-text-secondary"
                    >
                      {copiedField === 'lan' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Peer address input */}
            <div>
              <label className="text-sm font-medium text-concord-text-secondary block mb-2">
                Paste their address to connect
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={peerAddr}
                  onChange={(e) => setPeerAddr(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                  placeholder="Paste address here..."
                  disabled={connecting}
                  className="flex-1 rounded-xl bg-concord-bg-tertiary px-4 py-3 text-concord-text-primary placeholder-concord-text-secondary border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-concord-accent text-sm font-mono disabled:opacity-70"
                />
                <button
                  onClick={handleConnect}
                  disabled={!peerAddr.trim() || connecting}
                  className="px-6 py-3 rounded-xl bg-concord-accent hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm whitespace-nowrap text-white transition-colors min-w-[100px]"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>

            <button
              onClick={onOpenChat}
              className="w-full py-4 rounded-xl bg-concord-bg-tertiary hover:bg-concord-bg-secondary border border-[var(--border)] font-semibold text-concord-text-primary text-lg transition-colors"
            >
              Open chat {peerCount > 0 ? `(${peerCount} connected)` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
