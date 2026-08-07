import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Check, Plus } from "lucide-react";
import { proposeOptions, type ProposedOption } from "@/features/elicitation";

/**
 * "Say what today is like."
 *
 * One box, three questions. A sentence like "just refreshing, light one" is
 * about taste and about size, and neither is a goal — asked only about goals,
 * it came back as "nothing there matched this question", which is true and
 * useless. The three axes are asked in parallel and the answers land in
 * whichever of them they belong to.
 *
 * Three calls rather than one schema covering everything: each axis validates
 * against its own options, which is the property that stops a taste word being
 * accepted as a goal. One slow axis does not hold up the others, and one that
 * fails costs its own suggestions rather than the whole box.
 */

const AXES = ["goals", "taste", "effort"] as const;

const AXIS_LABEL: Record<string, string> = {
  goals: "Also for",
  taste: "Taste",
  effort: "Size",
};

interface Group {
  axis: string;
  options: ProposedOption[];
}

export function TodayBox({
  onAccept,
  disabledIds,
}: {
  onAccept: (axis: string, id: string) => void;
  /** Already applied elsewhere — shown as taken rather than offered again. */
  disabledIds: string[];
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [degraded, setDegraded] = useState(false);

  async function submit() {
    if (!text.trim() || pending) return;
    setPending(true);
    setFailed(false);
    setGroups(null);
    setTaken([]);
    try {
      const results = await Promise.all(
        AXES.map((axis) =>
          proposeOptions(axis, text.trim())
            .then((r) => ({ axis, options: r.proposed, by: r.answeredBy }))
            // A failed axis is one missing suggestion, not a broken box.
            .catch(() => ({ axis, options: [] as ProposedOption[], by: "" })),
        ),
      );
      const found = results.filter((g) => g.options.length > 0);
      // The keyword fallback matches literal words, so it misses anything
      // phrased around them. Saying so beats letting a degraded answer read as
      // the feature being bad at its job.
      setDegraded(results.some((r) => r.by.includes("fallback")));
      if (found.length === 0) setFailed(true);
      setGroups(found);
    } finally {
      setPending(false);
    }
  }

  function take(axis: string, id: string) {
    if (taken.includes(id)) return;
    onAccept(axis, id);
    setTaken((prev) => [...prev, id]);
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Say what today is like</span>
      </div>

      <div className="flex gap-2">
        <Input
          value={text}
          placeholder="e.g. just refreshing, light one — shoulders are wrecked"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          maxLength={500}
          className="rounded-xl"
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-xl shrink-0"
          disabled={pending || !text.trim()}
          onClick={() => void submit()}
        >
          {pending ? "Reading…" : "Suggest"}
        </Button>
      </div>

      {failed && (
        <p className="text-sm text-muted-foreground mt-3">
          {degraded
            ? "Couldn't read that properly just now — try again in a moment, or use the options below."
            : "Nothing in there we could use — the options below still work."}
        </p>
      )}

      {degraded && !failed && (
        <p className="text-xs text-muted-foreground mt-3">
          Read on keywords this time, so it may have missed something.
        </p>
      )}

      {groups && groups.length > 0 && (
        <div className="mt-4 space-y-3">
          {groups.map((g) => (
            <div key={g.axis} className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground w-16 shrink-0">
                {AXIS_LABEL[g.axis] ?? g.axis}
              </span>
              {g.options.map((o) => {
                const already = taken.includes(o.id) || disabledIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={already}
                    onClick={() => take(g.axis, o.id)}
                    aria-pressed={already}
                    className={`px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1.5 transition-colors ${
                      already
                        ? "bg-primary/5 text-muted-foreground border-border cursor-default"
                        : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                    }`}
                  >
                    {already ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {o.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
