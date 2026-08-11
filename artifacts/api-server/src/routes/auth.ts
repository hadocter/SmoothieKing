import { Router, type IRouter } from "express";
import { invalid } from "../lib/validation.ts";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import { hashPassword, verifyPassword, createToken } from "../lib/auth.ts";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.ts";
import { SignupBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

/** Emails are stored normalized so `Test@x.com` and `test@x.com` are the same account. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Postgres unique-violation. Two concurrent signups with the same email can both
 * pass the pre-check, so the DB constraint is the real guard — we translate it to 409.
 * Drizzle may wrap the driver error, so check `cause` as well.
 */
function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return code(err) === "23505" || code((err as { cause?: unknown })?.cause) === "23505";
}

function formatUserPublic(u: User) {
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    createdAt: u.createdAt.toISOString(),
  };
}

// POST /auth/signup
router.post("/auth/signup", async (req, res): Promise<void> => {
  try {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) {
      invalid(res, parsed.error);
      return;
    }

    const email = normalizeEmail(parsed.data.email);
    const { password, nickname } = parsed.data;

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash, nickname })
      .returning();

    if (!user) {
      res.status(500).json({ error: "Failed to create account" });
      return;
    }

    const token = createToken(user.id, user.email, user.nickname);

    res.status(201).json({
      user: formatUserPublic(user),
      token,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "Email already exists" });
      return;
    }
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      invalid(res, parsed.error);
      return;
    }

    const email = normalizeEmail(parsed.data.email);
    const { password } = parsed.data;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    // Same message for unknown email and wrong password, so the response
    // does not reveal whether an account exists.
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = createToken(user.id, user.email, user.nickname);

    res.json({
      user: formatUserPublic(user),
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(formatUserPublic(user));
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
