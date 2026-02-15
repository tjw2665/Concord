import { useState } from 'react';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { ChannelHeader } from './components/ChannelHeader';
import { ConnectionPanel } from './components/ConnectionPanel';
import { useP2P } from './hooks/useP2P';
import { DEFAULT_CHANNEL } from './services/libp2p';

export default function App() {
  const [relayAddr, setRelayAddr] = useState<string | null>(null);
  const {
    status,
    shortId,
    error,
    sendMessage,
    connectToPeer,
    connectedPeers,
    listeningAddrs,
  } = useP2P(relayAddr, DEFAULT_CHANNEL);

  const myAddress = listeningAddrs[0] ?? null;

  return (
    <div className="flex h-screen bg-ass-bg-primary text-ass-text-primary flex-col">
      <header className="h-12 flex-shrink-0 border-b border-[var(--border)] px-4 flex items-center">
        <h1 className="font-semibold text-lg">AntiSurveillanceState</h1>
      </header>

      <ConnectionPanel
        onConnectRelay={(addr) => setRelayAddr(addr || null)}
        onDialPeer={connectToPeer}
        myAddress={myAddress ?? undefined}
        defaultRelayAddr=""
      />

      {error && (
        <div className="px-4 py-3 bg-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <span className="font-medium">Error:</span>
          <span>{error}</span>
        </div>
      )}

      <ChannelHeader
        channelName={DEFAULT_CHANNEL}
        status={status}
        peerCount={connectedPeers.length}
        shortId={shortId}
      />

      <MessageList channelId={DEFAULT_CHANNEL} />

      <MessageInput
        onSend={sendMessage}
        disabled={status !== 'ready' && status !== 'connecting'}
      />
    </div>
  );
}
