import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_HEX, GOAL_LABELS } from "@/lib/colors";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Dice5, Check } from "lucide-react";
import { getActiveGoal, getGoalCatalog, type GoalCatalog, type GoalPeriod } from "@/features/goals";
import { GoalBanner } from "@/features/goals/GoalBanner";
import { TodayBox } from "@/features/build/TodayBox";
import {
  MAX_FROM_SHELF,
  TIME_CHOICES,
  editRecipe,
  findMatches,
  generateDrinks,
  getRecipeForMaking,
  logDrink,
  postToBoard,
  presetForMinutes,
  publishRecipe,
  type BuiltDrink,
  type GenerateResult,
} from "@/features/build";
import { BlendingScene } from "@/features/build/BlendingScene";
import { DrinkCard } from "@/features/build/DrinkCard";
import { PourScene } from "@/features/build/PourScene";
import { RecipeSteps } from "@/features/build/RecipeSteps";
import { PublishForm } from "@/features/build/PublishForm";
import { AllergenScan } from "@/features/safety/AllergenScan";
import { verifyIngredients, type SafetyReport } from "@/features/safety";

/**
 * Today's smoothie.
 *
 * Three moves: say what today is like, watch it get built, pick one.
 *
 * What it replaced was a wall of forty-three ingredients to tick by hand,
 * which is the wrong job to give someone — it asks a person to do the part the
 * app knows how to do, and it produces a worse drink than the builder would
 * because nobody is thinking about slot balance at eight in the morning.
 *
 * It also opened by asking "set your intention", which is a question the user
 * already answered on the goal screen. Asking again is the app announcing it
 * forgot. The goal now leads the screen in the user's own words, and the only
 * thing asked is what is genuinely different today: how much time there is,
 * and whether they want anything extra.
 */

type Phase = "ask" | "building" | "choose" | "pour" | "make" | "publish" | "done";

export default function Builder() {
  const { token, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const requestedRecipeId = typeof window === "undefined"
    ? null
    : Number(new URLSearchParams(window.location.search).get("recipe")) || null;

  const [period, setPeriod] = useState<GoalPeriod | null>(null);
  const [catalog, setCatalog] = useState<GoalCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * At most two extras.
   *
   * Sub-goals vary a drink, they do not redefine it — the main goal is worth
   * three points to each sub-goal's one, so more than two of them outvote it
   * and the drink stops being about what the user came for. The same number
   * caps the standing pair set on the goal screen.
   */
  const MAX_SUB_GOALS = 2;

  const [minutes, setMinutes] = useState<number>(5);
  const [subGoals, setSubGoals] = useState<string[]>([]);
  /** Taste for today, overriding the profile's standing preference. */
  const [tastes, setTastes] = useState<string[]>([]);

  /**
   * At most two extras.
   *
   * Sub-goals are meant to vary a drink, not redefine it — the main goal is
   * worth three points to each sub-goal's one, so five of them outvote it and
   * the drink stops being about what the user came here for. Two is enough to
   * make a glass feel like today's without that happening.
   */

  const [phase, setPhase] = useState<Phase>("ask");
  const [result, setResult] = useState<GenerateResult | null>(null);
  /** How many of the offered drinks came off the shelf rather than being built. */
  const [fromShelf, setFromShelf] = useState(0);
  const [chosen, setChosen] = useState<BuiltDrink | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * The allergen check on the drink they picked.
   *
   * Generation already filtered on the same rules, so this should always come
   * back clear — and that is exactly why it is worth running and showing. A
   * filter and a verifier that agree are two independent statements of the
   * same fact; a filter nobody verifies is a promise.
   *
   * `null` means not asked yet, `"failed"` means we asked and could not get an
   * answer. Those are different states and the screen says which: a check that
   * did not run must never look like a check that passed. That is the exact
   * shape of the earlier defect, where a request without a token returned
   * "clear" because the server had no profile to check against.
   */
  const [safety, setSafety] = useState<SafetyReport | "failed" | null>(null);

  /**
   * Verify the chosen drink the moment the pour starts.
   *
   * Not on choosing, so a change of mind does not leave a stale verdict on
   * screen; not on the recipe step, because by then they are already pouring
   * things into a blender.
   */
  useEffect(() => {
    if (phase !== "pour" || !chosen) return;
    let cancelled = false;
    setSafety(null);
    verifyIngredients(chosen.ingredients.map((i) => i.name), token)
      .then((r) => !cancelled && setSafety(r))
      // A check that could not run is not a check that passed.
      .catch(() => !cancelled && setSafety("failed"));
    return () => {
      cancelled = true;
    };
  }, [phase, chosen, token]);

  /**
   * Reaching the end of the recipe is what counts as having made and drunk it.
   *
   * Logging at generation would record nine drinks that never happened out of
   * every batch of ten, and nothing later recovers a history that was wrong
   * when it was written.
   */
  async function finishMaking() {
    if (!chosen) return;
    setSaving(true);
    try {
      await logDrink(chosen.id, token);
    } catch {
      // The log failing should not block the rest of the flow — they still
      // made the drink. Said out loud rather than swallowed.
      toast({ title: "Couldn't add that to your history", variant: "destructive" });
    } finally {
      setSaving(false);
      setPhase("publish");
    }
  }

  async function publish(patch: { name: string; description: string; imageUrl: string }) {
    if (!chosen) return;
    setSaving(true);
    try {
      const updated = await editRecipe(chosen.id, patch, token);
      await publishRecipe(chosen.id, token);
      // And onto the board. Two objects: the recipe is the drink, the creation
      // is the post about it. Flipping the recipe's flag alone made it public
      // in a place nobody looks.
      await postToBoard(
        { ...chosen, ...updated },
        token,
      );
      // Carry the edit forward, or the confirmation screen congratulates them
      // on the name they just changed away from.
      setChosen({ ...chosen, ...updated });
      toast({ title: "Posted", description: `${patch.name} is on the board.` });
      setPhase("done");
    } catch {
      toast({ title: "Couldn't post that", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [active, cat, requested] = await Promise.all([
          isLoggedIn ? getActiveGoal(token) : Promise.resolve(null),
          getGoalCatalog(token),
          requestedRecipeId ? getRecipeForMaking(requestedRecipeId, token).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setPeriod(active);
        setCatalog(cat);
        // The standing sub-goals are the day's starting point, not a separate
        // question. Someone who said "protein and skin, for the summer" should
        // not have to say it again every morning — they can change it here,
        // and the change lasts for today only.
        if (active) setSubGoals(active.subGoals.slice(0, MAX_SUB_GOALS));
        // "Create it" begins with the exact published build, then goes
        // through the same allergy check and make/log flow as a new drink.
        // It never re-generates a substitute recipe behind the person's back.
        if (active && requested) {
          setChosen(requested);
          setPhase("pour");
        }
      } catch {
        /* handled by the empty states below */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isLoggedIn, requestedRecipeId]);

  /**
   * Look before building, then build to fill.
   *
   * Searching the catalog costs nothing and a recipe that already fits is a
   * real answer. But those were written for a goal, not for today's time or
   * sub-goals, so at most three of the six come off the shelf and the rest are
   * made now — and the screen says which is which rather than presenting a
   * catalog lookup as something done for you this minute.
   *
   * Both requests go out together. Running them in sequence would make every
   * build wait for a search whose result might not be used.
   */
  async function build(freshOnly = false) {
    setPhase("building");
    setFailed(false);
    setChosen(null);
    const startedAt = Date.now();
    try {
      const [matched, generated] = await Promise.all([
        freshOnly || !period ? Promise.resolve(null) : findMatches(period.goal, token).catch(() => null),
        generateDrinks({ preset: presetForMinutes(minutes), subGoals, tastes }, token),
      ]);

      const shelf = (matched?.recipes ?? []).slice(0, MAX_FROM_SHELF);
      const shelfIds = new Set(shelf.map((r) => r.id));
      const fresh = generated.recipes.filter((r) => !shelfIds.has(r.id));

      const res: GenerateResult = {
        ...generated,
        recipes: [...shelf, ...fresh].slice(0, 6),
      };
      setFromShelf(shelf.length);
      // The scene has something to say and saying half of it looks like a
      // glitch. A floor, not a fake delay: a slow build is never padded.
      const remaining = 2200 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setResult(res);
      setPhase("choose");
    } catch {
      setFailed(true);
      setPhase("ask");
    }
  }

  const goalHex = period ? GOAL_HEX[period.goal] ?? "#4A7C59" : "#4A7C59";

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isLoggedIn || !period) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-medium mb-3">What are you working on?</h1>
        <p className="text-muted-foreground mb-8">
          Every drink here is built around a goal, so that is the thing to set first.
        </p>
        <Link href={isLoggedIn ? "/goal" : "/signup"}>
          <Button size="lg" className="rounded-full px-8">
            {isLoggedIn ? "Set a goal" : "Create Account"}
          </Button>
        </Link>
      </div>
    );
  }

  /* ---------------- building ---------------- */

  if (phase === "building") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <BlendingScene goalHex={goalHex} />
      </div>
    );
  }

  /* ---------------- choose ---------------- */

  if (phase === "choose" && result) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="mb-8">
          <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">
            Made for today
          </span>
          <h1 className="font-serif text-4xl font-medium mb-2">Which one?</h1>
          <p className="text-muted-foreground">
            {/* Six, from Iyengar & Lepper: 24 options produced an order of
                magnitude fewer purchases than 6, and less satisfaction with the
                choice. The true count is stated so the cap is not mistaken for
                the whole set. */}
            {fromShelf > 0
              ? `${fromShelf} that already fit, and ${result.recipes.length - fromShelf} made just now.`
              : `${result.generatedCount} built, ${result.matchCount} worth offering${
                  result.matchCount > result.recipes.length ? `, showing ${result.recipes.length}` : ""
                }.`}
          </p>
        </div>

        {result.recipes.length === 0 ? (
          <div className="rounded-2xl border bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nothing came out well enough to offer. That usually means the constraints are tight —
              try allowing more time.
            </p>
            <Button variant="outline" className="rounded-full" onClick={() => setPhase("ask")}>
              Change something
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {result.recipes.map((d) => (
              <DrinkCard
                key={d.id}
                drink={d}
                selected={chosen?.id === d.id}
                onSelect={() => setChosen(d)}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap justify-between gap-3 border-t pt-6">
          <Button variant="outline" className="rounded-full gap-2" onClick={() => setPhase("ask")}>
            Start over
          </Button>
          <div className="flex gap-3">
            {/* Fresh only — someone asking for others has seen the shelf. */}
            <Button variant="outline" className="rounded-full gap-2" onClick={() => void build(true)}>
              <Dice5 className="w-4 h-4" />
              Build me some others
            </Button>
            <Button
              size="lg"
              className="rounded-full px-8 gap-2"
              disabled={!chosen}
              onClick={() => setPhase("pour")}
            >
              Make this one
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- pour, make, publish, done ---------------- */

  if (phase === "pour" && chosen) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-14">
        <PourScene
          drink={chosen}
          onDone={() => setPhase("make")}
          blocked={safety !== null && safety !== "failed" && !safety.safe}
          verification={
            safety === "failed" ? (
              <p className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-5 text-sm">
                We could not run the allergen check just now. Nothing has gone wrong with
                the drink — we simply cannot confirm it, so please read the ingredients
                yourself before making it.
              </p>
            ) : safety ? (
              <AllergenScan report={safety} />
            ) : null
          }
        />
      </div>
    );
  }

  if (phase === "make" && chosen) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-14">
        <RecipeSteps drink={chosen} onFinished={() => void finishMaking()} finishing={saving} />
      </div>
    );
  }

  if (phase === "publish" && chosen) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-14">
        <PublishForm
          drink={chosen}
          busy={saving}
          onPublish={(patch) => void publish(patch)}
          onSkip={() => setPhase("done")}
        />
      </div>
    );
  }

  if (phase === "done" && chosen) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div
          className="w-24 h-24 rounded-full mx-auto mb-8"
          style={{ background: chosen.appearance?.css ?? "#ddd" }}
        />
        <h1 className="font-serif text-3xl font-medium mb-3">{chosen.name}</h1>
        <p className="text-muted-foreground mb-10">It&apos;s in your history. Same time tomorrow?</p>
        <div className="flex justify-center gap-3">
          <Link href="/profile">
            <Button variant="outline" size="lg" className="rounded-full px-6">See your history</Button>
          </Link>
          <Button
            size="lg"
            className="rounded-full px-6"
            onClick={() => {
              setChosen(null);
              setResult(null);
              setPhase("ask");
            }}
          >
            Build another
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------- ask ---------------- */

  const available = catalog?.goals.filter((g) => g.id !== period.goal) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <div className="mb-8">
        <GoalBanner period={period} />
      </div>

      <div className="mb-10">
        <h1 className="font-serif text-4xl font-medium mb-2">Anything else today?</h1>
        <p className="text-muted-foreground">
          Optional, and up to two. Your goal decides most of the glass — these nudge the rest.
        </p>
      </div>

      <div className="mb-8">
        <TodayBox
          disabledIds={[...subGoals, ...tastes, `effort-${presetForMinutes(minutes)}`]}
          onAccept={(axis, id) => {
            if (axis === "goals") {
              if (id === period.goal) return;
              setSubGoals((prev) =>
                prev.includes(id) || prev.length >= MAX_SUB_GOALS ? prev : [...prev, id],
              );
            } else if (axis === "taste") {
              setTastes((prev) => (prev.includes(id) ? prev : [...prev, id]));
            } else if (axis === "effort") {
              // The effort ids map onto the same presets the time buttons pick,
              // so "light one" and tapping 5 minutes are the same answer.
              const minutesFor: Record<string, number> = {
                "effort-quick": 3,
                "effort-light": 5,
                "effort-great": 8,
                "effort-heavy": 15,
              };
              if (minutesFor[id]) setMinutes(minutesFor[id]);
            }
          }}
        />
      </div>

      {tastes.length > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          Leaning {tastes.join(", ")} today.
        </p>
      )}

      <div className="flex flex-wrap gap-2.5 mb-12">
        {available.map((g) => {
          const on = subGoals.includes(g.id);
          return (
            <button
              key={g.id}
              disabled={!on && subGoals.length >= MAX_SUB_GOALS}
              onClick={() =>
                setSubGoals((prev) =>
                  on ? prev.filter((s) => s !== g.id) : prev.length >= MAX_SUB_GOALS ? prev : [...prev, g.id],
                )
              }
              aria-pressed={on}
              title={g.effect}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 inline-flex items-center gap-1.5 disabled:opacity-35 ${
                on
                  ? `${GOAL_COLORS[g.id] ?? ""} border-primary/30 ring-1 ring-primary/20`
                  : "bg-card hover:bg-muted border-transparent"
              }`}
            >
              {on && <Check className="w-3.5 h-3.5" />}
              {GOAL_LABELS[g.id] ?? g.label}
            </button>
          );
        })}
      </div>

      <div className="mb-12">
        <h3 className="text-sm font-semibold mb-1">How long have you got?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This is the only thing that really changes day to day.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TIME_CHOICES.map((t) => (
            <button
              key={t.minutes}
              onClick={() => setMinutes(t.minutes)}
              aria-pressed={minutes === t.minutes}
              className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                minutes === t.minutes
                  ? "border-primary ring-4 ring-primary/10 bg-primary/5"
                  : "border-transparent bg-card hover:border-primary/30 shadow-sm"
              }`}
            >
              <div className="font-medium mb-0.5">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.line}</div>
            </button>
          ))}
        </div>
      </div>

      {failed && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Couldn&apos;t build anything just then. Try again, or{" "}
            <Link href="/recipes" className="underline">
              browse the recipes
            </Link>
            .
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="lg" className="rounded-full px-10 gap-2 text-lg" onClick={() => void build()}>
          {subGoals.length === 0 ? "Surprise me" : "Build it"}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
