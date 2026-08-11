# Design notes

Written to be read on their own, and to be a source for presentation material.
Each one states what the system does, the numbers it uses, and — where it
matters — the failure that produced the current design.

| | |
|---|---|
| [smoothie-building.md](smoothie-building.md) | How a drink gets built: slots, ranking, taste, presets, nutrition arithmetic, and how a finished drink is scored |
| [allergen-check.md](allergen-check.md) | The deterministic safety check: id matching, the three routes, failing closed, and the verification screen |
| [nutrition-data.md](nutrition-data.md) | Where the figures come from, what was refused, and what may be claimed |
| [local-docker.md](local-docker.md) | Running the whole thing locally |
| [deploying.md](deploying.md) | The production image, what only exists in production, and hosting that cuts off rather than bills |

---

## The one-line version

**Code decides what goes in the glass. A model decides what it is called.**

| Decided by code | Decided by a model |
|---|---|
| Ingredient selection and quantities | The drink's name |
| Allergen and diet exclusion | The story on the publish screen |
| Goal-fit scores, nutrition totals | Mapping free text onto options |
| Which recipes are offered | |

A model naming a drink badly costs a rename. A model choosing ingredients would
put an unverifiable step between someone's allergy and their glass.

Everything in the first column is deterministic: same input, same output, no
network, tested without one. The seed is an *input*, so variety and
reproducibility are not in tension.

---

## Findings worth presenting

Each of these was a real defect, and most were found by reading output rather
than by a test.

**Tag counting cannot see dose.** The 42 g protein shaker scored 0.29 for
protein-power — below its own glowy-skin score — because two scoops of whey and
a quarter avocado are one tag each. → [smoothie-building.md](smoothie-building.md#dose-for-protein)

**A filter that matches nothing looks exactly like a filter with nothing to
catch.** Onboarding stored `"Tree Nuts"`, the catalog stored `tree-nut`, nothing
translated, and almond butter went straight through. →
[allergen-check.md](allergen-check.md#2-the-bug-this-replaced)

**Comparing per-100 g figures against real totals removed an entire slot.**
Turmeric at 312 kcal/100 g read as 312 calories when 2 g of it is six. Every
spice and powder was rejected, and the drinks still looked plausible. →
[smoothie-building.md](smoothie-building.md#the-bug-this-replaced)

**USDA search returns wrong foods confidently.** `oats` returned oat oil, 884
kcal and 0 g protein, and it was already in the data. →
[nutrition-data.md](nutrition-data.md#2-usda-search-cannot-be-trusted)

**Teaching a model caution can suppress the task itself.** "Do not infer beyond
what was said" made it refuse to map "muscular body" onto Protein & Power —
which is not an inference, it is the same thing in the user's words. Mapping and
inferring had to be stated as different things.

**Measurements that disagree between runs are measuring different things.** 60%
of model calls were silently falling back to keyword matching on a rate limit,
because a 429 was being treated like a permanent failure.

**A silent degradation is worse than a visible one.** An allergen check that ran
with no profile returned "clear" — the reassuring wrong answer, delivered
without a word.

**The one number nobody checks is the one that gets invented.** The landing
page reported 2,841 members and 19,260 rituals completed — hardcoded on the
server, and hardcoded a second time in the client as its fallback, so the
figures survived an empty database, a failed request and a fresh deployment
identically. They are counted now and allowed to be small. The space they
occupied went to figures that are true by construction: 43 ingredients and
440,640 possible drinks, computed from the catalog and the build skeleton on
every request rather than written down.

**A front door that does not know you.** One page served `/` regardless of
session, so a member who clicked the logo was invited to join a community they
were in and to explore a membership they had, under five steps describing a
build flow that two rewrites had removed. The signed-in half is now the day —
the goal in their own words, whether today's drink has been made, what they
made before — assembled from components that already existed.
