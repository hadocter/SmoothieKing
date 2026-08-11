import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { GOALS, GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Heart, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { getCommunityCreations, setCommunityLike, type CommunityCreation } from "@/features/community";

export default function Community() {
  const [goalFilter, setGoalFilter] = useState<string>("all");
  const [sortParam, setSortParam] = useState<string>("recent");
  
  const [creations, setCreations] = useState<CommunityCreation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { token, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const queryParams = {
    sort: sortParam,
    ...(goalFilter !== "all" ? { goal: goalFilter } : {})
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCommunityCreations(token, queryParams)
      .then((rows) => !cancelled && setCreations(rows))
      .catch(() => !cancelled && setCreations([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, sortParam, goalFilter]);

  const toggleLike = async (creation: CommunityCreation) => {
    if (!isLoggedIn) {
      toast({ title: "Log in to like a blend", description: "Likes are saved to your account." });
      setLocation("/login");
      return;
    }

    const nextLiked = !creation.likedByMe;
    setCreations((rows) => rows?.map((row) => row.id === creation.id
      ? { ...row, likedByMe: nextLiked, likes: Math.max(0, row.likes + (nextLiked ? 1 : -1)) }
      : row) ?? null);
    try {
      const updated = await setCommunityLike(creation.id, nextLiked, token);
      setCreations((rows) => rows?.map((row) => row.id === creation.id ? updated : row) ?? null);
    } catch {
      setCreations((rows) => rows?.map((row) => row.id === creation.id ? creation : row) ?? null);
      toast({ title: "Couldn't save that like", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pt-8 pb-24">
      <div className="container mx-auto px-4">
        
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <h1 className="font-serif text-5xl font-medium mb-4">The Community Wall</h1>
          <p className="text-muted-foreground font-sans text-lg">
            Discover what others are blending. Real recipes built by members for real functional goals.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-12 items-center justify-between bg-card p-4 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
            <Button 
              variant={goalFilter === "all" ? "default" : "outline"} 
              onClick={() => setGoalFilter("all")}
              className="rounded-full whitespace-nowrap"
            >
              All Goals
            </Button>
            {GOALS.map(goal => (
              <Button 
                key={goal}
                variant={goalFilter === goal ? "default" : "outline"} 
                onClick={() => setGoalFilter(goal)}
                className={`rounded-full whitespace-nowrap ${goalFilter === goal ? GOAL_COLORS[goal] : ''} ${goalFilter === goal ? 'border-transparent' : ''}`}
              >
                {GOAL_LABELS[goal]}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={sortParam} onValueChange={setSortParam}>
              <SelectTrigger className="w-[140px] rounded-full bg-background">
                <SlidersHorizontal className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[400px] rounded-3xl" />
            ))
          ) : creations?.length === 0 ? (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              <p className="font-serif text-2xl mb-2">No blends found</p>
              <p>Be the first to publish a blend for this goal.</p>
            </div>
          ) : (
            creations?.map(creation => {
              const isLiked = creation.likedByMe;
              
              return (
                <div key={creation.id} className="group bg-card rounded-3xl overflow-hidden border hover:shadow-xl transition-all duration-300 flex flex-col">
                  {/* Color Header */}
                  <div 
                    className="h-32 relative flex p-6 items-start justify-between transition-colors"
                    style={{ backgroundColor: creation.colorHex || 'var(--primary)' }}
                  >
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white shadow-sm mix-blend-hard-light`}>
                      {GOAL_LABELS[creation.goal] || creation.goal}
                    </span>
                    
                    <button 
                      onClick={() => toggleLike(creation)}
                      aria-label={isLiked ? `Unlike ${creation.name}` : `Like ${creation.name}`}
                      aria-pressed={isLiked}
                      className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition-colors shadow-sm mix-blend-hard-light"
                    >
                      <Heart className={`w-5 h-5 transition-transform ${isLiked ? 'fill-white text-white scale-110' : 'text-white'}`} />
                    </button>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-serif text-lg font-medium text-foreground">
                        {creation.authorInitials || creation.authorName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{creation.authorName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(creation.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    <h3 className="font-serif text-2xl font-semibold mb-3 line-clamp-1">{creation.name}</h3>
                    
                    {creation.story && (
                      <p className="text-muted-foreground text-sm mb-6 line-clamp-3 italic font-serif">
                        "{creation.story}"
                      </p>
                    )}

                    <div className="mt-auto">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Ingredients</div>
                      <div className="flex flex-wrap gap-1.5">
                        {creation.ingredients.slice(0, 5).map((ing, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-1 rounded-md text-foreground">
                            {ing.name}
                          </span>
                        ))}
                        {creation.ingredients.length > 5 && (
                          <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                            +{creation.ingredients.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4 fill-current text-destructive/70" />
                      {creation.likes} likes
                    </div>
                    {creation.recipeId ? (
                      <Link href={`/builder?recipe=${creation.recipeId}`}>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-primary font-medium opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        >
                          Create it <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-xs">Recipe details unavailable</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
