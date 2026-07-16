import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreationSchema = createInsertSchema(creationsTable).omit({ id: true, createdAt: true });
export type InsertCreation = z.infer<typeof insertCreationSchema>;
export type Creation = typeof creationsTable.$inferSelect;
