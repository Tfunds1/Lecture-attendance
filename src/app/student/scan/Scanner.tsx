"use client";

// QR scanner. Uses html5-qrcode which wraps the browser's getUserMedia API
// and a JS QR decoder. On a successful decode we extract the `t=` token
// from the URL the QR encodes and POST it to /api/attendance.
//
// Two entry points:
//   1. Live camera scan (the normal path).
//   2. ?t=<token> in the URL — happens when a student opens the QR's link
//      directly (e.g. they scanned with the phone's built-in camera app and
//      tapped through). We auto-submit in that case.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AttendanceResultCard,
  type AttendanceResult,
} from "@/components/AttendanceResult";

function extractToken(decoded: string): string | null {
  // The QR encodes a full URL like https://host/student/scan?t=<jwt>
  try {
    const u = new URL(decoded);
    return u.searchParams.get("t");
  } catch {
    // Fall back to assuming the raw decoded string IS the token (legacy /
    // manual entry).
    return decoded.includes(".") ? decoded : null;
  }
}

export function Scanner() {
  const params = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const submittingRef = useRef(false);

  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [scanning, setScanning] = useState(false);

  async function submitToken(token: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, ...data });
      } else {
        setResult({ ok: false, error: data.error ?? "unknown_error", closedAt: data.acceptingUntil, windowSeconds: data.windowSeconds });
      }
    } catch {
      setResult({ ok: false, error: "network_error" });
    } finally {
      // Allow retry after a short delay so a moving camera doesn't fire
      // the same token a hundred times.
      setTimeout(() => { submittingRef.current = false; }, 1500);
    }
  }

  // URL-launch path: ?t=...
  useEffect(() => {
    const t = params.get("t");
    if (t) submitToken(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Camera scan path.
  async function startCamera() {
    if (scannerRef.current) return;
    setResult(null);

    const { Html5Qrcode } = await import("html5-qrcode");
    const el = containerRef.current;
    if (!el) return;
    el.id = el.id || "qr-reader";

    const scanner = new Html5Qrcode(el.id);
    scannerRef.current = scanner;
    setScanning(true);

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          const token = extractToken(decodedText);
          if (token) {
            await submitToken(token);
            // Stop the camera once we have a valid-looking token so we
            // don't keep firing for the same code.
            try { await scanner.stop(); } catch {}
            scannerRef.current = null;
            setScanning(false);
          }
        },
        () => { /* per-frame "no QR found" — ignore */ }
      );
    } catch (e) {
      setResult({ ok: false, error: "camera_permission" });
      scannerRef.current = null;
      setScanning(false);
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => () => { stopCamera(); }, []);

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-200">
        <div
          ref={containerRef}
          className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        {!scanning && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-slate-400">
            <div>
              <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="8" y="8" width="8" height="8" rx="1" />
              </svg>
              <p className="mt-2 text-sm">Tap “Start camera” to scan the QR.</p>
            </div>
          </div>
        )}
      </div>

      {!scanning ? (
        <button onClick={startCamera} className="btn-primary w-full">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          Start camera
        </button>
      ) : (
        <button onClick={stopCamera} className="btn-ghost w-full">
          Stop camera
        </button>
      )}

      {result && <AttendanceResultCard result={result} />}

      <p className="text-center text-xs text-slate-500">
        Your browser will ask for camera permission. If it doesn&apos;t open,
        allow camera access for this site in your browser settings.
      </p>
    </div>
  );
}
