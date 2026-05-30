"use client";

// Sign-in page. Submits credentials via the Auth.js `signIn` helper from
// `next-auth/react`. On success the middleware bounces us to the role home.

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
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense fallback={<div className="w-full max-w-md p-8" />}>
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
    <form onSubmit={onSubmit} className="w-full max-w-md p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Welcome Back!
        </h1>
        <p className="text-sm text-slate-400">Sign in to your account</p>
      </div>

      {activated && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Account activated. You can now sign in.
        </div>
      )}

      <div>
        <label
          className="block text-sm font-medium text-slate-600 mb-1.5"
          htmlFor="email"
        >
          Your Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium text-slate-600 mb-1.5"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-brand-500"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember Me
        </label>
        <Link
          href="/forgot-password"
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Forgot Password?
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Login"}
      </button>

      <p className="text-xs text-slate-400 text-center pt-2">
        Demo accounts (password: <code>password123</code>):
        <br />
        admin@uni.edu · adebayo@uni.edu · csc.2021.001@uni.edu
      </p>
    </form>
  );
}

// Inline icons (no icon library dependency). 20x20, currentColor.
function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
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
      width="20"
      height="20"
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
