/**
 * What a drink looks like, derived from what is in it.
 *
 * Every ingredient carries a hex. A card showing a gradient built from the
 * actual picks means the six options on the choosing screen are visually
 * distinct because they are *different drinks*, not because a palette was
 * cycled — a green one looks green because there is spinach in it. It also
 * gives a published recipe something to show when the author adds no photo,
 * which beats a stock image of a drink that is not theirs.
 *
 * Pure, so the same drink always looks the same, and so the server and the
 * client cannot disagree about a colour.
 */

import type { Pick } from "./builder.ts";

const FALLBACK = "#E0E0E0";

const isHex = (v: string | null | undefined): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const toHex = (rgb: [number, number, number]): string =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** Perceived lightness, 0–1. The usual luma weights, not a plain mean. */
function luma(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

export interface Appearance {
  /** Two or three stops, light to dark. */
  stops: string[];
  /** Ready-to-use CSS, so the client does not re-derive the angle. */
  css: string;
  /** The blend, for the cup fill and for anything needing one colour. */
  blend: string;
  /** Readable text colour over `blend` — black or white, whichever contrasts. */
  onBlend: string;
}

/**
 * A gradient for a set of picks.
 *
 * Built from the most *characterful* ingredients rather than the largest ones.
 * By volume almost every smoothie is mostly liquid, so weighting by grams
 * would make every card the colour of milk or coconut water. Sorting by
 * distance from the blend average puts the spinach and the beetroot at the
 * ends, which is what makes two drinks look different from each other.
 */
export function appearanceOf(picks: Pick[], hexOf: (name: string) => string | null): Appearance {
  const hexes = picks.map((p) => hexOf(p.name)).filter(isHex);

  if (hexes.length === 0) {
    return {
      stops: [FALLBACK, FALLBACK],
      css: `linear-gradient(160deg, ${FALLBACK}, ${FALLBACK})`,
      blend: FALLBACK,
      onBlend: "#1a1a1a",
    };
  }

  const avg = hexes.reduce((acc, h) => mix(acc, h, 1 / hexes.length), hexes[0]);
  const blend = hexes.reduce(
    (acc, h, i) => (i === 0 ? h : mix(acc, h, 1 / (i + 1))),
    hexes[0],
  );

  const distance = (h: string): number => {
    const [ar, ag, ab] = toRgb(h);
    const [br, bg, bb] = toRgb(avg);
    return Math.hypot(ar - br, ag - bg, ab - bb);
  };

  const distinct = [...new Set(hexes)].sort((a, b) => distance(b) - distance(a));

  // Three stops when there is enough variety to be worth it, two otherwise —
  // a three-stop gradient between near-identical colours is just a flat panel
  // with extra work.
  const chosen = distinct.length >= 3 ? [distinct[0], blend, distinct[1]] : [distinct[0], distinct[distinct.length - 1]];

  // Light to dark reads as depth rather than as a random diagonal.
  const stops = [...new Set(chosen)].sort((a, b) => luma(b) - luma(a));
  const ordered = stops.length >= 2 ? stops : [stops[0], mix(stops[0], "#000000", 0.25)];

  return {
    stops: ordered,
    css: `linear-gradient(160deg, ${ordered.join(", ")})`,
    blend,
    // WCAG's usual cut: light backgrounds take dark text and vice versa.
    onBlend: luma(blend) > 0.55 ? "#1a1a1a" : "#ffffff",
  };
}

/**
 * The ingredients worth naming on a card.
 *
 * The first few by build order, which is liquid then protein then flavour —
 * the order that describes a drink the way someone would say it out loud.
 * Liquid is skipped once there is anything else to say, because "coconut
 * water" is true of half the catalog and tells nobody anything.
 */
export function representativeIngredients(picks: Pick[], limit = 3): string[] {
  const notable = picks.filter((p) => p.slot !== "liquid");
  return (notable.length >= limit ? notable : picks).slice(0, limit).map((p) => p.name);
}
