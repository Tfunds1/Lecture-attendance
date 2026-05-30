// Lecturer's live session screen — the centerpiece of the system.
//
// Server component does the auth + ownership check and renders the static
// frame. Inside it mounts a client component (<LiveSession />) that handles
// the rotating QR, the live attendance list polling, and the end-session
// button.

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LiveSession } from "./LiveSession";

export default async function LiveSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;

  const ls = await db.session.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!ls) return notFound();
  if (ls.course.lecturerId !== session.user.id) return notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/lecturer/courses/${ls.courseId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to course
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-700 ring-1 ring-brand-100">{ls.course.code}</span>
        </div>
        <h1 className="page-title mt-1.5">{ls.course.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Session started {ls.startedAt.toLocaleString()}
        </p>
      </div>

      <LiveSession
        sessionId={ls.id}
        initiallyActive={ls.active}
        courseCode={ls.course.code}
        shortCode={ls.shortCode}
      />
    </div>
  );
}
