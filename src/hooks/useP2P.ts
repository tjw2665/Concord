/**
 * Hook to manage P2P state via the Node.js sidecar.
 *
 * All networking runs in the sidecar process.  This hook:
 *  1. Listens for sidecar events (ready, message, peer connect/disconnect, errors)
 *  2. Uses the sidecar's PeerId as the message authorId (unique per instance)
 *  3. Exposes send / dial / status to the React UI
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  sendMessage as bridgeSend,
  dialPeer as bridgeDial,
  listenP2PEvents,
  type P2PEvent,
} from '../services/p2pBridge';
import { initIdentity, sign } from '../services/identity';
import { useMessageStore } from '../stores/messageStore';
import { useSpaceStore } from '../stores/spaceStore';
import { getKnownPeers, addKnownPeer, clearKnownPeers } from '../services/knownPeers';
import type { Message } from '@concord/protocol';

const DEFAULT_CHANNEL = 'general';

export interface PeerConnection {
  peerId: string;
  peerIdShort: string;
  remoteAddr: string;
  remotePort: number | null;
  direction: string;
  streams: number;
}

export interface NetStats {
  listenPort: number | null;
  listenAddrs: string[];
  connections: PeerConnection[];
  stats: { sent: number; sendFail: number; recv: number; recvFail: number };
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Invite code pattern: XXXX-XXXX
const INVITE_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

export function useP2P(channelId: string = DEFAULT_CHANNEL) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [peerId, setPeerId] = useState<string>('');
  const [shortId, setShortId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [lanAddress, setLanAddress] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [netStats, setNetStats] = useState<NetStats>({
    listenPort: null, listenAddrs: [], connections: [], stats: { sent: 0, sendFail: 0, recv: 0, recvFail: 0 },
  });
  const addMessage = useMessageStore((s) => s.addMessage);
  const startedRef = useRef(false);
  const userDialsRef = useRef(new Set<string>());
  // Sidecar peerId stored in a ref so the event handler closure always has the latest value
  const peerIdRef = useRef<string>('');

  const log = useCallback((msg: string) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setDebugLog((prev) => [...prev.slice(-199), entry]);
  }, []);

  // ── Main init effect ───────────────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let unlisten: (() => void) | null = null;

    async function init() {
      try {
        setStatus('connecting');
        setError(null);
        log('Initializing...');

        // Init signing identity (still used for message signatures)
        await initIdentity();

        // Listen for sidecar events.
        // The sidecar is auto-started by the Rust backend in the setup hook.
        unlisten = await listenP2PEvents((evt: P2PEvent) => {
          handleP2PEvent(evt);
        });

        log('Listening for sidecar events (sidecar auto-started by backend)...');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus('error');
        log(`Init error: ${msg}`);
      }
    }

    // ── Event handler ──────────────────────────────────────────
    let knownPeersReconnected = false;

    function handleP2PEvent(evt: P2PEvent) {
      // Log every event type (except noisy 'log' events) for debugging
      if (evt.type !== 'log') {
        log(`[event] ${evt.type}: ${JSON.stringify(evt).slice(0, 120)}`);
      }
      switch (evt.type) {
        case 'ready':
          peerIdRef.current = evt.peerId;
          setPeerId(evt.peerId);
          setShortId(evt.peerId.slice(0, 16) + '...');
          setMyAddress(evt.address);
          setLanAddress(evt.lanAddress);
          if (evt.inviteCode) setInviteCode(evt.inviteCode);
          setStatus('ready');
          setError(null);
          log(`P2P ready! PeerId: ${evt.peerId.slice(0, 16)}...`);
          log(`Local address: ${evt.address}`);
          if (evt.lanAddress) log(`LAN address: ${evt.lanAddress}`);
          if (evt.inviteCode) log(`Invite code: ${evt.inviteCode}`);

          // Auto-reconnect known peers (once)
          if (!knownPeersReconnected) {
            knownPeersReconnected = true;
            const known = getKnownPeers();
            // Filter to only valid multiaddrs (must start with /)
            const valid = known.filter((p) => p.address.startsWith('/'));
            const stale = known.length - valid.length;
            if (stale > 0) {
              log(`Pruned ${stale} stale known peer(s) with invalid addresses`);
              if (valid.length === 0) {
                clearKnownPeers();
              } else {
                valid.forEach((p) => addKnownPeer(p.address));
              }
            }
            if (valid.length > 0) {
              log(`Reconnecting to ${valid.length} known peer(s)...`);
              valid.forEach((p) => {
                bridgeDial(p.address).catch(() => {
                  log(`Auto-reconnect failed for ${p.address.slice(0, 40)}... (silent)`);
                });
              });
            }
          }
          break;

        case 'message': {
          try {
            const raw = (evt as any).data;
            const fromPeer = (evt as any).from as string | undefined;
            const incomingChannel = (evt as any).channelId as string;
            log(`MSG-recv ch=${incomingChannel} from=${(fromPeer ?? '?').slice(0, 12)} raw_len=${typeof raw === 'string' ? raw.length : '?'}`);
            const msg = JSON.parse(raw) as Message;
            log(`MSG-add id=${msg.id.slice(0, 16)} author=${msg.authorId.slice(0, 12)} content="${msg.content.slice(0, 30)}"`);

            // If this is a DM message and we don't have a channel for it,
            // auto-create one so the user sees the conversation
            if (incomingChannel.startsWith('dm:') && fromPeer) {
              const store = useSpaceStore.getState();
              if (!store.getDmChannelByPeerId(fromPeer)) {
                store.addDmChannel(fromPeer);
                log(`Auto-created DM channel for incoming message from ${fromPeer.slice(0, 16)}`);
              }
            }

            addMessage(incomingChannel, msg);
          } catch (parseErr) {
            log(`MSG-parse-error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
          }
          break;
        }

        case 'peer:connect':
          setConnectedPeers(evt.peers ?? []);
          log(`Peer connected: ${evt.peerId.slice(0, 16)}...`);
          break;

        case 'peer:disconnect':
          setConnectedPeers(evt.peers ?? []);
          log(`Peer disconnected: ${evt.peerId.slice(0, 16)}...`);
          break;

        case 'invite_code':
          setInviteCode((evt as any).code);
          log(`Invite code received: ${(evt as any).code}`);
          break;

        case 'dial_result': {
          const wasUserDial = userDialsRef.current.has(evt.address);
          if (wasUserDial) userDialsRef.current.delete(evt.address);
          if (evt.ok) {
            log(`Dial succeeded: ${evt.address.slice(0, 50)}...`);
            addKnownPeer(evt.address);
            if (evt.peers) setConnectedPeers(evt.peers);

            // If the dial resolved a remote peerId (invite code flow), auto-create DM
            if (evt.peerId) {
              const store = useSpaceStore.getState();
              const dmCh = store.addDmChannel(evt.peerId);
              store.setActiveSpace('dms');
              store.setActiveChannel(dmCh.id);
              log(`DM channel created for ${evt.peerId.slice(0, 16)}`);
            }
          } else {
            const errMsg = evt.error ?? 'Unknown dial error';
            log(`Dial failed: ${errMsg}`);
            if (wasUserDial) {
              setError(errMsg);
            }
          }
          break;
        }

        case 'net_stats':
          setNetStats(evt as unknown as NetStats);
          // Sync peer count from sidecar (WebRTC connections are persistent)
          if (evt.peers && Array.isArray(evt.peers)) {
            setConnectedPeers(evt.peers);
          }
          break;

        case 'error':
          setError(evt.message);
          log(`Error: ${evt.message}`);
          if (evt.message.includes('exited') || evt.message.includes('read error')) {
            setStatus('error');
          }
          break;

        case 'log':
          log(evt.message);
          break;

        default:
          break;
      }
    }

    init();

    return () => {
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      // Use sidecar PeerId as authorId — unique per running instance
      const authorId = peerIdRef.current;
      if (!authorId) return;
      const timestamp = Date.now();
      const payload = JSON.stringify({ content, authorId, timestamp });
      const signature = await sign(payload);
      const msg: Message = {
        id: createMessageId(),
        channelId,
        authorId,
        content: content.trim(),
        timestamp,
        signature,
      };
      // Add to local store immediately (optimistic)
      addMessage(channelId, msg);

      // For DM channels, extract the target peer and send point-to-point
      const targetPeerId = channelId.startsWith('dm:')
        ? channelId.slice(3)
        : undefined;
      await bridgeSend(channelId, JSON.stringify(msg), targetPeerId);
    },
    [channelId, addMessage]
  );

  // ── Connect to peer (manual — supports invite codes and multiaddrs) ───
  const connectToPeer = useCallback(
    async (addr: string) => {
      if (!addr?.trim()) return;
      const trimmed = addr.trim();

      // Accept invite codes (XXXX-XXXX) or multiaddrs (starts with /)
      const isInviteCode = INVITE_CODE_RE.test(trimmed);
      if (!isInviteCode && !trimmed.startsWith('/')) {
        setError('Enter an invite code (e.g. ABCD-1234) or a multiaddr starting with "/"');
        return;
      }

      setError(null);
      try {
        if (isInviteCode) {
          log(`Connecting via invite code: ${trimmed}`);
        } else {
          log(`Dialing peer: ${trimmed.slice(0, 50)}...`);
        }
        userDialsRef.current.add(trimmed);
        await bridgeDial(trimmed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        log(`Dial invoke error: ${msg}`);
      }
    },
    [log]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
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
  };
}

export { DEFAULT_CHANNEL };
