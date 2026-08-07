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
import { AssistBox } from "@/features/elicitation";
import {
  MAX_FROM_SHELF,
  TIME_CHOICES,
  editRecipe,
  findMatches,
  generateDrinks,
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
  const { token, isLoggedIn, user } = useAuth();
  const { toast } = useToast();

  const [period, setPeriod] = useState<GoalPeriod | null>(null);
  const [catalog, setCatalog] = useState<GoalCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  const [minutes, setMinutes] = useState<number>(5);
  const [subGoals, setSubGoals] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("ask");
  const [result, setResult] = useState<GenerateResult | null>(null);
  /** How many of the offered drinks came off the shelf rather than being built. */
  const [fromShelf, setFromShelf] = useState(0);
  const [chosen, setChosen] = useState<BuiltDrink | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

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
        user?.nickname ?? "Someone",
        period?.goal ?? "",
        { name: patch.name, story: patch.description, imageUrl: patch.imageUrl },
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
        const [active, cat] = await Promise.all([
          isLoggedIn ? getActiveGoal(token) : Promise.resolve(null),
          getGoalCatalog(token),
        ]);
        if (cancelled) return;
        setPeriod(active);
        setCatalog(cat);
      } catch {
        /* handled by the empty states below */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isLoggedIn]);

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
        generateDrinks({ preset: presetForMinutes(minutes), subGoals }, token),
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
        <PourScene drink={chosen} onDone={() => setPhase("make")} />
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
          Optional. Your goal decides most of the glass — this nudges the rest of it.
        </p>
      </div>

      <div className="mb-8">
        <AssistBox
          step="goals"
          placeholder="e.g. shoulders are wrecked from yesterday"
          onAccept={(ids) =>
            setSubGoals((prev) => [...new Set([...prev, ...ids.filter((i) => i !== period.goal)])])
          }
        />
      </div>

      <div className="flex flex-wrap gap-2.5 mb-12">
        {available.map((g) => {
          const on = subGoals.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() =>
                setSubGoals((prev) => (on ? prev.filter((s) => s !== g.id) : [...prev, g.id]))
              }
              aria-pressed={on}
              title={g.effect}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 inline-flex items-center gap-1.5 ${
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
