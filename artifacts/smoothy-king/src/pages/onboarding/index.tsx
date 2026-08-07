import { useState, useEffect } from "react";
import {
  useSubmitOnboarding,
  useListIngredients,
  useGetUserProfile,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { getActiveGoal } from "@/features/goals";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ArrowLeft, User, Ruler, Weight, Activity, Sparkles, Check, X, Heart, UserCircle } from "lucide-react";
import { GOALS, GOAL_COLORS, GOAL_LABELS, GOAL_HEX } from "@/lib/colors";
import { useToast } from "@/hooks/use-toast";
import { AssistBox } from "@/features/elicitation";
import { DislikePicker } from "@/features/dislikes/DislikePicker";

const bounceClass = "animate-in zoom-in-95 duration-300";

const ACTIVITY_LEVELS = [
  { key: "sedentary", label: "Sedentary", desc: "Mostly sitting throughout the day" },
  { key: "light", label: "Lightly Active", desc: "Light exercise 1-2 days/week" },
  { key: "moderate", label: "Moderately Active", desc: "Moderate exercise 3-5 days/week" },
  { key: "active", label: "Very Active", desc: "Hard exercise 6-7 days/week" },
  { key: "very_active", label: "Extremely Active", desc: "Intense daily training" },
];

const ALLERGY_PRESETS = [
  "Dairy", "Tree Nuts", "Soy", "Gluten",
  "Shellfish", "Egg", "Banana", "Peach", "Kiwi",
];

const TASTE_OPTIONS = [
  { key: "sweet", label: "🍯 Sweet", color: "bg-orange-100 border-orange-300 text-orange-800" },
  { key: "sour", label: "🍋 Tart & Citrus", color: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  { key: "nutty", label: "🥜 Nutty & Rich", color: "bg-amber-100 border-amber-300 text-amber-800" },
  { key: "fresh", label: "🌿 Fresh & Herbal", color: "bg-green-100 border-green-300 text-green-800" },
];

interface OnboardingData {
  gender: string;
  age: number;
  height: number;
  weight: number;
  activityLevel: string;
  allergies: string[];
  dislikedIngredients: string[];
  primaryGoal: string;
  secondaryGoals: string[];
  tastePreference: string[];
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [data, setData] = useState<OnboardingData>({
    gender: "",
    age: 25,
    height: 170,
    weight: 65,
    activityLevel: "moderate",
    allergies: [],
    dislikedIngredients: [],
    primaryGoal: "glowy-skin",
    secondaryGoals: [],
    tastePreference: [],
  });

  const [prefilled, setPrefilled] = useState(false);

  const { user, token, isLoggedIn, isLoading: loadingAuth } = useAuth();
  const submitMutation = useSubmitOnboarding();

  /**
   * The goal, read rather than asked for.
   *
   * It is set on its own screen and lives in goal_periods; onboarding shows it
   * on the review step so the profile reads as complete, but never writes it.
   * Two writers is how the profile column and the period start disagreeing.
   */
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const period = await getActiveGoal(token);
        if (!cancelled) setActiveGoal(period?.goal ?? null);
      } catch {
        if (!cancelled) setActiveGoal(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
  const { data: allIngredients } = useListIngredients();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load any saved profile so "Edit Preferences" opens with the stored answers
  // instead of resetting to defaults. A 404 just means "not onboarded yet",
  // so don't retry it.
  const profileQuery = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey(), enabled: isLoggedIn, retry: false },
  });
  const existingProfile = profileQuery.data;
  const isEditing = !!existingProfile;

  // Wait for the query to actually settle (success *or* 404) before seeding the
  // form — reading `isLoading` alone would race the `enabled` flag flipping.
  const profileSettled = profileQuery.isSuccess || profileQuery.isError;

  useEffect(() => {
    if (prefilled || !isLoggedIn || !profileSettled) return;

    if (existingProfile) {
      setData((prev) => ({
        gender: existingProfile.gender ?? prev.gender,
        age: existingProfile.age ?? prev.age,
        height: existingProfile.height ?? prev.height,
        weight: existingProfile.weight ?? prev.weight,
        activityLevel: existingProfile.activityLevel ?? prev.activityLevel,
        allergies: existingProfile.allergies ?? prev.allergies,
        dislikedIngredients: existingProfile.dislikedIngredients ?? prev.dislikedIngredients,
        primaryGoal: existingProfile.primaryGoal ?? prev.primaryGoal,
        secondaryGoals: existingProfile.secondaryGoals ?? prev.secondaryGoals,
        tastePreference: existingProfile.tastePreference ?? prev.tastePreference,
      }));
    }
    setPrefilled(true);
  }, [prefilled, isLoggedIn, profileSettled, existingProfile]);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const toggleArray = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const handleSubmit = () => {
    // `primaryGoal` is deliberately still in the payload: the endpoint requires
    // it, and the goals feature keeps the column in sync as a mirror. Sending
    // the value read back from the active period rather than a local edit
    // keeps this a read, not a second writer.
    submitMutation.mutate(
      { data: { ...data, primaryGoal: activeGoal ?? data.primaryGoal } },
      {
        onSuccess: () => {
          // The profile page reads this query; without invalidation a cached
          // 404 from before onboarding would keep showing "no profile yet".
          queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
          setStep(5); // Complete step
        },
        onError: (err: unknown) => {
          const message =
            (err as { data?: { error?: string } })?.data?.error ?? "Please try again.";
          toast({ title: "Save Failed", description: message, variant: "destructive" });
        },
      }
    );
  };

  // ── Progress Bar ──
  const progressPercent = step <= totalSteps ? ((step - 1) / totalSteps) * 100 : 100;

  // Onboarding writes to the logged-in account. Blocking here means a visitor
  // can't fill in four steps only to lose everything to a 401 on save.
  if (!loadingAuth && !isLoggedIn) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-card p-8 rounded-3xl border shadow-sm">
          <UserCircle className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="font-serif text-3xl font-medium mb-3">Login Required</h2>
          <p className="text-muted-foreground mb-6">
            Create an account first — your health profile and goals are saved to it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" className="rounded-full px-8">Create Account</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="rounded-full px-8">Log In</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Hold the form until the saved profile has loaded, so an edit session never
  // briefly shows defaults that could be submitted over real answers.
  if (loadingAuth || !prefilled) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Progress */}
      {step <= totalSteps && (
        <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span className="font-medium">Step {step} of {totalSteps}</span>
              <span>{Math.round(progressPercent)}% Completed</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        {/* ── Step 1: Body & Basic Info ── */}
        {step === 1 && (
          <div className={bounceClass}>
            <div className="mb-8">
              <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Step 01</span>
              <h1 className="font-serif text-4xl font-medium mb-3">
                {isEditing ? "Update your details" : "Tell us about yourself"}
              </h1>
              <p className="text-muted-foreground text-lg">
                {isEditing
                  ? "Your saved answers are filled in below — change anything you like."
                  : "We use this to calibrate your personal nutritional baseline."}
              </p>
            </div>

            <div className="space-y-8">
              {/* Gender */}
              <div>
                <label className="text-sm font-semibold mb-3 block">Gender</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "male", label: "Male", icon: "👨" },
                    { key: "female", label: "Female", icon: "👩" },
                    { key: "other", label: "Other", icon: "😊" },
                  ].map((g) => (
                    <button
                      key={g.key}
                      onClick={() => updateData({ gender: g.key })}
                      className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                        data.gender === g.key
                          ? "border-primary ring-4 ring-primary/10 bg-primary/5 shadow-md"
                          : "border-transparent bg-card hover:border-primary/30 shadow-sm"
                      }`}
                    >
                      <div className="text-2xl mb-1">{g.icon}</div>
                      <div className="text-sm font-medium">{g.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Age */}
              <div>
                <label className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Age
                </label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[data.age]}
                    onValueChange={([v]) => updateData({ age: v })}
                    min={10}
                    max={80}
                    step={1}
                    className="flex-1"
                  />
                  <div className="w-16 text-center">
                    <Input
                      type="number"
                      value={data.age}
                      onChange={(e) => updateData({ age: parseInt(e.target.value) || 25 })}
                      className="text-center h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Height */}
              <div>
                <label className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-primary" /> Height (cm)
                </label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[data.height]}
                    onValueChange={([v]) => updateData({ height: v })}
                    min={100}
                    max={220}
                    step={1}
                    className="flex-1"
                  />
                  <div className="w-20 text-center">
                    <Input
                      type="number"
                      value={data.height}
                      onChange={(e) => updateData({ height: parseFloat(e.target.value) || 170 })}
                      className="text-center h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Weight */}
              <div>
                <label className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Weight className="w-4 h-4 text-primary" /> Weight (kg)
                </label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[data.weight]}
                    onValueChange={([v]) => updateData({ weight: v })}
                    min={30}
                    max={150}
                    step={0.5}
                    className="flex-1"
                  />
                  <div className="w-20 text-center">
                    <Input
                      type="number"
                      value={data.weight}
                      onChange={(e) => updateData({ weight: parseFloat(e.target.value) || 65 })}
                      className="text-center h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Activity Level */}
              <div>
                <label className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Activity Level
                </label>
                <AssistBox
                  step="activity"
                  placeholder="e.g. I lift four times a week and cycle to work"
                  // Single choice, so this replaces rather than adds. The
                  // server already returns at most one id for this step.
                  onAccept={(ids) => ids[0] && updateData({ activityLevel: ids[0] })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACTIVITY_LEVELS.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => updateData({ activityLevel: a.key })}
                      className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                        data.activityLevel === a.key
                          ? "border-primary ring-4 ring-primary/10 bg-primary/5 shadow-md"
                          : "border-transparent bg-card hover:border-primary/30 shadow-sm"
                      }`}
                    >
                      <div className="font-medium text-sm">{a.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 flex justify-end">
              <Button size="lg" className="rounded-full px-8 gap-2" onClick={() => setStep(2)}>
                Next: Dietary Restrictions <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Allergies & Preferences ── */}
        {step === 2 && (
          <div className={bounceClass}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Step 02</span>
                <h1 className="font-serif text-4xl font-medium mb-2">Allergies & Preferences</h1>
                <p className="text-muted-foreground">Select any items you'd like to filter out of recommendations (Optional)</p>
              </div>
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">Back</Button>
            </div>

            {/* Allergy Presets */}
            <div className="mb-10">
              <h3 className="text-sm uppercase tracking-widest font-bold text-muted-foreground mb-4 border-b pb-2">
                Allergens
              </h3>
              <AssistBox
                step="allergies"
                placeholder="e.g. I can't do milk or anything with wheat in it"
                // Union, never replacement. A suggestion may add an allergen
                // the user then unticks themselves; it must not be able to
                // clear one they had already chosen.
                onAccept={(ids) =>
                  updateData({ allergies: [...new Set([...data.allergies, ...ids])] })
                }
              />
              <div className="flex flex-wrap gap-3">
                {ALLERGY_PRESETS.map((item) => {
                  const isSelected = data.allergies.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => updateData({ allergies: toggleArray(data.allergies, item) })}
                      className={`px-4 py-2.5 rounded-2xl border transition-all duration-200 text-sm font-medium flex items-center gap-2 ${
                        isSelected
                          ? "bg-destructive/10 text-destructive border-destructive/30 ring-1 ring-destructive/20"
                          : "bg-card hover:bg-muted border-transparent"
                      }`}
                    >
                      {item}
                      {isSelected && <X className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Disliked Ingredients from DB */}
            <div>
              <h3 className="text-sm uppercase tracking-widest font-bold text-muted-foreground mb-4 border-b pb-2">
                Disliked Ingredients
              </h3>
              <DislikePicker
                ingredients={allIngredients ?? []}
                selected={data.dislikedIngredients}
                onToggle={(name) =>
                  updateData({ dislikedIngredients: toggleArray(data.dislikedIngredients, name) })
                }
              />
            </div>

            <div className="mt-12 flex justify-between border-t pt-6">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full px-6 gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button size="lg" className="rounded-full px-8 gap-2" onClick={() => setStep(3)}>
                Next: Taste <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Goal Setting ── */}
        {step === 3 && (
          <div className={bounceClass}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Step 03</span>
                <h1 className="font-serif text-4xl font-medium mb-2">How do you like it to taste?</h1>
                <p className="text-muted-foreground">
                  Your goal decides what goes in. This decides which version of it you get.
                </p>
              </div>
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">Back</Button>
            </div>

            {/* Taste Preference */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Taste Profile (Multiple Selection)</h3>
              <AssistBox
                step="taste"
                placeholder="e.g. I like it tart, not sugary at all"
                onAccept={(ids) =>
                  updateData({ tastePreference: [...new Set([...data.tastePreference, ...ids])] })
                }
              />
              <div className="grid grid-cols-2 gap-3">
                {TASTE_OPTIONS.map((t) => {
                  const isSelected = data.tastePreference.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      onClick={() => updateData({ tastePreference: toggleArray(data.tastePreference, t.key) })}
                      className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 text-lg ${
                        isSelected
                          ? `${t.color} ring-4 ring-primary/10 shadow-md border-primary/30`
                          : "border-transparent bg-card hover:border-primary/30 shadow-sm"
                      }`}
                    >
                      <div className="font-medium">{t.label}</div>
                      {isSelected && <Check className="w-4 h-4 mx-auto mt-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-12 flex justify-between border-t pt-6">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full px-6 gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button size="lg" className="rounded-full px-8 gap-2" onClick={() => setStep(4)}>
                Next: Review Profile <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Save ── */}
        {step === 4 && (
          <div className={bounceClass}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">Step 04</span>
                <h1 className="font-serif text-4xl font-medium mb-2">Review Your Profile</h1>
                <p className="text-muted-foreground">Please double check your information before completing setup.</p>
              </div>
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-full">Back</Button>
            </div>

            {/* Summary Cards */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl p-6 border shadow-sm">
                <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4">Body Baseline</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Gender:</span> <strong>{data.gender === "male" ? "Male" : data.gender === "female" ? "Female" : "Other"}</strong></div>
                  <div><span className="text-muted-foreground">Age:</span> <strong>{data.age} yrs</strong></div>
                  <div><span className="text-muted-foreground">Height:</span> <strong>{data.height} cm</strong></div>
                  <div><span className="text-muted-foreground">Weight:</span> <strong>{data.weight} kg</strong></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Activity Level:</span> <strong>{ACTIVITY_LEVELS.find((a) => a.key === data.activityLevel)?.label}</strong></div>
                </div>
              </div>

              {data.allergies.length > 0 && (
                <div className="bg-card rounded-2xl p-6 border shadow-sm">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4">Allergies & Filters</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.allergies.map((a) => (
                      <span key={a} className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-card rounded-2xl p-6 border shadow-sm">
                <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4">Smoothie Goals</h3>
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-3 ${GOAL_COLORS[activeGoal ?? ""] ?? "bg-muted"}`}
                >
                  <Sparkles className="w-4 h-4" />
                  {activeGoal ? `${GOAL_LABELS[activeGoal] ?? activeGoal} (your goal)` : "No goal set yet"}
                </div>
                {data.secondaryGoals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.secondaryGoals.map((g) => (
                      <span key={g} className={`px-3 py-1 rounded-full text-xs font-medium ${GOAL_COLORS[g]}`}>
                        {GOAL_LABELS[g]}
                      </span>
                    ))}
                  </div>
                )}
                {data.tastePreference.length > 0 && (
                  <div className="mt-4">
                    <span className="text-muted-foreground text-sm">Taste Preference: </span>
                    {data.tastePreference.map((t) => (
                      <span key={t} className="text-sm font-medium mr-2">
                        {TASTE_OPTIONS.find((o) => o.key === t)?.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-12 flex justify-between border-t pt-6">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-full px-6 gap-2">
                <ArrowLeft className="w-4 h-4" /> Edit
              </Button>
              <Button
                size="lg"
                className="rounded-full px-10 text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform gap-2"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending
                  ? "Saving..."
                  : isEditing
                    ? "Update Profile"
                    : "Save Profile & Continue"}
                <Heart className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Complete ── */}
        {step === 5 && (
          <div className={`${bounceClass} text-center py-16`}>
            <div
              className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8 shadow-xl"
              style={{ backgroundColor: GOAL_HEX[data.primaryGoal] || "#48D1CC" }}
            >
              <Sparkles className="w-12 h-12 text-white" />
            </div>

            <h1 className="font-serif text-4xl md:text-5xl font-medium mb-4">
              All Set, {user?.nickname || "Member"}! 🎉
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto mb-4">
              Your personalized smoothie experience centered around{" "}
              <strong className={GOAL_COLORS[data.primaryGoal]?.split(" ")[0]}>
                {GOAL_LABELS[data.primaryGoal]}
              </strong>{" "}
              is ready.
            </p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-12">
              Start building your custom blend or explore curated rituals.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="rounded-full px-8 gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                onClick={() => setLocation("/builder")}
              >
                <Sparkles className="w-5 h-5" />
                Build Your Blend
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8 gap-2"
                onClick={() => setLocation("/recipes")}
              >
                Explore Recipes <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
