import { useListFavorites, useListRecipes, useRemoveFavorite } from "@workspace/api-client-react";
import { Heart, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { useQueryClient } from "@tanstack/react-query";
import { getListFavoritesQueryKey } from "@workspace/api-client-react";

export default function Favorites() {
  const { data: favoriteIds, isLoading: loadingFavs } = useListFavorites();
  const { data: allRecipes, isLoading: loadingRecipes } = useListRecipes();
  const removeFavorite = useRemoveFavorite();
  const queryClient = useQueryClient();

  const isLoading = loadingFavs || loadingRecipes;
  
  const favoriteRecipes = allRecipes?.filter(r => favoriteIds?.includes(r.id)) || [];

  const handleRemove = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    removeFavorite.mutate({ recipeId: id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() })
    });
  };

  return (
    <div className="min-h-screen bg-background pt-12 pb-24">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-12 border-b pb-6">
          <div>
            <h1 className="font-serif text-4xl font-medium flex items-center gap-3">
              <Heart className="w-8 h-8 text-destructive fill-destructive" />
              Saved Rituals
            </h1>
            <p className="text-muted-foreground mt-2">Your personal collection of formulas.</p>
          </div>
          <div className="text-xl font-serif text-muted-foreground">
            {favoriteRecipes.length} saved
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-6">
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
          </div>
        ) : favoriteRecipes.length === 0 ? (
          <div className="text-center py-32 bg-card rounded-3xl border border-dashed">
            <Heart className="w-16 h-16 text-muted mx-auto mb-6" />
            <h2 className="font-serif text-3xl font-medium mb-4">No rituals saved yet.</h2>
            <p className="text-muted-foreground mb-8">Browse the official recipes or the community wall to find your next blend.</p>
            <Link href="/recipes"><Button size="lg" className="rounded-full">Explore Recipes</Button></Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {favoriteRecipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="group block">
                <div className="bg-card border rounded-3xl p-4 flex items-center gap-6 hover:shadow-md transition-shadow">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0">
                    <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  
                  <div className="flex-1 min-w-0 py-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {recipe.benefits.map(b => (
                        <span key={b} className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${GOAL_COLORS[b] || 'bg-muted'}`}>
                          {GOAL_LABELS[b] || b}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-serif text-2xl font-medium truncate mb-1">{recipe.name}</h3>
                    <p className="text-muted-foreground text-sm truncate">{recipe.tagline}</p>
                  </div>

                  <div className="pr-4 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                      onClick={(e) => handleRemove(e, recipe.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
