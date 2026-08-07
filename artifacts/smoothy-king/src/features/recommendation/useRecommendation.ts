import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  findMatches,
  generateRecipes,
  logDrink,
  type GenerateResponse,
  type MatchResponse,
  type PresetId,
} from "./index";

/**
 * The recommendation flow, without any of its markup.
 *
 * Search first, generate when nothing fits or when asked. Keeping this in a
 * hook means the page is a rendering of state rather than a place where the
 * order of two network calls is decided in the middle of JSX — and it means
 * the rule "look before you build" lives in one function that can be changed
 * without touching a single class name.
 */
export function useRecommendation(goal: string | null) {
  const { token } = useAuth();

  const [preset, setPreset] = useState<PresetId | null>(null);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [generated, setGenerated] = useState<GenerateResponse | null>(null);
  const [logged, setLogged] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);

  async function generate(chosen: PresetId) {
    setBusy(true);
    setFailed(false);
    try {
      setGenerated(await generateRecipes(chosen, token));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function start(chosen: PresetId) {
    if (!goal) return;
    setPreset(chosen);
    setBusy(true);
    setFailed(false);
    setMatch(null);
    setGenerated(null);
    try {
      // Look before building. Something already in the catalog that fits is a
      // better answer than a new drink, and looking costs nothing.
      const found = await findMatches(goal, token);
      setMatch(found);
      // Nothing fit, so build rather than showing an empty shelf and a button.
      if (found.recipes.length === 0) await generate(chosen);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function log(recipeId: number): Promise<boolean> {
    try {
      await logDrink(recipeId, token);
      setLogged((prev) => [...prev, recipeId]);
      return true;
    } catch {
      return false;
    }
  }

  return {
    preset,
    busy,
    failed,
    match,
    generated,
    logged,
    /** What to render: the generated batch if there is one, else the matches. */
    shown: generated ?? match,
    /** True when the list came off the shelf rather than being built. */
    fromCatalog: generated === null && (match?.recipes.length ?? 0) > 0,
    start,
    regenerate: () => (preset ? generate(preset) : Promise.resolve()),
    log,
  };
}
