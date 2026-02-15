# AntiSurveillanceState

A **highly decentralized** instant messaging application inspired by Discord, Ventrilo, and AIM. Messages sync via blockchain-anchored DAG structures—no central servers required.

## Features

- **Fully decentralized** — P2P networking via libp2p; no central message server
- **Blockchain-anchored** — Message state anchored to Ethereum L2 for trust and persistence
- **Offline-first** — Local CRDT store; sync when peers connect
- **Modern desktop UI** — Tauri 2 + React; sleek, fast, ~3–10 MB bundle
- **Censorship-resistant** — Content-addressed storage; no single point of takedown

## Architecture

```
┌─────────────┐     libp2p      ┌─────────────┐     libp2p     ┌─────────────┐
│  Client A   │◄───────────────►│  Client B   │◄──────────────►│  Client C   │
│ (Tauri UI)  │   GossipSub     │ (Tauri UI)  │   GossipSub    │ (Tauri UI)  │
└──────┬──────┘                 └──────┬──────┘                 └──────┬──────┘
       │                               │                               │
       └───────────────────────────────┼───────────────────────────────┘
                                       │
                                       ▼
                    OrbitDB (IPFS) • CRDT message logs
                                       │
                                       ▼
                    Ethereum L2 • Channel roots, identity anchors
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri 2 |
| Frontend | React 19 + Vite + Tailwind CSS |
| P2P | libp2p (GossipSub, DHT) |
| Message sync | OrbitDB + IPFS |
| Blockchain | Ethereum L2 (Base, Polygon) |

## Project Structure

```
AntiSurveillanceState/
├── src-tauri/          # Rust backend (identity, sync, P2P)
├── src/                # React frontend
├── packages/
│   └── protocol/       # Shared types and schemas
├── docs/
│   ├── ARCHITECTURE.md
│   └── API.md
└── README.md
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (optional, for Tauri desktop build)

### Setup

```powershell
# Install dependencies
cd AntiSurveillanceState
npm install

# Build protocol package
cd packages/protocol && npm run build && cd ../..

# Run relay (Terminal 1)
npm run relay

# Run dev server (Terminal 2)
npm run dev
```

### Testing P2P Messaging

1. **Start relay**: `npm run relay` — copy the multiaddr (e.g. `/ip4/127.0.0.1/tcp/52072/ws/p2p/...`)
2. **Open first tab**: `http://localhost:5173` — paste relay addr, click "Connect Relay"
3. **Copy your address**: After connecting, copy the address shown (for others to dial you)
4. **Open second tab**: Same URL — connect to relay, then paste Tab 1's address, click "Dial Peer"
5. **Send messages**: Both tabs are on #general — messages sync via GossipSub

### Tauri Desktop

```powershell
npm run tauri:dev
```

To add app icons: `npm run tauri icon path/to/1024x1024.png`

### Build for Production

```powershell
npm run build
npm run tauri build   # if using Tauri
```

### Push to GitHub

1. Create a new repository on [GitHub](https://github.com/new) (e.g. `AntiSurveillanceState`)
2. Add the remote and push:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/AntiSurveillanceState.git
git push -u origin main
```

Or with SSH:

```powershell
git remote add origin git@github.com:YOUR_USERNAME/AntiSurveillanceState.git
git push -u origin main
```

## Implementation Phases

1. **Phase 1** — Tauri + React scaffold, identity, single-channel OrbitDB, GossipSub
2. **Phase 2** — Multi-channel, DMs, message history, full UI
3. **Phase 3** — L2 anchoring, E2E encryption, voice channels
4. **Phase 4** — Performance, mobile, documentation

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, decentralization model, blockchain integration
- [API](docs/API.md) — Service contracts, data models, Tauri commands

## License

MIT
