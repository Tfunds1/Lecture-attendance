import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

const NAV = [
  { href: "/lecturer", label: "My Courses" },
];

export default async function LecturerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <AppShell name={session.user.name ?? ""} role={session.user.role} nav={NAV}>
      {children}
    </AppShell>
  );
}
