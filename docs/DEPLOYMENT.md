# AntiSurveillanceState — Deployment & Distribution

## Build Targets

| Platform | Output | Notes |
|----------|--------|-------|
| Windows | `.msi`, `.exe` | NSIS installer; portable exe |
| macOS | `.dmg`, `.app` | Universal binary (arm64 + x64) |
| Linux | `.deb`, `.AppImage` | AppImage for distro-agnostic |

## Build Commands

```powershell
# Development
pnpm tauri dev

# Production build (all platforms from current OS)
pnpm tauri build

# Platform-specific
pnpm tauri build --target x86_64-pc-windows-msvc
pnpm tauri build --target aarch64-apple-darwin
pnpm tauri build --target x86_64-unknown-linux-gnu
```

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
