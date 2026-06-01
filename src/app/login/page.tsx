"use client";

// Sign-in page. Submits credentials via the Auth.js `signIn` helper from
// `next-auth/react`. On success the middleware bounces us to the role home.
//
// Visual language (shared across the app): white card on the slate-50 canvas,
// hairline borders, slate-900 brand mark, indigo primary action, muted type.

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Only accept internal paths. Rejects the literal string "undefined",
// absolute URLs, and protocol-relative URLs (//evil.com).
function safeNext(raw: string | null): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw === "/login"
  ) {
    return "/";
  }
  return raw;
}

// useSearchParams() forces this subtree to be client-rendered, so Next.js
// requires it to sit under a Suspense boundary (otherwise the whole /login
// route can't be prerendered and `next build` fails). The default export
// supplies that boundary; the form itself lives in LoginForm below.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Suspense fallback={<div className="w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const activated = params.get("activated") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      email,
      password,
      // Read back in authorize() to pick the session lifetime (see auth.ts).
      rememberMe: rememberMe ? "1" : "0",
      redirect: false,
    });
    if (res?.error) {
      setSubmitting(false);
      // Auth.js v5 surfaces our custom NotActivatedError via res.code so we
      // can tell the user to use their setup link instead of just saying
      // "wrong password".
      if (res.code === "NotActivated") {
        setError(
          "This account hasn't been activated yet. Please use the setup link from your admin.",
        );
      } else {
        setError("Invalid email or password.");
      }
      return;
    }
    // Hard navigation so the new session cookie is sent with the next request
    // and middleware can redirect to the correct role home.
    window.location.assign(next);
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand */}
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3M20 20v.01M17 20v.01M20 17v.01" />
          </svg>
        </span>
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-slate-900">Attendance</h1>
        <p className="text-[13px] text-slate-500">Lecture attendance system</p>
      </div>

      {/* Card */}
      <div className="card p-6 sm:p-7">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">Sign in</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Enter your credentials to continue.</p>
        </div>

        {activated && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Account activated. You can now sign in.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@university.edu"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex select-none items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      {/* Demo accounts — kept for the project review, styled as a quiet helper. */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
        <span className="font-medium text-slate-600">Demo accounts</span> · password{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">password123</code>
        <div className="mt-1 font-mono text-[11px] text-slate-400">
          admin@uni.edu · adebayo@uni.edu · csc.2021.001@uni.edu
        </div>
      </div>
    </div>
  );
}

// Inline icons (no icon library dependency). 20x20, currentColor.
function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
