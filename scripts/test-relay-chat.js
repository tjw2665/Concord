/**
 * Test harness: two libp2p nodes, both connecting to the public relay,
 * exchanging messages through the relay circuit.
 *
 * Usage:  node scripts/test-relay-chat.js
 */
import https from 'https';
import { createServer } from 'net';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { webSockets } from '@libp2p/websockets';
import { createLibp2p } from 'libp2p';
import { toString, fromString } from 'uint8arrays';
import { generateKeyPair } from '@libp2p/crypto/keys';
import { multiaddr } from '@multiformats/multiaddr';

const RELAY_HTTP = 'https://concord-relay.fly.dev:8080';
const RELAY_WS   = '/dns4/concord-relay.fly.dev/tcp/443/wss';
const CHAT_PROTO = '/concord/chat/1.0.0';

// ── Helpers ──────────────────────────────────────────────────────

function ts() { return new Date().toISOString().slice(11, 23); }

function log(tag, msg) { console.log(`[${ts()}] [${tag}] ${msg}`); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Bad JSON: ${body.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '0.0.0.0', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

// ── Create a node ────────────────────────────────────────────────

async function makeNode(tag, port, relayPeerId) {
  const key = await generateKeyPair('Ed25519');

  const listenAddrs = [`/ip4/0.0.0.0/tcp/${port}/ws`];
  if (relayPeerId) {
    listenAddrs.push(`${RELAY_WS}/p2p/${relayPeerId}/p2p-circuit`);
  }

  log(tag, `Creating node on port ${port}, relay circuit=${!!relayPeerId}`);

  const node = await createLibp2p({
    privateKey: key,
    addresses: { listen: listenAddrs },
    transports: [
      webSockets(),
      circuitRelayTransport({ discoverRelays: 1 }),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: { denyDialMultiaddr: () => false },
    services: { identify: identify() },
  });

  const pid = node.peerId.toString();
  log(tag, `PeerId: ${pid}`);

  // Log multiaddrs
  const addrs = node.getMultiaddrs().map(String);
  const hasCircuit = addrs.some(a => a.includes('p2p-circuit'));
  log(tag, `Multiaddrs (${addrs.length}): hasCircuit=${hasCircuit}`);
  for (const a of addrs) log(tag, `  ${a}`);

  // Events
  node.addEventListener('peer:connect', (e) => log(tag, `peer:connect ${e.detail}`));
  node.addEventListener('peer:disconnect', (e) => log(tag, `peer:disconnect ${e.detail}`));
  node.addEventListener('peer:identify', (e) => {
    const d = e.detail;
    log(tag, `peer:identify ${d.peerId?.toString()?.slice(0,16)} protocols=[${(d.protocols ?? []).join(', ')}]`);
  });

  return { node, peerId: pid, peerIdObj: node.peerId };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  // 1. Get relay info
  log('MAIN', 'Fetching relay info...');
  const info = await fetchJson(`${RELAY_HTTP}/info`);
  const relayPeerId = info.relayPeerId;
  log('MAIN', `Relay PeerId: ${relayPeerId}`);

  // 2. Create two nodes
  const portA = await freePort();
  const portB = await freePort();

  const alice = await makeNode('ALICE', portA, relayPeerId);
  const bob   = await makeNode('BOB',   portB, relayPeerId);

  // 3. Wait for relay reservations to establish
  log('MAIN', 'Waiting 5s for relay reservations...');
  await new Promise(r => setTimeout(r, 5000));

  // Log multiaddrs again after reservation
  const aliceAddrs = alice.node.getMultiaddrs().map(String);
  const bobAddrs = bob.node.getMultiaddrs().map(String);
  log('ALICE', `Post-reservation multiaddrs (${aliceAddrs.length}):`);
  for (const a of aliceAddrs) log('ALICE', `  ${a}`);
  log('BOB', `Post-reservation multiaddrs (${bobAddrs.length}):`);
  for (const a of bobAddrs) log('BOB', `  ${a}`);

  // 4. Register invite codes
  log('MAIN', 'Registering invite codes...');
  const regA = await fetchJson(`${RELAY_HTTP}/register?peerId=${alice.peerId}`);
  const regB = await fetchJson(`${RELAY_HTTP}/register?peerId=${bob.peerId}`);
  log('ALICE', `Invite code: ${regA.code}`);
  log('BOB',   `Invite code: ${regB.code}`);

  // 5. Register chat protocol handlers
  let aliceReceived = [];
  let bobReceived = [];

  alice.node.handle(CHAT_PROTO, (stream, connection) => {
    log('ALICE', `RECV handler fired! from=${connection.remotePeer.toString().slice(0,16)}`);
    (async () => {
      let buf = '';
      try {
        for await (const chunk of stream) {
          const raw = chunk instanceof Uint8Array ? chunk : chunk.subarray();
          const text = toString(raw);
          log('ALICE', `RECV chunk: ${raw.length} bytes: ${text.slice(0, 100)}`);
          buf += text;
        }
        log('ALICE', `RECV stream closed. Full buffer: ${buf.slice(0, 200)}`);
        aliceReceived.push(buf.trim());
      } catch (e) {
        log('ALICE', `RECV error: ${e.message}`);
      }
    })();
  }, { runOnLimitedConnection: true });

  bob.node.handle(CHAT_PROTO, (stream, connection) => {
    log('BOB', `RECV handler fired! from=${connection.remotePeer.toString().slice(0,16)}`);
    (async () => {
      let buf = '';
      try {
        for await (const chunk of stream) {
          const raw = chunk instanceof Uint8Array ? chunk : chunk.subarray();
          const text = toString(raw);
          log('BOB', `RECV chunk: ${raw.length} bytes: ${text.slice(0, 100)}`);
          buf += text;
        }
        log('BOB', `RECV stream closed. Full buffer: ${buf.slice(0, 200)}`);
        bobReceived.push(buf.trim());
      } catch (e) {
        log('BOB', `RECV error: ${e.message}`);
      }
    })();
  }, { runOnLimitedConnection: true });

  // 6. Alice dials Bob via invite code circuit address
  log('MAIN', '--- DIAL: Alice -> Bob via relay circuit ---');
  const lookupB = await fetchJson(`${RELAY_HTTP}/lookup?code=${regB.code}`);
  log('MAIN', `Lookup Bob's code: circuitAddr=${lookupB.circuitAddr}`);
  try {
    await alice.node.dial(multiaddr(lookupB.circuitAddr));
    log('MAIN', 'Alice dialed Bob OK!');
  } catch (e) {
    log('MAIN', `Alice dial FAILED: ${e.message}`);
  }

  // Check connections
  const alicePeers = alice.node.getPeers().map(String);
  const bobPeers = bob.node.getPeers().map(String);
  log('ALICE', `Connected peers: ${alicePeers.length} — ${alicePeers.map(p => p.slice(0,16)).join(', ')}`);
  log('BOB',   `Connected peers: ${bobPeers.length} — ${bobPeers.map(p => p.slice(0,16)).join(', ')}`);

  // Check if they see each other
  const aliceSeesBob = alicePeers.includes(bob.peerId);
  const bobSeesAlice = bobPeers.includes(alice.peerId);
  log('MAIN', `Alice sees Bob: ${aliceSeesBob}, Bob sees Alice: ${bobSeesAlice}`);

  if (!aliceSeesBob) {
    log('MAIN', 'FATAL: Alice does not see Bob as a peer. Aborting message test.');
    await cleanup(alice, bob);
    return;
  }

  // Wait a moment for both sides of the connection to be fully established
  log('MAIN', 'Waiting 3s for connection to fully establish...');
  await new Promise(r => setTimeout(r, 3000));

  // Re-check connections after waiting
  const alicePeers2 = alice.node.getPeers().map(String);
  const bobPeers2 = bob.node.getPeers().map(String);
  log('ALICE', `Peers after wait: ${alicePeers2.length} — ${alicePeers2.map(p => p.slice(0,16)).join(', ')}`);
  log('BOB',   `Peers after wait: ${bobPeers2.length} — ${bobPeers2.map(p => p.slice(0,16)).join(', ')}`);

  // 7. Alice sends a message to Bob
  log('MAIN', '--- SEND: Alice -> Bob ---');
  const payload = JSON.stringify({ channelId: 'test', data: 'Hello from Alice!' }) + '\n';
  try {
    // Use PeerId object, NOT string
    log('ALICE', `Opening dialProtocol to ${bob.peerId.slice(0,16)} (using PeerId object), runOnLimitedConnection=true`);
    const stream = await alice.node.dialProtocol(bob.peerIdObj, CHAT_PROTO, {
      runOnLimitedConnection: true,
    });
    log('ALICE', `Stream opened! type=${typeof stream}, has send=${typeof stream.send}, has sink=${typeof stream.sink}`);

    // Try stream.send() first (v3 API)
    if (typeof stream.send === 'function') {
      log('ALICE', 'Using stream.send() API');
      const bytes = fromString(payload);
      stream.send(bytes);
      await stream.close();
      log('ALICE', `Sent ${bytes.length} bytes via stream.send() + close()`);
    } else if (stream.sink) {
      log('ALICE', 'FALLBACK: stream.send() not available, using pipe/sink');
      const bytes = fromString(payload);
      // Use the iterable sink pattern
      await stream.sink([bytes]);
      log('ALICE', `Sent ${bytes.length} bytes via stream.sink()`);
    } else {
      log('ALICE', 'FATAL: stream has neither send() nor sink!');
    }
  } catch (e) {
    log('ALICE', `SEND FAILED: ${e.message}`);
    log('ALICE', `Error type: ${e.constructor?.name}, code: ${e.code}`);
  }

  // Wait for delivery
  log('MAIN', 'Waiting 5s for message delivery...');
  await new Promise(r => setTimeout(r, 5000));

  // 8. Check results
  log('MAIN', `=== RESULTS ===`);
  log('MAIN', `Bob received ${bobReceived.length} message(s): ${JSON.stringify(bobReceived)}`);
  log('MAIN', `Alice received ${aliceReceived.length} message(s): ${JSON.stringify(aliceReceived)}`);

  if (bobReceived.length > 0) {
    log('MAIN', 'SUCCESS: Message delivered through relay!');
  } else {
    log('MAIN', 'FAILURE: No messages received by Bob.');
  }

  // 9. Bob sends back to Alice
  log('MAIN', '--- SEND: Bob -> Alice ---');
  try {
    const payload2 = JSON.stringify({ channelId: 'test', data: 'Hello from Bob!' }) + '\n';
    const stream2 = await bob.node.dialProtocol(alice.peerIdObj, CHAT_PROTO, {
      runOnLimitedConnection: true,
    });
    log('BOB', `Stream opened! has send=${typeof stream2.send}`);
    if (typeof stream2.send === 'function') {
      stream2.send(fromString(payload2));
      await stream2.close();
      log('BOB', 'Sent reply via stream.send()');
    }
  } catch (e) {
    log('BOB', `SEND FAILED: ${e.message}`);
  }

  log('MAIN', 'Waiting 5s for reply delivery...');
  await new Promise(r => setTimeout(r, 5000));

  log('MAIN', `=== FINAL RESULTS ===`);
  log('MAIN', `Bob received: ${JSON.stringify(bobReceived)}`);
  log('MAIN', `Alice received: ${JSON.stringify(aliceReceived)}`);

  await cleanup(alice, bob);
}

async function cleanup(alice, bob) {
  log('MAIN', 'Cleaning up...');
  try { await alice.node.stop(); } catch {}
  try { await bob.node.stop(); } catch {}
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
