// Auth.js v5 config — edge-safe portion.
//
// Auth.js splits config into two files: this one contains only what the
// middleware (which runs on the edge runtime) needs, so it must not import
// anything Node-specific (bcrypt, Prisma client, etc). The full config
// lives in src/lib/auth.ts and imports this.

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/roles";

export const authConfig = {
  pages: { signIn: "/login" },
  providers: [], // filled in auth.ts
  callbacks: {
    // Runs whenever a JWT is created or updated.
    // `user` is only present right after a successful sign-in — that's when
    // we copy the id and role from the DB user onto the token.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        // Persist the "remember me" choice on the token so the JWT encoder
        // (in auth.ts) can pick the right lifetime on every re-issue.
        token.rememberMe = (user as { rememberMe?: boolean }).rememberMe ?? false;
      }
      return token;
    },

    // Runs whenever a session is read on the server.
    // We project id and role from the token onto session.user so pages,
    // server actions, and middleware can all read them.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
