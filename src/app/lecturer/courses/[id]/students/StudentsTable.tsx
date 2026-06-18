"use client";

// The enrolled-students table for a lecturer's course. Instant client-side
// search over the already-loaded roster (one course's enrolment is small, so
// filtering in the browser beats a round-trip per keystroke) and a per-row
// kebab whose single action removes the student from the course.
//
// Density, the greyscale avatar, the search box, and the fixed-position kebab
// all match the admin users table (src/app/admin/users/UsersTable.tsx) so the
// lecturer section reads as the same product.

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ActionResult, RemoveError } from "./actions";

export type StudentRowVM = {
  id: string;
  name: string;
  matricNumber: string | null;
  attended: number;
  total: number;
  pct: number;
};

// Friendly copy for the handful of expected server-side failures.
const REMOVE_ERRORS: Record<RemoveError, string> = {
  unauthorized: "Your session expired — please sign in again.",
  forbidden: "You don't teach this course.",
  not_enrolled: "That student is no longer enrolled.",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Same thresholds as the student's own course page so a percentage means the
// same thing wherever it's shown.
function pctTone(pct: number) {
  if (pct >= 75) return "text-slate-900";
  if (pct >= 50) return "text-amber-600";
  return "text-rose-600";
}

export function StudentsTable({
  courseId,
  courseCode,
  students,
  removeStudent,
}: {
  courseId: string;
  courseCode: string;
  students: StudentRowVM[];
  removeStudent: (
    courseId: string,
    studentId: string,
  ) => Promise<ActionResult<RemoveError>>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const base = `/lecturer/courses/${courseId}/students`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.matricNumber ?? "").toLowerCase().includes(q),
    );
  }, [students, query]);

  function handleRemove(s: StudentRowVM) {
    if (
      !confirm(
        `Remove ${s.name} from ${courseCode}? Their past attendance records stay intact.`,
      )
    )
      return;
    setMenuId(null);
    setPendingId(s.id);
    // The action revalidates the page; we navigate to surface the toast banner.
    startTransition(async () => {
      const res = await removeStudent(courseId, s.id);
      setPendingId(null);
      router.push(
        res.ok
          ? `${base}?removed=${encodeURIComponent(s.name)}`
          : `${base}?error=${encodeURIComponent(REMOVE_ERRORS[res.error])}`,
      );
    });
  }

  // No students at all — full empty state with the primary call to action.
  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </svg>
        </span>
        <p className="mt-3 font-medium text-slate-900">No students enrolled yet</p>
        <p className="mt-0.5 text-sm text-slate-500">
          Add students to {courseCode} to start tracking their attendance.
        </p>
        <Link href={`${base}?panel=add`} className="btn-primary mt-4 text-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Add student
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Toolbar: search */}
      <div className="border-b border-slate-100 p-3">
        <div className="relative sm:max-w-xs">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or matric…"
            className="input pl-9"
            aria-label="Search students"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5 text-right">Attendance</th>
              <th className="px-4 py-2.5 text-right">Sessions</th>
              <th className="w-px px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-500">No students match your search.</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Clear search
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className={`transition-colors hover:bg-slate-50/70 ${pendingId === s.id ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                        {initials(s.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-slate-900">{s.name}</div>
                        <div className="truncate text-xs text-slate-500">
                          {s.matricNumber ?? "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${pctTone(s.pct)}`}>
                    {s.pct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {s.attended}/{s.total}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <RowMenu
                      open={menuId === s.id}
                      onToggle={() => setMenuId((cur) => (cur === s.id ? null : s.id))}
                      onClose={() => setMenuId(null)}
                    >
                      <button
                        type="button"
                        onClick={() => handleRemove(s)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                        Remove from course
                      </button>
                    </RowMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        Showing <span className="tabular-nums text-slate-700">{filtered.length}</span> of{" "}
        <span className="tabular-nums text-slate-700">{students.length}</span>{" "}
        {students.length === 1 ? "student" : "students"}
      </div>
    </div>
  );
}

// Kebab dropdown, fixed-position so the table's horizontal scroll can't clip it.
// Lifted from the admin users table to keep the interaction identical.
function RowMenu({
  open,
  onToggle,
  onClose,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  function toggle() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    onToggle();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      {open && (
        <>
          <button type="button" aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
          <div
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg animate-fade-in"
          >
            {children}
          </div>
        </>
      )}
    </>
  );
}
