# Smoothy King — five-minute Demo Day flow

## Outcome to prove

A person who does not know what smoothie to make can state a goal and
constraint, receive a checked drink, and leave with an actionable weekly
ingredient plan.

## Run of show

| Time | Presenter action | What the audience should understand |
| --- | --- | --- |
| 0:00–0:45 | Use slides 1–2 to introduce one busy person with a goal and a dietary constraint. | Recipe apps start with recipes; Smoothy King starts with the person. |
| 0:45–3:15 | Leave the deck. Sign in to the prepared account, show the saved goal/constraint, generate a drink, show visible ingredients/nutrition/steps, log it, then open **This week**. | The core loop is live: goal → checked drink → usable plan. |
| 3:15–4:00 | Show the safety boundary slide. | AI can interpret a request; deterministic code chooses ingredients and checks slots, exclusions, and nutrition. |
| 4:00–4:30 | State one limit plainly: Smoothy King does not yet predict taste. | Flavor-family tags are not pairing or satisfaction data; feedback and tested pairing rules are next. |
| 4:30–5:00 | Leave room for a slow click or close with the core promise. | “Start with a goal. Leave with a checked plan.” |

## Live path checklist

1. Open the deployed URL in an incognito/private window before the presentation.
2. Use a prepared demo account; do not spend live time creating an account.
3. Use one concrete scenario: high-protein before morning classes, with a dairy
   restriction or allergy.
4. Generate one smoothie and point to its build facts and recipe steps.
5. Log it, open **This week**, mark one ingredient unavailable, then select a
   safe substitute or **Skip it**.
6. If the live service fails, state the failure, play `demo_emergency_90s.mp4`,
   and return to the product/Q&A rather than attempting a live repair.

## Honest Q&A anchors

- **Why not ask a general chatbot?** A model can write a recipe, but this app
  keeps a controlled catalog and deterministic safety, nutrition, and required
  recipe-slot checks.
- **Does it guarantee results or taste?** No. It is not medical advice and it
  does not yet predict taste. It provides a transparent, constraint-checked
  plan.
- **What breaks at 100 users?** The product has not been load-tested at that
  scale. Before a broader launch: load-test, add API rate limiting and
  observability, and review DB-pool/account-verification settings.
- **How was AI used?** Coding assistants supported implementation and review;
  the team reviewed changes and deterministic code, not the model, makes
  safety-critical decisions. See `docs/ai-collaboration.md`.
