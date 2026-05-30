// Shared success / error card for /student/scan and /student/code.
//
// Both entry paths POST to /api/attendance and get back the same response
// shape, so the UI is identical — extracted here so the two pages can't
// drift apart and so error labels stay in one place.

export type AttendanceResult =
  | { ok: true;  alreadyMarked: boolean; courseCode: string; courseTitle: string; markedAt?: string }
  | { ok: false; error: string };

export const ATTENDANCE_ERROR_LABELS: Record<string, string> = {
  invalid_or_expired_token:   "That code has expired. Ask your lecturer to refresh the QR.",
  invalid_or_inactive_code:   "That code isn't valid. Double-check the characters, or ask your lecturer.",
  session_not_found:          "Session not found.",
  session_closed:             "The lecturer has ended this session.",
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
      className={`card p-4 ${result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
    >
      {result.ok ? (
        <>
          <div className="font-semibold text-green-800">
            {result.alreadyMarked ? "Already marked present" : "Marked present"}
          </div>
          <div className="text-sm text-green-700 mt-1">
            {result.courseCode} — {result.courseTitle}
            {result.markedAt && (
              <> <span className="text-green-600">at {new Date(result.markedAt).toLocaleTimeString()}</span></>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="font-semibold text-red-800">Couldn&apos;t mark attendance</div>
          <div className="text-sm text-red-700 mt-1">
            {ATTENDANCE_ERROR_LABELS[result.error] ?? result.error}
          </div>
        </>
      )}
    </div>
  );
}
