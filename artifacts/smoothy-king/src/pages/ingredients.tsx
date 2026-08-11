import { useListIngredients } from "@workspace/api-client-react";
import { GOALS, GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export default function Ingredients() {
  const { data: ingredients, isLoading } = useListIngredients();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!Array.isArray(ingredients)) return [];
    const q = search.toLowerCase();
    return ingredients.filter((i: any) => 
      i.name.toLowerCase().includes(q) || 
      i.category.toLowerCase().includes(q) ||
      (i.benefits || []).some((b: string) => b.toLowerCase().includes(q))
    );
  }, [ingredients, search]);

  return (
    <div className="min-h-screen bg-background pt-12 pb-24">
      <div className="container mx-auto px-4">
        
        <div className="max-w-4xl mx-auto mb-16 text-center">
          <h1 className="font-serif text-5xl font-medium mb-6">The Glossary</h1>
          <p className="text-muted-foreground text-lg mb-8 font-sans">
            A practical guide to every ingredient used by the Builder, with its role and catalog highlights.
          </p>
          <Input 
            placeholder="Search ingredients, categories, or benefits..." 
            className="h-14 rounded-full text-center text-lg max-w-xl mx-auto bg-card shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-3xl" />
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-20 text-muted-foreground">
              <p className="font-serif text-2xl">No ingredients found.</p>
            </div>
          ) : (
            filtered.map((ing: any) => (
              <div key={ing.id} className="bg-card rounded-3xl p-6 border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div
                  className="-mx-6 -mt-6 mb-5 h-36 overflow-hidden"
                  style={{ background: ing.gradient }}
                  aria-hidden="true"
                >
                  {ing.imageUrl && (
                    <img
                      src={ing.imageUrl}
                      alt=""
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Sparkles className="w-24 h-24" />
                </div>
                
                <div className="relative z-10">
                  <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2 block">
                    {ing.category}
                  </span>
                  <h3 className="font-serif text-3xl font-medium mb-1">{ing.name}</h3>
                  <p className="text-muted-foreground text-sm mb-6 line-clamp-3">
                    {ing.description}
                  </p>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1">
                        <Info className="w-3 h-3" /> Builder goals
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ing.benefits.map((b: string, i: number) => (
                          <span key={i} className={`text-xs px-2 py-1 rounded-md font-bold ${GOAL_COLORS[b] || 'bg-muted text-muted-foreground'}`}>
                            {GOAL_LABELS[b] || b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
