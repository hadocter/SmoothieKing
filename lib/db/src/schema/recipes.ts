import { pgTable, text, serial, integer, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(), // smoothie | shaker | meal
  tagline: text("tagline").notNull(),
  description: text("description"),
  prepTimeMinutes: integer("prep_time_minutes").notNull(),
  servings: integer("servings").notNull().default(1),
  calories: integer("calories"),
  protein: real("protein"),
  benefits: text("benefits").array().notNull().default([]),
  skinBenefitScore: integer("skin_benefit_score"),
  ingredients: jsonb("ingredients").notNull().default([]),
  steps: text("steps").array().notNull().default([]),
  imageUrl: text("image_url").notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  difficulty: text("difficulty"), // easy | medium | advanced
  tags: text("tags").array().notNull().default([]),

  /* ---- goal matching ---- */

  /**
   * Fit against every goal, 0..1, computed by running the build backwards over
   * the recipe's ingredients. See `scoring.ts` in the API server for how, and
   * for why protein is measured differently from everything else.
   *
   * Distinct from `benefits`, which is what a human said the recipe is for.
   * Both are kept: `benefits` is editorial and drives copy, `goalScores` is
   * derived and drives ranking. Where they disagree the disagreement is worth
   * seeing rather than resolving silently.
   *
   * Stored rather than computed per request because a match query filters and
   * orders on it, and because it lets a recipe be generated once and ranked
   * many times.
   */
  goalScores: jsonb("goal_scores").notNull().default({}),

  /**
   * Where the recipe came from. `curated` is hand-written and shipped with the
   * app; `generated` was built for a specific user's profile.
   *
   * Generated recipes are all kept — they are the user's consumption history,
   * so deleting the unremarkable ones would put holes in it.
   */
  source: text("source").notNull().default("curated"), // curated | generated

  /**
   * Visible to people other than its author. Curated recipes are published;
   * a generated one stays private until its owner chooses otherwise, because
   * it was built from their profile and answers.
   */
  published: boolean("published").notNull().default(true),
});

export const insertRecipeSchema = createInsertSchema(recipesTable).omit({ id: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipesTable.$inferSelect;
