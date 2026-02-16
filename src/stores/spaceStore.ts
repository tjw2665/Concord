/**
 * Space store — Communities and Personal Spaces
 * Persisted to localStorage
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Space, SpaceChannel, CreateSpaceParams, CreateChannelParams } from '../types/spaces';

interface SpaceState {
  spaces: Space[];
  activeSpaceId: string | null;
  activeChannelId: string | null;

  addSpace: (params: CreateSpaceParams) => Space;
  removeSpace: (id: string) => void;
  updateSpace: (id: string, updates: Partial<Pick<Space, 'name' | 'icon' | 'expanded'>>) => void;
  addChannel: (params: CreateChannelParams) => SpaceChannel;
  removeChannel: (spaceId: string, channelId: string) => void;
  setActiveSpace: (id: string | null) => void;
  setActiveChannel: (id: string | null) => void;
  toggleSpaceExpanded: (id: string) => void;

  getSpace: (id: string) => Space | undefined;
  getChannel: (spaceId: string, channelId: string) => SpaceChannel | undefined;

  /** Create (or return existing) DM channel for a remote peer */
  addDmChannel: (remotePeerId: string) => SpaceChannel;
  /** Look up an existing DM channel by remote peer ID */
  getDmChannelByPeerId: (peerId: string) => SpaceChannel | undefined;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_SPACES: Space[] = [
  {
    id: 'home',
    name: 'Home',
    kind: 'community',
    icon: '🏠',
    channels: [
      { id: 'general', name: 'general', type: 'text', order: 0 },
    ],
    order: 0,
    expanded: true,
  },
  {
    id: 'dms',
    name: 'Direct Messages',
    kind: 'personal',
    icon: '💬',
    channels: [],
    order: 1,
    expanded: true,
  },
];

export const useSpaceStore = create<SpaceState>()(
  persist(
    (set, get) => ({
      spaces: DEFAULT_SPACES,
      activeSpaceId: 'home',
      activeChannelId: 'general',

      addSpace: (params) => {
        const space: Space = {
          id: generateId(),
          name: params.name,
          kind: params.kind,
          icon: params.icon,
          channels: [],
          order: get().spaces.length,
          expanded: true,
        };
        set((s) => ({
          spaces: [...s.spaces, space].sort((a, b) => a.order - b.order),
        }));
        return space;
      },

      removeSpace: (id) => {
        set((s) => {
          const next = s.spaces.filter((sp) => sp.id !== id);
          return {
            spaces: next,
            activeSpaceId: s.activeSpaceId === id ? (next[0]?.id ?? null) : s.activeSpaceId,
            activeChannelId:
              s.activeSpaceId === id ? null : s.activeChannelId,
          };
        });
      },

      updateSpace: (id, updates) => {
        set((s) => ({
          spaces: s.spaces.map((sp) =>
            sp.id === id ? { ...sp, ...updates } : sp
          ),
        }));
      },

      addChannel: ({ spaceId, name, type }) => {
        const space = get().spaces.find((s) => s.id === spaceId);
        if (!space) throw new Error(`Space ${spaceId} not found`);

        const channel: SpaceChannel = {
          id: generateId(),
          name,
          type,
          order: space.channels.length,
        };

        set((s) => ({
          spaces: s.spaces.map((sp) =>
            sp.id === spaceId
              ? {
                  ...sp,
                  channels: [...sp.channels, channel].sort((a, b) => a.order - b.order),
                }
              : sp
          ),
        }));
        return channel;
      },

      removeChannel: (spaceId, channelId) => {
        set((s) => ({
          spaces: s.spaces.map((sp) =>
            sp.id === spaceId
              ? { ...sp, channels: sp.channels.filter((c) => c.id !== channelId) }
              : sp
          ),
          activeChannelId:
            s.activeChannelId === channelId ? null : s.activeChannelId,
        }));
      },

      setActiveSpace: (id) => set({ activeSpaceId: id }),
      setActiveChannel: (id) => set({ activeChannelId: id }),

      toggleSpaceExpanded: (id) => {
        set((s) => ({
          spaces: s.spaces.map((sp) =>
            sp.id === id ? { ...sp, expanded: !sp.expanded } : sp
          ),
        }));
      },

      addDmChannel: (remotePeerId) => {
        const dmChannelId = `dm:${remotePeerId}`;
        // Check if it already exists
        const dmsSpace = get().spaces.find((s) => s.id === 'dms');
        const existing = dmsSpace?.channels.find((c) => c.id === dmChannelId);
        if (existing) return existing;

        // Create a short display name from the PeerId
        const shortName = remotePeerId.length > 12
          ? `${remotePeerId.slice(0, 8)}…${remotePeerId.slice(-4)}`
          : remotePeerId;

        const channel: SpaceChannel = {
          id: dmChannelId,
          name: shortName,
          type: 'dm',
          order: (dmsSpace?.channels.length ?? 0),
        };

        // Ensure the dms space exists, then add the channel
        set((s) => ({
          spaces: s.spaces.map((sp) =>
            sp.id === 'dms'
              ? { ...sp, channels: [...sp.channels, channel], expanded: true }
              : sp
          ),
        }));
        return channel;
      },

      getDmChannelByPeerId: (peerId) => {
        const dmChannelId = `dm:${peerId}`;
        const dmsSpace = get().spaces.find((s) => s.id === 'dms');
        return dmsSpace?.channels.find((c) => c.id === dmChannelId);
      },

      getSpace: (id) => get().spaces.find((s) => s.id === id),
      getChannel: (spaceId, channelId) => {
        const space = get().spaces.find((s) => s.id === spaceId);
        return space?.channels.find((c) => c.id === channelId);
      },
    }),
    { name: 'concord-spaces' }
  )
);
