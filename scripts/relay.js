/**
 * libp2p Circuit Relay Server
 * Browsers connect here first, then establish direct WebRTC connections.
 * Run: pnpm relay
 */
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { webSockets } from '@libp2p/websockets';
import { createLibp2p } from 'libp2p';

const server = await createLibp2p({
  addresses: {
    listen: ['/ip4/127.0.0.1/tcp/0/ws'],
  },
  transports: [webSockets()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    identify: identify(),
    relay: circuitRelayServer({
      reservations: {
        maxReservations: Infinity,
      },
    }),
  },
});

const addrs = server.getMultiaddrs().map((ma) => ma.toString());
console.log('AntiSurveillanceState Relay listening on:');
addrs.forEach((addr) => console.log('  ', addr));
console.log('\nCopy a multiaddr and paste it in the app to connect.');
