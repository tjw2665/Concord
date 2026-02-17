/**
 * P2P Sidecar — libp2p node with direct stream messaging + relay
 *
 * Communicates with the Tauri frontend via:
 *   stdin  <- JSON-line commands  (send, dial)
 *   stdout -> JSON-line events    (ready, message, peer:connect, error, ...)
 *   stderr -> debug log
 *
 * Messaging uses a simple custom protocol: /concord/chat/1.0.0
 *   - When sending: open a stream to each connected peer, write JSON, close.
 *   - When receiving: read JSON from incoming streams, emit to frontend.
 *   No pub/sub. No gossip. Just direct delivery.
 *
 * Relay:
 *   Connects to the Concord relay on Fly.io for NAT traversal.
 *   Registers for a short invite code (XXXX-XXXX) so peers can connect easily.
 *
 * Environment:
 *   CONCORD_DATA_DIR — app data directory for persistent identity
 */
import { createServer } from 'net';
import https from 'https';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { networkInterfaces } from 'os';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { webSockets } from '@libp2p/websockets';
import { mdns } from '@libp2p/mdns';
import { createLibp2p } from 'libp2p';
import { toString, fromString } from 'uint8arrays';
import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf } from '@libp2p/crypto/keys';
import { multiaddr } from '@multiformats/multiaddr';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'relay-config.json');
const CHAT_PROTOCOL = '/concord/chat/1.0.0';
const DEFAULT_CHANNEL = 'general';

const DATA_DIR = process.env.CONCORD_DATA_DIR || join(__dirname, '..');
const IDENTITY_PATH = join(DATA_DIR, 'node-identity.json');

// ── Relay configuration ─────────────────────────────────────────
const RELAY_HTTP_URL = 'https://concord-relay.fly.dev:8080';
const RELAY_WS_ADDR = '/dns4/concord-relay.fly.dev/tcp/443/wss';
// Invite code pattern: XXXX-XXXX
const INVITE_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

// ── Helpers ──────────────────────────────────────────────────────

function emit(event) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

function log(msg) {
  process.stderr.write(`[sidecar] ${msg}\n`);
  emit({ type: 'log', message: msg });
}

function getLanIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

// ── HTTP helpers (no external deps) ──────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let rbody = '';
      res.on('data', (chunk) => { rbody += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(rbody)); }
        catch { reject(new Error(`Invalid JSON: ${rbody.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Post timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Known chat peers (tracks peers we should send messages to) ───
// peerId string -> true
const knownChatPeers = new Set();

// ── Identity ─────────────────────────────────────────────────────

async function loadOrCreateIdentity(portConflict) {
  if (portConflict) {
    log('Port conflict — ephemeral identity');
    return { privateKey: await generateKeyPair('Ed25519'), isNew: false, isEphemeral: true };
  }

  try {
    if (existsSync(IDENTITY_PATH)) {
      const data = JSON.parse(readFileSync(IDENTITY_PATH, 'utf-8'));
      if (data.privateKey) {
        const key = privateKeyFromProtobuf(Buffer.from(data.privateKey, 'base64'));
        log(`Loaded identity from ${IDENTITY_PATH}`);
        return { privateKey: key, isNew: false, isEphemeral: false };
      }
    }
  } catch (e) {
    log(`Failed to load identity: ${e.message}`);
  }

  const key = await generateKeyPair('Ed25519');
  try {
    mkdirSync(dirname(IDENTITY_PATH), { recursive: true });
    writeFileSync(IDENTITY_PATH, JSON.stringify({
      privateKey: Buffer.from(privateKeyToProtobuf(key)).toString('base64'),
      createdAt: new Date().toISOString(),
    }, null, 2));
    log(`Saved new identity to ${IDENTITY_PATH}`);
  } catch (e) {
    log(`Warning: could not save identity: ${e.message}`);
  }
  return { privateKey: key, isNew: true, isEphemeral: false };
}

// ── Port management ──────────────────────────────────────────────

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '0.0.0.0', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.listen(port, '0.0.0.0', () => { tester.close(() => resolve(true)); });
    tester.on('error', () => resolve(false));
  });
}

async function loadOrCreatePort() {
  try {
    const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    if (typeof data.port === 'number' && data.port > 0) {
      if (await isPortAvailable(data.port)) return { port: data.port, conflict: false };
      log(`Saved port ${data.port} in use, picking new one`);
      return { port: await getAvailablePort(), conflict: true };
    }
  } catch { /* missing config */ }
  const port = await getAvailablePort();
  writeFileSync(CONFIG_PATH, JSON.stringify({ port }, null, 2));
  return { port, conflict: false };
}

// ── Fetch relay info ─────────────────────────────────────────────

async function getRelayInfo() {
  try {
    const info = await fetchJson(`${RELAY_HTTP_URL}/info`);
    log(`Relay info: PeerId=${info.relayPeerId}`);
    return info.relayPeerId;
  } catch (e) {
    log(`Could not reach relay: ${e.message}`);
    return null;
  }
}

// ── Create libp2p node ───────────────────────────────────────────

async function createNode(port, privateKey, relayPeerId) {
  const listenAddrs = [`/ip4/0.0.0.0/tcp/${port}/ws`];

  // If we know the relay PeerId, add a circuit relay listen address.
  // This tells the circuit relay transport to connect to the relay
  // and make a reservation so other peers can reach us through it.
  if (relayPeerId) {
    listenAddrs.push(`${RELAY_WS_ADDR}/p2p/${relayPeerId}/p2p-circuit`);
    log(`Will listen on relay circuit: ${RELAY_WS_ADDR}/p2p/${relayPeerId}/p2p-circuit`);
  }

  return createLibp2p({
    privateKey,
    addresses: { listen: listenAddrs },
    transports: [
      webSockets(),
      circuitRelayTransport({ discoverRelays: 1 }),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: { denyDialMultiaddr: () => false },
    peerDiscovery: [mdns()],
    services: {
      identify: identify(),
    },
  });
}

// ── Counters ─────────────────────────────────────────────────────

const stats = { sent: 0, sendFail: 0, recv: 0, recvFail: 0 };

// ── Direct chat protocol ─────────────────────────────────────────

/**
 * Send a message to a single peer via the relay HTTP message queue.
 * This is reliable — messages are stored on the relay and polled by the recipient.
 */
async function sendViaRelay(fromPeerId, toPeerId, channelId, data) {
  const pid = toPeerId.slice(0, 16);
  log(`relay-send: ${fromPeerId.slice(0, 12)} -> ${pid} ch=${channelId}`);
  try {
    await postJson(`${RELAY_HTTP_URL}/send`, {
      to: toPeerId,
      from: fromPeerId,
      channelId,
      data,
    });
    stats.sent++;
    log(`relay-send: OK -> ${pid} (total sent: ${stats.sent})`);
  } catch (e) {
    stats.sendFail++;
    log(`relay-send: FAIL -> ${pid}: ${e.message}`);
  }
}

/**
 * Send a message to a single peer. Tries direct libp2p stream first (for LAN peers),
 * falls back to relay HTTP forwarding for NAT'd peers.
 */
async function sendToPeer(node, peerId, payload, myPeerId) {
  const pidStr = peerId.toString();
  const pid = pidStr.slice(0, 16);

  // Try direct libp2p stream first (works for LAN peers)
  const isDirectlyConnected = node.getPeers().some(p => p.toString() === pidStr);
  if (isDirectlyConnected) {
    try {
      log(`send-direct: opening stream to ${pid}`);
      const stream = await node.dialProtocol(peerId, CHAT_PROTOCOL, {
        runOnLimitedConnection: true,
      });
      const bytes = fromString(payload + '\n');
      stream.send(bytes);
      await stream.close();
      stats.sent++;
      log(`send-direct: OK -> ${pid}`);
      return;
    } catch (e) {
      log(`send-direct: failed -> ${pid}: ${e.message}, falling back to relay`);
    }
  }

  // Fall back to relay HTTP message queue
  try {
    const parsed = JSON.parse(payload);
    await sendViaRelay(myPeerId, pidStr, parsed.channelId || DEFAULT_CHANNEL, payload);
  } catch (e) {
    stats.sendFail++;
    log(`send: FAIL -> ${pid}: ${e.message}`);
  }
}

/**
 * Send a message to every known chat peer. Uses relay forwarding for NAT'd peers.
 */
async function sendToAllPeers(node, payload, relayId, myPeerId) {
  // Combine currently connected peers and known chat peers
  const connectedPeerIds = node.getPeers()
    .filter(p => !relayId || p.toString() !== relayId)
    .map(p => p.toString());
  const allTargets = new Set([...connectedPeerIds, ...knownChatPeers]);
  // Remove relay from targets
  if (relayId) allTargets.delete(relayId);
  // Remove self
  if (myPeerId) allTargets.delete(myPeerId);

  if (allTargets.size === 0) {
    log('send: no known chat peers');
    return;
  }
  log(`send: broadcasting to ${allTargets.size} peer(s) (${connectedPeerIds.length} direct, ${knownChatPeers.size} known)`);

  const results = await Promise.allSettled(
    [...allTargets].map(async (pidStr) => {
      const peerObj = node.getPeers().find(p => p.toString() === pidStr);
      if (peerObj) {
        return sendToPeer(node, peerObj, payload, myPeerId);
      } else {
        // Not directly connected — use relay
        const parsed = JSON.parse(payload);
        return sendViaRelay(myPeerId, pidStr, parsed.channelId || DEFAULT_CHANNEL, payload);
      }
    })
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      log(`send: broadcast error: ${r.reason?.message ?? r.reason}`);
    }
  }
}

/**
 * Register the incoming chat protocol handler.
 * Reads newline-delimited JSON from the stream.
 */
function registerChatHandler(node) {
  // runOnLimitedConnection: true — required so we accept streams over circuit relay
  node.handle(CHAT_PROTOCOL, (stream, connection) => {
    const remotePeer = connection.remotePeer.toString();
    const remoteShort = remotePeer.slice(0, 16);
    log(`recv: incoming stream from ${remoteShort} protocol=${CHAT_PROTOCOL}`);

    // Collect data from the stream (libp2p v3: iterate the stream directly)
    (async () => {
      let buffer = '';
      let chunkCount = 0;
      try {
        for await (const chunk of stream) {
          const raw = chunk instanceof Uint8Array ? chunk : chunk.subarray();
          chunkCount++;
          const text = toString(raw);
          log(`recv: chunk #${chunkCount} from ${remoteShort}, ${raw.length} bytes`);
          buffer += text;

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              stats.recv++;
              log(`recv: msg from=${remoteShort} ch=${msg.channelId} (total recv: ${stats.recv})`);
              emit({
                type: 'message',
                channelId: msg.channelId || DEFAULT_CHANNEL,
                data: msg.data,
                from: remotePeer,
              });
            } catch (e) {
              stats.recvFail++;
              log(`recv: parse error: ${e.message} | raw: ${line.slice(0, 100)}`);
            }
          }
        }
        log(`recv: stream from ${remoteShort} closed after ${chunkCount} chunk(s)`);
        // Handle any remaining buffer after stream closes
        if (buffer.trim()) {
          try {
            const msg = JSON.parse(buffer);
            stats.recv++;
            emit({
              type: 'message',
              channelId: msg.channelId || DEFAULT_CHANNEL,
              data: msg.data,
              from: remotePeer,
            });
          } catch { /* incomplete data */ }
        }
      } catch (e) {
        if (!e.message?.includes('abort') && !e.message?.includes('reset')) {
          log(`recv: stream error from ${remoteShort}: ${e.message}`);
        }
      }
    })();
  }, { runOnLimitedConnection: true });
  log(`Registered chat protocol: ${CHAT_PROTOCOL}`);
}

// ── Main ─────────────────────────────────────────────────────────

let node;

try {
  const { port, conflict } = await loadOrCreatePort();
  const { privateKey, isNew, isEphemeral } = await loadOrCreateIdentity(conflict);

  // Fetch relay info before creating the node so we can include
  // the circuit relay listen address, which triggers an automatic reservation.
  log('Fetching relay info...');
  let relayPeerId = await getRelayInfo();

  try {
    node = await createNode(port, privateKey, relayPeerId);
  } catch (err) {
    const addrInUse =
      err?.message?.includes('EADDRINUSE') ||
      err?.code === 'ERR_NO_VALID_ADDRESSES' ||
      err?.constructor?.name === 'UnsupportedListenAddressesError';
    if (addrInUse) {
      log(`Port ${port} in use, retrying...`);
      try { unlinkSync(CONFIG_PATH); } catch { /* ok */ }
      const newPort = await getAvailablePort();
      writeFileSync(CONFIG_PATH, JSON.stringify({ port: newPort }, null, 2));
      node = await createNode(newPort, privateKey, relayPeerId);
    } else {
      throw err;
    }
  }

  // Register the chat protocol handler
  registerChatHandler(node);

  const peerId = node.peerId.toString();

  // Find the local listen port from multiaddrs (skip circuit relay addrs)
  const localAddrs = node.getMultiaddrs().filter(ma => !ma.toString().includes('p2p-circuit'));
  const firstAddr = localAddrs[0]?.toString() ?? '';
  const portMatch = firstAddr.match(/\/tcp\/(\d+)\//);
  const actualPort = portMatch ? Number(portMatch[1]) : port;
  const localAddr = `/ip4/127.0.0.1/tcp/${actualPort}/ws/p2p/${peerId}`;
  const lanIp = getLanIp();
  const lanAddr = lanIp ? `/ip4/${lanIp}/tcp/${actualPort}/ws/p2p/${peerId}` : null;

  log(`Started. PeerId=${peerId} port=${actualPort} ephemeral=${isEphemeral}`);
  log(`All multiaddrs: ${node.getMultiaddrs().map(String).join(', ')}`);

  // ── Register invite code with relay ────────────────────────────
  let inviteCode = null;

  async function registerInviteCode() {
    if (!relayPeerId) return;
    try {
      const reg = await fetchJson(`${RELAY_HTTP_URL}/register?peerId=${peerId}`);
      inviteCode = reg.code;
      log(`Invite code: ${inviteCode}`);
      emit({ type: 'invite_code', code: inviteCode });
    } catch (e) {
      log(`Invite code registration failed: ${e.message}`);
      setTimeout(registerInviteCode, 10000);
    }
  }

  async function reconnectRelay() {
    try {
      log('Reconnecting to relay...');
      relayPeerId = await getRelayInfo();
      if (!relayPeerId) {
        setTimeout(reconnectRelay, 15000);
        return;
      }
      const relayAddr = `${RELAY_WS_ADDR}/p2p/${relayPeerId}`;
      await node.dial(multiaddr(relayAddr));
      log('Reconnected to relay!');
      await registerInviteCode();
    } catch (e) {
      log(`Relay reconnection failed: ${e.message}`);
      setTimeout(reconnectRelay, 15000);
    }
  }

  // Register the invite code once relay reservation is established.
  // Give the node a moment for the circuit relay transport to finish reserving.
  if (relayPeerId) {
    setTimeout(registerInviteCode, 3000);
  }

  // ── Relay message polling ───────────────────────────────────────
  let lastPollTs = Date.now();
  let pollErrors = 0;

  async function pollRelayMessages() {
    if (!relayPeerId) return;
    try {
      const result = await fetchJson(`${RELAY_HTTP_URL}/poll?peerId=${encodeURIComponent(peerId)}&since=0`);
      pollErrors = 0;
      if (result.messages && result.messages.length > 0) {
        log(`poll: received ${result.messages.length} message(s) from relay`);
        for (const msg of result.messages) {
          stats.recv++;
          // The 'data' field contains the full JSON-stringified message payload
          try {
            const parsed = JSON.parse(msg.data);
            emit({
              type: 'message',
              channelId: parsed.channelId || msg.channelId || DEFAULT_CHANNEL,
              data: parsed.data,
              from: msg.from,
            });
          } catch {
            // If data isn't double-encoded, emit as-is
            emit({
              type: 'message',
              channelId: msg.channelId || DEFAULT_CHANNEL,
              data: msg.data,
              from: msg.from,
            });
          }
        }
      }
      lastPollTs = Date.now();
    } catch (e) {
      pollErrors++;
      if (pollErrors <= 3) {
        log(`poll: error (${pollErrors}): ${e.message}`);
      }
    }
  }

  // Poll every 1.5 seconds for low latency
  const pollInterval = setInterval(pollRelayMessages, 1500);

  /** Merge libp2p connected peers with knownChatPeers for a full list */
  function allKnownPeers() {
    const set = new Set([...node.getPeers().map(String), ...knownChatPeers]);
    if (relayPeerId) set.delete(relayPeerId);
    return [...set];
  }

  // ── Peer events ────────────────────────────────────────────────
  node.addEventListener('peer:connect', (evt) => {
    const pid = evt.detail.toString();
    log(`Peer connected: ${pid}`);
    // Track non-relay peers as known chat peers
    if (pid !== relayPeerId) {
      knownChatPeers.add(pid);
      log(`Added ${pid.slice(0, 16)} to known chat peers (total: ${knownChatPeers.size})`);
    }
    emit({ type: 'peer:connect', peerId: pid, peers: allKnownPeers() });
  });

  node.addEventListener('peer:disconnect', (evt) => {
    const pid = evt.detail.toString();
    log(`Peer disconnected: ${pid}`);
    // Report known peers — NOT raw getPeers(), so the UI stays stable
    emit({ type: 'peer:disconnect', peerId: pid, peers: allKnownPeers() });

    // If relay disconnected, attempt reconnection
    if (relayPeerId && pid === relayPeerId) {
      log('Relay disconnected, attempting reconnection...');
      setTimeout(reconnectRelay, 5000);
    }
  });

  node.addEventListener('peer:discovery', (evt) => {
    const d = evt.detail;
    log(`Discovered: ${d.id.toString().slice(0, 16)}... (${d.multiaddrs?.length ?? 0} addrs)`);
  });

  // ── Identify — log remote peer protocols ───────────────────────
  node.addEventListener('peer:identify', (evt) => {
    const detail = evt.detail;
    const pid = detail.peerId?.toString()?.slice(0, 16) ?? '?';
    const protos = detail.protocols ?? [];
    const hasChatProto = protos.some((p) => p === CHAT_PROTOCOL);
    log(`Identify: ${pid} protocols=[${protos.join(', ')}] hasChatProto=${hasChatProto}`);
    if (!hasChatProto) {
      log(`WARNING: peer ${pid} does NOT support ${CHAT_PROTOCOL} — messages won't be deliverable`);
    }
  });

  // ── Periodic network stats (for sidebar / Wireshark) ───────────
  function emitNetStats() {
    const connections = node.getConnections();
    const peerDetails = connections.map((conn) => {
      const ra = conn.remoteAddr?.toString() ?? '?';
      const portMatch = ra.match(/\/tcp\/(\d+)/);
      return {
        peerId: conn.remotePeer.toString(),
        peerIdShort: conn.remotePeer.toString().slice(0, 16),
        remoteAddr: ra,
        remotePort: portMatch ? Number(portMatch[1]) : null,
        direction: conn.direction, // 'inbound' or 'outbound'
        streams: conn.streams?.length ?? 0,
      };
    });
    emit({
      type: 'net_stats',
      listenPort: actualPort,
      listenAddrs: node.getMultiaddrs().map(String),
      connections: peerDetails,
      knownChatPeers: [...knownChatPeers],
      peers: allKnownPeers(),
      stats: { ...stats },
      inviteCode,
    });
  }
  setInterval(emitNetStats, 5000);

  // ── Ready ──────────────────────────────────────────────────────
  emit({
    type: 'ready',
    peerId,
    address: localAddr,
    lanAddress: lanAddr,
    port: actualPort,
    isEphemeral,
    inviteCode,
  });

  // ── Stdin commands ─────────────────────────────────────────────
  const rl = createInterface({ input: process.stdin });

  rl.on('line', async (line) => {
    try {
      const cmd = JSON.parse(line);

      switch (cmd.cmd) {
        case 'send': {
          const channelId = cmd.channelId || DEFAULT_CHANNEL;
          const payload = JSON.stringify({ channelId, data: cmd.data });

          if (cmd.targetPeerId) {
            // Point-to-point DM: send only to the specified peer
            log(`send: targeted send to ${cmd.targetPeerId.slice(0, 16)}`);
            try {
              const targetPeer = node.getPeers().find(p => p.toString() === cmd.targetPeerId);
              if (targetPeer) {
                await sendToPeer(node, targetPeer, payload, peerId);
              } else {
                // Not directly connected — use relay HTTP forwarding
                log(`send: target not connected, forwarding via relay`);
                await sendViaRelay(peerId, cmd.targetPeerId, channelId, payload);
              }
            } catch (e) {
              log(`send: targeted send failed: ${e.message}`);
            }
          } else {
            // Broadcast to all known chat peers
            await sendToAllPeers(node, payload, relayPeerId, peerId);
          }
          break;
        }

        case 'dial': {
          const addr = (cmd.address || '').trim();

          // Check if it's an invite code (XXXX-XXXX)
          if (INVITE_CODE_RE.test(addr)) {
            log(`Dial by invite code: ${addr}`);
            try {
              const lookup = await fetchJson(`${RELAY_HTTP_URL}/lookup?code=${encodeURIComponent(addr)}`);
              if (!lookup.circuitAddr) {
                emit({ type: 'dial_result', ok: false, address: addr, error: 'Code not found or expired' });
                break;
              }
              log(`Resolved code ${addr} -> peerId=${lookup.peerId}`);
              // Add to known chat peers immediately (relay circuit connections are short-lived)
              knownChatPeers.add(lookup.peerId);
              log(`Added ${lookup.peerId.slice(0, 16)} to known chat peers via invite code`);
              // Try to establish circuit connection (for identify/discovery)
              try {
                await node.dial(multiaddr(lookup.circuitAddr));
                log(`Circuit connection established for: ${addr}`);
              } catch (dialErr) {
                log(`Circuit dial failed (OK — relay forwarding will be used): ${dialErr.message}`);
              }
              emit({
                type: 'dial_result',
                ok: true,
                address: addr,
                peerId: lookup.peerId,
                peers: [...new Set([...node.getPeers().map(String), lookup.peerId])],
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              log(`Invite code dial failed: ${msg}`);
              emit({ type: 'dial_result', ok: false, address: addr, error: msg });
            }
            break;
          }

          // Regular multiaddr dial
          if (!addr || !addr.startsWith('/')) {
            emit({ type: 'dial_result', ok: false, address: addr, error: 'Invalid address — use an invite code (XXXX-XXXX) or a multiaddr starting with /' });
            break;
          }
          try {
            await node.dial(multiaddr(addr));
            log(`Dialed: ${addr.slice(0, 60)}...`);
            emit({ type: 'dial_result', ok: true, address: addr, peers: node.getPeers().map(String) });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            log(`Dial failed: ${msg}`);
            emit({ type: 'dial_result', ok: false, address: addr, error: msg });
          }
          break;
        }

        case 'status': {
          emit({
            type: 'status',
            peerId,
            address: localAddr,
            lanAddress: lanAddr,
            port: actualPort,
            peers: node.getPeers().map(String),
          });
          break;
        }

        default:
          log(`Unknown command: ${cmd.cmd}`);
      }
    } catch (e) {
      log(`Bad stdin: ${e.message}`);
    }
  });

  rl.on('close', () => { shutdown('stdin-close'); });

} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  emit({ type: 'error', message: `Startup failed: ${msg}` });
  log(`Startup failed: ${msg}`);
  process.exit(1);
}

// ── Shutdown ─────────────────────────────────────────────────────

async function shutdown(signal) {
  log(`Shutting down (${signal})`);
  try { if (node) await node.stop(); } catch { /* best-effort */ }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
