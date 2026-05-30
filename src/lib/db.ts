// Single shared Prisma client instance.
//
// Next.js hot-reloads modules in dev, which would otherwise create a new
// PrismaClient on every reload and exhaust DB connections. The global cache
// trick is the standard Prisma + Next.js workaround.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
