/**
 * libp2p Circuit Relay Server
 * Uses a persistent port from relay-config.json (picks random unused port on first run).
 * Run: npm run relay
 *
 * Embedded mode (from app): Set RELAY_ADDRESS_FILE env to write address for app to read.
 * Set RELAY_PORT env for fixed port when embedded (optional — omit for dynamic port).
 */
import { createServer } from 'net';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { webSockets } from '@libp2p/websockets';
import { createLibp2p } from 'libp2p';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'relay-config.json');
const ADDRESS_FILE = process.env.RELAY_ADDRESS_FILE;
const FIXED_PORT = process.env.RELAY_PORT ? parseInt(process.env.RELAY_PORT, 10) : null;

/**
 * Find an available port. Binds to 0.0.0.0 to match the relay's listen address.
 */
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

/**
 * Check if a port is available by attempting to bind to 0.0.0.0 (same as relay).
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.listen(port, '0.0.0.0', () => {
      tester.close(() => resolve(true));
    });
    tester.on('error', () => resolve(false));
  });
}

/**
 * Load saved port from config, or pick a fresh one.
 */
async function loadOrCreatePort() {
  if (FIXED_PORT && FIXED_PORT > 0) return FIXED_PORT;

  // Try saved port first
  try {
    const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    if (typeof data.port === 'number' && data.port > 0) {
      if (await isPortAvailable(data.port)) {
        return data.port;
      }
      console.error(`Saved port ${data.port} is in use, picking a new one`);
    }
  } catch {
    // Config missing or invalid — pick fresh
  }

  const port = await getAvailablePort();
  writeFileSync(CONFIG_PATH, JSON.stringify({ port }, null, 2));
  return port;
}

/**
 * Start the relay on a given port. Returns the libp2p node on success.
 */
async function startRelay(port) {
  return createLibp2p({
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${port}/ws`],
    },
    transports: [webSockets()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      relay: circuitRelayServer({
        reservations: {
          maxReservations: 128,
        },
      }),
    },
  });
}

let server;

try {
  let port = await loadOrCreatePort();

  // Attempt to start — if EADDRINUSE, delete config and retry with a fresh port
  try {
    server = await startRelay(port);
  } catch (err) {
    const isAddrInUse =
      err?.message?.includes('EADDRINUSE') ||
      err?.code === 'ERR_NO_VALID_ADDRESSES' ||
      err?.constructor?.name === 'UnsupportedListenAddressesError';

    if (isAddrInUse) {
      console.error(`Port ${port} failed (EADDRINUSE), retrying with a fresh port...`);
      // Delete stale config so we don't keep trying the same broken port
      try { unlinkSync(CONFIG_PATH); } catch { /* ok */ }
      port = await getAvailablePort();
      writeFileSync(CONFIG_PATH, JSON.stringify({ port }, null, 2));
      server = await startRelay(port);
    } else {
      throw err;
    }
  }

  const peerId = server.peerId.toString();
  const localAddr = `/ip4/127.0.0.1/tcp/${port}/ws/p2p/${peerId}`;
  const remoteAddr = `/ip4/YOUR_PUBLIC_IP/tcp/${port}/ws/p2p/${peerId}`;

  if (ADDRESS_FILE) {
    writeFileSync(
      ADDRESS_FILE,
      JSON.stringify({ localAddr, remoteAddr, peerId, port }, null, 2)
    );
  }

  console.log('Concord Relay');
  console.log('Port:', port, '(saved in scripts/relay-config.json)');
  console.log('\nLocal (same machine):');
  console.log('  ', localAddr);
  console.log('\nRemote (replace YOUR_PUBLIC_IP with your public IP):');
  console.log('  ', remoteAddr);
  console.log('\nFirewall: Allow inbound TCP port', port);
  console.log('Router: Forward port', port, 'to this machine');
} catch (err) {
  console.error('Relay startup failed:', err);
  process.exit(1);
}

// ── Graceful shutdown ────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down relay...`);
  try {
    if (server) await server.stop();
  } catch {
    // best-effort
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
