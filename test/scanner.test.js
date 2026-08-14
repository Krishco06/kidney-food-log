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
  assertFinds('Chicken Breast, Water, Sodium Tripolyphosphate, Salt', 'tripolyphosphate');
});

test('finds SAPP in baking mix', function () {
  assertFinds('Enriched Flour, Sugar, Sodium Acid Pyrophosphate, Baking Soda', 'pyrophosphate');
});

test('finds hexametaphosphate', function () {
  assertFinds('Water, Sugar, Sodium Hexametaphosphate', 'polyphosphate');
});

test('finds dicalcium phosphate', function () {
  assertFinds('Oats, Sugar, Dicalcium Phosphate, Salt', 'calcium-phosphate');
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
  assertFinds('Salt, Monosodium Glutamate, Disodium Inosinate, Disodium Guanylate', 'ribonucleotides');
});

test('finds phosphated distarch phosphate by E-number alone', function () {
  assertFinds('Water, Starch (E1442), Salt', 'phosphated-starch');
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
  assert(ids(r).indexOf('potassium-phosphate') !== -1, 'should find potassium-phosphate');
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
  assert(ids(r).indexOf('tripolyphosphate') !== -1);
  assert(ids(r).indexOf('generic-phosphate') === -1, 'generic must not double-report');
  assert(r.findings.length === 1, 'expected exactly 1 finding, got ' + r.findings.length);
});

test('generic suppression works across separate ingredient phrases', function () {
  // Phrase 1 has only the vague word; phrase 2 names the specific compound.
  var r = scanner.scan('Water, Sodium Phosphates (Sodium Tripolyphosphate, Tetrasodium Pyrophosphate), Salt');
  assert(ids(r).indexOf('generic-phosphate') === -1,
    'generic should be suppressed by the specific hits: [' + ids(r).join(', ') + ']');
  assert(ids(r).indexOf('tripolyphosphate') !== -1);
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
  assert(ids(r).indexOf('tripolyphosphate') !== -1,
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
  assert(ids(r).indexOf('potassium-polyphosphate') !== -1,
    'tetrapotassium diphosphate should be dual-mineral: [' + ids(r).join(', ') + ']');
  assert(ids(r).indexOf('pyrophosphate') !== -1, 'disodium diphosphate should be found');
  assert(ids(r).indexOf('potassium-citrate') !== -1, 'potassium citrate should be found');
  assert(ids(r).indexOf('potassium-phosphate') !== -1, 'monopotassium phosphate should be found');
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
