"use client";

// Nav item with active-state highlighting. Split out as a client component
// because the surrounding AppShell is a server component and active styling
// needs the current pathname.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();

  // Home items ("/admin", "/student", …) are two segments and match exactly;
  // deeper items ("/admin/users") also light up on their detail pages.
  const isHome = href.split("/").filter(Boolean).length <= 1;
  const active = isHome ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "text-brand-700 bg-brand-50"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
