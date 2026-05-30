// Edge middleware: every request hits this before the page renders.
//
// Responsibilities:
//   1. Redirect unauthenticated users to /login
//   2. Route-prefix authorization: /admin/* needs ADMIN, /lecturer/* needs
//      LECTURER, /student/* needs STUDENT.
//   3. After login, send users to their role's dashboard (so a student
//      cannot land on /admin even by typing it).
//
// We use the edge-safe `authConfig` import here, not the full auth.ts —
// that's why the config is split.

import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const ROLE_HOMES = {
  ADMIN: "/admin",
  LECTURER: "/lecturer",
  STUDENT: "/student",
} as const;

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const pathname = nextUrl.pathname;

  const isAuthRoute = pathname === "/login";
  // /forgot-password is public: a user who can't sign in needs to reach it
  // precisely because they have no working session.
  const isForgotRoute = pathname === "/forgot-password";
  // /setup-password/<token> is public: a freshly-created user (or someone
  // following a reset link) follows it before they have credentials, so
  // middleware must let them through.
  const isSetupPasswordRoute = pathname.startsWith("/setup-password/");
  const isPublicRoute =
    pathname === "/" || isAuthRoute || isForgotRoute || isSetupPasswordRoute;
  const isApiAuthRoute = pathname.startsWith("/api/auth");

  if (isApiAuthRoute) return NextResponse.next();

  // Unauthenticated visitors only get the landing page and /login.
  if (!session?.user) {
    if (isPublicRoute) return NextResponse.next();
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;
  const home = ROLE_HOMES[role];

  // If we somehow have a session but no role (stale cookie, bad token),
  // force a fresh login instead of redirecting to /undefined.
  if (!home) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in but visiting a pre-auth page (/login, /forgot-password,
  // or /) -> bounce to their role home.
  if (isAuthRoute || isForgotRoute || pathname === "/") {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  // Role-prefix enforcement.
  if (pathname.startsWith("/admin") && role !== "ADMIN")
    return NextResponse.redirect(new URL(home, nextUrl));
  if (pathname.startsWith("/lecturer") && role !== "LECTURER")
    return NextResponse.redirect(new URL(home, nextUrl));
  if (pathname.startsWith("/student") && role !== "STUDENT")
    return NextResponse.redirect(new URL(home, nextUrl));

  return NextResponse.next();
});

// Run middleware on everything except Next.js internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
