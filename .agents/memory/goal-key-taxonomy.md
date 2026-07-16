---
name: Smoothy King goal-key taxonomy
description: Canonical benefit/goal keys shared by API seed data, routes, and frontend color/label maps
---

The six canonical goal keys are: `glowy-skin`, `hydration`, `sun-ritual`, `protein-power`, `anti-inflammatory`, `detox-clarity`.

**Why:** An earlier build seeded `protein`/`detox` while the frontend maps (colors, labels, filters) only knew the canonical keys, causing raw-key badges and broken styling. Code review caught it and DB rows had to be migrated.

**How to apply:** Any new seed data, route logic (e.g. `/recipes/by-benefit`), or UI goal map must use exactly these keys. Ingredient `category` values and recipe `tags` are freeform and exempt. If a key ever changes, migrate DB arrays (`benefits`, `skin_benefit_key`, `creations.goal`) in the same change.
