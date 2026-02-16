import { useState, useEffect } from 'react';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { ChannelHeader } from './components/ChannelHeader';
import { ConnectionPanel } from './components/ConnectionPanel';
import { LeftBar } from './components/LeftBar';
import { RightSidebar } from './components/RightSidebar';
import { MainLayout } from './components/MainLayout';
import { ConnectionDetails } from './components/ConnectionDetails';
import { UpdateChecker } from './components/UpdateChecker';
import { useP2P } from './hooks/useP2P';
import { getSidecarLog } from './services/p2pBridge';
import { useSpaceStore } from './stores/spaceStore';

export default function App() {
  const [view, setView] = useState<'connect' | 'chat'>('connect');

  const { activeChannelId, activeSpaceId, getSpace } = useSpaceStore();
  const activeSpace = activeSpaceId ? getSpace(activeSpaceId) : null;
  const activeChannel = activeSpace?.channels.find((c) => c.id === activeChannelId);

  // Use channel id for P2P topic; fallback to 'general' for Home
  const channelIdForP2P =
    activeSpaceId === 'home' && activeChannelId === 'general'
      ? 'general'
      : activeChannelId ?? 'general';

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
    inviteCode,
    debugLog,
    netStats,
  } = useP2P(channelIdForP2P);

  const [sidecarLog, setSidecarLog] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(async () => {
      const log = await getSidecarLog();
      if (log) setSidecarLog(log);
    }, 3000);
    getSidecarLog().then((log) => {
      if (log) setSidecarLog(log);
    });
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

  const channelDisplayName = activeChannel?.name ?? 'general';

  const centerContent =
    view === 'connect' ? (
      <ConnectionPanel
        onDialPeer={connectToPeer}
        myAddress={myAddress ?? undefined}
        lanAddress={lanAddress ?? undefined}
        peerId={peerId || undefined}
        inviteCode={inviteCode ?? undefined}
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
          channelName={channelDisplayName}
          status={status}
          peerCount={connectedPeers.length}
          shortId={shortId}
        />

        <MessageList channelId={channelIdForP2P} myPeerId={peerId} />

        <MessageInput
          onSend={sendMessage}
          disabled={status !== 'ready'}
        />
      </div>
    );

  return (
    <div className="h-screen bg-concord-bg-primary text-concord-text-primary flex flex-col overflow-hidden">
      <UpdateChecker />
      <MainLayout
        leftBar={
          <LeftBar
            connectionStatus={overallStatus}
          />
        }
        center={centerContent}
        rightSidebar={
          <RightSidebar
            channelName={channelDisplayName}
            peerCount={connectedPeers.length}
            connectionDetails={
              <ConnectionDetails
                p2pStatus={status}
                p2pError={error}
                myAddress={myAddress}
                lanAddress={lanAddress}
                peerCount={connectedPeers.length}
                debugLog={debugLog}
                sidecarLog={sidecarLog}
                netStats={netStats}
              />
            }
          />
        }
      />
    </div>
  );
}