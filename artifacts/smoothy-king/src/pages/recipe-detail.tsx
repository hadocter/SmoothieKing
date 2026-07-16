import { AppLayout } from "@/components/layout/AppLayout";
import { useGetRecipe, useListFavorites, useAddFavorite, useRemoveFavorite, getGetRecipeQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Heart, Clock, Droplets, Flame, ChevronLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import placeholderImg from "@assets/generated_images/recipe-rose.jpg";
import { cn } from "@/lib/utils";

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const recipeId = Number(id);
  const queryClient = useQueryClient();

  const { data: recipe, isLoading } = useGetRecipe(recipeId, {
    query: { enabled: !!recipeId, queryKey: getGetRecipeQueryKey(recipeId) }
  });

  const { data: favorites = [] } = useListFavorites();
  const isFavorite = favorites.includes(recipeId);

  const addFav = useAddFavorite();
  const removeFav = useRemoveFavorite();

  const toggleFavorite = () => {
    if (isFavorite) {
      removeFav.mutate({ recipeId }, {
        onSuccess: () => {
          queryClient.setQueryData(['/api/favorites'], (old: number[] = []) => old.filter(fid => fid !== recipeId));
        }
      });
    } else {
      addFav.mutate({ data: { recipeId } }, {
        onSuccess: () => {
          queryClient.setQueryData(['/api/favorites'], (old: number[] = []) => [...old, recipeId]);
        }
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!recipe) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
          <h1 className="font-serif text-4xl text-foreground mb-4">Ritual not found</h1>
          <p className="text-muted-foreground font-sans mb-8">The recipe you're looking for doesn't exist.</p>
          <Link href="/recipes" className="px-6 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-widest hover:bg-primary/90 transition-colors">
            Return to Protocols
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <article className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <Link href="/recipes" className="inline-flex items-center text-xs font-sans uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-12">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Rituals
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left Column - Image */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="sticky top-28 aspect-[3/4] rounded-md overflow-hidden bg-muted">
              <img 
                src={recipe.imageUrl || placeholderImg} 
                alt={recipe.name} 
                className="w-full h-full object-cover"
              />
              {recipe.skinBenefitScore && (
                <div className="absolute top-4 left-4 bg-background/90 backdrop-blur text-foreground text-xs px-4 py-2 rounded-full font-sans tracking-wider border border-border/50 shadow-sm">
                  {recipe.skinBenefitScore}/10 Glow Factor
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column - Content */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="flex flex-col"
          >
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-accent">
                  {recipe.category}
                </span>
                <button 
                  onClick={toggleFavorite}
                  disabled={addFav.isPending || removeFav.isPending}
                  className="flex items-center gap-2 text-xs font-sans tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  <Heart className={cn("w-5 h-5 transition-colors", isFavorite ? "fill-primary text-primary" : "")} />
                  <span>{isFavorite ? "Saved" : "Save"}</span>
                </button>
              </div>
              <h1 className="text-5xl md:text-6xl font-serif text-foreground mb-4 leading-tight">
                {recipe.name}
              </h1>
              <p className="text-xl font-serif italic text-muted-foreground mb-6">
                {recipe.tagline}
              </p>
              {recipe.description && (
                <p className="text-sm font-sans leading-relaxed text-foreground/80">
                  {recipe.description}
                </p>
              )}
            </div>

            {/* Meta tags */}
            <div className="flex flex-wrap gap-6 py-6 border-y border-border/50 mb-10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-sans uppercase tracking-widest text-foreground">{recipe.prepTimeMinutes} mins</span>
              </div>
              {recipe.calories && (
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-sans uppercase tracking-widest text-foreground">{recipe.calories} kcal</span>
                </div>
              )}
              {recipe.protein && (
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-sans uppercase tracking-widest text-foreground">{recipe.protein}g protein</span>
                </div>
              )}
            </div>

            {/* Ingredients */}
            <div className="mb-12">
              <h2 className="text-2xl font-serif text-foreground mb-6">The Formulation</h2>
              <ul className="space-y-4">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-baseline justify-between py-3 border-b border-border/30 last:border-0 group">
                    <div className="flex items-baseline gap-2 mb-1 sm:mb-0">
                      <span className="font-serif text-lg text-foreground group-hover:text-primary transition-colors">{ing.name}</span>
                      <span className="text-xs font-sans text-muted-foreground">{ing.amount} {ing.unit}</span>
                    </div>
                    {ing.benefit && (
                      <span className="text-[10px] uppercase tracking-widest bg-secondary/20 text-secondary-foreground/70 px-2 py-1 rounded-sm">
                        {ing.benefit}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Steps */}
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-6">The Protocol</h2>
              <div className="space-y-6">
                {recipe.steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-sans tracking-widest">
                      {i + 1}
                    </div>
                    <p className="text-sm font-sans leading-relaxed text-foreground/90 pt-0.5">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        </div>
      </article>
    </AppLayout>
  );
}