import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  gender: text("gender"),                            // male | female | other
  age: integer("age"),
  height: real("height"),                            // cm
  weight: real("weight"),                            // kg
  activityLevel: text("activity_level"),             // sedentary | light | moderate | active | very_active
  allergies: text("allergies").array().notNull().default([]),
  dislikedIngredients: text("disliked_ingredients").array().notNull().default([]),
  primaryGoal: text("primary_goal"),                 // glowy-skin | hydration | sun-ritual | protein-power | anti-inflammatory | detox-clarity | gut-health | energy-focus
  secondaryGoals: text("secondary_goals").array().notNull().default([]),
  tastePreference: text("taste_preference").array().notNull().default([]),  // sweet | sour | nutty | fresh
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
