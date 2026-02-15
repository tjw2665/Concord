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
        <span className="font-semibold text-lg"># {channelName}</span>
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
