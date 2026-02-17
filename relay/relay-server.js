/**
 * Concord Relay Server
 *
 * A lightweight libp2p relay that:
 *  1. Circuit relay v2 for peer discovery / reservation
 *  2. HTTP API for invite code registration/lookup
 *  3. HTTP message queue for reliable message forwarding between NAT'd peers
 *
 * Ports:
 *   9090 — WebSocket (libp2p relay)
 *   8080 — HTTP API  (invite codes + health check + message queue)
 */
import http from 'node:http';
import { createLibp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { webSockets } from '@libp2p/websockets';

const WS_PORT = parseInt(process.env.WS_PORT || '9090', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '8080', 10);
const CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ── Invite code registry ────────────────────────────────────────

// code -> { peerId, lastSeen }
const codeToEntry = new Map();
// peerId -> code  (reverse lookup to reuse codes)
const peerToCode = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 for readability
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function registerPeer(peerId) {
  // If already registered, refresh and return same code
  if (peerToCode.has(peerId)) {
    const code = peerToCode.get(peerId);
    const entry = codeToEntry.get(code);
    if (entry) {
      entry.lastSeen = Date.now();
      return code;
    }
  }
  // Generate unique code
  let code;
  do { code = generateCode(); } while (codeToEntry.has(code));
  codeToEntry.set(code, { peerId, lastSeen: Date.now() });
  peerToCode.set(peerId, code);
  return code;
}

function lookupCode(code) {
  const entry = codeToEntry.get(code.toUpperCase());
  if (!entry) return null;
  entry.lastSeen = Date.now(); // refresh TTL
  return entry;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [code, entry] of codeToEntry) {
    if (now - entry.lastSeen > CODE_TTL_MS) {
      codeToEntry.delete(code);
      peerToCode.delete(entry.peerId);
    }
  }
}

setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);

// ── Message queue ────────────────────────────────────────────────
// peerId -> [ { from, channelId, data, ts } ]
const messageQueues = new Map();
const MSG_TTL_MS = 5 * 60 * 1000; // messages expire after 5 minutes
const MSG_MAX_PER_PEER = 200;

function enqueueMessage(toPeerId, fromPeerId, channelId, data) {
  if (!messageQueues.has(toPeerId)) {
    messageQueues.set(toPeerId, []);
  }
  const queue = messageQueues.get(toPeerId);
  queue.push({ from: fromPeerId, channelId, data, ts: Date.now() });
  // Trim old messages
  while (queue.length > MSG_MAX_PER_PEER) queue.shift();
}

function dequeueMessages(peerId, since = 0) {
  const queue = messageQueues.get(peerId);
  if (!queue || queue.length === 0) return [];
  const now = Date.now();
  // Filter expired and already-seen messages
  const fresh = queue.filter(m => m.ts > since && (now - m.ts) < MSG_TTL_MS);
  // Clear delivered messages
  messageQueues.set(peerId, []);
  return fresh;
}

// Clean up stale queues periodically
setInterval(() => {
  const now = Date.now();
  for (const [pid, queue] of messageQueues) {
    const live = queue.filter(m => (now - m.ts) < MSG_TTL_MS);
    if (live.length === 0) {
      messageQueues.delete(pid);
    } else {
      messageQueues.set(pid, live);
    }
  }
}, 60_000);

// ── libp2p relay node ───────────────────────────────────────────

const node = await createLibp2p({
  addresses: { listen: [`/ip4/0.0.0.0/tcp/${WS_PORT}/ws`] },
  transports: [webSockets()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    identify: identify(),
    relay: circuitRelayServer({
      reservations: {
        maxReservations: 256,
        defaultDurationLimit: 300, // 5 min per reservation
        defaultDataLimit: BigInt(1 << 24), // 16 MB
      },
    }),
  },
});

const relayPeerId = node.peerId.toString();
const relayAddrs = node.getMultiaddrs().map(String);

// The external address clients should use to reach this relay.
// On Fly.io, the WebSocket is proxied through port 443 with TLS.
const EXTERNAL_HOSTNAME = process.env.RELAY_HOSTNAME || 'concord-relay.fly.dev';
const externalRelayAddr = `/dns4/${EXTERNAL_HOSTNAME}/tcp/443/wss/p2p/${relayPeerId}`;

console.log(`Relay started. PeerId: ${relayPeerId}`);
console.log(`Listening on:`, relayAddrs);
console.log(`External address: ${externalRelayAddr}`);

// Track peer connections
node.addEventListener('peer:connect', (evt) => {
  const pid = evt.detail.toString();
  console.log(`Peer connected: ${pid.slice(0, 20)}...`);
});

node.addEventListener('peer:disconnect', (evt) => {
  const pid = evt.detail.toString();
  console.log(`Peer disconnected: ${pid.slice(0, 20)}...`);
});

// ── HTTP API ────────────────────────────────────────────────────

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
  const path = url.pathname;

  if (path === '/health') {
    return jsonResponse(res, 200, {
      status: 'ok',
      relayPeerId,
      peers: node.getPeers().length,
      codes: codeToEntry.size,
      uptime: process.uptime(),
    });
  }

  if (path === '/register') {
    const peerId = url.searchParams.get('peerId');
    if (!peerId) return jsonResponse(res, 400, { error: 'Missing peerId parameter' });
    const code = registerPeer(peerId);
    const circuitAddr = `${externalRelayAddr}/p2p-circuit/p2p/${peerId}`;
    return jsonResponse(res, 200, { code, relayPeerId, relayAddr: externalRelayAddr, circuitAddr });
  }

  if (path === '/lookup') {
    const code = url.searchParams.get('code');
    if (!code) return jsonResponse(res, 400, { error: 'Missing code parameter' });
    const entry = lookupCode(code);
    if (!entry) return jsonResponse(res, 404, { error: 'Code not found or expired' });
    const circuitAddr = `${externalRelayAddr}/p2p-circuit/p2p/${entry.peerId}`;
    return jsonResponse(res, 200, { peerId: entry.peerId, relayAddr: externalRelayAddr, circuitAddr });
  }

  // ── Message forwarding ────────────────────────────────────────
  // POST /send — enqueue a message for a peer
  if (path === '/send' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        if (!msg.to || !msg.from || !msg.channelId || msg.data === undefined) {
          return jsonResponse(res, 400, { error: 'Missing fields: to, from, channelId, data' });
        }
        enqueueMessage(msg.to, msg.from, msg.channelId, msg.data);
        console.log(`MSG: ${msg.from.slice(0, 12)} -> ${msg.to.slice(0, 12)} ch=${msg.channelId}`);
        return jsonResponse(res, 200, { ok: true });
      } catch (e) {
        return jsonResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // GET /poll?peerId=X&since=timestamp — fetch queued messages
  if (path === '/poll') {
    const peerId = url.searchParams.get('peerId');
    if (!peerId) return jsonResponse(res, 400, { error: 'Missing peerId' });
    const since = parseInt(url.searchParams.get('since') || '0', 10);
    const messages = dequeueMessages(peerId, since);
    return jsonResponse(res, 200, { messages });
  }

  // Relay info (public)
  if (path === '/info') {
    return jsonResponse(res, 200, { relayPeerId, relayAddrs, externalRelayAddr });
  }

  jsonResponse(res, 404, { error: 'Not found' });
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
});
