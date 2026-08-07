import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Check } from "lucide-react";

/**
 * A second way to answer an onboarding step: say it in your own words.
 *
 * The buttons below it are unchanged and remain the primary path. This box
 * highlights the ones a sentence points at — it never selects anything. The
 * user still taps, every time, and that is deliberate rather than an unfinished
 * state: an allergy that gets ticked on someone's behalf by a language model is
 * a different kind of mistake from a taste preference that does, and the only
 * shape that is safe for both is one where a proposal can offer and never set.
 *
 * If the request fails, nothing changes on screen except a line saying so. The
 * form was already complete without this.
 */

interface ProposedOption {
  id: string;
  label: string;
}

interface AssistResponse {
  proposed: ProposedOption[];
  confidence: "high" | "medium" | "low";
  message: string;
  outOfDomain: boolean;
  unmappedText: string;
}

interface Props {
  /** One of: activity, allergies, goals, taste. */
  step: string;
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
    try {
      const res = await fetch("/api/onboarding/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, text: text.trim() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as AssistResponse);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  function accept() {
    if (!result || result.proposed.length === 0) return;
    onAccept(result.proposed.map((o) => o.id));
    setResult(null);
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
            {result.proposed.map((o) => (
              <span
                key={o.id}
                className="px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary border border-primary/30"
              >
                {o.label}
              </span>
            ))}
            {/* Nothing is applied until this is pressed. */}
            <Button type="button" size="sm" className="rounded-full gap-1.5 ml-1" onClick={accept}>
              <Check className="w-3.5 h-3.5" />
              Select these
            </Button>
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
