import { GOAL_HEX, GOAL_LABELS } from "@/lib/colors";
import type { GoalPeriod } from "./index";

/**
 * The goal, shown back to the person whose goal it is.
 *
 * Their own sentence leads when there is one, and the category sits beside it
 * as a quiet label. The eight goals are a vocabulary the system computes with;
 * "I keep crashing at 3pm" is what the person came here about, and a screen
 * that greets them with "Energy & Focus" is addressing them in a taxonomy they
 * never used. Showing both is honest in a way that showing only their words
 * would not be — the category is what actually drives the build, so hiding it
 * would misrepresent what the app is doing.
 *
 * With no narrative, the category leads on its own. Nothing is invented to
 * fill the gap: a sentence put in someone's mouth reads far worse than no
 * sentence.
 *
 * One component, used on the goal screen and at the top of the builder, so the
 * two cannot end up describing the same commitment differently.
 */
export function GoalBanner({
  period,
  size = "large",
  showProgress = true,
}: {
  period: GoalPeriod;
  size?: "large" | "compact";
  showProgress?: boolean;
}) {
  const label = period.copy?.label ?? GOAL_LABELS[period.goal] ?? period.goal;
  const totalDays = period.weeks * 7;
  const pct = Math.min(100, Math.round((period.daysElapsed / totalDays) * 100));
  const large = size === "large";

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-4">
        <span
          className="w-3 h-3 rounded-full shrink-0 mt-2"
          style={{ background: GOAL_HEX[period.goal] ?? "#ccc" }}
        />
        <div className="flex-1 min-w-0">
          {period.narrative ? (
            <>
              <p
                className={`font-serif font-medium leading-snug ${large ? "text-2xl mb-2" : "text-lg mb-1.5"}`}
              >
                {/* Quoted, because it is theirs and not the app talking. */}
                &ldquo;{period.narrative}&rdquo;
              </p>
              <p className="text-sm text-muted-foreground">
                Filed under <span className="font-medium text-foreground">{label}</span> · day{" "}
                {period.daysElapsed + 1} of {totalDays}
              </p>
            </>
          ) : (
            <>
              <p className={`font-serif font-medium ${large ? "text-2xl mb-1" : "text-lg"}`}>{label}</p>
              <p className="text-sm text-muted-foreground">
                Day {period.daysElapsed + 1} of {totalDays} · {period.daysRemaining} to go
              </p>
            </>
          )}
        </div>
      </div>

      {showProgress && (
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-4">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
