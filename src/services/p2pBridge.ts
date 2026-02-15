/**
 * P2P Bridge — communicates with the Node.js sidecar through Tauri IPC.
 *
 * All P2P networking runs in the sidecar (Node.js process).
 * This module provides:
 *   - startP2P()       → invoke Rust to spawn the sidecar
 *   - sendMessage()    → publish a gossipsub message
 *   - dialPeer()       → connect to a remote peer
 *   - listenP2PEvents()→ subscribe to real-time events from the sidecar
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── Event types from the sidecar ─────────────────────────────────

export interface P2PReadyEvent {
  type: 'ready';
  peerId: string;
  address: string;
  lanAddress: string | null;
  port: number;
}

export interface P2PMessageEvent {
  type: 'message';
  channelId: string;
  data: string;
  from: string;
}

export interface P2PPeerEvent {
  type: 'peer:connect' | 'peer:disconnect';
  peerId: string;
  peers: string[];
}

export interface P2PDialResultEvent {
  type: 'dial_result';
  ok: boolean;
  address: string;
  error?: string;
  peers?: string[];
}

export interface P2PErrorEvent {
  type: 'error';
  message: string;
}

export interface P2PLogEvent {
  type: 'log';
  message: string;
}

export type P2PEvent =
  | P2PReadyEvent
  | P2PMessageEvent
  | P2PPeerEvent
  | P2PDialResultEvent
  | P2PErrorEvent
  | P2PLogEvent;

// ── Commands ─────────────────────────────────────────────────────

/** Start the P2P sidecar. Resolves when the process is spawned (not when it's ready). */
export async function startP2P(): Promise<void> {
  await invoke('start_p2p');
}

/** Publish a message to a gossipsub channel. */
export async function sendMessage(channelId: string, data: string): Promise<void> {
  await invoke('p2p_send', { channelId, data });
}

/** Tell the sidecar to dial a remote peer address. */
export async function dialPeer(address: string): Promise<void> {
  await invoke('p2p_dial', { address });
}

/** Read the sidecar's stderr log file. */
export async function getSidecarLog(): Promise<string> {
  try {
    return await invoke<string>('get_sidecar_log');
  } catch {
    return '';
  }
}

// ── Event listener ───────────────────────────────────────────────

/**
 * Listen for P2P events from the sidecar (forwarded via Tauri).
 * Returns an unlisten function.
 */
export async function listenP2PEvents(
  callback: (event: P2PEvent) => void
): Promise<UnlistenFn> {
  return listen<P2PEvent>('p2p-event', (tauriEvent) => {
    callback(tauriEvent.payload);
  });
}
