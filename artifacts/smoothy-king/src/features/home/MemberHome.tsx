import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Blend, Target, Check, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { GoalBanner } from "@/features/goals/GoalBanner";
import { getActiveGoal, type GoalPeriod } from "@/features/goals";
import { getLogs, madeToday, type SmoothieLog, type HomeBlend } from "./index";

/**
 * The day, for someone who is signed in.
 *
 * Assembled from what already exists — the goal banner, the log, the blends —
 * rather than adding a fourth account of any of them. Three questions in the
 * order they get asked: what am I working on, have I had today's, what have I
 * made.
 *
 * The empty states matter more than the full ones here. A new account reaches
 * this screen with no goal and no history, and the version of this page that
 * greets them with three blank cards is worse than the landing page it
 * replaced. Each section says what to do instead of showing a gap.
 */
export function MemberHome() {
  const { user, token } = useAuth();
  const [goal, setGoal] = useState<GoalPeriod | null>(null);
  const [logs, setLogs] = useState<SmoothieLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Independent, and one failing should not blank the other: a goal with a
      // failed log request is still worth showing.
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
  const recent = dedupe(logs.map((l) => l.recipe).filter((r): r is HomeBlend => r !== null)).slice(0, 3);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
      <p className="font-serif text-3xl md:text-4xl font-medium mb-8">
        {greeting}, <span className="text-primary">{user?.nickname}</span>.
      </p>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* What they are working on, in their own words where they gave any. */}
          {goal ? (
            <Link href="/goals" className="block hover:opacity-90 transition-opacity">
              <GoalBanner period={goal} size="compact" />
            </Link>
          ) : (
            <EmptyCard
              icon={Target}
              title="No goal set"
              line="Everything gets built around one. Takes about a minute."
              action="Set a goal"
              href="/goal"
            />
          )}

          {/* Today. */}
          {today?.recipe ? (
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-primary font-medium mb-2">
                <Check className="w-4 h-4" />
                Today&rsquo;s is done
              </div>
              <p className="font-serif text-2xl font-medium mb-1">{today.recipe.name}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {[
                  today.recipe.calories !== null ? `${today.recipe.calories} kcal` : null,
                  today.recipe.protein !== null ? `${today.recipe.protein} g protein` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Made earlier today"}
              </p>
              <Link href="/builder">
                <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Build another
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border bg-primary text-primary-foreground p-6">
              <p className="font-serif text-2xl font-medium mb-1">Nothing made today.</p>
              <p className="text-sm opacity-80 mb-5">
                {goal
                  ? "Six built around your goal, in about a minute."
                  : "Set a goal first, and the six get built around it."}
              </p>
              <Link href={goal ? "/builder" : "/goal"}>
                <Button variant="secondary" size="lg" className="rounded-full gap-2">
                  <Blend className="w-4 h-4" />
                  {goal ? "Build today's" : "Start"}
                </Button>
              </Link>
            </div>
          )}

          {/* What they have made. Absent, not empty, when there is none. */}
          {recent.length > 0 && (
            <div>
              <div className="flex items-end justify-between mb-4">
                <h2 className="font-serif text-2xl font-medium">Recently made</h2>
                <Link href="/profile" className="text-sm text-primary hover:underline flex items-center gap-1">
                  All of them <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {recent.map((r) => (
                  <Link key={r.id} href={`/recipes/${r.id}`} className="block group">
                    <div className="rounded-2xl border bg-card p-4 h-full hover:border-primary/40 transition-colors">
                      <p className="font-serif text-lg font-medium mb-2 leading-snug group-hover:text-primary transition-colors">
                        {r.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(r.benefits ?? []).slice(0, 2).map((b) => (
                          <span
                            key={b}
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${GOAL_COLORS[b] ?? "bg-muted"}`}
                          >
                            {GOAL_LABELS[b] ?? b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Most recent first, one card per drink however many times it was drunk. */
function dedupe(recipes: HomeBlend[]): HomeBlend[] {
  const seen = new Map<number, HomeBlend>();
  for (const r of recipes) if (!seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()];
}

function EmptyCard({
  icon: Icon,
  title,
  line,
  action,
  href,
}: {
  icon: typeof Target;
  title: string;
  line: string;
  action: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 p-5 flex items-center gap-4">
      <Icon className="w-6 h-6 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{line}</p>
      </div>
      <Link href={href}>
        <Button size="sm" className="rounded-full shrink-0">
          {action}
        </Button>
      </Link>
    </div>
  );
}
