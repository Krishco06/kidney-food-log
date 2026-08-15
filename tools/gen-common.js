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
/* Optional second dataset: FNDDS "as consumed" survey foods, for composite
 * dishes SR Legacy does not contain. Omit it and the build simply skips them. */
const FNDDS_SRC = process.argv[3] || path.join(__dirname, 'surveydata', 'FoodData_Central_survey_food_json_2022-10-28.json');
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
  ['Prepared', 'Beef noodle soup, canned', /^Soup, beef noodle, canned, condensed/],
  ['Prepared', 'Minestrone soup, canned', /^Soup, minestrone, canned, condensed/],
  ['Prepared', 'Clam chowder', /^Soup, clam chowder, new england, canned, condensed/],
  ['Prepared', 'Ramen noodle soup', /^Soup, ramen noodle, any flavor, dry/],
  ['Prepared', 'Pepperoni pizza', /^Pizza, pepperoni topping, regular crust, frozen, cooked/],
  ['Prepared', 'Chicken nuggets', /^Fast foods, chicken, breaded and fried, boneless pieces, plain/],
  ['Prepared', 'Onion rings', /^Fast foods, onion rings, breaded and fried/],
  ['Prepared', 'Nachos with cheese', /^Fast foods, nachos, with cheese/],
  ['Prepared', 'Egg roll, vegetable', /^Egg rolls, vegetable, frozen, prepared/],

  /* ================================================================ *
   * EXPANSION 2 — bound by probing the dataset first (tools workflow),
   * so every pattern here is anchored to a description known to exist
   * with a complete nutrient panel.
   * ================================================================ */

  ['Fish', 'Perch, cooked', /^Fish, perch, mixed species, cooked, dry heat$/],
  ['Fish', 'Bass, cooked', /^Fish, bass, striped, cooked, dry heat$/],
  ['Fish', 'Snapper, cooked', /^Fish, snapper, mixed species, cooked, dry heat$/],
  ['Fish', 'Grouper, cooked', /^Fish, grouper, mixed species, cooked, dry heat$/],
  ['Fish', 'Mahi mahi, cooked', /^Fish, mahimahi, cooked, dry heat$/],
  ['Fish', 'Whiting, cooked', /^Fish, whiting, mixed species, cooked, dry heat$/],
  ['Fish', 'Herring, pickled', /^Fish, herring, Atlantic, pickled$/],
  ['Fish', 'Anchovy, canned', /^Fish, anchovy, european, canned in oil, drained solids$/],
  ['Fish', 'Squid, fried', /^Mollusks, squid, mixed species, cooked, fried$/],
  ['Fish', 'Crawfish, cooked', /^Crustaceans, crayfish, mixed species, farmed, cooked, moist heat$/],
  ['Fish', 'Imitation crab (surimi)', /^Fish, surimi$/],
  ['Fish', 'Smoked salmon', /^Fish, salmon, chinook, smoked$/],
  ['Fish', 'Canned mackerel', /^Fish, mackerel, jack, canned, drained solids$/],
  ['Fish', 'Octopus, cooked', /^Mollusks, octopus, common, cooked, moist heat$/],
  ['Fish', 'Fish roe, cooked', /^Fish, roe, mixed species, cooked, dry heat$/],

  ['Prepared', 'Quesadilla, cheese', /^ON THE BORDER, cheese quesadilla$/],
  ['Prepared', 'Cheese enchilada', /^ON THE BORDER, cheese enchilada$/],
  ['Prepared', 'Tamale, pork', /^Tamales, masa and pork filling \(Hopi\)$/],
  ['Prepared', 'BLT sandwich', /^Fast foods, submarine sandwich, bacon, lettuce, and tomato on white bread$/],
  ['Prepared', 'Grilled chicken club sandwich', /^Fast foods, grilled chicken, bacon and tomato club sandwich, with cheese, lettuce, and mayonnaise$/],
  ['Prepared', 'Philly cheesesteak', /^Fast foods, submarine sandwich, steak and cheese on white bread with cheese, lettuce and tomato$/],
  ['Prepared', 'Corn dog', /^Corn dogs, frozen, prepared$/],
  ['Prepared', 'Meatball sub', /^Fast foods, submarine sandwich, meatball marinara on white bread$/],
  ['Prepared', 'Breakfast burrito', /^Fast foods, breakfast burrito, with egg, cheese, and sausage$/],
  ['Prepared', 'Omelet', /^Egg, whole, cooked, omelet$/],
  ['Prepared', 'Salisbury steak, frozen', /^Salisbury steak with gravy, frozen$/],
  ['Prepared', 'Fried chicken breast', /^Fast Foods, Fried Chicken, Breast, meat and skin and breading$/],
  ['Prepared', 'Chicken and rice soup, canned', /^Soup, chicken with rice, canned, condensed$/],

  ['Meat', 'Chicken, roasted with skin', /^Chicken, broilers or fryers, meat and skin, cooked, roasted$/],
  ['Meat', 'Chicken breast, fried', /^Chicken, broilers or fryers, breast, meat only, cooked, fried$/],
  ['Meat', 'Duck, roasted', /^Duck, domesticated, meat only, cooked, roasted$/],
  ['Meat', 'Ground beef, lean, cooked', /^Beef, ground, 90% lean meat \/ 10% fat, patty, cooked, pan-broiled$/],
  ['Meat', 'Pork tenderloin, cooked', /^Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted$/],
  ['Meat', 'Pork shoulder, cooked', /^Pork, fresh, shoulder, whole, separable lean only, cooked, roasted$/],
  ['Meat', 'Canadian bacon', /^Canadian bacon, unprepared$/],
  ['Meat', 'Luncheon meat, canned', /^Luncheon meat, pork, canned$/],
  ['Meat', 'Ground lamb, cooked', /^Lamb, ground, cooked, broiled$/],
  ['Meat', 'Venison, cooked', /^Game meat, deer, cooked, roasted$/],
  ['Meat', 'Bison, cooked', /^Game meat, bison, ground, cooked, pan-broiled$/],
  ['Meat', 'Chicken liver, cooked', /^Chicken, liver, all classes, cooked, simmered$/],
  ['Meat', 'Rabbit, cooked', /^Game meat, rabbit, wild, cooked, stewed$/],

  ['Dairy', 'Kefir, lowfat', /^Kefir, lowfat, plain, LIFEWAY$/],
  ['Dairy', 'Gouda cheese', /^Cheese, gouda$/],
  ['Dairy', 'Romano cheese', /^Cheese, romano$/],
  ['Dairy', 'Neufchatel cheese', /^Cheese, neufchatel$/],
  ['Dairy', 'Queso fresco', /^Cheese, fresh, queso fresco$/],
  ['Dairy', 'Greek yogurt, nonfat', /^Yogurt, Greek, plain, nonfat \(Includes foods for USDA's Food Distribution Program\)$/],
  ['Dairy', 'Vanilla yogurt, low fat', /^Yogurt, vanilla, low fat\.$/],
  ['Dairy', 'Light whipping cream', /^Cream, fluid, light whipping$/],
  ['Dairy', 'Butter, unsalted', /^Butter, without salt$/],
  ['Dairy', 'Egg custard, baked', /^Desserts, egg custard, baked, prepared-from-recipe$/],
  ['Dairy', 'Egg substitute, liquid', /^Egg substitute, liquid or frozen, fat free$/],
  ['Dairy', 'Egg, poached', /^Egg, whole, cooked, poached$/],

  ['Grains', 'Multigrain bread', /^Bread, multi-grain \(includes whole-grain\)$/],
  ['Grains', 'Potato bread', /^Bread, potato$/],
  ['Grains', 'Whole wheat tortilla', /^Tortillas, ready-to-bake or -fry, whole wheat$/],
  ['Grains', 'Naan', /^Bread, naan, plain, commercially prepared, refrigerated$/],
  ['Grains', 'Breadsticks', /^Bread, sticks, plain$/],
  ['Grains', 'Croutons', /^Croutons, plain$/],
  ['Grains', 'Wheat germ', /^Cereals ready-to-eat, wheat germ, toasted, plain$/],
  ['Grains', 'Millet, cooked', /^Millet, cooked$/],
  ['Grains', 'Buckwheat, cooked', /^Buckwheat groats, roasted, cooked$/],
  ['Grains', 'Bulgur, cooked', /^Bulgur, cooked$/],
  ['Grains', 'Rice noodles, cooked', /^Rice noodles, cooked$/],
  ['Grains', 'Soba noodles, cooked', /^Noodles, japanese, soba, cooked$/],
  ['Grains', 'Pie crust, baked', /^Pie crust, standard-type, dry mix, prepared, baked$/],
  ['Grains', 'Granola cereal', /^Cereals ready-to-eat, granola, homemade$/],
  ['Grains', 'Instant oatmeal', /^Cereals, oats, instant, fortified, plain, prepared with water \(boiling water added or microwaved\)$/],
  ['Grains', 'Yellow grits, cooked', /^Cereals, corn grits, yellow, regular and quick, enriched, cooked with water, without salt$/],

  ['Vegetable', 'Arugula', /^Arugula, raw$/],
  ['Vegetable', 'Swiss chard, cooked', /^Chard, swiss, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Beet greens, cooked', /^Beet greens, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Dandelion greens, cooked', /^Dandelion greens, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Watercress', /^Watercress, raw$/],
  ['Vegetable', 'Endive', /^Endive, raw$/],
  ['Vegetable', 'Fennel', /^Fennel, bulb, raw$/],
  ['Vegetable', 'Kohlrabi, cooked', /^Kohlrabi, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Jicama', /^Yambean \(jicama\), raw$/],
  ['Vegetable', 'Cassava', /^Cassava, raw$/],
  ['Vegetable', 'Taro, cooked', /^Taro, cooked, without salt$/],
  ['Vegetable', 'Cream style corn', /^Corn, sweet, yellow, canned, cream style, regular pack$/],
  ['Vegetable', 'Peas and carrots, canned', /^Peas and carrots, canned, regular pack, solids and liquids$/],
  ['Vegetable', 'Succotash, cooked', /^Succotash, \(corn and limas\), cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Spaghetti squash, cooked', /^Squash, winter, spaghetti, cooked, boiled, drained, or baked, without salt$/],
  ['Vegetable', 'Pumpkin, cooked', /^Pumpkin, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Hearts of palm, canned', /^Hearts of palm, canned$/],
  ['Vegetable', 'Alfalfa sprouts', /^Alfalfa seeds, sprouted, raw$/],
  ['Vegetable', 'Seaweed, kelp', /^Seaweed, kelp, raw$/],
  ['Vegetable', 'Horseradish, prepared', /^Horseradish, prepared$/],
  ['Vegetable', 'Capers', /^Capers, canned$/],
  ['Vegetable', 'Pimento, canned', /^Pimento, canned$/],
  ['Vegetable', 'Sweet pickle', /^Pickles, cucumber, sweet \(includes bread and butter pickles\)$/],
  ['Vegetable', 'Green chili peppers, canned', /^Peppers, hot chili, green, canned, pods, excluding seeds, solids and liquids$/],
  ['Vegetable', 'Jalapeno peppers, canned', /^Peppers, jalapeno, canned, solids and liquids$/],

  ['Fruit', 'Sour cherries, raw', /^Cherries, sour, red, raw$/],
  ['Fruit', 'Plantain, raw', /^Plantains, yellow, raw$/],
  ['Fruit', 'Passion fruit', /^Passion-fruit, \(granadilla\), purple, raw$/],
  ['Fruit', 'Lychee', /^Litchis, raw$/],
  ['Fruit', 'Star fruit', /^Carambola, \(starfruit\), raw$/],
  ['Fruit', 'Mulberries', /^Mulberries, raw$/],
  ['Fruit', 'Gooseberries', /^Gooseberries, raw$/],
  ['Fruit', 'Currants, raw', /^Currants, red and white, raw$/],
  ['Fruit', 'Apricots, canned in juice', /^Apricots, canned, juice pack, with skin, solids and liquids$/],
  ['Fruit', 'Cherries, canned in juice', /^Cherries, sweet, canned, juice pack, solids and liquids$/],
  ['Fruit', 'Applesauce, sweetened', /^Applesauce, canned, sweetened, with salt$/],
  ['Fruit', 'Grapefruit, canned', /^Grapefruit, sections, canned, juice pack, solids and liquids$/],
  ['Fruit', 'Dried cherries', /^Cherries, tart, dried, sweetened \(Includes foods for USDA's Food Distribution Program\)$/],

  ['Beans & nuts', 'Cowpeas, cooked', /^Cowpeas, catjang, mature seeds, cooked, boiled, without salt$/],
  ['Beans & nuts', 'Fava beans, cooked', /^Broadbeans \(fava beans\), mature seeds, cooked, boiled, without salt$/],
  ['Beans & nuts', 'Cannellini beans, canned', /^Beans, white, mature seeds, canned$/],
  ['Beans & nuts', 'Pink beans, cooked', /^Beans, pink, mature seeds, cooked, boiled, without salt$/],
  ['Beans & nuts', 'Almond butter', /^Nuts, almond butter, plain, with salt added$/],
  ['Beans & nuts', 'Cashew butter', /^Nuts, cashew butter, plain, with salt added$/],
  ['Beans & nuts', 'Sunflower seed butter', /^Seeds, sunflower seed butter, without salt$/],
  ['Beans & nuts', 'Chia seeds', /^Seeds, chia seeds, dried$/],
  ['Beans & nuts', 'Flax seeds', /^Seeds, flaxseed$/],
  ['Beans & nuts', 'Coconut, dried sweetened', /^Nuts, coconut meat, dried \(desiccated\), sweetened, shredded$/],
  ['Beans & nuts', 'Miso', /^Miso$/],
  ['Beans & nuts', 'Falafel', /^Falafel, home-prepared$/],
  ['Beans & nuts', 'Peanuts, raw', /^Peanuts, all types, raw$/],

  ['Snacks', 'Shortbread cookies', /^Cookies, shortbread, commercially prepared, plain$/],
  ['Snacks', 'Fig bars', /^Cookies, fig bars$/],
  ['Snacks', 'Fruit leather rolls', /^Snacks, fruit leather, rolls$/],
  ['Snacks', 'Pecan pie', /^Pie, pecan, prepared from recipe$/],
  ['Snacks', 'Lemon meringue pie', /^Pie, lemon meringue, prepared from recipe$/],
  ['Snacks', 'Eclair', /^Cream puff, eclair, custard or cream filled, iced$/],
  ['Snacks', 'Toffee', /^Candies, toffee, prepared-from-recipe$/],
  ['Snacks', 'White chocolate', /^Candies, white chocolate$/],
  ['Snacks', 'Chocolate chips', /^Candies, semisweet chocolate$/],
  ['Snacks', 'Granola bar, soft', /^Snacks, granola bars, soft, uncoated, plain$/],
  ['Snacks', 'Yellow cake with frosting', /^Cake, yellow, commercially prepared, with vanilla frosting$/],

  ['Drinks', 'Iced tea, diet', /^Beverages, tea, ready-to-drink, lemon, diet$/],
  ['Drinks', 'Coconut milk beverage', /^Beverages, coconut milk, sweetened, fortified with calcium, vitamins A, B12, D2$/],
  ['Drinks', 'Eggnog', /^Eggnog$/],
  ['Drinks', 'Tart cherry juice', /^Cherry juice, tart$/],
  ['Drinks', 'Pomegranate juice', /^Pomegranate juice, bottled$/],
  ['Drinks', 'Mango nectar', /^Mango nectar, canned$/],
  ['Drinks', 'Peach nectar', /^Peach nectar, canned, with added ascorbic acid$/],
  ['Drinks', 'Lemon juice', /^Lemon juice, raw$/],
  ['Drinks', 'Lime juice', /^Lime juice, raw$/],
  ['Drinks', 'Non-alcoholic beer', /^Malt beverage, includes non-alcoholic beer$/],
  ['Drinks', 'Whiskey sour', /^Alcoholic beverage, whiskey sour$/],
  ['Drinks', 'Pina colada', /^Alcoholic beverage, pina colada, canned$/],

  ['Extras', 'Pesto', /^Sauce, pesto, ready-to-serve, refrigerated$/],
  ['Extras', 'Cranberry sauce', /^Cranberry sauce, canned, sweetened$/],
  ['Extras', 'Orange marmalade', /^Marmalade, orange$/],
  ['Extras', 'Pancake syrup', /^Syrups, table blends, pancake$/],
  ['Extras', 'Honey mustard dressing', /^Dressing, honey mustard, fat-free$/],
  ['Extras', 'Sriracha', /^Sauce, hot chile, sriracha$/],
  ['Extras', 'Sweet and sour sauce', /^Sauce, sweet and sour, ready-to-serve$/],
  ['Extras', 'Oyster sauce', /^Sauce, oyster, ready-to-serve$/],
  ['Extras', 'Fish sauce', /^Sauce, fish, ready-to-serve$/],
  ['Extras', 'Hoisin sauce', /^Sauce, hoisin, ready-to-serve$/],
  ['Extras', 'Balsamic vinegar', /^Vinegar, balsamic$/],
  ['Extras', 'Red wine vinegar', /^Vinegar, red wine$/],
  ['Extras', 'Cooking spray', /^Oil, PAM cooking spray, original$/],
  ['Extras', 'Bouillon, dry', /^Soup, chicken broth or bouillon, dry$/],
  ['Extras', 'Chili powder', /^Spices, chili powder$/],
  ['Extras', 'Cumin', /^Spices, cumin seed$/],
  ['Extras', 'Paprika', /^Spices, paprika$/],
  ['Extras', 'Oregano, dried', /^Spices, oregano, dried$/],
  ['Extras', 'Basil, dried', /^Spices, basil, dried$/],
  ['Extras', 'Parsley, dried', /^Spices, parsley, dried$/],
  ['Extras', 'Ginger, ground', /^Spices, ginger, ground$/],
  ['Extras', 'Nutmeg', /^Spices, nutmeg, ground$/],
  ['Extras', 'Vanilla extract', /^Vanilla extract$/],
  ['Extras', 'Cornstarch', /^Cornstarch$/],
  ['Extras', 'Baking powder', /^Leavening agents, baking powder, double-acting, sodium aluminum sulfate$/],

  /* ================================================================ *
   * EXPANSION 3 — preparations of foods already listed (raw / frozen /
   * canned), plain-speech cuts and cheeses, and mainstream staples.
   * ================================================================ */

  ['Vegetable', 'Spinach, frozen, cooked', /^Spinach, frozen, chopped or leaf, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Broccoli, frozen, cooked', /^Broccoli, frozen, chopped, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Green beans, frozen, cooked', /^Beans, snap, green, frozen, cooked, boiled, drained without salt$/],
  ['Vegetable', 'Corn, frozen, cooked', /^Corn, sweet, yellow, frozen, kernels cut off cob, boiled, drained, without salt$/],
  ['Vegetable', 'Peas, frozen, cooked', /^Peas, green, frozen, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Brussels sprouts, raw', /^Brussels sprouts, raw$/],
  ['Vegetable', 'Kale, raw', /^Kale, raw$/],
  ['Vegetable', 'Asparagus, raw', /^Asparagus, raw$/],
  ['Vegetable', 'Green beans, raw', /^Beans, snap, green, raw$/],
  ['Vegetable', 'Eggplant, raw', /^Eggplant, raw$/],
  ['Vegetable', 'Okra, raw', /^Okra, raw$/],
  ['Vegetable', 'Zucchini, raw', /^Squash, summer, zucchini, includes skin, raw$/],
  ['Vegetable', 'Red cabbage', /^Cabbage, red, raw$/],
  ['Vegetable', 'Napa cabbage', /^Cabbage, chinese \(pe-tsai\), raw$/],
  ['Vegetable', 'Shallots', /^Shallots, raw$/],
  ['Vegetable', 'Portabella mushrooms', /^Mushrooms, portabella, raw$/],
  ['Vegetable', 'Shiitake mushrooms, cooked', /^Mushrooms, shiitake, cooked, without salt$/],
  ['Vegetable', 'Sun-dried tomatoes', /^Tomatoes, sun-dried$/],
  ['Vegetable', 'Tomatillo', /^Tomatillos, raw$/],
  ['Vegetable', 'Butterhead lettuce', /^Lettuce, butterhead \(includes boston and bibb types\), raw$/],
  ['Vegetable', 'Green leaf lettuce', /^Lettuce, green leaf, raw$/],
  ['Vegetable', 'Radicchio', /^Radicchio, raw$/],
  ['Vegetable', 'Rutabaga, cooked', /^Rutabagas, cooked, boiled, drained, without salt$/],
  ['Vegetable', 'Turnip, raw', /^Turnips, raw$/],
  ['Vegetable', 'Celeriac', /^Celeriac, raw$/],
  ['Vegetable', 'Chives', /^Chives, raw$/],
  ['Vegetable', 'Parsley, fresh', /^Parsley, fresh$/],
  ['Vegetable', 'Cilantro, fresh', /^Coriander \(cilantro\) leaves, raw$/],
  ['Vegetable', 'Serrano peppers', /^Peppers, serrano, raw$/],
  ['Vegetable', 'Hungarian peppers', /^Peppers, hungarian, raw$/],
  ['Vegetable', 'Beets, canned', /^Beets, canned, drained solids$/],
  ['Vegetable', 'Carrots, canned', /^Carrots, canned, regular pack, drained solids$/],
  ['Vegetable', 'Mushrooms, canned', /^Mushrooms, canned, drained solids$/],
  ['Vegetable', 'Baby carrots', /^Carrots, baby, raw$/],
  ['Vegetable', 'Kimchi', /^Cabbage, kimchi$/],
  ['Vegetable', 'Ginger root', /^Ginger root, raw$/],

  ['Fruit', 'Peaches, frozen, sweetened', /^Peaches, frozen, sliced, sweetened$/],
  ['Fruit', 'Asian pear', /^Pears, asian, raw$/],
  ['Fruit', 'Casaba melon', /^Melons, casaba, raw$/],
  ['Fruit', 'Kumquat', /^Kumquats, raw$/],
  ['Fruit', 'Jackfruit', /^Jackfruit, raw$/],
  ['Fruit', 'Breadfruit', /^Breadfruit, raw$/],
  ['Fruit', 'Soursop', /^Soursop, raw$/],
  ['Fruit', 'Loquat', /^Loquats, raw$/],
  ['Fruit', 'Boysenberries, frozen', /^Boysenberries, frozen, unsweetened$/],
  ['Fruit', 'Elderberries', /^Elderberries, raw$/],
  ['Fruit', 'Crabapple', /^Crabapples, raw$/],
  ['Fruit', 'Fruit salad, canned in juice', /^Fruit salad, \(peach and pear and apricot and pineapple and cherry\), canned, juice pack, solids and liquids$/],
  ['Fruit', 'Banana, dried', /^Bananas, dehydrated, or banana powder$/],

  ['Meat', 'Ribeye steak, cooked', /^Beef, rib eye steak, boneless, lip off, separable lean only, trimmed to 0" fat, choice, cooked, grilled$/],
  ['Meat', 'Sirloin steak, cooked', /^Beef, top sirloin, steak, separable lean only, trimmed to 0" fat, choice, cooked, broiled$/],
  ['Meat', 'Flank steak, cooked', /^Beef, flank, steak, separable lean only, trimmed to 0" fat, choice, cooked, broiled$/],
  ['Meat', 'Ground beef, regular, cooked', /^Beef, ground, 80% lean meat \/ 20% fat, patty, cooked, pan-broiled$/],
  ['Meat', 'Beef roast, cooked', /^Beef, round, eye of round roast, boneless, separable lean only, trimmed to 0" fat, choice, cooked, roasted$/],
  ['Meat', 'Mortadella', /^Mortadella, beef, pork$/],
  ['Meat', 'Chicken tenders, breaded', /^Chicken tenders, breaded, frozen, prepared$/],
  ['Meat', 'Duck breast, raw', /^Duck, wild, breast, meat only, raw$/],
  ['Meat', 'Goat, cooked', /^Game meat, goat, cooked, roasted$/],
  ['Meat', 'Elk, cooked', /^Game meat, elk, cooked, roasted$/],
  ['Meat', 'Beef tongue, cooked', /^Beef, variety meats and by-products, tongue, cooked, simmered$/],
  ['Meat', 'Beef heart, cooked', /^Beef, variety meats and by-products, heart, cooked, simmered$/],
  ['Meat', 'Beef kidney, cooked', /^Beef, variety meats and by-products, kidneys, cooked, simmered$/],
  ['Meat', 'Tripe, cooked', /^Beef, variety meats and by-products, tripe, cooked, simmered$/],
  ['Meat', 'Pork belly, raw', /^Pork, fresh, belly, raw$/],

  ['Fish', 'Albacore tuna, canned', /^Fish, tuna, white, canned in water, drained solids$/],
  ['Fish', 'Sockeye salmon, cooked', /^Fish, salmon, sockeye, cooked, dry heat$/],
  ['Fish', 'Coho salmon, cooked', /^Fish, salmon, coho, farmed, cooked, dry heat$/],
  ['Fish', 'Sardines in tomato sauce', /^Fish, sardine, Pacific, canned in tomato sauce, drained solids with bone$/],
  ['Fish', 'Kippered herring', /^Fish, herring, Atlantic, kippered$/],
  ['Fish', 'Salt cod', /^Fish, cod, Atlantic, dried and salted$/],
  ['Fish', 'Carp, cooked', /^Fish, carp, cooked, dry heat$/],
  ['Fish', 'Eel, cooked', /^Fish, eel, mixed species, cooked, dry heat$/],
  ['Fish', 'Monkfish, cooked', /^Fish, monkfish, cooked, dry heat$/],
  ['Fish', 'Sturgeon, cooked', /^Fish, sturgeon, mixed species, cooked, dry heat$/],
  ['Fish', 'Rockfish, cooked', /^Fish, rockfish, Pacific, mixed species, cooked, dry heat$/],
  ['Fish', 'Sea bass, cooked', /^Fish, sea bass, mixed species, cooked, dry heat$/],
  ['Fish', 'Abalone, fried', /^Mollusks, abalone, mixed species, cooked, fried$/],
  ['Fish', 'Caviar', /^Fish, caviar, black and red, granular$/],
  ['Fish', 'Smelt, cooked', /^Fish, smelt, rainbow, cooked, dry heat$/],
  ['Fish', 'Pollock, Atlantic, cooked', /^Fish, pollock, Atlantic, cooked, dry heat$/],

  ['Dairy', 'Mozzarella, part skim', /^Cheese, mozzarella, part skim milk$/],
  ['Dairy', 'Cream cheese, low fat', /^Cheese, cream, low fat$/],
  ['Dairy', 'Cottage cheese, dry curd', /^Cheese, cottage, nonfat, uncreamed, dry, large or small curd$/],
  ['Dairy', 'String cheese', /^Cheese, mozzarella, low moisture, part-skim$/],
  ['Dairy', 'Brie', /^Cheese, brie$/],
  ['Dairy', 'Camembert', /^Cheese, camembert$/],
  ['Dairy', 'Fontina', /^Cheese, fontina$/],
  ['Dairy', 'Muenster cheese', /^Cheese, muenster$/],
  ['Dairy', 'Limburger', /^Cheese, limburger$/],
  ['Dairy', 'Sour cream, reduced fat', /^Cream, sour, reduced fat, cultured$/],
  ['Dairy', 'Greek yogurt, strawberry', /^Yogurt, Greek, strawberry, nonfat$/],
  ['Dairy', 'Ice cream, light vanilla', /^Ice creams, vanilla, light$/],
  ['Dairy', 'Whey, dried', /^Whey, sweet, dried$/],

  ['Grains', 'Pumpernickel bread', /^Bread, pumpernickel$/],
  ['Grains', 'Italian bread', /^Bread, Italian$/],
  ['Grains', 'Egg bread', /^Bread, egg$/],
  ['Grains', 'Low sodium white bread', /^Bread, white, commercially prepared, low sodium, no salt$/],
  ['Grains', 'Taco shell', /^Taco shells, baked$/],
  ['Grains', 'Wonton wrappers', /^Wonton wrappers \(includes egg roll wrappers\)$/],
  ['Grains', 'Phyllo dough', /^Phyllo dough$/],
  ['Grains', 'Instant rice, cooked', /^Rice, white, long-grain, precooked or instant, enriched, prepared$/],
  ['Grains', 'Wild rice, cooked', /^Wild rice, cooked$/],
  ['Grains', 'Parboiled rice, cooked', /^Rice, white, long-grain, parboiled, enriched, cooked$/],
  ['Grains', 'Chow mein noodles', /^Noodles, chinese, chow mein$/],
  ['Grains', 'Wheat bran', /^Wheat bran, crude$/],
  ['Grains', 'Amaranth, cooked', /^Amaranth grain, cooked$/],
  ['Grains', 'Sorghum grain', /^Sorghum grain$/],
  ['Grains', 'Teff, cooked', /^Teff, cooked$/],
  ['Grains', 'Rye grain', /^Rye grain$/],
  ['Grains', 'Buckwheat flour', /^Buckwheat flour, whole-groat$/],
  ['Grains', 'Corn muffin', /^Muffins, corn, commercially prepared$/],
  ['Grains', 'Oat bran muffin', /^Muffins, oat bran$/],
  ['Grains', 'Cinnamon bun, frosted', /^Cinnamon buns, frosted \(includes honey buns\)$/],

  ['Beans & nuts', 'Black turtle beans, cooked', /^Beans, black turtle, mature seeds, cooked, boiled, without salt$/],
  ['Beans & nuts', 'Cranberry beans, cooked', /^Beans, cranberry \(roman\), mature seeds, cooked, boiled, without salt$/],
  ['Beans & nuts', 'Yellow beans, cooked', /^Beans, yellow, mature seeds, cooked, boiled, without salt$/],
  ['Beans & nuts', 'Pigeon peas, cooked', /^Pigeon peas \(red gram\), mature seeds, cooked, boiled, without salt$/],
  ['Beans & nuts', 'Chestnuts, roasted', /^Nuts, chestnuts, european, roasted$/],
  ['Beans & nuts', 'Pine nuts', /^Nuts, pine nuts, dried$/],
  ['Beans & nuts', 'Black walnuts', /^Nuts, walnuts, black, dried$/],
  ['Beans & nuts', 'Safflower seeds', /^Seeds, safflower seed kernels, dried$/],
  ['Beans & nuts', 'Watermelon seeds', /^Seeds, watermelon seed kernels, dried$/],
  ['Beans & nuts', 'Lotus seeds', /^Seeds, lotus seeds, dried$/],
  ['Beans & nuts', 'Soy flour, defatted', /^Soy flour, defatted$/],
  ['Beans & nuts', 'Natto', /^Natto$/],
  ['Beans & nuts', 'Soy sauce, low sodium', /^Soy sauce made from soy and wheat \(shoyu\), low sodium$/],
  ['Beans & nuts', 'Peanut flour', /^Peanut flour, defatted$/],

  ['Snacks', 'Molasses cookies', /^Cookies, molasses$/],
  ['Snacks', 'Butter cookies', /^Cookies, butter, commercially prepared, enriched$/],
  ['Snacks', 'Blueberry pie', /^Pie, blueberry, commercially prepared$/],
  ['Snacks', 'Chocolate cream pie', /^Pie, chocolate creme, commercially prepared$/],
  ['Snacks', 'Coconut cream pie', /^Pie, coconut creme, commercially prepared$/],
  ['Snacks', 'Sponge cake', /^Cake, sponge, commercially prepared$/],
  ['Snacks', 'Fruitcake', /^Cake, fruitcake, commercially prepared$/],
  ['Snacks', 'Boston cream pie', /^Cake, boston cream pie, commercially prepared$/],
  ['Snacks', 'Snack cake, creme-filled', /^Cake, snack cakes, creme-filled, sponge$/],
  ['Snacks', 'Peanut brittle', /^Candies, peanut brittle, prepared-from-recipe$/],
  ['Snacks', 'Fudge', /^Candies, fudge, chocolate, prepared-from-recipe$/],
  ['Snacks', 'Nougat with almonds', /^Candies, nougat, with almonds$/],
  ['Snacks', 'Sesame sticks', /^Snacks, sesame sticks, wheat-based, salted$/],
  ['Snacks', 'Bagel chips', /^Snacks, bagel chips, plain$/],
  ['Snacks', 'Plantain chips', /^Snacks, plantain chips, salted$/],
  ['Snacks', 'Potato sticks', /^Snacks, potato sticks$/],
  ['Snacks', 'Corn nuts, barbecue', /^Snacks, cornnuts, barbecue-flavor$/],

  ['Drinks', 'Cranberry juice, unsweetened', /^Cranberry juice, unsweetened$/],
  ['Drinks', 'Blackberry juice', /^Blackberry juice, canned$/],
  ['Drinks', 'Papaya nectar', /^Papaya nectar, canned$/],
  ['Drinks', 'Apricot nectar', /^Apricot nectar, canned, with added ascorbic acid$/],
  ['Drinks', 'Pear nectar', /^Pear nectar, canned, with added ascorbic acid$/],
  ['Drinks', 'Passion fruit juice', /^Passion-fruit juice, purple, raw$/],
  ['Drinks', 'Carrot juice', /^Carrot juice, canned$/],
  ['Drinks', 'Grape soda', /^Beverages, carbonated, grape soda$/],
  ['Drinks', 'Pepper-type soda', /^Beverages, carbonated, pepper-type, contains caffeine$/],
  ['Drinks', 'Diet lemon-lime soda', /^Beverages, carbonated, low calorie, other than cola or pepper, with aspartame, contains caffeine$/],
  ['Drinks', 'Dessert wine, sweet', /^Alcoholic beverage, wine, dessert, sweet$/],
  ['Drinks', 'Daiquiri, canned', /^Alcoholic beverage, daiquiri, canned$/],
  ['Drinks', 'Tequila sunrise, canned', /^Alcoholic beverage, tequila sunrise, canned$/],

  ['Extras', 'Corn oil', /^Oil, corn, industrial and retail, all purpose salad or cooking$/],
  ['Extras', 'Peanut oil', /^Oil, peanut, salad or cooking$/],
  ['Extras', 'Sesame oil', /^Oil, sesame, salad or cooking$/],
  ['Extras', 'Coconut oil', /^Oil, coconut$/],
  ['Extras', 'Sunflower oil', /^Oil, sunflower, linoleic, \(approx\. 65%\)$/],
  ['Extras', 'Lard', /^Lard$/],
  ['Extras', 'Ranch dressing, fat-free', /^Salad dressing, ranch dressing, fat-free$/],
  ['Extras', 'Steak sauce', /^Sauce, steak, tomato based$/],
  ['Extras', 'Curry powder', /^Spices, curry powder$/],
  ['Extras', 'Turmeric', /^Spices, turmeric, ground$/],
  ['Extras', 'Cayenne pepper', /^Spices, pepper, red or cayenne$/],
  ['Extras', 'Thyme, dried', /^Spices, thyme, dried$/],
  ['Extras', 'Rosemary, dried', /^Spices, rosemary, dried$/],
  ['Extras', 'Sage, ground', /^Spices, sage, ground$/],
  ['Extras', 'Bay leaf', /^Spices, bay leaf$/],
  ['Extras', 'Cloves, ground', /^Spices, cloves, ground$/],
  ['Extras', 'Allspice', /^Spices, allspice, ground$/],
  ['Extras', 'Cardamom', /^Spices, cardamom$/],
  ['Extras', 'Poppy seed', /^Spices, poppy seed$/],
  ['Extras', 'Celery seed', /^Spices, celery seed$/],
  ['Extras', 'Fennel seed', /^Spices, fennel seed$/],
  ['Extras', 'Dill weed, dried', /^Spices, dill weed, dried$/],
  ['Extras', 'Tarragon, dried', /^Spices, tarragon, dried$/],
  ['Extras', 'Marjoram, dried', /^Spices, marjoram, dried$/],
  ['Extras', 'Green chili sauce', /^Sauce, chili, peppers, hot, immature green, canned$/],
  ['Extras', 'Enchilada sauce, red', /^Sauce, enchilada, red, mild, ready to serve$/],
  ['Extras', 'Salsa verde', /^Sauce, salsa, verde, ready-to-serve$/],
  ['Extras', 'Horseradish sauce', /^Sauce, horseradish$/],
  ['Extras', 'Duck sauce', /^Sauce, duck, ready-to-serve$/],
  ['Extras', 'Active dry yeast', /^Leavening agents, yeast, baker's, active dry$/],
  ['Extras', 'Gelatin, dry powder', /^Gelatins, dry powder, unsweetened$/],
  ['Extras', 'Corn syrup, light', /^Syrups, corn, light$/],
  ['Extras', 'Sugar substitute, aspartame', /^Sweeteners, tabletop, aspartame, EQUAL, packets$/],

  ['Prepared', 'Ravioli, canned', /^Ravioli, cheese-filled, canned$/],
  ['Prepared', 'Cream of chicken soup', /^Soup, cream of chicken, canned, condensed$/],
  ['Prepared', 'Cream of celery soup', /^Soup, cream of celery, canned, condensed$/],
  ['Prepared', 'Lentil soup with ham', /^Soup, lentil with ham, canned, ready-to-serve$/],
  ['Prepared', 'Black bean soup', /^Soup, black bean, canned, condensed$/],
  ['Prepared', 'Bean with pork soup', /^Soup, bean with pork, canned, condensed$/],
  ['Prepared', 'Chicken sandwich, breaded', /^Fast foods, chicken fillet sandwich, plain with pickles$/],
  ['Prepared', 'Fish sandwich', /^Fast foods, fish sandwich, with tartar sauce$/],
  ['Prepared', 'Roast beef sandwich', /^Fast foods, roast beef sandwich, plain$/],
  ['Prepared', 'Hamburger, fast food', /^Fast foods, hamburger; single, regular patty; plain$/],
  ['Prepared', 'Hash browns, fast food', /^Fast foods, potatoes, hash browns, round pieces or patty$/],
  ['Prepared', 'Coleslaw, fast food', /^Fast foods, coleslaw$/],
  ['Prepared', 'Biscuit with egg and ham', /^Fast foods, biscuit, with egg and ham$/],
  ['Prepared', 'Beef stew', /^Beef stew, canned entree/],
  ['Dairy', 'Egg, scrambled', /^Egg, whole, cooked, scrambled$/]
];

/* Portion measures worth showing. SR carries a lot of laboratory-flavoured
 * measures ("1 cu inch", "1 g") that are noise on a phone. */
const GOOD_PORTION = /cup|slice|medium|large|small|piece|tbsp|tablespoon|tsp|teaspoon|oz|ounce|fl oz|serving|each|whole|can|bottle|patty|link|egg|banana|apple|potato/i;
const BAD_PORTION = /cu in|cubic|guideline|not further specified|^1 g$|package|yields|dry, /i;

/*
 * FNDDS portions live in `portionDescription` ("1 cup", "1 piece (1/8 of
 * 7\" x 12\")"). SR Legacy uses `modifier` for the same thing — and FNDDS
 * ALSO has a `modifier` field, but it holds a numeric measure code. Reading
 * the wrong one yields portions labelled "90000".
 */
function portionLabel(p, source) {
  if (source === 'fndds') {
    return String(p.portionDescription || '').replace(/\s+/g, ' ').trim();
  }
  return [p.amount !== 1 ? p.amount : '', p.modifier || (p.measureUnit && p.measureUnit.name) || '']
    .join(' ').replace(/\s+/g, ' ').trim();
}

/*
 * FNDDS — the USDA "as consumed" survey database.
 *
 * SR Legacy is an ingredient database: it has ground beef and flour but no
 * shepherd's pie, which is why three expansions in a row failed to find
 * lasagna, gyros, sushi, quiche, pot pie or gumbo. FNDDS is where composite
 * dishes live, its names are already plain language, and 100% of its records
 * carry a complete P/K/Na/protein/energy panel.
 *
 * These are values for the dish AS EATEN, which is exactly what someone
 * logging dinner needs and what an ingredient database cannot give them.
 */
const CURATED_FNDDS = [
  ['Prepared', 'Shepherd\'s pie', /^Shepherd's pie$/],
  ['Prepared', 'Gyro sandwich', /^Gyro sandwich$/],
  ['Prepared', 'Caesar salad, no dressing', /^Caesar salad, with romaine, no dressing$/],
  ['Prepared', 'Sloppy joe, no bun', /^Sloppy joe, no bun$/],
  ['Prepared', 'Quiche with meat', /^Quiche with meat, poultry or fish$/],
  ['Prepared', 'Lo mein', /^Lo mein, NFS$/],
  ['Prepared', 'Sushi', /^Sushi, NFS$/],
  ['Prepared', 'Pierogi', /^Pierogi$/],
  ['Prepared', 'Gazpacho', /^Gazpacho$/],
  ['Prepared', 'Pot pie, beef', /^Pot pie, beef$/],
  ['Prepared', 'Chicken salad spread', /^Chicken salad spread$/],
  ['Prepared', 'Tuna salad with egg', /^Tuna salad with egg$/],
  ['Prepared', 'Egg salad sandwich', /^Egg salad sandwich on white$/],
  ['Prepared', 'Nachos', /^Nachos, NFS$/],
  ['Prepared', 'Macaroni or noodles with cheese', /^Macaroni or noodles with cheese$/],
  ['Prepared', 'Chili con carne with beans', /^Chili con carne with beans$/],
  ['Prepared', 'Meatloaf sandwich', /^Meatloaf sandwich$/],
  ['Prepared', 'Sweet and sour pork', /^Sweet and sour pork$/],
  ['Prepared', 'Orange chicken', /^Orange chicken$/],
  ['Prepared', 'General Tso chicken', /^General Tso chicken$/],
  ['Prepared', 'Beef and broccoli', /^Beef and broccoli$/],
  ['Prepared', 'Pad Thai', /^Pad Thai, NFS$/],
  ['Prepared', 'Chicken nuggets, average', /^Chicken nuggets, NFS$/],
  ['Prepared', 'Chicken wing, grilled with sauce', /^Chicken wing, grilled with sauce$/],
  ['Prepared', 'Taco', /^Taco, NFS$/],
  ['Prepared', 'Burrito', /^Burrito, NFS$/],
  ['Prepared', 'Enchilada', /^Enchilada, NFS$/],
  ['Prepared', 'Quesadilla', /^Quesadilla, NFS$/],
  ['Prepared', 'Tamale', /^Tamale, NFS$/],
  ['Prepared', 'Empanada', /^Empanada, NFS$/],
  ['Prepared', 'Ravioli, meat-filled', /^Ravioli, meat-filled, no sauce$/],
  ['Prepared', 'Stuffed shells, cheese-filled', /^Stuffed shells, cheese-filled, no sauce$/],
  ['Prepared', 'Pasta salad with egg', /^Macaroni or pasta salad with egg$/],
  ['Prepared', 'Potato salad, German style', /^Potato salad, German style$/],
  ['Prepared', 'Coleslaw', /^Coleslaw$/],
  ['Prepared', 'Asian chicken salad, no dressing', /^Asian chicken or turkey garden salad, chicken and\/or turkey, lettuce, fruit, nuts, no dressing$/],
  ['Prepared', 'Cobb salad, no dressing', /^Cobb salad, no dressing$/],
  ['Prepared', 'Club sandwich on white bread', /^Club sandwich on white$/],
  ['Prepared', 'Grilled cheese sandwich', /^Grilled cheese sandwich, NFS$/],
  ['Prepared', 'Peanut butter and jelly sandwich', /^Peanut butter and jelly$/],
  ['Prepared', 'Reuben sandwich', /^Reuben sandwich$/],
  ['Prepared', 'Chili hot dog, no bun', /^Chili hot dog, no bun$/],
  ['Prepared', 'Cheeseburger, average', /^Cheeseburger, NFS$/],
  ['Prepared', 'Hamburger, average', /^Hamburger, NFS$/],
  ['Prepared', 'Barbecue chicken sandwich', /^Barbecue chicken sandwich, on white bun$/],
  ['Prepared', 'Fish sandwich, average', /^Fish sandwich, NFS$/],
  ['Prepared', 'Huevos rancheros', /^Huevos rancheros$/],
  ['Prepared', 'Corned beef hash', /^Corned beef hash$/],
  ['Prepared', 'Biscuit with gravy', /^Biscuit with gravy$/],
  ['Prepared', 'Waffle, average', /^Waffle, NFS$/],
  ['Prepared', 'Tuna noodle casserole', /^Tuna noodle casserole with mushroom sauce$/],
  ['Prepared', 'Stuffed pepper, with meat', /^Stuffed pepper, with meat$/],
  ['Prepared', 'Stuffed cabbage rolls', /^Stuffed cabbage rolls with beef and rice$/],
  ['Prepared', 'Beef and vegetable stir fry', /^Stir fried beef and vegetables in soy sauce$/],
  ['Prepared', 'Jambalaya', /^Jambalaya with meat and rice$/],
  ['Prepared', 'Shrimp gumbo', /^Shrimp gumbo$/],
  ['Prepared', 'Paella', /^Paella, NFS$/],
  ['Prepared', 'Salisbury steak with gravy', /^Salisbury steak with gravy$/],
  ['Prepared', 'Swiss steak', /^Swiss steak$/],
  ['Prepared', 'Eggplant parmesan', /^Eggplant parmesan casserole, regular$/],
  ['Prepared', 'Hummus, plain', /^Hummus, plain$/],
  ['Prepared', 'Tabbouleh', /^Tabbouleh$/],
  ['Prepared', 'Egg roll, meatless', /^Egg roll, meatless$/],
  ['Prepared', 'Dumpling, no meat', /^Dumpling, no meat$/],
  ['Prepared', 'Wonton soup', /^Wonton soup$/],
  ['Prepared', 'Hot and sour soup', /^Hot and sour soup$/],
  ['Prepared', 'Pho', /^Pho$/],
  ['Prepared', 'Matzo ball soup', /^Matzo ball soup$/],
  ['Prepared', 'Tomato soup, average', /^Tomato soup, NFS$/],
  ['Prepared', 'Vegetable soup, home recipe', /^Vegetable soup, home recipe$/],
  ['Prepared', 'Potato soup', /^Potato soup, prepared with water$/],
  ['Prepared', 'Potato and cheese soup', /^Potato and cheese soup$/],
  ['Prepared', 'Chicken and rice soup, home recipe', /^Chicken or turkey rice soup, home recipe$/],
  ['Prepared', 'Beef noodle soup, home recipe', /^Beef noodle soup, home recipe$/],
  ['Prepared', 'French onion soup', /^Onion soup, French$/],
  ['Prepared', 'Egg drop soup', /^Egg drop soup$/],
  ['Prepared', 'Split pea soup', /^Split pea soup$/],
  ['Prepared', 'Lentil soup', /^Lentil soup, home recipe, canned, or ready-to-serve$/],
  ['Prepared', 'Minestrone soup, home recipe', /^Minestrone soup, home recipe$/],
  ['Prepared', 'Pizza, cheese, stuffed crust', /^Pizza, cheese, stuffed crust$/],
  ['Prepared', 'Calzone with meat and cheese', /^Calzone, with meat and cheese$/],
  ['Prepared', 'Lasagna, meatless', /^Lasagna, meatless$/],
  ['Prepared', 'Manicotti, cheese-filled', /^Manicotti, cheese-filled, no sauce$/],
  ['Prepared', 'Mozzarella sticks', /^Mozzarella sticks, breaded, baked, or fried$/],
  ['Prepared', 'Baked beans', /^Baked beans$/],
  ['Prepared', 'Refried beans', /^Refried beans$/],
  ['Prepared', 'Beans and rice, with meat', /^Beans and rice, with meat$/],
  ['Prepared', 'Green bean casserole', /^Green bean casserole$/],
  ['Prepared', 'Ceviche', /^Ceviche$/],
  ['Prepared', 'Crab cake sandwich', /^Crab cake sandwich$/],
  ['Prepared', 'Shrimp scampi', /^Shrimp scampi$/],
  ['Prepared', 'Clam chowder, Manhattan', /^Clam chowder, Manhattan$/],
  ['Prepared', 'Beef brisket, as eaten', /^Beef, brisket$/],
  ['Prepared', 'Ribs', /^Ribs, NFS$/],
  ['Prepared', 'Meatball, meatless', /^Meatball, meatless$/],
  ['Prepared', 'Beef shish kabob', /^Beef shish kabob with vegetables, excluding potatoes$/],
  ['Prepared', 'Samosa', /^Samosa$/],
  ['Prepared', 'Congee', /^Congee$/],
  ['Prepared', 'Bibimbap', /^Bibimbap, Korean$/],
  ['Prepared', 'Dal', /^Dal$/],
  ['Prepared', 'Burrito bowl', /^Burrito bowl, NFS$/],

  ['Snacks', 'Banana pudding', /^Banana pudding$/],
  ['Snacks', 'Tiramisu', /^Tiramisu$/],
  ['Snacks', 'Churros', /^Churros$/],
  ['Snacks', 'Funnel cake', /^Funnel cake with sugar$/],
  ['Snacks', 'Apple cobbler', /^Cobbler, apple$/],
  ['Snacks', 'Fruit turnover', /^Turnover, fruit$/],
  ['Snacks', 'Nutrition bar', /^Nutrition bar \(Clif Bar\)$/],
  ['Snacks', 'Cereal or granola bar', /^Cereal or Granola bar, NFS$/],
  ['Snacks', 'Meal replacement bar', /^Nutrition bar or meal replacement bar, NFS$/],
  ['Snacks', 'Ice cream sandwich', /^Ice cream sandwich, vanilla$/],
  ['Snacks', 'Ice cream cone', /^Ice cream cone, NFS$/],

  ['Drinks', 'Vegetable smoothie', /^Vegetable smoothie$/],
  ['Drinks', 'Malted milkshake', /^Milk shake with malt$/],
  ['Drinks', 'Cappuccino', /^Coffee, Cappuccino$/],
  ['Drinks', 'Iced coffee', /^Iced Coffee, brewed$/],
  ['Drinks', 'Horchata', /^Horchata beverage, made with milk$/],
  ['Drinks', 'Kombucha', /^Tea, kombucha$/],
  ['Drinks', 'Hot chocolate, ready to drink', /^Hot chocolate \/ Cocoa, ready to drink$/],

  ['Extras', 'Alfredo sauce', /^Alfredo sauce$/],
  ['Extras', 'Curry sauce', /^Curry sauce$/],

  /* ---------------------------------------------------------------- *
   * Systematic sweep of FNDDS by its own WWEIA food categories.
   *
   * Four rounds of guessing dish names had hit its limit, so this walks the
   * taxonomy instead and takes the most generic unused record from each
   * dish-like category. FNDDS marks its generic average with ", NFS" (Not
   * Further Specified), which is exactly what a built-in library wants: the
   * average taco rather than one particular taco.
   *
   * Restricted to DISH categories on purpose. An unrestricted sweep offered
   * "Apple, raw" and "Banana, raw" beside the SR Legacy apples and bananas
   * already shipped — near-duplicate whole foods with slightly different
   * numbers. SR owns ingredients; FNDDS owns dishes.
   * ---------------------------------------------------------------- */

  ['Prepared', 'Bean cake', /^Bean cake$/],
  ['Prepared', 'Lentil curry', /^Lentil curry$/],
  ['Prepared', 'Black bean salad', /^Black bean salad$/],
  ['Prepared', 'Pot pie, no meat', /^Pot pie, no meat$/],
  ['Prepared', 'Hamburger slider', /^Hamburger slider$/],
  ['Prepared', 'Cheeseburger slider', /^Cheeseburger slider$/],
  ['Prepared', 'Taco, fish', /^Taco, fish$/],
  ['Prepared', 'Taco, cheese only', /^Taco, cheese only$/],
  ['Prepared', 'Burrito, cheese only', /^Burrito, cheese only$/],
  ['Prepared', 'Taco, meat, no cheese', /^Taco, meat, no cheese$/],
  ['Prepared', 'Cheese sandwich', /^Cheese sandwich, NFS$/],
  ['Prepared', 'Chicken fillet sandwich', /^Chicken fillet sandwich, NFS$/],
  ['Prepared', 'Chicken salad sandwich wrap', /^Chicken salad sandwich wrap$/],
  ['Prepared', 'Chicken salad sandwich', /^Chicken salad sandwich on white$/],
  ['Drinks', 'Coffee, Cuban', /^Coffee, Cuban$/],
  ['Drinks', 'Coffee, Latte', /^Coffee, Latte$/],
  ['Drinks', 'Coffee, Turkish', /^Coffee, Turkish$/],
  ['Prepared', 'Cabbage salad', /^Cabbage salad, NFS$/],
  ['Prepared', 'Pea salad', /^Pea salad$/],
  ['Prepared', 'Sandwich wrap', /^Sandwich wrap, NFS$/],
  ['Prepared', 'Ham sandwich wrap', /^Ham sandwich wrap$/],
  ['Prepared', 'French dip sandwich', /^French dip sandwich$/],
  ['Extras', 'Gravy', /^Gravy, NFS$/],
  ['Extras', 'Guacamole', /^Guacamole, NFS$/],
  ['Extras', 'Layer dip', /^Layer dip$/],
  ['Extras', 'Cheese dip', /^Cheese dip$/],
  ['Snacks', 'Doughnut', /^Doughnut, NFS$/],
  ['Snacks', 'Pan dulce', /^Pan dulce, NFS$/],
  ['Snacks', 'Breakfast pastry', /^Breakfast pastry, NFS$/],
  ['Snacks', 'Brioche', /^Brioche$/],
  ['Prepared', 'Bao bun', /^Bao bun$/],
  ['Prepared', 'Sushi roll, eel', /^Sushi roll, eel$/],
  ['Prepared', 'Sushi roll tuna', /^Sushi roll tuna$/],
  ['Prepared', 'Bao bun, no meat', /^Bao bun, no meat$/],
  ['Prepared', 'Egg burrito', /^Egg burrito$/],
  ['Prepared', 'Taquito, egg', /^Taquito, egg$/],
  ['Prepared', 'Quesadilla, egg', /^Quesadilla, egg$/],
  ['Prepared', 'Egg white sandwich', /^Egg white sandwich$/],
  ['Prepared', 'Deviled egg', /^Egg, deviled$/],
  ['Prepared', 'Eggs Benedict', /^Egg, Benedict$/],
  ['Prepared', 'Cheese souffle', /^Cheese souffle$/],
  ['Prepared', 'Pig in a blanket', /^Pig in a blanket$/],
  ['Prepared', 'Italian sausage sandwich on white', /^Italian sausage sandwich on white$/],
  ['Prepared', 'Hot dog on a bun', /^Hot dog sandwich, NFS, on white bun$/],
  ['Vegetable', 'Potato tots (tater tots)', /^Potato tots, NFS$/],
  ['Vegetable', 'Potato skins', /^Potato skins, NFS$/],
  ['Vegetable', 'Home fries', /^Potato, home fries, NFS$/],
  ['Prepared', 'Lo mein, meatless', /^Lo mein, meatless$/],
  ['Prepared', 'Pad Thai, meatless', /^Pad Thai, meatless$/],
  ['Vegetable', 'Sweet potato fries', /^Sweet potato fries, NFS$/],
  ['Vegetable', 'Pakora', /^Pakora$/],
  ['Vegetable', 'Yuca fries', /^Yuca fries$/],
  ['Vegetable', 'Fried okra', /^Fried okra$/],
  ['Snacks', 'Sorbet', /^Sorbet$/],
  ['Snacks', 'Snow cone', /^Snow cone$/],
  ['Snacks', 'Italian Ice', /^Italian Ice$/],
  ['Prepared', 'Macaroni and cheese, canned (as eaten)', /^Macaroni or noodles with cheese, canned$/],
  ['Prepared', 'Macaroni and cheese with meat', /^Macaroni or noodles with cheese and meat$/],
  ['Vegetable', 'Potato, scalloped', /^Potato, scalloped, NFS$/],
  ['Prepared', 'Barbecue sandwich', /^Barbecue sandwich, NFS$/],
  ['Prepared', 'Pork sandwich', /^Pork sandwich$/],
  ['Prepared', 'Cuban sandwich', /^Cuban sandwich$/],
  ['Prepared', 'Barbecue rib sandwich', /^Barbecue rib sandwich$/],
  ['Prepared', 'Pork hash', /^Pork hash$/],
  ['Drinks', 'Chocolate milk drink', /^Chocolate milk drink$/],
  ['Drinks', 'Ice cream soda, chocolate', /^Ice cream soda, chocolate$/],
  ['Drinks', 'Chocolate milk shake, fast food', /^Milk shake, fast food, chocolate$/],
  ['Prepared', 'Nachos, chicken', /^Nachos, chicken$/],
  ['Prepared', 'Nachos, cheese only', /^Nachos, cheese only$/],
  ['Prepared', 'Nachos, beef or pork', /^Nachos, beef or pork$/],
  ['Prepared', 'Nachos, with beans', /^Nachos, with beans$/],
  ['Drinks', 'Nutrition shake, ready to drink', /^Nutritional drink or shake, ready-to-drink, NFS$/],
  ['Drinks', 'Nutrition shake, high protein', /^Nutritional drink or shake, high protein, ready-to-drink, NFS$/],
  ['Prepared', 'Fajita', /^Fajita, NFS$/],
  ['Prepared', 'Frito pie', /^Frito pie$/],
  ['Prepared', 'Chilaquiles', /^Chilaquiles$/],
  ['Prepared', 'Tamale, beef', /^Tamale, beef$/],
  ['Prepared', 'Crepe', /^Crepe, NFS$/],
  ['Prepared', 'Dosa, plain', /^Dosa, plain$/],
  ['Prepared', 'Pasta with sauce', /^Pasta with sauce, NFS$/],
  ['Prepared', 'Flavored pasta', /^Flavored pasta$/],
  ['Prepared', 'Gnocchi, cheese', /^Gnocchi, cheese$/],
  ['Prepared', 'Jelly sandwich', /^Jelly sandwich, NFS$/],
  ['Prepared', 'Peanut butter sandwich', /^Peanut butter sandwich, NFS$/],
  ['Prepared', 'Pizza rolls', /^Pizza rolls$/],
  ['Prepared', 'Chicken kiev', /^Chicken kiev$/],
  ['Prepared', 'Chicken curry', /^Chicken curry$/],
  ['Prepared', 'Barbecue chicken', /^Barbecue chicken$/],
  ['Prepared', 'Pot pie, chicken', /^Pot pie, chicken$/],
  ['Snacks', 'Pudding, chocolate', /^Pudding, chocolate, NFS$/],
  ['Snacks', 'Pudding, other flavors', /^Pudding, flavors other than chocolate, NFS$/],
  ['Snacks', 'Flan', /^Flan$/],
  ['Snacks', 'Mousse', /^Mousse$/],
  ['Prepared', 'Idli', /^Idli$/],
  ['Prepared', 'Rice pilaf', /^Rice pilaf$/],
  ['Prepared', 'Dirty rice', /^Dirty rice$/],
  ['Prepared', 'Rice dressing', /^Rice dressing$/],
  ['Prepared', 'Lau lau', /^Lau lau$/],
  ['Prepared', 'Tuna loaf', /^Tuna loaf$/],
  ['Prepared', 'Fish curry', /^Fish curry$/],
  ['Prepared', 'Crab cake', /^Crab, cake$/],
  ['Prepared', 'Sardine sandwich', /^Sardine sandwich$/],
  ['Prepared', 'Fish wrap sandwich', /^Fish wrap sandwich$/],
  ['Prepared', 'Salmon cake sandwich', /^Salmon cake sandwich$/],
  ['Prepared', 'Fried seafood sandwich', /^Fried seafood sandwich$/],
  ['Drinks', 'Fruit smoothie', /^Fruit smoothie, NFS$/],
  ['Drinks', 'Licuado (batido)', /^Licuado or Batido$/],
  ['Prepared', 'Bean soup', /^Bean soup, NFS$/],
  ['Prepared', 'Rice soup', /^Rice soup, NFS$/],
  ['Prepared', 'Noodle soup', /^Noodle soup, NFS$/],
  ['Prepared', 'Borscht', /^Borscht$/],
  ['Prepared', 'Egg foo yung', /^Egg foo yung, NFS$/],
  ['Prepared', 'Hunan beef', /^Hunan beef$/],
  ['Prepared', 'Szechuan beef', /^Szechuan beef$/],
  ['Prepared', 'Kung Pao beef', /^Kung Pao beef$/],
  ['Snacks', 'Turnover or hot pocket snack', /^Turnover or hot pocket, NFS$/],
  ['Snacks', 'Vada', /^Vada$/],
  ['Snacks', 'Knish', /^Knish$/],
  ['Snacks', 'Spanakopita', /^Spanakopita$/],
  ['Vegetable', 'Channa Saag', /^Channa Saag$/],
  ['Vegetable', 'Ratatouille', /^Ratatouille$/],
  ['Vegetable', 'Palak Paneer', /^Palak Paneer$/],
  ['Vegetable', 'Vegetarian stew', /^Vegetarian stew$/],
  ['Prepared', 'Bruschetta', /^Bruschetta$/],
  ['Prepared', 'Falafel sandwich', /^Falafel sandwich$/],
  ['Prepared', 'Veggie burger, on bun', /^Veggie burger, on bun$/],
  ['Prepared', 'Vegetable sandwich wrap', /^Vegetable sandwich wrap$/],

  /* ---------------------------------------------------------------- *
   * Deeper sweep: 6 records per category, widened to packaged products.
   *
   * The near-duplicate risk that kept the first sweep to dish categories is
   * specifically about RAW WHOLE FOODS — an FNDDS "Apple, raw" beside an SR
   * "Apple, with skin" is two apples with different numbers and no way to
   * choose. That does not apply to packaged goods, where SR coverage is thin
   * (two breakfast cereals, a handful of cookies) and FNDDS carries the
   * generic averages people actually buy. Raw produce, plain milk and plain
   * cuts of meat remain SR-only.
   * ---------------------------------------------------------------- */

  ['Grains', 'Bagel, wheat', /^Bagel, wheat$/],
  ['Grains', 'Bagel, oat bran', /^Bagel, oat bran$/],
  ['Grains', 'Bagel, wheat bran', /^Bagel, wheat bran$/],
  ['Grains', 'Bagel, multigrain', /^Bagel, multigrain$/],
  ['Prepared', 'Beans and white rice', /^Beans and white rice$/],
  ['Prepared', 'Beans and brown rice', /^Beans and brown rice$/],
  ['Prepared', 'Vegetarian stroganoff', /^Vegetarian stroganoff$/],
  ['Prepared', 'Black beans and white rice', /^Black beans and white rice$/],
  ['Prepared', 'Pinto beans and white rice', /^Pinto beans and white rice$/],
  ['Prepared', 'Black beans and brown rice', /^Black beans and brown rice$/],
  ['Drinks', 'Hard cider', /^Hard cider$/],
  ['Drinks', 'Beer, low carb', /^Beer, low carb$/],
  ['Drinks', 'Beer, higher alcohol', /^Beer, higher alcohol$/],
  ['Drinks', 'Alcoholic malt beverage, sweetened', /^Alcoholic malt beverage, sweetened$/],
  ['Grains', 'Muffin', /^Muffin, NFS$/],
  ['Grains', 'Scone', /^Scone$/],
  ['Grains', 'Popover', /^Popover$/],
  ['Grains', 'Hush puppy', /^Hush puppy$/],
  ['Grains', 'Johnnycake', /^Johnnycake$/],
  ['Grains', 'Spoonbread', /^Spoonbread$/],
  ['Prepared', 'Burrito, beef, cheese', /^Burrito, beef, cheese$/],
  ['Prepared', 'Burrito, pork, cheese', /^Burrito, pork, cheese$/],
  ['Prepared', 'Burrito, chicken, cheese', /^Burrito, chicken, cheese$/],
  ['Prepared', 'Burrito, meat, no cheese', /^Burrito, meat, no cheese$/],
  ['Prepared', 'Taco or tostada salad, meatless', /^Taco or tostada salad, meatless$/],
  ['Prepared', 'Taco, corn tortilla, beef, cheese', /^Taco, corn tortilla, beef, cheese$/],
  ['Snacks', 'Pie', /^Pie, NFS$/],
  ['Snacks', 'Cake or cupcake', /^Cake or cupcake, NFS$/],
  ['Snacks', 'Baklava', /^Baklava$/],
  ['Snacks', 'Basbousa', /^Basbousa$/],
  ['Snacks', 'Pie shell', /^Pie shell$/],
  ['Snacks', 'Pie, apple', /^Pie, apple$/],
  ['Snacks', 'Chocolate candy, assorted', /^Chocolate candy, other, NFS$/],
  ['Snacks', 'Dark chocolate candy, assorted', /^Dark chocolate candy, other, NFS$/],
  ['Snacks', 'Chocolate candy with nuts', /^Chocolate candy with nuts, other, NFS$/],
  ['Snacks', 'Dark chocolate candy with nuts', /^Dark chocolate candy with nuts, other, NFS$/],
  ['Snacks', 'Chocolate candy', /^Chocolate candy$/],
  ['Snacks', 'Dark chocolate candy', /^Dark chocolate candy$/],
  ['Snacks', 'Candy', /^Candy, NFS$/],
  ['Snacks', 'Candy, non chocolate', /^Candy, non chocolate, other, NFS$/],
  ['Snacks', 'Candy, mint', /^Candy, mint$/],
  ['Snacks', 'Candy, hard', /^Candy, hard$/],
  ['Snacks', 'Cough drops', /^Cough drops$/],
  ['Snacks', 'Chewing gum', /^Chewing gum$/],
  ['Snacks', 'Breakfast bar', /^Breakfast bar, NFS$/],
  ['Snacks', 'Granola bar, reduced sugar', /^Cereal or granola bar, reduced sugar, NFS$/],
  ['Snacks', 'Granola bar, chocolate coated', /^Cereal or granola bar, chocolate coated, NFS$/],
  ['Snacks', 'Granola bar, lowfat', /^Cereal or granola bar, lowfat, NFS$/],
  ['Snacks', 'Snack bar, oatmeal', /^Snack bar, oatmeal$/],
  ['Dairy', 'Cheese', /^Cheese, NFS$/],
  ['Dairy', 'Cheese ball', /^Cheese ball$/],
  ['Prepared', 'Chicken fillet sandwich, fried, on white bun', /^Chicken fillet sandwich, fried, on white bun$/],
  ['Prepared', 'Chicken fillet sandwich, grilled, on white bun', /^Chicken fillet sandwich, grilled, on white bun$/],
  ['Prepared', 'Chicken fillet biscuit, from fast food', /^Chicken fillet biscuit, from fast food$/],
  ['Meat', 'Chicken tenders or strips', /^Chicken tenders or strips, NFS$/],
  ['Meat', 'Chicken patty, breaded', /^Chicken patty, breaded$/],
  ['Meat', 'Chicken fillet, breaded', /^Chicken fillet, breaded$/],
  ['Meat', 'Chicken fillet, grilled', /^Chicken fillet, grilled$/],
  ['Meat', 'Chicken nuggets, frozen', /^Chicken nuggets, from frozen$/],
  ['Meat', 'Chicken nuggets, fast food', /^Chicken nuggets, from fast food$/],
  ['Drinks', 'Coffee, espresso', /^Coffee, espresso$/],
  ['Drinks', 'Coffee, macchiato', /^Coffee, macchiato$/],
  ['Drinks', 'Coffee, Cafe Mocha', /^Coffee, Cafe Mocha$/],
  ['Meat', 'Luncheon meat', /^Luncheon meat, NFS$/],
  ['Meat', 'Potted meat spread', /^Meat spread or potted meat, NFS$/],
  ['Meat', 'Pork jerky', /^Pork jerky$/],
  ['Meat', 'Pork, roll', /^Pork, roll$/],
  ['Prepared', 'Broccoli slaw salad', /^Broccoli slaw salad$/],
  ['Prepared', 'Cucumber and vegetable namasu', /^Cucumber and vegetable namasu$/],
  ['Prepared', 'Coleslaw, fast food / restaurant', /^Coleslaw, fast food \/ restaurant$/],
  ['Prepared', 'Coleslaw, with fruit', /^Coleslaw, with fruit$/],
  ['Snacks', 'Cookie', /^Cookie, NFS$/],
  ['Snacks', 'Marie biscuit', /^Marie biscuit$/],
  ['Snacks', 'Anisette toast', /^Anisette toast$/],
  ['Snacks', 'Cookie, almond', /^Cookie, almond$/],
  ['Snacks', 'Cookie, raisin', /^Cookie, raisin$/],
  ['Grains', 'Crackers', /^Crackers, NFS$/],
  ['Grains', 'Breadsticks, hard', /^Breadsticks, hard, NFS$/],
  ['Grains', 'Rice paper', /^Rice paper$/],
  ['Grains', 'Pita chips', /^Pita chips$/],
  ['Grains', 'Melba toast', /^Melba toast$/],
  ['Prepared', 'Turkey sandwich wrap', /^Turkey sandwich wrap$/],
  ['Prepared', 'Ham sandwich on white', /^Ham sandwich on white$/],
  ['Prepared', 'Turkey sandwich on white', /^Turkey sandwich on white$/],
  ['Drinks', 'Soft drink, diet', /^Soft drink, NFS, diet$/],
  ['Drinks', 'Soft drink, cola, diet', /^Soft drink, cola, diet$/],
  ['Drinks', 'Soft drink, root beer, diet', /^Soft drink, root beer, diet$/],
  ['Drinks', 'Soft drink, cream soda, diet', /^Soft drink, cream soda, diet$/],
  ['Drinks', 'Soft drink, ginger ale, diet', /^Soft drink, ginger ale, diet$/],
  ['Drinks', 'Soft drink, pepper type, diet', /^Soft drink, pepper type, diet$/],
  ['Extras', 'Mole sauce', /^Mole sauce$/],
  ['Extras', 'Seafood dip', /^Seafood dip$/],
  ['Extras', 'Gravy, beef', /^Gravy, beef$/],
  ['Extras', 'Pesto sauce', /^Pesto sauce$/],
  ['Extras', 'Tzatziki dip', /^Tzatziki dip$/],
  ['Extras', 'Peanut sauce', /^Peanut sauce$/],
  ['Snacks', 'Beignet', /^Beignet$/],
  ['Snacks', 'Pannetone', /^Pannetone$/],
  ['Snacks', 'Pastry, puff', /^Pastry, puff$/],
  ['Snacks', 'Tamale, sweet', /^Tamale, sweet$/],
  ['Snacks', 'Fritter, plain', /^Fritter, plain$/],
  ['Snacks', 'Fritter, fruit', /^Fritter, fruit$/],
  ['Prepared', 'Sushi roll, salmon', /^Sushi roll, salmon$/],
  ['Prepared', 'Sushi roll, shrimp', /^Sushi roll, shrimp$/],
  ['Prepared', 'Sushi roll, avocado', /^Sushi roll, avocado$/],
  ['Prepared', 'Sushi roll, vegetable', /^Sushi roll, vegetable$/],
  ['Prepared', 'Sushi roll, California', /^Sushi roll, California$/],
  ['Prepared', 'Pot sticker, fried', /^Wonton, dumpling or pot sticker, fried$/],
  ['Prepared', 'Ham biscuit sandwich', /^Ham biscuit sandwich$/],
  ['Prepared', 'Egg sandwich on bagel', /^Egg sandwich on bagel$/],
  ['Prepared', 'Bacon biscuit sandwich', /^Bacon biscuit sandwich$/],
  ['Prepared', 'Egg sandwich on biscuit', /^Egg sandwich on biscuit$/],
  ['Prepared', 'Sausage biscuit sandwich', /^Sausage biscuit sandwich$/],
  ['Prepared', 'Egg sandwich on croissant', /^Egg sandwich on croissant$/],
  ['Prepared', 'Duck egg, cooked', /^Duck egg, cooked$/],
  ['Prepared', 'Goose egg, cooked', /^Goose egg, cooked$/],
  ['Prepared', 'Quail egg, canned', /^Quail egg, canned$/],
  ['Prepared', 'Egg, whole, pickled', /^Egg, whole, pickled$/],
  ['Fish', 'Fish', /^Fish, NFS$/],
  ['Prepared', 'Hot dog sandwich, beef, on white bun', /^Hot dog sandwich, beef, on white bun$/],
  ['Prepared', 'Hot dog sandwich, vegetarian, on bun', /^Hot dog sandwich, vegetarian, on bun$/],
  ['Prepared', 'Chili hot dog sandwich, on white bun', /^Chili hot dog sandwich, on white bun$/],
  ['Meat', 'Hot dog, meat and poultry', /^Hot dog, meat and poultry$/],
  ['Meat', 'Hot dog, reduced fat', /^Hot dog, reduced fat$/],
  ['Vegetable', 'Potato patty', /^Potato patty$/],
  ['Vegetable', 'Potato tots, baked', /^Potato tots, frozen, baked$/],
  ['Vegetable', 'Potato tots, fried', /^Potato tots, frozen, fried$/],
  ['Prepared', 'Lo mein, with pork', /^Lo mein, with pork$/],
  ['Prepared', 'Lo mein, with beef', /^Lo mein, with beef$/],
  ['Prepared', 'Pad Thai with meat', /^Pad Thai with meat$/],
  ['Prepared', 'Beef chow mein, no noodles', /^Beef chow mein or chop suey, no noodles$/],
  ['Vegetable', 'Fried broccoli', /^Fried broccoli$/],
  ['Vegetable', 'Fried eggplant', /^Fried eggplant$/],
  ['Vegetable', 'Pickles, fried', /^Pickles, fried$/],
  ['Vegetable', 'Fried mushrooms', /^Fried mushrooms$/],
  ['Vegetable', 'Sweet potato tots', /^Sweet potato tots$/],
  ['Vegetable', 'Fried green beans', /^Fried green beans$/],
  ['Drinks', 'Fruit nectar', /^Fruit nectar, NFS$/],
  ['Drinks', 'Guava nectar', /^Guava nectar$/],
  ['Drinks', 'Banana nectar', /^Banana nectar$/],
  ['Drinks', 'Tamarind drink', /^Tamarind drink$/],
  ['Drinks', 'Shirley Temple', /^Shirley Temple$/],
  ['Drinks', 'Soursop, nectar', /^Soursop, nectar$/],
  ['Snacks', 'Freezer pop', /^Freezer pop$/],
  ['Snacks', 'Frozen fruit juice bar', /^Frozen fruit juice bar$/],
  ['Snacks', 'Gelatin dessert, sugar free', /^Gelatin dessert, sugar free$/],
  ['Snacks', 'Gelatin dessert with fruit', /^Gelatin dessert with fruit$/],
  ['Snacks', 'Gelatin salad with vegetables', /^Gelatin salad with vegetables$/],
  ['Dairy', 'Ice cream', /^Ice cream, NFS$/],
  ['Dairy', 'Ice cream sundae', /^Ice cream sundae, NFS$/],
  ['Dairy', 'Creamsicle', /^Creamsicle$/],
  ['Dairy', 'Fudgesicle', /^Fudgesicle$/],
  ['Dairy', 'Banana split', /^Banana split$/],
  ['Extras', 'Syrup', /^Syrup, NFS$/],
  ['Extras', 'Dessert dip', /^Dessert dip$/],
  ['Drinks', 'Gin', /^Gin$/],
  ['Drinks', 'Rum', /^Rum$/],
  ['Drinks', 'Vodka', /^Vodka$/],
  ['Drinks', 'Gimlet', /^Gimlet$/],
  ['Prepared', 'Macaroni or noodles, creamed, with cheese', /^Macaroni or noodles, creamed, with cheese$/],
  ['Prepared', 'Macaroni or noodles with cheese and tomato', /^Macaroni or noodles with cheese and tomato$/],
  ['Prepared', 'Macaroni or noodles with cheese, whole grain', /^Macaroni or noodles with cheese, whole grain$/],
  ['Vegetable', 'Lefse', /^Lefse$/],
  ['Vegetable', 'Potato pancake', /^Potato pancake$/],
  ['Extras', 'Sandwich spread', /^Sandwich spread$/],
  ['Extras', 'Vegan mayonnaise', /^Vegan mayonnaise$/],
  ['Extras', 'Mayonnaise-type salad dressing', /^Mayonnaise-type salad dressing$/],
  ['Extras', 'Mayonnaise, light', /^Mayonnaise, light$/],
  ['Prepared', 'Meatball sandwich or sub', /^Meatball sandwich or sub$/],
  ['Prepared', 'Steak sandwich or sub on white', /^Steak sandwich or sub on white$/],
  ['Prepared', 'Sloppy joe sandwich, on white bun', /^Sloppy joe sandwich, on white bun$/],
  ['Prepared', 'Barbecue beef sandwich, on white bun', /^Barbecue beef sandwich, on white bun$/],
  ['Prepared', 'Beef curry', /^Beef curry$/],
  ['Prepared', 'Beef salad', /^Beef salad$/],
  ['Prepared', 'Beef goulash', /^Beef goulash$/],
  ['Drinks', 'Milk shake, home recipe, chocolate', /^Milk shake, home recipe, chocolate$/],
  ['Drinks', 'Ice cream soda, other flavors', /^Ice cream soda, flavors other than chocolate$/],
  ['Drinks', 'Milk shake, bottled, other flavors', /^Milk shake, bottled, flavors other than chocolate$/],
  ['Drinks', 'Milk shake, fast food, other flavors', /^Milk shake, fast food, flavors other than chocolate$/],
  ['Drinks', 'Milk shake, home recipe, other flavors', /^Milk shake, home recipe, flavors other than chocolate$/],
  ['Extras', 'Chutney', /^Chutney$/],
  ['Extras', 'Pimiento', /^Pimiento$/],
  ['Extras', 'Fry sauce', /^Fry sauce$/],
  ['Extras', 'Wasabi paste', /^Wasabi paste$/],
  ['Prepared', 'Nachos, chicken, with beans', /^Nachos, chicken, with beans$/],
  ['Prepared', 'Nachos, beef or pork, with beans', /^Nachos, beef or pork, with beans$/],
  ['Beans & nuts', 'Nuts', /^Nuts, NFS$/],
  ['Beans & nuts', 'Mixed seeds', /^Mixed seeds$/],
  ['Beans & nuts', 'Almond paste', /^Almond paste$/],
  ['Prepared', 'Pupusa, meat', /^Pupusa, meat$/],
  ['Prepared', 'Mexican pizza', /^Mexican pizza$/],
  ['Prepared', 'Gordita, meat', /^Gordita, meat$/],
  ['Prepared', 'Fajita, shrimp', /^Fajita, shrimp$/],
  ['Prepared', 'Enchilada, beef', /^Enchilada, beef$/],
  ['Prepared', 'Enchilada, pork', /^Enchilada, pork$/],
  ['Prepared', 'Waffle, fruit', /^Waffle, fruit$/],
  ['Prepared', 'Pancakes, fruit', /^Pancakes, fruit$/],
  ['Prepared', 'Gnocchi, potato', /^Gnocchi, potato$/],
  ['Prepared', 'Ravioli, cheese-filled, no sauce', /^Ravioli, cheese-filled, no sauce$/],
  ['Prepared', 'Tortellini, meat-filled, no sauce', /^Tortellini, meat-filled, no sauce$/],
  ['Prepared', 'Tortellini, cheese-filled, no sauce', /^Tortellini, cheese-filled, no sauce$/],
  ['Prepared', 'Tortellini, spinach-filled, no sauce', /^Tortellini, spinach-filled, no sauce$/],
  ['Extras', 'Spaghetti sauce, reduced sodium', /^Spaghetti sauce, reduced sodium$/],
  ['Extras', 'Spaghetti sauce with meat', /^Spaghetti sauce with meat$/],
  ['Extras', 'Spaghetti sauce with poultry', /^Spaghetti sauce with poultry$/],
  ['Extras', 'Spaghetti sauce with seafood', /^Spaghetti sauce with seafood$/],
  ['Extras', 'Vodka sauce with tomatoes and cream', /^Vodka sauce with tomatoes and cream$/],
  ['Extras', 'Spaghetti sauce with added vegetables', /^Spaghetti sauce with added vegetables$/],
  ['Grains', 'Quinoa, fat added', /^Quinoa, fat added$/],
  ['Prepared', 'Almond butter sandwich, on white bread', /^Almond butter sandwich, on white bread$/],
  ['Prepared', 'Pizza, no cheese, thin crust', /^Pizza, no cheese, thin crust$/],
  ['Prepared', 'Pizza, no cheese, thick crust', /^Pizza, no cheese, thick crust$/],
  ['Prepared', 'Pizza, extra cheese, thin crust', /^Pizza, extra cheese, thin crust$/],
  ['Snacks', 'Popcorn', /^Popcorn, NFS$/],
  ['Snacks', 'Popcorn, microwave', /^Popcorn, microwave, NFS$/],
  ['Snacks', 'Popcorn, ready-to-eat', /^Popcorn, ready-to-eat, NFS$/],
  ['Snacks', 'Popcorn, caramel coated', /^Popcorn, caramel coated$/],
  ['Snacks', 'Popcorn, chocolate coated', /^Popcorn, chocolate coated$/],
  ['Snacks', 'Potato chips, popped', /^Potato chips, popped, NFS$/],
  ['Snacks', 'Potato chips, unsalted', /^Potato chips, unsalted$/],
  ['Snacks', 'Potato sticks, flavored', /^Potato sticks, flavored$/],
  ['Snacks', 'Potato sticks, fry shaped', /^Potato sticks, fry shaped$/],
  ['Prepared', 'Chicken cornbread', /^Chicken cornbread$/],
  ['Prepared', 'Chicken or turkey hash', /^Chicken or turkey hash$/],
  ['Prepared', 'Chicken or turkey divan', /^Chicken or turkey divan$/],
  ['Prepared', 'Chicken or turkey souffle', /^Chicken or turkey souffle$/],
  ['Prepared', 'Chicken or turkey fricassee', /^Chicken or turkey fricassee$/],
  ['Prepared', 'Chicken or turkey cacciatore', /^Chicken or turkey cacciatore$/],
  ['Snacks', 'Pretzels, soft', /^Pretzels, soft, NFS$/],
  ['Snacks', 'Pretzels, hard, coated', /^Pretzels, hard, coated, NFS$/],
  ['Snacks', 'Pretzels, hard, filled', /^Pretzels, hard, filled, NFS$/],
  ['Snacks', 'Pretzels, soft, ready-to-eat', /^Pretzels, soft, ready-to-eat, NFS$/],
  ['Snacks', 'Pretzels, soft, from frozen', /^Pretzels, soft, from frozen, NFS$/],
  ['Beans & nuts', 'Chicken, meatless', /^Chicken, meatless, NFS$/],
  ['Beans & nuts', 'Yogurt, soy', /^Yogurt, soy$/],
  ['Beans & nuts', 'Soybean curd', /^Soybean curd$/],
  ['Beans & nuts', 'Soy nut butter', /^Soy nut butter$/],
  ['Beans & nuts', 'Soybean curd cheese', /^Soybean curd cheese$/],
  ['Snacks', 'Trifle', /^Trifle$/],
  ['Snacks', 'Haupia', /^Haupia$/],
  ['Snacks', 'Custard', /^Custard$/],
  ['Snacks', 'Meringues', /^Meringues$/],
  ['Snacks', 'Creme brulee', /^Creme brulee$/],
  ['Snacks', 'Lime souffle', /^Lime souffle$/],
  ['Grains', 'Cereal, ready-to-eat', /^Cereal, ready-to-eat, NFS$/],
  ['Grains', 'Cereal, crunch', /^Cereal, crunch$/],
  ['Grains', 'Cereal, granola', /^Cereal, granola$/],
  ['Grains', 'Cereal, fruit rings', /^Cereal, fruit rings$/],
  ['Grains', 'Cereal, fruit crispy', /^Cereal, fruit crispy$/],
  ['Grains', 'Cereal, O\'s', /^Cereal, O's, NFS$/],
  ['Grains', 'Cereal, O\'s, plain', /^Cereal, O's, plain$/],
  ['Grains', 'Cereal, corn puffs', /^Cereal, corn puffs$/],
  ['Grains', 'Cereal, multigrain', /^Cereal, multigrain$/],
  ['Grains', 'Cereal, K\'s, plain', /^Cereal, K's, plain$/],
  ['Grains', 'Cereal, oat bunches', /^Cereal, oat bunches$/],
  ['Prepared', 'Rice croquette', /^Rice croquette$/],
  ['Prepared', 'Flavored rice mixture', /^Flavored rice mixture$/],
  ['Prepared', 'Spanish rice, fat added', /^Spanish rice, fat added$/],
  ['Prepared', 'Spanish rice, no added fat', /^Spanish rice, no added fat$/],
  ['Prepared', 'Tteokbokki', /^Dukboki or Tteokbokki, Korean$/],
  ['Prepared', 'Flavored rice, brown and wild', /^Flavored rice, brown and wild$/],
  ['Grains', 'Breadsticks, soft', /^Breadsticks, soft, NFS$/],
  ['Grains', 'Roll, rye', /^Roll, rye$/],
  ['Grains', 'Roll, diet', /^Roll, diet$/],
  ['Grains', 'Roll, cheese', /^Roll, cheese$/],
  ['Grains', 'Roll, garlic', /^Roll, garlic$/],
  ['Grains', 'Roll, oatmeal', /^Roll, oatmeal$/],
  ['Extras', 'Salad dressing, light', /^Salad dressing, light, NFS$/],
  ['Extras', 'Salad dressing, fat free', /^Salad dressing, fat free, NFS$/],
  ['Extras', 'Almond oil', /^Almond oil$/],
  ['Extras', 'Walnut oil', /^Walnut oil$/],
  ['Extras', 'Flaxseed oil', /^Flaxseed oil$/],
  ['Meat', 'Chorizo', /^Chorizo$/],
  ['Meat', 'Thuringer', /^Thuringer$/],
  ['Meat', 'Knockwurst', /^Knockwurst$/],
  ['Meat', 'Beef sausage', /^Beef sausage$/],
  ['Prepared', 'Crab salad', /^Crab salad$/],
  ['Prepared', 'Lomi salmon', /^Lomi salmon$/],
  ['Prepared', 'Gefilte fish', /^Gefilte fish$/],
  ['Prepared', 'Clams Casino', /^Clams Casino$/],
  ['Prepared', 'Shrimp toast', /^Shrimp toast$/],
  ['Prepared', 'Salmon salad', /^Salmon salad$/],
  ['Prepared', 'Fish sandwich, grilled', /^Fish sandwich, grilled$/],
  ['Prepared', 'Seafood salad sandwich', /^Seafood salad sandwich$/],
  ['Prepared', 'Tuna salad sandwich wrap', /^Tuna salad sandwich wrap$/],
  ['Prepared', 'Tuna salad sandwich on white', /^Tuna salad sandwich on white$/],
  ['Prepared', 'Fish sandwich, fried, on white bun', /^Fish sandwich, fried, on white bun$/],
  ['Fish', 'Shellfish', /^Shellfish, NFS$/],
  ['Drinks', 'Fruit smoothie, bottled', /^Fruit smoothie, bottled$/],
  ['Drinks', 'Fruit smoothie, no dairy', /^Fruit smoothie juice drink, no dairy$/],
  ['Drinks', 'Fruit and vegetable smoothie, bottled', /^Fruit and vegetable smoothie, bottled$/],
  ['Drinks', 'Fruit and vegetable smoothie, dairy free', /^Fruit and vegetable smoothie, no dairy$/],
  ['Drinks', 'Soft drink', /^Soft drink, NFS$/],
  ['Drinks', 'Soft drink, cream soda', /^Soft drink, cream soda$/],
  ['Prepared', 'Oxtail soup', /^Oxtail soup$/],
  ['Prepared', 'Soup, fruit', /^Soup, fruit$/],
  ['Prepared', 'Kimchi soup', /^Kimchi soup$/],
  ['Prepared', 'Fish chowder', /^Fish chowder$/],
  ['Prepared', 'Spinach soup', /^Spinach soup$/],
  ['Prepared', 'Seaweed soup', /^Seaweed soup$/],
  ['Extras', 'Miso sauce', /^Miso sauce$/],
  ['Extras', 'Soy sauce, reduced sodium', /^Soy sauce, reduced sodium$/],
  ['Extras', 'Teriyaki sauce, reduced sodium', /^Teriyaki sauce, reduced sodium$/],
  ['Drinks', 'Sports drink', /^Sports drink, NFS$/],
  ['Prepared', 'Kung Pao pork', /^Kung Pao pork$/],
  ['Prepared', 'Steak teriyaki', /^Steak teriyaki$/],
  ['Prepared', 'Sesame chicken', /^Sesame chicken$/],
  ['Prepared', 'Almond chicken', /^Almond chicken$/],
  ['Prepared', 'Shrimp teriyaki', /^Shrimp teriyaki$/],
  ['Prepared', 'Moo Goo Gai Pan', /^Moo Goo Gai Pan$/],
  ['Extras', 'Sugar substitute, powder', /^Sugar substitute, powder, NFS$/],
  ['Extras', 'Sugar substitute, liquid', /^Sugar substitute, liquid, NFS$/],
  ['Extras', 'Sugar substitute and sugar blend', /^Sugar substitute and sugar blend$/],
  ['Extras', 'Sugar substitute, stevia, powder', /^Sugar substitute, stevia, powder$/],
  ['Extras', 'Sugar substitute, stevia, liquid', /^Sugar substitute, stevia, liquid$/],
  ['Extras', 'Sugar substitute, sucralose, powder', /^Sugar substitute, sucralose, powder$/],
  ['Extras', 'Sugar, cinnamon', /^Sugar, cinnamon$/],
  ['Extras', 'Agave liquid sweetener', /^Agave liquid sweetener$/],
  ['Extras', 'Confectioners sugar', /^Sugar, white, confectioner's, powdered$/],
  ['Drinks', 'Tea, ginger', /^Tea, ginger$/],
  ['Drinks', 'Tea, bubble', /^Tea, bubble$/],
  ['Drinks', 'Tea, hot, herbal', /^Tea, hot, herbal$/],
  ['Drinks', 'Tea, hot, hibiscus', /^Tea, hot, hibiscus$/],
  ['Drinks', 'Tea, hot, chamomile', /^Tea, hot, chamomile$/],
  ['Drinks', 'Tea, hot, leaf, black', /^Tea, hot, leaf, black$/],
  ['Extras', 'Salsa, red', /^Salsa, red$/],
  ['Extras', 'Taco sauce', /^Taco sauce$/],
  ['Extras', 'Cocktail sauce', /^Cocktail sauce$/],
  ['Extras', 'Tomato chili sauce', /^Tomato chili sauce$/],
  ['Extras', 'Salsa, pico de gallo', /^Salsa, pico de gallo$/],
  ['Extras', 'Salsa, red, homemade', /^Salsa, red, homemade$/],
  ['Snacks', 'Soy chips', /^Soy chips$/],
  ['Snacks', 'Corn nuts', /^Corn nuts$/],
  ['Snacks', 'Bean chips', /^Bean chips$/],
  ['Snacks', 'Taro chips', /^Taro chips$/],
  ['Snacks', 'Chips, rice', /^Chips, rice$/],
  ['Snacks', 'Shrimp chips', /^Shrimp chips$/],
  ['Snacks', 'Bread stuffing', /^Bread stuffing$/],
  ['Snacks', 'Empanada, beef', /^Empanada, beef$/],
  ['Snacks', 'Empanada, no meat', /^Empanada, no meat$/],
  ['Snacks', 'Empanada, chicken', /^Empanada, chicken$/],
  ['Snacks', 'Turnover, seafood', /^Turnover, seafood$/],
  ['Snacks', 'Cornbread stuffing', /^Cornbread stuffing$/],
  ['Vegetable', 'Spinach souffle', /^Spinach souffle$/],
  ['Vegetable', 'Vegetable curry', /^Vegetable curry$/],
  ['Vegetable', 'Mushrooms, stuffed', /^Mushrooms, stuffed$/],
  ['Vegetable', 'Tomatoes, scalloped', /^Tomatoes, scalloped$/],
  ['Vegetable', 'Artichokes, stuffed', /^Artichokes, stuffed$/],
  ['Vegetable', 'Sambar, vegetable stew', /^Sambar, vegetable stew$/],
  ['Prepared', 'Tomato sandwich on white', /^Tomato sandwich on white$/],
  ['Prepared', 'Vegetable sandwich on white', /^Vegetable sandwich on white$/],
  ['Prepared', 'Veggie burger, on bun, with cheese', /^Veggie burger, on bun, with cheese$/],
  ['Prepared', 'Vegetable sandwich on white, with cheese', /^Vegetable sandwich on white, with cheese$/],
  ['Drinks', 'Mimosa', /^Mimosa$/],
  ['Drinks', 'Wine, rice', /^Wine, rice$/],
  ['Drinks', 'Wine cooler', /^Wine cooler$/],
  ['Drinks', 'Sangria, red', /^Sangria, red$/],
  ['Drinks', 'Wine spritzer', /^Wine spritzer$/],
  ['Drinks', 'Sangria, white', /^Sangria, white$/],
  ['Grains', 'Garlic bread', /^Garlic bread, NFS$/],
  ['Grains', 'Bread, soy', /^Bread, soy$/],
  ['Grains', 'Bread, puri', /^Bread, puri$/],
  ['Dairy', 'Yogurt, Greek, whole milk, plain', /^Yogurt, Greek, whole milk, plain$/],
  ['Dairy', 'Yogurt, Greek, whole milk, fruit', /^Yogurt, Greek, whole milk, fruit$/],
  ['Dairy', 'Yogurt, Greek, with oats', /^Yogurt, Greek, with oats$/],
  ['Dairy', 'Greek yogurt, whole milk, flavored', /^Yogurt, Greek, whole milk, flavors other than fruit$/],
  ['Dairy', 'Yogurt, Greek, nonfat milk, plain', /^Yogurt, Greek, nonfat milk, plain$/],
  ['Dairy', 'Yogurt, Greek, nonfat milk, fruit', /^Yogurt, Greek, nonfat milk, fruit$/],
  ['Dairy', 'Yogurt', /^Yogurt, NFS$/],
  ['Dairy', 'Yogurt, liquid', /^Yogurt, liquid$/],
  ['Dairy', 'Yogurt, coconut milk', /^Yogurt, coconut milk$/],
  ['Dairy', 'Yogurt, whole milk, plain', /^Yogurt, whole milk, plain$/],
  ['Dairy', 'Yogurt, whole milk, fruit', /^Yogurt, whole milk, fruit$/],
  ['Dairy', 'Yogurt, whole milk, flavored', /^Yogurt, whole milk, flavors other than fruit$/],
];

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const srFoods = (raw.SRLegacyFoods || []).map((f) => { f._source = 'sr'; return f; });

  /*
   * FNDDS (the "as consumed" survey database) is a second source, used only
   * for composite dishes. SR Legacy is an ingredient database: it has flour and
   * ground beef but no shepherd's pie, which is why every previous expansion
   * failed to find lasagna, gyros, sushi, quiche or pot pie. FNDDS has all of
   * them, already plainly named, and 100% of its records carry a complete
   * P/K/Na/protein/energy panel.
   */
  let fnddsFoods = [];
  if (FNDDS_SRC && fs.existsSync(FNDDS_SRC)) {
    const fraw = JSON.parse(fs.readFileSync(FNDDS_SRC, 'utf8'));
    fnddsFoods = (fraw.SurveyFoods || []).map((f) => { f._source = 'fndds'; return f; });
  }

  const byDesc = srFoods.slice().sort((a, b) => a.description.length - b.description.length);
  const fnddsByDesc = fnddsFoods.slice().sort((a, b) => a.description.length - b.description.length);
  const out = [];
  const missing = [];
  const warnings = [];

  const ALL_WANTED = CURATED.map((c) => c.concat(['sr']))
    .concat(CURATED_FNDDS.map((c) => c.concat(['fndds'])));

  for (const [category, name, re, source] of ALL_WANTED) {
    /* Shortest matching description is reliably the plainest variant. */
    const pool = source === 'fndds' ? fnddsByDesc : byDesc;
    const hit = pool.find((f) => re.test(f.description));
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
      const label = portionLabel(p, hit._source);
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
      soda: 'carbonated', arugula: 'rocket',
      crawfish: 'crayfish', venison: 'deer', lychee: 'litchi',
      cheesesteak: 'steak', breadsticks: 'sticks', surimi: 'surimi',
      malted: 'malt', milkshake: 'milk shake'
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
    /* "dry mix, prepared, baked" is a finished food — the mix was made up. Only
     * flag when nothing in the record says it was actually prepared. */
    const srcSaysDry = /,\s*dry\b|unprepared|dehydrated|\bpowder\b|condensed/i.test(dryClaim) &&
                       !/prepared with|,\s*prepared|reconstituted/i.test(hit.description);
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
      src: hit.description,
      ds: hit._source
    });
  }

  out.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));

  const cats = [...new Set(out.map((f) => f.cat))];
  const noPortion = out.filter((f) => !f.p.length);

  const body = out.map((f) =>
    '  [' + f.id + ',' + JSON.stringify(f.name) + ',' + JSON.stringify(f.cat) + ',' +
    JSON.stringify(f.n) + ',' + JSON.stringify(f.p.map((x) => [x.label, x.g])) + ',' +
    JSON.stringify(f.src) + ',' + JSON.stringify(f.ds) + ']'
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
      /* Which USDA dataset the numbers came from. SR Legacy is analysed whole
       * foods; FNDDS is the "as consumed" survey database, which is where the
       * composite dishes live. Shown in search results so the difference is
       * visible rather than blended away. */
      dataType: row[6] === 'fndds' ? 'FNDDS' : 'SR Legacy',
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
  console.log('foods: ' + out.length + ' / ' + ALL_WANTED.length + ' requested' +
    '  (SR Legacy ' + out.filter((f) => f.ds === 'sr').length +
    ', FNDDS ' + out.filter((f) => f.ds === 'fndds').length + ')');
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
