/*
 * Generator: build js/commonfoods.js from the USDA SR Legacy bulk dataset.
 *
 * Run once, offline, from the scratchpad. The output is committed; this script
 * is not shipped. Values are USDA public domain (CC0).
 *
 * WHY A CURATED LIST RATHER THAN THE WHOLE DATASET
 * SR Legacy is 7,793 foods / 210 MB. Bundling it would defeat the offline PWA.
 * More importantly, most of it is unusable for this audience: "Beef, chuck,
 * arm pot roast, separable lean and fat, trimmed to 1/8" fat, choice, cooked,
 * braised" is not something a dialysis patient scans a list for. So we pick
 * everyday foods and give each a plain name.
 */

const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || path.join(__dirname, 'srdata', 'FoodData_Central_sr_legacy_food_json_2018-04.json');
const OUT = path.join(__dirname, '..', 'js', 'commonfoods.js');

const NUTRIENT = { 1008: 'energy', 1003: 'protein', 1093: 'sodium', 1092: 'potassium', 1091: 'phosphorus' };

/*
 * [category, display name, match regex]
 *
 * Chosen for everyday US eating, deliberately spanning the whole potassium and
 * phosphorus range. We do NOT skew toward "kidney-friendly" foods: the app is a
 * logbook, and a log you cannot record your actual dinner in is useless. What
 * the user ate is not our judgment to make.
 */
const CURATED = [
  // ---- Fruits ----
  ['Fruit', 'Apple, with skin', /^Apples, raw, with skin/],
  ['Fruit', 'Applesauce, unsweetened', /^Applesauce, canned, unsweetened, without/],
  ['Fruit', 'Banana', /^Bananas, raw/],
  ['Fruit', 'Blueberries', /^Blueberries, raw/],
  ['Fruit', 'Strawberries', /^Strawberries, raw/],
  ['Fruit', 'Raspberries', /^Raspberries, raw/],
  ['Fruit', 'Grapes, red or green', /^Grapes, red or green \(European/],
  ['Fruit', 'Orange', /^Oranges, raw, all commercial varieties/],
  ['Fruit', 'Cantaloupe', /^Melons, cantaloupe, raw/],
  ['Fruit', 'Watermelon', /^Watermelon, raw/],
  ['Fruit', 'Peach', /^Peaches, yellow, raw/],
  ['Fruit', 'Pear', /^Pears, raw/],
  ['Fruit', 'Pineapple', /^Pineapple, raw, all varieties/],
  ['Fruit', 'Cherries, sweet', /^Cherries, sweet, raw/],
  ['Fruit', 'Plum', /^Plums, raw/],
  ['Fruit', 'Mango', /^Mangos, raw/],
  ['Fruit', 'Avocado', /^Avocados, raw, all commercial varieties/],
  ['Fruit', 'Raisins', /^Raisins, golden, seedless/],
  ['Fruit', 'Prunes, dried', /^Plums, dried \(prunes\), uncooked/],
  ['Fruit', 'Dates', /^Dates, medjool/],
  ['Fruit', 'Cranberries, dried sweetened', /^Cranberries, dried, sweetened/],
  ['Fruit', 'Fruit cocktail, canned in juice', /^Fruit cocktail, \(peach and pineapple and pear and grape and cherry\), canned, juice pack/],
  ['Fruit', 'Lemon', /^Lemons, raw, without peel/],
  ['Fruit', 'Kiwi', /^Kiwifruit, green, raw/],

  // ---- Vegetables ----
  ['Vegetable', 'Potato, baked with skin', /^Potatoes, baked, flesh and skin, without salt/],
  ['Vegetable', 'Potato, boiled without skin', /^Potatoes, boiled, cooked without skin, flesh, without salt/],
  ['Vegetable', 'Mashed potatoes', /^Potatoes, mashed, home-prepared, whole milk and margarine/],
  ['Vegetable', 'French fries, oven-heated', /^Potatoes, french fried, steak fries, salt added in processing, frozen, oven-heated/],
  ['Vegetable', 'Sweet potato, baked', /^Sweet potato, cooked, baked in skin, flesh, without salt/],
  ['Vegetable', 'Carrots, raw', /^Carrots, raw/],
  ['Vegetable', 'Broccoli, cooked', /^Broccoli, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Green beans, cooked', /^Beans, snap, green, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Corn, cooked', /^Corn, sweet, yellow, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Peas, green, cooked', /^Peas, green, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Lettuce, iceberg', /^Lettuce, iceberg \(includes crisphead types\), raw/],
  ['Vegetable', 'Spinach, raw', /^Spinach, raw/],
  ['Vegetable', 'Tomato, raw', /^Tomatoes, red, ripe, raw, year round average/],
  ['Vegetable', 'Tomato sauce, canned', /^Tomato products, canned, sauce$/],
  ['Vegetable', 'Cucumber', /^Cucumber, with peel, raw/],
  ['Vegetable', 'Onion, raw', /^Onions, raw/],
  ['Vegetable', 'Bell pepper, green', /^Peppers, sweet, green, raw/],
  ['Vegetable', 'Cabbage, raw', /^Cabbage, raw/],
  ['Vegetable', 'Cauliflower, raw', /^Cauliflower, raw/],
  ['Vegetable', 'Celery, raw', /^Celery, raw/],
  ['Vegetable', 'Mushrooms, raw', /^Mushrooms, white, raw/],
  ['Vegetable', 'Zucchini, cooked', /^Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Corn, canned', /^Corn, sweet, yellow, canned, whole kernel, drained solids$/],
  

  // ---- Grains, bread, cereal ----
  ['Grains', 'White bread', /^Bread, white, commercially prepared \(includes soft bread crumbs\)/],
  ['Grains', 'Whole wheat bread', /^Bread, whole-wheat, commercially prepared$/],
  ['Grains', 'White rice, cooked', /^Rice, white, long-grain, regular, enriched, cooked/],
  ['Grains', 'Brown rice, cooked', /^Rice, brown, long-grain, cooked/],
  ['Grains', 'Spaghetti, cooked', /^Pasta, cooked, enriched, without added salt/],
  ['Grains', 'Oatmeal, cooked', /^Cereals, oats, regular and quick, unenriched, cooked with water \(includes boiling and microwaving\), without salt/],
  ['Grains', 'Corn flakes cereal', /Corn Flakes$/],
  ['Grains', 'Bagel, plain', /^Bagels, plain, enriched, with calcium propionate/],
  ['Grains', 'English muffin', /^Muffins, English, wheat/],
  ['Grains', 'Flour tortilla', /^Tortillas, ready-to-bake or -fry, flour/],
  ['Grains', 'Corn tortilla', /^Tortillas, ready-to-bake or -fry, corn/],
  ['Grains', 'Saltine crackers', /^Crackers, saltines \(includes oyster, soda, soup\)/],
  ['Grains', 'Hamburger or hot dog bun', /^Rolls, hamburger or hotdog, plain/],
  ['Grains', 'Pancakes', /^Pancakes, plain, prepared from recipe/],
  ['Grains', 'Grits, cooked', /^Cereals, corn grits, white, regular and quick, enriched, cooked with water, without salt/],

  // ---- Meat & poultry ----
  ['Meat', 'Chicken breast, roasted', /^Chicken, broilers or fryers, breast, meat only, cooked, roasted/],
  ['Meat', 'Chicken thigh, roasted', /^Chicken, broilers or fryers, thigh, meat only, cooked, roasted/],
  ['Meat', 'Ground beef, cooked', /^Beef, ground, 85% lean meat \/ 15% fat, patty, cooked, pan-broiled/],
  ['Meat', 'Beef steak, cooked', /^Beef, loin, top loin steak, boneless, lip off, separable lean only, trimmed to 0" fat, all grades, cooked, grilled/],
  ['Meat', 'Pork chop, cooked', /^Pork, fresh, loin, center rib \(chops\), boneless, separable lean only, cooked, broiled/],
  ['Meat', 'Bacon, cooked', /^Pork, cured, bacon, cooked, baked/],
  ['Meat', 'Ham, sliced', /^Ham, sliced, regular \(approximately 11% fat\)/],
  ['Meat', 'Turkey breast, roasted', /^Turkey, whole, breast, meat only, cooked, roasted/],
  ['Meat', 'Hot dog, beef', /^Frankfurter, beef, unheated/],
  ['Meat', 'Bologna', /^Bologna, beef$/],
  ['Meat', 'Pork sausage, cooked', /^Pork sausage, link\/patty, cooked, pan-fried/],
  

  // ---- Fish & seafood ----
  ['Fish', 'Salmon, cooked', /^Fish, salmon, Atlantic, farmed, cooked, dry heat/],
  ['Fish', 'Tuna, canned in water', /^Fish, tuna, light, canned in water, drained solids/],
  ['Fish', 'Tilapia, cooked', /^Fish, tilapia, cooked, dry heat/],
  ['Fish', 'Cod, cooked', /^Fish, cod, Atlantic, cooked, dry heat/],
  ['Fish', 'Shrimp, cooked', /^Crustaceans, shrimp, mixed species, cooked, moist heat/],
  ['Fish', 'Catfish, cooked', /^Fish, catfish, channel, farmed, cooked, dry heat/],

  // ---- Dairy & eggs ----
  ['Dairy', 'Whole milk', /^Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D/],
  ['Dairy', 'Skim milk', /^Milk, nonfat, fluid, with added vitamin A and vitamin D \(fat free or skim\)/],
  ['Dairy', 'Cheddar cheese, sliced', /^Cheese, cheddar, sharp, sliced/],
  ['Dairy', 'American cheese', /^Cheese, pasteurized process, American, fortified with vitamin D/],
  ['Dairy', 'Mozzarella cheese', /^Cheese, mozzarella, whole milk$/],
  ['Dairy', 'Cottage cheese', /^Cheese, cottage, creamed, large or small curd$/],
  ['Dairy', 'Cream cheese', /^Cheese, cream$/],
  ['Dairy', 'Yogurt, plain whole milk', /^Yogurt, plain, whole milk$/],
  ['Dairy', 'Greek yogurt, plain', /^Yogurt, Greek, plain, whole milk/],
  ['Dairy', 'Egg, hard-boiled', /^Egg, whole, cooked, hard-boiled/],
  ['Dairy', 'Butter, salted', /^Butter, salted$/],
  ['Dairy', 'Ice cream, vanilla', /^Ice creams, vanilla$/],
  ['Dairy', 'Sour cream', /^Cream, sour, cultured$/],

  // ---- Beans, nuts, legumes ----
  ['Beans & nuts', 'Peanut butter, chunky', /^Peanut butter, chunk style, with salt/],
  ['Beans & nuts', 'Peanuts, roasted', /^Peanuts, all types, dry-roasted, with salt/],
  ['Beans & nuts', 'Almonds', /^Nuts, almonds$/],
  ['Beans & nuts', 'Walnuts', /^Nuts, walnuts, english$/],
  ['Beans & nuts', 'Cashews', /^Nuts, cashew nuts, dry roasted, with salt added/],
  ['Beans & nuts', 'Black beans, cooked', /^Beans, black, mature seeds, cooked, boiled, without salt/],
  ['Beans & nuts', 'Pinto beans, cooked', /^Beans, pinto, mature seeds, cooked, boiled, without salt/],
  ['Beans & nuts', 'Baked beans, canned', /^Beans, baked, canned, plain or vegetarian/],
  ['Beans & nuts', 'Kidney beans, canned', /^Beans, kidney, all types, mature seeds, canned$/],
  ['Beans & nuts', 'Lentils, cooked', /^Lentils, mature seeds, cooked, boiled, without salt/],
  ['Beans & nuts', 'Tofu, firm', /^Tofu, raw, firm, prepared with calcium sulfate/],
  ['Beans & nuts', 'Hummus', /^Hummus, commercial$/],

  // ---- Snacks & sweets ----
  ['Snacks', 'Potato chips', /^Snacks, potato chips, plain, salted/],
  ['Snacks', 'Tortilla chips', /^Snacks, tortilla chips, plain, white corn/],
  ['Snacks', 'Pretzels', /^Snacks, pretzels, hard, plain, salted$/],
  ['Snacks', 'Popcorn, air-popped', /^Snacks, popcorn, air-popped$/],
  ['Snacks', 'Chocolate chip cookies', /^Cookies, chocolate chip, commercially prepared, regular, higher fat, enriched/],
  ['Snacks', 'Milk chocolate', /^Candies, milk chocolate$/],
  ['Snacks', 'Graham crackers', /^Cookies, graham crackers, plain or honey, lowfat/],
  ['Snacks', 'Vanilla wafers', /^Cookies, vanilla wafers, lower fat/],
  ['Snacks', 'Gelatin dessert', /^Gelatin desserts, dry mix, prepared with water/],
  ['Snacks', 'Sherbet, orange', /^Sherbet, orange$/],
  ['Snacks', 'Angel food cake', /^Cake, angelfood, commercially prepared/],
  ['Snacks', 'Hard candy', /^Candies, hard$/],
  ['Snacks', 'Marshmallows', /^Candies, marshmallows$/],
  ['Snacks', 'Apple pie', /^Pie, apple, commercially prepared, enriched flour/],

  // ---- Drinks (nutrients; fluid is logged separately) ----
  ['Drinks', 'Cola', /^Beverages, carbonated, cola, regular$/],
  ['Drinks', 'Lemon-lime soda', /^Beverages, carbonated, lemon-lime soda, no caffeine$/],
  ['Drinks', 'Ginger ale', /^Beverages, carbonated, ginger ale$/],
  ['Drinks', 'Coffee, brewed', /^Beverages, coffee, brewed, prepared with tap water$/],
  ['Drinks', 'Tea, brewed', /^Beverages, tea, black, brewed, prepared with tap water$/],
  ['Drinks', 'Orange juice', /^Orange juice, raw/],
  ['Drinks', 'Apple juice', /^Apple juice, canned or bottled, unsweetened, without added ascorbic acid/],
  ['Drinks', 'Cranberry juice cocktail', /^Cranberry juice cocktail, bottled/],
  ['Drinks', 'Grape juice', /^Grape juice, canned or bottled, unsweetened, without added ascorbic acid/],
  ['Drinks', 'Lemonade, from powder', /^Lemonade, powder, prepared with water$/],
  ['Drinks', 'Beer, regular', /^Alcoholic beverage, beer, regular, all$/],

  // ---- Fats, sauces, condiments ----
  ['Extras', 'Mayonnaise', /^Salad dressing, mayonnaise, regular$/],
  ['Extras', 'Ketchup', /^Catsup$/],
  ['Extras', 'Mustard', /^Mustard, prepared, yellow$/],
  ['Extras', 'Ranch dressing', /^Salad dressing, ranch dressing, regular$/],
  ['Extras', 'Soy sauce', /^Soy sauce made from soy and wheat \(shoyu\)$/],
  ['Extras', 'Olive oil', /^Oil, olive, salad or cooking$/],
  ['Extras', 'Margarine', /^Margarine, regular, 80% fat, composite, stick, with salt/],
  ['Extras', 'Sugar, white', /^Sugars, granulated$/],
  ['Extras', 'Honey', /^Honey$/],
  ['Extras', 'Table salt', /^Salt, table$/],
  ['Extras', 'Brown gravy mix, dry', /^Gravy, brown, dry$/],
  ['Extras', 'Maple syrup', /^Syrups, maple$/],

  // ---- Prepared / mixed dishes ----
  ['Prepared', 'Cheese pizza, pan crust', /Cheese Pizza, Pan Crust$/],
  ['Prepared', 'Cheeseburger, fast food', /, Cheeseburger$/],
  ['Prepared', 'Macaroni and cheese, canned', /^Macaroni and Cheese, canned entree/],
  ['Prepared', 'Chicken noodle soup, canned', /^Soup, chicken noodle, canned, condensed$/],
  ['Prepared', 'Tomato soup, canned', /^Soup, tomato, canned, condensed$/],
  
  ['Prepared', 'Chili with beans, canned', /^Chili with beans, canned$/],
  
  ['Prepared', 'Tuna salad', /^Fish, tuna salad$/],
  ['Dairy', 'Egg, scrambled', /^Egg, whole, cooked, scrambled$/]
];

/* Portion measures worth showing. SR carries a lot of laboratory-flavoured
 * measures ("1 cu inch", "1 g") that are noise on a phone. */
const GOOD_PORTION = /cup|slice|medium|large|small|piece|tbsp|tablespoon|tsp|teaspoon|oz|ounce|fl oz|serving|each|whole|can|bottle|patty|link|egg|banana|apple|potato/i;
const BAD_PORTION = /cu in|cubic|guideline|not further specified|^1 g$|package|yields|dry, /i;

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const foods = raw.SRLegacyFoods || [];

  const byDesc = foods.slice().sort((a, b) => a.description.length - b.description.length);
  const out = [];
  const missing = [];

  for (const [category, name, re] of CURATED) {
    /* Shortest matching description is reliably the plainest variant. */
    const hit = byDesc.find((f) => re.test(f.description));
    if (!hit) { missing.push(name); continue; }

    const n = {};
    for (const fn of hit.foodNutrients) {
      const key = NUTRIENT[fn.nutrient.id];
      if (!key) continue;
      if (key === 'energy' && fn.nutrient.unitName.toUpperCase() !== 'KCAL') continue;
      if (typeof fn.amount === 'number') n[key] = Math.round(fn.amount * 100) / 100;
    }
    /* Only ship records with a complete panel; a partial one would put an
     * "unknown" on a food we could have had real data for. */
    if (['energy', 'protein', 'sodium', 'potassium', 'phosphorus'].some((k) => n[k] === undefined)) {
      missing.push(name + ' (incomplete nutrients)');
      continue;
    }

    const portions = [];
    for (const p of (hit.foodPortions || [])) {
      const label = [p.amount !== 1 ? p.amount : '', p.modifier || (p.measureUnit && p.measureUnit.name) || '']
        .join(' ').replace(/\s+/g, ' ').trim();
      if (!label || !GOOD_PORTION.test(label) || BAD_PORTION.test(label)) continue;
      if (!p.gramWeight || p.gramWeight < 3 || p.gramWeight > 900) continue;
      if (portions.some((x) => x.g === Math.round(p.gramWeight))) continue;
      /* "NLEA serving" is the Nutrition Labeling and Education Act reference
       * amount. It is meaningless to a reader and this audience cannot be
       * assumed to decode jargon, so it becomes plain words. */
      var clean = label.replace(/^1 /, '')
        .replace(/^NLEA serving$/i, 'label serving')
        .replace(/NLEA/gi, '')
        .replace(/\s+/g, ' ').replace(/\(\s+/g, '(').trim();
      if (!clean) continue;
      portions.push({ label: clean, g: Math.round(p.gramWeight) });
    }

    /*
     * Rank before trimming. The dataset's own order often leads with a tiny
     * unit or the label-reference amount, and whatever lands first becomes the
     * default portion: milk defaulted to "fl oz (31 g)" rather than a cup.
     * Push small units and jargon to the back, keep dataset order otherwise.
     */
    portions.forEach(function (p, i) {
      p._rank = /^(fl oz|oz|ounce|tbsp|tsp|tablespoon|teaspoon)\b/i.test(p.label) ? 2
              : /serving/i.test(p.label) ? 1 : 0;
      p._i = i;
    });
    portions.sort(function (a, b) { return a._rank - b._rank || a._i - b._i; });
    /* Three is plenty: more than that is a wall of choices, and the generic
     * fallbacks in app.js fill any gap. */
    portions.splice(3);

    out.push({
      id: hit.fdcId,
      name,
      cat: category,
      n: [n.energy, n.protein, n.sodium, n.potassium, n.phosphorus],
      p: portions,
      src: hit.description
    });
  }

  out.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));

  const cats = [...new Set(out.map((f) => f.cat))];
  const noPortion = out.filter((f) => !f.p.length);

  const body = out.map((f) =>
    '  [' + f.id + ',' + JSON.stringify(f.name) + ',' + JSON.stringify(f.cat) + ',' +
    JSON.stringify(f.n) + ',' + JSON.stringify(f.p.map((x) => [x.label, x.g])) + ',' + JSON.stringify(f.src) + ']'
  ).join(',\n');

  const js = `/*
 * commonfoods.js — offline library of everyday foods
 *
 * GENERATED FILE. Do not hand-edit. Rebuilt from the USDA SR Legacy bulk
 * dataset (FoodData_Central_sr_legacy_food_json_2018-04), which is US
 * Government public domain (CC0).
 *
 * WHY THIS SHIPS WITH THE APP
 * Search needs the network, an API key and a working proxy. This user
 * population includes people on dialysis-unit wifi, on old phones, on metered
 * data, three days a week for four hours. A food log that cannot record a
 * banana without a round trip is not usable. These ${out.length} foods work with no
 * network, no key and no proxy, instantly.
 *
 * SR Legacy is used rather than Branded because it is laboratory-analysed:
 * every entry here has a real measured phosphorus AND potassium value, which
 * is exactly what 98.55% of branded records do not have. Records with an
 * incomplete panel were dropped rather than shipped with gaps.
 *
 * The list is deliberately NOT skewed toward "kidney-friendly" foods. It spans
 * the full potassium and phosphorus range, including potatoes, bananas,
 * chocolate and processed cheese, because this is a logbook: a log you cannot
 * record your actual dinner in is useless, and what the user ate is not our
 * judgment to make.
 *
 * Row format, kept compact because it is parsed on every load:
 *   [fdcId, name, category, [energy, protein, sodium, potassium, phosphorus], portions, usdaDescription]
 *   nutrients are per 100 g — kcal, g, mg, mg, mg
 *   portions are [label, grams]
 */

(function (root) {
  'use strict';

  var CATEGORIES = ${JSON.stringify(cats)};

  var ROWS = [
${body}
  ];

  /* Expanded to the same shape foods.js produces, so a common food and a
   * searched food are indistinguishable downstream. */
  function toFood(row) {
    return {
      id: 'usda:' + row[0],
      source: 'usda',
      dataType: 'SR Legacy',
      name: row[1],
      brand: '',
      barcode: '',
      nutrients: {
        energy: row[3][0], protein: row[3][1], sodium: row[3][2],
        potassium: row[3][3], phosphorus: row[3][4]
      },
      ingredientsText: '',
      additivesTags: [],
      servingGrams: row[4].length ? row[4][0][1] : null,
      servingLabel: row[4].length ? row[4][0][0] : '',
      isLiquid: false,
      /* Whole foods have no ingredient list to read, which is different from
       * having one we could not check. scanned:false says exactly that. */
      scan: { scanned: false, findings: [] },
      portions: row[4].map(function (p) { return { label: p[0], grams: p[1] }; }),
      /* The verbatim USDA record name. Shown in the portion picker so the
       * user can see exactly which record a number came from. */
      usdaDescription: row[5]
    };
  }

  function all() { return ROWS.map(toFood); }

  function byCategory(cat) {
    return ROWS.filter(function (r) { return r[2] === cat; }).map(toFood);
  }

  /* Substring match on the plain name. Deliberately simple — this runs on every
   * keystroke against a few hundred rows and must never be the slow part. */
  function search(q) {
    var needle = String(q || '').trim().toLowerCase();
    if (!needle) return [];
    return ROWS
      .filter(function (r) { return r[1].toLowerCase().indexOf(needle) !== -1; })
      .sort(function (a, b) {
        /* Prefix matches first: typing "app" should surface Apple before
         * Pineapple. */
        var ap = a[1].toLowerCase().indexOf(needle) === 0 ? 0 : 1;
        var bp = b[1].toLowerCase().indexOf(needle) === 0 ? 0 : 1;
        return ap - bp || a[1].localeCompare(b[1]);
      })
      .map(toFood);
  }

  var api = {
    CATEGORIES: CATEGORIES,
    count: ROWS.length,
    all: all,
    byCategory: byCategory,
    search: search,
    toFood: toFood,
    ROWS: ROWS
  };

  root.RenalCommonFoods = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;

  fs.writeFileSync(OUT, js, 'utf8');

  console.log('wrote ' + OUT);
  console.log('foods: ' + out.length + ' / ' + CURATED.length + ' requested');
  console.log('size:  ' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');
  console.log('categories: ' + cats.join(', '));
  if (noPortion.length) {
    console.log('\nno household portions (' + noPortion.length + '): ' +
      noPortion.map((f) => f.name).join(', '));
  }
  console.log('\n--- name -> USDA record (review for mismatches) ---');
  out.forEach((f) => console.log('  ' + f.name.padEnd(30) + ' <- ' + f.src));
  if (missing.length) {
    console.log('\nUNMATCHED (' + missing.length + '):');
    missing.forEach((m) => console.log('  - ' + m));
  }
}

main();
