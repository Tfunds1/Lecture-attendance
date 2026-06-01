"use client";

// The courses table for /admin/courses. Courses are grouped into two semester
// sections (Harmattan, Rain) — the section heading states the semester, so rows
// don't repeat it. One search box narrows across both sections; an empty
// section is hidden. Density and styling mirror the users table.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Semester } from "@prisma/client";

import { SEMESTER_LABELS } from "@/lib/semester";

export type CourseRowVM = {
  id: string;
  code: string;
  title: string;
  semester: Semester;
  lecturerName: string;
  students: number;
  sessions: number;
};

const SECTION_ORDER: Semester[] = ["HARMATTAN", "RAIN"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CoursesTable({ courses }: { courses: CourseRowVM[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      `${c.code} ${c.title} ${c.lecturerName}`.toLowerCase().includes(q),
    );
  }, [courses, query]);

  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
        <p className="font-medium text-slate-900">No courses yet</p>
        <p className="mt-0.5 text-sm text-slate-500">Create your first course to start running sessions.</p>
        <Link href="/admin/courses?panel=new" className="btn-primary mt-4 text-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Add course
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative sm:max-w-xs">
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

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center">
          <p className="text-sm text-slate-500">No courses match your search.</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Clear search
          </button>
        </div>
      ) : (
        SECTION_ORDER.map((sem) => {
          const items = filtered.filter((c) => c.semester === sem);
          if (items.length === 0) return null;
          return (
            <section key={sem} className="space-y-3">
              <h2 className="border-b border-slate-200 pb-2 text-base font-medium tracking-tight text-slate-900">
                {SEMESTER_LABELS[sem]} Semester
              </h2>
              <CourseTable courses={items} />
            </section>
          );
        })
      )}
    </div>
  );
}

function CourseTable({ courses }: { courses: CourseRowVM[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Course</th>
              <th className="px-4 py-2.5">Lecturer</th>
              <th className="px-4 py-2.5 text-right">Students</th>
              <th className="px-4 py-2.5 text-right">Sessions</th>
              <th className="w-px px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courses.map((c) => (
              <tr key={c.id} className="group transition-colors hover:bg-slate-50/70">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                      {c.code}
                    </span>
                    <span className="truncate text-slate-900">{c.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                      {initials(c.lecturerName)}
                    </span>
                    <span className="truncate text-slate-700">{c.lecturerName}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{c.students}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{c.sessions}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/courses/${c.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    Manage
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span className="tabular-nums text-slate-700">{courses.length}</span>{" "}
        {courses.length === 1 ? "course" : "courses"}
      </div>
    </div>
  );
}
