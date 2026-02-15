/**
 * Embedded relay service - starts relay via Tauri backend and returns address
 */
import { invoke, isTauri } from '@tauri-apps/api/core';

export async function startEmbeddedRelay(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Embedded relay only works in the desktop app. Run "npm run relay" in a terminal, then paste the relay address.');
  }
  return invoke<string>('start_embedded_relay');
}

export async function getRelayLog(): Promise<string> {
  if (!isTauri()) return '';
  try {
    return await invoke<string>('get_relay_log');
  } catch {
    return '';
  }
}
