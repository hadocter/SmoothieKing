import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_HEX, GOAL_LABELS } from "@/lib/colors";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Flag, Sparkles } from "lucide-react";
import {
  endGoal,
  getActiveGoal,
  getGoalHistory,
  type GoalPeriod,
} from "@/features/goals";
import { GoalBanner } from "@/features/goals/GoalBanner";
import { apiFetch } from "@/features/api";

/**
 * Goals, over time.
 *
 * The setting screen answers "what now"; this answers "what have I been doing".
 * They were the same page, which meant the only way to look at a commitment was
 * to open the form for replacing it — and a screen whose primary action is
 * "start something else" is a strange place to go to see how the current thing
 * is going.
 *
 * Periods are kept after they end, so this is also the record: what someone was
 * working on last spring, how long for, and how many drinks went with it.
 */

interface DrinkLog {
  id: number;
  drankAt: string;
  recipe: { name: string } | null;
}

/**
 * Drinks logged inside a period's window.
 *
 * Counted here rather than stored on the period. A count written at log time
 * would be a second source of truth, and it would be wrong the moment a period
 * was ended early or replaced — the window is the fact, the count follows from
 * it.
 */
function drinksWithin(period: GoalPeriod, logs: DrinkLog[]): DrinkLog[] {
  const from = new Date(period.startedAt).getTime();
  const to = period.endedAt
    ? new Date(period.endedAt).getTime()
    : from + period.weeks * 7 * 86_400_000;
  return logs.filter((l) => {
    const at = new Date(l.drankAt).getTime();
    return at >= from && at <= to;
  });
}

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Goals() {
  const { token, isLoggedIn } = useAuth();
  const { toast } = useToast();

  const [active, setActive] = useState<GoalPeriod | null>(null);
  const [history, setHistory] = useState<GoalPeriod[]>([]);
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  async function load() {
    const [a, h, l] = await Promise.all([
      getActiveGoal(token),
      getGoalHistory(token),
      // The history is worth showing even if the drink log fails to load.
      apiFetch<DrinkLog[]>("/api/smoothie-logs", token).catch(() => [] as DrinkLog[]),
    ]);
    setActive(a);
    setHistory(h);
    setLogs(l);
  }

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void load()
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isLoggedIn]);

  async function stop() {
    setEnding(true);
    try {
      await endGoal(token);
      await load();
      toast({ title: "Ended", description: "It stays in your history." });
    } catch {
      toast({ title: "Couldn't end that", variant: "destructive" });
    } finally {
      setEnding(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-medium mb-3">Goals are saved to an account</h1>
        <Link href="/signup">
          <Button size="lg" className="rounded-full px-8 mt-4">Create Account</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const past = history.filter((p) => !p.active);

  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <div className="mb-10">
        <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">
          Goals
        </span>
        <h1 className="font-serif text-4xl font-medium mb-2">
          {active ? "What you're working on" : "Nothing on the go"}
        </h1>
        <p className="text-muted-foreground">
          {active
            ? "Every drink is built around this until it ends or you change it."
            : "Set one and the daily build has something to aim at."}
        </p>
      </div>

      {active ? (
        <div className="mb-12">
          <GoalBanner period={active} />

          <div className="grid grid-cols-3 gap-3 mt-4">
            <Stat label="Day" value={`${active.daysElapsed + 1}`} of={`of ${active.weeks * 7}`} />
            <Stat label="Left" value={`${active.daysRemaining}`} of="days" />
            <Stat
              label="Drinks"
              value={`${drinksWithin(active, logs).length}`}
              of="logged"
            />
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <Link href="/goal">
              <Button variant="outline" className="rounded-full gap-2">
                <Pencil className="w-4 h-4" />
                Change it
              </Button>
            </Link>
            <Link href="/builder">
              <Button className="rounded-full gap-2">
                <Sparkles className="w-4 h-4" />
                Build today&apos;s
              </Button>
            </Link>
            {/* Ending is separate from changing. Someone who is done is not
                necessarily starting something else, and making them pick a
                replacement to stop would put a goal on the books nobody chose. */}
            <Button
              variant="ghost"
              className="rounded-full gap-2 text-muted-foreground ml-auto"
              disabled={ending}
              onClick={() => void stop()}
            >
              <Flag className="w-4 h-4" />
              {ending ? "Ending…" : "End it"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-12 rounded-2xl border bg-muted/30 p-8 text-center">
          <p className="text-muted-foreground mb-5">
            The builder needs a goal to aim at — it decides most of what goes in the glass.
          </p>
          <Link href="/goal">
            <Button size="lg" className="rounded-full px-8">Set a goal</Button>
          </Link>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4 border-b pb-2">
            Before this
          </h2>
          <ul className="space-y-3">
            {past.map((p) => {
              const drinks = drinksWithin(p, logs).length;
              const label = p.copy?.label ?? GOAL_LABELS[p.goal] ?? p.goal;
              // A period that was replaced and one that ran its course both
              // stop being current; only the first is abandonment, and the
              // record keeps them apart.
              const finished = !p.endedAt || p.daysRemaining === 0;
              return (
                <li key={p.id} className="rounded-2xl border bg-card p-4 flex items-start gap-4">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-2"
                    style={{ background: GOAL_HEX[p.goal] ?? "#ccc" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {p.occasion ? `For your ${p.occasion}` : label}
                      {p.occasion && (
                        <span className="text-muted-foreground font-normal"> · {label}</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {dateOf(p.startedAt)} · {p.weeks} weeks · {drinks}{" "}
                      {drinks === 1 ? "drink" : "drinks"}
                    </div>
                    {p.narrative && !p.occasion && (
                      <p className="text-sm text-muted-foreground mt-1 italic">
                        &ldquo;{p.narrative}&rdquo;
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mt-1">
                    {finished ? "finished" : "swapped"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, of }: { label: string; value: string; of: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 text-center">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="font-serif text-3xl font-medium tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{of}</div>
    </div>
  );
}
