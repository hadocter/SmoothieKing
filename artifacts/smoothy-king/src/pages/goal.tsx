import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_HEX } from "@/lib/colors";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, Info } from "lucide-react";
import { AssistBox } from "@/features/elicitation";
import { GoalBanner } from "@/features/goals/GoalBanner";
import {
  getActiveGoal,
  getGoalCatalog,
  startGoal,
  type GoalCatalog,
  type GoalPeriod,
} from "@/features/goals";

/**
 * Setting a goal, and how long for.
 *
 * Its own screen rather than a step inside the profile form, because a goal is
 * not a fact about a person the way height is — it is something they are
 * currently doing, with a beginning and an end. Putting it in the profile made
 * it feel like a setting, and settings do not have deadlines.
 *
 * New accounts land here straight after signup, before the profile. Knowing
 * what someone is after is what makes every later screen able to say why it is
 * showing them something.
 */
export default function Goal() {
  const { token, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [catalog, setCatalog] = useState<GoalCatalog | null>(null);
  const [current, setCurrent] = useState<GoalPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /**
   * Goals in the order they were chosen: first is the one the build is shaped
   * around, the rest are sub-goals.
   *
   * One `goal` before this, which meant every tap overwrote the last — someone
   * accepting "Protein & Power" and "Glowy Skin" from a suggestion kept only
   * the second, with no sign the first had been dropped. "In shape for summer"
   * is genuinely two things and the screen had nowhere to put that.
   */
  const [ranked, setRanked] = useState<string[]>([]);
  const goal = ranked[0] ?? null;

  /** Adds if there is room, removes and renumbers if already chosen. */
  function toggleGoal(id: string, max: number) {
    setRanked((prev) =>
      prev.includes(id)
        ? prev.filter((g) => g !== id)
        : prev.length >= max
          ? prev
          : [...prev, id],
    );
  }
  const [weeks, setWeeks] = useState<number | null>(null);
  /**
   * What they typed, kept whether or not the model mapped it.
   *
   * The suggestion picks the category; this is the sentence that gets shown
   * back to them afterwards. Losing it would mean every later screen greets
   * them in a vocabulary they never used.
   */
  const [narrative, setNarrative] = useState<string>("");
  /** What they are preparing for, when the sentence named one. */
  const [occasion, setOccasion] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [cat, active] = await Promise.all([
          getGoalCatalog(token),
          isLoggedIn ? getActiveGoal(token) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCatalog(cat);
        setCurrent(active);
        // Pre-select what they are already doing, so "change my goal" opens on
        // the current answer rather than on an empty form.
        if (active) {
          setRanked([active.goal, ...active.subGoals]);
          setWeeks(active.weeks);
          setNarrative(active.narrative ?? "");
          setOccasion(active.occasion ?? "");
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isLoggedIn]);

  async function save() {
    if (!goal || !weeks || saving) return;
    setSaving(true);
    try {
      const period = await startGoal(ranked, weeks, token, narrative.trim() || null, occasion.trim() || null);
      setCurrent(period);
      toast({
        title: "Set",
        description: `${period.copy?.label ?? period.goal} for the next ${period.weeks} weeks.`,
      });
      // Straight on to the profile — the goal is what the rest of it is for.
      setLocation("/onboarding");
    } catch {
      toast({ title: "Couldn't save that", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-medium mb-3">Create an account first</h1>
        <p className="text-muted-foreground mb-8">A goal is saved to you, so there has to be a you.</p>
        <Link href="/signup">
          <Button size="lg" className="rounded-full px-8">Create Account</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (failed || !catalog) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-medium mb-3">Couldn&apos;t load the goals</h1>
        <p className="text-muted-foreground">Reloading usually does it.</p>
      </div>
    );
  }

  const changing = current !== null;
  // One primary plus however many sub-goals the server allows.
  const maxGoals = 1 + (catalog?.maxSubGoals ?? 2);
  const full = ranked.length >= maxGoals;

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <div className="mb-10">
        <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">
          {changing ? "Your goal" : "First things first"}
        </span>
        <h1 className="font-serif text-4xl font-medium mb-2">
          {changing ? "Working on something else?" : "What are you working on?"}
        </h1>
        <p className="text-muted-foreground">
          Pick up to three, in order — the first one shapes the drink and the rest nudge it. Then
          say how long for.
        </p>
      </div>

      {current && (
        <div className="mb-10">
          <GoalBanner period={current} />
        </div>
      )}

      <div className="mb-8">
        <AssistBox
          step="goals"
          placeholder="e.g. I keep crashing at 3pm and can't focus in meetings"
          onAccept={(ids, text, extra) => {
            // Every accepted id, in the order they were tapped — not just the
            // first. Suggestions routinely name two, and keeping one of them
            // silently discards an answer the user gave.
            setRanked((prev) => {
              const merged = [...prev];
              for (const id of ids) {
                if (!merged.includes(id) && merged.length < maxGoals) merged.push(id);
              }
              return merged;
            });
            // Their sentence, kept. The suggestion decided the category; this
            // is what gets shown back to them from here on.
            if (text) setNarrative(text);
            if (extra?.occasion) setOccasion(extra.occasion);
            // A deadline they actually stated fills the length in, rather than
            // making them say "six weeks" twice on the same screen. Only ever
            // set when the words were in the message — see mentionsTimeframe.
            if (extra?.timeframeWeeks) setWeeks(extra.timeframeWeeks);
          }}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {catalog.goals.map((g) => {
          const rank = ranked.indexOf(g.id);
          const chosen = rank >= 0;
          return (
            <button
              key={g.id}
              onClick={() => toggleGoal(g.id, maxGoals)}
              aria-pressed={chosen}
              disabled={!chosen && full}
              className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 disabled:opacity-40 ${
                chosen
                  ? `border-primary ring-4 ring-primary/10 shadow-lg ${GOAL_COLORS[g.id] ?? ""}`
                  : "border-transparent bg-card hover:border-primary/30 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-serif text-xl font-medium">{g.label}</span>
                {/* The rank, not a tick. Which one leads changes what gets
                    built — the first is worth three points to the others' one —
                    so the screen has to show the order, not just the set. */}
                {chosen && (
                  <span className="shrink-0 w-7 h-7 rounded-full bg-foreground text-background grid place-items-center text-sm font-semibold">
                    {rank + 1}
                  </span>
                )}
              </div>
              {/* The card is large, so the line that says what it actually does
                  goes under it rather than into a tooltip nobody opens. */}
              <p className="text-sm opacity-80 leading-snug">{g.effect}</p>
            </button>
          );
        })}
      </div>

      {(occasion.trim() || narrative.trim()) && (
        <div className="mb-10 rounded-2xl bg-muted/40 border p-4">
          {occasion.trim() ? (
            <>
              <p className="text-sm text-muted-foreground mb-1">So this is</p>
              <p className="font-serif text-lg">For your {occasion.trim()}</p>
              <p className="text-xs text-muted-foreground mt-2">
                That&apos;s how we&apos;ll refer to it. Change the goal or the length below if
                we&apos;ve read it wrong.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-1">You said</p>
              <p className="font-serif text-lg">&ldquo;{narrative.trim()}&rdquo;</p>
            </>
          )}
        </div>
      )}

      <div className="mb-10">
        <h3 className="text-sm font-semibold mb-1">For how long?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Long enough to notice, short enough to finish. You can change it whenever.
        </p>
        <div className="flex flex-wrap gap-3">
          {catalog.weeks.map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              aria-pressed={weeks === w}
              className={`px-6 py-3 rounded-2xl border-2 transition-all duration-200 font-medium ${
                weeks === w
                  ? "border-primary ring-4 ring-primary/10 bg-primary/5"
                  : "border-transparent bg-card hover:border-primary/30 shadow-sm"
              }`}
            >
              {w} weeks
            </button>
          ))}
        </div>
      </div>

      {/* Shown once, near the claims rather than buried in a footer. Several of
          the lines above are nutrient function claims, and this is the wording
          that has to accompany them. */}
      <div className="mb-10 flex gap-2 text-xs text-muted-foreground border-t pt-5">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>{catalog.disclaimer}</p>
      </div>

      <div className="flex justify-end gap-3">
        {changing && (
          // Home rather than the builder: backing out of a goal change lands
          // wherever the console decides is next, which is the week when the
          // week is still undecided.
          <Link href="/">
            <Button variant="outline" size="lg" className="rounded-full px-6">
              Keep what I have
            </Button>
          </Link>
        )}
        <Button
          size="lg"
          className="rounded-full px-8 gap-2"
          disabled={!goal || !weeks || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : changing ? "Start this instead" : "Start"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
