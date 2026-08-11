# AI collaboration disclosure

Smoothy King was built with AI coding assistants as collaborators, not as an
unreviewed code generator or as the authority for nutrition/safety decisions.

## How AI assisted the team

- Explored implementation approaches and explained unfamiliar parts of the
  TypeScript, React, Express, Docker, and Drizzle stack.
- Drafted and refactored code, tests, release notes, UI copy, and documentation.
- Helped audit routes, authentication boundaries, malformed input handling,
  responsive layouts, and the complete smoothie-building flow.
- Assisted with visual QA and with preparing README and Demo Day materials.

Every suggested change was reviewed against the repository, tested locally, and
accepted or rejected by the team. The team chose the scope, product claims,
data boundaries, deployment settings, and final wording. No secrets, database
URLs, production tokens, or user records were sent to an assistant.

## Concrete examples of the collaboration

- **We used AI coding assistants to** explore and draft implementation options,
  test cases, UI copy, and release documentation across the React, Express,
  Docker, and Drizzle codebase.
- **The AI-assisted photo workflow got visual matching wrong:** review exposed
  a red drink on the cold-green-tea card and other mismatches. We replaced the
  reviewed tea image manually and changed the publishing workflow so a manifest
  is not updated until a human gives explicit visual approval.
- **We wrote and reviewed the acceptance tests and deterministic guardrails
  ourselves** for required liquid/protein slots, fail-closed allergy checks,
  and malformed requests, because a plausible response is not proof that a
  drink is safe, complete, or buildable.

## How AI is used in the product

The application can optionally use Groq-hosted language models for two
bounded tasks:

1. Map a user’s everyday-language goal to the app’s controlled goal and taste
   options.
2. Write a non-medical drink name and short story after a drink is already
   built.

The following are **not** delegated to a model:

- ingredient selection or quantities;
- required liquid/protein slots;
- allergy, diet, and dislike exclusion;
- nutrition totals or goal-fit scoring; and
- the decision to publish a drink as safe.

Those decisions are made by deterministic, tested code. If the optional model
is unavailable, the app uses a keyword-matching fallback and tells the user.

## Why the boundary matters

Language models are useful for interpreting a phrase such as “I want to feel
ready for a long morning,” but they are not the source of truth for an
allergen-safe recipe or a nutrition figure. Smoothy King keeps the expressive
language task separate from the safety-critical build task so that a model
outage or a persuasive-sounding answer cannot silently change what goes in the
glass.
