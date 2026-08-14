/*
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
 * banana without a round trip is not usable. These 149 foods work with no
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

  var CATEGORIES = ["Beans & nuts","Dairy","Drinks","Extras","Fish","Fruit","Grains","Meat","Prepared","Snacks","Vegetable"];

  var ROWS = [
  [170567,"Almonds","Beans & nuts",[579,21.2,1,733,481],[["cup, whole",143],["cup, slivered",108],["cup, ground",95]],"Nuts, almonds"],
  [175182,"Baked beans, canned","Beans & nuts",[94,4.75,343,224,74],[["cup",254]],"Beans, baked, canned, plain or vegetarian"],
  [173735,"Black beans, cooked","Beans & nuts",[132,8.86,1,355,140],[["cup",172]],"Beans, black, mature seeds, cooked, boiled, without salt"],
  [169421,"Cashews","Beans & nuts",[574,15.3,640,565,490],[["cup, halves and whole",137],["oz",28]],"Nuts, cashew nuts, dry roasted, with salt added"],
  [174289,"Hummus","Beans & nuts",[237,7.78,426,312,181],[["cup",246],["tbsp",15]],"Hummus, commercial"],
  [173741,"Kidney beans, canned","Beans & nuts",[84,5.22,296,237,90],[["cup",256]],"Beans, kidney, all types, mature seeds, canned"],
  [172421,"Lentils, cooked","Beans & nuts",[116,9.02,2,369,180],[["cup",198],["tbsp",12]],"Lentils, mature seeds, cooked, boiled, without salt"],
  [174265,"Peanut butter, chunky","Beans & nuts",[589,24.1,486,745,319],[["2 tbsp",32],["cup",258]],"Peanut butter, chunk style, with salt"],
  [174262,"Peanuts, roasted","Beans & nuts",[587,24.4,410,634,363],[["oz",28]],"Peanuts, all types, dry-roasted, with salt"],
  [175200,"Pinto beans, cooked","Beans & nuts",[143,9.01,1,436,147],[["cup",171],["tbsp",11]],"Beans, pinto, mature seeds, cooked, boiled, without salt"],
  [172475,"Tofu, firm","Beans & nuts",[144,17.3,14,237,190],[["0.5 cup",126]],"Tofu, raw, firm, prepared with calcium sulfate"],
  [170187,"Walnuts","Beans & nuts",[654,15.2,2,441,346],[["cup, ground",80],["cup, chopped",117],["cup, in shell, edible yield (7 nuts)",28]],"Nuts, walnuts, english"],
  [170853,"American cheese","Dairy",[366,18.1,1670,132,641],[["cup, shredded",113],["slice (1 oz)",28],["cup, diced",140]],"Cheese, pasteurized process, American, fortified with vitamin D"],
  [173410,"Butter, salted","Dairy",[717,0.85,643,24,24],[["cup",227],["tbsp",14]],"Butter, salted"],
  [170899,"Cheddar cheese, sliced","Dairy",[410,24.2,644,76,460],[["slice (1 oz)",28],["slice (3/4 oz)",21],["slice (2/3 oz)",19]],"Cheese, cheddar, sharp, sliced"],
  [172179,"Cottage cheese","Dairy",[98,11.1,315,104,159],[["4 oz",113],["cup, large curd (not packed)",210],["cup, small curd (not packed)",225]],"Cheese, cottage, creamed, large or small curd"],
  [173418,"Cream cheese","Dairy",[350,6.15,314,132,107],[["cup",232],["tbsp, whipped",10],["tbsp",15]],"Cheese, cream"],
  [173424,"Egg, hard-boiled","Dairy",[155,12.6,124,126,172],[["cup, chopped",136],["large",50],["tbsp",9]],"Egg, whole, cooked, hard-boiled"],
  [172187,"Egg, scrambled","Dairy",[149,9.99,145,132,165],[["cup",220],["large",61],["tbsp",14]],"Egg, whole, cooked, scrambled"],
  [171304,"Greek yogurt, plain","Dairy",[97,9,35,141,135],[],"Yogurt, Greek, plain, whole milk"],
  [167575,"Ice cream, vanilla","Dairy",[207,3.5,80,199,105],[["serving 1/2 cup",66]],"Ice creams, vanilla"],
  [170845,"Mozzarella cheese","Dairy",[299,22.2,486,76,354],[["cup, shredded",112],["6 slices",170],["oz",28]],"Cheese, mozzarella, whole milk"],
  [171269,"Skim milk","Dairy",[34,3.37,42,156,101],[["cup",245],["fl oz",31]],"Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)"],
  [171257,"Sour cream","Dairy",[198,2.44,31,125,76],[["cup",230],["tbsp",12]],"Cream, sour, cultured"],
  [172217,"Whole milk","Dairy",[61,3.15,43,132,84],[["cup",244],["fl oz",31],["tbsp",15]],"Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D"],
  [171284,"Yogurt, plain whole milk","Dairy",[61,3.47,46,155,95],[["container (8 oz)",227],["container (6 oz)",170],["0.5 container (4 oz)",113]],"Yogurt, plain, whole milk"],
  [173933,"Apple juice","Drinks",[46,0.1,4,101,7],[["cup",248],["drink box (8.45 fl oz)",262],["fl oz",31]],"Apple juice, canned or bottled, unsweetened, without added ascorbic acid"],
  [168746,"Beer, regular","Drinks",[43,0.46,4,27,14],[["can",356],["fl oz",30]],"Alcoholic beverage, beer, regular, all"],
  [171890,"Coffee, brewed","Drinks",[1,0.12,2,49,3],[["cup (8 fl oz)",237],["6 fl oz",178],["fl oz",30]],"Beverages, coffee, brewed, prepared with tap water"],
  [174852,"Cola","Drinks",[42,0,3,5,9],[["drink, small (16 fl oz)",492],["can or bottle (12 fl oz)",370],["drink, medium (22 fl oz)",676]],"Beverages, carbonated, cola, regular"],
  [171903,"Cranberry juice cocktail","Drinks",[54,0,2,14,1],[["cup (8 fl oz)",253],["fl oz",32]],"Cranberry juice cocktail, bottled"],
  [174846,"Ginger ale","Drinks",[34,0,7,1,0],[["can or bottle (12 fl oz)",366],["can or bottle (16 fl oz)",488],["fl oz",31]],"Beverages, carbonated, ginger ale"],
  [173042,"Grape juice","Drinks",[60,0.37,5,104,14],[["cup",253],["fl oz",32]],"Grape juice, canned or bottled, unsweetened, without added ascorbic acid"],
  [173205,"Lemon-lime soda","Drinks",[41,0.09,10,1,0],[["drink, medium (22 fl oz)",675],["drink, small (16 fl oz)",491],["drink (12 fl oz)",368]],"Beverages, carbonated, lemon-lime soda, no caffeine"],
  [174859,"Lemonade, from powder","Drinks",[14,0,6,6,0],[["cup 8 fl oz",264],["fl oz",33]],"Lemonade, powder, prepared with water"],
  [169098,"Orange juice","Drinks",[45,0.7,1,200,17],[["cup",248],["fl oz",31]],"Orange juice, raw (Includes foods for USDA's Food Distribution Program)"],
  [173227,"Tea, brewed","Drinks",[1,0,3,37,1],[["6 fl oz",178],["cup (8 fl oz)",237],["fl oz",30]],"Beverages, tea, black, brewed, prepared with tap water"],
  [171565,"Brown gravy mix, dry","Extras",[367,10.7,4840,262,203],[["tbsp",6]],"Gravy, brown, dry"],
  [169640,"Honey","Extras",[304,0.3,4,52,4],[["cup",339],["packet (0.5 oz)",14],["tbsp",21]],"Honey"],
  [168556,"Ketchup","Extras",[101,1.04,907,281,26],[["cup",240],["tbsp",17]],"Catsup"],
  [169661,"Maple syrup","Extras",[260,0.04,12,212,2],[["cup",315],["serving 1/4 cup",83],["tbsp",20]],"Syrups, maple"],
  [172346,"Margarine","Extras",[717,0.16,751,18,5],[["cup",227],["tbsp",14],["tsp",5]],"Margarine, regular, 80% fat, composite, stick, with salt"],
  [171009,"Mayonnaise","Extras",[680,0.96,635,20,21],[["cup",220],["tbsp",14]],"Salad dressing, mayonnaise, regular"],
  [172234,"Mustard","Extras",[60,3.74,1100,152,108],[["cup",249],["tsp or 1 packet",5]],"Mustard, prepared, yellow"],
  [171413,"Olive oil","Extras",[884,0,2,1,0],[["cup",216],["tablespoon",14],["tsp",5]],"Oil, olive, salad or cooking"],
  [173592,"Ranch dressing","Extras",[430,1.32,901,64,186],[["serving",30],["tablespoon",15]],"Salad dressing, ranch dressing, regular"],
  [174277,"Soy sauce","Extras",[53,8.14,5490,435,166],[["cup",255],["tbsp",16],["tsp",5]],"Soy sauce made from soy and wheat (shoyu)"],
  [169655,"Sugar, white","Extras",[387,0,1,2,0],[["cup",200],["tsp",4]],"Sugars, granulated"],
  [173468,"Table salt","Extras",[0,0,38800,8,0],[["cup",292],["tsp",6],["tbsp",18]],"Salt, table"],
  [175166,"Catfish, cooked","Fish",[144,18.4,119,366,247],[["3 oz",85]],"Fish, catfish, channel, farmed, cooked, dry heat"],
  [171956,"Cod, cooked","Fish",[105,22.8,78,244,138],[["3 oz",85]],"Fish, cod, Atlantic, cooked, dry heat"],
  [175168,"Salmon, cooked","Fish",[206,22.1,61,384,252],[["3 oz",85]],"Fish, salmon, Atlantic, farmed, cooked, dry heat"],
  [171971,"Shrimp, cooked","Fish",[119,22.8,947,170,306],[["3 oz",85],["4 large",22]],"Crustaceans, shrimp, mixed species, cooked, moist heat (may contain additives to retain moisture)"],
  [175177,"Tilapia, cooked","Fish",[128,26.2,56,380,204],[],"Fish, tilapia, cooked, dry heat"],
  [173709,"Tuna, canned in water","Fish",[86,19.4,247,179,139],[["3 oz",85],["can",165],["can (12.5 oz), drained",315]],"Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)"],
  [171688,"Apple, with skin","Fruit",[52,0.26,1,107,11],[["cup slices",109],["medium (3\" dia)",182],["small (2-3/4\" dia)",149]],"Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)"],
  [171695,"Applesauce, unsweetened","Fruit",[42,0.17,2,74,5],[["cup",244]],"Applesauce, canned, unsweetened, without added ascorbic acid (Includes foods for USDA's Food Distribution Program)"],
  [171705,"Avocado","Fruit",[160,2,7,485,52],[["cup, pureed",230],["cup, cubes",150],["cup, sliced",146]],"Avocados, raw, all commercial varieties"],
  [173944,"Banana","Fruit",[89,1.09,1,358,22],[["extra large (9\" or longer)",152],["large (8\" to 8-7/8\" long)",136],["cup, sliced",150]],"Bananas, raw"],
  [171711,"Blueberries","Fruit",[57,0.74,1,77,12],[["cup",148]],"Blueberries, raw"],
  [169092,"Cantaloupe","Fruit",[34,0.84,16,267,15],[["melon, small (about 4-1/4\" dia)",441],["wedge, large (1/8 of large melon)",102],["wedge, medium (1/8 of medium melon)",69]],"Melons, cantaloupe, raw"],
  [171719,"Cherries, sweet","Fruit",[63,1.06,0,222,21],[["cup, without pits",154],["label serving",140]],"Cherries, sweet, raw"],
  [171723,"Cranberries, dried sweetened","Fruit",[308,0.17,5,49,8],[["0.25 cup",40]],"Cranberries, dried, sweetened (Includes foods for USDA's Food Distribution Program)"],
  [168191,"Dates","Fruit",[277,1.81,1,696,62],[],"Dates, medjool"],
  [174668,"Fruit cocktail, canned in juice","Fruit",[46,0.46,4,95,14],[["cup",237]],"Fruit cocktail, (peach and pineapple and pear and grape and cherry), canned, juice pack, solids and liquids"],
  [174683,"Grapes, red or green","Fruit",[69,0.72,2,191,20],[["cup",151],["label serving",126]],"Grapes, red or green (European type, such as Thompson seedless), raw"],
  [168153,"Kiwi","Fruit",[61,1.14,3,312,34],[["cup, sliced",180],["label serving",148]],"Kiwifruit, green, raw"],
  [167746,"Lemon","Fruit",[29,1.1,2,138,16],[["cup, sections",212],["wedge or slice (1/8 of one 2-1/8\" dia lemon)",7],["label serving",58]],"Lemons, raw, without peel"],
  [169910,"Mango","Fruit",[60,0.82,1,168,14],[["cup pieces",165]],"Mangos, raw"],
  [169097,"Orange","Fruit",[47,0.94,0,181,14],[["small (2-3/8\" dia)",96],["large (3-1/16\" dia)",184],["cup, sections",180]],"Oranges, raw, all commercial varieties"],
  [169928,"Peach","Fruit",[39,0.91,0,190,20],[["small (2-1/2\" dia)",130],["large (2-3/4\" dia)",175],["medium (2-2/3\" dia)",150]],"Peaches, yellow, raw"],
  [169118,"Pear","Fruit",[57,0.36,1,116,12],[["medium",178],["large",230],["cup, cubes",161]],"Pears, raw"],
  [169124,"Pineapple","Fruit",[50,0.54,1,109,8],[["slice, thin (3-1/2\" dia x 1/2\" thick)",56],["slice (4-2/3\" dia x 3/4\" thick)",166],["cup, chunks",165]],"Pineapple, raw, all varieties"],
  [169949,"Plum","Fruit",[46,0.7,0,157,16],[["cup, sliced",165],["label serving",151]],"Plums, raw"],
  [168162,"Prunes, dried","Fruit",[240,2.18,2,732,69],[["cup, pitted",174]],"Plums, dried (prunes), uncooked"],
  [168164,"Raisins","Fruit",[301,3.28,24,746,101],[["cup (not packed)",145],["cup, packed",165]],"Raisins, golden, seedless"],
  [167755,"Raspberries","Fruit",[52,1.2,1,151,29],[["cup",123]],"Raspberries, raw"],
  [167762,"Strawberries","Fruit",[32,0.67,1,153,24],[["cup, pureed",232],["large (1-3/8\" dia)",18],["cup, sliced",166]],"Strawberries, raw"],
  [167765,"Watermelon","Fruit",[30,0.61,1,112,11],[["cup, diced",152],["cup, balls",154],["label serving",280]],"Watermelon, raw"],
  [174899,"Bagel, plain","Grains",[264,10.6,422,107,99],[["medium bagel (3-1/2\" to 4\" dia)",105],["large bagel (4-1/2\")",131],["small bagel (3\" dia)",69]],"Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)"],
  [169704,"Brown rice, cooked","Grains",[123,2.74,4,86,103],[["cup",202]],"Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)"],
  [174648,"Corn flakes cereal","Grains",[384,5.9,571,107,33],[["cup (1 serving)",28]],"Cereals ready-to-eat, RALSTON Corn Flakes"],
  [175036,"Corn tortilla","Grains",[218,5.7,45,186,314],[["oz",28]],"Tortillas, ready-to-bake or -fry, corn"],
  [172761,"English muffin","Grains",[223,8.7,353,186,107],[["oz",28]],"Muffins, English, wheat"],
  [167535,"Flour tortilla","Grains",[297,8.01,742,133,213],[],"Tortillas, ready-to-bake or -fry, flour, shelf stable"],
  [171655,"Grits, cooked","Grains",[71,1.71,2,27,20],[["cup",257],["tbsp",16]],"Cereals, corn grits, white, regular and quick, enriched, cooked with water, without salt"],
  [172796,"Hamburger or hot dog bun","Grains",[279,9.77,494,122,101],[["roll 1 serving",44],["oz",28]],"Rolls, hamburger or hotdog, plain"],
  [173905,"Oatmeal, cooked","Grains",[71,2.54,4,70,77],[["cup",234],["0.75 cup",175],["tbsp",15]],"Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt"],
  [175009,"Pancakes","Grains",[227,6.4,439,132,159],[["oz",28]],"Pancakes, plain, prepared from recipe"],
  [172746,"Saltine crackers","Grains",[418,9.46,941,152,102],[["cup oyster crackers",45],["cup, crushed",70],["cracker, round large",10]],"Crackers, saltines (includes oyster, soda, soup)"],
  [169737,"Spaghetti, cooked","Grains",[158,5.8,1,44,58],[["cup lasagne",116],["cup shells",105],["cup farfalle",107]],"Pasta, cooked, enriched, without added salt"],
  [174924,"White bread","Grains",[266,8.85,490,126,98],[["slice",29],["slice crust not eaten",12],["cup, cubes",35]],"Bread, white, commercially prepared (includes soft bread crumbs)"],
  [168878,"White rice, cooked","Grains",[130,2.69,1,35,43],[["cup",158]],"Rice, white, long-grain, regular, enriched, cooked"],
  [172688,"Whole wheat bread","Grains",[252,12.4,455,254,212],[["slice",32],["oz",28]],"Bread, whole-wheat, commercially prepared"],
  [167914,"Bacon, cooked","Meat",[548,35.7,2190,539,506],[["slice cooked",8],["3 oz",85]],"Pork, cured, bacon, cooked, baked"],
  [168632,"Beef steak, cooked","Meat",[202,29.5,61,376,275],[["3 oz",85]],"Beef, loin, top loin steak, boneless, lip off, separable lean only, trimmed to 0\" fat, all grades, cooked, grilled"],
  [172012,"Bologna","Meat",[299,10.9,1010,351,154],[["slice",30],["serving",28]],"Bologna, beef"],
  [171477,"Chicken breast, roasted","Meat",[165,31,74,256,228],[["cup, chopped or diced",140]],"Chicken, broilers or fryers, breast, meat only, cooked, roasted"],
  [172388,"Chicken thigh, roasted","Meat",[179,24.8,106,269,230],[["3 oz",85]],"Chicken, broilers or fryers, thigh, meat only, cooked, roasted"],
  [174033,"Ground beef, cooked","Meat",[232,24.6,79,349,211],[["3 oz",85],["patty (yield from 1/4 lb raw meat )",83]],"Beef, ground, 85% lean meat / 15% fat, patty, cooked, pan-broiled"],
  [173864,"Ham, sliced","Meat",[164,16.6,814,287,153],[["slice",28],["56 grams 1 serving",56]],"Ham, sliced, regular (approximately 11% fat)"],
  [173862,"Hot dog, beef","Meat",[315,11.7,865,364,134],[],"Frankfurter, beef, unheated"],
  [168304,"Pork chop, cooked","Meat",[216,29.5,65,420,245],[["3 oz",85]],"Pork, fresh, loin, center rib (chops), boneless, separable lean only, cooked, broiled"],
  [174578,"Pork sausage, cooked","Meat",[325,18.5,814,342,149],[["patty",27],["link",23],["serving",48]],"Pork sausage, link/patty, cooked, pan-fried"],
  [171496,"Turkey breast, roasted","Meat",[147,30.1,99,249,230],[["3 oz",85]],"Turkey, whole, breast, meat only, cooked, roasted"],
  [172041,"Cheese pizza, pan crust","Prepared",[280,11.7,624,168,241],[["slice",100]],"PIZZA HUT 12\" Cheese Pizza, Pan Crust"],
  [170320,"Cheeseburger, fast food","Prepared",[263,13,626,200,140],[["item 4 oz",119]],"McDONALD'S, Cheeseburger"],
  [171543,"Chicken noodle soup, canned","Prepared",[48,2.37,681,48,38],[["0.5 cup",124]],"Soup, chicken noodle, canned, condensed"],
  [175207,"Chili with beans, canned","Prepared",[103,6.12,423,365,154],[["cup",256],["tbsp",16]],"Chili with beans, canned"],
  [173325,"Macaroni and cheese, canned","Prepared",[82,3.38,302,84,47],[["serving",244]],"Macaroni and Cheese, canned entree"],
  [172882,"Tomato soup, canned","Prepared",[66,1.46,377,562,31],[["can",294],["cup",148]],"Soup, tomato, canned, condensed"],
  [175160,"Tuna salad","Prepared",[187,16,402,178,178],[["3 oz",85],["cup",205]],"Fish, tuna salad"],
  [172694,"Angel food cake","Snacks",[258,5.9,749,93,324],[["piece (1/12 of 12 oz cake)",28]],"Cake, angelfood, commercially prepared"],
  [175011,"Apple pie","Snacks",[237,1.9,201,65,24],[["piece (1/8 of 9\" dia)",125],["piece (1/6 of 8\" pie)",117],["oz",28]],"Pie, apple, commercially prepared, enriched flour"],
  [172716,"Chocolate chip cookies","Snacks",[492,5.1,311,171,109],[["cookie, large (include Keebler Rich 'n Chips, Pecan Chips Delux)",14],["cookie, medium (2-1/4\" dia)",10],["cookie Pepperidge Farm Chocolate Chunk Pecan",12]],"Cookies, chocolate chip, commercially prepared, regular, higher fat, enriched"],
  [169596,"Gelatin dessert","Snacks",[60,1.22,75,1,22],[["0.5 cup",135],["serving",21]],"Gelatin desserts, dry mix, prepared with water"],
  [174083,"Graham crackers","Snacks",[386,5.71,629,171,163],[["serving",35]],"Cookies, graham crackers, plain or honey, lowfat"],
  [167990,"Hard candy","Snacks",[394,0,38,5,3],[["piece, small",3],["piece",6],["oz",28]],"Candies, hard"],
  [167995,"Marshmallows","Snacks",[318,1.8,80,5,8],[["cup of miniature",50]],"Candies, marshmallows"],
  [167587,"Milk chocolate","Snacks",[535,7.65,79,372,208],[["cup chips",168],["bar (1.55 oz)",44]],"Candies, milk chocolate"],
  [167959,"Popcorn, air-popped","Snacks",[387,12.9,8,329,358],[["cup",8],["oz",28]],"Snacks, popcorn, air-popped"],
  [169677,"Potato chips","Snacks",[532,6.39,527,1200,153],[["bag (8 oz)",227],["oz",28]],"Snacks, potato chips, plain, salted"],
  [167555,"Pretzels","Snacks",[384,10,1240,223,128],[["oz",28]],"Snacks, pretzels, hard, plain, salted"],
  [167577,"Sherbet, orange","Snacks",[144,1.1,46,96,40],[["bar (2.75 fl oz)",66],["0.5 cup (4 fl oz)",74]],"Sherbet, orange"],
  [167558,"Tortilla chips","Snacks",[472,7.1,328,182,225],[["oz",28]],"Snacks, tortilla chips, plain, white corn, salted"],
  [174973,"Vanilla wafers","Snacks",[441,5,388,97,104],[["medium",4],["small",3],["cup, crumbs",80]],"Cookies, vanilla wafers, lower fat"],
  [170427,"Bell pepper, green","Vegetable",[20,0.86,3,175,20],[["cup, chopped",149],["cup, sliced",92],["large (2-1/4 per lb, approx 3-3/4\" long, 3\" dia)",164]],"Peppers, sweet, green, raw"],
  [169967,"Broccoli, cooked","Vegetable",[35,2.38,41,293,67],[["stalk, large (11\"-12\" long)",280],["0.5 cup, chopped",78],["stalk, medium (7-1/2\" - 8\" long)",180]],"Broccoli, cooked, boiled, drained, without salt"],
  [169975,"Cabbage, raw","Vegetable",[25,1.28,18,170,26],[["leaf, large",33],["cup, chopped",89],["cup, shredded",70]],"Cabbage, raw"],
  [170393,"Carrots, raw","Vegetable",[41,0.93,69,320,35],[["cup grated",110],["slice",3],["strip large (3\" long)",7]],"Carrots, raw"],
  [169986,"Cauliflower, raw","Vegetable",[25,1.92,30,299,44],[["head medium (5-6\" dia.)",588],["head small (4\" dia.)",265],["head large (6-7\" dia.)",840]],"Cauliflower, raw"],
  [169988,"Celery, raw","Vegetable",[14,0.69,80,260,24],[["stalk, medium (7-1/2\" - 8\" long)",40],["stalk, small (5\" long)",17],["cup chopped",101]],"Celery, raw"],
  [169214,"Corn, canned","Vegetable",[67,2.29,205,132,46],[["cup",164],["can (303 x 406)",298]],"Corn, sweet, yellow, canned, whole kernel, drained solids"],
  [169999,"Corn, cooked","Vegetable",[96,3.41,1,218,77],[["ear small (5-1/2\" to 6-1/2\" long)",89],["cup cut",149],["ear medium (6-3/4\" to 7-1/2\" long)",103]],"Corn, sweet, yellow, cooked, boiled, drained, without salt"],
  [168409,"Cucumber","Vegetable",[15,0.65,2,147,24],[["0.5 cup slices",52]],"Cucumber, with peel, raw"],
  [168445,"French fries, oven-heated","Vegetable",[148,2.57,373,459,90],[],"Potatoes, french fried, steak fries, salt added in processing, frozen, oven-heated"],
  [169141,"Green beans, cooked","Vegetable",[35,1.89,1,146,29],[["cup",125]],"Beans, snap, green, cooked, boiled, drained, without salt"],
  [169248,"Lettuce, iceberg","Vegetable",[14,0.9,10,141,20],[["cup, chopped (1/2\" pieces, loosely packed)",57],["head, large",755],["head, medium (6\" dia)",539]],"Lettuce, iceberg (includes crisphead types), raw"],
  [170037,"Mashed potatoes","Vegetable",[113,1.96,333,326,48],[["cup",210]],"Potatoes, mashed, home-prepared, whole milk and margarine added"],
  [169251,"Mushrooms, raw","Vegetable",[22,3.09,5,318,86],[["small",10],["cup, pieces or slices",70],["slice",6]],"Mushrooms, white, raw"],
  [170000,"Onion, raw","Vegetable",[40,1.1,4,146,29],[["cup, chopped",160],["slice, medium (1/8\" thick)",14],["medium (2-1/2\" dia)",110]],"Onions, raw"],
  [170420,"Peas, green, cooked","Vegetable",[84,5.36,3,271,117],[["cup",160]],"Peas, green, cooked, boiled, drained, without salt"],
  [170093,"Potato, baked with skin","Vegetable",[93,2.5,10,535,70],[["potato large",299],["potato medium",173],["potato small",138]],"Potatoes, baked, flesh and skin, without salt"],
  [170440,"Potato, boiled without skin","Vegetable",[86,1.71,5,328,40],[["small (1-3/4\" to 2-1/2\" dia.)",125],["large (3\" to 4-1/4\" dia.)",300],["medium (2-1/4\" to 3-1/4\" dia.)",167]],"Potatoes, boiled, cooked without skin, flesh, without salt"],
  [168462,"Spinach, raw","Vegetable",[23,2.86,79,558,49],[["cup",30]],"Spinach, raw"],
  [168483,"Sweet potato, baked","Vegetable",[90,2.01,36,475,54],[["large",180],["small",60],["cup",200]],"Sweet potato, cooked, baked in skin, flesh, without salt"],
  [170054,"Tomato sauce, canned","Vegetable",[24,1.2,474,297,27],[["cup",245]],"Tomato products, canned, sauce"],
  [170457,"Tomato, raw","Vegetable",[18,0.88,5,237,24],[["medium whole (2-3/5\" dia)",123],["slice, medium (1/4\" thick)",20],["large whole (3\" dia)",182]],"Tomatoes, red, ripe, raw, year round average"],
  [169292,"Zucchini, cooked","Vegetable",[15,1.14,3,264,37],[["0.5 cup, mashed",120],["cup, sliced",180]],"Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt"]
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
