/*
 * Emit ready-to-paste CURATED lines for tools/gen-common.js.
 *
 * Last expansion wasted a whole round on 42 patterns that matched nothing.
 * This probes the dataset FIRST and prints each entry anchored to the exact
 * description it found, so a pattern either binds or is reported as absent
 * before it ever reaches the generator.
 *
 * The printed name <- description pairing is the review surface: the binding
 * is visible in the line itself.
 */

const fs = require('fs');
const SRC = process.argv[2];
if (!SRC) { console.error('usage: node tools/suggest-foods.js <sr_legacy.json>'); process.exit(1); }
const foods = JSON.parse(fs.readFileSync(SRC, 'utf8')).SRLegacyFoods;
const NEED = [1003, 1008, 1091, 1092, 1093];

const ok = foods
  .filter((f) => {
    const s = new Set(f.foodNutrients.map((n) => n.nutrient.id));
    return NEED.every((i) => s.has(i));
  })
  .sort((a, b) => a.description.length - b.description.length);

const already = new Set(
  fs.readFileSync(require('path').join(__dirname, '..', 'js', 'commonfoods.js'), 'utf8')
    .split('\n').map((l) => {
      const m = l.match(/^\s*\[(\d+),/);
      return m ? Number(m[1]) : null;
    }).filter(Boolean)
);

/* Prefer plain records: reject brand-shouted and hyper-specific cuts. */
const NOISE = /separable lean and fat|trimmed to 1\/8|trimmed to 1\/4|all grades|USDA commodity|Babyfood|baby food|infant|formula|school|CAMPBELL|KELLOGG|GENERAL MILLS|POST |QUAKER|NESTLE|Restaurant, |T\.G\.I|APPLEBEE|DENNY|OLIVE GARDEN|CRACKER BARREL|Alaska Native|Navajo|\(Navajo\)|puerto rican/i;

function pick(re, opts) {
  opts = opts || {};
  const cands = ok.filter((f) =>
    re.test(f.description) &&
    !already.has(f.fdcId) &&
    (opts.allowNoise || !NOISE.test(f.description)));
  return cands[0] || null;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

/* [category, display name, probe regex, {allowNoise}] */
const WANT = [
  // ---------------- Fish (thinnest group) ----------------
  ['Fish', 'Sole, cooked', /^Fish, flatfish.*cooked/i],
  ['Fish', 'Perch, cooked', /^Fish, perch, mixed species, cooked/i],
  ['Fish', 'Bass, cooked', /^Fish, bass, striped, cooked/i],
  ['Fish', 'Snapper, cooked', /^Fish, snapper, mixed species, cooked/i],
  ['Fish', 'Grouper, cooked', /^Fish, grouper, mixed species, cooked/i],
  ['Fish', 'Mahi mahi, cooked', /^Fish, mahimahi, cooked/i],
  ['Fish', 'Whiting, cooked', /^Fish, whiting, mixed species, cooked/i],
  ['Fish', 'Herring, pickled', /^Fish, herring, Atlantic, pickled/i],
  ['Fish', 'Anchovy, canned', /^Fish, anchovy, european, canned/i],
  ['Fish', 'Squid, fried', /^Mollusks, squid, mixed species, cooked/i],
  ['Fish', 'Crawfish, cooked', /^Crustaceans, crayfish, mixed species, farmed, cooked/i],
  ['Fish', 'Imitation crab', /^Mollusks, .*surimi|^Fish, surimi/i],
  ['Fish', 'Smoked salmon', /^Fish, salmon, chinook, smoked/i],
  ['Fish', 'Tuna steak, cooked', /^Fish, tuna, fresh, yellowfin, cooked/i],
  ['Fish', 'Canned mackerel', /^Fish, mackerel, jack, canned/i],
  ['Fish', 'Canned clams', /^Mollusks, clam, mixed species, canned/i],
  ['Fish', 'Octopus, cooked', /^Mollusks, octopus, common, cooked/i],
  ['Fish', 'Roe', /^Fish, roe, mixed species, cooked/i],

  // ---------------- Prepared dishes ----------------
  ['Prepared', 'Chili con carne', /^Chili con carne/i],
  ['Prepared', 'Beef stroganoff', /stroganoff/i],
  ['Prepared', 'Shepherds pie', /shepherd/i],
  ['Prepared', 'Quesadilla, cheese', /quesadilla/i],
  ['Prepared', 'Enchilada', /enchilada/i],
  ['Prepared', 'Tamale', /^Tamale/i],
  ['Prepared', 'Gyro', /gyro/i],
  ['Prepared', 'Caesar salad', /caesar salad/i],
  ['Prepared', 'Cobb salad', /cobb salad/i],
  ['Prepared', 'Tuna melt', /tuna melt/i],
  ['Prepared', 'BLT sandwich', /bacon, lettuce, and tomato/i],
  ['Prepared', 'Club sandwich', /club sandwich/i],
  ['Prepared', 'Philly cheesesteak', /cheesesteak|steak and cheese/i],
  ['Prepared', 'Sloppy joe', /sloppy joe/i],
  ['Prepared', 'Corn dog', /corn dog/i],
  ['Prepared', 'Buffalo chicken wings', /chicken wing.*sauce|buffalo wing/i],
  ['Prepared', 'Meatball sub', /submarine sandwich, meatball/i],
  ['Prepared', 'Biscuits and gravy', /biscuit.*gravy/i],
  ['Prepared', 'Breakfast burrito', /breakfast burrito|burrito.*egg/i],
  ['Prepared', 'Omelet', /^Egg, whole, cooked, omelet/i],
  ['Prepared', 'Quiche', /quiche/i],
  ['Prepared', 'Salisbury steak', /salisbury steak/i],
  ['Prepared', 'Fried chicken, breast', /chicken, breast, meat and skin.*fried|fried chicken.*breast/i],
  ['Prepared', 'Chicken fried rice', /fried rice.*chicken|chicken.*fried rice/i],
  ['Prepared', 'Lo mein', /lo mein/i],
  ['Prepared', 'Sweet and sour chicken', /sweet and sour/i],
  ['Prepared', 'Beef and broccoli', /beef and broccoli|beef.*broccoli/i],
  ['Prepared', 'Chicken noodle soup, ready to serve', /^Soup, chicken noodle, canned, ready-to-serve/i],
  ['Prepared', 'Tomato soup, ready to serve', /^Soup, tomato, canned, ready-to-serve/i],
  ['Prepared', 'Chicken rice soup', /^Soup, chicken.*rice, canned/i],
  ['Prepared', 'Onion soup', /^Soup, onion/i],
  ['Prepared', 'Potato soup', /^Soup, potato/i],
  ['Prepared', 'Broccoli cheese soup', /^Soup, cream of broccoli|broccoli cheese soup/i],
  ['Prepared', 'Beef broth', /^Soup, beef broth|^Soup, broth, beef/i],
  ['Prepared', 'Chicken broth', /^Soup, chicken broth/i],

  // ---------------- Meat ----------------
  ['Meat', 'Chicken, whole roasted with skin', /^Chicken, broilers or fryers, meat and skin, cooked, roasted/i],
  ['Meat', 'Chicken breast, fried', /^Chicken, broilers or fryers, breast, meat only, cooked, fried/i],
  ['Meat', 'Turkey, dark meat, roasted', /^Turkey, all classes, dark meat, cooked, roasted|^Turkey, whole, dark meat/i],
  ['Meat', 'Duck, roasted', /^Duck, domesticated, meat only, cooked/i],
  ['Meat', 'Cornish hen, roasted', /cornish game hens, meat only/i],
  ['Meat', 'Beef tenderloin, cooked', /^Beef, tenderloin, steak, separable lean only.*0" fat, choice, cooked/i],
  ['Meat', 'Beef short ribs, cooked', /^Beef, short ribs, separable lean only/i],
  ['Meat', 'Ground beef, lean, cooked', /^Beef, ground, 90% lean meat.*cooked, pan-broiled/i],
  ['Meat', 'Pork tenderloin, cooked', /^Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted/i],
  ['Meat', 'Pork shoulder, cooked', /^Pork, fresh, shoulder, .*separable lean only, cooked/i],
  ['Meat', 'Canadian bacon', /^Pork, cured, breakfast strips|canadian.*bacon/i],
  ['Meat', 'Luncheon meat, canned', /^Pork, cured, ham.*canned|luncheon meat/i],
  ['Meat', 'Vienna sausage', /vienna sausage/i],
  ['Meat', 'Chorizo', /^Sausage, chorizo/i],
  ['Meat', 'Breakfast sausage patty', /^Sausage, turkey, breakfast|breakfast sausage/i],
  ['Meat', 'Ground lamb, cooked', /^Lamb, ground, cooked/i],
  ['Meat', 'Venison, cooked', /^Game meat, deer, cooked/i],
  ['Meat', 'Bison, cooked', /^Game meat, bison, .*cooked/i],
  ['Meat', 'Chicken liver, cooked', /^Chicken, liver, all classes, cooked/i],
  ['Meat', 'Rabbit, cooked', /^Game meat, rabbit, .*cooked/i],

  // ---------------- Dairy ----------------
  ['Dairy', 'Lactose-free milk', /lactose.free/i],
  ['Dairy', 'Kefir', /kefir/i],
  ['Dairy', 'Cheddar cheese, shredded', /^Cheese, cheddar, shredded/i],
  ['Dairy', 'Gouda cheese', /^Cheese, gouda/i],
  ['Dairy', 'Havarti cheese', /^Cheese, havarti/i],
  ['Dairy', 'Romano cheese', /^Cheese, romano/i],
  ['Dairy', 'Neufchatel cheese', /^Cheese, neufchatel/i],
  ['Dairy', 'Queso fresco', /queso fresco/i],
  ['Dairy', 'Nacho cheese sauce', /^Cheese, pasteurized process, .*nacho|nacho cheese/i],
  ['Dairy', 'Greek yogurt, nonfat', /^Yogurt, Greek, plain, nonfat/i],
  ['Dairy', 'Vanilla yogurt, low fat', /^Yogurt, vanilla, low fat/i],
  ['Dairy', 'Light cream', /^Cream, fluid, light/i],
  ['Dairy', 'Butter, unsalted', /^Butter, without salt/i],
  ['Dairy', 'Custard', /^Puddings, .*custard|^Desserts, .*custard/i],
  ['Dairy', 'Flan', /flan/i],
  ['Dairy', 'Egg substitute', /^Egg substitute, liquid/i],
  ['Dairy', 'Egg, poached', /^Egg, whole, cooked, poached/i],

  // ---------------- Grains ----------------
  ['Grains', 'Sourdough bread', /sourdough/i],
  ['Grains', 'Multigrain bread', /^Bread, multi-grain/i],
  ['Grains', 'Potato bread', /^Bread, potato/i],
  ['Grains', 'Whole wheat tortilla', /^Tortillas, ready-to-bake or -fry, whole wheat/i],
  ['Grains', 'Naan', /naan/i],
  ['Grains', 'Breadsticks', /^Bread, stick|breadstick/i],
  ['Grains', 'Croutons', /^Croutons/i],
  ['Grains', 'Bread crumbs', /^Bread crumbs/i],
  ['Grains', 'Oat bran, cooked', /^Cereals, oat bran, cooked/i],
  ['Grains', 'Wheat germ', /^Cereals ready-to-eat, wheat germ/i],
  ['Grains', 'Millet, cooked', /^Millet, cooked/i],
  ['Grains', 'Buckwheat, cooked', /^Buckwheat groats, roasted, cooked/i],
  ['Grains', 'Bulgur, cooked', /^Bulgur, cooked/i],
  ['Grains', 'Rice noodles, cooked', /^Rice noodles, cooked/i],
  ['Grains', 'Soba noodles, cooked', /^Noodles, japanese, soba, cooked/i],
  ['Grains', 'Macaroni, cooked', /^Macaroni, cooked, enriched/i],
  ['Grains', 'Pie crust', /^Pie crust, standard-type, .*baked/i],
  ['Grains', 'Granola cereal', /^Cereals ready-to-eat, granola|^Granola/i],
  ['Grains', 'Oat cereal, toasted', /^Cereals ready-to-eat, .*oats, toasted|toasted oat/i],
  ['Grains', 'Instant oatmeal', /^Cereals, oats, instant, fortified, plain, prepared/i],
  ['Grains', 'Yellow grits, cooked', /^Cereals, corn grits, yellow, regular and quick, enriched, cooked/i],

  // ---------------- Vegetables ----------------
  ['Vegetable', 'Arugula', /^Arugula, raw/i],
  ['Vegetable', 'Swiss chard, cooked', /^Chard, swiss, cooked/i],
  ['Vegetable', 'Beet greens, cooked', /^Beet greens, cooked/i],
  ['Vegetable', 'Dandelion greens, cooked', /^Dandelion greens, cooked/i],
  ['Vegetable', 'Watercress', /^Watercress, raw/i],
  ['Vegetable', 'Endive', /^Endive, raw/i],
  ['Vegetable', 'Fennel', /^Fennel, bulb, raw/i],
  ['Vegetable', 'Kohlrabi, cooked', /^Kohlrabi, cooked/i],
  ['Vegetable', 'Jicama', /^Yambean \(jicama\), raw/i],
  ['Vegetable', 'Cassava', /^Cassava, raw/i],
  ['Vegetable', 'Taro, cooked', /^Taro, cooked/i],
  ['Vegetable', 'Plantain, cooked', /^Plantains, .*cooked/i],
  ['Vegetable', 'Cream style corn', /^Corn, sweet, yellow, canned, cream style/i],
  ['Vegetable', 'Peas and carrots, canned', /^Peas and carrots, canned/i],
  ['Vegetable', 'Succotash, cooked', /^Succotash.*cooked/i],
  ['Vegetable', 'Spaghetti squash, cooked', /^Squash, winter, spaghetti, cooked/i],
  ['Vegetable', 'Pumpkin, cooked', /^Pumpkin, cooked, boiled, drained, without salt/i],
  ['Vegetable', 'Hearts of palm, canned', /^Hearts of palm, canned/i],
  ['Vegetable', 'Alfalfa sprouts', /^Alfalfa seeds, sprouted, raw/i],
  ['Vegetable', 'Seaweed', /^Seaweed, wakame, raw|^Seaweed, kelp, raw/i],
  ['Vegetable', 'Horseradish, prepared', /^Horseradish, prepared/i],
  ['Vegetable', 'Capers', /^Capers, canned/i],
  ['Vegetable', 'Pimento, canned', /^Peppers, sweet, red, canned|pimento/i],
  ['Vegetable', 'Sweet pickle', /^Pickles, cucumber, sweet/i],
  ['Vegetable', 'Green chili peppers, canned', /^Peppers, hot chili, green, canned/i],
  ['Vegetable', 'Jalapeno peppers, canned', /^Peppers, jalapeno, canned/i],

  // ---------------- Fruit ----------------
  ['Fruit', 'Sour cherries, raw', /^Cherries, sour, red, raw/i],
  ['Fruit', 'Plantain, raw', /^Plantains, yellow, raw|^Plantains, raw/i],
  ['Fruit', 'Passion fruit', /^Passion-fruit, .*raw/i],
  ['Fruit', 'Lychee', /^Litchis, raw/i],
  ['Fruit', 'Star fruit', /^Carambola, \(starfruit\), raw/i],
  ['Fruit', 'Mulberries', /^Mulberries, raw/i],
  ['Fruit', 'Gooseberries', /^Gooseberries, raw/i],
  ['Fruit', 'Currants, raw', /^Currants, .*raw/i],
  ['Fruit', 'Apricots, canned in juice', /^Apricots, canned, juice pack/i],
  ['Fruit', 'Cherries, canned', /^Cherries, sweet, canned, juice pack/i],
  ['Fruit', 'Applesauce, sweetened', /^Applesauce, canned, sweetened/i],
  ['Fruit', 'Grapefruit, canned', /^Grapefruit, sections, canned, juice pack/i],
  ['Fruit', 'Dried mixed fruit', /^Fruit, mixed, dried/i],
  ['Fruit', 'Dried cherries', /^Cherries, sweet, dried|^Cherries, tart, dried/i],

  // ---------------- Beans & nuts ----------------
  ['Beans & nuts', 'Black-eyed peas, cooked', /^Cowpeas.*mature seeds, cooked, boiled, without salt/i],
  ['Beans & nuts', 'Fava beans, cooked', /^Broadbeans \(fava beans\), mature seeds, cooked/i],
  ['Beans & nuts', 'Cannellini beans, canned', /^Beans, white, mature seeds, canned/i],
  ['Beans & nuts', 'Pink beans, cooked', /^Beans, pink, mature seeds, cooked/i],
  ['Beans & nuts', 'Adzuki beans, cooked', /^Adzuki beans, mature seeds, cooked/i],
  ['Beans & nuts', 'Almond butter', /^Nuts, almond butter, plain/i],
  ['Beans & nuts', 'Cashew butter', /^Nuts, cashew butter, plain/i],
  ['Beans & nuts', 'Sunflower seed butter', /^Seeds, sunflower seed butter/i],
  ['Beans & nuts', 'Chia seeds', /^Seeds, chia seeds, dried/i],
  ['Beans & nuts', 'Flax seeds', /^Seeds, flaxseed/i],
  ['Beans & nuts', 'Coconut, dried sweetened', /^Nuts, coconut meat, dried \(desiccated\), sweetened/i],
  ['Beans & nuts', 'Miso', /^Miso$/i],
  ['Beans & nuts', 'Falafel', /^Falafel/i],
  ['Beans & nuts', 'Peanuts, raw', /^Peanuts, all types, raw/i],

  // ---------------- Snacks ----------------
  ['Snacks', 'Shortbread cookies', /^Cookies, shortbread, commercially prepared, plain/i],
  ['Snacks', 'Fig bars', /^Cookies, fig bars/i],
  ['Snacks', 'Fruit snacks', /^Snacks, fruit leather|fruit snacks/i],
  ['Snacks', 'Pecan pie', /^Pie, pecan/i],
  ['Snacks', 'Lemon meringue pie', /^Pie, lemon meringue/i],
  ['Snacks', 'Cobbler', /cobbler/i],
  ['Snacks', 'Eclair', /eclair/i],
  ['Snacks', 'Churros', /churro/i],
  ['Snacks', 'Licorice', /licorice/i],
  ['Snacks', 'Toffee', /^Candies, toffee/i],
  ['Snacks', 'White chocolate', /^Candies, white chocolate/i],
  ['Snacks', 'Chocolate chips', /^Candies, semisweet chocolate/i],
  ['Snacks', 'Granola bar, soft', /^Snacks, granola bars, soft/i],
  ['Snacks', 'Ice cream sandwich', /^Frozen novelties, ice cream type, sandwich/i],
  ['Snacks', 'Ice cream cone, chocolate coated', /^Frozen novelties, ice cream type, .*cone/i],
  ['Snacks', 'Yellow cake with frosting', /^Cake, yellow, commercially prepared, with .*frosting/i],
  ['Snacks', 'Carrot cake', /^Cake, carrot/i],
  ['Snacks', 'Gingerbread', /gingerbread/i],
  ['Snacks', 'Snack mix', /^Snacks, .*snack mix|chex mix/i],

  // ---------------- Drinks ----------------
  ['Drinks', 'Latte', /latte|cafe au lait/i],
  ['Drinks', 'Sweetened iced tea', /^Beverages, tea, instant, sweetened|tea, ready-to-drink/i],
  ['Drinks', 'Kombucha', /kombucha/i],
  ['Drinks', 'Seltzer water', /^Beverages, carbonated, .*unsweetened|seltzer/i],
  ['Drinks', 'Coconut milk beverage', /^Beverages, coconut milk/i],
  ['Drinks', 'Eggnog', /^Eggnog/i],
  ['Drinks', 'Apple cider', /apple cider|cider, apple/i],
  ['Drinks', 'Cherry juice', /^Cherry juice|cherries.*juice/i],
  ['Drinks', 'Pomegranate juice', /^Pomegranate juice/i],
  ['Drinks', 'Mango nectar', /mango nectar/i],
  ['Drinks', 'Peach nectar', /peach nectar/i],
  ['Drinks', 'Lemon juice', /^Lemon juice, raw/i],
  ['Drinks', 'Lime juice', /^Lime juice, raw/i],
  ['Drinks', 'Malt beverage', /^Alcoholic beverage, malt|malt beverage/i],
  ['Drinks', 'Champagne', /^Alcoholic beverage, wine, .*champagne|sparkling/i],
  ['Drinks', 'Whiskey sour', /whiskey sour/i],
  ['Drinks', 'Pina colada', /pina colada/i],

  // ---------------- Extras ----------------
  ['Extras', 'Guacamole', /guacamole/i],
  ['Extras', 'Onion dip', /^Dip, .*onion|sour cream.*dip/i],
  ['Extras', 'Alfredo sauce', /alfredo/i],
  ['Extras', 'Pesto', /pesto/i],
  ['Extras', 'Cranberry sauce', /^Cranberry sauce/i],
  ['Extras', 'Apple butter', /^Apple butter/i],
  ['Extras', 'Marmalade', /^Marmalade/i],
  ['Extras', 'Pancake syrup', /^Syrups, table blends, pancake/i],
  ['Extras', 'Agave syrup', /agave/i],
  ['Extras', 'Honey mustard', /honey mustard/i],
  ['Extras', 'Cocktail sauce', /cocktail sauce/i],
  ['Extras', 'Sriracha', /sriracha/i],
  ['Extras', 'Sweet and sour sauce', /^Sauce, sweet and sour/i],
  ['Extras', 'Oyster sauce', /^Sauce, oyster/i],
  ['Extras', 'Fish sauce', /^Sauce, fish, ready-to-serve/i],
  ['Extras', 'Hoisin sauce', /^Sauce, hoisin/i],
  ['Extras', 'Balsamic vinegar', /^Vinegar, balsamic/i],
  ['Extras', 'Red wine vinegar', /^Vinegar, red wine/i],
  ['Extras', 'Cooking spray', /^Oil, PAM|cooking spray/i],
  ['Extras', 'Bouillon cube', /bouillon/i],
  ['Extras', 'Chili powder', /^Spices, chili powder/i],
  ['Extras', 'Cumin', /^Spices, cumin seed/i],
  ['Extras', 'Paprika', /^Spices, paprika/i],
  ['Extras', 'Oregano, dried', /^Spices, oregano, dried/i],
  ['Extras', 'Basil, dried', /^Spices, basil, dried/i],
  ['Extras', 'Parsley, dried', /^Spices, parsley, dried/i],
  ['Extras', 'Ginger, ground', /^Spices, ginger, ground/i],
  ['Extras', 'Nutmeg', /^Spices, nutmeg, ground/i],
  ['Extras', 'Vanilla extract', /^Vanilla extract$/i],
  ['Extras', 'Cornstarch', /^Cornstarch/i],
  ['Extras', 'Baking powder', /^Leavening agents, baking powder, double-acting, sodium aluminum sulfate/i],
  ['Extras', 'Yeast', /^Leavening agents, yeast, baker/i],
  ['Extras', 'Sea salt', /^Salt, table$/i]
];

const lines = [];
const absent = [];
const seen = new Set();

for (const [cat, name, re, opts] of WANT) {
  const hit = pick(re, opts);
  if (!hit) { absent.push(name); continue; }
  if (seen.has(hit.fdcId)) { absent.push(name + ' (duplicate of an earlier pick)'); continue; }
  seen.add(hit.fdcId);
  lines.push(`  ['${cat}', '${name.replace(/'/g, "\\'")}', /^${esc(hit.description)}$/],`);
}

console.log('/* ' + lines.length + ' new entries */');
console.log(lines.join('\n'));
console.log('\n/* NOT FOUND (' + absent.length + '): ' + absent.join(', ') + ' */');
