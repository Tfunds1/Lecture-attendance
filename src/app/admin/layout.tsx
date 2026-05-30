// Admin layout: wraps every /admin/* page with the AppShell. Middleware has
// already guaranteed the user is an ADMIN, so we just need to fetch their
// name + role for the header.

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

const NAV = [
  { href: "/admin",          label: "Dashboard" },
  { href: "/admin/users",    label: "Users" },
  { href: "/admin/courses",  label: "Courses" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null; // middleware should prevent this

  return (
    <AppShell name={session.user.name ?? ""} role={session.user.role} nav={NAV}>
      {children}
    </AppShell>
  );
}
