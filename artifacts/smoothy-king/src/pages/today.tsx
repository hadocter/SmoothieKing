import { Link } from "wouter";
import { useGetUserProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Clock, Flame, Feather, Gem } from "lucide-react";
import { PRESETS, type PresetId } from "@/features/recommendation";
import { RecommendationCard } from "@/features/recommendation/RecommendationCard";
import { useRecommendation } from "@/features/recommendation/useRecommendation";

/**
 * Today's smoothie.
 *
 * Rendering only. What to fetch and in what order lives in
 * `useRecommendation`; this file decides what it looks like.
 */

const ICONS: Record<PresetId, typeof Clock> = {
  great: Gem,
  quick: Clock,
  heavy: Flame,
  light: Feather,
};

export default function Today() {
  const { data: profile, isLoading, isError } = useGetUserProfile();
  const { toast } = useToast();

  const goal = profile?.primaryGoal ?? null;
  const rec = useRecommendation(goal);

  async function handleLog(id: number) {
    const ok = await rec.log(id);
    toast(
      ok
        ? { title: "Logged", description: "Added to your history." }
        : { title: "Couldn't log that", variant: "destructive" },
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // An error is not the same as an empty profile. Telling someone who has set
  // a goal that they have not set one is worse than admitting the profile
  // could not be loaded, and it sends them back through onboarding they have
  // already done.
  if (isError) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-medium mb-3">Couldn&apos;t load your profile</h1>
        <p className="text-muted-foreground mb-8">
          Recommendations are built from it, so there is nothing to show until it loads. Reloading
          usually does it.
        </p>
        <Link href="/recipes">
          <Button variant="outline" size="lg" className="rounded-full px-8">
            Browse all recipes
          </Button>
        </Link>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-medium mb-3">Tell us what you&apos;re after first</h1>
        <p className="text-muted-foreground mb-8">
          Recommendations are built from your goal, so there is nothing to build from yet.
        </p>
        <Link href="/onboarding">
          <Button size="lg" className="rounded-full px-8">
            Set up your profile
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="mb-10">
        <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Today</span>
        <h1 className="font-serif text-4xl font-medium mb-2">What kind of day is it?</h1>
        <p className="text-muted-foreground">
          Built around{" "}
          <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${GOAL_COLORS[goal]}`}>
            {GOAL_LABELS[goal] ?? goal}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {PRESETS.map(({ id, label, line }) => {
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              onClick={() => void rec.start(id)}
              disabled={rec.busy}
              className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 disabled:opacity-60 ${
                rec.preset === id
                  ? "border-primary ring-4 ring-primary/10 bg-primary/5 shadow-md"
                  : "border-transparent bg-card hover:border-primary/30 shadow-sm hover:shadow-md"
              }`}
            >
              <Icon className="w-5 h-5 text-primary mb-3" />
              <div className="font-serif text-lg font-medium mb-1">{label}</div>
              <div className="text-sm text-muted-foreground">{line}</div>
            </button>
          );
        })}
      </div>

      {rec.busy && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      )}

      {rec.failed && !rec.busy && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">
            Something went wrong finding a smoothie. Try a different button, or browse{" "}
            <Link href="/recipes" className="underline">
              all recipes
            </Link>
            .
          </p>
        </div>
      )}

      {!rec.busy && rec.shown && (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="font-serif text-2xl font-medium">
                {rec.fromCatalog ? "Already on the shelf" : "Built for you just now"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {rec.fromCatalog
                  ? // The true count, not the number shown. Six is a display cap
                    // and saying "6" when 11 fit would misdescribe the shelf.
                    `${rec.match?.matchCount} fit your goal${
                      (rec.match?.matchCount ?? 0) > rec.shown.recipes.length
                        ? `, showing the ${rec.shown.recipes.length} closest`
                        : ""
                    }.`
                  : `${rec.generated?.generatedCount} built, ${rec.generated?.matchCount} clear the bar.`}
              </p>
            </div>

            {/* Always available, not only when the search comes back empty.
                Wanting something new is a reason on its own. */}
            <Button
              variant="outline"
              className="rounded-full gap-2"
              disabled={rec.busy || rec.preset === null}
              onClick={() => void rec.regenerate()}
            >
              <RefreshCw className="w-4 h-4" />
              Build me a new one
            </Button>
          </div>

          {rec.match && rec.match.blockedBySafety > 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              {rec.match.blockedBySafety} recipe{rec.match.blockedBySafety === 1 ? "" : "s"} held back by
              your allergies.
            </p>
          )}

          {/* A constraint that could not be enforced is said out loud rather
              than folded into a clean-looking result. */}
          {rec.match && rec.match.unenforceableAllergies.length > 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              We don&apos;t track {rec.match.unenforceableAllergies.join(", ")} in our ingredients, so
              this wasn&apos;t filtered on it.
            </p>
          )}

          {rec.shown.recipes.length === 0 ? (
            <div className="rounded-2xl border bg-muted/30 p-8 text-center">
              <p className="text-muted-foreground">
                Nothing cleared the bar for this one. Try another kind of day, or{" "}
                <Link href="/builder" className="underline">
                  build it yourself
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rec.shown.recipes.map((r) => (
                <RecommendationCard
                  key={r.id}
                  recipe={r}
                  logged={rec.logged.includes(r.id)}
                  onLog={(id) => void handleLog(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
