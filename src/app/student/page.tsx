// Student home: list of courses they're enrolled in, with their attendance
// percentage (rows marked / sessions held) for each.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="page-title">My Courses</h1>
          <p className="text-sm text-slate-500 mt-1">Mark your attendance and track your record.</p>
        </div>
        {/*
          Two entry paths, equally prominent. Order matters on mobile: Scan
          QR is the first option for students who can see the screen; Enter
          code is the fallback for the (common) case where they can't.
        */}
        <div className="flex gap-2 sm:gap-3">
          <Link href="/student/scan" className="btn-primary flex-1 sm:flex-none text-center">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 20v.01M17 20v.01M20 17v.01" /></svg>
            Scan QR
          </Link>
          <Link href="/student/code" className="btn-ghost flex-1 sm:flex-none text-center">
            Enter code
          </Link>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-500">You're not enrolled in any courses yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {enrollments.map(({ course }) => {
            const total = course._count.sessions;
            const mine = courseToMyAttendance.get(course.id) ?? 0;
            const pct = total === 0 ? 0 : Math.round((mine / total) * 100);
            const tone = pct >= 75 ? "green" : pct >= 50 ? "amber" : "red";
            const text = { green: "text-green-600", amber: "text-amber-600", red: "text-red-600" }[tone];
            const bar = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
            return (
              <Link
                key={course.id}
                href={`/student/courses/${course.id}`}
                className="card card-hover p-5 group"
              >
                <div className="font-mono text-xs font-semibold text-brand-700">{course.code}</div>
                <div className="font-semibold text-slate-900 mt-1 group-hover:text-brand-700 transition-colors">{course.title}</div>
                <div className="text-xs text-slate-500 mt-1">Lecturer: {course.lecturer.name}</div>
                <div className="mt-4">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-slate-500">{mine} / {total} sessions</span>
                    <span className={`font-semibold tabular-nums ${text}`}>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
