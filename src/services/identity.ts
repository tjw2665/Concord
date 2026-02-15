/**
 * Identity service — keypair generation and signing
 * Uses Ed25519 for compact signatures
 */
import * as ed from '@noble/ed25519';
import { fromString, toString } from 'uint8arrays';

const STORAGE_KEY = 'concord-identity';

let cachedKeypair: { publicKey: string; privateKey: string } | null = null;

export async function initIdentity(): Promise<{ publicKey: string; shortId: string }> {
  if (typeof window === 'undefined') {
    throw new Error('Identity must be initialized in browser');
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const { publicKey, privateKey } = JSON.parse(stored);
      cachedKeypair = { publicKey, privateKey };
      return { publicKey, shortId: publicKey.slice(0, 16) + '...' };
    } catch {
      cachedKeypair = null;
    }
  }

  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const publicKeyHex = toString(publicKey, 'base16');
  const privateKeyHex = toString(privateKey, 'base16');

  cachedKeypair = { publicKey: publicKeyHex, privateKey: privateKeyHex };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedKeypair));

  return { publicKey: publicKeyHex, shortId: publicKeyHex.slice(0, 16) + '...' };
}

export function getPublicKey(): string {
  if (!cachedKeypair) throw new Error('Identity not initialized');
  return cachedKeypair.publicKey;
}

export async function sign(data: string): Promise<string> {
  if (!cachedKeypair) throw new Error('Identity not initialized');
  const privateKey = fromString(cachedKeypair.privateKey, 'base16');
  const signature = await ed.signAsync(fromString(data), privateKey);
  return toString(signature, 'base64');
}

export async function verify(publicKey: string, data: string, signature: string): Promise<boolean> {
  try {
    const pub = fromString(publicKey, 'base16');
    const sig = fromString(signature, 'base64');
    await ed.verifyAsync(sig, fromString(data), pub);
    return true;
  } catch {
    return false;
  }
}
