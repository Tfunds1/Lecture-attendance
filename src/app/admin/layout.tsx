// Admin layout: wraps every /admin/* page in the shared sidebar shell.
// Middleware has already guaranteed the user is an ADMIN.

import { auth, signOut } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/Shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/courses", label: "Courses", icon: "courses" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null; // middleware should prevent this

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <Shell name={session.user.name ?? ""} role={session.user.role} nav={NAV} signOut={signOutAction}>
      {children}
    </Shell>
  );
}
