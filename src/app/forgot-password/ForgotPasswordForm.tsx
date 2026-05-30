"use client";

// Client form for the public password-reset request. Calls the server action
// passed in from the parent page. To avoid leaking which emails are
// registered, the action always succeeds — so on success we show the same
// neutral "if an account exists, we've sent a link" message regardless of
// whether the email actually matched a user.

import { useState, useTransition } from "react";
import Link from "next/link";

export function ForgotPasswordForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: true } | { error: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if ("error" in result) setError(result.error);
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="w-full max-w-md p-8 space-y-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Check your inbox</h1>
        <p className="text-sm text-slate-500">
          If an account exists for that email, we&apos;ve sent a link to reset
          your password. The link expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-slate-900 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Forgot password?
        </h1>
        <p className="text-sm text-slate-400">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-600 mb-1.5"
        >
          Your Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          autoComplete="email"
          required
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send reset link"}
      </button>

      <p className="text-center text-sm text-slate-400">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-slate-900 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
