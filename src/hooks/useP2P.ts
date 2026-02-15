/**
 * Hook to initialize P2P, subscribe to channel, and send messages
 */
import { useEffect, useState, useCallback } from 'react';
import {
  createP2PNode,
  subscribeToChannel,
  publishToChannel,
  dialPeer,
  getPeerId,
  getConnectedPeers,
  getListeningAddresses,
  DEFAULT_CHANNEL,
} from '../services/libp2p';
import { initIdentity, getPublicKey, sign } from '../services/identity';
import { useMessageStore } from '../stores/messageStore';
import type { Message } from '@antisurveillancestate/protocol';

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useP2P(relayAddr: string | null, channelId: string = DEFAULT_CHANNEL) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [peerId, setPeerId] = useState<string>('');
  const [shortId, setShortId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const addMessage = useMessageStore((s) => s.addMessage);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    async function init() {
      try {
        setStatus('connecting');
        setError(null);
        const { shortId: sid } = await initIdentity();
        setShortId(sid);

        const node = await createP2PNode();
        setPeerId(node.peerId.toString());

        if (relayAddr?.trim()) {
          const { multiaddr } = await import('@multiformats/multiaddr');
          await node.dial(multiaddr(relayAddr.trim()));
        }

        unsub = subscribeToChannel(channelId, (data, from) => {
          try {
            const msg = JSON.parse(data) as Message;
            if (msg.authorId !== getPublicKey()) {
              addMessage(channelId, msg);
            }
          } catch {
            // ignore malformed
          }
        });

        setStatus('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    }

    init();
    return () => {
      unsub?.();
    };
  }, [relayAddr, channelId, addMessage]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      const authorId = getPublicKey();
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
      addMessage(channelId, msg);
      await publishToChannel(channelId, JSON.stringify(msg));
    },
    [channelId, addMessage]
  );

  const connectToPeer = useCallback(async (addr: string) => {
    if (!addr?.trim()) return;
    try {
      await dialPeer(addr.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return {
    status,
    peerId,
    shortId,
    error,
    sendMessage,
    connectToPeer,
    connectedPeers: getConnectedPeers(),
    listeningAddrs: getListeningAddresses(),
  };
}
