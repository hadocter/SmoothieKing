import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Blend, Check, Target, ArrowRight, LogOut, CalendarDays, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { GoalBanner } from "@/features/goals/GoalBanner";
import { getActiveGoal, type GoalPeriod } from "@/features/goals";
import { WeekPanel } from "@/features/shelf/WeekPanel";
import { getLogs, madeToday, type SmoothieLog } from "./index";

/**
 * What a member opens the app into.
 *
 * The rest of the app is arranged sideways — recipes, community, ingredients,
 * goals, all peers of one another — and that is the right shape for browsing
 * and the wrong shape for the thing people actually come back for. Someone
 * opening this on a Tuesday morning has one question, and having to pick which
 * of six tabs answers it is a decision we made them make.
 *
 * So the front is two tabs on one axis of time. Today is the drink. This week
 * is the shopping and the looking back. Everything else is still there, one
 * click away, behind a door that says what is on the other side of it.
 */

type Tab = "today" | "week";

export function Console() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<Tab>("today");
  const [goal, setGoal] = useState<GoalPeriod | null>(null);
  const [logs, setLogs] = useState<SmoothieLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [g, l] = await Promise.all([
        getActiveGoal(token).catch(() => null),
        getLogs(token).catch(() => [] as SmoothieLog[]),
      ]);
      if (cancelled) return;
      setGoal(g);
      setLogs(l);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const today = madeToday(logs);
  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-2xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <p className="font-serif text-2xl md:text-3xl font-medium">
          {greeting}, <span className="text-primary">{user?.nickname}</span>.
        </p>
        {/* The way out, named after where it goes. A button that only says
            "exit" makes leaving feel like abandoning something. */}
        <Link href="/recipes">
          <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-muted-foreground shrink-0">
            Browse everything
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      <div className="inline-flex rounded-full border bg-card p-1 mb-8" role="tablist">
        <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={Sun} label="Today" />
        <TabButton active={tab === "week"} onClick={() => setTab("week")} icon={CalendarDays} label="This week" />
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : tab === "today" ? (
        <Today goal={goal} done={today} />
      ) : (
        <WeekPanel />
      )}
    </div>
  );
}

/**
 * The day, kept to two things.
 *
 * What you are working on, and whether today's is made. Everything else that
 * used to be here — recent blends, the shopping nudge — moved to the week tab
 * or out of the way entirely: a morning screen with five sections on it is a
 * morning screen people scroll past.
 */
function Today({ goal, done }: { goal: GoalPeriod | null; done: SmoothieLog | undefined }) {
  if (!goal) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center">
        <Target className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium mb-1">No goal set</p>
        <p className="text-sm text-muted-foreground mb-5">
          Everything gets built around one. Takes about a minute.
        </p>
        <Link href="/goal">
          <Button className="rounded-full px-6">Set a goal</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/goals" className="block hover:opacity-90 transition-opacity">
        <GoalBanner period={goal} size="compact" />
      </Link>

      {done?.recipe ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-primary font-medium mb-2">
            <Check className="w-4 h-4" />
            Today&rsquo;s is done
          </div>
          <p className="font-serif text-2xl font-medium mb-1">{done.recipe.name}</p>
          <p className="text-sm text-muted-foreground mb-5">
            {[
              done.recipe.calories !== null ? `${done.recipe.calories} kcal` : null,
              done.recipe.protein !== null ? `${done.recipe.protein} g protein` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Made earlier today"}
          </p>
          <Link href="/builder">
            <Button variant="outline" className="rounded-full gap-2">
              <Blend className="w-4 h-4" />
              Build another
            </Button>
          </Link>
        </div>
      ) : (
        <Link href="/builder" className="block group">
          <div className="rounded-2xl bg-primary text-primary-foreground p-8 transition-transform group-hover:scale-[1.01]">
            <p className="font-serif text-3xl font-medium mb-2">Make today&rsquo;s.</p>
            <p className="opacity-80 mb-6">
              Six built around your goal, in about a minute.
            </p>
            <span className="inline-flex items-center gap-2 bg-background text-foreground rounded-full px-6 py-3 font-medium">
              <Blend className="w-4 h-4" />
              Start
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </Link>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
