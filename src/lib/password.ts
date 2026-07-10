/**
 * P0.1 — Secure Password Hashing (FDL 10/2025, CBUAE Notice 3551/2021, PDPL)
 *
 * Replaces the hardcoded demo-password map that previously lived in
 * NextAuth's `authorize()`. All user credentials are now stored exclusively
 * as bcrypt hashes in `User.passwordHash` — no plaintext password is ever
 * persisted or compared in cleartext.
 *
 * Implementation: bcryptjs (pure-JS bcrypt, cost factor 12) — chosen over
 * native bcrypt to avoid native-compilation fragility in containerized
 * environments while retaining full bcrypt cryptographic strength.
 */

import bcrypt from 'bcryptjs';

/** Bcrypt cost factor — 12 provides ~250ms hash time, strong against offline brute force. */
const BCRYPT_COST = 12;

/**
 * Hash a plaintext password using bcrypt.
 * @returns a bcrypt hash string suitable for storage in `User.passwordHash`.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

/**
 * Synchronous variant for seed scripts (seed runs once, blocking is acceptable).
 */
export function hashPasswordSync(plaintext: string): string {
  return bcrypt.hashSync(plaintext, BCRYPT_COST);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 * Constant-time comparison (bcrypt intrinsic) — safe against timing attacks.
 * @returns true if the password matches the hash.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    // Malformed hash — treat as verification failure (never throw on auth).
    return false;
  }
}
