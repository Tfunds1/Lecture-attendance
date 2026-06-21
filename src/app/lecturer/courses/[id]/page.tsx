// Lecturer's per-course page. From here the lecturer starts a live session
// (or resumes one that's already running), sees who is enrolled, and reviews
// past sessions with their attendance counts.
//
// Enrollment is read-only here — only admins add/remove students
// (see /admin/courses/[id]). The lecturer just teaches and runs sessions.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSessionSecret } from "@/lib/qr-token";
import { generateShortCode } from "@/lib/short-code";
import { WindowField } from "./WindowField";

// Start a session for this course and jump straight to its live screen.
// If a session is already active we resume it instead of opening a second
// one — a course can only have one live session at a time (and the partial
// unique index on shortCode assumes as much).
async function startSession(courseId: string, formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("not_found");

  const isOwner = course.lecturerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) throw new Error("forbidden");

  const existing = await db.session.findFirst({
    where: { courseId, active: true },
    select: { id: true },
  });

  let targetId: string;
  if (existing) {
    // A session is already live — resume it; don't change its window.
    targetId = existing.id;
  } else {
    // Attendance window. The form sends a raw number plus a unit ("seconds"
    // or "minutes"); we convert to seconds here and validate against the
    // unit's bounds. Anything missing, non-numeric, or out of range falls
    // back to 900s (15 min) rather than failing the session start.
    //   seconds: 30 ≤ value ≤ 120
    //   minutes: 1 ≤ value ≤ 180  (→ 60 ≤ windowSeconds ≤ 10800)
    const unit = formData.get("windowUnit") === "seconds" ? "seconds" : "minutes";
    const raw = Math.round(Number(formData.get("windowValue")));
    let windowSeconds: number;
    if (unit === "seconds") {
      windowSeconds = Number.isFinite(raw) && raw >= 30 && raw <= 120 ? raw : 900;
    } else {
      windowSeconds = Number.isFinite(raw) && raw >= 1 && raw <= 180 ? raw * 60 : 900;
    }
    const startedAt = new Date();
    const acceptingUntil = new Date(startedAt.getTime() + windowSeconds * 1000);

    const created = await db.session.create({
      data: {
        courseId,
        secret: generateSessionSecret(),
        shortCode: await generateShortCode(db),
        startedAt,
        windowSeconds,
        acceptingUntil,
      },
      select: { id: true },
    });
    targetId = created.id;
  }

  revalidatePath(`/lecturer/courses/${courseId}`);
  redirect(`/lecturer/sessions/${targetId}`); // throws — must stay outside try/catch
}

export default async function LecturerCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: { student: true },
        orderBy: { student: { name: "asc" } },
      },
      sessions: {
        orderBy: { startedAt: "desc" },
        include: { _count: { select: { attendances: true } } },
      },
    },
  });
  if (!course) return notFound();

  // A lecturer may only open their own course; admins may view any.
  const isOwner = course.lecturerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) return notFound();

  const liveSession = course.sessions.find((s) => s.active);
  const startBound = startSession.bind(null, course.id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/lecturer"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to my courses
        </Link>
        <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-700 ring-1 ring-brand-100">{course.code}</span>
        <h1 className="page-title mt-1.5">{course.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {course.enrollments.length} enrolled · {course.sessions.length} session{course.sessions.length === 1 ? "" : "s"} held
        </p>
      </div>

      {/* Start / resume session — the primary action on this page. */}
      <div className="card p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 className="font-semibold text-slate-900">
            {liveSession ? "A session is live right now" : "Take attendance"}
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            {liveSession
              ? "Resume the live screen to show the rotating QR and watch students check in."
              : "Start a session to display a rotating QR code and short code students scan or type to mark themselves present."}
          </p>
        </div>
        {liveSession ? (
          <Link
            href={`/lecturer/sessions/${liveSession.id}`}
            className="btn-primary mt-4 sm:mt-0 shrink-0"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Resume live session
          </Link>
        ) : (
          <form action={startBound} className="mt-4 flex items-end gap-3 sm:mt-0 sm:shrink-0">
            <WindowField />
            <button type="submit" className="btn-primary">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-14 9V3z" /></svg>
              Start session
            </button>
          </form>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Enrolled students */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">
              Enrolled students <span className="text-slate-400 font-normal">({course.enrollments.length})</span>
            </h2>
            <Link
              href={`/lecturer/courses/${course.id}/students`}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Manage
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </Link>
          </div>
          {course.enrollments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No students enrolled yet.{" "}
              <Link href={`/lecturer/courses/${course.id}/students`} className="font-medium text-brand-600 hover:text-brand-700">
                Add students
              </Link>{" "}
              to start tracking attendance.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto -mx-2">
              {course.enrollments.map((e) => (
                <li key={e.studentId} className="py-2.5 px-2 flex items-center gap-3 text-sm">
                  <span className="grid place-items-center h-8 w-8 shrink-0 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold ring-1 ring-slate-200">
                    {e.student.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 truncate">{e.student.name}</span>
                    <span className="block text-xs text-slate-500 truncate">{e.student.matricNumber}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Session history */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Session history</h2>
          {course.sessions.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No sessions yet. Start one above.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {course.sessions.map((s) => (
                <li key={s.id} className="py-3">
                  <Link
                    href={`/lecturer/sessions/${s.id}`}
                    className="flex items-center justify-between gap-3 text-sm group"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-900">
                        {s.startedAt.toLocaleDateString()} · {s.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="block text-xs text-slate-500 tabular-nums">
                        {s._count.attendances} present
                      </span>
                    </span>
                    <span className={`badge shrink-0 ${s.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {s.active && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                      {s.active ? "Live" : "Ended"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
