"use client";

// Client form for picking a new password against a setup token. The token is
// validated server-side (in the parent page) before this form is rendered,
// and again inside the server action on submit. We do the matching-password
// check on the client purely for UX — the real validation is server-side.

import { useState, useTransition } from "react";

export function SetupPasswordForm({
  action,
  userName,
}: {
  action: (formData: FormData) => Promise<{ error: string } | void>;
  userName: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Set your password</h1>
        <p className="text-sm text-slate-500">Welcome, {userName}. Choose a password to activate your account.</p>
      </div>

      <div>
        <label className="label" htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
      </div>

      <div>
        <label className="label" htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          className="input"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Setting password..." : "Set password"}
      </button>
    </form>
  );
}
