import { AppLayout } from "@/components/layout/AppLayout";
import { RecipeCard } from "@/components/ui/recipe-card";
import { useListFavorites, useListRecipes } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Favorites() {
  const { data: favorites, isLoading: favsLoading } = useListFavorites();
  const { data: allRecipes, isLoading: recipesLoading } = useListRecipes();

  const isLoading = favsLoading || recipesLoading;
  const favoriteRecipes = allRecipes?.filter(r => favorites?.includes(r.id)) || [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 min-h-[60vh]">
        <header className="mb-16">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-serif text-foreground mb-4"
          >
            Saved Rituals
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-muted-foreground font-sans text-sm tracking-widest uppercase"
          >
            Your personal wellness protocols
          </motion.p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {[1,2,3,4].map(i => (
              <div key={i} className="aspect-[4/5] bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : favoriteRecipes.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 text-center border border-border bg-card/30 rounded-lg shadow-sm"
          >
            <h2 className="font-serif text-3xl text-foreground mb-3">Your library is empty</h2>
            <p className="text-sm font-sans text-muted-foreground mb-8 max-w-md">
              You haven't saved any protocols yet. Explore our collection of functional recipes to build your daily routine.
            </p>
            <Link 
              href="/recipes" 
              className="px-8 py-3 bg-primary text-primary-foreground font-sans text-xs tracking-[0.15em] uppercase hover:bg-primary/90 transition-colors"
            >
              Explore Rituals
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 gap-y-12">
            {favoriteRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id} recipe={recipe} index={i} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}