/**
 * Threat-matrix permalinks. Encode (asset, stride) into a URL-safe
 * base64 string so a view can be shared. No deprecated btoa/unescape.
 */

import { ASSETS, STRIDE } from './matrix';

const b64uEncode = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const b64uDecode = (input: string): Uint8Array | null => {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
};

const KNOWN_ASSETS = new Set<string>(ASSETS.map((a) => a.id));
const KNOWN_STRIDES = new Set<string>(STRIDE.map((s) => s.id));

export type PermaPayload = { a: string; s: string };

export function encodePermalink(asset: string, stride: string): string {
  const payload: PermaPayload = { a: asset, s: stride };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return b64uEncode(bytes);
}

export function decodePermalink(encoded: string): PermaPayload | null {
  const bytes = b64uDecode(encoded);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.a !== 'string' || typeof obj.s !== 'string') return null;
  if (!KNOWN_ASSETS.has(obj.a) || !KNOWN_STRIDES.has(obj.s)) return null;
  return { a: obj.a, s: obj.s };
}