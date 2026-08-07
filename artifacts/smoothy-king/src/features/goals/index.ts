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
  disclaimer: string;
}

export interface GoalPeriod {
  id: number;
  goal: string;
  /** What they said they were after, verbatim. Null if they tapped a card. */
  narrative: string | null;
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

export const startGoal = (
  goal: string,
  weeks: number,
  token: string | null,
  narrative?: string | null,
): Promise<GoalPeriod> =>
  apiFetch<GoalPeriod>("/api/goals", token, { method: "POST", body: { goal, weeks, narrative } });

export const endGoal = (token: string | null): Promise<GoalPeriod> =>
  apiFetch<GoalPeriod>("/api/goals/end", token, { method: "POST", body: {} });
