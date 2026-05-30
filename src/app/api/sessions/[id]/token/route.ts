// GET /api/sessions/:id/token
//
// Returns a freshly-signed rotating QR token for an active session.
// Called by the lecturer's session page every ~8 seconds.
//
// Authorization:
//   - Caller must be authenticated.
//   - Caller must be the lecturer who owns the course this session belongs
//     to, OR an admin. (Students never call this.)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { QR_ROTATION_MS, QR_TTL_MS, signQrToken } from "@/lib/qr-token";

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
  if (!lectureSession.active) return NextResponse.json({ error: "session_closed" }, { status: 409 });

  const isOwner = lectureSession.course.lecturerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const token = await signQrToken(lectureSession.id, lectureSession.secret);

  return NextResponse.json({
    token,
    rotateInMs: QR_ROTATION_MS,
    ttlMs: QR_TTL_MS,
  });
}
