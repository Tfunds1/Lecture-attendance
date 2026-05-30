"use client";

// Confirmation card shown after an admin creates a new user. Renders the
// one-time setup link in a read-only input plus a copy-to-clipboard button.
// The link is generated server-side and passed in via props (the parent page
// reads it from a query param after the createUser server action redirects).
//
// We also try to email the link to the user (best-effort). `emailSent` tells
// us whether that worked, so we can tailor the message — but the link itself
// is ALWAYS shown as a fallback, because email can fail silently (Resend down,
// wrong key, mailbox rejects) or land in spam without a verified domain.

import { useState } from "react";

export function SetupLinkCard({
  name,
  email,
  setupUrl,
  emailSent,
}: {
  name: string;
  email: string;
  setupUrl: string;
  emailSent: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(setupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / insecure contexts — fall back to selecting the input
      // so the admin can press Ctrl+C.
      const el = document.getElementById("setup-link-input") as HTMLInputElement | null;
      el?.select();
    }
  }

  return (
    <div
      className={`card p-4 ${
        emailSent ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            emailSent ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {emailSent ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`font-semibold ${emailSent ? "text-emerald-900" : "text-amber-900"}`}>
            {name} created
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {emailSent ? (
              <>
                A setup link was emailed to <strong className="font-medium text-slate-800">{email}</strong>. You can also share it directly:
              </>
            ) : (
              <>The setup email couldn&apos;t be sent — copy and share this link manually:</>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              id="setup-link-input"
              className="input flex-1 font-mono text-xs"
              value={setupUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn-primary shrink-0" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
