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
});

export const insertRecipeSchema = createInsertSchema(recipesTable).omit({ id: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipesTable.$inferSelect;
