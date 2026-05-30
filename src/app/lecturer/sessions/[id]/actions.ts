"use server";

// Server actions for the live-session screen. Split out so the client
// component (<LiveSession />) can import them without pulling server-only
// modules into the bundle.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function endSessionAction(sessionId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");

  const ls = await db.session.findUnique({
    where: { id: sessionId },
    include: { course: true },
  });
  if (!ls) throw new Error("not_found");

  const isOwner = ls.course.lecturerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) throw new Error("forbidden");

  await db.session.update({
    where: { id: sessionId },
    data: { active: false, endedAt: new Date() },
  });
}
