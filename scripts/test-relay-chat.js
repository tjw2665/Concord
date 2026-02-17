/**
 * Test: relay HTTP message queue — post a message, poll it back
 * This verifies the /send and /poll endpoints on the relay work end-to-end.
 */
import https from 'https';

const RELAY_HTTP = 'https://concord-relay.fly.dev:8080';

function ts() { return new Date().toISOString().slice(11, 23); }
function log(tag, msg) { console.log(`[${ts()}] [${tag}] ${msg}`); }

function fetchJson(url) {
  return new Promise((r, j) => https.get(url, { timeout: 10000 }, (res) => {
    let b = ''; res.on('data', c => b += c);
    res.on('end', () => { try { r(JSON.parse(b)); } catch { j(new Error(b.slice(0, 200))); } });
  }).on('error', j));
}

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname,
      method: 'POST',
      timeout: 10000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let rb = '';
      res.on('data', c => rb += c);
      res.on('end', () => { try { resolve(JSON.parse(rb)); } catch { reject(new Error(rb.slice(0, 200))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  const aliceId = 'test-alice-' + Date.now();
  const bobId = 'test-bob-' + Date.now();

  log('MAIN', '=== TEST: Relay HTTP Message Queue ===');

  // 1. Health check
  log('MAIN', 'Health check...');
  const health = await fetchJson(`${RELAY_HTTP}/health`);
  log('MAIN', `Relay OK: peers=${health.peers}, codes=${health.codes}`);

  // 2. Alice sends a message to Bob
  log('MAIN', 'Alice -> Bob: sending message...');
  const msgPayload = JSON.stringify({
    channelId: 'general',
    data: JSON.stringify({
      id: 'msg-001',
      channelId: 'general',
      authorId: aliceId,
      content: 'Hello Bob! This is a relay-forwarded message.',
      timestamp: Date.now(),
      signature: 'test-sig',
    }),
  });

  const sendResult = await postJson(`${RELAY_HTTP}/send`, {
    to: bobId,
    from: aliceId,
    channelId: 'general',
    data: msgPayload,
  });
  log('ALICE', `Send result: ${JSON.stringify(sendResult)}`);

  // 3. Alice sends another message
  const msgPayload2 = JSON.stringify({
    channelId: 'general',
    data: JSON.stringify({
      id: 'msg-002',
      channelId: 'general',
      authorId: aliceId,
      content: 'Second message!',
      timestamp: Date.now(),
      signature: 'test-sig-2',
    }),
  });

  await postJson(`${RELAY_HTTP}/send`, {
    to: bobId,
    from: aliceId,
    channelId: 'general',
    data: msgPayload2,
  });
  log('ALICE', 'Sent second message');

  // 4. Bob polls for messages
  log('BOB', 'Polling for messages...');
  const poll1 = await fetchJson(`${RELAY_HTTP}/poll?peerId=${encodeURIComponent(bobId)}&since=0`);
  log('BOB', `Poll result: ${poll1.messages.length} message(s)`);
  for (const msg of poll1.messages) {
    log('BOB', `  from=${msg.from.slice(0, 20)} ch=${msg.channelId} data=${msg.data.slice(0, 80)}...`);
  }

  // 5. Bob polls again (should be empty — messages were dequeued)
  const poll2 = await fetchJson(`${RELAY_HTTP}/poll?peerId=${encodeURIComponent(bobId)}&since=0`);
  log('BOB', `Second poll: ${poll2.messages.length} message(s) (should be 0)`);

  // 6. Bob sends a reply to Alice
  log('BOB', 'Sending reply to Alice...');
  await postJson(`${RELAY_HTTP}/send`, {
    to: aliceId,
    from: bobId,
    channelId: 'general',
    data: JSON.stringify({ channelId: 'general', data: JSON.stringify({ content: 'Got it! Reply from Bob.' }) }),
  });

  // 7. Alice polls
  const poll3 = await fetchJson(`${RELAY_HTTP}/poll?peerId=${encodeURIComponent(aliceId)}&since=0`);
  log('ALICE', `Poll result: ${poll3.messages.length} message(s)`);
  for (const msg of poll3.messages) {
    log('ALICE', `  from=${msg.from.slice(0, 20)} ch=${msg.channelId}`);
  }

  // Summary
  log('MAIN', '\n=== RESULTS ===');
  log('MAIN', `Bob received: ${poll1.messages.length} messages (expected 2)`);
  log('MAIN', `Bob re-poll: ${poll2.messages.length} messages (expected 0)`);
  log('MAIN', `Alice received reply: ${poll3.messages.length} messages (expected 1)`);

  const pass = poll1.messages.length === 2 && poll2.messages.length === 0 && poll3.messages.length === 1;
  log('MAIN', pass ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED!');

  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
