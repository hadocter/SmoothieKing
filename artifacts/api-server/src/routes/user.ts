import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, type UserProfile } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.ts";
import { SubmitOnboardingBody } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Foreign-key violation on user_id: the token is validly signed but points at a
 * user row that no longer exists (e.g. a token issued before the DB migration).
 * Treat it as "log in again" rather than a server error.
 */
function isForeignKeyViolation(err: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return code(err) === "23503" || code((err as { cause?: unknown })?.cause) === "23503";
}

function formatProfile(p: UserProfile) {
  return {
    id: p.id,
    userId: p.userId,
    gender: p.gender,
    age: p.age,
    height: p.height,
    weight: p.weight,
    activityLevel: p.activityLevel,
    allergies: p.allergies,
    dislikedIngredients: p.dislikedIngredients,
    primaryGoal: p.primaryGoal,
    secondaryGoals: p.secondaryGoals,
    tastePreference: p.tastePreference,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// POST /user/onboarding — create or overwrite the caller's profile.
// user_profiles.user_id is unique, so a single upsert covers both cases.
router.post("/user/onboarding", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const parsed = SubmitOnboardingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = req.user!.userId;

    const [profile] = await db
      .insert(userProfilesTable)
      .values({ userId, ...parsed.data })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();

    if (!profile) {
      res.status(500).json({ error: "Failed to save profile" });
      return;
    }

    res.json(formatProfile(profile));
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      res.status(401).json({ error: "Session is no longer valid. Please log in again." });
      return;
    }
    console.error("Onboarding error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /user/profile
router.get("/user/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user!.userId))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json(formatProfile(profile));
  } catch (err) {
    console.error("GetProfile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /user/profile — partial update; fields omitted from the body keep their stored value.
router.put("/user/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const parsed = SubmitOnboardingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [updated] = await db
      .update(userProfilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, req.user!.userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json(formatProfile(updated));
  } catch (err) {
    console.error("UpdateProfile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
