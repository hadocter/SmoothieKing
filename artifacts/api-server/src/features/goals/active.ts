import { and, desc, eq } from "drizzle-orm";
import { db, goalPeriodsTable } from "@workspace/db";
import { goalEndsAt, goalHasEnded } from "./goals.ts";

/**
 * Return the current goal only while its promised period is still running.
 *
 * Expiry is settled at the read boundary so every feature that asks for an
 * active goal agrees: the dashboard, shelf and generator cannot each invent a
 * different extra week. The stored end is the deadline itself, not the time a
 * person happened to return to the app.
 */
export async function activeGoalPeriod(userId: number) {
  const [period] = await db
    .select()
    .from(goalPeriodsTable)
    .where(and(eq(goalPeriodsTable.userId, userId), eq(goalPeriodsTable.active, true)))
    .orderBy(desc(goalPeriodsTable.startedAt))
    .limit(1);

  if (!period || !goalHasEnded(period.startedAt, period.weeks)) return period;

  await db
    .update(goalPeriodsTable)
    .set({ active: false, endedAt: goalEndsAt(period.startedAt, period.weeks) })
    .where(and(eq(goalPeriodsTable.id, period.id), eq(goalPeriodsTable.active, true)));

  return undefined;
}
