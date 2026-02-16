import { useState } from 'react';
import { useSpaceStore } from '../stores/spaceStore';

interface RightSidebarProps {
  /** Whether the sidebar is visible (for responsive) */
  visible?: boolean;
  /** Channel/space context for members */
  channelName?: string;
  peerCount?: number;
  /** Connection details to show when expanded */
  connectionDetails?: React.ReactNode;
}

export function RightSidebar({
  visible = true,
  channelName,
  peerCount = 0,
  connectionDetails,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'connection'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const { getSpace, activeSpaceId, activeChannelId } = useSpaceStore();

  const space = activeSpaceId ? getSpace(activeSpaceId) : null;
  const channel = space?.channels.find((c) => c.id === activeChannelId);

  if (!visible) return null;

  return (
    <aside className="w-full min-w-0 flex flex-col overflow-hidden bg-concord-bg-tertiary">
      {/* Tabs */}
      <div className="h-10 flex-shrink-0 flex border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 px-3 text-sm font-medium transition-colors ${
            activeTab === 'members'
              ? 'text-concord-text-primary border-b-2 border-concord-accent'
              : 'text-concord-text-secondary hover:text-concord-text-primary'
          }`}
        >
          Members
        </button>
        {connectionDetails && (
          <button
            onClick={() => setActiveTab('connection')}
            className={`flex-1 px-3 text-sm font-medium transition-colors ${
              activeTab === 'connection'
                ? 'text-concord-text-primary border-b-2 border-concord-accent'
                : 'text-concord-text-secondary hover:text-concord-text-primary'
            }`}
          >
            Connection
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'members' ? (
          <div className="p-3">
            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                className="w-full pl-8 pr-3 py-2 rounded-md bg-concord-bg-secondary border border-[var(--border)] text-concord-text-primary placeholder-concord-text-secondary text-sm focus:outline-none focus:ring-2 focus:ring-concord-accent"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-concord-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Channel info */}
            {channel && (
              <div className="mb-4 p-2 rounded-md bg-concord-bg-secondary">
                <div className="text-xs text-concord-text-secondary mb-1">Channel</div>
                <div className="font-medium text-concord-text-primary">
                  #{channel.name}
                </div>
                {space && (
                  <div className="text-xs text-concord-text-secondary mt-1">
                    {space.name} · {space.kind === 'community' ? 'Open' : 'Private'}
                  </div>
                )}
              </div>
            )}

            {/* Members list - placeholder */}
            <div className="text-xs font-semibold text-concord-text-secondary uppercase tracking-wider mb-2">
              Online — {peerCount}
            </div>
            <div className="space-y-1">
              {peerCount === 0 ? (
                <div className="text-sm text-concord-text-secondary py-4 text-center">
                  No members online. Connect to peers to see them here.
                </div>
              ) : (
                <div className="text-sm text-concord-text-secondary py-2">
                  Peer list will appear when connected.
                </div>
              )}
            </div>

            {/* Space info */}
            {space && space.kind === 'community' && (
              <div className="mt-4 p-2 rounded-md bg-concord-bg-secondary border border-[var(--border)]">
                <div className="text-xs text-concord-text-secondary mb-1">Community</div>
                <div className="text-sm text-concord-text-primary">
                  Open group · Open ownership
                </div>
                <div className="text-xs text-concord-text-secondary mt-1">
                  Anyone can join and participate.
                </div>
              </div>
            )}
            {space && space.kind === 'personal' && (
              <div className="mt-4 p-2 rounded-md bg-concord-bg-secondary border border-[var(--border)]">
                <div className="text-xs text-concord-text-secondary mb-1">Personal Space</div>
                <div className="text-sm text-concord-text-primary">
                  Closed group · Closed ownership
                </div>
                <div className="text-xs text-concord-text-secondary mt-1">
                  Invite-only. You control membership.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">{connectionDetails}</div>
        )}
      </div>
    </aside>
  );
}
