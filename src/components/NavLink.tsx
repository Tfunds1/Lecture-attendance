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
        "relative rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "font-semibold text-slate-900 bg-slate-100"
          : "font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
