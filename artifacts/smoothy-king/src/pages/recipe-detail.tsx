import { useRoute, Link } from "wouter";
import { useGetRecipe, useListFavorites, useAddFavorite, useRemoveFavorite } from "@workspace/api-client-react";
import { Heart, Clock, Users, Flame, ArrowLeft, Blend, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { useQueryClient } from "@tanstack/react-query";
import { getListFavoritesQueryKey } from "@workspace/api-client-react";

export default function RecipeDetail() {
  const [, params] = useRoute("/recipes/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  
  const { data: recipe, isLoading } = useGetRecipe(id);
  const { data: favorites = [] } = useListFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const queryClient = useQueryClient();

  const isFav = favorites.includes(id);

  const toggleFavorite = () => {
    if (isFav) {
      removeFavorite.mutate({ recipeId: id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() })
      });
    } else {
      addFavorite.mutate({ data: { recipeId: id } }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() })
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="grid md:grid-cols-2 gap-12">
          <Skeleton className="aspect-square rounded-3xl" />
          <div className="space-y-6">
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h1 className="font-serif text-4xl mb-4">Recipe Not Found</h1>
        <Link href="/recipes"><Button variant="outline">Back to Recipes</Button></Link>
      </div>
    );
  }

  return (
    <div className="bg-background pb-32">
      {/* Top Navigation */}
      <div className="container mx-auto px-4 py-6 flex items-center justify-between">
        <Link href="/recipes" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex gap-2">
          <Link href={`/builder?recipe=${recipe.id}`}>
            <Button variant="outline" className="rounded-full gap-2 hidden sm:flex">
              <Blend className="w-4 h-4" /> Remix in Builder
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-card shadow-sm border"
            onClick={toggleFavorite}
          >
            <Heart className={`w-5 h-5 ${isFav ? 'fill-destructive text-destructive' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-start">
          
          {/* Image Side */}
          <div className="sticky top-24">
            <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl">
              <img 
                src={recipe.imageUrl || "https://images.unsplash.com/photo-1553530666-ba11a7dd0dc9?auto=format&fit=crop&q=80&w=1200"} 
                alt={recipe.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent mix-blend-multiply" />
            </div>
          </div>

          {/* Content Side */}
          <div className="py-8">
            <div className="flex flex-wrap gap-3 mb-6">
              {recipe.benefits.map((benefit) => (
                <span 
                  key={benefit} 
                  className={`text-sm font-bold px-4 py-1.5 rounded-full ${GOAL_COLORS[benefit] || 'bg-primary text-primary-foreground'}`}
                >
                  {GOAL_LABELS[benefit] || benefit}
                </span>
              ))}
            </div>

            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium mb-4 leading-[1.1]">{recipe.name}</h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-serif italic mb-8">{recipe.tagline}</p>
            
            {recipe.description && (
              <p className="font-sans text-lg leading-relaxed mb-10 text-foreground/90">
                {recipe.description}
              </p>
            )}

            <div className="grid grid-cols-3 gap-6 p-6 bg-card rounded-3xl border shadow-sm mb-12">
              <div className="flex flex-col items-center text-center gap-1 border-r">
                <Clock className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Time</span>
                <span className="font-serif text-2xl font-medium">{recipe.prepTimeMinutes}m</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1 border-r">
                <Users className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Serves</span>
                <span className="font-serif text-2xl font-medium">{recipe.servings}</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <Flame className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Calories</span>
                <span className="font-serif text-2xl font-medium">{recipe.calories || '--'}</span>
              </div>
            </div>

            <div className="mb-12">
              <h2 className="font-serif text-3xl font-medium mb-6">Functional Ingredients</h2>
              <ul className="space-y-4">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between items-center py-4 border-b group">
                    <div>
                      <div className="font-medium text-lg flex items-center gap-2">
                        {ing.name}
                        {ing.benefit && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider font-bold">
                            {GOAL_LABELS[ing.benefit] || 'Functional'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-serif text-xl text-muted-foreground">
                      {ing.amount} {ing.unit}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-3xl font-medium mb-6">The Ritual</h2>
              <ol className="space-y-6">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif text-lg">
                      {i + 1}
                    </div>
                    <p className="text-lg pt-0.5 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-16 bg-primary/5 rounded-3xl p-8 border border-primary/10 text-center sm:hidden">
              <h3 className="font-serif text-2xl font-medium mb-2 text-primary">Inspired?</h3>
              <p className="text-muted-foreground mb-6">Customize this recipe using the Builder.</p>
              <Link href={`/builder?recipe=${recipe.id}`}>
                <Button size="lg" className="w-full rounded-full gap-2">
                  <Blend className="w-5 h-5" /> Remix in Builder
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
