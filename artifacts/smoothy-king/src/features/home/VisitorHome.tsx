import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetFeaturedRecipes } from "@workspace/api-client-react";
import { ArrowRight, ArrowUpRight, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_LABELS, GOALS, gradientForGoals } from "@/lib/colors";
import { getCatalogStats, type CatalogStats } from "./index";

/**
 * The page for someone who has no account.
 *
 * It has one job — say what this is well enough to be worth signing up for —
 * and two rules that come out of the rest of the system.
 *
 * It describes the flow that exists. The five steps here used to describe
 * choosing ingredients by hand and watching a score rise, which was the
 * product two rewrites ago; a landing page is the last thing anyone rereads
 * and the first thing a visitor believes.
 *
 * And every number on it is counted. What sat here before was 2,841 members
 * and 19,260 rituals completed, invented on the server and invented a second
 * time in the client as a fallback, next to three stock photographs standing
 * in for recipes. Those are cheap on a page whose argument is that the
 * allergen check cannot be talked out of anything.
 */
export function VisitorHome() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const { data: featured, isLoading: featuredLoading } = useGetFeaturedRecipes();

  useEffect(() => {
    let cancelled = false;
    // A landing page that fails to load a statistic should still be a landing
    // page. Nothing renders in its place.
    getCatalogStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const realFeatured = Array.isArray(featured) ? featured.slice(0, 3) : [];

  return (
    <div className="flex flex-col w-full">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative w-full min-h-[88dvh] flex items-center pt-16 pb-24 overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,var(--color-goal-glowy)_0%,transparent_30%),radial-gradient(circle_at_bottom_left,var(--color-goal-hydration)_0%,transparent_30%)] opacity-20" />
        <div className="absolute inset-0 z-0 bg-background/40 backdrop-blur-[100px]" />

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Personalised functional smoothies</span>
          </div>

          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-foreground max-w-5xl leading-[1.1] mb-8">
            Tell us what you&rsquo;re after.
            <br className="hidden md:block" />
            <span className="italic text-primary"> We&rsquo;ll build the glass.</span>
          </h1>

          <p className="font-sans text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
            Say it in your own words — a wedding in eight weeks, shoulders that
            are wrecked, just something light. We turn that into a goal, and
            build six drinks around it every morning.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform duration-300"
              >
                Start with a goal
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-background/50 backdrop-blur hover:bg-background/80"
              >
                I have an account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- how it works */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl font-medium mb-4">How a morning goes</h2>
            <p className="text-muted-foreground font-sans text-lg">
              Once at the start, then about a minute a day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 max-w-6xl mx-auto">
            {[
              { num: "01", title: "Set a goal", desc: "In your own words, for a stretch of weeks. We file it under one of eight.", color: "bg-goal-glowy" },
              { num: "02", title: "Say what today is like", desc: "Taste, time, anything extra. A sentence is enough.", color: "bg-goal-hydration" },
              { num: "03", title: "Six get built", desc: "Around your goal, past your allergens, inside the minutes you have.", color: "bg-goal-anti" },
              { num: "04", title: "Watch it pour", desc: "Calories, protein and goal fit as the glass fills. Real figures.", color: "bg-goal-protein" },
              { num: "05", title: "Make it", desc: "Step by step. Publish it to the wall if you want to.", color: "bg-goal-detox" },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center group">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-serif text-white shadow-lg mb-6 transition-transform group-hover:scale-110 ${step.color}`}
                >
                  {step.num}
                </div>
                <h3 className="font-serif text-xl font-medium mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground font-sans">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------- what it's built on */}
      {stats && (
        <section className="py-24 relative bg-primary text-primary-foreground overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-serif text-4xl md:text-6xl font-medium mb-6 leading-tight">
                  A closed shelf,
                  <br />
                  <span className="italic opacity-80">and a very large menu.</span>
                </h2>
                <p className="font-sans text-lg opacity-80 mb-6 max-w-md">
                  Every drink is built from {stats.ingredients} ingredients we
                  hold the full record for — what is in them, what they are
                  made of, and what they contain that someone might react to.
                </p>
                <p className="font-sans opacity-70 max-w-md flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>
                    Because the shelf is closed, the allergen check is a lookup
                    rather than a judgement. Nothing we cannot check is
                    something we can offer.
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Stat value={stats.combinations.toLocaleString()} label="Possible drinks" highlight />
                <Stat value={stats.ingredients} label="Ingredients on the shelf" />
                <Stat value={GOALS.length} label="Goals to build toward" />
                <Stat value={stats.allergenClasses} label="Allergen classes filtered" />
              </div>
            </div>

            {/* The skeleton the number comes from, stated rather than asserted. */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-2 text-sm opacity-80">
              {stats.bySlot.map((s, i) => (
                <span key={s.slot} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="opacity-40 mx-1">→</span>}
                  <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15">
                    {s.slot}
                    {s.picks > 1 && ` ×${s.picks}`}
                    {s.optional && <span className="opacity-60"> (optional)</span>}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------- real recipes */}
      {(featuredLoading || realFeatured.length > 0) && (
        <section className="py-24 container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              {/* `/recipes/featured` is the curated shelf, not the community
                  board. Calling these member creations would be a new false
                  claim on a page the rest of this change exists to clean up. */}
              <h2 className="font-serif text-4xl font-medium mb-3">From the shelf</h2>
              <p className="text-muted-foreground font-sans">
                Recipes we wrote, for when you would rather not start from a goal.
              </p>
            </div>
            <Link
              href="/recipes"
              className="hidden md:flex items-center gap-2 text-primary font-medium hover:underline"
            >
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
                ))
              : realFeatured.map((recipe) => (
                  <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="group block">
                    <div
                      className="relative aspect-[4/5] rounded-3xl overflow-hidden mb-4 bg-muted"
                      // No photograph is an ordinary state — most drinks are
                      // built rather than shot. The card falls back to the
                      // drink's own goal colours instead of a stock image of
                      // somebody else's smoothie.
                      style={
                        recipe.imageUrl ? undefined : { background: gradientForGoals(recipe.benefits) }
                      }
                    >
                      {recipe.imageUrl && (
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-6 left-6 right-6">
                        <div className="flex gap-2 flex-wrap mb-3">
                          {(recipe.benefits ?? []).slice(0, 2).map((benefit: string) => (
                            <span
                              key={benefit}
                              className={`text-xs font-bold px-2.5 py-1 rounded-full ${GOAL_COLORS[benefit] || "bg-white text-black"}`}
                            >
                              {GOAL_LABELS[benefit] || benefit}
                            </span>
                          ))}
                        </div>
                        <h3 className="text-white font-serif text-2xl font-medium">{recipe.name}</h3>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- closing */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-6">
            {stats ? `${stats.combinations.toLocaleString()} possible drinks.` : "A lot of possible drinks."}
            <br />
            <span className="italic text-primary">One of them is yours.</span>
          </h2>
          <Link href="/signup">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full gap-2 mt-4">
              Set your first goal
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({
  value,
  label,
  highlight = false,
}: {
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-3xl flex flex-col justify-between aspect-square ${
        highlight ? "bg-white text-primary" : "bg-white/10 backdrop-blur border border-white/10"
      }`}
    >
      <div className="mt-auto">
        <div className={`text-3xl font-serif font-medium mb-1 ${highlight ? "text-primary" : "text-white"}`}>
          {value}
        </div>
        <div className={`text-sm font-sans ${highlight ? "text-primary/70" : "text-white/70"}`}>
          {label}
        </div>
      </div>
    </div>
  );
}
