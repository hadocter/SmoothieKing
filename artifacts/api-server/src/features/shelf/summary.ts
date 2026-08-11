/**
 * A week, looked back on.
 *
 * Built from the log rather than from what was generated. A batch makes ten
 * and a person drinks one, so counting generated drinks would report a week
 * nobody had — the same reason the log is written when a recipe is finished
 * and not when it is built.
 *
 * Nulls stay null all the way to the total. Some ingredients have no USDA
 * figure, and a week's calories that silently omits three drinks is worse than
 * a week's calories that says it could not add three drinks up.
 */

export interface DrunkDrink {
  id: number;
  name: string;
  drankAt: string;
  calories: number | null;
  protein: number | null;
  benefits: string[];
}

export interface WeekSummary {
  weekIndex: number;
  /** Days of this week that have happened, 1–7. */
  daysSoFar: number;
  drinks: DrunkDrink[];
  /** Distinct days with at least one drink. The number that means "kept it up". */
  daysWithADrink: number;
  calories: number | null;
  protein: number | null;
  /** How many drinks had no calorie figure, so the total can be read honestly. */
  unpriced: number;
  /** Goals the week's drinks carried, most frequent first. */
  goals: { goal: string; drinks: number }[];
}

export function summarise(
  weekIndex: number,
  daysSoFar: number,
  logs: { drankAt: Date; recipe: DrunkDrink | null }[],
): WeekSummary {
  const drinks = logs
    .filter((l): l is { drankAt: Date; recipe: DrunkDrink } => l.recipe !== null)
    .map((l) => ({ ...l.recipe, drankAt: l.drankAt.toISOString() }));

  let calories: number | null = 0;
  let protein: number | null = 0;
  let unpriced = 0;

  for (const d of drinks) {
    if (d.calories === null) {
      unpriced += 1;
      calories = null;
    } else if (calories !== null) {
      calories += d.calories;
    }
    if (d.protein === null) protein = null;
    else if (protein !== null) protein += Math.round(d.protein * 10) / 10;
  }

  const perGoal = new Map<string, number>();
  for (const d of drinks) {
    for (const g of d.benefits ?? []) perGoal.set(g, (perGoal.get(g) ?? 0) + 1);
  }

  return {
    weekIndex,
    daysSoFar,
    drinks,
    daysWithADrink: new Set(drinks.map((d) => d.drankAt.slice(0, 10))).size,
    calories,
    protein: protein === null ? null : Math.round(protein * 10) / 10,
    unpriced,
    goals: [...perGoal.entries()]
      .map(([goal, n]) => ({ goal, drinks: n }))
      .sort((a, b) => b.drinks - a.drinks),
  };
}
