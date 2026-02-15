# Migrating to libp2p@3.0

> Source: https://github.com/libp2p/js-libp2p/blob/main/doc/migrations/v2.0.0-v3.0.0.md
> Retrieved: 2026-02-15

A migration guide for refactoring your application code from libp2p `v2.0.0` to `v3.0.0`.

## Table of Contents

- [Streams are now EventTargets](#streams-are-now-eventtargets)
  - [Stream closing](#stream-closing)
  - [Write backpressure](#write-backpressure)
  - [Imperative streams](#imperative-streams)
  - [byteStream](#bytestream)
  - [lengthPrefixedStream](#lengthprefixedstream)
  - [protobufStream](#protobufstream)
- [Protocol handlers now accept a stream and a connection](#protocol-handlers-now-accept-a-stream-and-a-connection)
- [Protocol handlers can now be async](#protocol-handlers-can-now-be-async)
- [Stream middleware](#stream-middleware)
- [Lightweight Multiaddrs](#lightweight-multiaddrs)
- [Deprecated code has been removed](#deprecated-code-has-been-removed)

## Streams are now EventTargets

When the JavaScript implementation of libp2p first came into being it used
Node.js streams. Next came pull-streams. Then came Streaming Iterables using
AsyncIterators and `for await...of`.

In the intervening years, Streaming Iterables have not really been adopted
outside of libp2p, and that unfamiliarity raises the barrier to entry for new
developers.

Streaming Iterables lean heavily on promises to function, and encourage a
programming model that means async transforms cause downstream transforms to
also become async which can add a surprising amount of latency if the transform
is trivial.

The EventTarget API now exists as part of the language which has standardized
the pattern used by the Node.js EventEmitter. Events dispatched by EventTargets
are synchronous which makes them very high performance since continuations are
not performed in the microtask queue.

This does mean that the streaming API has changed. Where before we had `source`
and `sink` properties, we now listen for `message` events and call `.send` with
`Uint8Array`/`Uint8ArrayList` values.

We can detect when write backpressure needs to be applied by `.send` returning
`false`, and read backpressure can be explicitly applied by calling `.pause`
and `.resume` methods.

> **CAUTION:** If no `message` event handler is added, streams will buffer
> incoming data until a pre-configured limit is reached, after which the stream
> will be reset. If you need to perform a long-running async task in your stream
> handler before consuming stream data you should `.pause` the stream first and
> `.resume` it when you are ready.

**Before (v2)**

```ts
const stream = await node.dialProtocol(remotePeer, '/echo/1.0.0')

stream.sink([
  new TextEncoder().encode('hello world')
])

for await (const buf of stream.source) {
  console.info(new TextDecoder().decode(buf))
}
```

**After (v3)**

```ts
const stream = await node.dialProtocol(remotePeer, '/echo/1.0.0')

stream.addEventListener('message', event => {
  console.info(new TextDecoder().decode(event.data))
})

stream.send(new TextEncoder().encode('hello world'))
```

> **TIP:** Streams are still `AsyncIterable` so you can still use
> `for await...of` to iterate over their contents:

```ts
const stream = await node.dialProtocol(remotePeer, '/echo/1.0.0')

stream.send(new TextEncoder().encode('hello world'))

for await (const buf of stream) {
  console.info(new TextDecoder().decode(buf))
}
```

### Stream closing

When streams close they emit a `close` event with an `error: Error` property
(for unclean exit) and a `local: boolean` property (whether local abort or
remote reset).

### Write backpressure

When `.send()` returns false, wait for drain:

```ts
const bufs = [ /* a lot of data */ ]

for (const buf of bufs) {
  if (!stream.send(buf)) {
    await stream.onDrain({ signal: AbortSignal.timeout(5_000) })
  }
}
```

### Imperative streams

The `@libp2p/utils` module exports helpers for imperative stream programming:

#### byteStream

```ts
import { byteStream } from '@libp2p/utils'

const bytes = byteStream(stream)
await bytes.write(Uint8Array.from([0, 1, 2, 3]))
const output = await bytes.read()
```

#### lengthPrefixedStream

```ts
import { lengthPrefixedStream } from '@libp2p/utils'

const lp = lengthPrefixedStream(stream)
await lp.write(Uint8Array.from([0, 1, 2, 3]))
const output = await lp.read()
```

#### protobufStream

```ts
import { protobufStream } from '@libp2p/utils'
import { Message } from './hello-world.js'

const pb = protobufStream(stream)
await pb.write({ hello: 'world' }, Message)
const output = await pb.read(Message)
```

## Protocol handlers now accept a stream and a connection

Prior to v3 protocol handlers accepted an object with `stream` and `connection`
properties. These have been split into two arguments.

**Before (v2)**

```ts
node.handle('/my/protocol', ({ stream, connection }) => {
  // read/write stream data here
})
```

**After (v3)**

```ts
node.handle('/my/protocol', async (stream, connection) => {
  // read/write stream data here
})
```

## Protocol handlers can now be async

Prior to v3 protocol handlers had to be synchronous. A common pattern was to
use `Promise.resolve().then(...)`. From v3 they can return promises. If the
returned promise rejects the stream will be aborted.

**Before (v2)**

```ts
node.handle('/my/protocol', ({ stream, connection }) => {
  Promise.resolve().then(async () => {
    for await (const buf of stream) {
      //... process stream data
    }
  })
  .catch(err => {
    stream.abort(err)
  })
})
```

**After (v3)**

```ts
node.handle('/my/protocol', async (stream, connection) => {
  for await (const buf of stream) {
    //... process stream data
  }
})
```

## Stream middleware

Intercept incoming streams outside of protocol handlers (express-style):

```ts
node.use('/my/protocol', async (stream, connection, next) => {
  // perform middleware actions here
  next(stream, connection)
})
```

## Lightweight Multiaddrs

`@multiformats/multiaddr@13.x.x` has had a large amount of code/functionality
removed. If you have a dependency on `@multiformats/multiaddr`, please upgrade
it to `13.x.x` for use with `libp2p@3.x.x`.

## Deprecated code has been removed

All fields/methods/classes marked as `@deprecated` in `libp2p@2.x.x` have been
removed.
