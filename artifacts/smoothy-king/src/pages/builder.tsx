import { useState, useMemo, useEffect } from "react";
import { useListIngredients, useCreateCreation, RecipeIngredient } from "@workspace/api-client-react";
import { GOALS, GOAL_COLORS, GOAL_LABELS, GOAL_HEX } from "@/lib/colors";
import { Blend, Plus, X, ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { AllergenScan, type SafetyReport } from "@/components/builder/allergen-scan";

// Animation utility class for bouncing elements
const bounceClass = "animate-in zoom-in-95 duration-300";

export default function Builder() {
  const [step, setStep] = useState<number>(1);
  const [goal, setGoal] = useState<string>("glowy-skin");
  const [selectedIngredients, setSelectedIngredients] = useState<RecipeIngredient[]>([]);
  
  const [name, setName] = useState("");
  const [story, setStory] = useState("");
  const [authorName, setAuthorName] = useState("");
  
  const { token } = useAuth();
  const { data: allIngredients, isLoading: loadingIngredients } = useListIngredients();

  /**
   * The allergen check for what is currently in the glass.
   *
   * Run when the final step opens rather than on every ingredient tap: the
   * point of the scene is a verification of the finished drink, and a badge
   * that flickers as you build teaches people to ignore it. Re-run whenever
   * the contents change, so going back a step and editing cannot leave a
   * stale "clear" on screen.
   */
  const [safety, setSafety] = useState<SafetyReport | null>(null);
  const [safetyFailed, setSafetyFailed] = useState(false);
  useEffect(() => {
    if (step !== 3 || selectedIngredients.length === 0) {
      setSafety(null);
      setSafetyFailed(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/safety/verify", {
          method: "POST",
          // The same bearer token the generated client attaches. Without it the
          // server has no profile to check against, and a check with nothing to
          // check against reports "clear" — which is exactly the reassuring,
          // wrong answer this whole feature exists to avoid.
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ingredients: selectedIngredients.map((i) => ({ name: i.name })) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const report = (await res.json()) as SafetyReport;
        if (!cancelled) {
          setSafety(report);
          setSafetyFailed(false);
        }
      } catch {
        // Never a reassuring panel we did not earn — but not silence either.
        // Showing nothing is what someone with no allergies sees, so a failed
        // check would be indistinguishable from having nothing to check. It
        // says so instead.
        if (!cancelled) {
          setSafety(null);
          setSafetyFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selectedIngredients, token]);
  const createMutation = useCreateCreation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Group ingredients by category
  const ingredientsByCategory = useMemo(() => {
    if (!allIngredients) return {};
    return allIngredients.reduce((acc, ing) => {
      if (!acc[ing.category]) acc[ing.category] = [];
      acc[ing.category].push(ing);
      return acc;
    }, {} as Record<string, typeof allIngredients>);
  }, [allIngredients]);

  // Calculate Benefit Score (max 100) based on how many ingredients match the goal
  const benefitScore = useMemo(() => {
    if (!allIngredients) return 0;
    let score = 0;
    selectedIngredients.forEach(sel => {
      // Find full ingredient data
      const full = allIngredients.find(i => i.name === sel.name);
      if (full && full.benefits.includes(goal)) {
        score += 15; // 15 points per matching ingredient
      } else {
        score += 5; // 5 points for any healthy ingredient
      }
    });
    return Math.min(100, score);
  }, [selectedIngredients, allIngredients, goal]);

  // Derive blend color dynamically based on goal + ingredients
  // For UI simplicity, we use the base goal hex, but could blend it.
  const blendColorHex = GOAL_HEX[goal] || "#E0E0E0";

  const handleAddIngredient = (name: string, benefit?: string) => {
    if (selectedIngredients.length >= 10) {
      toast({ title: "Glass is full!", description: "Maximum 10 ingredients allowed.", variant: "destructive" });
      return;
    }
    if (selectedIngredients.find(i => i.name === name)) {
      toast({ title: "Already added", description: "You already have this in your blend." });
      return;
    }
    setSelectedIngredients([...selectedIngredients, { name, amount: "1", unit: "part", benefit }]);
  };

  const handleRemoveIngredient = (name: string) => {
    setSelectedIngredients(selectedIngredients.filter(i => i.name !== name));
  };

  const handlePublish = () => {
    if (!name || !authorName) {
      toast({ title: "Missing fields", description: "Please provide a name for your blend and yourself.", variant: "destructive" });
      return;
    }
    if (selectedIngredients.length < 2) {
      toast({ title: "Too empty", description: "Add at least 2 ingredients to make a blend.", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      data: {
        name,
        authorName,
        goal,
        story,
        ingredients: selectedIngredients,
        colorHex: blendColorHex
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Published!",
          description: "Your creation is now live on the community wall.",
        });
        setLocation("/community");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* LEFT PANEL - The Builder Controls */}
      <div className="w-full md:w-[55%] lg:w-[60%] border-r flex flex-col h-[50vh] md:h-[calc(100vh-4rem)] overflow-y-auto bg-card">
        
        <div className="p-8 pb-24">
          {/* STEP 1: Goal Selection */}
          {step === 1 && (
            <div className={bounceClass}>
              <div className="mb-8">
                <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Step 01</span>
                <h1 className="font-serif text-4xl font-medium mb-3">Set your intention.</h1>
                <p className="text-muted-foreground text-lg">What does your body need today?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {GOALS.map(g => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 ${
                      goal === g 
                        ? `border-primary ring-4 ring-primary/10 shadow-lg ${GOAL_COLORS[g]}` 
                        : `border-transparent bg-background hover:border-primary/30 text-foreground shadow-sm hover:shadow-md`
                    }`}
                  >
                    <div className="font-serif text-xl font-medium mb-1">{GOAL_LABELS[g]}</div>
                  </button>
                ))}
              </div>
              
              <div className="mt-12 flex justify-end">
                <Button size="lg" className="rounded-full px-8 gap-2" onClick={() => setStep(2)}>
                  Next: Add Ingredients <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Ingredients */}
          {step === 2 && (
            <div className={bounceClass}>
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Step 02</span>
                  <h1 className="font-serif text-4xl font-medium mb-2">Build your blend.</h1>
                  <p className="text-muted-foreground">Select ingredients that support <strong className="text-foreground">{GOAL_LABELS[goal]}</strong>.</p>
                </div>
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">Back</Button>
              </div>

              {loadingIngredients ? (
                <div className="space-y-8">
                  <Skeleton className="h-8 w-1/3" />
                  <div className="flex gap-2"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div>
                </div>
              ) : (
                <div className="space-y-10">
                  {Object.entries(ingredientsByCategory).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="text-sm uppercase tracking-widest font-bold text-muted-foreground mb-4 border-b pb-2">
                        {category}
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {items.map(item => {
                          const isSelected = selectedIngredients.some(i => i.name === item.name);
                          const isMatch = item.benefits.includes(goal);
                          return (
                            <button
                              key={item.id}
                              onClick={() => isSelected ? handleRemoveIngredient(item.name) : handleAddIngredient(item.name, item.skinBenefitKey || undefined)}
                              className={`
                                group relative px-4 py-2.5 rounded-2xl border transition-all duration-200 text-sm font-medium
                                flex items-center gap-2
                                ${isSelected ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-background hover:bg-muted'}
                                ${isMatch && !isSelected ? 'border-primary/40 ring-1 ring-primary/20' : ''}
                              `}
                            >
                              {item.name}
                              {isMatch && !isSelected && <Sparkles className="w-3.5 h-3.5 text-primary" />}
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-12 flex justify-end border-t pt-6">
                <Button size="lg" className="rounded-full px-8 gap-2" onClick={() => setStep(3)} disabled={selectedIngredients.length < 2}>
                  {selectedIngredients.length < 2 ? 'Add at least 2 ingredients' : 'Next: Finalize & Publish'} <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Publish */}
          {step === 3 && (
            <div className={bounceClass}>
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Step 03</span>
                  <h1 className="font-serif text-4xl font-medium mb-2">Make it yours.</h1>
                  <p className="text-muted-foreground">Give it a name and share it with the community.</p>
                </div>
                <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">Back</Button>
              </div>

              {safety && (
                <div className="mb-8 max-w-xl">
                  <AllergenScan report={safety} />
                </div>
              )}

              {safetyFailed && (
                <div className="mb-8 max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm text-destructive">
                    Couldn&apos;t run the allergen check just now — check your ingredients yourself
                    before publishing.
                  </p>
                </div>
              )}

              <div className="space-y-6 max-w-xl">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Blend Name *</label>
                  <Input 
                    placeholder="e.g. The Morning Glow" 
                    className="text-lg py-6 rounded-2xl bg-background"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Your Name *</label>
                  <Input 
                    placeholder="e.g. Sarah J." 
                    className="rounded-2xl bg-background"
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">The Story (Optional)</label>
                  <Textarea 
                    placeholder="Why did you build this blend? What does it do for you?" 
                    className="rounded-2xl bg-background min-h-[120px]"
                    value={story}
                    onChange={e => setStory(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-12 flex justify-end border-t pt-6">
                <Button 
                  size="lg" 
                  className={`rounded-full px-10 text-lg shadow-lg ${GOAL_COLORS[goal]}`} 
                  onClick={handlePublish}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Publishing...' : 'Publish to Community Wall'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Live Visualization & Score */}
      <div className="w-full md:w-[45%] lg:w-[40%] bg-muted/30 relative flex flex-col h-[50vh] md:h-[calc(100vh-4rem)] p-8">
        
        {/* Goal Badge */}
        <div className="absolute top-8 right-8">
          <div className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${GOAL_COLORS[goal]}`}>
            {GOAL_LABELS[goal]}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center pt-10">
          {/* Glass Visualization */}
          <div className="relative w-48 h-64 border-4 border-b-[8px] border-black/10 rounded-b-3xl rounded-t-lg flex flex-col justify-end overflow-hidden bg-white/40 shadow-inner">
            <div 
              className="w-full transition-all duration-700 ease-in-out origin-bottom relative"
              style={{ 
                height: `${Math.max(10, selectedIngredients.length * 10)}%`,
                backgroundColor: blendColorHex,
                opacity: selectedIngredients.length > 0 ? 0.9 : 0.2
              }}
            >
              {/* Liquid surface highlight */}
              <div className="absolute top-0 inset-x-0 h-2 bg-white/30 rounded-[50%]" />
            </div>
            
            {selectedIngredients.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 font-serif italic text-sm">
                Empty Glass
              </div>
            )}
          </div>

          {/* Selected Ingredients List */}
          <div className="mt-10 w-full max-w-sm">
            <h4 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3 text-center">
              In The Glass ({selectedIngredients.length})
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {selectedIngredients.map(ing => (
                <span key={ing.name} className="inline-flex items-center gap-1 bg-white border px-2.5 py-1 rounded-full text-xs shadow-sm">
                  {ing.name}
                  <button onClick={() => handleRemoveIngredient(ing.name)} className="text-muted-foreground hover:text-destructive ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Live Benefit Score */}
        <div className="mt-auto bg-white p-6 rounded-3xl shadow-xl border">
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1">Benefit Score</div>
              <div className="font-serif text-3xl font-medium text-foreground">{benefitScore}<span className="text-lg text-muted-foreground">/100</span></div>
            </div>
            <Sparkles className={`w-8 h-8 transition-colors ${benefitScore > 70 ? 'text-primary' : 'text-muted'}`} />
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-1000 ease-out rounded-full"
              style={{ 
                width: `${benefitScore}%`,
                backgroundColor: blendColorHex 
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {benefitScore === 0 ? "Add ingredients to build your score." :
             benefitScore < 50 ? "A good start, but needs more purpose." :
             benefitScore < 80 ? "Solid functional profile!" :
             "Exceptional K-beauty potency."}
          </p>
        </div>

      </div>
    </div>
  );
}
