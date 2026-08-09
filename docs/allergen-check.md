# The allergen check

Deterministic, mechanical, and kept well away from anything that generates or
ranks. A model proposes drinks; this decides whether one is allowed to reach
someone, and it does so by comparing ids in a table.

No scoring, no threshold, no judgement. The same recipe and the same constraints
always produce the same verdict.

---

## 1. Matching on data, not on names

Every ingredient carries a `contains` array of allergen ids:

| Allergen id | Ingredients carrying it |
|---|---|
| `dairy` | Whey Protein Isolate, Kefir, Whole milk, Greek yogurt |
| `gluten` | Oat milk, Rolled oats |
| `peanut` | Peanut butter |
| `soy` | Soy milk, Silken tofu |
| `tree-nut` | Almond milk, Almond butter |

The check reads that column. **Never the name.**

A name check would let "Almond Butter (smooth)" past a tree-nut allergy the
moment someone edited the label — a substring miss on an allergen is precisely
the failure this design exists to prevent.

---

## 2. The bug this replaced

Onboarding stored the labels it displayed — `"Dairy"`, `"Tree Nuts"`. The
catalog stored ids — `dairy`, `tree-nut`. **Nothing translated between them.**

So `contains.includes(allergy)` matched nothing, ever. Someone who ticked "Tree
Nuts" would have been served almond butter.

The dangerous part is not the mismatch, it is that the failure was invisible:

> A filter with nothing to catch and a filter that catches nothing are
> indistinguishable from outside.

Both show a clean list. Both look like they worked.

There is now an explicit mapping, and every stated allergy has to resolve
through one of three routes — none of which is "silently dropped".

---

## 3. Three routes, no fourth

| Route | Example | Mechanism |
|---|---|---|
| Allergen class | Dairy | `contains` id match |
| Named ingredient | Banana | catalog name match |
| Unenforceable | Shellfish | reported, never silently passed |

### Why the second route exists

Banana, Peach and Kiwi are **foods, not allergen classes** — the catalog has no
tag for them. Honouring them by excluding the ingredient itself is exactly as
strict and needs no new column.

Someone allergic to banana is not expressing a preference. Before this route
existed, their only option was the dislikes list, which generation avoids but
the safety check ignores — so a recipe containing banana would have been called
safe for them.

### Why the third route exists

Shellfish and Egg have no ingredient in this catalog carrying them. It is
probably true that no recipe here contains shellfish — but that is a claim about
the catalog's completeness, not a check that passed.

The report carries `unresolvedConstraints` so a client can say the constraint
was never enforced, rather than showing a clean result that implies it was.

---

## 4. The offered set equals the enforceable set

The picker used to be a hand-written list of nine, and it had drifted from the
catalog **in both directions at once**:

- `peanut` was tagged on peanut butter with **no way to select it**
- Shellfish, Egg, Peach and Kiwi were offered against a catalog containing
  **none of them** — a filter promising to remove something it has never seen

The class list is now derived from the data. `allergenClasses(catalog)` reads
what ingredients are actually tagged with, which makes the set:

- **exhaustive by construction** — tag a new allergen and it appears
- **exclusive by construction** — a class nothing carries cannot appear

Both directions are pinned by tests:

1. every offered class must actually block an ingredient that carries it
2. every tag present in the catalog must be offered

An allergen with no display label degrades to its raw id rather than becoming
unselectable. A missing label should cost an ugly option, never a missing
allergy.

---

## 5. Failing closed

An ingredient name the catalog does not recognise makes the **whole recipe
unsafe**, when an allergy has been stated.

Nothing is known to be wrong with it. Nothing is known about it at all — and
those are the same result from outside while meaning opposite things:

> "No allergen found" and "no information" look identical. Under a stated
> allergy, the second one has to read as a block.

With no constraints stated, an unrecognised ingredient passes. There is nothing
to fail closed against, and rejecting recipes for nobody's benefit is not
safety.

---

## 6. One rule set, two applications

The same rules run in two directions:

| Function | Applied to | Used by |
|---|---|---|
| `allowedIngredients` | the catalog | generation |
| `checkRecipe` | a finished recipe | matching, verification screen |

Generation therefore **cannot produce something the check would reject**.

Two implementations of "is this allowed" would eventually disagree, and the
direction they disagree in is what decides whether someone is served an
allergen.

`dislikes` are passed separately and only to `allowedIngredients`. A dislike
keeps an ingredient out of a *new* drink; it is not a reason to call an existing
recipe unsafe.

---

## 7. Ordering: safety before ranking

Matching filters safety **first**, then applies the goal threshold, then ranks.

The order produces the same list today either way. It matters anyway:

> Ranking first and checking safety at render time makes safety a property of
> the *presentation* rather than of the *set* — and the first thing to cache or
> paginate that ranked list puts an unsafe recipe in it.

---

## 8. The verification screen

The final build screen animates the check: every ingredient named, weighed
against every stated allergy, cleared or flagged, one at a time.

`checkRecipe` returns a **per-ingredient trail**, not a boolean, and the screen
plays that trail. This is deliberate:

> It is only honest if the trail is the actual decision rather than a
> re-enactment of one made elsewhere.

So the same structure the server filters on is the thing the UI shows. It is
never recomputed in the browser, where a second implementation could disagree
with the one that actually filters — the reassuring part of the screen would
then be the part that is not true.

### The middle case

An ingredient carrying an allergen the user does *not* have reads
**"tree-nut — not one of yours"** rather than a bare tick.

The check is visibly doing something rather than approving everything, which is
what makes the screen worth watching.

### It only appears when something was stated

A verification scene for someone with nothing to verify is theatre — and theatre
here teaches people to skip past the one screen that matters when they *do* have
something to declare.

### A failure is not silence

Showing nothing is what someone with no allergies sees. So a check that fails to
run says so explicitly, rather than being indistinguishable from having nothing
to check.

That path was itself a real bug: the request went out with no auth header, the
server found no profile, checked against nothing, and returned **"clear"** — the
exact reassuring wrong answer the feature exists to prevent, delivered silently.

---

## 9. What the report contains

```ts
{
  safe: boolean,
  checks: [{
    name,        // ingredient
    contains,    // everything it carries
    animal,
    violations,  // what it breaks here — empty when it passes
    passed,
  }],
  unknownIngredients: string[],     // not in the catalog
  unresolvedConstraints: string[],  // stated but unenforceable
  blockedBy: string[],              // distinct reasons, for one-line summary
}
```

Four distinct outcomes, none collapsed into another: passed, blocked, unknown
ingredient, unenforceable constraint.

---

## 10. Verified behaviour

Against the live database:

- `Dairy` blocks exactly the four recipes containing whey or kefir
- `tree-nut` blocks none — no seeded recipe uses almond, confirmed by query
  rather than assumed
- all five classes block their own ingredients
- banana as an allergy blocks a recipe containing it and passes one that does
  not
- `Shellfish` reports as unenforceable rather than passing quietly
- an unrecognised ingredient fails closed under a stated allergy and passes
  without one
