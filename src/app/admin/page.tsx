// Admin dashboard — a quiet overview of the system. Hierarchy comes from type
// weight and whitespace, not colour: a single framed metric strip and a plain
// list of what's live right now. No hero, no tinted tiles, no decorative icons.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminDashboard() {
  const session = await auth();
  const [userCount, lecturerCount, studentCount, courseCount, sessionCount, attendanceCount, activeSessions] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "LECTURER" } }),
      db.user.count({ where: { role: "STUDENT" } }),
      db.course.count(),
      db.session.count(),
      db.attendance.count(),
      db.session.findMany({
        where: { active: true },
        include: { course: { include: { lecturer: { select: { name: true } } } } },
        orderBy: { startedAt: "desc" },
      }),
    ]);

  const stats = [
    { label: "Total users", value: userCount },
    { label: "Lecturers", value: lecturerCount },
    { label: "Students", value: studentCount },
    { label: "Courses", value: courseCount },
    { label: "Sessions", value: sessionCount },
    { label: "Attendance records", value: attendanceCount },
  ];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const firstName = (session?.user?.name ?? "there").trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {firstName} · {today}
        </p>
      </div>

      {/* Metric strip — one framed surface, hairline-separated cells, values
          carried by weight rather than size or colour. */}
      <div className="card overflow-hidden">
        <dl className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white px-5 py-4">
              <dt className="text-sm font-medium text-slate-500">{s.label}</dt>
              <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Active sessions */}
      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Active sessions</h2>
          {activeSessions.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {activeSessions.length} live
            </span>
          )}
        </header>

        {activeSessions.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No sessions are running right now.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activeSessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs font-medium text-slate-500">{s.course.code}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="font-medium text-slate-900">{s.course.title}</span>
                  <span className="text-slate-500"> — {s.course.lecturer.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-slate-400">
                  {s.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
