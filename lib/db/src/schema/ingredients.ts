import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ingredientsTable = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // fruit | vegetable | protein | adaptogen | superfood | fat | liquid
  benefits: text("benefits").array().notNull().default([]),
  skinBenefitKey: text("skin_benefit_key"),
  description: text("description").notNull(),
  koreanName: text("korean_name"),
  nutrientHighlights: text("nutrient_highlights").array().notNull().default([]),
});

export const insertIngredientSchema = createInsertSchema(ingredientsTable).omit({ id: true });
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Ingredient = typeof ingredientsTable.$inferSelect;
