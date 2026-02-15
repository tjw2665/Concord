# Concord — Deployment & Distribution

## Build Targets

| Platform | Output | Notes |
|----------|--------|-------|
| Windows | `*-setup.exe` | NSIS installer, **self-contained** (WebView2 bundled) |
| macOS | `.dmg`, `.app` | Universal binary (arm64 + x64) |
| Linux | `.deb`, `.AppImage` | AppImage for distro-agnostic |

## Windows Self-Contained Build

The Windows build is configured for **offline distribution**:

- **WebView2**: Bundled via `embedBootstrapper` (~1.8MB) — downloads runtime if needed on first run
- **Output**: `src-tauri/target/release/bundle/nsis/Concord_0.1.0_x64-setup.exe`
- **Single file**: Users download the .exe, run it, install — no Node.js or other deps

```powershell
npm run tauri:build
```

## Build Commands

```powershell
# Development
npm run tauri:dev

# Production build (Windows NSIS, self-contained)
npm run tauri:build

# Platform-specific
npm run tauri:build -- --target x86_64-pc-windows-msvc
npm run tauri:build -- --target aarch64-apple-darwin
npm run tauri:build -- --target x86_64-unknown-linux-gnu
```

## CI/CD (GitHub Actions)

The build pipeline (`.github/workflows/build-windows.yml`) runs on:
- Push to `main`
- Pull requests to `main`
- Manual trigger (`workflow_dispatch`)

Artifacts are uploaded to each run. Download from **Actions** → select run → **Artifacts**.

## Distribution

### Option 1: Direct Download
- Host installers on GitHub Releases
- Optional: checksums (SHA256) for verification

### Option 2: Package Managers
- **Windows**: winget, Chocolatey, Scoop
- **macOS**: Homebrew cask
- **Linux**: Flathub, Snap (if desired)

### Option 3: App Stores
- Microsoft Store (Windows)
- Mac App Store (requires Apple Developer)
- Not recommended for censorship-resistant app (store policies)

## Bootstrap Nodes (Optional)

For initial peer discovery, run optional bootstrap nodes:

```
/ip4/0.0.0.0/tcp/4001
/ip4/0.0.0.0/udp/4001/quic-v1
```

- Can be community-run or project-hosted
- No message data passes through; only DHT/bootstrap
- Users can add custom bootstrap peers in settings

## Blockchain Configuration

| Network | Use Case | RPC |
|---------|----------|-----|
| Base | Production (low gas) | https://mainnet.base.org |
| Polygon | Alternative | https://polygon-rpc.com |
| Base Sepolia | Testing | https://sepolia.base.org |

Users can configure custom RPC in settings for privacy (e.g., own node).

## Auto-Updates

Tauri supports updater with:
- GitHub Releases as update server
- Code signing (required on macOS)
- Delta updates (smaller downloads)

```toml
# src-tauri/tauri.conf.json
"updater": {
  "endpoints": ["https://github.com/.../releases/latest/download/latest.json"],
  "pubkey": "..."
}
```

## Security Checklist

- [ ] Code sign Windows (SignTool) and macOS (notarization)
- [ ] Verify Tauri capability permissions (minimal)
- [ ] No hardcoded API keys or bootstrap peers
- [ ] CSP headers for webview
- [ ] Audit dependencies (cargo audit, pnpm audit)
