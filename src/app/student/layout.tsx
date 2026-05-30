import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

const NAV = [
  { href: "/student",        label: "My Courses" },
  { href: "/student/scan",   label: "Scan QR" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <AppShell name={session.user.name ?? ""} role={session.user.role} nav={NAV}>
      {children}
    </AppShell>
  );
}
