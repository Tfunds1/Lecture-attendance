// Admin /users — list everyone and add new lecturers or students.
//
// Account activation flow:
//   1. Admin fills the form (no password field — passwords are user-chosen).
//   2. createUser() creates a User with passwordHash = null and a single-use
//      PasswordSetupToken valid for 7 days.
//   3. We redirect back here with the setup URL in a query param so the page
//      can render a confirmation card + copy-to-clipboard button.
//   4. The user opens that link, picks a password, and is sent to /login.

import { randomBytes } from "crypto";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/roles";
import { sendPasswordSetupEmail } from "@/lib/email";
import { SlideOver } from "@/components/SlideOver";
import { Dialog } from "@/components/Dialog";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/admin/PageHeader";
import { SetupLinkCard } from "./SetupLinkCard";
import { AddUserForm } from "./AddUserForm";
import { UsersTable, type UserRowVM } from "./UsersTable";
import { BulkImportCard, type ImportState } from "./BulkImportCard";
import { buildPreview, userRowSchema } from "./import-shared";

async function createUser(formData: FormData) {
  "use server";
  const parsed = userRowSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    identifier: formData.get("identifier"),
  });
  if (!parsed.success)
    throw new Error("Invalid input: " + parsed.error.message);

  const { name, email, role, identifier } = parsed.data;

  const newUser = await db.user.create({
    data: {
      name,
      email,
      role,
      matricNumber: role === "STUDENT" ? identifier : null,
      staffId: role === "LECTURER" ? identifier : null,
    },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await db.passwordSetupToken.create({
    data: { userId: newUser.id, token, expiresAt },
  });

  // Build an absolute URL using the current request's host so the link works
  // whether the admin is on localhost, a LAN IP, or a deployed domain.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const setupUrl = `${proto}://${host}/setup-password/${token}`;

  // Best-effort: also email the setup link to the user so the admin doesn't
  // have to copy-paste it. A failure here must NOT block account creation —
  // the user already exists and the admin still gets the link on screen — so
  // we only log the outcome and carry an emailSent flag through to the UI.
  const emailResult = await sendPasswordSetupEmail({
    to: newUser.email,
    name: newUser.name,
    setupUrl,
  });
  if (emailResult.ok) {
    console.log(`[email] sent password setup email to ${newUser.email}`);
  } else {
    console.error(
      `[email] failed to send to ${newUser.email}: ${emailResult.error}`,
    );
  }

  revalidatePath("/admin/users");
  redirect(
    `/admin/users?createdName=${encodeURIComponent(name)}` +
      `&createdEmail=${encodeURIComponent(email)}` +
      `&setupUrl=${encodeURIComponent(setupUrl)}` +
      `&emailSent=${emailResult.ok ? "1" : "0"}`,
  );
}

async function deleteUser(formData: FormData) {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("Missing user id");

  // Guard: never let an admin delete the account they're currently signed in
  // as — that would invalidate their own session mid-request.
  const session = await auth();
  if (session?.user?.id === id) {
    redirect(
      "/admin/users?error=" +
        encodeURIComponent("You can't delete the account you're signed in as."),
    );
  }

  // We need the role + course count to decide whether the delete is safe.
  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { coursesTaught: true } } },
  });
  if (!user) {
    redirect(
      "/admin/users?error=" + encodeURIComponent("That user no longer exists."),
    );
  }

  if (user.role === "ADMIN") {
    redirect(
      "/admin/users?error=" +
        encodeURIComponent("Admin accounts can't be deleted from this screen."),
    );
  }

  // A lecturer who owns courses can't be removed: Course.lecturer has no
  // cascade, so the DB would reject the delete with a raw FK error. Check up
  // front and explain what to do instead, rather than leaking that error.
  if (user._count.coursesTaught > 0) {
    redirect(
      "/admin/users?error=" +
        encodeURIComponent(
          `${user.name} still teaches ${user._count.coursesTaught} course(s). ` +
            "Reassign or delete those courses first.",
        ),
    );
  }

  // Cascades handle PasswordSetupToken, Enrollment, and Attendance, so a
  // plain delete is enough here.
  await db.user.delete({ where: { id } });

  revalidatePath("/admin/users");
  redirect("/admin/users?deletedName=" + encodeURIComponent(user.name));
}

async function bulkImportUsers(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  "use server";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose a CSV file.", created: [], skipped: [] };
  }

  // Re-run the SAME parse + validation the client used for its preview
  // (buildPreview lives in import-shared.ts). The client preview is only a
  // courtesy — this server-side pass is the authority, so a hand-crafted
  // request can't slip past validation.
  const preview = buildPreview(await file.text());
  if (!preview.ok) {
    return { ok: false, message: preview.message, created: [], skipped: [] };
  }

  // Build the absolute base URL once (same logic as the single-create flow).
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  const created: ImportState["created"] = [];
  const skipped: ImportState["skipped"] = [];

  for (const row of preview.rows) {
    // Rows the shared validator already rejected (bad email, dup-in-file, …)
    // are skipped with the reason it gave — no DB attempt.
    if (!row.valid) {
      skipped.push({
        row: row.rowNum,
        email: row.raw.email || "(blank)",
        reason: row.error,
      });
      continue;
    }

    const { name, email, role, identifier } = row.data;
    try {
      const newUser = await db.user.create({
        data: {
          name,
          email,
          role,
          matricNumber: role === "STUDENT" ? identifier : null,
          staffId: role === "LECTURER" ? identifier : null,
        },
      });

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.passwordSetupToken.create({
        data: { userId: newUser.id, token, expiresAt },
      });

      const setupUrl = `${proto}://${host}/setup-password/${token}`;
      const emailResult = await sendPasswordSetupEmail({ to: email, name, setupUrl });

      created.push({ name, email, setupUrl, emailSent: emailResult.ok });
    } catch (err) {
      // A duplicate email / matric / staff ID trips the unique constraint
      // (Prisma P2002). This is the clash the client preview can't see, since
      // it doesn't know what's already in the DB. Skip that row with a
      // readable reason instead of aborting the whole import.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = Array.isArray(err.meta?.target)
          ? (err.meta.target as string[]).join(", ")
          : String(err.meta?.target ?? "value");
        skipped.push({ row: row.rowNum, email, reason: `already exists (${target})` });
      } else {
        skipped.push({ row: row.rowNum, email, reason: "could not be created" });
      }
    }
  }

  if (created.length > 0) revalidatePath("/admin/users");
  return { ok: true, created, skipped };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    createdName?: string;
    createdEmail?: string;
    setupUrl?: string;
    emailSent?: string;
    deletedName?: string;
    error?: string;
    panel?: string;
  }>;
}) {
  const { createdName, createdEmail, setupUrl, emailSent, deletedName, error, panel } =
    await searchParams;

  const [session, rawUsers] = await Promise.all([
    auth(),
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
  ]);

  // Shape into a plain, secret-free view model for the client table. We never
  // ship passwordHash to the browser — "active" is derived from it here.
  const users: UserRowVM[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    identifier: u.matricNumber ?? u.staffId ?? null,
    active: u.passwordHash != null,
  }));

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.active).length;
  const pendingUsers = totalUsers - activeUsers;
  const userStats = [
    { label: "Total users", value: totalUsers },
    { label: "Active", value: activeUsers },
    { label: "Pending", value: pendingUsers },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Create, activate, and manage all users in the system."
        status
        actions={
          <>
            <Link href="/admin/users?panel=import" className="btn-ghost text-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Bulk upload
            </Link>
            <Link href="/admin/users?panel=new" className="btn-primary text-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add user
            </Link>
          </>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {userStats.map((s) => (
          <div key={s.label} className="rounded-lg bg-slate-50 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className="mt-1 text-xl font-medium tabular-nums text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Status banners — dismiss by navigating back to the clean URL. */}
      {deletedName && (
        <StatusBanner tone="success" closeHref="/admin/users">
          Deleted <strong>{deletedName}</strong>. Their email is now free to reuse.
        </StatusBanner>
      )}
      {error && (
        <StatusBanner tone="error" closeHref="/admin/users">
          {error}
        </StatusBanner>
      )}
      {createdName && setupUrl && (
        <SetupLinkCard
          name={createdName}
          email={createdEmail ?? ""}
          setupUrl={setupUrl}
          emailSent={emailSent === "1"}
        />
      )}

      <UsersTable
        users={users}
        currentUserId={session?.user?.id}
        deleteUser={deleteUser}
      />

      {/* URL-driven slide-overs */}
      {panel === "new" && (
        <Dialog
          title="Add user"
          description="Create a lecturer or student account."
          closeHref="/admin/users"
        >
          <AddUserForm createUser={createUser} />
        </Dialog>
      )}
      {panel === "import" && (
        <SlideOver
          title="Import users from CSV"
          description="Create many accounts at once."
          closeHref="/admin/users"
        >
          <BulkImportCard action={bulkImportUsers} />
        </SlideOver>
      )}
    </div>
  );
}
