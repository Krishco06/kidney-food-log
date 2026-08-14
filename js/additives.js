/*
 * additives.js — curated renal additive dictionary
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Phosphorus is not a mandatory US Nutrition Facts nutrient, so packaged-food
 * databases almost never carry a phosphorus value (~1.45% of USDA Branded
 * Foods records; Picard et al., J Renal Nutr 2023). Potassium only became
 * mandatory with the 2016 rule (compliance 2020-21), so historical branded
 * records mostly lack it too (~5.7% coverage; Picard et al., Semin Dial 2024).
 *
 * We cannot fix missing numbers. What we CAN do is read the ingredient list,
 * which IS always printed, and tell the user which added phosphate and
 * potassium compounds are in the product. That is the honest product.
 *
 * The naive clinical advice is "look for 'PHOS' on the label". That misses the
 * two most common phosphate additives in the US food supply: lecithin (32% of
 * products) and modified starches (10%) — Dunford & Calvo, Am J Clin Nutr 2025,
 * 39,937 products, 56% of which contained a phosphate additive. So this
 * dictionary is deliberately broader than a "phos" substring match.
 *
 * FIELDS
 *   id          stable slug, used as the dedupe key
 *   name        display name, plain language
 *   minerals    which mineral(s) this contributes: 'phosphorus' | 'potassium'
 *   confidence  how sure we are the compound contains that mineral at all:
 *                 'definite' — the mineral is in the chemical name/structure
 *                 'likely'   — usually contains it, but formulation varies
 *                 'possible' — may or may not; the label cannot tell us
 *   load        how much of the mineral it plausibly contributes in normal use:
 *                 'high'     — used in bulk, meaningful mg
 *                 'moderate' — real but smaller contribution
 *                 'low'      — preservative-level, usually trace
 *   organic     true = naturally occurring, protein- or plant-bound phosphorus,
 *               absorbed at roughly 40-60%. Absent/false = inorganic added
 *               phosphate, absorbed at roughly 90-100%.
 *
 *               LOAD AND ORGANIC ARE INDEPENDENT AXES and must not be collapsed
 *               in the UI. Milk protein concentrate is high-load but organic;
 *               potassium sorbate is inorganic but trace-load. Showing "high"
 *               as "absorbed easily" conflates the two and misteaches exactly
 *               the fact this app exists to convey.
 *   generic     true = broad catch-all pattern, only reported when no specific
 *               entry already matched the same text span
 *   note        one-sentence, ~6th-grade-reading-level explanation for the user
 *   patterns    match strings. Spaces become flexible whitespace and the last
 *               word gets an optional plural 's'. See scanner.js.
 *
 * IMPORTANT: `load` is an ESTIMATE OF PLAUSIBILITY, NOT A MILLIGRAM VALUE.
 * Nothing in this file may be rendered to the user as a number of mg. Ingredient
 * lists are ordered by weight but are not quantified, so any mg figure derived
 * from them would be false precision — the exact failure mode this app exists
 * to avoid.
 */

(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- *
   * PHOSPHATE ADDITIVES — inorganic, ~90-100% absorbed
   * (vs ~40-60% for the organic phosphorus naturally in food)
   * ---------------------------------------------------------------- */

  var PHOSPHATE = [
    {
      id: 'phosphoric-acid',
      name: 'Phosphoric acid',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      note: 'The acid in cola drinks. Your body absorbs nearly all of this kind of phosphorus.',
      patterns: ['phosphoric acid', 'e338', 'ins338']
    },
    {
      id: 'sodium-phosphate',
      name: 'Sodium phosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      note: 'Added to processed meat, cheese and drinks. Absorbed almost completely.',
      patterns: [
        'sodium phosphate', 'monosodium phosphate', 'disodium phosphate',
        'trisodium phosphate', 'sodium dihydrogen phosphate',
        'disodium hydrogen phosphate', 'e339', 'ins339'
      ]
    },
    {
      id: 'potassium-phosphate',
      name: 'Potassium phosphate',
      minerals: ['phosphorus', 'potassium'],
      confidence: 'definite',
      load: 'high',
      note: 'Adds BOTH phosphorus and potassium. Common in drinks and processed cheese.',
      patterns: [
        'potassium phosphate', 'monopotassium phosphate', 'dipotassium phosphate',
        'tripotassium phosphate', 'potassium dihydrogen phosphate',
        'dipotassium hydrogen phosphate', 'e340', 'ins340'
      ]
    },
    {
      id: 'calcium-phosphate',
      name: 'Calcium phosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      note: 'Used to fortify or firm up foods, and in baking powder.',
      patterns: [
        'calcium phosphate', 'monocalcium phosphate', 'dicalcium phosphate',
        'tricalcium phosphate', 'calcium hydrogen phosphate', 'e341', 'ins341'
      ]
    },
    {
      id: 'magnesium-phosphate',
      name: 'Magnesium phosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'moderate',
      note: 'Used as an anti-caking agent and mineral source.',
      patterns: ['magnesium phosphate', 'trimagnesium phosphate', 'e343', 'ins343']
    },
    {
      id: 'ammonium-phosphate',
      name: 'Ammonium phosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'moderate',
      note: 'A dough conditioner and yeast food in baked goods.',
      patterns: [
        'ammonium phosphate', 'monoammonium phosphate', 'diammonium phosphate',
        'e342', 'ins342'
      ]
    },
    {
      id: 'iron-phosphate',
      name: 'Iron phosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'low',
      note: 'Used to add iron to cereals and flour. Small amounts.',
      patterns: ['ferric phosphate', 'ferric pyrophosphate', 'iron phosphate', 'ferrous phosphate']
    },
    {
      id: 'sodium-aluminum-phosphate',
      name: 'Sodium aluminum phosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      note: 'A baking powder acid, and used in processed cheese.',
      patterns: [
        'sodium aluminum phosphate', 'sodium aluminium phosphate',
        'aluminum phosphate', 'aluminium phosphate', 'e541', 'ins541'
      ]
    },
    {
      id: 'tripolyphosphate',
      name: 'Sodium tripolyphosphate (STPP)',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      note: 'Holds water in chicken, seafood and ham. A large hidden source of phosphorus.',
      patterns: [
        'sodium tripolyphosphate', 'tripolyphosphate',
        'stpp', 'pentasodium triphosphate', 'e451', 'ins451'
      ]
    },
    {
      id: 'pyrophosphate',
      name: 'Pyrophosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      note: 'Found in baking powder, canned seafood and instant puddings.',
      patterns: [
        'sodium acid pyrophosphate', 'tetrasodium pyrophosphate',
        'disodium pyrophosphate', 'disodium diphosphate',
        'tetrasodium diphosphate', 'trisodium diphosphate',
        'calcium pyrophosphate', 'pyrophosphate', 'diphosphate',
        'sapp', 'tspp', 'e450', 'ins450'
      ]
    },
    {
      id: 'polyphosphate',
      name: 'Polyphosphate / hexametaphosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      note: 'Keeps meat and drinks moist and smooth. Absorbed almost completely.',
      patterns: [
        'sodium hexametaphosphate', 'sodium polyphosphate',
        'hexametaphosphate', 'polyphosphate', 'metaphosphate', 'shmp',
        'e452', 'ins452'
      ]
    },
    {
      /*
       * Potassium-bearing polyphosphates get their own entry because they load
       * BOTH minerals. Filing them under the phosphorus-only entries (where they
       * started) silently dropped their potassium — the exact failure this app
       * exists to prevent. Common in European-style deli meat, where
       * "tetrapotassium diphosphate" is a standard stabiliser.
       */
      id: 'potassium-polyphosphate',
      name: 'Potassium polyphosphate / pyrophosphate',
      minerals: ['phosphorus', 'potassium'],
      confidence: 'definite',
      load: 'high',
      note: 'Adds BOTH phosphorus and potassium. Used to hold water in meat and seafood.',
      patterns: [
        'tetrapotassium pyrophosphate', 'tetrapotassium diphosphate',
        'tripotassium diphosphate', 'potassium pyrophosphate',
        'potassium diphosphate', 'potassium tripolyphosphate',
        'potassium polyphosphate', 'potassium metaphosphate',
        'potassium hexametaphosphate'
      ]
    },
    {
      id: 'phosphated-starch',
      name: 'Phosphated / distarch phosphate starch',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'moderate',
      note: 'A thickener starch that has phosphate built into it.',
      patterns: [
        'phosphated distarch phosphate', 'distarch phosphate', 'monostarch phosphate',
        'hydroxypropyl distarch phosphate', 'starch phosphate',
        'e1410', 'e1412', 'e1413', 'e1414', 'e1442',
        'ins1410', 'ins1412', 'ins1413', 'ins1414', 'ins1442'
      ]
    },
    {
      id: 'lecithin',
      name: 'Lecithin',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'moderate',
      organic: true,
      /*
       * Lecithin is the single most common phosphate additive in the US food
       * supply (32% of products, AJCN 2025) and contains no "phos" in its name,
       * so a naive label scan misses it entirely. But it is NOT equivalent to a
       * sodium phosphate: Picard et al. found products whose only phosphate
       * additive was lecithin had a LOWER median phosphorus content
       * (86 mg/100 g) than additive-free products (145 mg/100 g). Rating this
       * 'high' would cry wolf on chocolate and margarine and cost us the user's
       * trust on the additives that matter.
       */
      note: 'A very common emulsifier that contains phosphorus, but usually less than added phosphates.',
      patterns: [
        'lecithin', 'soy lecithin', 'soya lecithin', 'sunflower lecithin',
        'egg lecithin', 'e322', 'ins322'
      ]
    },
    {
      id: 'phospholipid',
      name: 'Phospholipid',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'moderate',
      organic: true,
      note: 'A fat that contains phosphorus.',
      patterns: ['phosphatidylcholine', 'phospholipid', 'glycerophosphate', 'phosphatide']
    },
    {
      id: 'ribonucleotides',
      name: 'Disodium inosinate / guanylate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'low',
      note: 'Flavor boosters, often next to MSG. They contain phosphorus but in small amounts.',
      patterns: [
        'disodium inosinate', 'disodium guanylate', 'disodium ribonucleotide',
        'calcium inosinate', 'calcium guanylate', 'inosinate', 'guanylate',
        'ribonucleotide', 'e627', 'e631', 'e635', 'ins627', 'ins631', 'ins635'
      ]
    },
    {
      id: 'modified-starch',
      name: 'Modified food starch',
      minerals: ['phosphorus'],
      confidence: 'possible',
      load: 'moderate',
      /*
       * "Modified food starch" is a category, not a compound. Some modifications
       * are phosphate-based (distarch phosphate), most are not (acetylated,
       * oxidized, octenyl succinate). The label almost never says which. This is
       * exactly the kind of item we must show as UNCERTAIN rather than silently
       * counting or silently ignoring.
       */
      note: 'Some kinds of modified starch have phosphate added. The label does not say which kind.',
      patterns: [
        'modified food starch', 'modified corn starch', 'modified cornstarch',
        'modified starch', 'modified tapioca starch', 'modified potato starch',
        'modified wheat starch', 'modified maize starch'
      ]
    },
    {
      id: 'baking-powder',
      name: 'Baking powder',
      minerals: ['phosphorus'],
      confidence: 'likely',
      load: 'moderate',
      note: 'Most baking powder uses a phosphate acid to make food rise.',
      patterns: ['baking powder', 'double acting baking powder']
    },
    {
      id: 'yeast-extract',
      name: 'Yeast extract',
      minerals: ['phosphorus'],
      confidence: 'likely',
      load: 'low',
      organic: true,
      note: 'A savory flavoring that naturally contains phosphorus.',
      patterns: ['yeast extract', 'autolyzed yeast', 'autolysed yeast', 'torula yeast']
    },
    {
      id: 'dairy-protein-concentrate',
      name: 'Concentrated milk protein',
      minerals: ['phosphorus'],
      confidence: 'likely',
      load: 'high',
      organic: true,
      /*
       * Not an additive in the regulatory sense — this is organic, protein-bound
       * phosphorus (~40-60% absorbed). But milk-protein concentrates are a large
       * phosphorus load by weight and turn up in protein bars, shakes and
       * processed cheese, so a renal user needs to see them. Kept separate in
       * the UI from true inorganic additives.
       */
      note: 'Milk proteins are high in phosphorus, though your body absorbs less of it than added phosphates.',
      patterns: [
        'sodium caseinate', 'calcium caseinate', 'potassium caseinate',
        'milk protein concentrate', 'whey protein concentrate',
        'whey protein isolate', 'micellar casein', 'nonfat dry milk',
        'nonfat milk solids', 'milk solids'
      ]
    },
    /* Generic catch-alls. Only reported if nothing more specific matched. */
    {
      id: 'generic-phosphate',
      name: 'Added phosphate',
      minerals: ['phosphorus'],
      confidence: 'definite',
      load: 'high',
      generic: true,
      note: 'An added phosphate. Your body absorbs this kind of phosphorus almost completely.',
      patterns: ['phosphate', 'phosphoric']
    }
  ];

  /* ---------------------------------------------------------------- *
   * POTASSIUM ADDITIVES
   *
   * The newer, growing problem. As manufacturers cut sodium they replace it
   * with potassium salts: reduced-sodium meat and poultry averaged 44% more
   * potassium (+184 mg/100 g) than the regular versions, with potassium
   * additives on 63% of sodium-reduced vs 26% of non-reduced products
   * (Parpia et al., J Acad Nutr Diet 2018). FDA now also permits "potassium
   * salt" as an alternate name for potassium chloride, which hides it further.
   * ---------------------------------------------------------------- */

  var POTASSIUM = [
    {
      id: 'potassium-chloride',
      name: 'Potassium chloride ("potassium salt")',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'high',
      note: 'Salt substitute used in low-sodium foods. It can add a lot of potassium.',
      patterns: [
        'potassium chloride', 'potassium salt', 'kcl', 'e508', 'ins508'
      ]
    },
    {
      id: 'potassium-lactate',
      name: 'Potassium lactate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'high',
      note: 'Used in large amounts in deli meats and packaged meat to keep them fresh.',
      patterns: ['potassium lactate', 'e326', 'ins326']
    },
    {
      id: 'potassium-citrate',
      name: 'Potassium citrate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'high',
      note: 'Used in drinks and low-sodium foods.',
      patterns: [
        'potassium citrate', 'monopotassium citrate', 'tripotassium citrate',
        'e332', 'ins332'
      ]
    },
    {
      id: 'potassium-acetate',
      name: 'Potassium acetate / diacetate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      note: 'A preservative in packaged meats.',
      patterns: ['potassium acetate', 'potassium diacetate', 'e261', 'ins261']
    },
    {
      id: 'potassium-carbonate',
      name: 'Potassium carbonate / bicarbonate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      note: 'Used in cocoa, noodles and some drinks.',
      patterns: [
        'potassium carbonate', 'potassium bicarbonate', 'e501', 'ins501'
      ]
    },
    {
      id: 'potassium-hydroxide',
      name: 'Potassium hydroxide',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      note: 'Used to adjust how acidic a food is.',
      patterns: ['potassium hydroxide', 'e525', 'ins525']
    },
    {
      id: 'potassium-gluconate',
      name: 'Potassium gluconate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      note: 'A potassium source in supplements and drinks.',
      patterns: ['potassium gluconate', 'e577', 'ins577']
    },
    {
      id: 'potassium-bitartrate',
      name: 'Cream of tartar (potassium bitartrate)',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      note: 'A baking ingredient that contains potassium.',
      patterns: ['potassium bitartrate', 'potassium acid tartrate', 'cream of tartar', 'e336', 'ins336']
    },
    {
      id: 'potassium-sulfate',
      name: 'Potassium sulfate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      note: 'Used in some drinks and salt substitutes.',
      patterns: ['potassium sulfate', 'potassium sulphate', 'e515', 'ins515']
    },
    {
      id: 'potassium-alginate',
      name: 'Potassium alginate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      note: 'A thickener made from seaweed.',
      patterns: ['potassium alginate', 'e402', 'ins402']
    },
    {
      id: 'potassium-nitrate',
      name: 'Potassium nitrate / nitrite',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'low',
      note: 'A curing salt in bacon, ham and hot dogs. Usually small amounts.',
      patterns: [
        'potassium nitrate', 'potassium nitrite', 'saltpeter', 'saltpetre',
        'e249', 'e252', 'ins249', 'ins252'
      ]
    },
    {
      id: 'potassium-sorbate',
      name: 'Potassium sorbate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'low',
      note: 'A very common mold preservative. Usually only a trace of potassium.',
      patterns: ['potassium sorbate', 'e202', 'ins202']
    },
    {
      id: 'potassium-benzoate',
      name: 'Potassium benzoate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'low',
      note: 'A preservative in drinks. Usually only a trace of potassium.',
      patterns: ['potassium benzoate', 'e212', 'ins212']
    },
    {
      id: 'potassium-metabisulfite',
      name: 'Potassium metabisulfite',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'low',
      note: 'A preservative in wine and dried fruit. Usually a trace.',
      patterns: [
        'potassium metabisulfite', 'potassium metabisulphite', 'potassium bisulfite',
        'e224', 'ins224'
      ]
    },
    {
      id: 'potassium-iodide',
      name: 'Potassium iodide / iodate',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'low',
      note: 'How iodine is added to salt and bread. A trace only.',
      patterns: ['potassium iodide', 'potassium iodate', 'e917', 'ins917']
    },
    {
      id: 'salt-substitute',
      name: 'Salt substitute',
      minerals: ['potassium'],
      confidence: 'likely',
      load: 'high',
      note: 'Salt substitutes are usually made of potassium. Ask your care team before using them.',
      patterns: ['salt substitute', 'lite salt', 'light salt', 'low sodium sea salt', 'no salt seasoning']
    },
    /* Generic catch-all. Only reported if nothing more specific matched. */
    {
      id: 'generic-potassium',
      name: 'Added potassium',
      minerals: ['potassium'],
      confidence: 'definite',
      load: 'moderate',
      generic: true,
      note: 'A potassium compound was added to this food.',
      patterns: ['potassium']
    }
  ];

  var ALL = PHOSPHATE.concat(POTASSIUM);

  var api = {
    all: ALL,
    phosphate: PHOSPHATE,
    potassium: POTASSIUM,
    byId: ALL.reduce(function (m, a) { m[a.id] = a; return m; }, {}),
    /* Bump when patterns change so cached scan results can be invalidated. */
    version: 1
  };

  root.RenalAdditives = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
