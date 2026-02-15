/**
 * AntiSurveillanceState — Shared Protocol Types
 * Used by frontend, Tauri backend, and sync layer
 */

export type ChannelType = 'text' | 'voice' | 'dm';

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  timestamp: number;
  signature: string;
  replyTo?: string;
  attachments?: string[];
  reactions?: Record<string, string[]>;
  deleted?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  createdBy: string;
  createdAt: number;
  configHash: string;
  members: string[];
  lastMessageAt?: number;
}

export interface CreateChannelParams {
  name: string;
  type: ChannelType;
  members?: string[];
}

export interface SendMessageOptions {
  replyTo?: string;
  attachments?: string[];
}

export interface HistoryOptions {
  limit?: number;
  before?: string;  // Message ID for pagination
}

export interface SyncStatus {
  connectedPeers: number;
  pendingMessages: number;
  lastAnchorTx?: string;
}

export interface AnchorPayload {
  channelId: string;
  merkleRoot: string;
  messageCount: number;
  timestamp: number;
  signer: string;
}

export type MessageEvent = 'message:new' | 'message:updated' | 'message:deleted';
export type ChannelEvent = 'channel:joined' | 'channel:left' | 'channel:updated';
export type SyncEvent = 'sync:connected' | 'sync:disconnected' | 'sync:anchored';
