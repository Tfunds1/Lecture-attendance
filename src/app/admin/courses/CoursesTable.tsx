"use client";

// The courses table for /admin/courses — a dense, searchable list mirroring
// the users table. Filtering runs client-side over the already-loaded list
// (one institution's catalogue is small, so instant search beats a round-trip
// per keystroke). Each row links into the per-course management page.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Semester } from "@prisma/client";

import { SEMESTER_BADGE, SEMESTER_LABELS } from "@/lib/semester";

export type CourseRowVM = {
  id: string;
  code: string;
  title: string;
  semester: Semester;
  lecturerName: string;
  students: number;
  sessions: number;
};

// "ALL" is the unfiltered view; the others narrow to one semester.
type SemesterFilter = "ALL" | Semester;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CoursesTable({ courses }: { courses: CourseRowVM[] }) {
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState<SemesterFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (semester !== "ALL" && c.semester !== semester) return false;
      if (!q) return true;
      return `${c.code} ${c.title} ${c.lecturerName}`.toLowerCase().includes(q);
    });
  }, [courses, query, semester]);

  // Whole-catalogue empty state — distinct from "no search matches".
  if (courses.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />
          </svg>
        </span>
        <div>
          <p className="font-medium text-slate-900">No courses yet</p>
          <p className="mt-0.5 text-sm text-slate-500">Create your first course to start running sessions.</p>
        </div>
        <Link href="/admin/courses?panel=new" className="btn-primary text-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Add course
        </Link>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, title, or lecturer…"
            className="input pl-9"
            aria-label="Search courses"
          />
        </div>
        <select
          value={semester}
          onChange={(e) => setSemester(e.target.value as SemesterFilter)}
          className="input sm:w-44"
          aria-label="Filter by semester"
        >
          <option value="ALL">All semesters</option>
          <option value="HARMATTAN">Harmattan</option>
          <option value="RAIN">Rain</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Course</th>
              <th className="px-4 py-2.5">Lecturer</th>
              <th className="px-4 py-2.5">Semester</th>
              <th className="px-4 py-2.5 text-right">Students</th>
              <th className="px-4 py-2.5 text-right">Sessions</th>
              <th className="w-px px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-500">No courses match your filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSemester("ALL");
                    }}
                    className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex shrink-0 items-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
                        {c.code}
                      </span>
                      <span className="truncate font-medium text-slate-900">{c.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">
                        {initials(c.lecturerName)}
                      </span>
                      <span className="truncate text-slate-700">{c.lecturerName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${SEMESTER_BADGE[c.semester]}`}>
                      {SEMESTER_LABELS[c.semester]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.students}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.sessions}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      Manage
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700 tabular-nums">{filtered.length}</span> of{" "}
        <span className="font-medium text-slate-700 tabular-nums">{courses.length}</span> courses
      </div>
    </div>
  );
}
