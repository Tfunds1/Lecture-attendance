// Lecturer home: list courses they teach. Each course links into its detail
// page where they can start a session.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/PageHeader";

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
    // The card body links to the course; the student count links straight to
    // that course's students page. Two separate <Link>s (not one nested in the
    // other) since anchors can't be nested.
    return (
      <div key={c.id} className="card card-hover p-5 group">
        <Link href={`/lecturer/courses/${c.id}`} className="flex justify-between items-start">
          <div>
            <div className="font-mono text-xs font-medium text-slate-500">{c.code}</div>
            <div className="font-semibold text-slate-900 mt-1">{c.title}</div>
          </div>
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </Link>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
          <Link
            href={`/lecturer/courses/${c.id}/students`}
            className="font-medium text-slate-600 hover:text-brand-600 hover:underline"
          >
            {c._count.enrollments} students
          </Link>
          <span className="text-slate-300">·</span>
          <span>{c._count.sessions} sessions held</span>
        </div>
      </div>
    );
  }

  // Group into the two semesters; a section with no courses is hidden entirely.
  const sections = [
    { label: "Harmattan Semester", items: courses.filter((c) => c.semester === "HARMATTAN") },
    { label: "Rain Semester", items: courses.filter((c) => c.semester === "RAIN") },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Courses"
        subtitle="Open a course to start a session and track attendance."
      />

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
