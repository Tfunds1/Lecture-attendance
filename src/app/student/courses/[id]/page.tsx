// Student per-course page: full history of sessions for this course, with
// "present" / "absent" against each.

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function StudentCourseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;

  // Confirm enrollment up front; if not enrolled, hide the course exists.
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_courseId: { studentId: session.user.id, courseId: id } },
    include: { course: { include: { lecturer: { select: { name: true } } } } },
  });
  if (!enrollment) return notFound();

  const sessions = await db.session.findMany({
    where: { courseId: id },
    orderBy: { startedAt: "desc" },
    include: {
      attendances: {
        where: { studentId: session.user.id },
        select: { markedAt: true },
      },
    },
  });

  const presentCount = sessions.filter((s) => s.attendances.length > 0).length;
  const totalCount = sessions.length;
  const pct = totalCount === 0 ? 0 : Math.round((presentCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-xs text-slate-500">{enrollment.course.code}</div>
        <h1 className="page-title mt-0.5">{enrollment.course.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{enrollment.course.lecturer.name}</p>
      </div>

      <div className="card flex items-center justify-between px-5 py-4">
        <div>
          <div className="text-sm font-medium text-slate-500">Attendance</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
            {presentCount}<span className="text-slate-400"> / {totalCount}</span>
          </div>
        </div>
        <div
          className={`text-2xl font-semibold tabular-nums ${
            pct >= 75 ? "text-slate-900" : pct >= 50 ? "text-amber-600" : "text-rose-600"
          }`}
        >
          {pct}%
        </div>
      </div>

      <div className="card overflow-hidden">
        <header className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Session history</h2>
        </header>
        {sessions.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">This course has no sessions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5">Date</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Marked at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => {
                const present = s.attendances[0];
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-3 text-slate-700">{s.startedAt.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      {present ? (
                        <span className="badge bg-emerald-50 text-emerald-700">Present</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500">Absent</span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-500">
                      {present ? present.markedAt.toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
