// Admin dashboard — quick counts of everything in the system.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Heroicons-style inline glyphs keyed by name so the stat config below stays
// declarative (no icon library dependency to defend at viva).
const ICONS: Record<string, React.ReactNode> = {
  users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  lecturer: <path d="M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5" />,
  student: <path d="M12 14l9-5-9-5-9 5 9 5zM12 14v7M5 11v4l7 4 7-4v-4" />,
  course: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />,
  session: <path d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  record: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
};

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

  // Each stat carries its own gradient so the icon tiles read as a vibrant,
  // colour-coded row rather than a wall of identical grey cards.
  const stats = [
    { label: "Total users",        value: userCount,       icon: "users",    gradient: "from-brand-500 to-brand-700" },
    { label: "Lecturers",          value: lecturerCount,   icon: "lecturer", gradient: "from-sky-500 to-blue-600" },
    { label: "Students",           value: studentCount,    icon: "student",  gradient: "from-emerald-500 to-teal-600" },
    { label: "Courses",            value: courseCount,     icon: "course",   gradient: "from-amber-500 to-orange-600" },
    { label: "Total sessions",     value: sessionCount,    icon: "session",  gradient: "from-violet-500 to-purple-600" },
    { label: "Attendance records", value: attendanceCount, icon: "record",   gradient: "from-rose-500 to-pink-600" },
  ];

  // Time-aware greeting for the hero banner — a small touch that makes the
  // dashboard feel personal instead of a static report.
  const firstName = (session?.user?.name ?? "Admin").trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-8">
      {/* Hero banner — gradient greeting with a faint QR-grid motif echoing the
          app's brand mark, so the dashboard opens with personality. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-violet-700 px-6 py-7 text-white shadow-card-hover sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-6 -top-10 opacity-[0.15] sm:opacity-20">
          <svg viewBox="0 0 24 24" className="h-44 w-44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3M20 20v.01M17 20v.01M20 17v.01" />
          </svg>
        </div>
        <p className="text-sm font-medium text-brand-100">{greeting},</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{firstName}</h1>
        <p className="mt-2 max-w-md text-sm text-brand-100/90">
          {today} · Here's everything happening across the system at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card card-hover relative overflow-hidden p-5">
            {/* Soft tinted glow in the corner picks up the icon's colour. */}
            <span className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${s.gradient} opacity-10 blur-2xl`} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</div>
                <div className="text-3xl font-bold mt-2 tracking-tight tabular-nums text-slate-900">{s.value}</div>
              </div>
              <span className={`grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br ${s.gradient} text-white shadow-sm`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[s.icon]}
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Active sessions right now</h2>
          {activeSessions.length > 0 && (
            <span className="badge bg-green-100 text-green-700">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              {activeSessions.length} live
            </span>
          )}
        </div>
        {activeSessions.length === 0 ? (
          <div className="text-center py-8">
            <svg viewBox="0 0 24 24" className="h-10 w-10 mx-auto text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <p className="text-sm text-slate-500 mt-2">No live sessions.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activeSessions.map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <span>
                  <span className="font-mono text-xs font-semibold text-brand-700">{s.course.code}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="font-medium text-slate-900">{s.course.title}</span>
                  <span className="text-slate-500"> — {s.course.lecturer.name}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  started {s.startedAt.toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
