/**
 * Short attendance codes — the manual-entry counterpart to the rotating QR.
 *
 * Why these exist:
 *   In a typical Nigerian lecture hall there is no projector; the QR can
 *   only be seen by the front rows. The lecturer also reads / writes a
 *   short code, which any student in the room can hear or copy.
 *
 * Why this alphabet:
 *   23456789ABCDEFGHJKLMNPQRSTUVWXYZ (32 chars). Removed: 0/O, 1/I/L —
 *   the characters students misread when written on a whiteboard or
 *   announced verbally. 32 is also a power of two, which lets us pick
 *   uniformly using `crypto.randomInt`.
 *
 * Why crypto.randomInt and not Math.random:
 *   Codes are guessable by design (6 chars from 32 = ~10^9). We don't
 *   need them to be cryptographically secret, but predictable sequences
 *   from Math.random across sessions would let an attacker pre-compute
 *   likely values. randomInt removes that class of attack entirely.
 *
 * Collision strategy:
 *   The DB carries a partial unique index on shortCode where active=true,
 *   so two active sessions can never share a code. We pre-check here and
 *   retry up to 10 times to give a nicer error than the raw P2002.
 *   With <1000 concurrent active sessions and a 32^6 (~1.07B) space, the
 *   probability of needing even one retry is negligible.
 */

import type { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { SHORT_CODE_ALPHABET, SHORT_CODE_LENGTH } from "./short-code-shared";

const MAX_RETRIES = 10;

function pickCode(): string {
  let out = "";
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    out += SHORT_CODE_ALPHABET[crypto.randomInt(0, SHORT_CODE_ALPHABET.length)];
  }
  return out;
}

export async function generateShortCode(db: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = pickCode();
    const clash = await db.session.findFirst({
      where: { shortCode: candidate, active: true },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("short_code_generation_exhausted");
}

// Re-exported so server-side callers can keep `from "@/lib/short-code"`.
export { SHORT_CODE_ALPHABET, SHORT_CODE_LENGTH } from "./short-code-shared";
