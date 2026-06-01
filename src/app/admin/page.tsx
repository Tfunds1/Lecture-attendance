// Admin dashboard — system overview. Six stat cards with a short context phrase
// each, then an Active-sessions panel and a derived Recent-activity feed. All
// queries here are read-only counts/lookups; no schema or action changes.

import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { timeAgo } from "@/lib/time-ago";

// Small 14px metric glyphs, keyed so the card config stays declarative.
const STAT_ICONS: Record<string, React.ReactNode> = {
  users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  lecturer: <path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />,
  student: <path d="M12 14 4 9l8-5 8 5-8 5zM12 14v6" />,
  course: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />,
  session: <path d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  record: <path d="m3 12 4 4 6-7M13 16l1 1 7-8" />,
};

export default async function AdminDashboard() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    lecturerCount,
    studentCount,
    courseCount,
    sessionCount,
    attendanceCount,
    usersThisWeek,
    lecturersActive,
    studentsActive,
    harmattanCount,
    rainCount,
    activeSessions,
    recentUser,
    recentCourse,
    recentEndedSession,
    recentAttendance,
    recentActivation,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "LECTURER" } }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.course.count(),
    db.session.count(),
    db.attendance.count(),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.user.count({ where: { role: "LECTURER", passwordHash: { not: null } } }),
    db.user.count({ where: { role: "STUDENT", passwordHash: { not: null } } }),
    db.course.count({ where: { semester: "HARMATTAN" } }),
    db.course.count({ where: { semester: "RAIN" } }),
    db.session.findMany({
      where: { active: true },
      include: {
        course: { include: { lecturer: { select: { name: true } } } },
        _count: { select: { attendances: true } },
      },
      orderBy: { startedAt: "desc" },
    }),
    db.user.findFirst({ orderBy: { createdAt: "desc" }, select: { name: true, createdAt: true } }),
    db.course.findFirst({ orderBy: { createdAt: "desc" }, select: { code: true, createdAt: true } }),
    db.session.findFirst({
      where: { endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      select: { endedAt: true, course: { select: { code: true } } },
    }),
    db.attendance.findFirst({
      orderBy: { markedAt: "desc" },
      select: { markedAt: true, student: { select: { name: true } } },
    }),
    db.passwordSetupToken.findFirst({
      where: { usedAt: { not: null } },
      orderBy: { usedAt: "desc" },
      select: { usedAt: true, user: { select: { name: true } } },
    }),
  ]);

  const stats = [
    { key: "users", label: "Total users", value: userCount, context: `+${usersThisWeek} this week` },
    {
      key: "lecturer",
      label: "Lecturers",
      value: lecturerCount,
      context: lecturerCount > 0 && lecturersActive === lecturerCount ? "all active" : `${lecturersActive} active`,
    },
    {
      key: "student",
      label: "Students",
      value: studentCount,
      context: studentCount > 0 && studentsActive === studentCount ? "all active" : `${studentsActive} active`,
    },
    { key: "course", label: "Courses", value: courseCount, context: `${harmattanCount} Harmattan · ${rainCount} Rain` },
    {
      key: "session",
      label: "Sessions",
      value: sessionCount,
      context: activeSessions.length > 0 ? `${activeSessions.length} active` : "none active",
    },
    { key: "record", label: "Attendance records", value: attendanceCount, context: "all-time" },
  ];

  // Derive a recent-activity feed from existing data (no activity-log table).
  const activity = [
    recentUser && { text: `Created user: ${recentUser.name}`, at: recentUser.createdAt },
    recentCourse && { text: `Created course: ${recentCourse.code}`, at: recentCourse.createdAt },
    recentEndedSession?.endedAt && { text: `Session ended · ${recentEndedSession.course.code}`, at: recentEndedSession.endedAt },
    recentAttendance && { text: `${recentAttendance.student.name} marked present`, at: recentAttendance.markedAt },
    recentActivation?.usedAt && { text: `${recentActivation.user.name} activated their account`, at: recentActivation.usedAt },
  ].filter(Boolean) as { text: string; at: Date }[];
  activity.sort((a, b) => b.at.getTime() - a.at.getTime());
  const recent = activity.slice(0, 5);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`System overview · ${today}`} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.key} className="rounded-lg bg-slate-50 p-3.5">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{s.label}</span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {STAT_ICONS[s.key]}
              </svg>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-medium tabular-nums text-slate-900">{s.value}</span>
              <span className="text-xs text-slate-500">{s.context}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Panels: 60/40 split on desktop */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        {/* Active sessions */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-900">Active sessions</h2>
            <span className="text-xs text-slate-500">Live · refreshes every 3s</span>
          </header>
          {activeSessions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-slate-500">No sessions running right now.</p>
              <p className="mt-1 text-[13px] text-slate-400">
                Lecturers will appear here when they start a session.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs text-slate-500">{s.course.code}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-slate-700">{s.course.lecturer.name}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {s._count.attendances} present ·{" "}
                    {s.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-900">Recent activity</h2>
          </header>
          {recent.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-400">No recent activity yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 truncate text-slate-700">{a.text}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">{timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
