import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { recipesTable } from "./recipes";

/**
 * What someone actually drank, and when.
 *
 * Distinct from the recipes table, which records what was *built*. A batch
 * produces ten drinks and a person has one of them — treating generation as
 * consumption would say they drank ten smoothies before breakfast. Keeping
 * them apart is also what lets the same recipe be logged repeatedly, which is
 * the normal case for something you like.
 *
 * This is the history the feedback loop needs. Sweetness calibration works by
 * asking whether a specific glass was too sweet, and that question only has an
 * answer if there is a record of a specific glass having been drunk.
 */
export const smoothieLogsTable = pgTable("smoothie_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id),
  drankAt: timestamp("drank_at", { withTimezone: true }).notNull().defaultNow(),

  /**
   * How it landed: too-sweet | just-right | not-sweet-enough.
   *
   * Null until asked. Null and "just right" are different answers and are
   * stored differently — a system that reads silence as approval will keep
   * making a drink nobody said yes to.
   */
  sweetnessFeedback: text("sweetness_feedback"),
  /** Anything they wrote about it. Not interpreted, just kept. */
  note: text("note"),
});

export const insertSmoothieLogSchema = createInsertSchema(smoothieLogsTable).omit({
  id: true,
  drankAt: true,
});
export type InsertSmoothieLog = z.infer<typeof insertSmoothieLogSchema>;
export type SmoothieLog = typeof smoothieLogsTable.$inferSelect;
