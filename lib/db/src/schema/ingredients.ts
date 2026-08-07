import { pgTable, text, serial, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Ingredients.
 *
 * Two groups of columns, added at different times for different reasons.
 *
 * The original set describes an ingredient to a *reader*: what it is, what
 * it is good for, how to say it in Korean. Those stay exactly as they were.
 *
 * The second set describes it to a *builder*: how much of what is in 100g,
 * where it sits in a glass, what it clashes with. A recipe cannot be
 * generated, scored against a goal, or checked against an allergy without
 * them, and none of it existed before.
 *
 * Nutrition figures carry their own `fdcId`, so a number traces to one
 * specific USDA record rather than to "USDA" in general. Where USDA has no
 * record, the columns are null and `nutritionNote` says why — a gap stays a
 * gap rather than becoming a plausible-looking number.
 */
export const ingredientsTable = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // fruit | vegetable | protein | adaptogen | superfood | fat | liquid
  benefits: text("benefits").array().notNull().default([]),
  skinBenefitKey: text("skin_benefit_key"),
  description: text("description").notNull(),
  koreanName: text("korean_name"),
  nutrientHighlights: text("nutrient_highlights").array().notNull().default([]),

  /* ---- build-time properties ---- */

  /**
   * Where this sits in a glass. Distinct from `category`, which says what
   * the thing *is*: yoghurt is a protein by category and a protein by slot,
   * but oats are a grain that acts as a thickener.
   */
  slot: text("slot"), // liquid | protein | flavor | functional | thickener | sweetener
  /** ml or g contributed to one serving. Drives volume and fill. */
  servingGrams: real("serving_grams"),
  /** Blended into the glass colour as ingredients land. */
  hex: text("hex"),
  /** Flavour families this reads as, for matching taste preferences. */
  flavors: text("flavors").array().notNull().default([]),
  /**
   * Allergen ids present. The safety filter reads this rather than matching
   * on names, so "almond butter" cannot slip past a tree-nut allergy because
   * the string did not match.
   */
  contains: text("contains").array().notNull().default([]),
  /** True for anything a vegan rule excludes. */
  animal: boolean("animal").notNull().default(false),

  /* ---- per 100g, from USDA FoodData Central ---- */

  kcal: real("kcal"),
  proteinG: real("protein_g"),
  fatG: real("fat_g"),
  carbG: real("carb_g"),
  /** The figure the sweetness calibration runs on. */
  sugarG: real("sugar_g"),
  fiberG: real("fiber_g"),
  /** The specific USDA record these came from. Null when there is none. */
  fdcId: integer("fdc_id"),
  fdcDescription: text("fdc_description"),
  fdcDataType: text("fdc_data_type"), // Foundation | SR Legacy
  /** Set when a figure is missing, explaining what is absent and why. */
  nutritionNote: text("nutrition_note"),
});

export const insertIngredientSchema = createInsertSchema(ingredientsTable).omit({ id: true });
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Ingredient = typeof ingredientsTable.$inferSelect;
