// POST /api/attendance
//
// Called by a student's phone to mark themselves present at a live session.
// Two equivalent entry paths:
//
//   { token:     "<jwt>"   }   — scanned the rotating QR
//   { shortCode: "7K2P9M" }    — typed the lecturer's 6-char code
//
// The two branches differ only in HOW they resolve to a Session row.
// Everything downstream (active-check, enrollment-check, attendance insert,
// P2002 duplicate handling) is identical and lives in recordAttendance()
// so the two paths cannot drift apart.
//
// Flow:
//   1. Must be a logged-in STUDENT.
//   2. Parse the body — accept either shape.
//   3. Resolve to a lectureSession:
//        - token:     decode JWT for sid, look up by id, verify signature.
//        - shortCode: look up by (shortCode, active=true).
//   4. recordAttendance() handles the rest.

import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyQrToken } from "@/lib/qr-token";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const bodySchema = z.union([
  z.object({ token: z.string().min(10) }),
  z.object({ shortCode: z.string().length(6) }),
]);

type ResolvedSession = Prisma.SessionGetPayload<{ include: { course: true } }>;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "only_students_can_mark" },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // -------- Resolve to a Session via whichever path the client used --------
  let lectureSession: ResolvedSession;

  if ("token" in parsed.data) {
    const { token } = parsed.data;

    // Peek at the (unverified) payload just to learn which session it claims
    // to be for — we trust nothing here, we only need the sid to look up
    // the real signing secret.
    let claimedSid: string;
    try {
      const peek = decodeJwt(token) as { sid?: string };
      if (!peek.sid) throw new Error("missing_sid");
      claimedSid = peek.sid;
    } catch {
      return NextResponse.json({ error: "malformed_token" }, { status: 400 });
    }

    const found = await db.session.findUnique({
      where: { id: claimedSid },
      include: { course: true },
    });
    if (!found)
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    // Verify signature + expiry with the per-session secret. We do this
    // BEFORE the active check so a malformed/forged token doesn't get a
    // "session closed" hint about whether the session id actually existed.
    try {
      await verifyQrToken(token, found.secret);
    } catch {
      return NextResponse.json(
        { error: "invalid_or_expired_token" },
        { status: 401 },
      );
    }

    lectureSession = found;
  } else {
    // shortCode path. The partial unique index guarantees at most one row
    // matches, so findFirst with active=true is exactly what we want.
    const normalized = parsed.data.shortCode.toUpperCase();
    const found = await db.session.findFirst({
      where: { shortCode: normalized, active: true },
      include: { course: true },
    });
    if (!found) {
      return NextResponse.json(
        { error: "invalid_or_inactive_code" },
        { status: 404 },
      );
    }
    lectureSession = found;
  }

  // -------- Shared body: identical for both entry paths --------------------
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;

  return recordAttendance(lectureSession, session.user.id, ipAddress);
}

/**
 * Run the post-resolution validation + write. Returns the NextResponse
 * directly so the two branches above can `return recordAttendance(...)`.
 *
 * Steps:
 *   - session must still be active (covers the token-path race where a
 *     valid token arrives milliseconds after the lecturer ends the session)
 *   - student must be enrolled in the course
 *   - insert Attendance; P2002 on (sessionId, studentId) means
 *     "already marked" — return success with alreadyMarked=true.
 */
async function recordAttendance(
  lectureSession: ResolvedSession,
  studentId: string,
  ipAddress: string | null,
) {
  if (!lectureSession.active) {
    return NextResponse.json({ error: "session_closed" }, { status: 409 });
  }

  // Attendance window: the session can stay active indefinitely, but new
  // submissions are only accepted until `acceptingUntil`. Past that, refuse
  // with a distinct error and tell the client when the window closed so it can
  // show a helpful message. (Sessions with a null acceptingUntil have no limit.)
  if (lectureSession.acceptingUntil && Date.now() > lectureSession.acceptingUntil.getTime()) {
    return NextResponse.json(
      { error: "window_closed", acceptingUntil: lectureSession.acceptingUntil },
      { status: 409 },
    );
  }

  const enrolled = await db.enrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId,
        courseId: lectureSession.courseId,
      },
    },
  });
  if (!enrolled) {
    return NextResponse.json(
      { error: "not_enrolled_in_course" },
      { status: 403 },
    );
  }

  try {
    const att = await db.attendance.create({
      data: {
        sessionId: lectureSession.id,
        studentId,
        ipAddress,
      },
    });
    return NextResponse.json({
      ok: true,
      alreadyMarked: false,
      markedAt: att.markedAt,
      courseCode: lectureSession.course.code,
      courseTitle: lectureSession.course.title,
    });
  } catch (e) {
    // Unique violation on (sessionId, studentId) — student already marked.
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({
        ok: true,
        alreadyMarked: true,
        courseCode: lectureSession.course.code,
        courseTitle: lectureSession.course.title,
      });
    }
    throw e;
  }
}
