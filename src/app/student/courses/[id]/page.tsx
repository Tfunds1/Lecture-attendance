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
        <h1 className="text-2xl font-bold">{enrollment.course.title}</h1>
        <p className="text-sm text-slate-500 mt-1">Lecturer: {enrollment.course.lecturer.name}</p>
      </div>

      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Attendance</div>
          <div className="text-2xl font-bold">{presentCount} of {totalCount} sessions</div>
        </div>
        <div className={`text-3xl font-bold ${pct >= 75 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
          {pct}%
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold mb-3">Session history</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">This course has no sessions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2">Date</th>
                <th>Status</th>
                <th>Marked at</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const present = s.attendances[0];
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2">{s.startedAt.toLocaleString()}</td>
                    <td>
                      {present ? (
                        <span className="badge bg-green-100 text-green-700">Present</span>
                      ) : (
                        <span className="badge bg-red-100 text-red-700">Absent</span>
                      )}
                    </td>
                    <td className="text-slate-500">
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
