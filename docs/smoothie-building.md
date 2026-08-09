# How a smoothie gets built

Every generated drink comes out of one deterministic function. No model chooses
an ingredient, a quantity, or a slot. This document is what it does and why.

The split is worth stating first, because it is the thing people assume wrongly:

| Decided by code | Decided by a model |
|---|---|
| Which ingredients, how much of each | The drink's name |
| Which are excluded for safety | The story on the publish screen |
| Goal-fit score, nutrition totals | — |

A model naming a drink badly costs a rename. A model choosing ingredients would
put an unverifiable step between someone's allergy and their glass.

---

## 1. The skeleton

A build is a fixed sequence of **slots**, in this order:

```
liquid → protein → flavour → flavour → functional → thickener → sweetener
```

Each step ranks whatever is still available for that slot and takes one. The
sequence never changes, so the *shape* of a glass is decided by the recipe
skeleton and only its *contents* by the person.

That is what makes a generated drink recognisably a smoothie rather than a pile
of high-scoring ingredients. Without it, a "gut health" build would happily
return kefir, yoghurt, oats, chia and flax — every one of them on-goal, and
nothing you could drink.

Two slots are **structural**: liquid and protein always go in. A glass without a
base is not a smaller smoothie, it is not one. Everything after them is
negotiable and stops when a ceiling is hit.

The catalog is 43 ingredients, distributed:

| Slot | Count |
|---|---|
| flavour | 17 |
| functional | 9 |
| liquid | 6 |
| protein | 5 |
| sweetener | 3 |
| thickener | 3 |

`slot` is distinct from `category`. Category says what a thing *is* — oats are a
grain. Slot says what it *does in a glass* — oats thicken.

---

## 2. Ranking within a slot

Each step scores every candidate and sorts descending, breaking ties on name so
two runs never disagree.

### Goal fit

```
servesGoals(ingredient) = 3 × (main goal in benefits)
                        + 1 × (each sub-goal in benefits)
```

**The 3:1 ratio is the design, not a tuning constant.** A third is enough to
break a tie between two ingredients the main goal likes equally, and never
enough to outrank something the main goal actually wants. The main goal is the
skeleton; sub-goals are variation inside it.

This is also why sub-goals are capped at two in the UI. At five, they outvote
the main goal and the drink stops being about what the person came for.

### Taste

Onboarding collects four taste words. The catalog uses six flavour families.
Neither is a refinement of the other, so the mapping is a judgement:

| Taste | Flavour families |
|---|---|
| sweet | tropical, berry, vanilla-spice |
| sour | citrus, berry |
| nutty | chocolate-nutty, vanilla-spice |
| fresh | green-earthy, citrus |

Overlaps are deliberate. Citrus reads as both sour and fresh, and forcing it
into one would make the other preference mean less than the user thought.

A flavour match is worth **2**.

### Per-step weighting

The same two signals are weighted differently depending on what the slot is for:

| Step | Score |
|---|---|
| liquid | goal + flavour |
| protein | goal |
| flavour ① | goal + **2×** flavour |
| flavour ② | goal + flavour |
| functional | **2×** goal |
| thickener | goal + 1 |
| sweetener | flat (only reached if "sweet" was chosen) |

The first flavour slot doubles taste because that is the ingredient someone
tastes first. The functional slot doubles goal because a functional ingredient
that does not serve the goal has no reason to be there.

The sweetener step is skipped entirely unless the profile says "sweet". Nothing
else in a profile implies wanting sugar added, and adding it anyway would be the
system deciding on the user's behalf.

---

## 3. Variety without losing determinism

Two calls with the same profile and the same seed produce the same glass. The
seed is an **input**, so "same input, same output" and "give me a different one"
are not in tension — asking for a different drink means passing a different
seed, not making the function unpredictable.

Variety comes from picking within a shortlist rather than always taking the top:

```
width = min(4, candidates)
index = spread(seed, stepIndex) % width
```

`spread` is a cheap integer hash of `(seed, step)`. It is not cryptographic and
does not need to be — it only has to avoid landing on the same shortlist index
at every step of one glass, which is what would make "varied" drinks all differ
in the same place.

The shortlist is drawn from what the ranking already produced, so a varied glass
is still built from what the profile scored highest. **Variety inside the
boundary, never past it** — a drink that ignores the goal is not variety, it is
a different drink.

---

## 4. Size and effort: the presets

Rather than one "make a smoothie" button followed by a questionnaire about
today, the choice of button *is* the question, asked once in a tap.

| Preset | Calorie ceiling | Max extras | ≈ minutes |
|---|---|---|---|
| Quick one | 300 | 2 | 4 |
| Light one | 210 | 3 | 5 |
| Great one | 420 | 6 | 8 |
| Heavy one | 620 | 6 | 8 |

Two ceilings, not one, because they express different things. `maxExtras` is
about *how many things you have to fetch, measure and put back* — two 40-calorie
extras and six of them cost the same calories and very different amounts of
morning. A calorie ceiling cannot say that.

Minutes are **derived** from `maxExtras` (2 + extras), not stored separately. A
separate figure would be a second source of truth free to drift.

Target volume is 400 ml/g, used for the cup-fill animation.

### Asking in minutes

The builder asks "how long have you got?" because minutes are what someone
actually knows about their morning. The answer maps onto the presets that
already exist rather than becoming a parallel notion of speed. Ties go to the
richer drink: someone with four minutes would rather be offered a five-minute
option than have their choice quietly narrowed.

---

## 5. Nutrition arithmetic

Every ingredient carries nutrition **per 100 g** and a serving size. A pick
contributes:

```
kcal    = kcal_per_100g × servingGrams / 100
protein = protein_per_100g × servingGrams / 100
```

### The bug this replaced

The calorie ceiling originally compared the **per-100 g figure** against a
running total of real amounts. Turmeric is 312 kcal/100 g and a serving is 2 g —
six calories — but it read as 312 and was rejected.

Every spice, powder and nut butter was being thrown out on calories it never
contributed. **The entire functional slot was missing from every generated
smoothie**, and the drinks still looked plausible, which is why it survived. It
was found by reading output, not by a test.

### Missing figures stay missing

If any picked ingredient has no sourced figure, the **total is null**, not a
partial sum. A total that silently omits the collagen is not a smaller total, it
is a wrong one. This propagates all the way to the UI, where the cup scene shows
"not known for this one" rather than counting up to a confident zero — a counter
cannot climb to null.

See [nutrition-data.md](nutrition-data.md) for where the figures come from.

---

## 6. Appearance

Each ingredient has a hex colour. A drink's gradient is built from the most
**characterful** ingredients — those furthest from the drink's own average —
rather than the largest.

By volume almost every smoothie is mostly liquid, so weighting by grams would
make every card the colour of milk. Sorting by distance from the average puts
the spinach and the beetroot at the ends, which is what makes two drinks look
different from each other.

Consequences: the six option cards differ because the drinks differ, a green one
is green because there is spinach in it, and a published recipe with no photo
has something honest to show instead of a stock image of a different drink.

---

## 7. Scoring a finished drink

Scoring runs the build **backwards**. A drink is assembled by picking things
that serve a goal, so a finished recipe can be read for how much of it was, in
effect, picked that way. The same function scores hand-written recipes, so
curated and generated ones rank on one scale rather than two.

### Tags, for most goals

```
active   = ingredients with at least one benefit tag
onGoal   = active ingredients carrying this goal
depth    = min(1, onGoal / 3)
share    = onGoal / active
score    = √(depth × share)
```

Both halves are needed. Share alone makes a two-ingredient drink look more
committed than a six-ingredient one built around the same goal; count alone
ignores that everything else in the glass is pulling elsewhere. The geometric
mean requires both — either at zero gives zero.

Ingredients with no benefits at all — ice, water, sweeteners: nine of the
forty-three — are excluded from the denominator. Counting them would mean a
recipe scored lower for containing ice, which describes nothing about the drink.

### Dose, for protein

Tag counting **cannot see dose**, and the existing data proved it. "Cloud Nine
Shaker" — the 42 g protein shaker, the one recipe written for protein — scored
**0.29** for protein-power, below its own glowy-skin at 0.58. It would never
have surfaced for the goal it exists to serve.

Two scoops of whey and a quarter avocado are one tag each. What makes a protein
drink a protein drink is grams:

| Recipe | Computed protein |
|---|---|
| Cloud Nine Shaker | **26.8 g** |
| Jade Depth | 5.1 g |
| Soleil Protocol | 3.0 g |
| The Glow Ritual | 2.7 g |

So protein-power is scored on dose: `min(1, protein / 25g)`.

**Only protein.** Not for symmetry — because protein is the only goal in this
taxonomy with a measurable correlate in the data we actually have. "Glowy skin"
has no column. Caffeine would give energy-focus one and there is no caffeine
column; building a proxy out of the columns that do exist would be making the
number up.

Where protein is unknown, the tag score stands in, and the higher of the two
always wins — an under-sourced ingredient can cost accuracy, never a place a
recipe had earned.

### Thresholds

- **0.5** to be offered for a goal (product decision)
- **6** offered at once

Six is from Iyengar & Lepper (2000): shoppers shown 24 jams were an order of
magnitude less likely to buy than those shown 6, and were *less satisfied* with
what they picked. More options made the choice worse on both counts.

The count is **capped, never padded**. Everything shown genuinely clears the
threshold, and the response carries the true match count so the client can say
"6 of 11" rather than implying six is all there is.

### Editorial tags vs computed scores

Recipes keep both `benefits` (what a human said it is for) and `goalScores`
(what the function computed). Where they disagree, the disagreement is visible
rather than resolved silently.

One survives in the seeded data: **Soleil Protocol** is tagged `hydration` and
scores 0.29, because that version has watermelon and no coconut water. The tag
is ahead of the ingredients. Keeping both columns is what lets anyone see that.

---

## 8. Search before build

The daily flow searches the catalog before generating. A recipe that already
fits is a real answer and costs nothing to find.

But a catalog recipe was written for a *goal*, not for today's time budget or
sub-goals, so it fits less exactly than something built this minute. **At most
three of the six come off the shelf**; the rest are made now, and the screen
says which is which rather than presenting a lookup as something done for you.

Both requests go out in parallel. In sequence, every build would wait on a
search whose result might not be used.
