// Public route: a freshly-created user lands here from the link the admin
// shared with them. The token is single-use, scoped to one userId, and
// expires 7 days after the admin created the account.
//
// Validation runs in two places:
//   - Server component (this file) — fetches the token, renders an error page
//     if it's missing / expired / already used. This avoids showing the form
//     at all for a dead link.
//   - Server action (activatePassword) — re-checks the token before writing
//     the password hash, because the form may sit open for a while and the
//     token state can change in the interim.
//
// Middleware allows this path through without an auth check (see
// middleware.ts public-route list).

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";
import { SetupPasswordForm } from "./SetupPasswordForm";

const passwordSchema = z.object({
  password: z.string().min(8),
  confirm: z.string().min(8),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match." });

export default async function SetupPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const record = await db.passwordSetupToken.findUnique({
    where: { token },
    include: { user: true },
  });

  const isInvalid =
    !record || record.usedAt !== null || record.expiresAt < new Date();

  if (isInvalid) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card w-full max-w-sm p-6 space-y-3">
          <h1 className="text-xl font-bold text-red-600">Setup link invalid</h1>
          <p className="text-sm text-slate-700">
            This setup link is invalid or has expired. Please contact your admin
            for a new one.
          </p>
        </div>
      </main>
    );
  }

  async function activatePassword(formData: FormData): Promise<{ error: string } | void> {
    "use server";

    const parsed = passwordSchema.safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    // Re-validate the token at submit time — it could have been used or
    // expired between page load and submit.
    const current = await db.passwordSetupToken.findUnique({ where: { token } });
    if (!current || current.usedAt !== null || current.expiresAt < new Date()) {
      return { error: "This setup link is no longer valid. Please contact your admin." };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    // Atomic-ish: update user + mark token used in one transaction so a
    // crash mid-way can't leave the token marked-used while the password
    // failed to write (or vice versa).
    await db.$transaction([
      db.user.update({
        where: { id: current.userId },
        data: { passwordHash },
      }),
      db.passwordSetupToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    redirect("/login?activated=1");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <SetupPasswordForm action={activatePassword} userName={record.user.name} />
    </main>
  );
}
