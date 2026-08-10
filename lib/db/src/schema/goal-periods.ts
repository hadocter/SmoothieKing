import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * A goal, and the stretch of time someone is pursuing it for.
 *
 * It used to be a column on the profile, alongside height and allergies. That
 * put it in the wrong category: height is a fact about a person and "eight
 * weeks of working on gut health" is something they are currently doing. A
 * profile field has no beginning, no end and no history, so there was nowhere
 * to say when a goal started, nothing to count down, and no record of what
 * someone was working on last spring.
 *
 * Rows are kept after they end. The point of committing to something for eight
 * weeks is being able to look back at the eight weeks, and deleting the row on
 * expiry would delete exactly that.
 */
export const goalPeriodsTable = pgTable("goal_periods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),

  /** One of the eight goal ids. The one the build is shaped around. */
  goal: text("goal").notNull(),

  /**
   * Up to two more, in the order they were ranked.
   *
   * A person rarely wants exactly one thing — "in shape for summer" is protein
   * and skin at once — and the old shape forced that into a single choice,
   * silently discarding whichever they picked first.
   *
   * Two, not more, and ordered. The builder scores the main goal at three
   * points against each sub-goal's one, so a third sub-goal would let them
   * outvote it and the drink would stop being about what the person came for.
   * Order is kept because it is what they said, even though the scoring
   * currently weights both sub-goals equally — recording a ranking we do not
   * yet use is cheaper than asking for it again later.
   */
  subGoals: text("sub_goals").array().notNull().default([]),

  /**
   * What the user actually said they were after, in their own words.
   *
   * The eight goals are a vocabulary the system can compute with; "I keep
   * crashing at 3pm and can't focus in meetings" is what the person came here
   * about. Storing only the category throws away everything that made their
   * answer theirs, and then every screen has to address them in a taxonomy
   * they never used.
   *
   * Null when they simply tapped a card, which is a real and common way to
   * answer. Nothing infers a narrative that was not written — a sentence put
   * in someone's mouth reads far worse than no sentence at all.
   */
  narrative: text("narrative"),

  /**
   * What they are preparing for, if they named one — "a wedding", "a marathon".
   *
   * Distinct from the goal and from the narrative. The goal is what the drinks
   * are built for, the narrative is everything they said, and this is the one
   * phrase worth putting in a sentence: "For your wedding, 32 days to go"
   * reads as an app that listened. Showing the whole sentence back verbatim
   * reads as a form echoing its own input.
   *
   * Null when they named nothing, which is most of the time. Nothing infers
   * one — a made-up occasion is a stranger telling you why you are here.
   */
  occasion: text("occasion"),

  /**
   * How long they committed to. Weeks rather than an end date, because that is
   * the unit the choice is made in — nobody picks the 14th of March, they pick
   * "about two months".
   */
  weeks: integer("weeks").notNull(),

  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),

  /**
   * Set when a period is ended early or replaced. Null while running.
   *
   * Separate from `startedAt + weeks` passing, which is a period that finished
   * as intended. Both stop being current; only one of them is abandonment, and
   * flattening the two would lose which happened.
   */
  endedAt: timestamp("ended_at", { withTimezone: true }),

  /**
   * The one the app builds around right now.
   *
   * Denormalised on purpose. "The most recent row that has not expired" is
   * derivable but changes meaning at midnight without anything writing to the
   * database, and a recommendation flow that silently switches goals because a
   * clock ticked is worse than one that waits to be told.
   */
  active: boolean("active").notNull().default(true),
});

export const insertGoalPeriodSchema = createInsertSchema(goalPeriodsTable).omit({
  id: true,
  startedAt: true,
  endedAt: true,
});
export type InsertGoalPeriod = z.infer<typeof insertGoalPeriodSchema>;
export type GoalPeriod = typeof goalPeriodsTable.$inferSelect;
