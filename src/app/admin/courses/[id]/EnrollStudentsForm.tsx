"use client";

// Multi-select enrollment panel: pick many students (or all of them) and enroll
// them in one submit, instead of one-at-a-time through a dropdown.
//
// Selection lives in React state (a Set of student ids) so it survives the
// search filter — a student you ticked stays selected even while filtered out
// of view. On submit we render a hidden <input name="studentId"> for every
// selected id, so the bound server action receives them via formData.getAll.

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type Student = { id: string; name: string; matricNumber: string | null };

export function EnrollStudentsForm({
  enrollStudents,
  students,
}: {
  enrollStudents: (formData: FormData) => Promise<void>;
  students: Student[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.matricNumber ?? "").toLowerCase().includes(q),
    );
  }, [students, query]);

  // "Select all" operates on the currently filtered set, which is the least
  // surprising behaviour when a search is active.
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((s) => next.delete(s.id));
      } else {
        filtered.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }

  return (
    <form action={enrollStudents} className="space-y-3">
      {/* Selected ids travel with the form even when filtered out of view. */}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="studentId" value={id} />
      ))}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or matric number…"
        className="input"
        aria-label="Search students"
      />

      <label className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleAllFiltered}
          className="h-4 w-4"
        />
        Select all
        {query.trim() && filtered.length !== students.length
          ? ` (${filtered.length} matching)`
          : ` (${students.length})`}
      </label>

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="py-2 text-sm text-slate-500">No students match “{query}”.</li>
        ) : (
          filtered.map((s) => (
            <li key={s.id}>
              <label className="flex items-center gap-2 rounded px-1 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4"
                />
                <span>
                  {s.name}{" "}
                  <span className="text-slate-500">({s.matricNumber ?? "—"})</span>
                </span>
              </label>
            </li>
          ))
        )}
      </ul>

      <SubmitButton count={selected.size} />
    </form>
  );
}

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-primary w-full"
      disabled={pending || count === 0}
    >
      {pending
        ? "Enrolling…"
        : count === 0
          ? "Select students to enroll"
          : `Enroll ${count} selected`}
    </button>
  );
}
