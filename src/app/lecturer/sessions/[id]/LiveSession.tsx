"use client";

// The live lecturer view.
//
// Two side-by-side panels:
//   Left  — the rotating QR. Fetches /api/sessions/:id/token every
//           QR_ROTATION_MS ms; encodes the resulting JWT as a QR PNG via
//           the `qrcode` library.
//   Right — live attendance list. Polls /api/sessions/:id/attendees every
//           3 seconds and re-renders.
//
// "End session" hits a server action that flips the session inactive.
// "Export CSV" downloads the per-student list as a .csv.

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { endSessionAction } from "./actions";

type Attendee = {
  id: string;
  name: string;
  matricNumber: string | null;
  markedAt: string;
};

type TokenResp = { token: string; rotateInMs: number; ttlMs: number };

const POLL_MS = 3000;

export function LiveSession({
  sessionId,
  initiallyActive,
  courseCode,
  shortCode,
}: {
  sessionId: string;
  initiallyActive: boolean;
  courseCode: string;
  shortCode: string | null;
}) {
  const [active, setActive] = useState(initiallyActive);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [ending, setEnding] = useState(false);

  // --- Rotating QR loop ---------------------------------------------------
  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/token`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as TokenResp;

      // Encode the absolute URL that the student's scanner will open. We use
      // the current origin so phones on the same Wi-Fi reach the right host.
      const url = `${window.location.origin}/student/scan?t=${encodeURIComponent(data.token)}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 360, margin: 1 });
      setQrDataUrl(dataUrl);

      return data.rotateInMs;
    } catch {
      // Network blip — try again on next tick.
      return undefined;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const rotate = await refreshToken();
      if (cancelled) return;
      timer = setTimeout(tick, rotate ?? 8000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, refreshToken]);

  // --- Attendance polling -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/attendees`, {
          cache: "no-store",
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAttendees(data.attendees);
          if (typeof data.sessionActive === "boolean")
            setActive(data.sessionActive);
        }
      } catch {
        /* swallow */
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  // --- End session --------------------------------------------------------
  async function onEndSession() {
    if (
      !confirm(
        "End this session? Students will no longer be able to mark attendance.",
      )
    )
      return;
    setEnding(true);
    await endSessionAction(sessionId);
    setEnding(false);
    setActive(false);
  }

  // --- CSV export ---------------------------------------------------------
  function exportCsv() {
    const header = "Name,Matric Number,Marked At\n";
    const rows = attendees
      .map(
        (a) =>
          `"${a.name}","${a.matricNumber ?? ""}","${new Date(a.markedAt).toISOString()}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseCode}-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* QR panel */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900">
            Live QR
            <span className={`badge ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {active && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              {active ? "Active" : "Ended"}
            </span>
          </h2>
          {active && (
            <button onClick={onEndSession} className="btn-danger text-sm" disabled={ending}>
              {ending ? "Ending…" : "End session"}
            </button>
          )}
        </header>

        <div className="flex flex-col items-center p-6">
          {active ? (
            qrDataUrl ? (
              <div className="w-full max-w-[320px] rounded-xl bg-white p-3 ring-1 ring-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Attendance QR code" className="w-full rounded-lg" />
              </div>
            ) : (
              <div className="aspect-square w-full max-w-[320px] animate-pulse rounded-xl bg-slate-100" />
            )
          ) : (
            <div className="flex aspect-square w-full max-w-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-8 text-center text-sm text-slate-400">
              This session has ended. Students can no longer mark attendance.
            </div>
          )}

          {/*
            Short code — the no-projector fallback. Sized so the back row of a
            ~50-seat hall can still read it; the lecturer can also call it out
            aloud. Split 3-3 because a 6-char code reads more naturally as two
            halves than as three pairs ("seven-kilo-two ... papa-nine-mike").
          */}
          {active && shortCode && (
            <div className="mt-6 flex flex-col items-center">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Or enter code</div>
              <div className="mt-2 select-all font-mono text-6xl font-semibold tracking-widest text-slate-900 sm:text-7xl">
                <span>{shortCode.slice(0, 3)}</span>
                <span className="inline-block w-4 sm:w-6" aria-hidden="true" />
                <span>{shortCode.slice(3)}</span>
              </div>
            </div>
          )}

          <p className="mt-6 max-w-sm text-center text-xs text-slate-500">
            The QR refreshes every 8 seconds and each token expires in 12 seconds.
            The short code is valid for the whole session. Students mark attendance
            from their own phone, signed in to their own account.
          </p>
        </div>
      </div>

      {/* Attendance panel */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900">
            Present
            <span className="badge bg-slate-100 text-slate-600 tabular-nums">{attendees.length}</span>
          </h2>
          <button onClick={exportCsv} className="btn-ghost text-sm" disabled={attendees.length === 0}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export CSV
          </button>
        </header>

        {attendees.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">No one has marked attendance yet.</p>
        ) : (
          <ul className="max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
            {attendees.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                    {a.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{a.name}</span>
                    <span className="block truncate text-xs text-slate-500">{a.matricNumber}</span>
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-slate-500">
                  {new Date(a.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
