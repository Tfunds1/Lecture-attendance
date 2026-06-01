import { auth, signOut } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/Shell";

const NAV: NavItem[] = [
  { href: "/student", label: "My Courses", icon: "courses" },
  { href: "/student/scan", label: "Scan QR", icon: "scan" },
  { href: "/student/code", label: "Enter code", icon: "code" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;

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
