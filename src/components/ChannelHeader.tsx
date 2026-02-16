interface ChannelHeaderProps {
  channelName: string;
  status: 'idle' | 'connecting' | 'ready' | 'error';
  peerCount: number;
  shortId: string;
}

export function ChannelHeader({
  channelName,
  status,
  peerCount,
  shortId,
}: ChannelHeaderProps) {
  const statusColor =
    status === 'ready'
      ? 'text-[var(--success)]'
      : status === 'error'
        ? 'text-[var(--danger)]'
        : 'text-concord-text-secondary';

  const statusText =
    status === 'ready'
      ? (peerCount > 0 ? `Connected (${peerCount} peer${peerCount !== 1 ? 's' : ''})` : 'Ready — connect a peer to sync')
      : status === 'connecting'
        ? 'Connecting...'
        : status === 'error'
          ? 'Connection error'
          : 'Connect to relay above';

  return (
    <header className="h-12 flex-shrink-0 border-b border-[var(--border)] px-4 flex items-center justify-between bg-concord-bg-primary">
      <div className="flex items-center gap-3">
        {channelName.startsWith('dm:') ? (
          <span className="font-semibold text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-concord-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-mono text-sm">{channelName}</span>
          </span>
        ) : (
          <span className="font-semibold text-lg"># {channelName}</span>
        )}
        <span className={`text-sm ${statusColor}`} title={statusText}>
          ● {statusText}
        </span>
      </div>
      <div className="text-xs text-concord-text-secondary" title={shortId}>
        You: {shortId}
      </div>
    </header>
  );
}
