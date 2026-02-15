import { useState } from 'react';

interface ConnectionPanelProps {
  onDialPeer: (peerAddr: string) => void;
  myAddress?: string;
  lanAddress?: string;
  peerId?: string;
  inviteCode?: string;
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
  inviteCode,
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
          Share your code. Paste theirs. Connect instantly.
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

        {/* ── Ready state ── */}
        {myAddress && (
          <div className="space-y-6">

            {/* ── Invite code (primary share method) ── */}
            {inviteCode ? (
              <div>
                <label className="text-base font-semibold text-concord-text-primary block mb-2 text-center">
                  Your invite code — share this to connect
                </label>
                <div className="flex gap-3 items-center justify-center">
                  <div className="rounded-2xl bg-concord-bg-tertiary px-6 py-4 border-2 border-concord-accent">
                    <p className="text-concord-accent font-mono text-3xl font-bold tracking-widest select-text text-center">
                      {inviteCode}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(inviteCode, 'invite')}
                    className={`px-5 py-4 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${
                      copiedField === 'invite'
                        ? 'bg-[var(--success)] text-white'
                        : 'bg-concord-accent hover:bg-[var(--accent-hover)] text-white'
                    }`}
                  >
                    {copiedField === 'invite' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-concord-accent/10 border border-concord-accent/30 px-4 py-3 text-center">
                <p className="text-sm text-concord-accent font-medium">
                  Connecting to relay...
                </p>
                <p className="text-xs text-concord-text-secondary mt-1">
                  Your invite code will appear shortly. LAN connections still work.
                </p>
              </div>
            )}

            {/* mDNS auto-discovery note */}
            <div className="rounded-lg bg-concord-accent/10 border border-concord-accent/30 px-4 py-3">
              <p className="text-sm text-concord-accent font-medium">
                LAN auto-discovery is active
              </p>
              <p className="text-xs text-concord-text-secondary mt-1">
                Peers on the same network are found automatically via mDNS.
              </p>
            </div>

            {/* ── Peer code / address input ── */}
            <div>
              <label className="text-sm font-medium text-concord-text-secondary block mb-2">
                Paste their code or address to connect
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={peerAddr}
                  onChange={(e) => setPeerAddr(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                  placeholder="e.g. ABCD-1234 or /ip4/..."
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

            {/* ── Advanced: full multiaddrs ── */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-concord-text-secondary hover:text-concord-text-primary flex items-center gap-1 transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced — full addresses
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  {/* Peer ID */}
                  {peerId && (
                    <div>
                      <label className="text-xs font-medium text-concord-text-secondary uppercase tracking-wider block mb-1">
                        Peer ID
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

                  {/* Local address */}
                  <div>
                    <label className="text-xs font-medium text-concord-text-secondary uppercase tracking-wider block mb-1">
                      Local address
                    </label>
                    <div className="flex gap-2 items-start">
                      <p className="flex-1 min-w-0 rounded-lg bg-concord-bg-tertiary px-3 py-2 text-concord-text-secondary font-mono text-xs break-all select-text border border-[var(--border)]">
                        {myAddress}
                      </p>
                      <button
                        onClick={() => myAddress && handleCopy(myAddress, 'local')}
                        className="px-3 py-2 rounded-lg bg-concord-bg-tertiary hover:bg-concord-bg-secondary border border-[var(--border)] text-xs font-medium text-concord-text-secondary shrink-0"
                      >
                        {copiedField === 'local' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* LAN address */}
                  {lanAddress && (
                    <div>
                      <label className="text-xs font-medium text-concord-text-secondary uppercase tracking-wider block mb-1">
                        LAN address
                      </label>
                      <div className="flex gap-2 items-start">
                        <p className="flex-1 min-w-0 rounded-lg bg-concord-bg-tertiary px-3 py-2 text-concord-text-secondary font-mono text-xs break-all select-text border border-[var(--border)]">
                          {lanAddress}
                        </p>
                        <button
                          onClick={() => handleCopy(lanAddress, 'lan')}
                          className="px-3 py-2 rounded-lg bg-concord-bg-tertiary hover:bg-concord-bg-secondary border border-[var(--border)] text-xs font-medium text-concord-text-secondary shrink-0"
                        >
                          {copiedField === 'lan' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
