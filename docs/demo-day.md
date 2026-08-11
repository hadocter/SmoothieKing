# Smoothy King — Demo Day run-of-show

## The problem and the promise

Most recipe apps assume you already know what you want to make. Smoothy King
starts earlier: a person names a goal, constraints, and time available; the
app turns that into a smoothie they can actually build and a plan for the
week. Its promise is not that every drink will taste perfect or cure anything.
Its promise is a transparent, repeatable, constraint-checked starting point.

## Live demo path

Keep the live run focused on one user journey.

1. **Set the stakes.** “I want something high-protein before morning classes,
   but I cannot have dairy.”
2. **Onboard.** Enter the goal, dietary restriction/allergy, dislikes, and
   time. If using the demo account, briefly open the saved profile instead of
   spending the presentation typing.
3. **Build.** Generate a drink and show the visible ingredient list, goal-fit,
   nutrition, and recipe steps. Say clearly: “AI may understand the sentence;
   code chose and checked the ingredients.”
4. **Use it.** Mark the drink made, then open **This week**. The shopping list
   comes from the actual planned drinks, not from a generic pantry checklist.
5. **Handle friction.** Mark an ingredient “Not this week.” Select a displayed
   alternative or choose **Skip it**. Show that the plan reacts without
   bypassing the same constraints.
6. **Close.** “The key outcome is that you can start with a goal instead of a
   recipe, and still see what you need to make the plan real.”

## Five-minute pacing

| Time | What to show |
| --- | --- |
| 0:00–0:30 | Slide 1: the user problem and the product promise. |
| 0:30–1:00 | Slide 2: why a controlled catalog is more useful than a generic recipe list. |
| 1:00–3:30 | Slide 3, then leave the deck for the live onboarding → build → log → weekly-plan loop. |
| 3:30–4:15 | Slide 4: the model/code safety boundary. |
| 4:15–5:00 | Slide 5: close with what works now and the two honest next steps. |

The five slides are deliberately not a substitute for the live product. If the
demo is running long, shorten the onboarding explanation—not the one core loop.

## Presenter checklist

- Use the deployed URL in a private/incognito window before presenting.
- Prepare one completed demo account and a backup fresh-email address.
- Confirm `/api/healthz` returns 200 shortly before the session.
- Have a screen recording or screenshots only as a backup; lead with the live
  application.
- Keep the optional Groq key configured if you plan to show language mapping.
  If it is unavailable, say that the visible keyword fallback is running.

## Direct Q&A answers

### “Couldn’t I just ask ChatGPT for a smoothie?”

It can write a recipe, but it does not give this controlled catalog, repeatable
selection, deterministic allergen/diet exclusions, or verified nutrition
arithmetic. In our product, AI only helps understand the request and write
presentation copy; code decides what goes in the drink.

### “Does it guarantee results or taste?”

No. It does not predict taste or promise a health outcome. It helps people
turn a stated goal into a repeatable, constraint-checked routine. Taste pairing
rules and post-consumption adaptation are future work.

### “What happens if I do not have an ingredient?”

The weekly shelf offers safe alternatives when they satisfy the same build
constraints. The user can also skip an ingredient; the app does not pretend an
incomplete drink is valid.

### “What are the biggest limitations?”

The app currently assumes a blender, does not model medication or pregnancy
interactions, and lacks a taste-prediction model. It also does not know local
availability or price. Those limits are documented in the README instead of
being hidden behind a broad wellness claim.

### “How did you use AI to build this?”

We used coding assistants for pair programming, testing ideas, documentation,
and UI review. The team set constraints, inspected changes, tested the app,
and made final decisions. The product’s safety-critical decisions are not
model-generated. See [AI collaboration disclosure](ai-collaboration.md).

## Slide deck

The accompanying editable PowerPoint deck is saved at
`docs/demo-day/Smoothy-King-Demo-Day.pptx`. It supports this same live-first
story rather than replacing the application with slides.
