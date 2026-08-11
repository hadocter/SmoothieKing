import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { creationsTable } from "./creations";
import { usersTable } from "./users";

/** One durable reaction per account — browser storage is not an identity. */
export const creationLikesTable = pgTable(
  "creation_likes",
  {
    id: serial("id").primaryKey(),
    creationId: integer("creation_id")
      .notNull()
      .references(() => creationsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oneReactionPerAccount: unique("creation_likes_one_per_account").on(table.creationId, table.userId),
  }),
);
