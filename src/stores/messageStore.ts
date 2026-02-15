/**
 * Message store — Zustand store for channel messages
 *
 * Persisted to localStorage. Safe for multi-instance because each
 * instance uses its sidecar PeerId as the message authorId, so
 * "isMe" checks never mis-identify messages from another instance.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '@concord/protocol';

interface MessageState {
  messages: Record<string, Message[]>;
  addMessage: (channelId: string, message: Message) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  getMessages: (channelId: string) => Message[];
  clearChannel: (channelId: string) => void;
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      messages: {},
      addMessage: (channelId, message) => {
        set((state) => {
          const existing = state.messages[channelId] ?? [];
          if (existing.some((m) => m.id === message.id)) return state;
          return {
            messages: {
              ...state.messages,
              [channelId]: [...existing, message].sort((a, b) => a.timestamp - b.timestamp),
            },
          };
        });
      },
      setMessages: (channelId, messages) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [channelId]: messages.sort((a, b) => a.timestamp - b.timestamp),
          },
        }));
      },
      getMessages: (channelId) => {
        return get().messages[channelId] ?? [];
      },
      clearChannel: (channelId) => {
        set((state) => {
          const next = { ...state.messages };
          delete next[channelId];
          return { messages: next };
        });
      },
    }),
    { name: 'concord-messages', partialize: (s) => ({ messages: s.messages }) }
  )
);
