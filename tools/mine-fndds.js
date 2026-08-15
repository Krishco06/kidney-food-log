/*
 * Emit curated lines from a systematic FNDDS sweep.
 *
 * Maps every WWEIA food category onto one of the app's eleven groups, then
 * takes the most generic unused records from each. FNDDS marks its generic
 * average with ", NFS" (Not Further Specified), which is exactly the record a
 * built-in library wants — "Taco, NFS" is the average taco.
 *
 * Skips fdcIds AND display names already shipped, so a re-run is idempotent.
 */
const fs = require('fs');
const SRC = process.argv[2];
if (!SRC) { console.error('usage: node tools/mine-fndds.js <survey.json> [perCategory]'); process.exit(1); }
const foods = JSON.parse(fs.readFileSync(SRC, 'utf8')).SurveyFoods;

const lib = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'commonfoods.js'), 'utf8');
const usedIds = new Set(lib.split('\n')
  .map((l) => { const m = l.match(/^\s*\[(\d+),/); return m ? Number(m[1]) : null; }).filter(Boolean));
const usedNames = new Set((lib.match(/^\s*\[\d+,"([^"]+)"/gm) || [])
  .map((l) => l.replace(/^\s*\[\d+,"/, '').replace(/"$/, '').toLowerCase()));

/* WWEIA category -> app group. Anything unmapped is skipped, which is how baby
 * food, human milk and the "Not included" bucket drop out. */
/*
 * WWEIA category -> app group, restricted to DISH-LIKE categories only.
 *
 * The first pass mapped everything and immediately offered "Apple, raw" and
 * "Banana, raw" next to the SR Legacy apples and bananas already shipped:
 * near-duplicate whole foods with slightly different numbers, which is
 * confusing rather than useful.
 *
 * So the division of labour that justified adding FNDDS at all is enforced
 * here. SR Legacy is laboratory-analysed and owns single ingredients. FNDDS
 * owns what SR structurally lacks: mixed dishes, sandwiches, prepared items
 * and made-up drinks. Raw fruit, plain milk and blocks of cheese stay SR-only.
 */
const MAP = {
  // --- mixed dishes and sandwiches: the whole reason FNDDS is here ---
  'Bean, pea, legume dishes': 'Prepared', 'Burgers': 'Prepared',
  'Burritos and tacos': 'Prepared', 'Cheese sandwiches': 'Prepared',
  'Chicken fillet sandwiches': 'Prepared', 'Coleslaw, non-lettuce salads': 'Prepared',
  'Deli and cured meat sandwiches': 'Prepared', 'Egg rolls, dumplings, sushi': 'Prepared',
  'Egg/breakfast sandwiches': 'Prepared', 'Frankfurter sandwiches': 'Prepared',
  'Fried rice and lo/chow mein': 'Prepared', 'Macaroni and cheese': 'Prepared',
  'Meat and BBQ sandwiches': 'Prepared', 'Meat mixed dishes': 'Prepared',
  'Nachos': 'Prepared', 'Other Mexican mixed dishes': 'Prepared',
  'Pasta mixed dishes, excludes macaroni and cheese': 'Prepared',
  'Peanut butter and jelly sandwiches': 'Prepared', 'Pizza': 'Prepared',
  'Poultry mixed dishes': 'Prepared', 'Rice mixed dishes': 'Prepared',
  'Seafood mixed dishes': 'Prepared', 'Seafood sandwiches': 'Prepared',
  'Soups': 'Prepared', 'Stir-fry and soy-based sauce mixtures': 'Prepared',
  'Vegetable sandwiches/burgers': 'Prepared', 'Lettuce and lettuce salads': 'Prepared',
  'Eggs and omelets': 'Prepared', 'Pancakes, waffles, French toast': 'Prepared',

  // --- prepared vegetable dishes (SR has raw/boiled; these are cooked dishes) ---
  'Vegetable dishes': 'Vegetable', 'Fried vegetables': 'Vegetable',
  'Mashed potatoes and white potato mixtures': 'Vegetable',
  'French fries and other fried white potatoes': 'Vegetable',

  // --- made-up drinks, which SR barely covers ---
  'Coffee': 'Drinks', 'Smoothies and grain drinks': 'Drinks',
  'Milk shakes and other dairy drinks': 'Drinks', 'Nutritional beverages': 'Drinks',

  // --- prepared sweets and bakery items ---
  'Doughnuts, sweet rolls, pastries': 'Snacks',
  'Turnovers and other grain-based items': 'Snacks',
  'Gelatins, ices, sorbets': 'Snacks', 'Pudding': 'Snacks',

  // --- dips and sauces as served (SR has bottled; FNDDS has the dips) ---
  'Dips, gravies, other sauces': 'Extras'
};

const SKIP = /baby |toddler|infant|human milk|, NS as to|^Water, |diet frozen meal|Puerto Rican|, dry mix|, dry$/i;
/* "Sandwich, NFS" and "Meat, NFS" are averages so broad they tell a reader
 * nothing. A vague entry that looks precise is worse than no entry. */
const VAGUE = /^(Sandwich|Meat|Food|Dish|Mixture|Soup|Salad|Sauce|Dip|Dessert|Beverage|Drink|Fruit|Vegetable|Cereal|Snack), NFS$/i;

function score(d) {
  let s = d.length;
  if (/, NFS$/i.test(d)) s -= 100;
  if (/\bwith\b|, from|, made|, prepared with/i.test(d)) s += 20;
  if (/reduced fat|low.?fat|fat free|nonfat|light|unsweetened|no sugar/i.test(d)) s += 45;
  return s;
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
function pretty(d) {
  return d.replace(/,?\s*NFS$/i, '').replace(/,\s*NFS\b/gi, '')
    .replace(/\s+/g, ' ').trim().replace(/^(.)/, (m) => m.toUpperCase());
}

const byCat = new Map();
for (const f of foods) {
  const cat = (f.wweiaFoodCategory && f.wweiaFoodCategory.wweiaFoodCategoryDescription) || '';
  const group = MAP[cat];
  if (!group || usedIds.has(f.fdcId) || SKIP.test(f.description)) continue;
  if (VAGUE.test(f.description)) continue;
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(f);
}

const perCat = Number(process.argv[3] || 4);
const lines = [];
const takenNames = new Set(usedNames);

for (const cat of [...byCat.keys()].sort()) {
  const group = MAP[cat];
  const list = byCat.get(cat).sort((a, b) => score(a.description) - score(b.description));
  let taken = 0;
  for (const f of list) {
    if (taken >= perCat) break;
    const name = pretty(f.description);
    if (!name || takenNames.has(name.toLowerCase())) continue;
    takenNames.add(name.toLowerCase());
    lines.push(`  ['${group}', '${name.replace(/'/g, "\\'")}', /^${esc(f.description)}$/],`);
    taken++;
  }
}

console.log('/* ' + lines.length + ' candidates from ' + byCat.size + ' mapped categories */');
console.log(lines.join('\n'));
