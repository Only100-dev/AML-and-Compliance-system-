/**
 * P0.2 — TOTP-Based Multi-Factor Authentication (FDL 10/2025, CBUAE Notice 3551/2021)
 *
 * Enforcement policy (per Section 10.1):
 *   - MANDATORY for: admin (L100), mlro (L90), board (L30/governance)
 *     These roles hold system-control / filing / oversight authority and
 *     cannot operate without a second factor.
 *   - OPTIONAL / enrollable for: compliance_manager, compliance_officer,
 *     auditor, dept_head. These users may enroll in MFA for extra security
 *     but are not blocked from login if unenrolled.
 *
 * A user is MFA-gated at login when:
 *   `isMFARequired(user)` returns true — i.e. their role is mandatory OR
 *   they have voluntarily enabled MFA (`mfaEnabled === true`).
 *
 * Implementation: otplib v12 `authenticator` (RFC 6238 TOTP, 30s step,
 * 6 digits). Secrets are base32, stored in `User.mfaSecret`.
 *
 * Dev convenience: `generateCurrentOTP(secret)` produces a valid token for
 * the seeded mandatory-MFA users so UAT testers can log in without a
 * hardware token. The `/api/auth/mfa/dev-otp` endpoint (dev-only, env-gated)
 * exposes this. The verification itself is cryptographically real — a wrong
 * OTP is always rejected.
 */

import { generateSecret, generateSync, verifySync, generateURI } from 'otplib';
import type { User } from '@prisma/client';

/** TOTP configuration constants (RFC 6238, 6 digits, 30s step, SHA-1). */
const TOTP_CONFIG = { algorithm: 'SHA1' as const, digits: 6, period: 30 };

/** Roles for which MFA is mandatory (cannot log in without a verified TOTP). */
export const MFA_MANDATORY_ROLES = ['admin', 'mlro', 'board'] as const;

/** Issuer label shown in authenticator apps (Google Authenticator, Authy, etc.). */
export const MFA_ISSUER = 'IC-OS';

/**
 * Determine whether a given user must complete MFA at login.
 * MFA is required if the user's role is in the mandatory set OR the user
 * has explicitly enabled MFA on their own account.
 */
export function isMFARequired(user: Pick<User, 'role' | 'mfaEnabled'>): boolean {
  if (user.mfaEnabled) return true;
  return (MFA_MANDATORY_ROLES as readonly string[]).includes(user.role);
}

/**
 * Generate a new random base32 TOTP secret (for MFA enrollment).
 */
export function generateMFASecret(): string {
  return generateSecret();
}

/**
 * Generate the current valid 6-digit TOTP for a given secret.
 * Used by the dev-only OTP helper; in production a user's authenticator app
 * computes this locally.
 */
export function generateCurrentOTP(secret: string): string {
  return generateSync({ secret, ...TOTP_CONFIG });
}

/**
 * Verify a user-supplied TOTP token against a secret.
 * otplib's default window is 1 (accepts the previous, current, and next
 * 30-second tokens) to tolerate clock drift between client and server.
 * @returns true if the token is valid within the window.
 */
export function verifyTOTP(token: string, secret: string | null | undefined): boolean {
  if (!secret) return false;
  try {
    const result = verifySync({ token: token.replace(/\s+/g, ''), secret, ...TOTP_CONFIG });
    return typeof result === 'object' ? result.valid === true : result === true;
  } catch {
    return false;
  }
}

/**
 * Build an `otpauth://` URI for QR-code enrollment in authenticator apps.
 */
export function buildOTPAuthURI(email: string, secret: string): string {
  return generateURI({ secret, accountName: email, issuer: MFA_ISSUER, ...TOTP_CONFIG });
}
