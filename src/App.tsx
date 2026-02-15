import { useState, useEffect } from 'react';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { ChannelHeader } from './components/ChannelHeader';
import { ConnectionPanel } from './components/ConnectionPanel';
import { Sidebar } from './components/Sidebar';
import { UpdateChecker } from './components/UpdateChecker';
import { useP2P, DEFAULT_CHANNEL } from './hooks/useP2P';
import { getSidecarLog } from './services/p2pBridge';

export default function App() {
  const [view, setView] = useState<'connect' | 'chat'>('connect');
  const [sidecarLog, setSidecarLog] = useState<string>('');

  const {
    status,
    peerId,
    shortId,
    error,
    clearError,
    sendMessage,
    connectToPeer,
    connectedPeers,
    myAddress,
    lanAddress,
    debugLog,
    netStats,
  } = useP2P(DEFAULT_CHANNEL);

  // Fetch sidecar stderr log periodically for debugging
  useEffect(() => {
    const interval = setInterval(async () => {
      const log = await getSidecarLog();
      if (log) setSidecarLog(log);
    }, 3000);
    getSidecarLog().then((log) => { if (log) setSidecarLog(log); });
    return () => clearInterval(interval);
  }, []);

  const overallStatus =
    status === 'connecting'
      ? 'Starting P2P node...'
      : status === 'ready'
        ? 'Connected'
        : status === 'error'
          ? 'Connection error'
          : 'Initializing...';

  return (
    <div className="h-screen bg-concord-bg-primary text-concord-text-primary flex">
      <UpdateChecker />
      <Sidebar
        p2pStatus={status}
        p2pError={error}
        myAddress={myAddress}
        lanAddress={lanAddress}
        peerCount={connectedPeers.length}
        debugLog={debugLog}
        sidecarLog={sidecarLog}
        netStats={netStats}
      />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden min-w-0">
      {view === 'connect' ? (
        <ConnectionPanel
          onDialPeer={connectToPeer}
          myAddress={myAddress ?? undefined}
          lanAddress={lanAddress ?? undefined}
          peerId={peerId || undefined}
          connectionError={error ?? undefined}
          onClearConnectionError={clearError}
          onOpenChat={() => setView('chat')}
          peerCount={connectedPeers.length}
          overallStatus={overallStatus}
          p2pStatus={status}
        />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="h-12 flex-shrink-0 border-b border-[var(--border)] px-4 flex items-center justify-between bg-concord-bg-primary">
            <button
              onClick={() => setView('connect')}
              className="text-concord-text-secondary hover:text-concord-text-primary flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Connect
            </button>
            <h1 className="font-semibold text-lg flex items-center gap-2">
              <img src="/Concord_Icon.png" alt="" className="w-7 h-7" aria-hidden />
              Concord
            </h1>
            <div className="w-16" />
          </header>

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

          <MessageList channelId={DEFAULT_CHANNEL} myPeerId={peerId} />

          <MessageInput
            onSend={sendMessage}
            disabled={status !== 'ready'}
          />
        </div>
      )}
      </div>
    </div>
  );
}
