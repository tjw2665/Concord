/**
 * libp2p P2P networking service
 * Uses GossipSub for message broadcast, WebRTC + Circuit Relay for browser connectivity
 */
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { webRTC } from '@libp2p/webrtc';
import { webSockets } from '@libp2p/websockets';
import { createLibp2p } from 'libp2p';
import { fromString, toString } from 'uint8arrays';
import type { Libp2p } from 'libp2p';

const CHANNEL_TOPIC_PREFIX = 'ass/channel/';
const DEFAULT_CHANNEL = 'general';

let libp2pNode: Libp2p | null = null;

export async function createP2PNode(): Promise<Libp2p> {
  if (libp2pNode) return libp2pNode;

  libp2pNode = await createLibp2p({
    addresses: {
      listen: ['/p2p-circuit', '/webrtc'],
    },
    transports: [webSockets(), webRTC(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    services: {
      identify: identify(),
      pubsub: gossipsub({
        emitSelf: true,
        fallbackToFloodsub: true,
      }),
    },
  });

  await libp2pNode.start();
  return libp2pNode;
}

export function getP2PNode(): Libp2p | null {
  return libp2pNode;
}

export async function connectToRelay(relayMultiaddr: string): Promise<void> {
  const node = await createP2PNode();
  const { multiaddr } = await import('@multiformats/multiaddr');
  await node.dial(multiaddr(relayMultiaddr));
}

export async function dialPeer(peerMultiaddr: string): Promise<void> {
  const node = await createP2PNode();
  const { multiaddr } = await import('@multiformats/multiaddr');
  await node.dial(multiaddr(peerMultiaddr));
}

export function getPeerId(): string {
  if (!libp2pNode) throw new Error('libp2p not initialized');
  return libp2pNode.peerId.toString();
}

export function getConnectedPeers(): string[] {
  if (!libp2pNode) return [];
  return libp2pNode.getPeers().map((p) => p.toString());
}

export function getListeningAddresses(): string[] {
  if (!libp2pNode) return [];
  return libp2pNode.getMultiaddrs().map((ma) => ma.toString());
}

export function subscribeToChannel(
  channelId: string,
  onMessage: (data: string, from: string) => void
): () => void {
  if (!libp2pNode) throw new Error('libp2p not initialized');
  const topic = CHANNEL_TOPIC_PREFIX + channelId;
  const pubsub = libp2pNode.services.pubsub;

  const handler = (event: CustomEvent<{ topic: string; data: Uint8Array; from: string }>) => {
    if (event.detail.topic !== topic) return;
    const data = toString(event.detail.data);
    onMessage(data, event.detail.from?.toString() ?? 'unknown');
  };

  pubsub.addEventListener('message', handler);
  pubsub.subscribe(topic);

  return () => {
    pubsub.removeEventListener('message', handler);
    pubsub.unsubscribe(topic);
  };
}

export async function publishToChannel(channelId: string, data: string): Promise<void> {
  if (!libp2pNode) throw new Error('libp2p not initialized');
  const topic = CHANNEL_TOPIC_PREFIX + channelId;
  await libp2pNode.services.pubsub.publish(topic, fromString(data));
}

export function getChannelTopic(channelId: string): string {
  return CHANNEL_TOPIC_PREFIX + channelId;
}

export { DEFAULT_CHANNEL };
