// Constants shared between the server-only generator (./short-code.ts)
// and client components that need to render or validate the same alphabet.
// Kept in its own file so importing the constants from a client component
// does NOT pull `node:crypto` / `@prisma/client` into the browser bundle.

export const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const SHORT_CODE_LENGTH = 6;
