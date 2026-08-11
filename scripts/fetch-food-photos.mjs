#!/usr/bin/env node
/**
 * Download candidate food photos for every ingredient into the web app's
 * static folder, so nothing is fetched from unsplash.com at runtime.
 *
 * Why this exists as a script rather than a hand-written URL list: the list it
 * replaces mapped Coconut Water to a photo of salmon, and Mango and Dragon
 * Fruit to the same image, because the ids were pasted in by hand. Searching
 * by name removes that whole class of mistake — the query *is* the ingredient.
 * A search result is still a candidate, not an approval: inspect _qa.html
 * before publishing it to the live manifest.
 *
 *   1. Reads UNSPLASH_ACCESS_KEY from the environment (never committed; the
 *      key is used here at build time and never ships in the image).
 *   2. Searches Unsplash for each name and downloads the top landscape result.
 *   3. With --approve, records the visually reviewed local files in the
 *      generated manifest the API reads. Without that flag, the existing live
 *      manifest is left untouched.
 *
 * Idempotent: a name whose file already exists is skipped, so a run stopped by
 * the demo-tier rate limit (50 requests/hour) can simply be run again to
 * finish. Delete a file to have the next run re-fetch just that one.
 *
 *   node scripts/fetch-food-photos.mjs            # download ingredient candidates
 *   node scripts/fetch-food-photos.mjs --approve  # publish reviewed local files
 *   node scripts/fetch-food-photos.mjs --force    # re-fetch even if present
 *
 * The Unsplash License permits downloading, hosting and commercial use with no
 * attribution required. A concise Unsplash source notice is still written.
 */

import { writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PUBLIC = join(ROOT, "artifacts", "smoothy-king", "public", "food");
const MANIFEST = join(ROOT, "artifacts", "api-server", "src", "features", "catalog", "food-photos.generated.ts");
const CREDITS = join(PUBLIC, "CREDITS.md");

const KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!KEY) {
  console.error(
    "\nUNSPLASH_ACCESS_KEY is not set.\n" +
      "Create a free app at https://unsplash.com/developers, copy its Access Key,\n" +
      "and add a line to .env:  UNSPLASH_ACCESS_KEY=your-key-here\n" +
      "Then run this again. The key stays in .env (gitignored) and never ships.\n",
  );
  process.exit(1);
}

const FORCE = process.argv.includes("--force");
const APPROVE = process.argv.includes("--approve");

/**
 * The search term for each name, where the name alone finds the wrong thing.
 *
 * "Whey Protein Isolate" on its own surfaces branded tubs; "protein powder
 * scoop" is the picture people mean. "Ice" is a search engine's worst enemy.
 * Everything not listed is searched by its own name.
 */
const QUERY = {
  "Coconut Water": "coconut water glass",
  "Cold green tea": "green tea matcha drink",
  "Almond milk": "almond milk jug",
  "Oat milk": "oats glass milk",
  "Soy milk": "soy milk glass",
  "Whole milk": "glass of milk",
  "Greek yogurt": "greek yogurt bowl",
  "Whey Protein Isolate": "protein powder scoop",
  "Pea protein": "protein powder scoop",
  "Collagen Peptides": "collagen powder scoop",
  "Silken tofu": "silken tofu",
  "Espresso shot": "espresso coffee",
  "Ground flaxseed": "flax seeds",
  "Chia seeds": "chia seeds",
  "Rolled oats": "rolled oats bowl",
  "Cacao powder": "cacao powder",
  "Medjool date": "medjool dates",
  "Maple syrup": "maple syrup jug",
  "Ice": "ice cubes",
  "Tart cherries": "cherries bowl",
  "Lemon juice": "fresh lemons",
  "Beetroot": "beetroot",
  "Spirulina": "spirulina powder",
  "Matcha": "matcha powder",
  "Vanilla": "vanilla pods",
  "Almond butter": "almond butter jar",
  "Peanut butter": "peanut butter jar",
};

const slug = (name) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function fetchList(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** One image: search by term, download the top landscape hit at card size. */
async function grab(name, kind) {
  const file = join(PUBLIC, kind, `${slug(name)}.jpg`);
  if (!FORCE && existsSync(file)) return "skip";

  const q = encodeURIComponent(QUERY[name] ?? name);
  const search = await fetchList(
    `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape&content_filter=high&client_id=${KEY}`,
  );
  const hit = search.results?.[0];
  if (!hit) return "none";

  // A fixed card-sized crop keeps files small (~60–120 KB) and uniform.
  const src = `${hit.urls.raw}&w=900&h=540&fit=crop&crop=entropy&q=80&fm=jpg`;
  const img = await fetch(src);
  if (!img.ok) throw new Error(`image ${img.status}`);
  await writeFile(file, Buffer.from(await img.arrayBuffer()));

  return "ok";
}

async function run() {
  await mkdir(join(PUBLIC, "ingredients"), { recursive: true });

  // These lists are the source of truth for what the app has. Kept here rather
  // than read from the database so the script runs without one.
  const ingredients = [
    "Almond butter", "Banana", "Blueberry", "Cacao powder", "Cinnamon", "Dragon Fruit",
    "Lemon juice", "Mango", "Orange", "Peanut butter", "Pineapple", "Spinach",
    "Strawberries", "Tart cherries", "Tomato", "Vanilla", "Watermelon", "Avocado",
    "Beetroot", "Collagen Peptides", "Espresso shot", "Ginger", "Ground flaxseed",
    "Matcha", "Spirulina", "Turmeric", "Almond milk", "Coconut Water", "Cold green tea",
    "Oat milk", "Soy milk", "Whole milk", "Greek yogurt", "Kefir", "Pea protein",
    "Silken tofu", "Whey Protein Isolate", "Honey", "Maple syrup", "Medjool date",
    "Chia seeds", "Ice", "Rolled oats",
  ];

  let calls = 0;

  for (const name of ingredients) {
    try {
      const r = await grab(name, "ingredients");
      if (r === "ok") calls += 1;
      console.log(`  ${r.padEnd(4)} ${name}`);
    } catch (err) {
      if (String(err).includes("403")) {
        console.error(`\nHit the hourly rate limit after ${calls} downloads. Run again in an hour to finish the rest.\n`);
        break;
      }
      console.error(`  fail ${name}: ${err.message}`);
    }
  }

  // Build the list from the directory rather than this run's requests. A
  // rate-limited run must never make already-downloaded photos disappear.
  const knownSlugs = new Set(ingredients.map(slug));
  const files = await readdir(join(PUBLIC, "ingredients"), { withFileTypes: true });
  const list = files
    .filter((file) => file.isFile() && file.name.endsWith(".jpg"))
    .map((file) => file.name.slice(0, -4))
    .filter((name) => knownSlugs.has(name))
    .sort();

  if (APPROVE) {
    await writeFile(
      MANIFEST,
      "// Generated by scripts/fetch-food-photos.mjs --approve — do not edit by hand.\n" +
        "// Visually reviewed ingredient slugs with a bundled photo under /food/ingredients.\n" +
        `export const INGREDIENT_PHOTOS = new Set<string>(${JSON.stringify(list, null, 2)});\n`,
    );
  }

  await writeFile(
    CREDITS,
    "# Photo credits\n\n" +
      "All bundled food photography in this folder is sourced from Unsplash.\n\n" +
      "Bundled under the Unsplash License (unsplash.com/license), which needs no\n" +
      "attribution.\n",
  );

  console.log(
    APPROVE
      ? `\nDone. ${list.length} reviewed ingredient photos are live.`
      : `\nDone. ${list.length} ingredient photos are on disk. Open /food/_qa.html, then rerun with --approve to publish them.`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
