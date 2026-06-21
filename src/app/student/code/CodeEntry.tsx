"use client";

// Short-code entry path — parallel to /student/scan.
//
// One large input that:
//   - auto-uppercases as the student types,
//   - silently drops characters outside the safe alphabet
//     (so paste-from-WhatsApp doesn't fail on stray whitespace),
//   - auto-submits when 6 valid characters are present.
//
// A Submit button is also rendered so a student who pasted a partial /
// invalid code can still trigger the request, and so the form is usable
// without JS-driven auto-submit if a browser blocks it.

import { useEffect, useRef, useState } from "react";
import {
  AttendanceResultCard,
  type AttendanceResult,
} from "@/components/AttendanceResult";
import {
  SHORT_CODE_ALPHABET,
  SHORT_CODE_LENGTH,
} from "@/lib/short-code-shared";

const ALPHABET_SET = new Set(SHORT_CODE_ALPHABET);

function sanitize(raw: string): string {
  // Uppercase first, then keep only safe-alphabet chars. Cap at the code
  // length so a student can't accidentally over-paste.
  let out = "";
  for (const ch of raw.toUpperCase()) {
    if (ALPHABET_SET.has(ch)) out += ch;
    if (out.length === SHORT_CODE_LENGTH) break;
  }
  return out;
}

export function CodeEntry() {
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const lastSubmittedRef = useRef<string | null>(null);

  const [value, setValue] = useState("");
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submitCode(code: string) {
    // Guard against double-fires from auto-submit + Enter key.
    if (submittingRef.current) return;
    if (lastSubmittedRef.current === code) return;
    submittingRef.current = true;
    lastSubmittedRef.current = code;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortCode: code }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, ...data });
      } else {
        setResult({ ok: false, error: data.error ?? "unknown_error", closedAt: data.acceptingUntil, windowSeconds: data.windowSeconds });
        // Let the student retype after a failure.
        lastSubmittedRef.current = null;
      }
    } catch {
      setResult({ ok: false, error: "network_error" });
      lastSubmittedRef.current = null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitize(e.target.value);
    setValue(sanitized);
    if (sanitized.length === SHORT_CODE_LENGTH) {
      submitCode(sanitized);
    } else {
      // Anything shorter means the student is editing — clear the last
      // submission guard so they can resubmit the same code if they want.
      lastSubmittedRef.current = null;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.length === SHORT_CODE_LENGTH) submitCode(value);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="short-code" className="label">
          Code
        </label>
        <input
          id="short-code"
          ref={inputRef}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={SHORT_CODE_LENGTH}
          value={value}
          onChange={onChange}
          aria-label="Six-character attendance code"
          className="input font-mono text-3xl sm:text-4xl tracking-[0.4em] text-center uppercase py-3"
          placeholder="••••••"
          disabled={submitting}
        />
        <p className="text-xs text-slate-500 mt-2 text-center">
          {value.length}/{SHORT_CODE_LENGTH} characters
        </p>
      </div>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={value.length !== SHORT_CODE_LENGTH || submitting}
      >
        {submitting ? "Submitting…" : "Mark attendance"}
      </button>

      {result && <AttendanceResultCard result={result} />}
    </form>
  );
}
