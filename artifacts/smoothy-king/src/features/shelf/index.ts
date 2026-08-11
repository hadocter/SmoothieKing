import { apiFetch } from "../api";

/**
 * This week's shelf.
 *
 * A shelf is a week, not a possession. Asking once what someone owns and
 * building on that answer forever produces drinks nobody can make by Thursday
 * — the fruit is gone and the milk ran out. So the list is per week, and next
 * week starts blank rather than inheriting a claim nobody re-checked.
 */

export type ShelfState = "have" | "buying" | "skipping";

/**
 * The three answers, and what each one does.
 *
 * `buying` is deliberately not treated as missing: someone going to the shop
 * this afternoon should still be shown drinks that use it. Only a refusal
 * changes what gets built.
 */
export const SHELF_ANSWERS: { state: ShelfState; label: string; hint: string }[] = [
  { state: "have", label: "Got it", hint: "It's in the kitchen" },
  { state: "buying", label: "On the list", hint: "Picking it up" },
  { state: "skipping", label: "Not this week", hint: "Build around it" },
];

export interface ShelfItem {
  name: string;
  slot: string;
  /** How many of the sampled drinks used it — the reason it is on the list. */
  usedIn: number;
  /** Without this slot the skeleton makes nothing at all. */
  essential: boolean;
  state: ShelfState | null;
}

export interface WeekShelf {
  active: boolean;
  goal?: string;
  weekIndex: number | null;
  weeksTotal?: number;
  daysLeftInWeek?: number;
  /** Distinct drinks the listed ingredients alone can make. Computed, not claimed. */
  drinksPossible: number;
  sampled?: number;
  items: ShelfItem[];
}

export const getWeekShelf = (token: string | null): Promise<WeekShelf> =>
  apiFetch<WeekShelf>("/api/shelf/week", token);

export const markIngredient = (
  ingredient: string,
  state: ShelfState | null,
  token: string | null,
): Promise<{ ingredient: string; state: ShelfState | null }> =>
  apiFetch("/api/shelf/mark", token, { method: "POST", body: { ingredient, state } });

export interface Substitute {
  name: string;
  slot: string;
  sharedFlavors: string[];
  sharedBenefits: string[];
  addedAllergens: string[];
}

export const getSubstitutes = (
  ingredient: string,
  token: string | null,
): Promise<{ ingredient: string; options: Substitute[]; note: string | null }> =>
  apiFetch(`/api/shelf/substitutes?ingredient=${encodeURIComponent(ingredient)}`, token);

/** What to call a slot in front of someone who has not read the schema. */
export const SLOT_LABEL: Record<string, string> = {
  liquid: "Base",
  protein: "Protein",
  flavor: "Flavour",
  functional: "Functional",
  thickener: "Body",
  sweetener: "Sweetener",
};
