import { apiFetch } from "../api";

/**
 * Goals, and the stretch of time someone is pursuing one for.
 *
 * The copy under each card comes from the server rather than being written
 * here. It is not decoration: some of those lines are nutrient function claims
 * and which ones they are is recorded alongside them, so a second copy in the
 * client would be a second place for a claim to drift away from its basis.
 */

export type ClaimBasis = "nutrient-function" | "composition";

export interface GoalCopy {
  id: string;
  label: string;
  effect: string;
  basis: ClaimBasis;
  /** The nutrient a function claim rests on. Absent for compositional lines. */
  nutrient?: string;
}

export interface GoalCatalog {
  goals: GoalCopy[];
  weeks: number[];
  /** How many goals may sit behind the main one. */
  maxSubGoals: number;
  disclaimer: string;
}

export interface GoalPeriod {
  id: number;
  goal: string;
  /** Up to two more, in the order they were ranked. */
  subGoals: string[];
  /** What they said they were after, verbatim. Null if they tapped a card. */
  narrative: string | null;
  /** What they are preparing for, if they named one. Null otherwise. */
  occasion: string | null;
  weeks: number;
  startedAt: string;
  endedAt: string | null;
  active: boolean;
  copy: GoalCopy | null;
  daysElapsed: number;
  daysRemaining: number;
}

export const getGoalCatalog = (token: string | null = null): Promise<GoalCatalog> =>
  apiFetch<GoalCatalog>("/api/goals/catalog", token);

/** The goal being built around, or null. Null is an ordinary state, not a 404. */
export const getActiveGoal = (token: string | null): Promise<GoalPeriod | null> =>
  apiFetch<GoalPeriod | null>("/api/goals/active", token);

export const getGoalHistory = (token: string | null): Promise<GoalPeriod[]> =>
  apiFetch<GoalPeriod[]>("/api/goals/history", token);

/**
 * Starts a period from a ranked list of goals.
 *
 * `ranked[0]` is the one the build is shaped around; the rest are sub-goals in
 * the order they were chosen. Passing the whole list rather than a primary and
 * a bag keeps the ranking the user expressed, which is what the numbers on the
 * cards are promising.
 */
export const startGoal = (
  ranked: string[],
  weeks: number,
  token: string | null,
  narrative?: string | null,
  occasion?: string | null,
): Promise<GoalPeriod> =>
  apiFetch<GoalPeriod>("/api/goals", token, {
    method: "POST",
    body: { goal: ranked[0], subGoals: ranked.slice(1), weeks, narrative, occasion },
  });

export const endGoal = (token: string | null): Promise<GoalPeriod> =>
  apiFetch<GoalPeriod>("/api/goals/end", token, { method: "POST", body: {} });
