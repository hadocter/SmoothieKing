import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Globe, Lock } from "lucide-react";
import type { BuiltDrink } from "./index";

/**
 * Offering the drink to the board.
 *
 * The name and story arrive already written and stay editable. That ordering
 * is the point: an empty "tell us about your blend" box after someone has
 * already made and drunk a smoothie is a chore, and most people close it. A
 * draft they can disagree with is a much easier thing to be handed.
 *
 * Publishing is opt-in and stays opt-in. The drink was built from this
 * person's profile and goal, so it is theirs by default and only becomes
 * public because they said so — the screen can be skipped entirely and the
 * recipe simply stays in their history.
 *
 * With no photo, the gradient from the choosing screen stands in. It is
 * derived from the ingredients actually in the glass, so it is a picture of
 * this drink rather than a stock photo of a different one.
 */

/** Longest edge after downscaling. Keeps a phone photo inside the field cap. */
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.72;

/**
 * Downscales in the browser before upload.
 *
 * A modern phone photo is 3–8MB, and the recipe row will not take that. Doing
 * it here rather than server-side also means the oversized bytes never leave
 * the device.
 */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function PublishForm({
  drink,
  onPublish,
  onSkip,
  busy,
}: {
  drink: BuiltDrink;
  onPublish: (patch: { name: string; description: string; imageUrl: string }) => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState(drink.name);
  const [story, setStory] = useState(drink.description ?? "");
  const [photo, setPhoto] = useState<string>("");
  const [photoError, setPhotoError] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const css = drink.appearance?.css ?? "linear-gradient(160deg, #d8cfc2, #a89684)";

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoError(false);
    try {
      setPhoto(await toDataUrl(file));
    } catch {
      setPhotoError(true);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">
          Nice one
        </span>
        <h1 className="font-serif text-4xl font-medium mb-2">Put it on the board?</h1>
        <p className="text-muted-foreground">
          We&apos;ve made a start. Change anything — it&apos;s yours either way.
        </p>
      </div>

      <div className="rounded-3xl border bg-card overflow-hidden mb-8">
        <div className="relative h-52" style={{ background: photo ? undefined : css }}>
          {photo && <img src={photo} alt="" className="w-full h-full object-cover" />}

          {photo ? (
            <button
              type="button"
              onClick={() => setPhoto("")}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/90 backdrop-blur grid place-items-center shadow-sm"
              aria-label="Remove photo"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-3 right-3 px-4 py-2 rounded-full bg-background/90 backdrop-blur text-sm font-medium shadow-sm inline-flex items-center gap-2"
            >
              <ImagePlus className="w-4 h-4" />
              Add a photo
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </div>

        <div className="p-6 space-y-5">
          {!photo && (
            <p className="text-xs text-muted-foreground">
              No photo? The colours above come from what&apos;s actually in it.
            </p>
          )}
          {photoError && (
            <p className="text-xs text-destructive">
              Couldn&apos;t read that image — try a different one.
            </p>
          )}

          <div>
            <label className="text-sm font-semibold mb-2 block">Name</label>
            <Input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="text-lg py-6 rounded-2xl bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">The story</label>
            <Textarea
              value={story}
              maxLength={1000}
              onChange={(e) => setStory(e.target.value)}
              className="rounded-2xl bg-background min-h-[120px]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" size="lg" className="rounded-full px-6 gap-2" onClick={onSkip}>
          <Lock className="w-4 h-4" />
          Keep it to myself
        </Button>
        <Button
          size="lg"
          className="rounded-full px-8 gap-2"
          disabled={busy || !name.trim()}
          onClick={() => onPublish({ name: name.trim(), description: story.trim(), imageUrl: photo })}
        >
          <Globe className="w-4 h-4" />
          {busy ? "Posting…" : "Post it"}
        </Button>
      </div>
    </div>
  );
}
