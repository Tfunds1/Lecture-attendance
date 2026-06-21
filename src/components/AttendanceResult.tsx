// Shared success / error card for /student/scan and /student/code.
//
// Both entry paths POST to /api/attendance and get back the same response
// shape, so the UI is identical — extracted here so the two pages can't
// drift apart and so error labels stay in one place.

export type AttendanceResult =
  | { ok: true;  alreadyMarked: boolean; courseCode: string; courseTitle: string; markedAt?: string }
  // closedAt is the ISO time the attendance window closed (window_closed only).
  // windowSeconds is the original window length — used to decide whether the
  // closed-at time needs second-level precision (short windows do).
  | { ok: false; error: string; closedAt?: string; windowSeconds?: number };

export const ATTENDANCE_ERROR_LABELS: Record<string, string> = {
  invalid_or_expired_token:   "That code has expired. Ask your lecturer to refresh the QR.",
  invalid_or_inactive_code:   "That code isn't valid. Double-check the characters, or ask your lecturer.",
  session_not_found:          "Session not found.",
  session_closed:             "The lecturer has ended this session.",
  window_closed:              "The attendance window for this session has closed.",
  not_enrolled_in_course:     "You are not enrolled in this course.",
  malformed_token:            "That doesn't look like a valid attendance QR.",
  only_students_can_mark:     "Only students can mark attendance.",
  unauthorized:               "Please sign in.",
  bad_request:                "Something went wrong with the request. Please try again.",
  network_error:              "Network error — check your connection and try again.",
};

export function AttendanceResultCard({ result }: { result: AttendanceResult }) {
  return (
    <div
      role={result.ok ? "status" : "alert"}
      className={`card p-4 ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
    >
      {result.ok ? (
        <>
          <div className="font-semibold text-emerald-800">
            {result.alreadyMarked ? "Already marked present" : "Marked present"}
          </div>
          <div className="text-sm text-emerald-700 mt-1">
            {result.courseCode} — {result.courseTitle}
            {result.markedAt && (
              <> <span className="text-emerald-600">at {new Date(result.markedAt).toLocaleTimeString()}</span></>
            )}
          </div>
        </>
      ) : result.error === "window_closed" ? (
        <>
          <div className="font-semibold text-rose-800">Attendance window closed.</div>
          <div className="text-sm text-rose-700 mt-1">
            {result.closedAt
              ? `The lecturer accepted attendance until ${new Date(result.closedAt).toLocaleTimeString(
                  [],
                  result.windowSeconds != null && result.windowSeconds < 300
                    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                    : { hour: "2-digit", minute: "2-digit" },
                )}. You arrived too late.`
              : "The attendance window for this session has closed. You arrived too late."}
          </div>
        </>
      ) : (
        <>
          <div className="font-semibold text-rose-800">Couldn&apos;t mark attendance</div>
          <div className="text-sm text-rose-700 mt-1">
            {ATTENDANCE_ERROR_LABELS[result.error] ?? result.error}
          </div>
        </>
      )}
    </div>
  );
}
