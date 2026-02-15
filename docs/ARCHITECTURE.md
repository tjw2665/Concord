# Concord — Decentralized IM Architecture

A highly decentralized instant messaging platform inspired by Discord, Ventrilo, and AIM. Messages sync via blockchain-anchored DAG structures; no central servers required.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CONCORD                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────┐     libp2p      ┌──────────────┐     libp2p     ┌──────────┐ │
│   │   Client A   │◄───────────────►│   Client B   │◄──────────────►│ Client C │ │
│   │  (Tauri UI)  │   GossipSub     │  (Tauri UI)  │   GossipSub    │(Tauri UI)│ │
│   └──────┬───────┘                 └──────┬───────┘                 └────┬─────┘ │
│          │                                │                               │       │
│          │ OrbitDB / IPFS                 │ OrbitDB / IPFS                │       │
│          │ CRDT Log                       │ CRDT Log                      │       │
│          ▼                                ▼                               ▼       │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                    DAG Message Store (per-channel)                        │  │
│   │         Merkle DAG • Content-addressed • Conflict-free merge              │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│          │                                │                               │       │
│          └────────────────────────────────┼───────────────────────────────┘       │
│                                           │                                       │
│                                           ▼                                       │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │              Blockchain Anchor (periodic / on-demand)                     │  │
│   │   Channel roots • Identity proofs • Moderation events • Optional L2      │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No central server** | All peers are equal; discovery via DHT and bootstrap nodes |
| **Offline-first** | Local CRDT store; sync when peers connect |
| **Censorship resistance** | Content-addressed storage; no single point of takedown |
| **Privacy by default** | E2E encryption; optional identity linking |
| **Blockchain as sync layer** | DAG for messages; chain for anchors and trust |

---

## 2. Decentralization Model

### 2.1 Peer Topology

- **Discovery**: libp2p DHT + mDNS (LAN) + optional bootstrap peers
- **Transport**: WebRTC, WebSockets, QUIC (where supported)
- **Messaging**: GossipSub for pub/sub; direct streams for large payloads

### 2.2 Data Flow

1. **User sends message** → Signed locally → Appended to local OrbitDB log
2. **CRDT merge** → Conflict-free merge with other peers' logs
3. **GossipSub broadcast** → Message hash + metadata to channel subscribers
4. **Pull on receive** → Peers fetch full message via IPFS/content hash
5. **Optional anchor** → Merkle root of channel state written to chain (periodic)

### 2.3 Trust Model

- **Identity**: Wallet-based (EVM) or keypair; no email/phone required
- **Channels**: Created by any peer; discovery via DHT or invite links
- **Moderation**: On-chain or DAG-based reputation; client-side filtering

---

## 3. Blockchain Integration for Message Sync

### 3.1 Why Not Store Every Message On-Chain?

Storing every message on a mainnet blockchain is:
- **Expensive** (gas per message)
- **Slow** (block time)
- **Public** (poor privacy)

### 3.2 Hybrid Architecture (Recommended)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Message layer** | OrbitDB Log (IPFS) | Real-time message sync; CRDT merge |
| **Content layer** | IPFS / libp2p | Content-addressed storage; deduplication |
| **Anchor layer** | Ethereum L2 / Polygon / Base | Channel roots, identity, moderation |
| **Optional** | Gun.js | Alternative to OrbitDB; graph-based sync |

### 3.3 Message Sync Flow

```
Message → Sign with identity key
        → Append to OrbitDB feed (channel ID)
        → IPFS pin (optional, for persistence)
        → GossipSub broadcast to channel topic
        → Peers receive, validate, merge into local CRDT
        → [Periodic] Merkle root of last N messages → L2 tx
```

### 3.4 Blockchain Use Cases

| Use Case | Frequency | Chain | Data |
|----------|-----------|-------|------|
| Identity registration | Once per user | L2 | Public key, optional ENS |
| Channel creation | Per channel | L2 | Channel ID, creator, config hash |
| Moderation event | On action | L2 | Action type, target, proof |
| State anchor | Configurable (e.g. hourly) | L2 | Merkle root of channel log |

### 3.5 Recommended Stack

- **OrbitDB** — Append-only logs for messages; IPFS-backed; CRDT merge
- **IPFS + libp2p** — Content addressing; P2P transport
- **Ethereum L2 (Base, Arbitrum, Polygon)** — Low-cost anchoring
- **Gun.js** — Alternative if graph model preferred over logs

---

## 4. Service Layer & API Contracts

### 4.1 Core Services (In-Process)

| Service | Responsibility | Interface |
|---------|----------------|-----------|
| **IdentityService** | Keypair management, signing, verification | `sign(data)`, `verify(sig, data)` |
| **ChannelService** | Create, join, leave channels; list members | `create()`, `join(id)`, `leave(id)` |
| **MessageService** | Send, receive, sync messages | `send(channelId, content)`, `subscribe(channelId)` |
| **SyncService** | OrbitDB/IPFS sync; GossipSub; anchor | `sync()`, `anchor(channelId)` |
| **DiscoveryService** | Peer discovery; DHT; bootstrap | `findPeers(topic)`, `advertise(channelId)` |

### 4.2 Message Schema (Core)

```typescript
interface Message {
  id: string;           // CID or content hash
  channelId: string;
  authorId: string;     // Public key or DID
  content: string;     // Plaintext or E2E encrypted
  timestamp: number;
  signature: string;
  replyTo?: string;    // Parent message ID
  attachments?: string[]; // IPFS CIDs
}
```

### 4.3 Channel Schema

```typescript
interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'dm';
  createdBy: string;
  createdAt: number;
  configHash: string;  // For blockchain anchor
  members: string[];  // Public keys
}
```

---

## 5. Desktop UI Stack

### 5.1 Recommended: Tauri 2 + React + Tailwind

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Shell** | Tauri 2 | Native WebView, ~3–10 MB bundle, Rust backend |
| **UI Framework** | React 19 | Mature, large ecosystem, good for complex UIs |
| **Styling** | Tailwind CSS | Rapid, consistent, scalable design |
| **State** | Zustand / TanStack Query | Lightweight; good for sync state |
| **Build** | Vite | Fast HMR, tree-shaking |

### 5.2 Alternative Stacks

- **Tauri + Svelte** — Smaller bundle, reactive by default
- **Tauri + Solid.js** — Fine-grained reactivity, Discord-like performance
- **Tauri + Vue 3** — Simpler mental model, good DX

### 5.3 UI Structure (Discord-like)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Concord          [Identity] [Settings]    │
├──────────┬──────────────────────────────────────────────────────┤
│          │  # general                              [Members]      │
│ Servers  │  ─────────────────────────────────────────────────   │
│ (DMs)    │  Alice: Hey everyone!                                 │
│          │  Bob: Hi Alice                                        │
│ • Home   │  Charlie: Welcome!                                    │
│ • DM     │  ─────────────────────────────────────────────────   │
│ • Server1│  [Message input...]              [Send] [Attach]      │
│ • Server2│                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

### 5.4 Key UI Features

- **Server/channel sidebar** — Collapsible; drag-and-drop
- **Message list** — Virtualized (TanStack Virtual) for long histories
- **Voice channels** — WebRTC P2P; optional SFU for large groups
- **Theme** — Dark/light; CSS variables for theming
- **Responsive** — Scales from compact to full-width

---

## 6. Project Structure

```
Concord/
├── src-tauri/                 # Tauri (Rust) backend
│   ├── src/
│   │   ├── lib.rs
│   │   ├── identity.rs
│   │   ├── sync.rs            # OrbitDB, IPFS bindings
│   │   ├── p2p.rs             # libp2p
│   │   └── commands.rs        # Tauri commands
│   └── Cargo.toml
├── src/                       # Frontend (React/Vite)
│   ├── components/
│   │   ├── Sidebar/
│   │   ├── ChannelView/
│   │   ├── MessageList/
│   │   └── MessageInput/
│   ├── services/
│   │   ├── identity.ts
│   │   ├── channels.ts
│   │   └── messages.ts
│   ├── stores/
│   ├── hooks/
│   └── main.tsx
├── packages/                  # Shared (optional monorepo)
│   └── protocol/             # Message schemas, types
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DEPLOYMENT.md
├── package.json
├── vite.config.ts
└── README.md
```

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Sybil** | Identity anchored on-chain; optional stake |
| **Spam** | Rate limits; client-side filters; reputation |
| **E2E** | Signal protocol or X3DH for DMs; per-channel keys |
| **Metadata** | Minimize; avoid central logging |
| **Key management** | OS keychain; optional hardware wallet |

---

## 8. Implementation Phases

### Phase 1: Foundation (4–6 weeks)
- Tauri + React scaffold
- Identity (keypair) generation
- Basic OrbitDB log for single channel
- libp2p GossipSub for message broadcast

### Phase 2: Core Features (4–6 weeks)
- Multi-channel support
- DM channels
- Message history sync
- Basic UI (sidebar, channel view, input)

### Phase 3: Blockchain & Polish (4–6 weeks)
- L2 anchor integration
- Channel creation on-chain
- E2E encryption for DMs
- Voice channels (WebRTC)

### Phase 4: Scale & Hardening
- Performance tuning
- Mobile companion (React Native / Tauri mobile)
- Documentation and community

---

## 9. Technology Summary

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri 2 |
| Frontend | React 19 + Vite + Tailwind |
| P2P networking | libp2p (Rust/JS) |
| Message sync | OrbitDB + IPFS |
| Blockchain | Ethereum L2 (Base/Polygon) |
| Voice | WebRTC (P2P or SFU) |
| E2E | Signal/X3DH (future) |

---

*Document version: 1.0 — Concord Architecture*
