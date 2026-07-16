import { AppLayout } from "@/components/layout/AppLayout";
import { RecipeCard } from "@/components/ui/recipe-card";
import { useListRecipes } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "All Rituals" },
  { id: "smoothie", label: "Smoothies" },
  { id: "shaker", label: "Protein Shakers" },
  { id: "meal", label: "Healthy Meals" },
];

const BENEFITS = [
  { id: "glowy-skin", label: "Glowy Skin" },
  { id: "hydration", label: "Hydration" },
  { id: "anti-inflammatory", label: "Anti-Inflammatory" },
  { id: "detox", label: "Detox" },
  { id: "sun-ritual", label: "Sun Ritual" },
  { id: "protein", label: "Protein" },
];

export default function Recipes() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [benefit, setBenefit] = useState<string | undefined>(undefined);

  // Read initial params from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    const ben = params.get("benefit");
    if (cat) setCategory(cat);
    if (ben) setBenefit(ben);
  }, []);

  const { data: recipes, isLoading } = useListRecipes({ 
    category: category === "all" ? undefined : category, 
    benefit: benefit === "all" ? undefined : benefit 
  });

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-16 text-center max-w-2xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-serif text-foreground mb-6"
          >
            The Rituals
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-muted-foreground font-sans text-sm md:text-base leading-relaxed"
          >
            A curated collection of functional recipes designed to nourish your body and skin from the cellular level.
          </motion.p>
        </header>

        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar Filters */}
          <aside className="md:w-64 flex-shrink-0">
            <div className="sticky top-28 space-y-10">
              {/* Category Filter */}
              <div>
                <h3 className="text-xs font-sans tracking-[0.15em] uppercase text-muted-foreground mb-4">Format</h3>
                <div className="flex flex-col gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id === category ? undefined : cat.id)}
                      className={cn(
                        "text-left font-serif text-lg transition-colors duration-300",
                        (category === cat.id || (cat.id === "all" && !category))
                          ? "text-primary" 
                          : "text-foreground/60 hover:text-foreground"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Benefit Filter */}
              <div>
                <h3 className="text-xs font-sans tracking-[0.15em] uppercase text-muted-foreground mb-4">Targeted Benefit</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBenefit(undefined)}
                    className={cn(
                      "text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors",
                      !benefit 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    All Benefits
                  </button>
                  {BENEFITS.map(ben => (
                    <button
                      key={ben.id}
                      onClick={() => setBenefit(ben.id === benefit ? undefined : ben.id)}
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors",
                        benefit === ben.id 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {ben.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="aspect-[4/5] bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : recipes?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center border border-dashed border-border rounded-lg bg-card/30">
                <p className="font-serif text-2xl text-foreground mb-2">No rituals found.</p>
                <p className="text-sm font-sans text-muted-foreground">Try adjusting your filters to discover more.</p>
                <button 
                  onClick={() => { setCategory(undefined); setBenefit(undefined); }}
                  className="mt-6 text-xs uppercase tracking-widest text-primary border-b border-primary/30 hover:border-primary pb-1 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 gap-y-16">
                {recipes?.map((recipe, i) => (
                  <RecipeCard key={recipe.id} recipe={recipe} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}