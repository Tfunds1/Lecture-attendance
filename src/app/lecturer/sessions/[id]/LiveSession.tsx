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
    <div className="grid md:grid-cols-2 gap-6">
      {/* QR panel */}
      <div className="card p-6 flex flex-col items-center">
        <div className="flex w-full justify-between items-center mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            Live QR
            <span
              className={`badge ${active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}
            >
              {active && (
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              )}
              {active ? "Active" : "Ended"}
            </span>
          </h2>
          {active && (
            <button
              onClick={onEndSession}
              className="btn-danger text-sm"
              disabled={ending}
            >
              {ending ? "Ending..." : "End session"}
            </button>
          )}
        </div>

        {active ? (
          qrDataUrl ? (
            <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Attendance QR code" className="rounded-lg" />
            </div>
          ) : (
            <div className="w-[360px] h-[360px] bg-slate-100 rounded-2xl animate-pulse" />
          )
        ) : (
          <div className="w-[360px] h-[360px] bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-500 text-center px-6 gap-3">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
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
            <div className="text-sm text-slate-500 uppercase tracking-wide">
              Or enter code:
            </div>
            <div className="mt-2 font-mono font-bold text-6xl sm:text-7xl tracking-widest text-slate-900 select-all">
              <span>{shortCode.slice(0, 3)}</span>
              <span className="inline-block w-4 sm:w-6" aria-hidden="true" />
              <span>{shortCode.slice(3)}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-4 text-center max-w-sm">
          The QR refreshes every 8 seconds and each token expires in 12 seconds.
          The short code is valid for the whole session. Students must mark
          attendance from their own phone, signed in to their own account.
        </p>
      </div>

      {/* Attendance panel */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            Present
            <span className="badge bg-brand-50 text-brand-700 tabular-nums">{attendees.length}</span>
          </h2>
          <button
            onClick={exportCsv}
            className="btn-ghost text-sm"
            disabled={attendees.length === 0}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export CSV
          </button>
        </div>

        {attendees.length === 0 ? (
          <div className="text-center py-10">
            <svg viewBox="0 0 24 24" className="h-10 w-10 mx-auto text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>
            <p className="text-sm text-slate-500 mt-2">No one has marked attendance yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto -mx-2">
            {attendees.map((a) => (
              <li key={a.id} className="py-2.5 px-2 flex items-center justify-between gap-3 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="grid place-items-center h-8 w-8 shrink-0 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold ring-1 ring-emerald-100">
                    {a.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 truncate">{a.name}</span>
                    <span className="block text-xs text-slate-500 truncate">{a.matricNumber}</span>
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                  {new Date(a.markedAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
