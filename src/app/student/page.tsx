// Student home: list of courses they're enrolled in, with their attendance
// percentage (rows marked / sessions held) for each.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/PageHeader";

export default async function StudentHome() {
  const session = await auth();
  if (!session?.user) return null;

  const enrollments = await db.enrollment.findMany({
    where: { studentId: session.user.id },
    include: {
      course: {
        include: {
          _count: { select: { sessions: true } },
          lecturer: { select: { name: true } },
        },
      },
    },
    orderBy: { course: { code: "asc" } },
  });

  // Count attendances per course in one query.
  const attendanceCounts = await db.attendance.groupBy({
    by: ["sessionId"],
    where: { studentId: session.user.id },
    _count: true,
  });
  const sessionIds = attendanceCounts.map((a) => a.sessionId);
  const sessionsOfMine = await db.session.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, courseId: true },
  });
  const courseToMyAttendance = new Map<string, number>();
  for (const s of sessionsOfMine) {
    courseToMyAttendance.set(
      s.courseId,
      (courseToMyAttendance.get(s.courseId) ?? 0) + 1
    );
  }

  type Enrolled = (typeof enrollments)[number];
  function renderCard({ course }: Enrolled) {
    const total = course._count.sessions;
    const mine = courseToMyAttendance.get(course.id) ?? 0;
    const pct = total === 0 ? 0 : Math.round((mine / total) * 100);
    // Neutral by default; colour appears only to flag attendance that's
    // slipping — a signal, not decoration.
    const pctText = pct >= 75 ? "text-slate-900" : pct >= 50 ? "text-amber-600" : "text-rose-600";
    return (
      <Link
        key={course.id}
        href={`/student/courses/${course.id}`}
        className="card card-hover p-5 group"
      >
        <div className="font-mono text-xs font-medium text-slate-500">{course.code}</div>
        <div className="font-semibold text-slate-900 mt-1">{course.title}</div>
        <div className="text-xs text-slate-500 mt-1">{course.lecturer.name}</div>
        <div className="mt-4">
          <div className="flex justify-between items-baseline text-sm">
            <span className="text-slate-500 tabular-nums">{mine} / {total} sessions</span>
            <span className={`font-semibold tabular-nums ${pctText}`}>{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Link>
    );
  }

  // Group into the two semesters; a section with no courses is hidden entirely.
  const sections = [
    { label: "Harmattan Semester", items: enrollments.filter((e) => e.course.semester === "HARMATTAN") },
    { label: "Rain Semester", items: enrollments.filter((e) => e.course.semester === "RAIN") },
  ];

  return (
    <div className="space-y-8">
      {/*
        Two entry paths, equally prominent. Scan QR is the primary action for
        students who can see the screen; Enter code is the fallback for the
        (common) case where they can't.
      */}
      <PageHeader
        title="My Courses"
        subtitle="Mark your attendance and track your record."
        actions={
          <>
            <Link href="/student/scan" className="btn-primary text-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 20v.01M17 20v.01M20 17v.01" /></svg>
              Scan QR
            </Link>
            <Link href="/student/code" className="btn-ghost text-sm">
              Enter code
            </Link>
          </>
        }
      />

      {enrollments.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-500">You're not enrolled in any courses yet.</p>
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
