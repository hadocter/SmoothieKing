import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { goalPeriodsTable } from "./goal-periods";

/**
 * What someone said about one ingredient, for one week.
 *
 * A shelf is a week, not a possession. Storing "the ingredients this person
 * owns" as a standing list would be wrong within days: fruit is gone, the milk
 * ran out, and a build constrained by a stale list produces drinks that cannot
 * be made. So the mark is scoped to a week of a goal period, and next week
 * starts blank rather than inheriting a claim nobody re-checked.
 *
 * Rows are kept after the week passes. Which weeks someone actually shopped
 * for is the only signal we will have about whether the list was any use, and
 * deleting it on rollover would delete exactly that.
 */
export const shelfMarksTable = pgTable(
  "shelf_marks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),

    /** Which goal this week belongs to. A new goal starts a new shelf. */
    goalPeriodId: integer("goal_period_id")
      .notNull()
      .references(() => goalPeriodsTable.id),

    /** 1-based, counted from the period's start. Week 1 is days 1–7. */
    weekIndex: integer("week_index").notNull(),

    /** Catalog ingredient name, stored as written in the catalog. */
    ingredient: text("ingredient").notNull(),

    /**
     * One of three, and they are genuinely three.
     *
     *   have    — it is in the kitchen now
     *   buying  — it is not, and they intend to get it
     *   skipping— it is not, and they are not going to
     *
     * Collapsing the last two into "missing" would lose the only distinction
     * that changes what we do: something being bought should still be built
     * with, and something refused should be built around. The middle state is
     * also the one worth showing back as a list to take to a shop.
     */
    state: text("state").notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One mark per ingredient per week. Marking again is a change of mind, not
    // a second opinion.
    oncePerWeek: unique("shelf_marks_once_per_week").on(
      t.userId,
      t.goalPeriodId,
      t.weekIndex,
      t.ingredient,
    ),
  }),
);

export const insertShelfMarkSchema = createInsertSchema(shelfMarksTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertShelfMark = z.infer<typeof insertShelfMarkSchema>;
export type ShelfMark = typeof shelfMarksTable.$inferSelect;
