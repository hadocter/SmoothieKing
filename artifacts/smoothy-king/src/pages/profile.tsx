import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListFavorites, useListRecipes, useListCreations, useGetUserProfile, useRemoveFavorite } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { UserCircle, Heart, Blend, Sparkles, Settings, Trash2, Plus, Activity, User, ShieldAlert, Award } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListFavoritesQueryKey, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { apiFetch } from "@/features/api";

/** Just the fields the blends tab renders. */
interface Blended {
  id: number;
  name: string;
  description: string | null;
  benefits: string[];
  calories: number | null;
  protein: number | null;
  published: boolean;
  ingredients: { name: string; amount: string; unit: string }[];
}

export default function MyPage() {
  const { user, token, isLoggedIn } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: favoriteIds, isLoading: loadingFavs } = useListFavorites();
  const { data: allRecipes, isLoading: loadingRecipes } = useListRecipes();
  const { data: creations, isLoading: loadingCreations } = useListCreations();
  // 404 means "hasn't onboarded yet", a normal state — retrying it would leave
  // the tab on a skeleton for several seconds before showing the empty state.
  const { data: profile, isLoading: loadingProfile } = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey(), retry: false },
  });
  const removeFavorite = useRemoveFavorite();

  /**
   * Blends this account actually made.
   *
   * Not everything generated for them. One trip through the builder produces
   * ten variants, deduplicates, and stores what is left — six rows, from one
   * use — because the batch is kept for history and to avoid rebuilding the
   * same drink. Those are candidates. Showing them all would fill the tab with
   * drinks nobody chose.
   *
   * What was made is what was logged at the end of the recipe, plus anything
   * published. Those two are the acts that mean "this one was mine", and the
   * generated-but-untouched rest are not.
   */
  const [myBlends, setMyBlends] = useState<Blended[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoadingMine(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [logs, mine] = await Promise.all([
          apiFetch<{ recipe: Blended | null }[]>("/api/smoothie-logs", token),
          apiFetch<Blended[]>("/api/recipes/mine", token),
        ]);
        if (cancelled) return;
        const byId = new Map<number, Blended>();
        for (const l of logs) if (l.recipe) byId.set(l.recipe.id, l.recipe);
        for (const r of mine) if (r.published) byId.set(r.id, r);
        setMyBlends([...byId.values()].sort((a, b) => b.id - a.id));
      } catch {
        if (!cancelled) setMyBlends([]);
      } finally {
        if (!cancelled) setLoadingMine(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isLoggedIn]);

  const [activeTab, setActiveTab] = useState("saved");

  if (!isLoggedIn) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-card p-8 rounded-3xl border shadow-sm">
          <UserCircle className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="font-serif text-3xl font-medium mb-3">Login Required</h2>
          <p className="text-muted-foreground mb-6">Please log in to view your personal saved rituals and custom blends.</p>
          <Link href="/login">
            <Button size="lg" className="rounded-full px-8">Log In Now</Button>
          </Link>
        </div>
      </div>
    );
  }

  const savedRecipes = Array.isArray(allRecipes)
    ? allRecipes.filter((r) => Array.isArray(favoriteIds) && favoriteIds.includes(r.id))
    : [];

  /**
   * Board posts, matched back by recipe id, for the like count and the link.
   *
   * `recipeId` is read off the value rather than through the generated type:
   * the OpenAPI spec has not caught up with the build flow, and the server
   * reads it the same defensive way for the same reason.
   */
  const postFor = (recipeId: number) =>
    Array.isArray(creations)
      ? creations.find((c) => (c as { recipeId?: number }).recipeId === recipeId)
      : undefined;

  const handleRemoveFavorite = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    removeFavorite.mutate(
      { recipeId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background pt-8 pb-24">
      <div className="container mx-auto px-4 max-w-5xl">
        
        {/* Profile Banner */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border rounded-3xl p-8 mb-10 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30 text-primary">
                <UserCircle className="w-12 h-12" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-serif text-3xl font-medium">{user?.nickname}</h1>
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold uppercase tracking-wider">
                    Member
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="rounded-full gap-2"
                onClick={() => setLocation("/onboarding")}
              >
                <Settings className="w-4 h-4" /> Edit Preferences
              </Button>
              <Button
                className="rounded-full gap-2 shadow-lg shadow-primary/20"
                onClick={() => setLocation("/builder")}
              >
                <Plus className="w-4 h-4" /> Create New Blend
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs navigation */}
        <Tabs defaultValue="saved" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-10 h-12 rounded-full p-1 bg-muted">
            <TabsTrigger value="saved" className="rounded-full gap-2 text-sm font-medium">
              <Heart className="w-4 h-4 text-destructive" />
              Saved ({savedRecipes.length})
            </TabsTrigger>
            <TabsTrigger value="creations" className="rounded-full gap-2 text-sm font-medium">
              <Blend className="w-4 h-4 text-primary" />
              My Blends ({myBlends.length})
            </TabsTrigger>
            <TabsTrigger value="health" className="rounded-full gap-2 text-sm font-medium">
              <Activity className="w-4 h-4 text-emerald-600" />
              Health Profile
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Saved Rituals (Favorites) ── */}
          <TabsContent value="saved" className="mt-0">
            {loadingFavs || loadingRecipes ? (
              <div className="grid sm:grid-cols-2 gap-6">
                <Skeleton className="h-40 rounded-3xl" />
                <Skeleton className="h-40 rounded-3xl" />
              </div>
            ) : savedRecipes.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-3xl border border-dashed p-8">
                <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="font-serif text-2xl font-medium mb-2">No Saved Rituals Yet</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Click the heart icon on any recipe to save it to your personal collection.
                </p>
                <Link href="/recipes">
                  <Button size="lg" className="rounded-full px-8">Explore Official Recipes</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {savedRecipes.map((recipe) => (
                  <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="group block">
                    <div className="bg-card border rounded-3xl p-5 flex items-center gap-6 hover:shadow-md transition-all duration-300">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-muted">
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>

                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {(recipe.benefits || []).map((b: string) => (
                            <span
                              key={b}
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                GOAL_COLORS[b] || "bg-muted"
                              }`}
                            >
                              {GOAL_LABELS[b] || b}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-serif text-2xl font-medium truncate mb-1">{recipe.name}</h3>
                        <p className="text-muted-foreground text-sm truncate">{recipe.tagline}</p>
                      </div>

                      <div className="pr-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={(e) => handleRemoveFavorite(e, recipe.id)}
                          title="Remove from favorites"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TAB 2: My Custom Blends (Creations) ── */}
          <TabsContent value="creations" className="mt-0">
            {loadingMine ? (
              <div className="grid sm:grid-cols-2 gap-6">
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-48 rounded-3xl" />
              </div>
            ) : myBlends.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-3xl border border-dashed p-8">
                <Blend className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="font-serif text-2xl font-medium mb-2">No Custom Blends Created Yet</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Design your own functional smoothie in the Smoothie Builder lab and save it to your profile.
                </p>
                <Link href="/builder">
                  <Button size="lg" className="rounded-full px-8 gap-2">
                    <Plus className="w-5 h-5" /> Open Smoothie Builder
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {myBlends.map((blend) => {
                  const post = postFor(blend.id);
                  return (
                    <div key={blend.id} className="bg-card border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4 gap-2">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${GOAL_COLORS[blend.benefits?.[0] ?? ""] || "bg-primary/10 text-primary"}`}>
                            {GOAL_LABELS[blend.benefits?.[0] ?? ""] || "Custom"}
                          </span>
                          {/* Says which state it is in, rather than leaving a
                              private drink looking like a failed post. */}
                          {post ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 text-destructive fill-destructive" /> {post.likes}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Only you</span>
                          )}
                        </div>

                        <h3 className="font-serif text-2xl font-medium mb-2">{blend.name}</h3>
                        {blend.description && (
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-4 italic">
                            &ldquo;{blend.description}&rdquo;
                          </p>
                        )}

                        <div className="space-y-1 border-t pt-3 mb-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Ingredients:</span>
                          {blend.ingredients?.map((ing, i) => (
                            <div key={i} className="text-xs flex justify-between text-foreground">
                              <span>• {ing.name}</span>
                              <span className="text-muted-foreground">{ing.amount} {ing.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground border-t pt-3 flex justify-between items-center">
                        <span>
                          {blend.calories === null ? "Calories not known" : `${blend.calories} kcal`}
                          {blend.protein !== null && ` · ${blend.protein}g protein`}
                        </span>
                        <Link href={post ? "/community" : `/recipes/${blend.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                            {post ? "View on Community" : "View"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── TAB 3: Health Profile (Onboarding Data) ── */}
          <TabsContent value="health" className="mt-0">
            {loadingProfile ? (
              <Skeleton className="h-64 rounded-3xl" />
            ) : profile ? (
              <div className="space-y-6">
                <div className="bg-card border rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b">
                    <h3 className="font-serif text-2xl font-medium flex items-center gap-2">
                      <User className="w-6 h-6 text-primary" /> Body Baseline
                    </h3>
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setLocation("/onboarding")}>
                      Update Baseline
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                    <div className="p-4 bg-muted/40 rounded-2xl">
                      <span className="text-xs text-muted-foreground uppercase font-semibold block mb-1">Gender</span>
                      <span className="font-serif text-2xl font-bold capitalize">{profile.gender || "Not set"}</span>
                    </div>
                    <div className="p-4 bg-muted/40 rounded-2xl">
                      <span className="text-xs text-muted-foreground uppercase font-semibold block mb-1">Age</span>
                      <span className="font-serif text-2xl font-bold">{profile.age ? `${profile.age} yrs` : "Not set"}</span>
                    </div>
                    <div className="p-4 bg-muted/40 rounded-2xl">
                      <span className="text-xs text-muted-foreground uppercase font-semibold block mb-1">Height</span>
                      <span className="font-serif text-2xl font-bold">{profile.height ? `${profile.height} cm` : "Not set"}</span>
                    </div>
                    <div className="p-4 bg-muted/40 rounded-2xl">
                      <span className="text-xs text-muted-foreground uppercase font-semibold block mb-1">Weight</span>
                      <span className="font-serif text-2xl font-bold">{profile.weight ? `${profile.weight} kg` : "Not set"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Goals */}
                  <div className="bg-card border rounded-3xl p-6 shadow-sm">
                    <h3 className="font-serif text-xl font-medium mb-4 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" /> Smoothie Intentions
                    </h3>

                    {profile.primaryGoal && (
                      <div className="mb-4">
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-2">Primary Focus</span>
                        <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${GOAL_COLORS[profile.primaryGoal]}`}>
                          <Sparkles className="w-4 h-4" /> {GOAL_LABELS[profile.primaryGoal] || profile.primaryGoal}
                        </span>
                      </div>
                    )}

                    {profile.secondaryGoals && profile.secondaryGoals.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-2">Secondary Priorities</span>
                        <div className="flex flex-wrap gap-2">
                          {profile.secondaryGoals.map((g) => (
                            <span key={g} className={`text-xs font-semibold px-3 py-1 rounded-full ${GOAL_COLORS[g] || 'bg-muted'}`}>
                              {GOAL_LABELS[g] || g}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Allergies & Filters */}
                  <div className="bg-card border rounded-3xl p-6 shadow-sm">
                    <h3 className="font-serif text-xl font-medium mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-destructive" /> Dietary Filters & Allergies
                    </h3>

                    {profile.allergies && profile.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {profile.allergies.map((a) => (
                          <span key={a} className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic mb-4">No allergen restrictions specified.</p>
                    )}

                    {profile.dislikedIngredients && profile.dislikedIngredients.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-2">Disliked Ingredients</span>
                        <div className="flex flex-wrap gap-2">
                          {profile.dislikedIngredients.map((ing) => (
                            <span key={ing} className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium line-through">
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-card rounded-3xl border border-dashed p-8">
                <Activity className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="font-serif text-2xl font-medium mb-2">No Health Profile Set Yet</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Complete the 4-step onboarding questionnaire to personalize your functional smoothie recommendations.
                </p>
                <Button size="lg" className="rounded-full px-8" onClick={() => setLocation("/onboarding")}>
                  Start Onboarding
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
