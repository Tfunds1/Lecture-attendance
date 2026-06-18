"use client";

// The "Add student" list, shown inside a Dialog over the students page. Lists
// every STUDENT not already enrolled in this course (already-enrolled students
// are filtered out server-side so they never appear here, avoiding confusion),
// with a search box and a per-row Enrol button.
//
// On a successful enrol we navigate back to the students page with a ?enrolled
// param — that closes the dialog (the panel param is dropped) and shows the
// success banner, matching how the admin create flows close after a redirect.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult, EnrolError } from "./actions";

export type AvailableStudent = {
  id: string;
  name: string;
  matricNumber: string | null;
};

const ENROL_ERRORS: Record<EnrolError, string> = {
  unauthorized: "Your session expired — please sign in again.",
  forbidden: "You don't teach this course.",
  student_invalid: "That account can't be enrolled.",
  already_enrolled: "That student is already enrolled.",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AddStudentList({
  courseId,
  students,
  enrolStudent,
}: {
  courseId: string;
  students: AvailableStudent[];
  enrolStudent: (
    courseId: string,
    studentId: string,
  ) => Promise<ActionResult<EnrolError>>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
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

  function handleEnrol(s: AvailableStudent) {
    setPendingId(s.id);
    startTransition(async () => {
      const res = await enrolStudent(courseId, s.id);
      setPendingId(null);
      router.push(
        res.ok
          ? `${base}?enrolled=${encodeURIComponent(s.name)}`
          : `${base}?error=${encodeURIComponent(ENROL_ERRORS[res.error])}`,
      );
    });
  }

  // Everyone's already in — nothing to add.
  if (students.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Every student in the system is already enrolled in this course.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or matric…"
        className="input"
        aria-label="Search students"
        autoFocus
      />

      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="py-6 text-center text-sm text-slate-500">
            No students match “{query}”.
          </li>
        ) : (
          filtered.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                {initials(s.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-900">{s.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {s.matricNumber ?? "—"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleEnrol(s)}
                disabled={pendingId !== null}
                className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
              >
                {pendingId === s.id ? "Enrolling…" : "Enrol"}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
