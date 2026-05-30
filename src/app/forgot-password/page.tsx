// Public route: a user who forgot their password requests a reset link here.
//
// A "reset" reuses the account-setup machinery end to end: we mint a fresh
// one-time PasswordSetupToken and email a link to the existing
// /setup-password/<token> page, where the user picks a new password (the same
// page admins' setup links point at). No separate reset page or token type.
//
// Security:
//   - Neutral response. We return the same "check your inbox" result whether
//     or not the email matches an account, so this page can't be used to
//     enumerate which emails are registered.
//   - Short-lived token (1 hour) — much shorter than the 7-day setup link,
//     since a reset is requested and used immediately.
//
// Middleware allows this path through without auth (see middleware.ts).

import { headers } from "next/headers";
import { randomBytes } from "crypto";

import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  async function requestReset(
    formData: FormData,
  ): Promise<{ ok: true } | { error: string }> {
    "use server";

    const raw = formData.get("email");
    if (typeof raw !== "string" || !raw.includes("@")) {
      return { error: "Please enter a valid email address." };
    }
    const email = raw.trim();

    const user = await db.user.findUnique({ where: { email } });

    // Only do real work when the account exists — but always fall through to
    // the same { ok: true } below so the response is identical either way.
    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // userId is unique on PasswordSetupToken, so each user has at most one
      // live token. Replace any existing setup/reset token and clear usedAt
      // so the freshly-issued link is the only one that works.
      await db.passwordSetupToken.upsert({
        where: { userId: user.id },
        create: { userId: user.id, token, expiresAt },
        update: { token, expiresAt, usedAt: null },
      });

      // Absolute URL from the current request's host (works on localhost, LAN,
      // or a deployed domain) — same approach as the admin create-user flow.
      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") ? "http" : "https");
      const resetUrl = `${proto}://${host}/setup-password/${token}`;

      const result = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
      if (result.ok) {
        console.log(`[email] sent password reset email to ${user.email}`);
      } else {
        console.error(
          `[email] failed to send reset to ${user.email}: ${result.error}`,
        );
      }
    }

    return { ok: true };
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <ForgotPasswordForm action={requestReset} />
    </main>
  );
}
