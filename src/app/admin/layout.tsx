// Admin layout: wraps every /admin/* page in the sidebar shell. Middleware has
// already guaranteed the user is an ADMIN, so we just fetch their name + role
// for the sidebar and pass a sign-out server action down to it.

import { auth, signOut } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null; // middleware should prevent this

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AdminShell
      name={session.user.name ?? ""}
      role={session.user.role}
      signOut={signOutAction}
    >
      {children}
    </AdminShell>
  );
}
