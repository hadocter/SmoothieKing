import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { goalPeriodsTable } from "./goal-periods";

/**
 * A week's list, once someone has decided it should be theirs.
 *
 * The list is computed by default and nothing is written down — recomputing is
 * cheap, deterministic per week, and a stored list would raise the question of
 * what happens when the catalog changes underneath it.
 *
 * A row appears here only when the person overrode that: kept last week's,
 * asked for a fresh list around what they had left, or picked the ingredients
 * themselves. Those are decisions rather than derivations, and a decision that
 * cannot survive a page reload is not one the app really offered.
 */
export const shelfListsTable = pgTable(
  "shelf_lists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    goalPeriodId: integer("goal_period_id")
      .notNull()
      .references(() => goalPeriodsTable.id),
    weekIndex: integer("week_index").notNull(),

    /** Catalog names, in the order they should be shown. */
    ingredients: text("ingredients").array().notNull().default([]),

    /**
     * How this list came to be:
     *
     *   carried — last week's list, kept as it was
     *   rebuilt — computed fresh, with what was left over kept in
     *   manual  — chosen by hand
     *
     * Recorded because the three mean different things about the person, and
     * because a list nobody can explain the origin of is one nobody will trust
     * when it turns out to be wrong.
     */
    source: text("source").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    onePerWeek: unique("shelf_lists_one_per_week").on(t.userId, t.goalPeriodId, t.weekIndex),
  }),
);

export const insertShelfListSchema = createInsertSchema(shelfListsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertShelfList = z.infer<typeof insertShelfListSchema>;
export type ShelfList = typeof shelfListsTable.$inferSelect;
