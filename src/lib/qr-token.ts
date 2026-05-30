/**
 * Rotating QR token — the anti-spoofing core.
 *
 * The lecturer's screen displays a QR code that re-renders every 8 seconds.
 * Each render encodes a fresh signed JWT that expires after 12 seconds.
 *
 * Token payload:
 *   { sid: <sessionId>, nonce: <random> }
 *
 * Signed with HS256 using a per-session secret stored on Session.secret.
 * Why a *per-session* secret rather than a global one?
 *   - A token leaked from session A cannot be replayed against session B,
 *     even if both are active simultaneously.
 *   - When the lecturer closes the session, the secret stays in the DB
 *     but `active=false` blocks new attendance — no separate revocation
 *     bookkeeping needed.
 *
 * Defense against the obvious attack (a student photographs the QR and
 * forwards it to an absent friend):
 *   1. By the time the friend opens WhatsApp and points their camera,
 *      the 12-second TTL has almost certainly expired.
 *   2. Even if it hasn't, the friend's student account can only mark
 *      attendance once per session (DB unique constraint).
 *   3. The attendance row stores ipAddress — if many marks come from one
 *      IP, the lecturer / admin can see it post hoc.
 */

import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";

const ROTATION_MS = Number(process.env.QR_TOKEN_ROTATION_MS ?? 8000);
const TTL_MS      = Number(process.env.QR_TOKEN_TTL_MS ?? 12000);

export const QR_ROTATION_MS = ROTATION_MS;
export const QR_TTL_MS = TTL_MS;

export function generateSessionSecret(): string {
  // 32 bytes = 256 bits, base64url-encoded. Per-session, never leaves server.
  return crypto.randomBytes(32).toString("base64url");
}

function keyFromSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signQrToken(sessionId: string, sessionSecret: string): Promise<string> {
  const nonce = crypto.randomBytes(8).toString("base64url");
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({ sid: sessionId, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + Math.ceil(TTL_MS / 1000))
    .sign(keyFromSecret(sessionSecret));
}

export type VerifiedQrToken = {
  sid: string;
  nonce: string;
  iat: number;
  exp: number;
};

export async function verifyQrToken(
  token: string,
  sessionSecret: string
): Promise<VerifiedQrToken> {
  // jwtVerify throws on bad signature / expired token — let it bubble up so
  // the route handler can return a clear 401.
  const { payload } = await jwtVerify(token, keyFromSecret(sessionSecret), {
    algorithms: ["HS256"],
  });
  return payload as VerifiedQrToken;
}
