import { useState, useEffect, useCallback } from 'react';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { ChannelHeader } from './components/ChannelHeader';
import { ConnectionPanel } from './components/ConnectionPanel';
import { LeftBar } from './components/LeftBar';
import { RightSidebar } from './components/RightSidebar';
import { MainLayout } from './components/MainLayout';
import { ConnectionDetails } from './components/ConnectionDetails';
import { UpdateChecker } from './components/UpdateChecker';
import { NetworkLog } from './components/NetworkLog';
import { useP2P } from './hooks/useP2P';
import { getSidecarLog } from './services/p2pBridge';
import { useSpaceStore } from './stores/spaceStore';
import { useIncognitoStore } from './stores/incognitoStore';

export default function App() {
  const [view, setView] = useState<'connect' | 'chat'>('connect');
  const [centerTab, setCenterTab] = useState<'chat' | 'network'>('chat');
  const isIncognito = useIncognitoStore((s) => s.isIncognito);
  const setIncognito = useIncognitoStore((s) => s.setIncognito);

  const { activeChannelId, activeSpaceId, getSpace, setActiveSpace } = useSpaceStore();
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
    restartSidecar,
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

  const channelDisplayName = activeChannel
    ? (activeChannel.type === 'dm' ? activeChannel.name : activeChannel.name)
    : 'general';

  // ── Incognito toggle handler ────────────────────────────────
  const handleToggleIncognito = useCallback(async () => {
    const next = !isIncognito;
    setIncognito(next);
    if (next) {
      // Switch to DMs space in incognito
      setActiveSpace('dms');
    }
    await restartSidecar(next);
    // Go to connect view so user can see their new invite code
    setView('connect');
  }, [isIncognito, setIncognito, restartSidecar, setActiveSpace]);

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
        {/* Top bar with navigation, incognito toggle, and tab switcher */}
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

          {/* Center tabs */}
          <div className="flex items-center gap-1 bg-concord-bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setCenterTab('chat')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                centerTab === 'chat'
                  ? 'bg-concord-bg-primary text-concord-text-primary shadow-sm'
                  : 'text-concord-text-secondary hover:text-concord-text-primary'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setCenterTab('network')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                centerTab === 'network'
                  ? 'bg-concord-bg-primary text-concord-text-primary shadow-sm'
                  : 'text-concord-text-secondary hover:text-concord-text-primary'
              }`}
            >
              Network Log
            </button>
          </div>

          {/* Incognito toggle */}
          <button
            onClick={handleToggleIncognito}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isIncognito
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-concord-bg-secondary text-concord-text-secondary hover:text-concord-text-primary border border-transparent'
            }`}
            title={isIncognito ? 'Exit incognito mode' : 'Enter incognito mode (ephemeral identity)'}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            {isIncognito ? 'Incognito' : 'Incognito'}
          </button>
        </header>

        {/* Incognito banner */}
        {isIncognito && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            Incognito mode — ephemeral identity, DMs only. Your identity resets when you toggle off.
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <span className="font-medium">Error:</span>
            <span>{error}</span>
          </div>
        )}

        {/* Tab content */}
        {centerTab === 'network' ? (
          <NetworkLog />
        ) : (
          <>
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
          </>
        )}
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