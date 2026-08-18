/*
 * Tests for the additive scanner.
 *
 * Run: node test/scanner.test.js
 *
 * These are the highest-value tests in the project. The scanner is the only
 * component making a claim the user will act on, so both directions matter:
 * missing a real phosphate additive is a clinical miss, and flagging a food
 * that has none teaches the user to ignore our flags.
 */

'use strict';

var scanner = require('../js/scanner.js');
var additives = require('../js/additives.js');

var passed = 0;
var failed = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed.push({ name: name, message: err.message });
  }
}

function ids(result) {
  return result.findings.map(function (f) { return f.id; });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertFinds(text, expectedId) {
  var r = scanner.scan(text);
  assert(ids(r).indexOf(expectedId) !== -1,
    'expected "' + expectedId + '" in [' + ids(r).join(', ') + '] for: ' + text);
  return r;
}

function assertMisses(text, forbiddenId) {
  var r = scanner.scan(text);
  assert(ids(r).indexOf(forbiddenId) === -1,
    'did NOT expect "' + forbiddenId + '" in [' + ids(r).join(', ') + '] for: ' + text);
  return r;
}

/* ------------------------------------------------------------------ *
 * Normalization
 * ------------------------------------------------------------------ */

test('normalize lowercases and collapses punctuation', function () {
  assert(scanner.normalize('SODIUM  TRI-POLYPHOSPHATE.') === 'sodium tri polyphosphate');
});

test('normalize strips accents', function () {
  assert(scanner.normalize('Jalapeño') === 'jalapeno');
});

test('normalize canonicalizes E-number spellings', function () {
  assert(scanner.normalize('E 450') === 'e450', 'E 450');
  assert(scanner.normalize('E-450') === 'e450', 'E-450');
  assert(scanner.normalize('INS 450') === 'e450', 'INS 450');
  assert(scanner.normalize('e1442') === 'e1442', 'e1442');
});

/* ------------------------------------------------------------------ *
 * The "PHOS" cases — what the standard clinical advice already catches
 * ------------------------------------------------------------------ */

test('finds phosphoric acid in a cola', function () {
  assertFinds('Carbonated Water, High Fructose Corn Syrup, Caramel Color, Phosphoric Acid, Natural Flavors, Caffeine',
    'phosphoric-acid');
});

test('finds sodium phosphate', function () {
  assertFinds('Water, Chicken Broth, Sodium Phosphates, Salt', 'sodium-phosphate');
});

test('finds STPP in enhanced chicken', function () {
  assertFinds('Chicken Breast, Water, Sodium Tripolyphosphate, Salt', 'sodium-tripolyphosphate');
});

test('finds SAPP in baking mix', function () {
  assertFinds('Enriched Flour, Sugar, Sodium Acid Pyrophosphate, Baking Soda', 'sodium-acid-pyrophosphate');
});

test('finds hexametaphosphate', function () {
  assertFinds('Water, Sugar, Sodium Hexametaphosphate', 'sodium-hexametaphosphate');
});

test('finds dicalcium phosphate', function () {
  assertFinds('Oats, Sugar, Dicalcium Phosphate, Salt', 'dicalcium-phosphate');
});

/* ------------------------------------------------------------------ *
 * The non-"PHOS" cases — the whole reason this dictionary exists.
 * A naive substring search for "phos" finds NONE of these.
 * ------------------------------------------------------------------ */

test('finds lecithin (most common P additive, no "phos" in the name)', function () {
  var r = assertFinds('Sugar, Cocoa Butter, Chocolate Liquor, Soy Lecithin, Vanilla', 'lecithin');
  assert(r.phosphorus.length > 0, 'lecithin should count as a phosphorus finding');
});

test('finds modified food starch as UNCERTAIN, not definite', function () {
  var r = assertFinds('Water, Modified Food Starch, Salt', 'modified-starch');
  var f = r.findings.filter(function (x) { return x.id === 'modified-starch'; })[0];
  assert(f.confidence === 'possible', 'modified starch must be "possible", got ' + f.confidence);
  assert(r.uncertain.length === 1, 'should appear in the uncertain bucket');
});

test('finds disodium inosinate / guanylate', function () {
  assertFinds('Salt, Monosodium Glutamate, Disodium Inosinate, Disodium Guanylate', 'disodium-inosinate');
});

test('finds phosphated distarch phosphate by E-number alone', function () {
  assertFinds('Water, Starch (E1442), Salt', 'hydroxypropyl-distarch-phosphate');
});

test('finds sodium caseinate as a concentrated phosphorus source', function () {
  assertFinds('Water, Corn Syrup, Sodium Caseinate, Vegetable Oil', 'dairy-protein-concentrate');
});

test('naive "phos" search would miss what we catch', function () {
  var label = 'Sugar, Cocoa Butter, Soy Lecithin, Modified Corn Starch, Disodium Guanylate';
  assert(label.toLowerCase().indexOf('phos') === -1, 'test premise: no "phos" in this label');
  var r = scanner.scan(label);
  assert(r.phosphorus.length >= 3, 'expected >=3 phosphorus findings, got ' + r.phosphorus.length);
});

/* ------------------------------------------------------------------ *
 * Potassium additives
 * ------------------------------------------------------------------ */

test('finds potassium chloride', function () {
  var r = assertFinds('Water, Sea Salt, Potassium Chloride, Natural Flavor', 'potassium-chloride');
  assert(r.potassium.length > 0);
});

test('finds "potassium salt" (the FDA alternate name for KCl)', function () {
  assertFinds('Tomatoes, Potassium Salt, Citric Acid', 'potassium-chloride');
});

test('finds potassium lactate in deli meat', function () {
  assertFinds('Turkey Breast, Water, Potassium Lactate, Sodium Diacetate', 'potassium-lactate');
});

test('rates potassium sorbate as low load, not high', function () {
  var r = assertFinds('Water, Sugar, Potassium Sorbate', 'potassium-sorbate');
  var f = r.findings.filter(function (x) { return x.id === 'potassium-sorbate'; })[0];
  assert(f.load === 'low', 'sorbate should be low load, got ' + f.load);
});

test('finds salt substitute', function () {
  assertFinds('Spices, Salt Substitute, Garlic', 'salt-substitute');
});

/* ------------------------------------------------------------------ *
 * Dual-mineral and overlap resolution
 * ------------------------------------------------------------------ */

test('potassium phosphate reports once, as BOTH minerals', function () {
  var r = scanner.scan('Water, Dipotassium Phosphate, Sugar');
  assert(ids(r).indexOf('dipotassium-phosphate') !== -1, 'should find dipotassium-phosphate');
  assert(ids(r).indexOf('generic-phosphate') === -1, 'generic phosphate must be suppressed');
  assert(ids(r).indexOf('generic-potassium') === -1, 'generic potassium must be suppressed');
  var f = r.findings[0];
  assert(f.minerals.indexOf('phosphorus') !== -1 && f.minerals.indexOf('potassium') !== -1,
    'must carry both minerals');
  assert(r.phosphorus.length === 1 && r.potassium.length === 1,
    'should appear in both mineral buckets');
});

test('longest match wins over the generic catch-all', function () {
  var r = scanner.scan('Chicken, Sodium Tripolyphosphate');
  assert(ids(r).indexOf('sodium-tripolyphosphate') !== -1);
  assert(ids(r).indexOf('generic-phosphate') === -1, 'generic must not double-report');
  assert(r.findings.length === 1, 'expected exactly 1 finding, got ' + r.findings.length);
});

test('generic suppression works across separate ingredient phrases', function () {
  // Phrase 1 has only the vague word; phrase 2 names the specific compound.
  var r = scanner.scan('Water, Sodium Phosphates (Sodium Tripolyphosphate, Tetrasodium Pyrophosphate), Salt');
  assert(ids(r).indexOf('generic-phosphate') === -1,
    'generic should be suppressed by the specific hits: [' + ids(r).join(', ') + ']');
  assert(ids(r).indexOf('sodium-tripolyphosphate') !== -1);
});

test('generic catch-all still fires for an unlisted phosphate compound', function () {
  var r = scanner.scan('Water, Zinc Phosphate, Salt');
  assert(ids(r).indexOf('generic-phosphate') !== -1,
    'unknown phosphate should fall through to the generic entry');
});

/* ------------------------------------------------------------------ *
 * False positives — the trust-destroying direction
 * ------------------------------------------------------------------ */

test('clean whole-food label produces no findings', function () {
  var r = scanner.scan('Organic Rolled Oats');
  assert(r.scanned === true);
  assert(r.findings.length === 0, 'expected no findings, got [' + ids(r).join(', ') + ']');
});

test('plain salt and spices produce no potassium finding', function () {
  assertMisses('Salt, Black Pepper, Garlic Powder, Onion Powder', 'generic-potassium');
});

test('"sodium" alone never triggers a potassium finding', function () {
  var r = scanner.scan('Water, Sodium Bicarbonate, Sodium Citrate, Sodium Chloride');
  assert(r.potassium.length === 0, 'sodium compounds must not read as potassium');
});

test('does not match a mineral name inside a longer word', function () {
  // Guards the \b anchors. "Phosphatidylcholine" is a real, separate entry;
  // this checks that word-boundary logic is doing the work, not luck.
  var r = scanner.scan('Water, Potassiumesque Flavoring');
  assert(ids(r).indexOf('generic-potassium') === -1, 'should not match inside "potassiumesque"');
});

test('empty or missing ingredient text is reported as NOT SCANNED, not as clean', function () {
  var r = scanner.scan('');
  assert(r.scanned === false, 'must distinguish "no data" from "no additives"');
  assert(r.findings.length === 0);
  assert(scanner.summarize(r).indexOf('No ingredient list') !== -1);

  var r2 = scanner.scan(null);
  assert(r2.scanned === false, 'null must also be "not scanned"');
});

/* ------------------------------------------------------------------ *
 * Open Food Facts additive tags as a supplementary signal
 * ------------------------------------------------------------------ */

test('uses OFF additives_tags when the ingredient text is thin', function () {
  var r = scanner.scan('Chicken, Water, Salt', { additivesTags: ['en:e451'] });
  assert(ids(r).indexOf('sodium-tripolyphosphate') !== -1,
    'E451 tag should surface STPP: [' + ids(r).join(', ') + ']');
});

test('OFF tags do not create a false "scanned" when there is no data at all', function () {
  var r = scanner.scan('', { additivesTags: [] });
  assert(r.scanned === false);
});

/* ------------------------------------------------------------------ *
 * Real-world label smoke tests
 * ------------------------------------------------------------------ */

test('processed cheese: multiple phosphate additives', function () {
  var r = scanner.scan(
    'Milk, Whey, Milk Protein Concentrate, Milkfat, Sodium Citrate, Calcium Phosphate, ' +
    'Salt, Sodium Phosphate, Sorbic Acid as a Preservative, Cheese Culture'
  );
  assert(r.phosphorus.length >= 3,
    'expected several phosphorus findings, got ' + r.phosphorus.length + ': [' + ids(r).join(', ') + ']');
});

test('reduced-sodium deli meat: potassium replacing sodium', function () {
  var r = scanner.scan(
    'Turkey Breast, Water, Contains 2% or less of Salt, Potassium Lactate, ' +
    'Sodium Phosphates, Potassium Chloride, Sodium Diacetate, Carrageenan'
  );
  assert(r.potassium.length >= 2, 'expected potassium additives: [' + ids(r).join(', ') + ']');
  assert(r.phosphorus.length >= 1, 'expected phosphate additive too');
});

test('load and absorption are independent axes, not one severity scale', function () {
  /*
   * The bioavailability distinction is the app's core educational claim, so the
   * two axes must never be collapsed:
   *   milk protein concentrate — HIGH load, but organic (~40-60% absorbed)
   *   sodium phosphate        — HIGH load, inorganic (~90-100% absorbed)
   *   potassium sorbate       — inorganic, but only a TRACE load
   * A single "severity" number cannot express that, and merging them would
   * misteach the exact fact the user needs.
   */
  var milk = scanner.scan('Water, Milk Protein Concentrate').findings[0];
  assert(milk.load === 'high' && milk.organic === true,
    'milk protein: high load but organic');

  var phos = scanner.scan('Water, Sodium Phosphate').findings[0];
  assert(phos.load === 'high' && phos.organic === false,
    'sodium phosphate: high load and inorganic');

  var sorbate = scanner.scan('Water, Potassium Sorbate').findings[0];
  assert(sorbate.load === 'low' && sorbate.organic === false,
    'potassium sorbate: inorganic but trace load');

  var lec = scanner.scan('Chocolate, Soy Lecithin').findings[0];
  assert(lec.organic === true, 'lecithin is organic phosphorus');
});

test('real label: potassium-bearing phosphates report BOTH minerals', function () {
  /*
   * Verbatim ingredient list from Open Food Facts 5022240016103 (Premier Deli
   * Roasted Turkey Slices). Open Food Facts carries NO phosphorus value for this
   * product, and four separate additives here load phosphorus, potassium or
   * both — the exact case the app exists for. Regression guard: these compounds
   * were originally filed as phosphorus-only, silently dropping the potassium.
   */
  var r = scanner.scan(
    'Turkey Breast (97%), Pea Starch, Dextrose, Salt, Stabilisers (Disodium Diphosphate, ' +
    'Tetrapotassium Diphosphate), Caramelised Sugar Syrup, Flavourings, Maltodextrin, ' +
    'Acidity Regulator (Potassium Citrate), Emulsifier (Monopotassium Phosphate).'
  );
  assert(ids(r).indexOf('tetrapotassium-pyrophosphate') !== -1,
    'tetrapotassium diphosphate should be dual-mineral: [' + ids(r).join(', ') + ']');
  assert(ids(r).indexOf('sodium-acid-pyrophosphate') !== -1, 'disodium diphosphate should be found');
  assert(ids(r).indexOf('potassium-citrate') !== -1, 'potassium citrate should be found');
  assert(ids(r).indexOf('monopotassium-phosphate') !== -1, 'monopotassium phosphate should be found');
  assert(r.phosphorus.length >= 3, 'expected >=3 phosphorus findings, got ' + r.phosphorus.length);
  assert(r.potassium.length >= 3, 'expected >=3 potassium findings, got ' + r.potassium.length);
});

test('summarize gives a plain-language, non-directive line', function () {
  var r = scanner.scan('Chicken, Sodium Tripolyphosphate, Potassium Chloride');
  var s = scanner.summarize(r);
  assert(/phosphorus/.test(s) && /potassium/.test(s), 'summary should mention both: ' + s);
  // Must not tell the user what to do — that is regulated territory.
  assert(!/should|avoid|limit|don't|do not|too much/i.test(s), 'summary must not be directive: ' + s);
});

test('every additive class the dictionary emits has a UI group', function () {
  /*
   * renderAdditives() groups findings by class and gives each group a
   * plain-language lead sentence. Anything with no group falls into a bare
   * "Other additives found" bucket with no explanation — which is exactly
   * where a NEW class would land, silently, months from now.
   *
   * Adding a class to additives.js without adding its group is therefore a
   * quiet downgrade of the thing the tiers exist to communicate, and nothing
   * else would catch it.
   */
  var fs = require('fs');
  var path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

  var m = src.match(/var ADDITIVE_GROUPS = \[[\s\S]*?\n  \];/);
  assert(m, 'ADDITIVE_GROUPS not found in app.js');
  var groups = eval('(' + m[0].replace('var ADDITIVE_GROUPS = ', '').replace(/;$/, '') + ')');
  var covered = groups.map(function (g) { return g.klass; });

  additives.all.forEach(function (a) {
    /* Zero-mineral entries exist only to win the longest-match race and are
     * filtered out before rendering, so they need no group. */
    if (!a.minerals.length) return;
    assert(covered.indexOf(a.klass) !== -1,
      a.id + ' has class "' + a.klass + '" with no group in renderAdditives()');
  });

  /* And every group must be reachable, or it is dead wording. */
  var emitted = additives.all.filter(function (a) { return a.minerals.length; })
    .map(function (a) { return a.klass; });
  groups.forEach(function (g) {
    assert(emitted.indexOf(g.klass) !== -1,
      'UI group "' + g.klass + '" can never have a member');
  });

  /* The lead sentences are patient-facing and must stay descriptive. */
  groups.forEach(function (g) {
    assert(!/\byou should\b|\bavoid\b|\blimit\b|\btoo much\b|\bunsafe\b|\bdo not eat\b/i.test(g.lead),
      'group "' + g.klass + '" lead crosses into advice: ' + g.lead);
    assert(!/\d+\s*mg/i.test(g.lead),
      'group "' + g.klass + '" lead states a milligram figure: ' + g.lead);
  });
});

test('the absorption badge never overstates a phosphated starch', function () {
  /*
   * "Added — almost fully absorbed" is the strongest claim this app makes.
   * The badge used to be a boolean on `organic`, so anything not marked
   * organic got it — including modified food starch, where the phosphorus is
   * a cross-link at trace levels AND unconfirmed. That row carried the
   * app's most confident sentence next to "? Not certain".
   *
   * Saying nothing there is honest. Saying that is not.
   */
  var fs = require('fs');
  var path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

  var m = src.match(/function absorptionBadge\(organic, minerals, klass\) \{[\s\S]*?\n  \}/);
  assert(m, 'absorptionBadge(organic, minerals, klass) not found — did the signature change?');

  var el = function (tag, cls, text) { return { textContent: text }; };
  var badge = new Function('el', m[0] + '; return absorptionBadge;')(el);

  assert(badge(false, ['phosphorus'], 'phosphated-starch') === null,
    'a phosphated starch must not claim near-complete absorption');
  assert(badge(false, ['phosphorus'], 'inorganic-phosphate').textContent === 'Added — almost fully absorbed',
    'an added phosphate salt should say so');
  assert(badge(true, ['phosphorus'], 'organic-phosphorus').textContent === 'Natural — about half absorbed',
    'organic phosphorus should say so');
  assert(badge(false, ['potassium'], 'material-potassium') === null,
    'absorption is a phosphorus idea; potassium-only findings get no badge');

  /* Every call site must pass the class, or the fix is inert where it matters. */
  var calls = src.match(/absorptionBadge\([^)]*\)/g) || [];
  calls.forEach(function (c) {
    if (c.indexOf('function') !== -1) return;
    assert(/klass/.test(c), 'call site drops the class: ' + c);
  });
});

/* ------------------------------------------------------------------ *
 * LABELLED CORPUS — precision and recall
 *
 * Individual assertions prove the scanner handles a case. They cannot prove
 * it handles the DISTRIBUTION, and the two error directions here have very
 * different costs:
 *
 *   A false negative is a ~100%-absorbed phosphate load reaching someone who
 *   cannot excrete it. Silent, and the reason the tool exists.
 *
 *   A false positive is unnecessary food avoidance and lost trust — worst of
 *   all when it fires on iodised salt or a preservative, because the user can
 *   check the package and see we were wrong.
 *
 * So the targets are asymmetric, per the specification: recall >= 0.95 on
 * inorganic phosphate, and precision 1.0 on the potassium tier split — a
 * preservative must NEVER be reported as material potassium.
 *
 * Labels are `p` (contains a material inorganic phosphate) and `k` (contains
 * a MATERIAL potassium salt, not a trace preservative). Lists are real or
 * realistic US label text across the categories the literature flags as
 * high-prevalence, plus the low-prevalence controls that catch over-firing.
 * ------------------------------------------------------------------ */

var CORPUS = [
  /* --- inorganic phosphate present --- */
  { p: 1, k: 0, t: 'Carbonated Water, High Fructose Corn Syrup, Caramel Color, Phosphoric Acid, Natural Flavors, Caffeine' },
  { p: 1, k: 0, t: 'Chicken Breast, Water, Contains 2% or less of Sodium Phosphates, Salt' },
  { p: 1, k: 0, t: 'Pork, Water, Salt, Sodium Tripolyphosphate, Sodium Erythorbate, Sodium Nitrite' },
  { p: 1, k: 0, t: 'Cheddar Cheese, Water, Sodium Citrate, Disodium Phosphate, Salt, Sorbic Acid' },
  { p: 1, k: 0, t: 'Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Monocalcium Phosphate), Sugar, Palm Oil' },
  { p: 1, k: 0, t: 'Potatoes, Vegetable Oil, Sodium Acid Pyrophosphate, Salt' },
  { p: 1, k: 0, t: 'Surimi (Alaska Pollock, Sugar, Sorbitol, Tetrasodium Pyrophosphate), Water, Starch' },
  /* Non-dairy creamer. Labelled k:1 because dipotassium phosphate is 44.9%
   * potassium — this row was mislabelled k:0 on first writing, and the
   * precision check caught the LABEL rather than the scanner. */
  { p: 1, k: 1, t: 'Water, Corn Syrup Solids, Partially Hydrogenated Soybean Oil, Sodium Caseinate, Dipotassium Phosphate, Mono- and Diglycerides' },
  { p: 1, k: 0, t: 'Milk, Cream, Sugar, Nonfat Milk, Tricalcium Phosphate, Natural Flavor' },
  { p: 1, k: 0, t: 'Enriched Corn Meal, Vegetable Oil, Cheese Seasoning, Sodium Hexametaphosphate' },
  { p: 1, k: 0, t: 'Wheat Flour, Sugar, Leavening (Baking Soda, Sodium Aluminum Phosphate), Salt' },
  { p: 1, k: 0, t: 'Water, Whey Protein Concentrate, Trisodium Phosphate, Natural Flavor' },
  { p: 1, k: 0, t: 'Cola: Carbonated Water, Sugar, Colour (E150d), Acid (E338), Flavouring, Caffeine' },
  { p: 1, k: 0, t: 'Cooked Ham, Water, Salt, Stabiliser (E451), Antioxidant (Sodium Ascorbate)' },

  /* --- material potassium present --- */
  { p: 0, k: 1, t: 'Water, Potassium Chloride, Citric Acid, Natural Flavor, Sucralose' },
  { p: 0, k: 1, t: 'Turkey Breast, Water, Contains 2% or less of Sea Salt, Potassium Lactate, Carrageenan' },
  { p: 0, k: 1, t: 'Filtered Water, Cane Sugar, Citric Acid, Potassium Citrate, Natural Flavor' },
  { p: 0, k: 1, t: 'Salt Substitute: Potassium Chloride, Cream of Tartar, Silicon Dioxide' },
  { p: 0, k: 1, t: 'Cocoa Processed with Alkali (Potassium Carbonate), Sugar, Milk' },
  { p: 0, k: 1, t: 'Wheat Flour, Water, Yeast, Potassium Bicarbonate, Salt' },

  /* --- both --- */
  { p: 1, k: 1, t: 'Turkey Breast, Water, Dextrose, Salt, Potassium Lactate, Sodium Phosphates, Potassium Chloride, Sodium Diacetate' },
  { p: 1, k: 1, t: 'Water, Sugar, Monopotassium Phosphate, Citric Acid, Salt' },

  /* --- the false-positive traps: trace potassium and organic phosphorus --- */
  { p: 0, k: 0, t: 'Carbonated Water, Citric Acid, Aspartame, Potassium Benzoate, Potassium Sorbate, Caffeine' },
  { p: 0, k: 0, t: 'Salt, Dextrose, Potassium Iodide, Sodium Bicarbonate' },
  { p: 0, k: 0, t: 'Sugar, Cocoa Butter, Chocolate Liquor, Soy Lecithin, Vanillin' },
  { p: 0, k: 0, t: 'Salt, Monosodium Glutamate, Disodium Inosinate, Disodium Guanylate' },
  { p: 0, k: 0, t: 'Wine, Sulphites (Potassium Metabisulphite)' },
  { p: 0, k: 0, t: 'Flour, Sugar, Butter, Eggs, Cream of Tartar, Baking Soda, Vanilla' },
  { p: 0, k: 0, t: 'Water, Starch Sodium Octenyl Succinate, Sugar, Citric Acid' },
  { p: 0, k: 0, t: 'Bread: Flour, Water, Yeast, Salt, Potassium Propionate' },

  /* --- allergen and advisory text must not be scanned --- */
  { p: 0, k: 0, t: 'Water, Sugar, Salt, Natural Flavor. Contains: Milk, Soy. May contain traces of peanut.' },
  { p: 0, k: 0, t: 'Oats, Raisins, Almonds. Manufactured in a facility that also processes soy lecithin.' },

  /* --- low-prevalence controls: nothing should fire --- */
  { p: 0, k: 0, t: 'Organic Rolled Oats' },
  { p: 0, k: 0, t: 'Tomatoes, Tomato Juice, Salt, Citric Acid, Calcium Chloride' },
  { p: 0, k: 0, t: 'Chicken Breast' },
  { p: 0, k: 0, t: 'Water, Coffee' },
  { p: 0, k: 0, t: 'Cucumbers, Water, Vinegar, Salt, Dill, Garlic' },
  { p: 0, k: 0, t: 'Whole Wheat Flour, Water, Yeast, Salt' }
];

function score(predict, truthKey) {
  var tp = 0, fp = 0, fn = 0;
  var falsePos = [], falseNeg = [];
  CORPUS.forEach(function (row) {
    var got = predict(scanner.scan(row.t)) ? 1 : 0;
    if (got && row[truthKey]) tp++;
    else if (got && !row[truthKey]) { fp++; falsePos.push(row.t.slice(0, 58)); }
    else if (!got && row[truthKey]) { fn++; falseNeg.push(row.t.slice(0, 58)); }
  });
  return {
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: tp + fn === 0 ? 1 : tp / (tp + fn),
    falsePos: falsePos, falseNeg: falseNeg
  };
}

test('corpus: recall on inorganic phosphate >= 0.95', function () {
  var s = score(function (r) { return r.inorganicPhosphate.length > 0; }, 'p');
  assert(s.recall >= 0.95,
    'recall ' + s.recall.toFixed(3) + '; missed: ' + JSON.stringify(s.falseNeg));
});

test('corpus: precision on inorganic phosphate >= 0.90', function () {
  var s = score(function (r) { return r.inorganicPhosphate.length > 0; }, 'p');
  assert(s.precision >= 0.90,
    'precision ' + s.precision.toFixed(3) + '; false positives: ' + JSON.stringify(s.falsePos));
});

test('corpus: MATERIAL potassium is perfectly precise', function () {
  /*
   * The hard requirement. Potassium sorbate, benzoate, metabisulphite,
   * iodide, propionate and cream of tartar all appear in the corpus, and not
   * one of them may be reported as material potassium. A single false
   * positive here teaches someone to ignore the flag that matters.
   */
  var s = score(function (r) { return r.materialPotassium.length > 0; }, 'k');
  assert(s.precision === 1,
    'precision ' + s.precision.toFixed(3) + '; false positives: ' + JSON.stringify(s.falsePos));
  assert(s.recall >= 0.95,
    'recall ' + s.recall.toFixed(3) + '; missed: ' + JSON.stringify(s.falseNeg));
});

test('enhanced-meat phrasing names the solution, not a phantom additive', function () {
  /*
   * Regression guard. The meat-solution indicator is dual-mineral because
   * injected brine usually carries both, and counting it in the headline made
   * a pork loin read "Found 1 potassium additive" — naming a specific additive
   * the label never listed, and burying the useful fact that a solution was
   * added at all.
   */
  ['Pork, Contains up to 12% solution of Water, Salt',
   'Turkey, Self-Basting with Broth'
  ].forEach(function (t) {
    var s = scanner.summarize(scanner.scan(t));
    assert(/added solution/.test(s), 'should describe the solution: ' + s);
    assert(!/Found \d+ potassium/.test(s), 'must not invent an additive count: ' + s);
  });
  /* But a real phosphate on the same label still leads. */
  var r = scanner.scan('Chicken, Contains up to 15% solution of Water, Salt, Sodium Phosphates');
  assert(/Found 1 phosphorus additive/.test(scanner.summarize(r)),
    'a listed phosphate should still lead: ' + scanner.summarize(r));
});

test('corpus: lecithin and nucleotides never drive the headline', function () {
  /*
   * Picard et al. 2023: lecithin-only products had LOWER median phosphorus
   * (86 mg/100 g) than products with no phosphorus additive at all (145).
   * It is the most common phosphorus additive by label frequency and must
   * still not read as a phosphate salt.
   */
  ['Sugar, Cocoa Butter, Chocolate Liquor, Soy Lecithin, Vanillin',
   'Salt, Monosodium Glutamate, Disodium Inosinate, Disodium Guanylate'
  ].forEach(function (t) {
    var r = scanner.scan(t);
    assert(r.inorganicPhosphate.length === 0, 'must not be an inorganic phosphate: ' + t);
    assert(r.organicPhosphorus.length > 0, 'should still be reported as organic P: ' + t);
    assert(!/Found \d+ phosphorus/.test(scanner.summarize(r)),
      'headline must not count it: ' + scanner.summarize(r));
  });
});

/* ------------------------------------------------------------------ */

console.log('');
if (failed.length === 0) {
  console.log('  ' + passed + ' passed');
  console.log('');
  process.exit(0);
} else {
  console.log('  ' + passed + ' passed, ' + failed.length + ' FAILED');
  console.log('');
  failed.forEach(function (f) {
    console.log('  x ' + f.name);
    console.log('      ' + f.message);
  });
  console.log('');
  process.exit(1);
}
