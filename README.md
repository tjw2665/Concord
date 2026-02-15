# Concord

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
Concord/
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
- [Rust](https://rustup.rs/) (for Tauri desktop app)

### Setup

```powershell
# Install dependencies
cd Concord
npm install

# Build protocol package
cd packages/protocol && npm run build && cd ../..
```

### Test the Full Desktop App (not browser)

```powershell
# Terminal 1: Start relay (picks a random port, saves to relay-config.json)
npm run relay

# Terminal 2: Run the Tauri desktop app
npm run tauri:dev
```

The app opens in a **native window**. For firewall and port setup, see [docs/FIREWALL_AND_PORTS.md](docs/FIREWALL_AND_PORTS.md).

### Testing P2P Messaging

**Same machine (2 tabs):**
1. `npm run relay` — copy the Local address
2. Tab 1: paste relay addr → Connect to relay → Copy your address
3. Tab 2: paste relay addr → Connect → paste Tab 1's address → Connect to peer
4. Send messages — they sync

**Remote user (hub mode):**
1. **Hub**: Run `npm run relay` — port is saved in `scripts/relay-config.json`
2. **Hub**: Allow the relay port in Windows Firewall; port-forward it in your router (see [docs/FIREWALL_AND_PORTS.md](docs/FIREWALL_AND_PORTS.md))
3. **Hub**: Edit `src/config.ts` — paste the Local address from relay output
4. **Hub**: Share the Remote address (with your public IP) with the other user
5. **Remote user**: Paste that address → Connect to relay → Share your address with hub
6. **Hub**: Paste remote user's address → Connect to peer

### Run the Full Desktop App (Tauri)

**Development** (native window, hot-reload):

```powershell
# Terminal 1: Relay
npm run relay

# Terminal 2: Desktop app
npm run tauri:dev
```

This opens the app in a **native Tauri window** (not a browser tab).

**Production** (built executable):

```powershell
npm run tauri:build
# Run: src-tauri/target/release/bundle/nsis/Concord_0.1.0_x64-setup.exe
```

To add app icons: `npm run tauri icon path/to/1024x1024.png`

### Build for Production

```powershell
npm run build
```

### Windows Executable (Self-Contained)

Build a downloadable Windows installer that includes the WebView2 runtime (no internet required to run):

```powershell
# On Windows only — requires Rust and Visual Studio Build Tools
npm run tauri:build
```

**Output:** `src-tauri/target/release/bundle/nsis/Concord_0.1.0_x64-setup.exe`

- **Smaller installer**: WebView2 bootstrapper bundled (~1.8MB) — downloads runtime if needed on first run
- **Single executable**: Users download the .exe, run it, and install
- **No Node.js or other dependencies** required on the target machine

To add a custom app icon before building: `npm run tauri icon path/to/1024x1024.png`

### GitHub Actions Build Pipeline

A workflow builds the Windows installer on every push to `main`:

- **Triggers**: Push to `main`, pull requests (build only), or manual run
- **Download**: Go to your repo's **Releases** page — each push to `main` creates a new release with the `.exe` attached
- **Artifacts**: Also available from **Actions** → select run → **Artifacts**
- **Config**: `.github/workflows/build-windows.yml`

### Push to GitHub

1. Create a new repository on [GitHub](https://github.com/new) (e.g. `Concord`)
2. Add the remote and push:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/Concord.git
git push -u origin main
```

Or with SSH:

```powershell
git remote add origin git@github.com:YOUR_USERNAME/Concord.git
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
