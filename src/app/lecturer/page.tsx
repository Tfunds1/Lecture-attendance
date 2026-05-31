// Lecturer home: list courses they teach. Each course links into its detail
// page where they can start a session.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function LecturerHome() {
  const session = await auth();
  if (!session?.user) return null;

  const courses = await db.course.findMany({
    where: { lecturerId: session.user.id },
    include: {
      _count: { select: { enrollments: true, sessions: true } },
      sessions: {
        where: { active: true },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { code: "asc" },
  });

  type TaughtCourse = (typeof courses)[number];
  function renderCard(c: TaughtCourse) {
    const live = c.sessions[0];
    return (
      <Link
        key={c.id}
        href={`/lecturer/courses/${c.id}`}
        className="card card-hover p-5 group"
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="font-mono text-xs font-semibold text-brand-700">{c.code}</div>
            <div className="font-semibold text-slate-900 mt-1 group-hover:text-brand-700 transition-colors">{c.title}</div>
          </div>
          {live && (
            <span className="badge bg-green-100 text-green-700">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live
            </span>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>
            {c._count.enrollments} students
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
            {c._count.sessions} sessions held
          </span>
        </div>
      </Link>
    );
  }

  // Group into the two semesters; a section with no courses is hidden entirely.
  const sections = [
    { label: "Harmattan Semester", items: courses.filter((c) => c.semester === "HARMATTAN") },
    { label: "Rain Semester", items: courses.filter((c) => c.semester === "RAIN") },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">My Courses</h1>
        <p className="text-sm text-slate-500 mt-1">Open a course to start a session and track attendance.</p>
      </div>

      {courses.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-500">You don't have any courses yet. Ask an admin to assign you.</p>
        </div>
      ) : (
        sections.map((s) =>
          s.items.length === 0 ? null : (
            <section key={s.label} className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 border-b border-slate-200 pb-2">
                {s.label}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {s.items.map(renderCard)}
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}
