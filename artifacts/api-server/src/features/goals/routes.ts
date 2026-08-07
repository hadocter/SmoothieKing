import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, goalPeriodsTable, userProfilesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middlewares/auth.ts";
import {
  GOAL_COPY,
  GOAL_LIST,
  GOAL_WEEKS,
  CLAIM_DISCLAIMER,
  daysElapsed,
  daysRemaining,
  isGoal,
  isGoalWeeks,
} from "./goals.ts";

const router: IRouter = Router();

/**
 * The goal catalog, with the copy shown under each card.
 *
 * Public and unauthenticated: it is the same for everyone, and the signup
 * screen needs it before an account exists.
 */
router.get("/goals/catalog", async (_req, res): Promise<void> => {
  res.json({ goals: GOAL_LIST, weeks: GOAL_WEEKS, disclaimer: CLAIM_DISCLAIMER });
});

function present(period: typeof goalPeriodsTable.$inferSelect) {
  return {
    ...period,
    copy: GOAL_COPY[period.goal as keyof typeof GOAL_COPY] ?? null,
    daysElapsed: daysElapsed(period.startedAt),
    daysRemaining: daysRemaining(period.startedAt, period.weeks),
  };
}

/**
 * The goal currently being built around, or null.
 *
 * Null rather than 404: having no goal yet is an ordinary state for a new
 * account, not a missing resource, and the screens that call this need to tell
 * the two apart from a network failure.
 */
router.get("/goals/active", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [period] = await db
    .select()
    .from(goalPeriodsTable)
    .where(and(eq(goalPeriodsTable.userId, req.user!.userId), eq(goalPeriodsTable.active, true)))
    .orderBy(desc(goalPeriodsTable.startedAt))
    .limit(1);

  res.json(period ? present(period) : null);
});

/** Everything they have worked on, current first. The looking-back view. */
router.get("/goals/history", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const rows = await db
    .select()
    .from(goalPeriodsTable)
    .where(eq(goalPeriodsTable.userId, req.user!.userId))
    .orderBy(desc(goalPeriodsTable.startedAt));

  res.json(rows.map(present));
});

/**
 * Start a goal period.
 *
 *   POST /api/goals  { goal, weeks }
 *
 * Starting a new one closes the previous one rather than leaving two active.
 * The old row stays — it is what someone was working on, and the point of
 * committing for eight weeks is being able to look back at them.
 */
router.post("/goals", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (!isGoal(body.goal)) {
    res.status(400).json({ error: `goal must be one of: ${GOAL_LIST.map((g) => g.id).join(", ")}` });
    return;
  }
  if (!isGoalWeeks(body.weeks)) {
    res.status(400).json({ error: `weeks must be one of: ${GOAL_WEEKS.join(", ")}` });
    return;
  }

  // Closed as replaced, which `endedAt` records. A period that simply ran out
  // of time is a different thing and is not marked here.
  await db
    .update(goalPeriodsTable)
    .set({ active: false, endedAt: new Date() })
    .where(and(eq(goalPeriodsTable.userId, req.user!.userId), eq(goalPeriodsTable.active, true)));

  // Kept verbatim and capped, never parsed. Its only job is to be shown back.
  const narrative =
    typeof body.narrative === "string" && body.narrative.trim()
      ? body.narrative.trim().slice(0, 300)
      : null;

  const occasion =
    typeof body.occasion === "string" && body.occasion.trim()
      ? body.occasion.trim().slice(0, 40)
      : null;

  const [created] = await db
    .insert(goalPeriodsTable)
    .values({ userId: req.user!.userId, goal: body.goal, weeks: body.weeks, narrative, occasion, active: true })
    .returning();

  // The profile keeps a `primaryGoal` column that several readers still use.
  // It is a mirror now, not a source: this feature is its only writer, so the
  // two cannot drift the way they would if onboarding also set it.
  await db
    .update(userProfilesTable)
    .set({ primaryGoal: body.goal })
    .where(eq(userProfilesTable.userId, req.user!.userId));

  res.status(201).json(present(created));
});

/** End the current period without starting another. */
router.post("/goals/end", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [ended] = await db
    .update(goalPeriodsTable)
    .set({ active: false, endedAt: new Date() })
    .where(and(eq(goalPeriodsTable.userId, req.user!.userId), eq(goalPeriodsTable.active, true)))
    .returning();

  if (!ended) {
    res.status(404).json({ error: "No active goal" });
    return;
  }

  res.json(present(ended));
});

export default router;
