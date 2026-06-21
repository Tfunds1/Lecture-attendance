-- Replace the minutes-based attendance window with a seconds-based one so a
-- lecturer can choose either a short (seconds) or long (minutes) window.

-- 1. Add the new column with the equivalent default (900s = 15 min).
ALTER TABLE "Session" ADD COLUMN "windowSeconds" INTEGER NOT NULL DEFAULT 900;

-- 2. Carry existing windows over: minutes -> seconds.
UPDATE "Session" SET "windowSeconds" = "windowMinutes" * 60;

-- 3. Drop the old column.
ALTER TABLE "Session" DROP COLUMN "windowMinutes";
