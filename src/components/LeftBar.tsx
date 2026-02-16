import { useState } from 'react';
import { useSpaceStore } from '../stores/spaceStore';
import type { Space, SpaceChannel, SpaceKind } from '../types/spaces';

interface LeftBarProps {
  /** Connection status for compact display */
  connectionStatus?: string;
  onAddSpace?: () => void;
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-concord-text-secondary transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SpaceIcon({ space }: { space: Space }) {
  if (space.icon) {
    return (
      <span className="w-10 h-10 flex items-center justify-center text-xl rounded-xl bg-concord-bg-secondary hover:bg-concord-bg-primary hover:rounded-2xl transition-all group-hover:text-concord-accent">
        {space.icon}
      </span>
    );
  }
  const initial = space.name.slice(0, 2).toUpperCase();
  const bg =
    space.kind === 'community'
      ? 'bg-emerald-600'
      : 'bg-violet-600';
  return (
    <span
      className={`w-10 h-10 flex items-center justify-center rounded-xl ${bg} text-white font-semibold text-sm group-hover:rounded-2xl transition-all`}
    >
      {initial}
    </span>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
}: {
  channel: SpaceChannel;
  isActive: boolean;
  onClick: () => void;
}) {
  const isDm = channel.type === 'dm';
  const icon = isDm ? (
    <svg className="w-4 h-4 text-concord-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ) : (
    <span className="text-concord-text-secondary text-xs w-4">
      {channel.type === 'voice' ? '🔊' : '#'}
    </span>
  );

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
        isActive
          ? 'bg-concord-bg-secondary text-concord-text-primary'
          : 'text-concord-text-secondary hover:bg-concord-bg-secondary/50 hover:text-concord-text-primary'
      }`}
    >
      {icon}
      <span className="truncate font-mono text-xs">{channel.name}</span>
    </button>
  );
}

function SpaceSection({
  space,
  isActiveSpace,
  activeChannelId,
  onSelectChannel,
  onToggleExpand,
}: {
  space: Space;
  isActiveSpace: boolean;
  activeChannelId: string | null;
  onSelectChannel: (channel: SpaceChannel) => void;
  onToggleExpand: () => void;
}) {
  const expanded = space.expanded ?? true;

  return (
    <div className="mb-2">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-concord-bg-secondary/50 text-concord-text-primary text-sm font-medium transition-colors"
      >
        <Chevron expanded={expanded} />
        <SpaceIcon space={space} />
        <span className="truncate flex-1 text-left">{space.name}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded bg-concord-bg-tertiary text-concord-text-secondary"
          title={space.kind === 'community' ? 'Open group · Open ownership' : 'Closed group · Closed ownership'}
        >
          {space.kind === 'community' ? 'Open' : 'Private'}
        </span>
      </button>
      {expanded && space.channels.length > 0 && (
        <div className="ml-4 mt-1 pl-2 border-l border-[var(--border)] space-y-0.5">
          {space.channels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={activeChannelId === ch.id}
              onClick={() => onSelectChannel(ch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LeftBar({ connectionStatus, onAddSpace }: LeftBarProps) {
  const {
    spaces,
    activeSpaceId,
    activeChannelId,
    setActiveSpace,
    setActiveChannel,
    toggleSpaceExpanded,
    addSpace,
    addChannel,
    getSpace,
  } = useSpaceStore();

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceKind, setNewSpaceKind] = useState<SpaceKind>('community');
  const [newChannelName, setNewChannelName] = useState('');

  const communities = spaces.filter((s) => s.kind === 'community');
  const personalSpaces = spaces.filter((s) => s.kind === 'personal');

  const handleSelectChannel = (channel: SpaceChannel) => {
    const space = spaces.find((s) => s.channels.some((c) => c.id === channel.id));
    if (space) {
      setActiveSpace(space.id);
      setActiveChannel(channel.id);
    }
  };

  const handleCreateSpace = () => {
    if (!newSpaceName.trim()) return;
    addSpace({ name: newSpaceName.trim(), kind: newSpaceKind });
    setNewSpaceName('');
    setShowCreateSpace(false);
    setShowAddMenu(false);
  };

  const handleCreateChannel = () => {
    if (!newChannelName.trim() || !activeSpaceId) return;
    const space = getSpace(activeSpaceId);
    if (!space || space.id === 'dms' || space.id === 'home') return;
    addChannel({
      spaceId: activeSpaceId,
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      type: 'text',
    });
    setNewChannelName('');
    setShowCreateChannel(false);
  };

  return (
    <aside className="w-full min-w-0 flex flex-col overflow-hidden bg-concord-bg-tertiary">
      {/* Header */}
      <div className="h-12 flex-shrink-0 px-3 flex items-center justify-between border-b border-[var(--border)]">
        <h2 className="font-semibold text-concord-text-primary truncate">Spaces</h2>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="p-1.5 rounded-md hover:bg-concord-bg-secondary text-concord-text-secondary hover:text-concord-text-primary transition-colors"
            title="Add space or channel"
            aria-label="Add"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {showAddMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAddMenu(false)}
                aria-hidden
              />
              <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-concord-bg-secondary rounded-lg shadow-xl border border-[var(--border)] z-20">
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setNewSpaceKind('community');
                    setShowCreateSpace(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-concord-text-primary hover:bg-concord-bg-tertiary flex items-center gap-2"
                >
                  <span>🏛️</span> Create Community
                </button>
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setNewSpaceKind('personal');
                    setShowCreateSpace(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-concord-text-primary hover:bg-concord-bg-tertiary flex items-center gap-2"
                >
                  <span>🔒</span> Create Personal Space
                </button>
                {activeSpaceId && getSpace(activeSpaceId)?.id !== 'home' && getSpace(activeSpaceId)?.id !== 'dms' && (
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      setShowCreateChannel(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-concord-text-primary hover:bg-concord-bg-tertiary flex items-center gap-2 border-t border-[var(--border)]"
                  >
                    <span>#</span> Create Channel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Space list */}
      <div className="flex-1 overflow-y-auto p-2">
        {communities.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-[10px] font-semibold text-concord-text-secondary uppercase tracking-wider">
              Communities
            </div>
            {communities.map((space) => (
              <SpaceSection
                key={space.id}
                space={space}
                isActiveSpace={activeSpaceId === space.id}
                activeChannelId={activeSpaceId === space.id ? activeChannelId : null}
                onSelectChannel={handleSelectChannel}
                onToggleExpand={() => toggleSpaceExpanded(space.id)}
              />
            ))}
          </div>
        )}

        {personalSpaces.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-concord-text-secondary uppercase tracking-wider">
              Personal
            </div>
            {personalSpaces.map((space) => (
              <SpaceSection
                key={space.id}
                space={space}
                isActiveSpace={activeSpaceId === space.id}
                activeChannelId={activeSpaceId === space.id ? activeChannelId : null}
                onSelectChannel={handleSelectChannel}
                onToggleExpand={() => toggleSpaceExpanded(space.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Connection status (compact) */}
      {connectionStatus && (
        <div className="p-2 border-t border-[var(--border)]">
          <div className="text-[10px] text-concord-text-secondary truncate" title={connectionStatus}>
            {connectionStatus}
          </div>
        </div>
      )}

      {/* Create Space Modal */}
      {showCreateSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-concord-bg-secondary rounded-lg shadow-xl border border-[var(--border)] w-80 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-concord-text-primary mb-3">
              Create {newSpaceKind === 'community' ? 'Community' : 'Personal Space'}
            </h3>
            <p className="text-xs text-concord-text-secondary mb-3">
              {newSpaceKind === 'community'
                ? 'Open group · Anyone can join · Collaborative ownership'
                : 'Closed group · Invite only · Private ownership'}
            </p>
            <input
              type="text"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Space name"
              className="w-full px-3 py-2 rounded-md bg-concord-bg-tertiary border border-[var(--border)] text-concord-text-primary placeholder-concord-text-secondary focus:outline-none focus:ring-2 focus:ring-concord-accent mb-3"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSpace()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateSpace(false)}
                className="flex-1 px-3 py-2 rounded-md bg-concord-bg-tertiary text-concord-text-primary hover:bg-concord-bg-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSpace}
                disabled={!newSpaceName.trim()}
                className="flex-1 px-3 py-2 rounded-md bg-concord-accent text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-concord-bg-secondary rounded-lg shadow-xl border border-[var(--border)] w-80 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-concord-text-primary mb-3">Create Channel</h3>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Channel name (e.g. general)"
              className="w-full px-3 py-2 rounded-md bg-concord-bg-tertiary border border-[var(--border)] text-concord-text-primary placeholder-concord-text-secondary focus:outline-none focus:ring-2 focus:ring-concord-accent mb-3"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateChannel(false)}
                className="flex-1 px-3 py-2 rounded-md bg-concord-bg-tertiary text-concord-text-primary hover:bg-concord-bg-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
                className="flex-1 px-3 py-2 rounded-md bg-concord-accent text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
