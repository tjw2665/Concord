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

// Type for the pubsub service — gossipsub's @libp2p/interface version mismatch
// means we need to use `any` for the service type and access it dynamically.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPubsub(): any {
  if (!libp2pNode) throw new Error('libp2p not initialized');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ps = (libp2pNode.services as any).pubsub;
  if (!ps) throw new Error('pubsub service not available');
  return ps;
}

/**
 * Create (or return existing) libp2p node.
 * relayAddr MUST be provided on first call — passing null creates a
 * node that cannot reach the relay. Call destroyP2PNode() first if you
 * need to re-create with a different relay address.
 */
export async function createP2PNode(relayAddr: string): Promise<Libp2p> {
  if (libp2pNode) return libp2pNode;

  const cleanRelay = relayAddr.trim().replace(/\/$/, '');
  if (!cleanRelay) {
    throw new Error('relayAddr is required to create the P2P node');
  }

  // Use `as any` to work around the @libp2p/interface v2 vs v3 type mismatch
  // in @chainsafe/libp2p-gossipsub. The runtime behavior is correct.
  //
  // NOTE: We do NOT put the relay address in `listen`. Instead, we create the
  // node with circuit-relay transport available but no listen addresses for it.
  // After creation, useP2P dials the relay and the circuit relay transport
  // automatically makes a reservation. This avoids the
  // UnsupportedListenAddressesError that occurs when the node tries to listen
  // on a relay it hasn't connected to yet.
  //
  // FaultTolerance.NO_FATAL (= 1) lets the node start even if /webrtc listen fails.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  libp2pNode = await createLibp2p({
    addresses: {
      listen: ['/webrtc'],
    },
    transports: [webSockets(), webRTC(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    transportManager: {
      faultTolerance: 1, // FaultTolerance.NO_FATAL
    },
    services: {
      identify: identify(),
      pubsub: gossipsub({
        emitSelf: true,
        fallbackToFloodsub: true,
      }) as any,
    },
  });

  return libp2pNode;
}

/**
 * Stop and destroy the singleton libp2p node so it can be recreated.
 */
export async function destroyP2PNode(): Promise<void> {
  if (!libp2pNode) return;
  try {
    await libp2pNode.stop();
  } catch {
    // best-effort
  }
  libp2pNode = null;
}

export function getP2PNode(): Libp2p | null {
  return libp2pNode;
}

export async function dialPeer(peerMultiaddr: string): Promise<void> {
  if (!libp2pNode) throw new Error('libp2p not initialized');
  const { multiaddr } = await import('@multiformats/multiaddr');
  await libp2pNode.dial(multiaddr(peerMultiaddr));
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
  const pubsub = getPubsub();
  const topic = CHANNEL_TOPIC_PREFIX + channelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (event: any) => {
    const detail = event.detail ?? event;
    if (detail.topic !== topic) return;
    const data = toString(detail.data);
    onMessage(data, detail.from?.toString() ?? 'unknown');
  };

  pubsub.addEventListener('message', handler);
  pubsub.subscribe(topic);

  return () => {
    pubsub.removeEventListener('message', handler);
    pubsub.unsubscribe(topic);
  };
}

export async function publishToChannel(channelId: string, data: string): Promise<void> {
  const pubsub = getPubsub();
  const topic = CHANNEL_TOPIC_PREFIX + channelId;
  await pubsub.publish(topic, fromString(data));
}

export function getChannelTopic(channelId: string): string {
  return CHANNEL_TOPIC_PREFIX + channelId;
}

export { DEFAULT_CHANNEL };
