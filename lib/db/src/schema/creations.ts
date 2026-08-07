import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { recipesTable } from "./recipes";

export const creationsTable = pgTable("creations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  authorName: text("author_name").notNull(),
  authorInitials: text("author_initials"),
  goal: text("goal").notNull(),
  story: text("story"),
  ingredients: jsonb("ingredients").notNull().default([]),
  likes: integer("likes").notNull().default(0),
  colorHex: text("color_hex"),

  /**
   * The recipe this was posted from, when it came out of the build flow.
   *
   * A creation is the social object — it has an author, a story and likes — and
   * a recipe is the drink. They were entirely separate, which is why a drink
   * built, made and published never reached the board: the flow wrote a recipe
   * and the board reads creations. This is the join.
   *
   * Null for the seeded posts, which predate the build flow and have no recipe
   * behind them.
   */
  recipeId: integer("recipe_id").references(() => recipesTable.id),

  /** The photo, or empty for the ingredient-derived gradient. */
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreationSchema = createInsertSchema(creationsTable).omit({ id: true, createdAt: true });
export type InsertCreation = z.infer<typeof insertCreationSchema>;
export type Creation = typeof creationsTable.$inferSelect;
