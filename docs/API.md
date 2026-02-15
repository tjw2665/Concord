# AntiSurveillanceState — API & Service Contracts

## 1. Service Interfaces

### 1.1 IdentityService

Manages cryptographic identity and signing.

```typescript
interface IdentityService {
  /** Generate or load existing keypair */
  init(): Promise<void>;
  
  /** Get public key (hex or base58) */
  getPublicKey(): string;
  
  /** Sign arbitrary data */
  sign(data: Uint8Array): Promise<string>;
  
  /** Verify signature from another identity */
  verify(publicKey: string, data: Uint8Array, signature: string): boolean;
  
  /** Optional: Link to on-chain identity */
  anchorIdentity(): Promise<string>;
}
```

### 1.2 ChannelService

Manages channels (servers, DMs, voice).

```typescript
interface ChannelService {
  /** Create new channel */
  create(params: CreateChannelParams): Promise<Channel>;
  
  /** Join channel by ID or invite link */
  join(channelIdOrInvite: string): Promise<Channel>;
  
  /** Leave channel */
  leave(channelId: string): Promise<void>;
  
  /** List channels user belongs to */
  list(): Promise<Channel[]>;
  
  /** Get channel details */
  get(channelId: string): Promise<Channel | null>;
  
  /** Subscribe to channel updates */
  subscribe(channelId: string, callback: (channel: Channel) => void): () => void;
}

interface CreateChannelParams {
  name: string;
  type: 'text' | 'voice' | 'dm';
  members?: string[];  // For DMs
}
```

### 1.3 MessageService

Sends, receives, and syncs messages.

```typescript
interface MessageService {
  /** Send message to channel */
  send(channelId: string, content: string, options?: SendOptions): Promise<Message>;
  
  /** Subscribe to messages in channel */
  subscribe(channelId: string, callback: (message: Message) => void): () => void;
  
  /** Load message history (paginated) */
  getHistory(channelId: string, options?: HistoryOptions): Promise<Message[]>;
  
  /** Delete message (soft delete, author only) */
  delete(channelId: string, messageId: string): Promise<void>;
  
  /** React to message */
  react(channelId: string, messageId: string, emoji: string): Promise<void>;
}

interface SendOptions {
  replyTo?: string;
  attachments?: string[];  // IPFS CIDs
}
```

### 1.4 SyncService

Orchestrates P2P sync and blockchain anchoring.

```typescript
interface SyncService {
  /** Start sync for channel */
  startSync(channelId: string): Promise<void>;
  
  /** Stop sync */
  stopSync(channelId: string): Promise<void>;
  
  /** Trigger manual anchor to blockchain */
  anchorChannel(channelId: string): Promise<string>;
  
  /** Get sync status */
  getStatus(): SyncStatus;
}

interface SyncStatus {
  connectedPeers: number;
  pendingMessages: number;
  lastAnchorTx?: string;
}
```

### 1.5 DiscoveryService

Peer discovery and DHT operations.

```typescript
interface DiscoveryService {
  /** Find peers for channel */
  findPeers(channelId: string): Promise<PeerInfo[]>;
  
  /** Advertise presence in channel */
  advertise(channelId: string): void;
  
  /** Bootstrap connection to network */
  bootstrap(): Promise<void>;
}
```

---

## 2. Data Models

### 2.1 Message

```typescript
interface Message {
  id: string;              // Content hash (CID)
  channelId: string;
  authorId: string;        // Public key
  content: string;
  timestamp: number;      // Unix ms
  signature: string;
  replyTo?: string;
  attachments?: string[];
  reactions?: Record<string, string[]>;  // emoji -> authorIds
  deleted?: boolean;
}
```

### 2.2 Channel

```typescript
interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'dm';
  createdBy: string;
  createdAt: number;
  configHash: string;
  members: string[];
  lastMessageAt?: number;
}
```

### 2.3 Blockchain Anchor Payload

```typescript
interface AnchorPayload {
  channelId: string;
  merkleRoot: string;
  messageCount: number;
  timestamp: number;
  signer: string;
}
```

---

## 3. Event Streams

### 3.1 Message Events

```
message:new      → New message received
message:updated  → Reaction or edit
message:deleted  → Soft delete
```

### 3.2 Channel Events

```
channel:joined   → User joined channel
channel:left     → User left channel
channel:updated  → Name, config changed
```

### 3.3 Sync Events

```
sync:connected   → Peer connected
sync:disconnected → Peer disconnected
sync:anchored    → Channel state anchored to chain
```

---

## 4. Tauri Commands (Rust ↔ Frontend)

```rust
// src-tauri/src/commands.rs

#[tauri::command]
async fn identity_init() -> Result<(), String>;

#[tauri::command]
async fn identity_get_public_key() -> Result<String, String>;

#[tauri::command]
async fn channel_create(name: String, channel_type: String) -> Result<Channel, String>;

#[tauri::command]
async fn channel_join(channel_id: String) -> Result<Channel, String>;

#[tauri::command]
async fn message_send(channel_id: String, content: String) -> Result<Message, String>;

#[tauri::command]
async fn sync_start(channel_id: String) -> Result<(), String>;

#[tauri::command]
async fn sync_anchor(channel_id: String) -> Result<String, String>;
```

---

## 5. GossipSub Topics

| Topic Pattern | Purpose |
|---------------|---------|
| `ass/channel/{channelId}` | Message broadcast for channel |
| `ass/discovery/{channelId}` | Peer discovery for channel |
| `ass/anchor/{channelId}` | Anchor notifications |

---

*Document version: 1.0*
