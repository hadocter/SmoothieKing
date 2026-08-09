# Where the numbers come from

Every nutrition figure in this catalog traces to one specific USDA FoodData
Central record. Where USDA has nothing, the column is null and a note says why.

The rule throughout: **a gap stays a gap rather than becoming a plausible-looking
number.**

---

## 1. Provenance is stored, not assumed

Each ingredient carries its own `fdcId`, `fdcDescription` and `fdcDataType`, so a
number traces to one record rather than to "USDA" in general.

| Data type | Rows | What it means |
|---|---|---|
| SR Legacy | 36 | USDA's legacy reference tables |
| Foundation | 3 | Laboratory-analysed, most recent |
| Branded | 3 | Manufacturer-declared |
| *(none)* | 1 | Ice — water, needs no record |

Branded is a **grade below** the others: it is what a manufacturer put on a
label, not what a lab measured. Recording the type is what lets anything reading
this table tell them apart without guessing.

---

## 2. USDA search cannot be trusted

Searching by name returned wrong foods, confidently:

| Query | What came back | Reality |
|---|---|---|
| `oats` | **oat oil** | 884 kcal, 0 g protein |
| `pitaya` | **Abiyuch** | an unrelated fruit |
| `pea protein isolate` | soy protein isolate | a different ingredient |

The oat one was already written into the data before it was caught. Every id in
the catalog is now pinned by hand.

### The Atwater check

Each figure is validated against the Atwater factors:

```
|kcal − (4×protein + 4×carb + 9×fat)| should be small
```

A wrong food match usually fails this immediately. It is a cheap consistency
test that catches exactly the failure above — oat oil's 884 kcal against 0 g of
everything is obviously not oats.

Four rows are flagged as legitimate outliers rather than errors: cacao, cinnamon
and spinach are fibre-heavy (fibre contributes less than 4 kcal/g), and vanilla
extract contains ethanol.

---

## 3. Closing the gaps, and what was refused

Three ingredients had no entry in Foundation or SR Legacy at all: **dragon
fruit, collagen peptides, pea protein**. They were left null.

That was right at the time, and it became a visible problem: **47% of generated
recipes reported no calorie total**, which the cup animation surfaces on nearly
half the drinks.

All three exist in USDA's Branded set. Each was accepted only after passing
Atwater, and only single-ingredient entries were used over blends:

| Ingredient | Declared | Atwater | Error |
|---|---|---|---|
| Collagen peptides | 364 kcal | 363.6 | 0.4 kcal |
| Pea protein | 455 kcal | 445.6 | ~2% |
| Dragon fruit | 40 kcal | 38.4 | ~4% |

Result: **47% → 0%**.

### One figure was refused

The dragon fruit label reports **0 g of fibre**, which is not credible for a
fruit. That field stays null with a note; the others were taken.

Same rule as the first pass, applied per-field rather than per-ingredient: take
what survives scrutiny, leave what does not.

### Older records keep their nulls

Recipes generated before this stay null. The figure was computed when the recipe
was built, and rewriting history to match a later data improvement would make
those rows claim a precision they did not have.

---

## 4. Health claims

Goal cards carry a line saying what the drink does. What that line may say is
recorded next to it, per goal.

The register is the ordinary one for this category: **nutrient function claims**.
Both major regimes permit them and both draw the same line — US
structure/function claims under DSHEA, EU claims from the authorised Article 13
register. Neither permits saying a food treats, prevents or cures anything.

### Two bases, recorded

| Basis | Rule |
|---|---|
| `nutrient-function` | Hangs on a nutrient with an authorised claim, **named in the text** |
| `composition` | Describes contents, claims nothing |

The attribution is what makes it a permitted claim rather than a nice sentence.

| Goal | Basis | Nutrient |
|---|---|---|
| Glowy Skin | nutrient-function | vitamin C |
| Deep Hydration | nutrient-function | water |
| Protein & Power | nutrient-function | protein |
| Gut Health | nutrient-function | fibre |
| Energy & Focus | nutrient-function | caffeine |
| Sun Ritual | composition | — |
| Anti-Inflammatory | composition | — |
| Detox & Clarity | composition | — |

**Detox has no authorised backing in any regime and is not going to acquire
any**, so that card talks about greens and sugar rather than about cleansing.
Live cultures are likewise not an authorised claim, so kefir is named as an
ingredient rather than credited with anything.

Tests fail if a compositional line starts using function-claim language, if a
function claim loses its nutrient, or if any line acquires disease language.

The standard disclaimer is shown once, beside the claims rather than in a
footer.

### Naming is held to a stricter rule

A drink's name and story end up on a public board under a real person's name.
They may describe the glass — what is in it, how it tastes, when you would have
it — and may not claim it does anything to a body.

A prompt is a request, so this is enforced rather than asked for: a claim filter
drops offending **sentences** and keeps the rest, so a story that is three good
lines and one overreaching one loses the one instead of becoming empty.

Two holes in that filter were found by its own tests: `"boosts your metabolism"`
(the optional "your" was not optional in practice) and `"Fat Burner"` — the same
claim as "burns fat" with the words swapped, and a rule that catches one is not
a rule.

---

## 5. The evidence table

`sources.ts` grades sources A–D and separates three kinds: `nutrition`,
`market`, `efficacy`.

**There are zero efficacy rows.** A claim with no row there is not shown to a
user. That is why the compositional goals stay compositional: not caution for
its own sake, but the absence of anything to cite.
