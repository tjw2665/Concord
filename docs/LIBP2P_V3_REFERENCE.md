# js-libp2p v3 API Reference

> Quick reference for the js-libp2p v3 APIs used by Concord's sidecar.
> Compiled from the official docs and empirically verified against our installed
> versions (libp2p 3.1.3, yamux 8.0.1, @libp2p/utils 7.0.10).
>
> Official sources:
> - Migration guide: https://github.com/libp2p/js-libp2p/blob/main/doc/migrations/v2.0.0-v3.0.0.md
> - Getting started: https://github.com/libp2p/js-libp2p/blob/main/doc/GETTING_STARTED.md
> - Configuration:   https://github.com/libp2p/js-libp2p/blob/main/doc/CONFIGURATION.md
> - API typedocs:    https://libp2p.github.io/js-libp2p

---

## Major changes from v2 to v3

### 1. Streams are EventTargets, not streaming iterables

The `source`/`sink` pattern (async iterables) is **gone**. Streams are now
EventTarget objects.

| v2 (old)                         | v3 (current)                     |
|----------------------------------|----------------------------------|
| `stream.source` (AsyncIterable)  | `for await (const buf of stream)` or `stream.addEventListener('message', ...)` |
| `stream.sink(asyncIterable)`     | `stream.send(bytes)` (synchronous, returns boolean) |
| `pipe(source, stream)`           | `stream.send(data)` |
| `await stream.close()`           | `await stream.close()` (unchanged) |

### 2. Protocol handlers take two arguments

**Before (v2):**
```js
node.handle('/my/proto', ({ stream, connection }) => { ... })
```

**After (v3):**
```js
node.handle('/my/proto', (stream, connection) => { ... })
```

`stream` and `connection` are now **separate positional arguments**, not
destructured from an object.

### 3. Protocol handlers can be async

In v2, handlers had to be synchronous (with `Promise.resolve().then(...)` hacks).
In v3, the handler can return a Promise; if it rejects, the stream is aborted.

```js
node.handle('/my/proto', async (stream, connection) => {
  for await (const buf of stream) {
    // process data
  }
})
```

---

## Stream API

### Reading data

Two options:

**Option A: AsyncIterator (for await...of)**
```js
for await (const chunk of stream) {
  // chunk is Uint8Array or Uint8ArrayList
  const bytes = chunk instanceof Uint8Array ? chunk : chunk.subarray();
  console.log(new TextDecoder().decode(bytes));
}
```

**Option B: Event listener**
```js
stream.addEventListener('message', (evt) => {
  console.log(new TextDecoder().decode(evt.data.subarray()));
});
```

> **Warning:** If no `message` handler is added, the stream buffers incoming
> data until `maxReadBufferLength` is reached, then resets the stream.
> If you need async setup before reading, call `stream.pause()` first and
> `stream.resume()` when ready.

### Writing data

```js
const ok = stream.send(new TextEncoder().encode('hello'));
```

- `send()` is **synchronous** and returns a `boolean`.
- Returns `true` if the stream can accept more data immediately.
- Returns `false` if backpressure is engaged. You must then wait:

```js
if (!stream.send(data)) {
  await stream.onDrain({ signal: AbortSignal.timeout(5000) });
}
```

### Closing

```js
await stream.close();            // graceful close (flushes pending writes)
stream.abort(new Error('oops')); // immediate reset (error propagated to remote)
```

The `close` event fires with `{ error?: Error, local: boolean }`.

### Backpressure (read side)

```js
stream.pause();   // stop receiving data (signals remote to stop sending)
stream.resume();  // resume receiving data
```

---

## Creating a node

```js
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { identify } from '@libp2p/identify';
import { mdns } from '@libp2p/mdns';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';

const node = await createLibp2p({
  privateKey,                                          // Ed25519 key
  addresses: { listen: ['/ip4/0.0.0.0/tcp/9000/ws'] },
  transports: [webSockets()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: { denyDialMultiaddr: () => false }, // allow all
  peerDiscovery: [mdns()],
  services: {
    identify: identify(),
    relay: circuitRelayServer({ reservations: { maxReservations: 128 } }),
  },
});
```

Nodes start automatically by default. Use `start: false` to defer.

---

## Dialing and connecting

### Dial a peer (establish connection)
```js
import { multiaddr } from '@multiformats/multiaddr';

const ma = multiaddr('/ip4/127.0.0.1/tcp/9000/ws/p2p/12D3KooW...');
const connection = await node.dial(ma);
```

### Open a protocol stream on existing connection
```js
const stream = await connection.newStream('/my/proto/1.0.0');
stream.send(new TextEncoder().encode('hello'));
await stream.close();
```

### Dial + open stream in one call
```js
const stream = await node.dialProtocol(ma, '/my/proto/1.0.0');
```

> **Note:** `dialProtocol` reuses an existing connection if one exists.
> If no connection exists, it creates one first.

### Get existing connections to a peer
```js
const conns = node.getConnections(peerId);
// conns[0].newStream(protocol) to open a new stream
```

---

## Handling incoming protocol streams

```js
// Register handler — NOTE: two separate args, NOT destructured
await node.handle('/concord/chat/1.0.0', async (stream, connection) => {
  const remotePeer = connection.remotePeer.toString();

  for await (const chunk of stream) {
    const data = chunk instanceof Uint8Array ? chunk : chunk.subarray();
    console.log(`From ${remotePeer}:`, new TextDecoder().decode(data));
  }
});
```

To unregister: `await node.unhandle('/concord/chat/1.0.0')`

---

## Peer events

```js
node.addEventListener('peer:connect', (evt) => {
  console.log('Connected:', evt.detail.toString());
});

node.addEventListener('peer:disconnect', (evt) => {
  console.log('Disconnected:', evt.detail.toString());
});

node.addEventListener('peer:discovery', (evt) => {
  console.log('Discovered:', evt.detail.id.toString());
});

node.addEventListener('peer:identify', (evt) => {
  console.log('Protocols:', evt.detail.protocols);
});
```

---

## Identity / Keys

```js
import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf }
  from '@libp2p/crypto/keys';

// Generate new Ed25519 key
const key = await generateKeyPair('Ed25519');

// Serialize to bytes (for storage)
const bytes = privateKeyToProtobuf(key);
const base64 = Buffer.from(bytes).toString('base64');

// Deserialize from bytes
const restored = privateKeyFromProtobuf(Buffer.from(base64, 'base64'));
```

Pass as `privateKey` to `createLibp2p()` for persistent identity.

---

## Multiaddr

```js
import { multiaddr } from '@multiformats/multiaddr';

const ma = multiaddr('/ip4/127.0.0.1/tcp/9000/ws/p2p/12D3KooW...');
console.log(ma.toString());
```

**Important:** `@multiformats/multiaddr` must be installed as a direct dependency.
It is NOT re-exported by libp2p. `node.dial()` requires a Multiaddr object, not
a plain string.

---

## Useful node methods

| Method                     | Returns            | Description                              |
|----------------------------|--------------------|------------------------------------------|
| `node.peerId`              | `PeerId`           | This node's peer identity                |
| `node.getMultiaddrs()`     | `Multiaddr[]`      | All addresses this node is listening on  |
| `node.getPeers()`          | `PeerId[]`         | All currently connected peers            |
| `node.getConnections(pid?)` | `Connection[]`    | Connections (optionally filtered by peer)|
| `node.getProtocols()`      | `string[]`         | Registered protocol IDs                  |
| `node.dial(ma)`            | `Promise<Conn>`    | Connect to a peer                        |
| `node.dialProtocol(ma, p)` | `Promise<Stream>` | Connect + open protocol stream           |
| `node.handle(proto, fn)`   | `Promise<void>`    | Register incoming protocol handler       |
| `node.unhandle(proto)`     | `Promise<void>`    | Remove protocol handler                  |
| `node.stop()`              | `Promise<void>`    | Shut down the node                       |

---

## Imperative stream helpers (from @libp2p/utils)

For more structured read/write patterns:

### byteStream — read/write raw bytes
```js
import { byteStream } from '@libp2p/utils';

const bytes = byteStream(stream);
await bytes.write(Uint8Array.from([0, 1, 2, 3]));
const output = await bytes.read();
```

### lengthPrefixedStream — varint-prefixed messages
```js
import { lengthPrefixedStream } from '@libp2p/utils';

const lp = lengthPrefixedStream(stream);
await lp.write(myData);
const msg = await lp.read();
```

### protobufStream — protobuf messages
```js
import { protobufStream } from '@libp2p/utils';

const pb = protobufStream(stream);
await pb.write({ hello: 'world' }, MessageCodec);
const msg = await pb.read(MessageCodec);
```

---

## Stream middleware

Intercept incoming streams before they reach protocol handlers (express-style):

```js
node.use('/my/protocol', async (stream, connection, next) => {
  // validate, log, transform, etc.
  next(stream, connection);
});
```

---

## Concord-specific patterns

### Sending a message to a peer
```js
const stream = await node.dialProtocol(peerId, '/concord/chat/1.0.0');
stream.send(fromString(JSON.stringify({ channelId, data }) + '\n'));
await stream.close();
```

### Receiving messages
```js
node.handle('/concord/chat/1.0.0', async (stream, connection) => {
  const remotePeer = connection.remotePeer.toString();
  for await (const chunk of stream) {
    const text = toString(chunk instanceof Uint8Array ? chunk : chunk.subarray());
    // parse newline-delimited JSON from text
  }
});
```

### Broadcasting to all peers
```js
const peers = node.getPeers();
await Promise.allSettled(
  peers.map(p => sendToPeer(node, p, payload))
);
```

---

## Debugging

Set the `DEBUG` environment variable:

```bash
# All libp2p logs
DEBUG="libp2p:*" node script.js

# Specific subsystems
DEBUG="libp2p:websockets:*,libp2p:connection-manager:*" node script.js

# With trace-level detail
DEBUG="libp2p:*,*:trace" node script.js
```

For multiple nodes in one process, use `prefixLogger`:
```js
import { prefixLogger } from '@libp2p/logger';

const node = await createLibp2p({
  logger: prefixLogger('node-a'),
  // ...
});
```

---

## Common gotchas

1. **`stream.sink is not a function`** — You're using the v2 API. Use
   `stream.send(data)` instead.
2. **`stream.source` is undefined** — You're using the v2 API. Iterate the
   stream directly: `for await (const chunk of stream)`.
3. **Handler `stream` is undefined** — You're destructuring v2-style
   `({ stream, connection })`. Use two args: `(stream, connection)`.
4. **`Cannot find package '@multiformats/multiaddr'`** — Install it as a
   direct dependency: `npm install @multiformats/multiaddr`.
5. **`Cannot write to a stream that is closed`** — The handler on the
   remote side crashed (likely due to gotcha #3), causing a stream reset.
6. **Stream resets immediately after `dialProtocol`** — Same as #5. The
   remote handler threw an error, so the stream was aborted.
