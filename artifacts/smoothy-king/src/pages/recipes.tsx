import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListRecipes, useGetRecipesByBenefit, useListFavorites, useAddFavorite, useRemoveFavorite } from "@workspace/api-client-react";
import { Search, Heart, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_LABELS, gradientForGoals } from "@/lib/colors";
import { useQueryClient } from "@tanstack/react-query";
import { getListRecipesQueryKey, getListFavoritesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function Recipes() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data: recipes, isLoading } = useListRecipes({
    search: search.length > 2 ? search : undefined,
    category: category !== "all" ? category : undefined
  });

  const { data: favorites = [] } = useListFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const toggleFavorite = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // Prevent link click

    // Favorites are saved per account, so signed-out visitors are sent to log in
    // instead of silently hitting a 401.
    if (!isLoggedIn) {
      toast({
        title: "Log in to save recipes",
        description: "Your saved rituals are tied to your account.",
      });
      setLocation("/login");
      return;
    }

    if (favorites.includes(id)) {
      removeFavorite.mutate({ recipeId: id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() })
      });
    } else {
      addFavorite.mutate({ data: { recipeId: id } }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() })
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pt-12 pb-24">
      <div className="container mx-auto px-4">
        
        {/* Header & Search */}
        <div className="max-w-4xl mx-auto mb-16">
          <h1 className="font-serif text-5xl font-medium mb-6">Official Recipes</h1>
          <p className="text-muted-foreground text-lg mb-8 font-sans">
            Expertly crafted blends by the Smoothy King lab. Every ingredient serves a purpose.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Search by ingredient, name, or benefit..." 
                className="pl-12 h-14 rounded-full text-base bg-card shadow-sm border-muted-foreground/20"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              {['all', 'smoothie', 'shaker', 'meal'].map(cat => (
                <Button 
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  onClick={() => setCategory(cat)}
                  className={`h-14 px-6 rounded-full capitalize whitespace-nowrap ${category === cat ? 'shadow-md' : 'bg-card'}`}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Builder Promo */}
        <div className="bg-primary/5 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 mb-16 border border-primary/10">
          <div>
            <h2 className="font-serif text-3xl font-medium mb-3 text-primary">Prefer to make your own?</h2>
            <p className="text-muted-foreground max-w-xl text-lg">Use our Builder to construct a functional smoothie based on your exact goals, watch your benefit score rise, and publish it to the community.</p>
          </div>
          <Link href="/builder">
            <Button size="lg" className="rounded-full whitespace-nowrap h-14 px-8 text-lg gap-2 shadow-lg shadow-primary/20">
              Open the Builder <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
            ))
          ) : !Array.isArray(recipes) || recipes.length === 0 ? (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              <p className="font-serif text-2xl">No recipes found matching your criteria.</p>
            </div>
          ) : (
            recipes.map((recipe: any) => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="group block">
                <div
                  className="relative aspect-[4/5] rounded-3xl overflow-hidden mb-4 bg-muted shadow-sm group-hover:shadow-xl transition-all duration-500"
                  style={recipe.imageUrl ? undefined : { background: gradientForGoals(recipe.benefits) }}
                >
                  {recipe.imageUrl && (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90" />
                  
                  {/* Top Bar */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <div className="flex gap-2 flex-wrap max-w-[70%]">
                      {(recipe.benefits || []).slice(0, 2).map((benefit: string) => (
                        <span 
                          key={benefit} 
                          className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm ${GOAL_COLORS[benefit] || 'bg-white text-black'}`}
                        >
                          {GOAL_LABELS[benefit] || benefit}
                        </span>
                      ))}
                    </div>
                    <button 
                      onClick={(e) => toggleFavorite(e, recipe.id)}
                      className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition-colors shadow-sm mix-blend-hard-light"
                    >
                      <Heart className={`w-5 h-5 transition-transform ${favorites.includes(recipe.id) ? 'fill-white text-white scale-110' : 'text-white'}`} />
                    </button>
                  </div>

                  {/* Bottom Content */}
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-white font-serif text-3xl font-medium mb-1 line-clamp-1">{recipe.name}</h3>
                    <p className="text-white/80 text-sm font-medium tracking-wide line-clamp-1 mb-4">{recipe.tagline}</p>
                    
                    <div className="flex items-center justify-between text-white/70 text-xs font-medium uppercase tracking-wider">
                      <span>{recipe.prepTimeMinutes} MIN</span>
                      <span>{recipe.ingredients.length} INGREDIENTS</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
