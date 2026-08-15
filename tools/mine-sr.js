/*
 * Systematic sweep of SR Legacy, the counterpart to tools/mine-fndds.js.
 *
 * SR Legacy was hand-curated for the first several expansions and then written
 * off as "hyper-specific cuts". That was wrong: of 6,625 unused full-panel
 * records, 4,242 are not cut-level at all — smoked haddock, gruyere, edam,
 * poi, potato flour, prune puree, almond paste. Those are ordinary foods, they
 * are laboratory-analysed, and nothing else in the pipeline was reaching them.
 *
 * Two problems this has to solve that the FNDDS miner did not:
 *
 *   1. SR descriptions are cut-level by design. "Beef, chuck, arm pot roast,
 *      separable lean only, trimmed to 0" fat, choice, cooked, braised" is a
 *      real record and a terrible library entry, so anything carrying butchery
 *      or grading vocabulary is rejected outright.
 *
 *   2. SR names are comma-inverted and category-prefixed: "Fish, haddock,
 *      smoked", "Nuts, pecans", "Cheese, edam". The prefix is redundant once
 *      the food is filed under Fish or Dairy, so it is stripped.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node tools/mine-sr.js <sr_legacy.json> [perCategory]');
  process.exit(1);
}
const perCat = Number(process.argv[3] || 40);

const foods = JSON.parse(fs.readFileSync(SRC, 'utf8')).SRLegacyFoods;
const NEED = [1003, 1008, 1091, 1092, 1093];

const lib = fs.readFileSync(path.join(__dirname, '..', 'js', 'commonfoods.js'), 'utf8');
const usedIds = new Set(lib.split('\n')
  .map((l) => { const m = l.match(/^\s*\[(\d+),/); return m ? Number(m[1]) : null; }).filter(Boolean));
const usedNames = (lib.match(/^\s*\[\d+,"([^"]+)"/gm) || [])
  .map((l) => l.replace(/^\s*\[\d+,"/, '').replace(/"$/, ''));

/* Butchery grades, lab qualifiers, institutional and regional records. */
const REJECT = /separable lean|trimmed to|all grades|, choice|, select|, prime|composite of|Babyfood|baby food|USDA Commodity|school|Alaska Native|Navajo|puerto rican|infant|formula|, NFY|leavening|industrial|unprepared|reheated|frozen, unprep/i;

/*
 * Second pass of rejections, all from reading the first run's output.
 *
 *   offal and fat      "Veal, seam fat only", "Lamb ... testes, raw",
 *                      "Pork, fresh, backfat" — real records, but not things
 *                      a dialysis patient is looking up to log dinner
 *   ratites            twelve near-identical emu and ostrich cuts crowded out
 *                      genuinely common foods in the Meat quota
 *   dry mixes          a cake mix is not a cake; the prepared form is already
 *                      in the library where SR has one
 *   botanical names    "Sisymbrium sp. seeds" is a species, not a food name
 */
const NOISE = /separable fat|seam fat|external fat|backfat|salt pork|, giblets|testes|brains|sweetbread|, tripe|, lungs|, spleen|, pancreas|mechanically separated|retail cuts/i;
const RATITE = /^(Ostrich|Emu|Beaver|Muskrat|Opossum|Raccoon|Squirrel|Horse|Beefalo)\b/i;
const DRYMIX = /dry mix|, dry, powder|powder, dry|rennin|pectin|gums, /i;
const BOTANICAL = /\bsp\.\s|\bspp\b|glandless|Sisymbrium|potherb/i;

/*
 * Brand names, in TWO regexes on purpose.
 *
 * SR shouts most brands in capitals, so the first test is deliberately
 * case-SENSITIVE. Merging the two and adding /i for the name list made
 * `[A-Z]{4,}` match any four letters in any case, which rejected 4,209 of
 * 4,235 candidates — nearly the entire dataset — and left the run looking like
 * the data had simply run out.
 */
const BRAND_SHOUT = /[A-Z]{4,}[ ,]/;
const BRAND_NAME = /KELLOGG|GENERAL MILLS|QUAKER|NESTLE|KRAFT|CAMPBELL|HEINZ|HERSHEY|NABISCO|FRITO|PEPSI|COCA|Reese|Kit Kat|Glutino|Van's|Mori-Nu|Alpen|Familia|Lean Pockets|Oscar Mayer|Reddi|Perrier|Evian|Dannon|Bull's-Eye|Tabasco|Stove Top/i;

const CAT_MAP = {
  'Vegetables and Vegetable Products': 'Vegetable',
  'Fruits and Fruit Juices': 'Fruit',
  'Dairy and Egg Products': 'Dairy',
  'Finfish and Shellfish Products': 'Fish',
  'Nut and Seed Products': 'Beans & nuts',
  'Legumes and Legume Products': 'Beans & nuts',
  'Cereal Grains and Pasta': 'Grains',
  'Baked Products': 'Grains',
  'Breakfast Cereals': 'Grains',
  'Poultry Products': 'Meat',
  'Sausages and Luncheon Meats': 'Meat',
  'Lamb, Veal, and Game Products': 'Meat',
  'Pork Products': 'Meat',
  'Beef Products': 'Meat',
  'Sweets': 'Snacks',
  'Snacks': 'Snacks',
  'Beverages': 'Drinks',
  'Fats and Oils': 'Extras',
  'Spices and Herbs': 'Extras',
  'Soups, Sauces, and Gravies': 'Extras',
  'Meals, Entrees, and Side Dishes': 'Prepared'
};

/*
 * Strip the redundant category prefix. Once a food is filed under Fish,
 * "Fish, haddock, smoked" only needs to say "Haddock, smoked".
 */
const PREFIX = [
  [/^Fish, /, ''], [/^Mollusks, /, ''], [/^Crustaceans, /, ''],
  [/^Nuts, /, ''], [/^Seeds, /, ''], [/^Spices, /, ''],
  [/^Beverages, /, ''], [/^Snacks, /, ''], [/^Candies, /, ''],
  [/^Game meat, /, ''], [/^Cereals ready-to-eat, /, ''], [/^Cereals, /, ''],
  [/^Alcoholic beverage, /, '']
];

/*
 * These prefixes are LOAD-BEARING and must be moved, not dropped.
 *
 * The first version stripped them like the rest, which turned "Oil, corn" into
 * "Corn", "Soup, egg drop" into "Egg drop" and "Salad dressing, caesar,
 * fat-free" into "Caesar, fat-free". Every one of those reads as a different
 * food, or as no food at all.
 */
const REORDER = [
  [/^Oil, (.+)$/, '$1 oil'],
  [/^Soup, (.+)$/, '$1 soup'],
  [/^Sauce, (.+)$/, '$1 sauce'],
  [/^Gravy, (.+)$/, '$1 gravy'],
  [/^Salad dressing, (.+)$/, '$1 dressing'],
  [/^Fat, (.+)$/, '$1 fat'],
  [/^Syrups, (.+)$/, '$1 syrup'],
  [/^Frostings, (.+)$/, '$1 frosting'],
  [/^Sugars, (.+)$/, '$1 sugar'],
  [/^Toppings, (.+)$/, '$1 topping'],
  [/^Desserts, (.+)$/, '$1 dessert']
];

function pretty(d) {
  var s = d;
  for (const [re, to] of REORDER) if (re.test(s)) { s = s.replace(re, to); break; }
  for (const [re, to] of PREFIX) s = s.replace(re, to);
  s = s.replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/i, '')
    .replace(/\s*\(includes[^)]*\)/i, '')
    .replace(/\s+/g, ' ').trim();
  /* SR shouts some descriptions; tone them down rather than drop them. */
  if (s === s.toUpperCase() && s.length > 3) {
    s = s.toLowerCase().replace(/(^|[\s,(\-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }
  return s.replace(/^(.)/, (m) => m.toUpperCase());
}

/* Prefer short, plain records. */
function score(d) {
  let s = d.length;
  if (/, raw$/.test(d)) s += 10;      // cooked forms are usually more useful
  if (/, cooked/.test(d)) s -= 15;
  if (/, canned|, dried|, frozen/.test(d)) s -= 5;
  if (/, with salt/.test(d)) s += 30;  // sodium is tracked; prefer unsalted
  return s;
}

const STOP = new Set(['with', 'without', 'and', 'the', 'from', 'other', 'than',
  'type', 'style', 'made', 'ready', 'eat', 'average', 'assorted', 'plain', 'raw']);
function tokens(name) {
  return new Set((name.toLowerCase().match(/[a-z]{3,}/g) || [])
    .filter((w) => !STOP.has(w)).map((w) => w.replace(/(ies|es|s)$/, '')));
}
function isSubset(a, b) { for (const t of a) if (!b.has(t)) return false; return true; }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

const existingTokens = usedNames.map(tokens);
const byCat = new Map();

for (const f of foods) {
  const ids = new Set(f.foodNutrients.map((n) => n.nutrient.id));
  if (!NEED.every((i) => ids.has(i))) continue;
  if (usedIds.has(f.fdcId)) continue;
  if (REJECT.test(f.description)) continue;
  if (BRAND_SHOUT.test(f.description) || BRAND_NAME.test(f.description)) continue;
  if (NOISE.test(f.description) || DRYMIX.test(f.description)) continue;
  if (BOTANICAL.test(f.description) || RATITE.test(f.description)) continue;
  /* Malformed source text: "Bread, protein,, toasted". */
  if (/,\s*,/.test(f.description)) continue;
  const cat = (f.foodCategory && f.foodCategory.description) || '';
  const group = CAT_MAP[cat];
  if (!group) continue;
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(f);
}

const lines = [];
const keptTokens = [];
const drop = { nearDup: 0, badName: 0 };

for (const cat of [...byCat.keys()].sort()) {
  const group = CAT_MAP[cat];
  const list = byCat.get(cat).sort((a, b) => score(a.description) - score(b.description));
  let taken = 0;
  for (const f of list) {
    if (taken >= perCat) break;
    const name = pretty(f.description);
    if (!name || name.length < 3 || name.length > 44) { drop.badName++; continue; }

    const t = tokens(name);
    if (!t.size) { drop.badName++; continue; }
    let dup = false;
    for (const e of existingTokens) if (isSubset(t, e) || isSubset(e, t)) { dup = true; break; }
    if (!dup) for (const e of keptTokens) if (isSubset(t, e) || isSubset(e, t)) { dup = true; break; }
    if (dup) { drop.nearDup++; continue; }

    keptTokens.push(t);
    lines.push(`  ['${group}', '${name.replace(/'/g, "\\'")}', /^${esc(f.description)}$/],`);
    taken++;
  }
}

console.log('/* ' + lines.length + ' candidates from ' + byCat.size + ' SR categories */');
console.log(lines.join('\n'));
console.error('dropped: ' + JSON.stringify(drop));
