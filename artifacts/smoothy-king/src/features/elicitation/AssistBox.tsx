import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Check, Plus } from "lucide-react";
import { proposeOptions, type AssistResponse, type AssistStep } from "./index";

/**
 * A second way to answer an onboarding step: say it in your own words.
 *
 * The buttons below it are unchanged and remain the primary path. This box
 * offers the ones a sentence points at — it never selects anything on its own.
 * The user taps, every time, and that is deliberate rather than an unfinished
 * state: an allergy ticked on someone's behalf by a language model is a
 * different kind of mistake from a taste preference that is, and the only
 * shape safe for both is one where a proposal can offer and never set.
 *
 * Each suggestion is its own button. One "select these" for all of them made
 * the common case — the model got two of three right — into all-or-nothing,
 * so the choice was between accepting something wrong and re-typing the
 * sentence. Tapping a chip applies that one and leaves the rest, and "take
 * all" is there for when they are all right, which is most of the time.
 *
 * If the request fails, nothing changes on screen except a line saying so. The
 * form was already complete without this.
 */

interface Props {
  step: AssistStep;
  placeholder: string;
  /** Called with the ids the user accepted. Never called on its own. */
  onAccept: (ids: string[]) => void;
}

export function AssistBox({ step, placeholder, onAccept }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AssistResponse | null>(null);
  const [failed, setFailed] = useState(false);

  async function submit() {
    if (!text.trim() || pending) return;
    setPending(true);
    setFailed(false);
    setResult(null);
    setTaken([]);
    try {
      setResult(await proposeOptions(step, text.trim()));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  const [taken, setTaken] = useState<string[]>([]);

  function take(ids: string[]) {
    const fresh = ids.filter((id) => !taken.includes(id));
    if (fresh.length === 0) return;
    onAccept(fresh);
    setTaken((prev) => [...prev, ...fresh]);
  }

  /** Clears the panel once every suggestion has been dealt with. */
  function takeAll() {
    if (!result) return;
    take(result.proposed.map((o) => o.id));
    setResult(null);
    setTaken([]);
    setText("");
  }

  return (
    <div className="mb-8 rounded-2xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Or just say it in your own words</span>
      </div>

      <div className="flex gap-2">
        <Input
          value={text}
          placeholder={placeholder}
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
          Couldn&apos;t read that just now — the options above still work.
        </p>
      )}

      {result && result.proposed.length > 0 && (
        <div className="mt-4">
          {result.message && <p className="text-sm text-muted-foreground mb-3">{result.message}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {result.proposed.map((o) => {
              const already = taken.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={already}
                  onClick={() => take([o.id])}
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

            {/* For when they are all right, which is most of the time. */}
            {result.proposed.length > 1 && taken.length < result.proposed.length && (
              <Button type="button" size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={takeAll}>
                Take all
              </Button>
            )}
          </div>
          {result.confidence === "low" && (
            <p className="text-xs text-muted-foreground mt-2">Not very sure about this one — worth a look.</p>
          )}
        </div>
      )}

      {/* Said something clear that no option covers. Distinct from finding
          nothing, and worth saying differently: the first is our gap, the
          second is a sentence that did not mention this step. */}
      {result && result.outOfDomain && (
        <p className="text-sm text-muted-foreground mt-3">
          We don&apos;t have an option for
          {result.unmappedText ? ` “${result.unmappedText}”` : " that"} yet.
        </p>
      )}

      {result && result.proposed.length === 0 && !result.outOfDomain && (
        <p className="text-sm text-muted-foreground mt-3">
          Nothing there matched this question — try the options above.
        </p>
      )}
    </div>
  );
}
