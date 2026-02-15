/**
 * Known peers persistence service.
 * Stores successfully-connected peer multiaddresses in localStorage
 * so the app can auto-reconnect on next startup.
 */

const STORAGE_KEY = 'concord-known-peers';
const MAX_PEERS = 50;

export interface PeerEntry {
  address: string;
  lastSeen: number;
}

export function getKnownPeers(): PeerEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is PeerEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as PeerEntry).address === 'string' &&
        typeof (e as PeerEntry).lastSeen === 'number'
    );
  } catch {
    return [];
  }
}

export function addKnownPeer(address: string): void {
  const trimmed = address.trim();
  if (!trimmed) return;
  const peers = getKnownPeers();

  // Update existing or append
  const idx = peers.findIndex((p) => p.address === trimmed);
  if (idx >= 0) {
    peers[idx].lastSeen = Date.now();
  } else {
    peers.push({ address: trimmed, lastSeen: Date.now() });
  }

  // Sort by most-recently-seen, cap at MAX_PEERS
  peers.sort((a, b) => b.lastSeen - a.lastSeen);
  const capped = peers.slice(0, MAX_PEERS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
}

export function removeKnownPeer(address: string): void {
  const peers = getKnownPeers().filter((p) => p.address !== address.trim());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(peers));
}

export function clearKnownPeers(): void {
  localStorage.removeItem(STORAGE_KEY);
}
