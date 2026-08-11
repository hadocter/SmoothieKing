import { apiFetch } from "../api";

/**
 * The front door, which is two different doors.
 *
 * `/` used to render one marketing page regardless of who asked for it, so a
 * member who clicked the logo was invited to join a community they had joined
 * and to explore a membership they had. That is the clearest way for a service
 * to say it does not know you, on a service whose whole argument is that it
 * does.
 *
 * Signed out, the page still has to sell. Signed in, it should be the day: the
 * goal in their own words, whether today's drink has been made, what they made
 * before. Both live here so the two never drift into describing different
 * products.
 */

export interface SlotCount {
  slot: string;
  /** How many the skeleton takes from this slot. Two, for flavour. */
  picks: number;
  available: number;
  optional: boolean;
}

export interface CatalogStats {
  ingredients: number;
  bySlot: SlotCount[];
  combinations: number;
  allergenClasses: number;
}

/**
 * Facts about the catalog, for the page shown to people who have no history.
 *
 * A visitor has no goal, no drinks and no numbers of their own, and the space
 * left by that is where the invented community figures used to sit. These are
 * counted from the catalog on every request, so the landing page cannot come
 * to claim a number the builder can no longer reach.
 */
export const getCatalogStats = (): Promise<CatalogStats> =>
  apiFetch<CatalogStats>("/api/catalog/stats", null);

/** Just the fields the member home renders. */
export interface HomeBlend {
  id: number;
  name: string;
  description: string | null;
  benefits: string[];
  calories: number | null;
  protein: number | null;
  published: boolean;
}

export interface SmoothieLog {
  id: number;
  drankAt: string;
  recipe: HomeBlend | null;
}

export const getLogs = (token: string | null): Promise<SmoothieLog[]> =>
  apiFetch<SmoothieLog[]>("/api/smoothie-logs", token);

/** Whether one of these logs happened today, in the reader's own timezone. */
export function madeToday(logs: SmoothieLog[]): SmoothieLog | undefined {
  const today = new Date().toDateString();
  return logs.find((l) => new Date(l.drankAt).toDateString() === today);
}
