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

      getSpace: (id) => get().spaces.find((s) => s.id === id),
      getChannel: (spaceId, channelId) => {
        const space = get().spaces.find((s) => s.id === spaceId);
        return space?.channels.find((c) => c.id === channelId);
      },
    }),
    { name: 'concord-spaces' }
  )
);
