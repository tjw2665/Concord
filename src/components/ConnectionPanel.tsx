import { useState } from 'react';

interface ConnectionPanelProps {
  onConnectRelay: (relayAddr: string) => void;
  onDialPeer: (peerAddr: string) => void;
  myAddress?: string;
  defaultRelayAddr?: string;
}

export function ConnectionPanel({
  onConnectRelay,
  onDialPeer,
  myAddress,
  defaultRelayAddr,
}: ConnectionPanelProps) {
  const [relayAddr, setRelayAddr] = useState(defaultRelayAddr ?? '');
  const [peerAddr, setPeerAddr] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!myAddress) return;
    await navigator.clipboard.writeText(myAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b border-[var(--border)] bg-ass-bg-secondary">
      <div className="p-4 space-y-4">
        {/* Quick testing banner */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ass-text-primary">
            Testing setup
          </span>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-sm text-ass-accent hover:underline"
          >
            {showHelp ? 'Hide' : 'Show'} instructions
          </button>
        </div>

        {showHelp && (
          <div className="rounded-lg bg-ass-bg-tertiary p-4 text-sm text-ass-text-secondary space-y-3">
            <p className="font-medium text-ass-text-primary">Quick start (2 tabs)</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Run <code className="bg-ass-bg-primary px-1.5 py-0.5 rounded">npm run relay</code> in a terminal
              </li>
              <li>
                Copy the relay address from the terminal (e.g. <code className="text-ass-accent">/ip4/127.0.0.1/tcp/12345/ws/p2p/...</code>)
              </li>
              <li>
                Paste below → <strong>Connect to relay</strong>
              </li>
              <li>
                Copy <strong>Your address</strong> (appears after connecting)
              </li>
              <li>
                Open a second tab → connect to relay → paste Tab 1&apos;s address → <strong>Connect to peer</strong>
              </li>
              <li>
                Send messages — they sync between tabs
              </li>
            </ol>
          </div>
        )}

        {/* Step 1: Relay */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-ass-text-secondary">
            1. Relay address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={relayAddr}
              onChange={(e) => setRelayAddr(e.target.value)}
              placeholder="/ip4/127.0.0.1/tcp/12345/ws/p2p/..."
              className="flex-1 rounded-lg bg-ass-bg-tertiary px-3 py-2.5 text-ass-text-primary placeholder-ass-text-secondary border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-ass-accent text-sm font-mono"
            />
            <button
              onClick={() => onConnectRelay(relayAddr)}
              className="px-4 py-2.5 rounded-lg bg-ass-accent hover:bg-[var(--accent-hover)] font-medium text-sm whitespace-nowrap"
            >
              Connect to relay
            </button>
          </div>
        </div>

        {/* Step 2: Your address (show when connected) */}
        {myAddress && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-ass-text-secondary">
              2. Your address <span className="text-[var(--success)]">(share with other tab)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={myAddress}
                className="flex-1 rounded-lg bg-ass-bg-tertiary px-3 py-2.5 text-ass-text-secondary border border-[var(--border)] text-sm font-mono truncate"
                title={myAddress}
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                  copied
                    ? 'bg-[var(--success)] text-white'
                    : 'bg-ass-bg-tertiary border border-[var(--border)] hover:bg-ass-bg-primary'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Peer address */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-ass-text-secondary">
            3. Peer address <span className="text-ass-text-secondary">(from other tab)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={peerAddr}
              onChange={(e) => setPeerAddr(e.target.value)}
              placeholder="Paste the other tab's address here"
              className="flex-1 rounded-lg bg-ass-bg-tertiary px-3 py-2.5 text-ass-text-primary placeholder-ass-text-secondary border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-ass-accent text-sm font-mono"
            />
            <button
              onClick={() => onDialPeer(peerAddr)}
              disabled={!peerAddr.trim()}
              className="px-4 py-2.5 rounded-lg border border-ass-accent text-ass-accent hover:bg-ass-accent/20 font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect to peer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
