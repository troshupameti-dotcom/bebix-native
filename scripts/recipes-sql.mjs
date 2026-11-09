#!/usr/bin/env node
/**
 * Recetat → migrim SQL, në stilin e stories_library: $s$…$s$ për tekstet dhe "on conflict (slug) do nothing".
 *
 *   node scripts/recipes-sql.mjs <recetat.json> <dalja.sql> "Përshkrimi në krye të skedarit"
 *
 * Hyrja është një listë recetash me fushat e `lib/recipes/types.ts` (camelCase). Para shkrimit kontrollohen
 * fushat, njësitë dhe slug-et; çdo gabim e ndal skriptin pa shkruar asgjë. Testi i sigurisë së përmbajtjes
 * (`__tests__/recipesSafety.test.ts`) ekzekutohet veç.
 *
 *   node scripts/recipes-sql.mjs --foods <ushqimet.json> <dalja.sql> "Përshkrimi"
 *
 * Ushqimet e para (content/recipes/foods.json) → `public.foods`, me "on conflict (food_key) do nothing".
 */
import fs from "node:fs";

const UNITS = ["g", "ml", "copë", "lugë gjelle", "lugë çaji", "filxhan"];
const STAGES = ["pure", "mashed", "finger", "family"];

const FOODS_MODE = process.argv[2] === "--foods";
const [input, output, header = FOODS_MODE ? "Ushqime të reja." : "Receta të reja."] = process.argv.slice(FOODS_MODE ? 3 : 2);
if (!input || !output) {
  console.error('Përdorimi: node scripts/recipes-sql.mjs [--foods] <hyrja.json> <dalja.sql> "përshkrimi"');
  process.exit(1);
}

const t = (s) => `$s$${s ?? ""}$s$`;
const arr = (list) => `array[${(list ?? []).map((x) => `'${x}'`).join(", ")}]::text[]`;
const json = (v) => `${t(JSON.stringify(v))}::jsonb`;
const comment = (text) =>
  text
    .split("\n")
    .map((line) => `-- ${line}`.trimEnd())
    .join("\n");

if (FOODS_MODE) {
  const CATEGORIES = ["fruit", "vegetable", "grain", "protein", "dairy", "allergen"];
  const RISKS = ["low", "medium", "high"];
  const foods = JSON.parse(fs.readFileSync(input, "utf8"));
  const bad = [];
  const keys = new Set();
  for (const f of foods) {
    const where = f.foodKey ?? "(pa food_key)";
    if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(f.foodKey ?? "")) bad.push(`${where}: food_key i pavlefshëm`);
    if (keys.has(f.foodKey)) bad.push(`${where}: food_key i përsëritur`);
    keys.add(f.foodKey);
    if (!CATEGORIES.includes(f.category)) bad.push(`${where}: kategoria`);
    if (!RISKS.includes(f.chokingRisk)) bad.push(`${where}: rreziku i mbytjes`);
    for (const k of ["6-8", "9-11", "12+"]) if (!f.serveByAge?.[k]) bad.push(`${where}: mungon servirja për ${k}`);
    for (const text of [f.name, f.tip, ...Object.values(f.serveByAge ?? {})]) if (String(text).includes("$s$")) bad.push(`${where}: teksti përmban $s$`);
  }
  if (bad.length) {
    console.error(bad.join("\n"));
    process.exit(1);
  }
  const rows = foods.map(
    (f, i) =>
      `(${t(f.foodKey)}, ${t(f.name)}, '${f.category}', ${f.ageFromMonths}, '${f.chokingRisk}', ${f.allergen ? `'${f.allergen}'` : "null"},\n` +
      `  ${json(f.serveByAge)},\n  ${arr(f.nutrients)}, ${t(f.tip)}, ${(i + 1) * 10})`
  );
  fs.writeFileSync(
    output,
    `${comment(header)}
-- I sigurt për t'u ekzekutuar dy herë: ushqimet që ekzistojnë (sipas food_key) nuk preken, as ndryshimet e adminit.
-- Nuk fshin asgjë. Kërkon migrimin 20261111090000_foods.sql.

insert into public.foods (food_key, name, category, age_from_months, choking_risk, allergen, serve_by_age, nutrients, tip, sort_order)
values
${rows.join(",\n")}
on conflict (food_key) do nothing;
`
  );
  console.log(`${foods.length} ushqime → ${output}`);
  process.exit(0);
}

const recipes = JSON.parse(fs.readFileSync(input, "utf8"));
const problems = [];
const seen = new Set();
for (const r of recipes) {
  const where = r.slug ?? "(pa slug)";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug ?? "") || r.slug.length > 80) problems.push(`${where}: slug i pavlefshëm`);
  if (seen.has(r.slug)) problems.push(`${where}: slug i përsëritur`);
  seen.add(r.slug);
  if (!STAGES.includes(r.stage)) problems.push(`${where}: stage i panjohur`);
  if (!(r.ageMaxMonths >= r.ageMinMonths)) problems.push(`${where}: mosha`);
  if (!Array.isArray(r.steps) || !r.steps.length) problems.push(`${where}: pa hapa`);
  for (const ing of r.ingredients ?? []) {
    if (!UNITS.includes(ing.unit)) problems.push(`${where}: njësia "${ing.unit}" te "${ing.name}"`);
    if (!(typeof ing.amount === "number" && ing.amount > 0)) problems.push(`${where}: sasia te "${ing.name}"`);
  }
  for (const text of [r.title, r.summary, ...(r.steps ?? [])]) if (String(text).includes("$s$")) problems.push(`${where}: teksti përmban $s$`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const texts = (list) => `array[\n    ${(list ?? []).map(t).join(",\n    ")}\n  ]::text[]`;
const ingredients = (list) =>
  json(list.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, food_key: i.foodKey ?? null, ...(i.optional ? { optional: true } : {}) })));

const COLUMNS =
  "slug, language, title, summary, age_min_months, age_max_months, stage, feeding_style, meal_types, prep_minutes, cook_minutes, " +
  "yield_note, family_factor, ingredients, steps, serve_by_age, allergens, diet_tags, nutrients, freezer_friendly, storage_note, " +
  "freezer_note, reheat_note, choking_note, family_tip, season, is_albanian, cover_key, status, featured, sort_order, source";

const rows = recipes.map((r) =>
  [
    "(",
    `  ${t(r.slug)}, 'sq', ${t(r.title)},`,
    `  ${t(r.summary)},`,
    `  ${r.ageMinMonths}, ${r.ageMaxMonths}, '${r.stage}', ${arr(r.feedingStyle)}, ${arr(r.mealTypes)}, ${r.prepMinutes}, ${r.cookMinutes},`,
    `  ${t(r.yieldNote)}, ${r.familyFactor},`,
    `  ${ingredients(r.ingredients)},`,
    `  ${texts(r.steps)},`,
    `  ${json(r.serveByAge ?? {})},`,
    `  ${arr(r.allergens)}, ${arr(r.dietTags)}, ${arr(r.nutrients)}, ${r.freezerFriendly ? "true" : "false"},`,
    `  ${t(r.storageNote)},`,
    `  ${t(r.freezerNote)},`,
    `  ${t(r.reheatNote)},`,
    `  ${t(r.chokingNote)},`,
    `  ${t(r.familyTip)},`,
    `  ${arr(r.season)}, ${r.isAlbanian ? "true" : "false"}, ${r.cover ? `'${r.cover}'` : "null"}, 'published', ${r.featured ? "true" : "false"}, ${r.sortOrder}, 'editor'`,
    ")",
  ].join("\n")
);

const sql = `${comment(header)}
-- I sigurt për t'u ekzekutuar dy herë: recetat që ekzistojnë (sipas slug) nuk preken, as ndryshimet e adminit.
-- Nuk fshin asgjë. Kërkon migrimin 20261110090000_recipes.sql.

insert into public.recipes (${COLUMNS})
values
${rows.join(",\n")}
on conflict (slug) do nothing;
`;

fs.writeFileSync(output, sql);
console.log(`${recipes.length} receta → ${output}`);
