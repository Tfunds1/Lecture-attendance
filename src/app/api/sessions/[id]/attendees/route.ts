// GET /api/sessions/:id/attendees
//
// Returns the list of students who have marked attendance in this session,
// most recent first. Polled by the lecturer's live attendance panel.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const lectureSession = await db.session.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!lectureSession) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwner = lectureSession.course.lecturerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const attendees = await db.attendance.findMany({
    where: { sessionId: id },
    include: { student: { select: { name: true, matricNumber: true } } },
    orderBy: { markedAt: "desc" },
  });

  return NextResponse.json({
    sessionActive: lectureSession.active,
    attendees: attendees.map((a) => ({
      id: a.id,
      name: a.student.name,
      matricNumber: a.student.matricNumber,
      markedAt: a.markedAt,
    })),
  });
}
