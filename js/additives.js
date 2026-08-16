/*
 * additives.js — curated renal additive dictionary
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Phosphorus is not a mandatory US Nutrition Facts nutrient, so packaged-food
 * databases almost never carry a phosphorus value (~1.45% of USDA Branded
 * Foods records; Picard et al., J Renal Nutr 2023;33(3):443-449). Potassium
 * only became mandatory with the 2016 rule (compliance 2020-21), so historical
 * branded records mostly lack it too (~5.7% coverage; Picard et al., Semin Dial
 * 2024;37:307-316).
 *
 * We cannot fix missing numbers. What we CAN do is read the ingredient list,
 * which IS always printed, and tell the user which added phosphate and
 * potassium compounds are in the product. That is the honest product.
 *
 * The naive clinical advice is "look for 'PHOS' on the label". That misses the
 * two most common phosphate additives in the US food supply: lecithin (32% of
 * products) and modified starches (10%) — Dunford & Calvo, Am J Clin Nutr
 * 2025;121:873-881, 39,937 products, 56% of which contained a phosphate
 * additive. So this dictionary is deliberately broader than a "phos" match.
 *
 * FIELDS
 *   id          stable slug, used as the dedupe key
 *   name        display name, plain language
 *   minerals    which mineral(s) this contributes: 'phosphorus' | 'potassium'.
 *               An EMPTY array is meaningful — see NON-PHOSPHATE STARCHES.
 *   klass       what kind of thing this is, for grouping and for the caller:
 *                 'inorganic-phosphate'  added phosphate salt, ~90-100% absorbed
 *                 'organic-phosphorus'   phosphorus bound in an organic molecule
 *                 'phosphated-starch'    starch cross-linked with phosphate
 *                 'non-phosphate-starch' a modified starch with NO added P
 *                 'material-potassium'   potassium salt used in bulk
 *                 'trivial-potassium'    potassium salt used at trace levels
 *                 'process-indicator'    label phrase implying an unlisted additive
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
 *   eNumber     E/INS number where one exists, for cross-referencing
 *   cas         CAS registry number, where the compound is a single substance
 *   cfr         21 CFR citation (GRAS / affirmed-GRAS listing)
 *   elemental   percent of the compound that is the mineral, by mass. Exact
 *               stoichiometry from the molecular formula. THIS IS NOT A DOSE:
 *               see the warning below.
 *   note        one-sentence, ~6th-grade-reading-level explanation for the user
 *   patterns    match strings. Spaces become flexible whitespace and the last
 *               word gets an optional plural 's'. See scanner.js.
 *
 * IMPORTANT: `load` is an ESTIMATE OF PLAUSIBILITY, NOT A MILLIGRAM VALUE, and
 * `elemental` is the mineral fraction OF THE COMPOUND, not of the food.
 * Manufacturers need not disclose how much additive they used, and ingredient
 * lists are ordered by weight but not quantified, so any mg figure derived from
 * them would be false precision — the exact failure mode this app exists to
 * avoid. Nothing in this file may be rendered to the user as a number of mg.
 *
 * ORDERING MATTERS. scanner.js resolves overlaps longest-match-first, so
 * "sodium acid pyrophosphate" wins over "pyrophosphate" wins over "phosphate".
 * The generic catch-alls at the end of each section exist to cover compounds
 * this dictionary has not enumerated, and are suppressed wherever a specific
 * entry already claimed the same span.
 */

(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- *
   * GROUP A — INORGANIC PHOSPHATE SALTS
   *
   * Absorbed at roughly 90-100%, against roughly 40-60% for the organic
   * phosphorus naturally present in animal foods and 20-50% for plant
   * phytate. This is the group that matters most clinically, and the one
   * the recall target is set against.
   * ---------------------------------------------------------------- */

  var PHOSPHATE = [
    {
      id: 'phosphoric-acid',
      name: 'Phosphoric acid',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E338', cas: '7664-38-2', cfr: '21 CFR 182.1073', elemental: 31.6,
      note: 'The acid in cola drinks. Your body absorbs nearly all of this kind of phosphorus.',
      patterns: ['phosphoric acid', 'orthophosphoric acid', 'e338', 'ins338']
    },

    /* --- sodium orthophosphates, specific before generic --- */
    {
      id: 'monosodium-phosphate',
      name: 'Monosodium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E339(i)', cas: '7558-80-7', cfr: '21 CFR 182.1778', elemental: 25.8,
      note: 'A buffer in processed cheese and meat. Absorbed almost completely.',
      patterns: [
        'monosodium phosphate', 'sodium phosphate monobasic',
        'sodium dihydrogen phosphate', 'e339i'
      ]
    },
    {
      id: 'disodium-phosphate',
      name: 'Disodium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E339(ii)', cas: '7558-79-4', cfr: '21 CFR 182.1778', elemental: 21.8,
      note: 'Melts processed cheese and thickens instant pudding. Absorbed almost completely.',
      patterns: [
        'disodium phosphate', 'sodium phosphate dibasic',
        'disodium hydrogen phosphate', 'e339ii'
      ]
    },
    {
      id: 'trisodium-phosphate',
      name: 'Trisodium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E339(iii)', cas: '7601-54-9', cfr: '21 CFR 182.1778', elemental: 18.9,
      note: 'Used in cereals and processed cheese. Absorbed almost completely.',
      patterns: ['trisodium phosphate', 'sodium phosphate tribasic', 'e339iii']
    },
    {
      id: 'sodium-phosphate',
      name: 'Sodium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      generic: true,
      eNumber: 'E339', cfr: '21 CFR 182.1778',
      note: 'Added to processed meat, cheese and drinks. Absorbed almost completely.',
      patterns: ['sodium phosphate', 'e339', 'ins339']
    },

    /* --- condensed sodium phosphates: the moisture-retention family --- */
    {
      id: 'sodium-tripolyphosphate',
      name: 'Sodium tripolyphosphate (STPP)',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E451(i)', cas: '7758-29-4', cfr: '21 CFR 182.1810', elemental: 25.3,
      note: 'Holds water in seafood, chicken and ham, so the food weighs more. Absorbed almost completely.',
      patterns: [
        'sodium tripolyphosphate', 'pentasodium triphosphate', 'sodium triphosphate',
        'stpp', 'e451', 'ins451', 'e451i'
      ]
    },
    {
      id: 'sodium-acid-pyrophosphate',
      name: 'Sodium acid pyrophosphate (SAPP)',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E450(i)', cas: '7758-16-9', cfr: '21 CFR 182.1087', elemental: 27.9,
      note: 'A leavening acid in baked goods, and used to keep potatoes from darkening.',
      patterns: [
        'sodium acid pyrophosphate', 'disodium pyrophosphate',
        'disodium dihydrogen pyrophosphate', 'disodium diphosphate', 'sapp', 'e450i'
      ]
    },
    {
      id: 'tetrasodium-pyrophosphate',
      name: 'Tetrasodium pyrophosphate (TSPP)',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E450(iii)', cas: '7722-88-5', cfr: '21 CFR 182 (GRAS)', elemental: 23.3,
      note: 'Used in imitation crab and chicken nuggets. Absorbed almost completely.',
      patterns: [
        'tetrasodium pyrophosphate', 'sodium pyrophosphate', 'tetrasodium diphosphate', 'tspp', 'e450iii'
      ]
    },
    {
      id: 'sodium-hexametaphosphate',
      name: 'Sodium hexametaphosphate (SHMP)',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E452(i)', cas: '10124-56-8', cfr: '21 CFR 182 (GRAS)', elemental: 30.4,
      note: 'Used in processed cheese and some drinks. Absorbed almost completely.',
      patterns: [
        'sodium hexametaphosphate', 'shmp', 'grahams salt',
        'sodium polyphosphate', 'insoluble sodium metaphosphate', 'e452i'
      ]
    },
    {
      id: 'pyrophosphate',
      name: 'Pyrophosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      generic: true,
      eNumber: 'E450',
      note: 'An added phosphate used to hold water and blend fats. Absorbed almost completely.',
      patterns: ['pyrophosphate', 'diphosphate', 'e450', 'ins450']
    },
    {
      id: 'polyphosphate',
      name: 'Polyphosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      generic: true,
      eNumber: 'E452',
      note: 'A chain-type added phosphate, common in processed cheese and meat.',
      patterns: [
        'polyphosphate', 'metaphosphate', 'triphosphate', 'tripolyphosphate',
        'e452', 'ins452'
      ]
    },

    /* --- calcium orthophosphates --- */
    {
      id: 'monocalcium-phosphate',
      name: 'Monocalcium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E341(i)', cas: '7758-23-8', cfr: '21 CFR 182.8217', elemental: 26.5,
      note: 'The acid in most baking powder and self-rising flour.',
      patterns: ['monocalcium phosphate', 'calcium phosphate monobasic', 'e341i']
    },
    {
      id: 'dicalcium-phosphate',
      name: 'Dicalcium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E341(ii)', cas: '7757-93-7', cfr: '21 CFR 182.8217', elemental: 22.8,
      note: 'A dough conditioner and mineral added to cereals and flour.',
      patterns: [
        'dicalcium phosphate', 'calcium phosphate dibasic',
        'calcium hydrogen phosphate', 'e341ii'
      ]
    },
    {
      id: 'tricalcium-phosphate',
      name: 'Tricalcium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E341(iii)', cas: '7758-87-4', cfr: '21 CFR 182.8217', elemental: 20.0,
      note: 'Keeps powders free-flowing and adds calcium to non-dairy milks.',
      patterns: ['tricalcium phosphate', 'calcium phosphate tribasic', 'e341iii']
    },
    {
      id: 'calcium-phosphate',
      name: 'Calcium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      generic: true,
      eNumber: 'E341', cfr: '21 CFR 182.8217',
      note: 'Used to fortify or firm up foods, and in baking powder.',
      patterns: ['calcium phosphate', 'e341', 'ins341']
    },

    /* --- potassium phosphates: BOTH minerals, which is why they matter twice --- */
    {
      id: 'monopotassium-phosphate',
      name: 'Monopotassium phosphate',
      minerals: ['phosphorus', 'potassium'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E340(i)', cas: '7778-77-0', cfr: '21 CFR 184.1631', elemental: 22.8,
      note: 'Adds BOTH phosphorus and potassium. Found in sports drinks and creamers.',
      patterns: [
        'monopotassium phosphate', 'potassium phosphate monobasic',
        'potassium dihydrogen phosphate', 'e340i'
      ]
    },
    {
      id: 'dipotassium-phosphate',
      name: 'Dipotassium phosphate',
      minerals: ['phosphorus', 'potassium'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E340(ii)', cas: '7758-11-4', cfr: '21 CFR 184.1631', elemental: 17.8,
      note: 'Adds BOTH phosphorus and potassium. Very common in non-dairy creamer and bottled coffee.',
      patterns: [
        'dipotassium phosphate', 'potassium phosphate dibasic',
        'dipotassium hydrogen phosphate', 'e340ii'
      ]
    },
    {
      id: 'tripotassium-phosphate',
      name: 'Tripotassium phosphate',
      minerals: ['phosphorus', 'potassium'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E340(iii)', cas: '7778-53-2', cfr: '21 CFR 184.1631', elemental: 14.6,
      note: 'Adds BOTH phosphorus and potassium. Used to blend and stabilise processed foods.',
      patterns: ['tripotassium phosphate', 'potassium phosphate tribasic', 'e340iii']
    },
    {
      id: 'potassium-tripolyphosphate',
      name: 'Potassium tripolyphosphate (KTPP)',
      minerals: ['phosphorus', 'potassium'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E451(ii)', cas: '13845-36-8', elemental: 20.0,
      note: 'Holds water in meat and poultry, and adds BOTH phosphorus and potassium.',
      patterns: ['potassium tripolyphosphate', 'pentapotassium triphosphate', 'ktpp', 'e451ii']
    },
    {
      id: 'tetrapotassium-pyrophosphate',
      name: 'Tetrapotassium pyrophosphate (TKPP)',
      minerals: ['phosphorus', 'potassium'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E450(v)', cas: '7320-34-5',
      note: 'Blends fats in processed foods, and adds BOTH phosphorus and potassium.',
      patterns: ['tetrapotassium pyrophosphate', 'potassium pyrophosphate', 'tetrapotassium diphosphate', 'potassium diphosphate', 'tkpp', 'e450v']
    },
    {
      id: 'potassium-phosphate',
      name: 'Potassium phosphate',
      minerals: ['phosphorus', 'potassium'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      generic: true,
      eNumber: 'E340', cfr: '21 CFR 184.1631',
      note: 'Adds BOTH phosphorus and potassium. Common in drinks and processed cheese.',
      patterns: ['potassium phosphate', 'e340', 'ins340']
    },

    /* --- the rest of the inorganic family --- */
    {
      id: 'sodium-aluminum-phosphate',
      name: 'Sodium aluminum phosphate (SALP)',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E541', cas: '7785-88-8', cfr: '21 CFR 182.1781', elemental: 27,
      note: 'A baking powder acid, also used in processed cheese.',
      patterns: [
        'sodium aluminum phosphate', 'salp',
        'aluminum phosphate', 'e541', 'ins541'
      ]
    },
    {
      id: 'ammonium-phosphate',
      name: 'Ammonium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E342', cas: '7722-76-1', cfr: '21 CFR 184.1141',
      note: 'A dough conditioner and yeast food in bread.',
      patterns: [
        'ammonium phosphate', 'monoammonium phosphate', 'diammonium phosphate',
        'e342', 'ins342'
      ]
    },
    {
      id: 'magnesium-phosphate',
      name: 'Magnesium phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E343',
      note: 'Used as an anti-caking agent and mineral source.',
      patterns: ['magnesium phosphate', 'trimagnesium phosphate', 'e343', 'ins343']
    },
    {
      id: 'iron-phosphate',
      name: 'Iron phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'low',
      cas: '10045-86-0', cfr: '21 CFR 182.5301', elemental: 20,
      note: 'Used to add iron to cereal and flour. The amounts are small.',
      patterns: [
        'ferric phosphate', 'ferric orthophosphate', 'ferric pyrophosphate',
        'iron phosphate', 'ferrous phosphate'
      ]
    },
    {
      id: 'generic-phosphate',
      name: 'Added phosphate',
      minerals: ['phosphorus'],
      klass: 'inorganic-phosphate',
      confidence: 'definite',
      load: 'high',
      generic: true,
      note: 'An added phosphate. Your body absorbs nearly all of this kind of phosphorus.',
      patterns: ['phosphate']
    },

    /* ---------------------------------------------------------------- *
     * GROUP B — PHOSPHATED STARCHES
     *
     * Real added phosphorus, but as a cross-link at low levels, so the
     * per-serving contribution is small. Named types are definite; the
     * generic "modified food starch" is the single genuine ambiguity on a
     * US label and is handled below.
     * ---------------------------------------------------------------- */
    {
      id: 'phosphated-distarch-phosphate',
      name: 'Phosphated distarch phosphate',
      minerals: ['phosphorus'],
      klass: 'phosphated-starch',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E1413',
      note: 'A starch held together with phosphate. The amount of phosphorus is small.',
      patterns: ['phosphated distarch phosphate', 'e1413']
    },
    {
      id: 'distarch-phosphate',
      name: 'Distarch phosphate',
      minerals: ['phosphorus'],
      klass: 'phosphated-starch',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E1412',
      note: 'A starch held together with phosphate. The amount of phosphorus is small.',
      patterns: ['distarch phosphate', 'e1412']
    },
    {
      id: 'monostarch-phosphate',
      name: 'Monostarch phosphate',
      minerals: ['phosphorus'],
      klass: 'phosphated-starch',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E1410',
      note: 'A starch with phosphate attached. The amount of phosphorus is small.',
      patterns: ['monostarch phosphate', 'starch phosphate', 'e1410']
    },
    {
      id: 'hydroxypropyl-distarch-phosphate',
      name: 'Hydroxypropyl distarch phosphate',
      minerals: ['phosphorus'],
      klass: 'phosphated-starch',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E1442',
      note: 'A starch held together with phosphate. The amount of phosphorus is small.',
      patterns: ['hydroxypropyl distarch phosphate', 'e1442']
    },
    {
      id: 'modified-starch',
      name: 'Modified food starch',
      minerals: ['phosphorus'],
      klass: 'phosphated-starch',
      confidence: 'possible',
      load: 'low',
      note: 'Some modified starches contain added phosphorus and some do not. US labels do not say which.',
      patterns: [
        'modified food starch', 'modified corn starch', 'modified tapioca starch',
        'modified potato starch', 'modified wheat starch', 'modified rice starch',
        'modified starch', 'food starch modified'
      ]
    },

    /* ---------------------------------------------------------------- *
     * NON-PHOSPHATE MODIFIED STARCHES — deliberately zero minerals.
     *
     * These exist ONLY to be matched. Because scanner.js resolves overlaps
     * longest-match-first, "starch sodium octenyl succinate" claims the span
     * before "modified starch" or "starch" can, and because it carries no
     * minerals it produces no phosphorus flag. Deleting these entries would
     * not remove a flag — it would CREATE a false one.
     * ---------------------------------------------------------------- */
    {
      id: 'starch-octenyl-succinate',
      name: 'Starch sodium octenyl succinate',
      minerals: [],
      klass: 'non-phosphate-starch',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E1450',
      note: 'A modified starch with no added phosphorus.',
      patterns: ['starch sodium octenyl succinate', 'sodium octenyl succinate', 'e1450']
    },
    {
      id: 'acetylated-distarch-adipate',
      name: 'Acetylated distarch adipate',
      minerals: [],
      klass: 'non-phosphate-starch',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E1422',
      note: 'A modified starch with no added phosphorus.',
      patterns: ['acetylated distarch adipate', 'e1422']
    },
    {
      id: 'other-modified-starch',
      name: 'Modified starch (no added phosphorus)',
      minerals: [],
      klass: 'non-phosphate-starch',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E1404/E1420/E1440',
      note: 'A modified starch with no added phosphorus.',
      patterns: [
        'oxidised starch', 'oxidized starch', 'acetylated starch',
        'hydroxypropyl starch', 'e1404', 'e1420', 'e1440'
      ]
    },

    /* ---------------------------------------------------------------- *
     * GROUP C — ORGANIC PHOSPHORUS
     *
     * Phosphorus bound inside an organic molecule. Absorbed far less
     * completely than a phosphate salt, so these are tiered DOWN even when
     * they are extremely common on labels.
     * ---------------------------------------------------------------- */
    {
      id: 'lecithin',
      name: 'Lecithin',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'definite',
      load: 'low',
      organic: true,
      eNumber: 'E322', elemental: 2,
      /*
       * Lecithin is the MOST COMMON phosphorus additive by label frequency —
       * 32% of US products (Dunford & Calvo 2025) — and it is tiered lowest
       * anyway, on purpose.
       *
       * Picard et al. (J Ren Nutr 2023;33(3):443-449) found that products whose
       * only phosphorus additive was lecithin had LOWER median phosphorus than
       * products with no phosphorus additive at all (86 vs 145 mg/100 g) and
       * concluded lecithin "may not be associated with increased phosphorus
       * content". It is used at low levels and its phosphorus is organic.
       *
       * Flagging it as loudly as sodium phosphate would be the fastest way to
       * teach someone to distrust every flag this app shows them.
       */
      note: 'A very common emulsifier. It contains a little phosphorus, but not the kind your body absorbs easily.',
      patterns: [
        'lecithin', 'soy lecithin', 'soya lecithin', 'sunflower lecithin',
        'egg lecithin', 'canola lecithin', 'e322', 'ins322'
      ]
    },
    {
      id: 'phospholipid',
      name: 'Phospholipid',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'definite',
      load: 'low',
      organic: true,
      eNumber: 'E322', elemental: 4,
      note: 'A fat that carries phosphorus. Not the kind your body absorbs easily.',
      patterns: ['phospholipid', 'phosphatide', 'phosphatidylcholine']
    },
    {
      id: 'disodium-inosinate',
      name: 'Disodium inosinate',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'definite',
      load: 'low',
      organic: true,
      eNumber: 'E631', elemental: 7.9,
      note: 'A savoury flavour booster. It contains phosphorus, but only a trace is used.',
      patterns: ['disodium inosinate', 'sodium inosinate', 'inosinate', 'e631', 'ins631']
    },
    {
      id: 'disodium-guanylate',
      name: 'Disodium guanylate',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'definite',
      load: 'low',
      organic: true,
      eNumber: 'E627', elemental: 7.6,
      note: 'A savoury flavour booster. It contains phosphorus, but only a trace is used.',
      patterns: ['disodium guanylate', 'sodium guanylate', 'guanylate', 'e627', 'ins627']
    },
    {
      id: 'ribonucleotides',
      name: 'Disodium ribonucleotides',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'definite',
      load: 'low',
      organic: true,
      eNumber: 'E635', elemental: 7.7,
      note: 'A savoury flavour booster. It contains phosphorus, but only a trace is used.',
      patterns: [
        'disodium ribonucleotide', 'ribonucleotide', 'disodium 5 ribonucleotide',
        'e635', 'ins635'
      ]
    },
    {
      id: 'phytic-acid',
      name: 'Phytic acid',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'definite',
      load: 'low',
      organic: true,
      eNumber: 'E391', elemental: 28,
      note: 'Plant phosphorus. Your body absorbs very little of it.',
      patterns: ['phytic acid', 'sodium phytate', 'phytate', 'inositol hexaphosphate', 'e391']
    },
    {
      id: 'dairy-protein-concentrate',
      name: 'Concentrated milk protein',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'likely',
      load: 'high',
      organic: true,
      note: 'Concentrated milk protein carries a lot of natural phosphorus, though your body absorbs it less completely than added phosphate.',
      patterns: [
        'milk protein concentrate', 'milk protein isolate', 'whey protein concentrate',
        'whey protein isolate', 'casein', 'caseinate', 'sodium caseinate',
        'calcium caseinate', 'nonfat dry milk', 'nonfat milk solids'
      ]
    },
    {
      id: 'yeast-extract',
      name: 'Yeast extract',
      minerals: ['phosphorus'],
      klass: 'organic-phosphorus',
      confidence: 'likely',
      load: 'low',
      organic: true,
      note: 'A savoury flavouring that naturally contains some phosphorus.',
      patterns: ['yeast extract', 'autolyzed yeast', 'autolysed yeast', 'torula yeast']
    },

    /* ---------------------------------------------------------------- *
     * PROCESS INDICATORS
     *
     * Not ingredients — label phrases that mean a phosphate solution was
     * injected. USDA allows "enhanced", "self-basting" and "contains up to
     * X% solution" on meat and poultry (9 CFR 381.118) without itemising
     * every salt, so on these products the ingredient list can understate
     * what is actually in the meat.
     * ---------------------------------------------------------------- */
    {
      id: 'meat-solution',
      name: 'Added solution (enhanced meat)',
      minerals: ['phosphorus', 'potassium'],
      klass: 'process-indicator',
      confidence: 'likely',
      load: 'high',
      note: 'This meat has had a salt solution added. That solution usually contains phosphate, even when the label does not name it.',
      patterns: [
        'enhanced with up to', 'contains up to solution', 'containing up to solution',
        'self basting', 'basted with', 'injected with', 'marinated with up to',
        'up to solution of water', 'solution of water and salt'
      ]
    },
    {
      id: 'baking-powder',
      name: 'Baking powder',
      minerals: ['phosphorus'],
      klass: 'process-indicator',
      confidence: 'likely',
      load: 'moderate',
      note: 'Most baking powder contains a phosphate as its acid.',
      patterns: ['baking powder', 'double acting baking powder']
    }
  ];

  /* ---------------------------------------------------------------- *
   * POTASSIUM ADDITIVES — TIER A, MATERIAL
   *
   * These are used in bulk. Potassium chloride is 52.5% potassium and is
   * replacing sodium across the reformulated food supply, so it is the one
   * most likely to surprise someone.
   * ---------------------------------------------------------------- */

  var POTASSIUM = [
    {
      id: 'potassium-chloride',
      name: 'Potassium chloride',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E508', cfr: '21 CFR 184.1622', elemental: 52.5,
      /* FDA's December 2020 guidance permits the alternate label name
       * "potassium salt", which reads to a shopper like ordinary salt. */
      note: 'A salt substitute. It may be listed as "potassium salt". It adds a lot of potassium.',
      patterns: ['potassium chloride', 'potassium salt', 'kcl', 'sylvite', 'e508', 'ins508']
    },
    {
      id: 'potassium-citrate',
      name: 'Potassium citrate',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E332(ii)', cfr: '21 CFR 184.1625', elemental: 38.3,
      note: 'Used in sports drinks and dairy. It adds real potassium.',
      patterns: ['potassium citrate', 'tripotassium citrate', 'e332', 'ins332']
    },
    {
      id: 'potassium-lactate',
      name: 'Potassium lactate',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'high',
      eNumber: 'E326', cfr: '21 CFR 184.1639', elemental: 30.5,
      note: 'Used in deli meat and sausage to keep it fresh. It adds real potassium.',
      patterns: ['potassium lactate', 'e326', 'ins326']
    },
    {
      id: 'potassium-carbonate',
      name: 'Potassium carbonate',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E501(i)', cfr: '21 CFR 184.1619', elemental: 56.6,
      note: 'Used to darken cocoa and in some noodles.',
      patterns: ['potassium carbonate', 'dipotassium carbonate', 'potash', 'e501i']
    },
    {
      id: 'potassium-bicarbonate',
      name: 'Potassium bicarbonate',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E501(ii)', cfr: '21 CFR 184.1613', elemental: 39.1,
      note: 'A leavening agent, used instead of baking soda in some baked goods.',
      patterns: ['potassium bicarbonate', 'potassium hydrogen carbonate', 'e501']
    },
    {
      id: 'potassium-gluconate',
      name: 'Potassium gluconate',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E577', elemental: 16.7,
      note: 'Used as a mineral source and salt substitute.',
      patterns: ['potassium gluconate', 'e577']
    },
    {
      id: 'potassium-glutamate',
      name: 'Monopotassium glutamate',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E622', elemental: 19,
      note: 'A flavour enhancer used in place of MSG.',
      patterns: ['monopotassium glutamate', 'potassium glutamate', 'e622']
    },
    {
      id: 'potassium-hydroxide',
      name: 'Potassium hydroxide',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E525', elemental: 69.7,
      note: 'Used to control acidity. Very high in potassium, but usually only a little is used.',
      patterns: ['potassium hydroxide', 'e525', 'ins525']
    },
    {
      id: 'potassium-acetate',
      name: 'Potassium acetate',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'moderate',
      eNumber: 'E261',
      note: 'Used in packaged meat to keep it fresh.',
      patterns: ['potassium acetate', 'potassium diacetate', 'e261', 'ins261']
    },
    {
      id: 'salt-substitute',
      name: 'Salt substitute',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'likely',
      load: 'high',
      note: 'Most salt substitutes are potassium chloride. A quarter teaspoon can hold as much potassium as a banana.',
      patterns: ['salt substitute', 'lite salt', 'light salt', 'low sodium salt', 'no salt seasoning']
    },
    {
      id: 'generic-potassium',
      name: 'Added potassium',
      minerals: ['potassium'],
      klass: 'material-potassium',
      confidence: 'definite',
      load: 'moderate',
      generic: true,
      note: 'A potassium compound was added to this food.',
      patterns: ['potassium']
    },

    /* ---------------------------------------------------------------- *
     * TIER B — TRIVIAL POTASSIUM
     *
     * These are the false-positive trap. Potassium sorbate is 26% potassium
     * by mass, which sounds alarming, but it is used at under 0.3% of the
     * product — a few milligrams a serving. Iodised salt contains potassium
     * iodide in micrograms.
     *
     * They are still REPORTED, because someone scanning their own label will
     * see the word "potassium" and deserves to be told it is there and that
     * it is trace. They must never drive a material-potassium verdict.
     * ---------------------------------------------------------------- */
    {
      id: 'potassium-sorbate',
      name: 'Potassium sorbate',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E202', elemental: 26.0,
      note: 'A preservative. Only a trace is used, so it adds very little potassium.',
      patterns: ['potassium sorbate', 'e202', 'ins202']
    },
    {
      id: 'potassium-benzoate',
      name: 'Potassium benzoate',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E212', elemental: 24.4,
      note: 'A preservative. Only a trace is used, so it adds very little potassium.',
      patterns: ['potassium benzoate', 'e212', 'ins212']
    },
    {
      id: 'potassium-metabisulfite',
      name: 'Potassium metabisulfite',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E224', elemental: 35,
      note: 'A preservative used in wine and dried fruit. Only a trace is used.',
      patterns: [
        'potassium metabisulfite', 'potassium metabisulphite',
        'potassium pyrosulfite', 'e224', 'ins224'
      ]
    },
    {
      id: 'potassium-sulfite',
      name: 'Potassium sulfite',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E225/E228',
      note: 'A preservative. Only a trace is used.',
      patterns: [
        'potassium sulfite', 'potassium sulphite', 'potassium bisulfite',
        'potassium bisulphite', 'potassium hydrogen sulfite', 'e225', 'e228'
      ]
    },
    {
      id: 'potassium-bitartrate',
      name: 'Cream of tartar',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E336(i)', elemental: 20.8,
      /* Retiered from 'moderate' to 'low' against the spec: cream of tartar is
       * a leavening acid used in small amounts, not a bulk potassium salt. */
      note: 'A baking acid. Small amounts are used, so it adds little potassium.',
      patterns: [
        'cream of tartar', 'potassium bitartrate', 'potassium acid tartrate',
        'monopotassium tartrate', 'e336'
      ]
    },
    {
      id: 'potassium-nitrate',
      name: 'Potassium nitrate or nitrite',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E249/E252',
      note: 'A curing salt for meat. Only a trace is used.',
      patterns: [
        'potassium nitrate', 'potassium nitrite', 'saltpeter', 'saltpetre',
        'e249', 'e252', 'ins252'
      ]
    },
    {
      id: 'potassium-propionate',
      name: 'Potassium propionate',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E283', elemental: 27,
      note: 'A mould inhibitor in bread. Only a trace is used.',
      patterns: ['potassium propionate', 'e283', 'ins283']
    },
    {
      id: 'potassium-iodide',
      name: 'Potassium iodide',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      note: 'This is how salt is iodised. The amount of potassium is tiny.',
      patterns: ['potassium iodide', 'potassium iodate']
    },
    {
      id: 'potassium-bromate',
      name: 'Potassium bromate',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E924',
      note: 'A flour treatment. Only a trace is used.',
      patterns: ['potassium bromate', 'e924']
    },
    {
      id: 'potassium-ferrocyanide',
      name: 'Potassium ferrocyanide',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E536',
      note: 'Keeps salt free-flowing. Only a trace is used.',
      patterns: ['potassium ferrocyanide', 'e536']
    },
    {
      id: 'potassium-sulfate',
      name: 'Potassium sulfate',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E515',
      note: 'A minor seasoning and brewing salt. Small amounts are used.',
      patterns: ['potassium sulfate', 'potassium sulphate', 'e515']
    },
    {
      id: 'potassium-alginate',
      name: 'Potassium alginate',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      eNumber: 'E402',
      note: 'A seaweed thickener. Small amounts are used.',
      patterns: ['potassium alginate', 'e402', 'ins402']
    },
    {
      id: 'potassium-polyaspartate',
      name: 'Potassium polyaspartate',
      minerals: ['potassium'],
      klass: 'trivial-potassium',
      confidence: 'definite',
      load: 'low',
      note: 'A wine stabiliser. Only a trace is used.',
      patterns: ['potassium polyaspartate']
    }
  ];

  var ALL = PHOSPHATE.concat(POTASSIUM);

  /* Tiers the caller can ask for without knowing the class taxonomy. */
  function materialPotassium(f) { return f.klass === 'material-potassium'; }
  function trivialPotassium(f) { return f.klass === 'trivial-potassium'; }
  function inorganicPhosphate(f) { return f.klass === 'inorganic-phosphate'; }

  var api = {
    all: ALL,
    phosphate: PHOSPHATE,
    potassium: POTASSIUM,
    byId: ALL.reduce(function (m, a) { m[a.id] = a; return m; }, {}),
    isMaterialPotassium: materialPotassium,
    isTrivialPotassium: trivialPotassium,
    isInorganicPhosphate: inorganicPhosphate
  };

  root.RenalAdditives = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
