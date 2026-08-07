import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_HEX } from "@/lib/colors";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, Info } from "lucide-react";
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

  const [goal, setGoal] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<number | null>(null);
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
          setGoal(active.goal);
          setWeeks(active.weeks);
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
      const period = await startGoal(goal, weeks, token);
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
          Pick one thing and a stretch of time. Everything after this is built around it.
        </p>
      </div>

      {current && (
        <div className="mb-10 rounded-2xl border bg-card p-5 flex items-center gap-4 flex-wrap">
          <span
            className="w-10 h-10 rounded-full shrink-0"
            style={{ background: GOAL_HEX[current.goal] ?? "#ccc" }}
          />
          <div className="flex-1 min-w-[12rem]">
            <div className="font-serif text-xl font-medium">{current.copy?.label ?? current.goal}</div>
            <div className="text-sm text-muted-foreground">
              Day {current.daysElapsed + 1} of {current.weeks * 7} — {current.daysRemaining} to go
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.round((current.daysElapsed / (current.weeks * 7)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {catalog.goals.map((g) => {
          const chosen = goal === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGoal(g.id)}
              aria-pressed={chosen}
              className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                chosen
                  ? `border-primary ring-4 ring-primary/10 shadow-lg ${GOAL_COLORS[g.id] ?? ""}`
                  : "border-transparent bg-card hover:border-primary/30 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-serif text-xl font-medium">{g.label}</span>
                {chosen && <Check className="w-5 h-5 shrink-0 mt-1" />}
              </div>
              {/* The card is large, so the line that says what it actually does
                  goes under it rather than into a tooltip nobody opens. */}
              <p className="text-sm opacity-80 leading-snug">{g.effect}</p>
            </button>
          );
        })}
      </div>

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
          <Link href="/builder">
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
