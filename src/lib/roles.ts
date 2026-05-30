// SQLite doesn't support Prisma enums, so `User.role` is stored as a String.
// This module gives us the type-level safety the enum would have given us.

export type Role = "ADMIN" | "LECTURER" | "STUDENT";

export const ROLES = ["ADMIN", "LECTURER", "STUDENT"] as const;
