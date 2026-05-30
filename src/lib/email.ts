// Email delivery via Resend.
//
// Used by the admin create-user flow to email a one-time password-setup link
// to a newly created user. This is best-effort: the caller must still show the
// setup link to the admin as a fallback, and a failure here must never block
// account creation. So every error path returns { ok: false, error } instead
// of throwing.
//
// Requires RESEND_API_KEY in the environment (see .env.example).

import { Resend } from "resend";

// We send from Resend's shared sandbox address, which works without verifying
// a domain — fine for development and the project demo.
//
// PRODUCTION: replace this with an address on a domain you've verified in
// Resend (e.g. "Attendance <no-reply@your-domain.edu>"). Without a verified
// domain, real recipients often land in spam or get rejected outright.
const FROM_ADDRESS = "Lecture Attendance <onboarding@resend.dev>";

export async function sendPasswordSetupEmail(params: {
  to: string;
  name: string;
  setupUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: "Set up your attendance account",
      html: buildHtml(params.name, params.setupUrl),
    });

    // Resend reports send failures via the returned `error` object rather than
    // by throwing, so we have to check it explicitly.
    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    // Network failure, malformed request, etc.
    const message = err instanceof Error ? err.message : "Unknown email error";
    return { ok: false, error: message };
  }
}

// Self-service password reset. Triggered from the public /forgot-password page.
// Reuses the same one-time-token mechanism as account setup — the reset link
// points at the existing /setup-password/<token> page — so a "reset" is really
// just re-setting the password against a fresh, short-lived token.
//
// Like the setup email, this is best-effort and never throws: the caller
// returns a neutral "if an account exists, we've sent a link" response either
// way, so a delivery failure must not change what the user sees.
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: "Reset your attendance account password",
      html: buildResetHtml(params.name, params.resetUrl),
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    return { ok: false, error: message };
  }
}

// Plain, inline-styled HTML. Email clients strip <style> tags and have spotty
// CSS support, so all styling is inline and we avoid images and frameworks.
function buildHtml(name: string, setupUrl: string): string {
  return `<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; max-width: 480px; margin: 0 auto;">
  <p style="font-size: 16px;">Hi ${escapeHtml(name)},</p>
  <p style="font-size: 16px;">An account has been created for you on the Lecture Attendance System.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(setupUrl)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 600;">Set my password</a>
  </p>
  <p style="font-size: 14px; color: #475569;">Or copy and paste this link into your browser:</p>
  <p style="font-size: 13px; word-break: break-all;"><a href="${escapeHtml(setupUrl)}" style="color: #2563eb;">${escapeHtml(setupUrl)}</a></p>
  <p style="font-size: 13px; color: #64748b;">This link expires in 7 days and can only be used once.</p>
  <p style="font-size: 13px; color: #94a3b8; margin-top: 28px;">— Lecture Attendance System</p>
</div>`;
}

function buildResetHtml(name: string, resetUrl: string): string {
  return `<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; max-width: 480px; margin: 0 auto;">
  <p style="font-size: 16px;">Hi ${escapeHtml(name)},</p>
  <p style="font-size: 16px;">We received a request to reset the password for your Lecture Attendance account. Click below to choose a new password.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 600;">Reset my password</a>
  </p>
  <p style="font-size: 14px; color: #475569;">Or copy and paste this link into your browser:</p>
  <p style="font-size: 13px; word-break: break-all;"><a href="${escapeHtml(resetUrl)}" style="color: #2563eb;">${escapeHtml(resetUrl)}</a></p>
  <p style="font-size: 13px; color: #64748b;">This link expires in 1 hour and can only be used once. If you didn't request a reset, you can safely ignore this email.</p>
  <p style="font-size: 13px; color: #94a3b8; margin-top: 28px;">— Lecture Attendance System</p>
</div>`;
}

// Escape values interpolated into the HTML so a name or URL can't break the
// markup or inject attributes.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
