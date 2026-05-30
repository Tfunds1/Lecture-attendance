// Auth.js v5 - full server-side config.
//
// Credentials provider with bcrypt verification against the User table.
// JWT-based sessions (no DB session table needed) — keeps things simple and
// means the session cookie is self-contained.
//
// The session token carries `role` so middleware and pages can authorize
// without an extra DB lookup on every request.

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { encode as defaultJwtEncode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import type { Role } from "@/lib/roles";

// Two session lifetimes, picked per-login by the "Remember me" checkbox.
// REMEMBER is the cookie/session ceiling; SESSION is a shorter rolling window
// for users who didn't ask to be remembered (e.g. on a shared computer).
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SESSION_MAX_AGE = 24 * 60 * 60; // 1 day

// Augment the Session type so TS knows session.user.role exists everywhere.
// (We don't augment the JWT module — instead we cast inside the jwt callback
// below, which keeps this file decoupled from Auth.js's internal modules.)
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
  interface User {
    role: Role;
    // Carried from authorize() to the jwt callback so the encoder below can
    // pick the right token lifetime. Not persisted on the DB user.
    rememberMe?: boolean;
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Custom error class so the login page can show a specific "not activated"
// message instead of the generic "invalid email or password" fallback.
// Auth.js v5 surfaces this via err.code (which we read on the client by
// parsing the error in the signIn() response).
class NotActivatedError extends CredentialsSignin {
  code = "NotActivated";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Ceiling for the session cookie's lifetime. The actual token expiry is
  // chosen per-login by the encoder below (30 days vs 1 day).
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE },
  jwt: {
    // Auth.js writes the session cookie's Max-Age from session.maxAge (a static
    // config value), so per-login "remember me" can't be done from the cookie
    // alone. Instead we vary the JWT's own expiry: we wrap the default encoder
    // and shorten maxAge when the user didn't tick "remember me". An expired
    // token is rejected on decode (middleware then redirects to /login), so the
    // session effectively ends even though the cookie itself may linger.
    encode(params) {
      const remembered = (params.token as { rememberMe?: boolean } | undefined)
        ?.rememberMe;
      return defaultJwtEncode({
        ...params,
        maxAge: remembered ? REMEMBER_MAX_AGE : SESSION_MAX_AGE,
      });
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        // Account hasn't been activated — admin created it but the user
        // never used their setup link. Surface a distinct error so the login
        // page can tell them what to do.
        if (user.passwordHash === null) throw new NotActivatedError();

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          // The login form sends "1" when "Remember me" is ticked. This flows
          // into the jwt callback and then the encoder above.
          rememberMe: credentials.rememberMe === "1",
        };
      },
    }),
  ],
  // jwt + session callbacks live in auth.config.ts so the edge middleware
  // build sees them too — otherwise middleware reads session.user.role as
  // undefined and redirects to /undefined.
});
