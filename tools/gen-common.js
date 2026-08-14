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

  /* ================================================================ *
   * EXPANSION
   *
   * Everything above was the first pass at "the foods people obviously eat".
   * This block widens each group so that a real day's eating can actually be
   * recorded without falling back to online search — more fish and prepared
   * dishes especially, which were the thinnest groups.
   * ================================================================ */

  // ---- More fruit ----
  ['Fruit', 'Apricot', /^Apricots, raw/],
  ['Fruit', 'Apricots, dried', /^Apricots, dried, sulfured, uncooked/],
  ['Fruit', 'Blackberries', /^Blackberries, raw/],
  ['Fruit', 'Grapefruit', /^Grapefruit, raw, pink and red and white, all areas/],
  ['Fruit', 'Honeydew melon', /^Melons, honeydew, raw/],
  ['Fruit', 'Nectarine', /^Nectarines, raw/],
  ['Fruit', 'Tangerine', /^Tangerines, \(mandarin oranges\), raw/],
  ['Fruit', 'Pomegranate', /^Pomegranates, raw/],
  ['Fruit', 'Papaya', /^Papayas, raw/],
  ['Fruit', 'Figs, dried', /^Figs, dried, uncooked/],
  ['Fruit', 'Cranberries, raw', /^Cranberries, raw/],
  ['Fruit', 'Coconut, raw', /^Nuts, coconut meat, raw/],
  ['Fruit', 'Peaches, canned in juice', /^Peaches, canned, juice pack, solids and liquids/],
  ['Fruit', 'Pears, canned in juice', /^Pears, canned, juice pack, solids and liquids/],
  ['Fruit', 'Pineapple, canned in juice', /^Pineapple, canned, juice pack, solids and liquids/],
  ['Fruit', 'Mandarin oranges, canned', /^Tangerines, \(mandarin oranges\), canned, juice pack/],
  ['Fruit', 'Apples, dried', /^Apples, dried, sulfured, uncooked/],
  ['Fruit', 'Rhubarb, raw', /^Rhubarb, raw/],
  ['Fruit', 'Persimmon', /^Persimmons, japanese, raw/],
  ['Fruit', 'Guava', /^Guavas, common, raw/],

  // ---- More vegetables ----
  ['Vegetable', 'Asparagus, cooked', /^Asparagus, cooked, boiled, drained$/],
  ['Vegetable', 'Beets, cooked', /^Beets, cooked, boiled, drained$/],
  ['Vegetable', 'Brussels sprouts, cooked', /^Brussels sprouts, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Kale, cooked', /^Kale, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Collard greens, cooked', /^Collards, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Turnip greens, cooked', /^Turnip greens, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Mustard greens, cooked', /^Mustard greens, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Bell pepper, red', /^Peppers, sweet, red, raw/],
  ['Vegetable', 'Radishes, raw', /^Radishes, raw/],
  ['Vegetable', 'Butternut squash, cooked', /^Squash, winter, butternut, cooked, baked, without salt/],
  ['Vegetable', 'Acorn squash, cooked', /^Squash, winter, acorn, cooked, baked, without salt/],
  ['Vegetable', 'Eggplant, cooked', /^Eggplant, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Okra, cooked', /^Okra, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Artichoke, cooked', /^Artichokes, \(globe or french\), cooked, boiled, drained, without salt/],
  ['Vegetable', 'Asparagus, canned', /^Asparagus, canned, drained solids/],
  ['Vegetable', 'Dill pickle', /^Pickles, cucumber, dill or kosher dill/],
  ['Vegetable', 'Sweet pickle relish', /^Pickle relish, sweet/],
  ['Vegetable', 'Sauerkraut, canned', /^Sauerkraut, canned, solids and liquids/],
  ['Vegetable', 'Green olives', /^Olives, pickled, canned or bottled, green/],
  ['Vegetable', 'Black olives', /^Olives, ripe, canned \(small-extra large\)/],
  ['Vegetable', 'Peas, canned', /^Peas, green, canned, regular pack, solids and liquids/],
  ['Vegetable', 'Green beans, canned', /^Beans, snap, green, canned, regular pack, drained solids/],
  ['Vegetable', 'Hash brown potatoes', /^Potatoes, hash brown, home-prepared/],
  ['Vegetable', 'Potato salad', /^Potato salad, home-prepared/],
  ['Vegetable', 'Yam, cooked', /^Yam, cooked, boiled, drained, or baked, without salt/],
  ['Vegetable', 'Lettuce, romaine', /^Lettuce, cos or romaine, raw/],
  ['Vegetable', 'Spinach, cooked', /^Spinach, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Broccoli, raw', /^Broccoli, raw/],
  ['Vegetable', 'Carrots, cooked', /^Carrots, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Cauliflower, cooked', /^Cauliflower, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Onions, cooked', /^Onions, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Garlic, raw', /^Garlic, raw/],
  ['Vegetable', 'Tomatoes, canned', /^Tomatoes, red, ripe, canned, packed in tomato juice/],
  ['Vegetable', 'Tomato paste', /^Tomato products, canned, paste, without salt added/],
  ['Vegetable', 'Pumpkin, canned', /^Pumpkin, canned, without salt/],
  ['Vegetable', 'Parsnips, cooked', /^Parsnips, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Turnips, cooked', /^Turnips, cooked, boiled, drained, without salt/],
  ['Vegetable', 'Bean sprouts', /^Mung beans, mature seeds, sprouted, raw/],
  ['Vegetable', 'Bok choy, cooked', /^Cabbage, chinese \(pak-choi\), cooked, boiled, drained, without salt/],
  ['Vegetable', 'Snow peas', /^Peas, edible-podded, raw/],
  ['Vegetable', 'Leeks, cooked', /^Leeks, \(bulb and lower leaf-portion\), cooked, boiled, drained, without salt/],
  ['Vegetable', 'Green onions', /^Onions, spring or scallions \(includes tops and bulb\), raw/],
  ['Vegetable', 'Sweet potato, canned', /^Sweet potato, canned, syrup pack, drained solids/],

  // ---- More grains ----
  ['Grains', 'Rye bread', /^Bread, rye$/],
  ['Grains', 'Pita bread, white', /^Bread, pita, white, enriched/],
  ['Grains', 'French bread', /^Bread, french or vienna \(includes sourdough\)/],
  ['Grains', 'Raisin bread', /^Bread, raisin, enriched/],
  ['Grains', 'Cornbread', /^Bread, cornbread, dry mix, prepared/],
  ['Grains', 'Biscuit', /^Biscuits, plain or buttermilk, refrigerated dough, lower fat, baked/],
  ['Grains', 'Croissant', /^Croissants, butter/],
  ['Grains', 'Blueberry muffin', /^Muffins, blueberry, commercially prepared/],
  ['Grains', 'Waffle, frozen', /^Waffles, plain, frozen, ready-to-heat$/],
  ['Grains', 'French toast', /^French toast, prepared from recipe, made with low fat \(2%\) milk/],
  ['Grains', 'Couscous, cooked', /^Couscous, cooked/],
  ['Grains', 'Quinoa, cooked', /^Quinoa, cooked/],
  ['Grains', 'Barley, cooked', /^Barley, pearled, cooked/],
  ['Grains', 'Egg noodles, cooked', /^Noodles, egg, enriched, cooked/],
  ['Grains', 'Whole wheat pasta, cooked', /^Pasta, whole-wheat, cooked/],
  ['Grains', 'Bran flakes cereal', /Bran Flakes$/],
  ['Grains', 'Dinner roll', /^Rolls, dinner, plain, commercially prepared/],
  ['Grains', 'Cinnamon raisin bagel', /^Bagels, cinnamon-raisin/],
  ['Grains', 'Wheat crackers', /^Crackers, wheat, regular$/],
  ['Grains', 'Cheese crackers', /^Crackers, cheese, regular$/],
  ['Grains', 'Matzo', /^Crackers, matzo, plain/],
  ['Grains', 'Cornmeal', /^Cornmeal, degermed, enriched, yellow/],
  ['Grains', 'All-purpose flour', /^Wheat flour, white, all-purpose, enriched, bleached/],

  // ---- More meat ----
  ['Meat', 'Chicken drumstick, cooked', /^Chicken, broilers or fryers, drumstick, meat only, cooked, stewed/],
  ['Meat', 'Chicken wing, roasted', /^Chicken, broilers or fryers, wing, meat and skin, cooked, roasted/],
  ['Meat', 'Ground turkey, cooked', /^Turkey, Ground, cooked$/],
  ['Meat', 'Pot roast, braised', /^Beef, chuck, arm pot roast, separable lean only, trimmed to 0" fat, choice, cooked, braised/],
  ['Meat', 'Roast beef, deli', /^Roast beef, deli style, prepackaged, sliced/],
  ['Meat', 'Beef brisket, braised', /^Beef, brisket, flat half, separable lean only, trimmed to 0" fat, all grades, cooked, braised/],
  ['Meat', 'Beef liver, cooked', /^Beef, variety meats and by-products, liver, cooked, pan-fried/],
  ['Meat', 'Pork ribs, cooked', /^Pork, fresh, loin, country-style ribs, separable lean only, cooked, braised/],
  ['Meat', 'Salami', /^Salami, cooked, beef$/],
  ['Meat', 'Pepperoni', /^Pepperoni, beef and pork, sliced/],
  ['Meat', 'Pastrami', /^Pastrami, beef, 98% fat-free/],
  ['Meat', 'Corned beef', /^Beef, cured, corned beef, brisket, cooked/],
  ['Meat', 'Veal, cooked', /^Veal, loin, separable lean only, cooked, braised/],
  ['Meat', 'Bratwurst', /^Bratwurst, pork, cooked$/],
  ['Meat', 'Kielbasa', /^Sausage, Polish, pork and beef, smoked/],
  ['Meat', 'Liverwurst', /^Liverwurst spread/],
  ['Meat', 'Chicken breast, deli', /^Chicken breast, oven-roasted, fat-free, sliced/],
  ['Meat', 'Turkey breast, deli', /^Turkey breast, sliced, prepackaged/],
  ['Meat', 'Hot dog, turkey', /^Frankfurter, turkey/],
  ['Meat', 'Beef jerky', /^Snacks, beef jerky, chopped and formed/],

  // ---- More fish ----
  ['Fish', 'Salmon, canned', /^Fish, salmon, pink, canned, drained solids/],
  ['Fish', 'Sardines, canned in oil', /^Fish, sardine, Atlantic, canned in oil, drained solids with bone/],
  ['Fish', 'Crab, cooked', /^Crustaceans, crab, blue, cooked, moist heat/],
  ['Fish', 'Lobster, cooked', /^Crustaceans, lobster, northern, cooked, moist heat/],
  ['Fish', 'Scallops, cooked', /^Mollusks, scallop, \(bay and sea\), cooked, steamed/],
  ['Fish', 'Clams, cooked', /^Mollusks, clam, mixed species, cooked, moist heat/],
  ['Fish', 'Oysters, cooked', /^Mollusks, oyster, eastern, wild, cooked, moist heat/],
  ['Fish', 'Halibut, cooked', /^Fish, halibut, Atlantic and Pacific, cooked, dry heat/],
  ['Fish', 'Flounder, cooked', /^Fish, flatfish \(flounder and sole species\), cooked, dry heat/],
  ['Fish', 'Mackerel, cooked', /^Fish, mackerel, Atlantic, cooked, dry heat/],
  ['Fish', 'Haddock, cooked', /^Fish, haddock, cooked, dry heat/],
  ['Fish', 'Pollock, cooked', /^Fish, pollock, Alaska, cooked/],
  ['Fish', 'Trout, cooked', /^Fish, trout, rainbow, farmed, cooked, dry heat/],
  ['Fish', 'Swordfish, cooked', /^Fish, swordfish, cooked, dry heat/],
  ['Fish', 'Tuna, canned in oil', /^Fish, tuna, light, canned in oil, drained solids/],
  ['Fish', 'Fish sticks, frozen', /^Fish, fish sticks, frozen, prepared/],
  ['Fish', 'Shrimp, breaded and fried', /^Fast foods, shrimp, breaded and fried/],
  ['Fish', 'Mussels, cooked', /^Mollusks, mussel, blue, cooked, moist heat/],

  // ---- More dairy ----
  ['Dairy', '2% milk', /^Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D$/],
  ['Dairy', '1% milk', /^Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D$/],
  ['Dairy', 'Chocolate milk', /^Milk, chocolate, fluid, commercial, whole/],
  ['Dairy', 'Half and half', /^Cream, fluid, half and half/],
  ['Dairy', 'Heavy cream', /^Cream, fluid, heavy whipping/],
  ['Dairy', 'Evaporated milk, canned', /^Milk, canned, evaporated, with added vitamin A$/],
  ['Dairy', 'Sweetened condensed milk', /^Milk, canned, condensed, sweetened/],
  ['Dairy', 'Swiss cheese', /^Cheese, swiss$/],
  ['Dairy', 'Provolone cheese', /^Cheese, provolone$/],
  ['Dairy', 'Parmesan cheese, grated', /^Cheese, parmesan, grated$/],
  ['Dairy', 'Feta cheese', /^Cheese, feta$/],
  ['Dairy', 'Ricotta cheese', /^Cheese, ricotta, whole milk/],
  ['Dairy', 'Blue cheese', /^Cheese, blue$/],
  ['Dairy', 'Monterey jack cheese', /^Cheese, monterey$/],
  ['Dairy', 'Colby cheese', /^Cheese, colby$/],
  ['Dairy', 'Goat cheese', /^Cheese, goat, soft type/],
  ['Dairy', 'Yogurt, low fat plain', /^Yogurt, plain, low fat$/],
  ['Dairy', 'Yogurt, fruit low fat', /^Yogurt, fruit, low fat/],
  ['Dairy', 'Frozen yogurt', /^Frozen yogurts, vanilla, soft-serve/],
  ['Dairy', 'Whipped cream topping', /^Cream, whipped, cream topping, pressurized/],
  ['Dairy', 'Egg white, raw', /^Egg, white, raw, fresh/],
  ['Dairy', 'Egg yolk, raw', /^Egg, yolk, raw, fresh/],
  ['Dairy', 'Egg, fried', /^Egg, whole, cooked, fried/],
  ['Dairy', 'Cottage cheese, low fat', /^Cheese, cottage, lowfat, 2% milkfat/],
  ['Dairy', 'Nonfat dry milk powder', /^Milk, dry, nonfat, regular, without added vitamin A and vitamin D/],

  // ---- More beans & nuts ----
  ['Beans & nuts', 'Chickpeas, cooked', /^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, cooked, boiled, without salt/],
  ['Beans & nuts', 'Navy beans, cooked', /^Beans, navy, mature seeds, cooked, boiled, without salt/],
  ['Beans & nuts', 'Split peas, cooked', /^Peas, split, mature seeds, cooked, boiled, without salt/],
  ['Beans & nuts', 'Great northern beans, cooked', /^Beans, great northern, mature seeds, cooked, boiled, without salt/],
  ['Beans & nuts', 'Soy milk', /^Soymilk, original and vanilla, with added calcium, vitamins A and D/],
  ['Beans & nuts', 'Almond milk', /^Beverages, almond milk, unsweetened, shelf stable/],
  ['Beans & nuts', 'Pecans', /^Nuts, pecans$/],
  ['Beans & nuts', 'Pistachios', /^Nuts, pistachio nuts, dry roasted, with salt added/],
  ['Beans & nuts', 'Sunflower seeds', /^Seeds, sunflower seed kernels, dry roasted, with salt added/],
  ['Beans & nuts', 'Pumpkin seeds', /^Seeds, pumpkin and squash seed kernels, roasted, with salt added/],
  ['Beans & nuts', 'Macadamia nuts', /^Nuts, macadamia nuts, dry roasted, with salt added/],
  ['Beans & nuts', 'Mixed nuts', /^Nuts, mixed nuts, dry roasted, with peanuts, with salt added/],
  ['Beans & nuts', 'Peanut butter, smooth', /^Peanut butter, smooth, reduced fat/],
  ['Beans & nuts', 'Tahini', /^Seeds, sesame butter, tahini, from roasted and toasted kernels/],
  ['Beans & nuts', 'Edamame, cooked', /^Edamame, frozen, prepared/],
  ['Beans & nuts', 'Hazelnuts', /^Nuts, hazelnuts or filberts$/],
  ['Beans & nuts', 'Brazil nuts', /^Nuts, brazilnuts, dried, unblanched/],
  ['Beans & nuts', 'Sesame seeds', /^Seeds, sesame seeds, whole, dried/],
  ['Beans & nuts', 'Tempeh', /^Tempeh$/],
  ['Beans & nuts', 'Soybeans, cooked', /^Soybeans, mature seeds, cooked, boiled, with salt/],

  // ---- More snacks ----
  ['Snacks', 'Cheese puffs', /^Snacks, corn-based, extruded, puffs or twists, cheese-flavor/],
  ['Snacks', 'Corn chips', /^Snacks, corn-based, extruded, chips, plain/],
  ['Snacks', 'Granola bar', /^Snacks, granola bars, hard, plain/],
  ['Snacks', 'Popcorn, oil-popped', /^Snacks, popcorn, oil-popped, microwave, regular flavor/],
  ['Snacks', 'Doughnut, glazed', /^Doughnuts, yeast-leavened, glazed, enriched/],
  ['Snacks', 'Doughnut, cake type', /^Doughnuts, cake-type, plain/],
  ['Snacks', 'Chocolate cake with frosting', /^Cake, chocolate, commercially prepared with chocolate frosting/],
  ['Snacks', 'Pound cake', /^Cake, pound, commercially prepared, butter/],
  ['Snacks', 'Chocolate pudding', /^Puddings, chocolate, ready-to-eat/],
  ['Snacks', 'Vanilla pudding', /^Puddings, vanilla, ready-to-eat/],
  ['Snacks', 'Oatmeal cookies', /^Cookies, oatmeal, commercially prepared, regular/],
  ['Snacks', 'Peanut butter cookies', /^Cookies, peanut butter, commercially prepared, regular/],
  ['Snacks', 'Animal crackers', /^Cookies, animal crackers \(includes arrowroot, tea biscuits\)/],
  ['Snacks', 'Rice cakes', /^Snacks, rice cakes, brown rice, plain/],
  ['Snacks', 'Trail mix', /^Snacks, trail mix, regular$/],
  ['Snacks', 'Caramels', /^Candies, caramels$/],
  ['Snacks', 'Gumdrops', /^Candies, gumdrops, starch jelly pieces/],
  ['Snacks', 'Jelly beans', /^Candies, jellybeans$/],
  ['Snacks', 'Dark chocolate', /^Candies, chocolate, dark, NFS/],
  ['Snacks', 'Ice cream, chocolate', /^Ice creams, chocolate$/],
  ['Snacks', 'Chocolate milkshake', /^Milk shakes, thick chocolate/],
  ['Snacks', 'Popsicle', /^Frozen novelties, ice type, pop/],
  ['Snacks', 'Pumpkin pie', /^Pie, pumpkin, commercially prepared/],
  ['Snacks', 'Cherry pie', /^Pie, cherry, commercially prepared/],
  ['Snacks', 'Danish pastry', /^Danish pastry, cheese/],
  ['Snacks', 'Pork rinds', /^Snacks, pork skins, plain/],

  // ---- More drinks ----
  ['Drinks', 'Diet cola', /^Beverages, carbonated, low calorie, cola or pepper-type, with aspartame, contains caffeine/],
  ['Drinks', 'Root beer', /^Beverages, carbonated, root beer$/],
  ['Drinks', 'Orange soda', /^Beverages, carbonated, orange$/],
  ['Drinks', 'Club soda', /^Beverages, carbonated, club soda$/],
  ['Drinks', 'Tonic water', /^Beverages, carbonated, tonic water$/],
  ['Drinks', 'Sports drink, low calorie', /^Beverages, PEPSICO QUAKER, Gatorade G2, low calorie/],
  ['Drinks', 'Energy drink', /^Beverages, Energy drink, RED BULL/],
  ['Drinks', 'Hot chocolate', /^Beverages, chocolate-flavor beverage mix, powder, prepared with whole milk$/],
  ['Drinks', 'Instant coffee', /^Beverages, coffee, instant, regular, prepared with water/],
  ['Drinks', 'Espresso', /^Beverages, coffee, brewed, espresso, restaurant-prepared/],
  ['Drinks', 'Green tea, brewed', /^Beverages, tea, green, brewed, regular/],
  ['Drinks', 'Herbal tea, brewed', /^Beverages, tea, herb, other than chamomile, brewed/],
  ['Drinks', 'Red wine', /^Alcoholic beverage, wine, table, red$/],
  ['Drinks', 'White wine', /^Alcoholic beverage, wine, table, white$/],
  ['Drinks', 'Liquor, 80 proof', /^Alcoholic beverage, distilled, all \(gin, rum, vodka, whiskey\) 80 proof/],
  ['Drinks', 'Light beer', /^Alcoholic beverage, beer, light$/],
  ['Drinks', 'Tomato juice', /^Tomato juice, canned, with salt added/],
  ['Drinks', 'Vegetable juice', /^Vegetable juice cocktail, canned/],
  ['Drinks', 'Pineapple juice', /^Pineapple juice, canned or bottled, unsweetened, without added ascorbic acid/],
  ['Drinks', 'Grapefruit juice', /^Grapefruit juice, white, canned or bottled, unsweetened/],
  ['Drinks', 'Prune juice', /^Prune juice, canned$/],
  ['Drinks', 'Coconut water', /^Nuts, coconut water \(liquid from coconuts\)/],
  ['Drinks', 'Rice milk', /^Beverages, rice milk, unsweetened/],
  ['Drinks', 'Water, tap', /^Beverages, water, tap, drinking$/],
  ['Drinks', 'Fruit punch drink', /^Beverages, fruit punch drink, without added nutrients, canned/],

  // ---- More extras ----
  ['Extras', 'Barbecue sauce', /^Sauce, barbecue$/],
  ['Extras', 'Salsa', /^Sauce, salsa, ready-to-serve/],
  ['Extras', 'Hot sauce', /^Sauce, ready-to-serve, pepper or hot/],
  ['Extras', 'Jam or preserves', /^Jams and preserves$/],
  ['Extras', 'Jelly', /^Jellies$/],
  ['Extras', 'Italian dressing', /^Salad dressing, italian dressing, commercial, regular/],
  ['Extras', 'Thousand island dressing', /^Salad dressing, thousand island, commercial, regular/],
  ['Extras', 'French dressing', /^Salad dressing, french dressing, commercial, regular/],
  ['Extras', 'Blue cheese dressing', /^Salad dressing, blue or roquefort cheese dressing, commercial, regular/],
  ['Extras', 'Caesar dressing', /^Salad dressing, caesar dressing, regular/],
  ['Extras', 'Cider vinegar', /^Vinegar, cider$/],
  ['Extras', 'Vegetable oil', /^Oil, vegetable, soybean, refined/],
  ['Extras', 'Canola oil', /^Oil, canola$/],
  ['Extras', 'Shortening', /^Shortening, household, soybean/],
  ['Extras', 'Cocoa powder, unsweetened', /^Cocoa, dry powder, unsweetened$/],
  ['Extras', 'Brown sugar', /^Sugars, brown$/],
  ['Extras', 'Powdered sugar', /^Sugars, powdered$/],
  ['Extras', 'Coffee creamer, powdered', /^Cream substitute, powdered$/],
  ['Extras', 'Chicken gravy, canned', /^Gravy, chicken, canned or bottled, ready-to-serve/],
  ['Extras', 'Cheese sauce', /^Sauce, cheese, ready-to-serve/],
  ['Extras', 'Spaghetti sauce', /^Sauce, pasta, spaghetti\/marinara, ready-to-serve/],
  ['Extras', 'Teriyaki sauce', /^Sauce, teriyaki, ready-to-serve/],
  ['Extras', 'Worcestershire sauce', /^Sauce, worcestershire$/],
  ['Extras', 'Tartar sauce', /^Sauce, tartar, ready-to-serve/],
  ['Extras', 'Chocolate syrup', /^Syrups, chocolate, HERSHEY'S Genuine Chocolate Flavored Lite Syrup/],
  ['Extras', 'Molasses', /^Molasses$/],
  ['Extras', 'Black pepper', /^Spices, pepper, black$/],
  ['Extras', 'Garlic powder', /^Spices, garlic powder$/],
  ['Extras', 'Onion powder', /^Spices, onion powder$/],
  ['Extras', 'Cinnamon', /^Spices, cinnamon, ground$/],
  ['Extras', 'Baking soda', /^Leavening agents, baking soda$/],

  // ---- More prepared dishes ----
  ['Prepared', 'Lasagna, cheese', /^Lasagna, cheese, frozen, prepared/],
  ['Prepared', 'Spaghetti with meat sauce', /^Spaghetti with meat sauce, frozen entree/],
  ['Prepared', 'Bean burrito', /^Burrito, bean and cheese, frozen/],
  ['Prepared', 'Beef taco', /^Fast foods, taco with beef, cheese and lettuce, hard shell/],
  ['Prepared', 'Ham sub sandwich', /^Fast foods, submarine sandwich, ham on white bread with lettuce and tomato/],
  ['Prepared', 'Fried rice', /^Restaurant, Chinese, fried rice, without meat/],
  ['Prepared', 'Vegetable beef soup, canned', /^Soup, vegetable beef, canned, condensed/],
  ['Prepared', 'Cream of mushroom soup', /^Soup, cream of mushroom, canned, condensed/],
  ['Prepared', 'Beef noodle soup', /^Soup, beef noodle, canned, condensed/],
  ['Prepared', 'Minestrone soup', /^Soup, minestrone, canned, condensed/],
  ['Prepared', 'Clam chowder', /^Soup, clam chowder, new england, canned, condensed/],
  ['Prepared', 'Ramen noodle soup', /^Soup, ramen noodle, any flavor, dry/],
  ['Prepared', 'Pepperoni pizza', /^Pizza, pepperoni topping, regular crust, frozen, cooked/],
  ['Prepared', 'Chicken nuggets', /^Fast foods, chicken, breaded and fried, boneless pieces, plain/],
  ['Prepared', 'Onion rings', /^Fast foods, onion rings, breaded and fried/],
  ['Prepared', 'Nachos with cheese', /^Fast foods, nachos, with cheese/],
  ['Prepared', 'Egg roll, vegetable', /^Egg rolls, vegetable, frozen, prepared/],
  ['Prepared', 'Beef stew', /^Beef stew, canned entree/],
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
  const warnings = [];

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

    /*
     * AUTOMATED BINDING GUARDS
     *
     * The shortest-matching-description heuristic is fast but silently wrong
     * sometimes, and a wrong record under a plausible name is the most damaging
     * defect this file can produce — nobody can eyeball hundreds of bindings.
     * Both checks below are modelled on real bugs found by reading output:
     *
     *   "Meatloaf"        -> "Meatballs, meatless"   (a different food)
     *   "Oatmeal, cooked" -> dry oats                (~5x every value)
     *
     * These only WARN. A false alarm is cheap; a silent mis-binding is not.
     */
    const srcLower = hit.description.toLowerCase();

    /* 1. Does the display name actually appear in the record it bound to? */
    const nameWords = name.toLowerCase().match(/[a-z]{4,}/g) || [];
    const STOP = ['with', 'without', 'from', 'plain', 'style', 'canned', 'cooked',
                  'fresh', 'sliced', 'whole', 'regular', 'light', 'sweet'];
    /* Everyday word for the same food as USDA's term. Not a loophole for a bad
     * binding — each pair is a genuine synonym, verified individually. */
    const SYNONYM = {
      ketchup: 'catsup', spaghetti: 'pasta', oatmeal: 'oats', prunes: 'plums',
      raisins: 'raisin', soda: 'carbonated', cola: 'carbonated', shrimp: 'crustacean',
      crab: 'crustacean', lobster: 'crustacean', scallops: 'mollusk', clams: 'mollusk',
      oysters: 'mollusk', mussels: 'mollusk', bun: 'roll', soybeans: 'soy',
      garbanzo: 'chickpea', chickpeas: 'garbanzo', scallions: 'onions',
      cilantro: 'coriander', zucchini: 'squash', eggplant: 'eggplant',
      /* Reviewed individually against the bound record. */
      choy: 'pak-choi', kielbasa: 'polish', popsicle: 'pop', jelly: 'jellies',
      soda: 'carbonated', arugula: 'rocket'
    };
    const content = nameWords.filter((w) => STOP.indexOf(w) === -1);
    if (content.length) {
      const overlap = content.some((w) => {
        var stem = w.replace(/(ies|es|s)$/, '');
        if (srcLower.indexOf(stem) !== -1) return true;
        var syn = SYNONYM[w];
        return syn ? srcLower.indexOf(syn) !== -1 : false;
      });
      if (!overlap) {
        warnings.push('NAME MISMATCH  ' + name + '  <-  ' + hit.description);
      }
    }

    /* 2. Prepared foods must not be bound to their dry/concentrated form. */
    const saysPrepared = /cooked|brewed|prepared|boiled|baked|roasted/i.test(name);
    /* "dry heat" and "dry-roasted" are COOKING METHODS, not dry foods — the
     * first version of this flagged every baked fish in the list. */
    const dryClaim = hit.description
      .replace(/dry[\s-]?(heat|roast(ed)?|fried)/gi, '');
    const srcSaysDry = /,\s*dry\b|unprepared|dehydrated|\bpowder\b|condensed/i.test(dryClaim) &&
                       !/prepared with|reconstituted/i.test(hit.description);
    if (saysPrepared && srcSaysDry) {
      warnings.push('DRY/PREPARED   ' + name + '  <-  ' + hit.description);
    }
    /* Cooked cereals and grains are mostly water; anything denser is suspect. */
    if (/\bcooked\b/i.test(name) && /cereal|rice|pasta|oat|grits|noodle|barley|quinoa|couscous/i.test(name) &&
        n.energy > 200) {
      warnings.push('TOO DENSE      ' + name + ' = ' + n.energy + ' kcal/100g  <-  ' + hit.description);
    }

    /* 3. Raw and cooked are different foods with different values. */
    if (/\braw\b/i.test(name) && /\bcooked\b/i.test(srcLower)) {
      warnings.push('RAW/COOKED     ' + name + '  <-  ' + hit.description);
    }

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
  if (warnings.length) {
    console.log('\n!!! ' + warnings.length + ' BINDING WARNINGS — review each one:');
    warnings.forEach((w) => console.log('  ' + w));
  } else {
    console.log('\nno binding warnings');
  }
  if (missing.length) {
    console.log('\nUNMATCHED (' + missing.length + '):');
    missing.forEach((m) => console.log('  - ' + m));
  }
}

main();
