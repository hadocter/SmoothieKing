export const GOAL_COLORS: Record<string, string> = {
  'glowy-skin': 'bg-goal-glowy text-foreground',
  'hydration': 'bg-goal-hydration text-foreground',
  'sun-ritual': 'bg-goal-sun text-foreground',
  'protein-power': 'bg-goal-protein text-white',
  'anti-inflammatory': 'bg-goal-anti text-foreground',
  'detox-clarity': 'bg-goal-detox text-foreground',
  'gut-health': 'bg-goal-gut text-white',
  'energy-focus': 'bg-goal-energy text-white',
};

export const GOAL_TEXT_COLORS: Record<string, string> = {
  'glowy-skin': 'text-goal-glowy',
  'hydration': 'text-goal-hydration',
  'sun-ritual': 'text-goal-sun',
  'protein-power': 'text-goal-protein',
  'anti-inflammatory': 'text-goal-anti',
  'detox-clarity': 'text-goal-detox',
  'gut-health': 'text-goal-gut',
  'energy-focus': 'text-goal-energy',
};

export const GOAL_BORDER_COLORS: Record<string, string> = {
  'glowy-skin': 'border-goal-glowy',
  'hydration': 'border-goal-hydration',
  'sun-ritual': 'border-goal-sun',
  'protein-power': 'border-goal-protein',
  'anti-inflammatory': 'border-goal-anti',
  'detox-clarity': 'border-goal-detox',
  'gut-health': 'border-goal-gut',
  'energy-focus': 'border-goal-energy',
};

export const GOAL_LABELS: Record<string, string> = {
  'glowy-skin': 'Glowy Skin',
  'hydration': 'Deep Hydration',
  'sun-ritual': 'Sun Ritual',
  'protein-power': 'Protein & Power',
  'anti-inflammatory': 'Anti-Inflammatory',
  'detox-clarity': 'Detox & Clarity',
  'gut-health': 'Gut Health',
  'energy-focus': 'Energy & Focus',
};

export const GOAL_HEX: Record<string, string> = {
  'glowy-skin': '#FFAF7A',
  'hydration': '#48D1CC',
  'sun-ritual': '#FF6B80',
  'protein-power': '#8A2BE2',
  'anti-inflammatory': '#FFC300',
  'detox-clarity': '#9ACD32',
  'gut-health': '#D97A5C',
  'energy-focus': '#0EA5E9',
};

export const GOALS = Object.keys(GOAL_LABELS);

/**
 * A card's background when the drink has no photograph.
 *
 * Most drinks have none — they are built rather than shot, and a photo is
 * optional on the publish screen by design. The fallback used to be one stock
 * photograph of a strawberry smoothie, served for every recipe that lacked an
 * image: a picture of a drink that is not the drink, repeated down the page
 * until the images stopped meaning anything.
 *
 * The goals it serves are at least about this drink. Generated drinks get a
 * gradient from their own ingredients instead; this is for the catalog rows,
 * which have benefits but no ingredient colours to hand.
 */
export function gradientForGoals(benefits: string[] | undefined | null): string {
  const stops = (benefits ?? []).map((b) => GOAL_HEX[b]).filter(Boolean);
  if (stops.length === 0) return 'var(--color-muted)';
  if (stops.length === 1) return stops[0];
  return `linear-gradient(150deg, ${stops.join(', ')})`;
}
