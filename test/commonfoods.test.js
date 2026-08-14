/*
 * Tests for the bundled offline food library.
 *
 * Run: node test/commonfoods.test.js
 *
 * This is shipped DATA, not logic, and the user acts on it directly, so the
 * tests are mostly invariants about the data itself. The failure that matters
 * is a plausible-looking wrong number: nobody can eyeball 149 potassium values,
 * so the guards have to.
 */

'use strict';

var C = require('../js/commonfoods.js');
var Foods = require('../js/foods.js');

var passed = 0;
var failed = [];

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed.push({ name: name, message: err.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

var ALL = C.all();

/* ------------------------------------------------------------------ *
 * Structure
 * ------------------------------------------------------------------ */

test('library is non-trivial and every row is well formed', function () {
  assert(C.count >= 120, 'expected a useful library, got ' + C.count);
  assert(ALL.length === C.count);
  ALL.forEach(function (f) {
    assert(typeof f.name === 'string' && f.name.length > 1, 'bad name: ' + f.name);
    assert(/^usda:\d+$/.test(f.id), 'bad id: ' + f.id);
    assert(f.source === 'usda', 'bad source on ' + f.name);
  });
});

test('names are unique', function () {
  var seen = {};
  ALL.forEach(function (f) {
    assert(!seen[f.name], 'duplicate name: ' + f.name);
    seen[f.name] = true;
  });
});

test('every category is populated and listed', function () {
  assert(C.CATEGORIES.length >= 8, 'got ' + C.CATEGORIES.length + ' categories');
  C.CATEGORIES.forEach(function (cat) {
    assert(C.byCategory(cat).length > 0, 'empty category: ' + cat);
  });
  ALL.forEach(function (f, i) {
    var cat = C.ROWS[i][2];
    assert(C.CATEGORIES.indexOf(cat) !== -1, 'unlisted category: ' + cat);
  });
});

/* ------------------------------------------------------------------ *
 * The reason SR Legacy was chosen over Branded
 * ------------------------------------------------------------------ */

test('EVERY food has a real phosphorus and potassium value', function () {
  // The entire point of using the lab-analysed dataset. A null here would put
  // an "unknown" on a food we could have had a measured number for.
  ALL.forEach(function (f) {
    var n = f.nutrients;
    assert(typeof n.phosphorus === 'number', 'no phosphorus: ' + f.name);
    assert(typeof n.potassium === 'number', 'no potassium: ' + f.name);
    assert(typeof n.sodium === 'number', 'no sodium: ' + f.name);
    assert(typeof n.protein === 'number', 'no protein: ' + f.name);
    assert(typeof n.energy === 'number', 'no energy: ' + f.name);
  });
});

test('no nutrient is negative or absurd per 100 g', function () {
  ALL.forEach(function (f) {
    var n = f.nutrients;
    ['energy', 'protein', 'sodium', 'potassium', 'phosphorus'].forEach(function (k) {
      assert(n[k] >= 0, f.name + ' has negative ' + k + ': ' + n[k]);
    });
    assert(n.energy <= 950, f.name + ' energy implausible: ' + n.energy);   // pure fat ~900
    assert(n.protein <= 100, f.name + ' protein > 100 g/100 g: ' + n.protein);
    assert(n.sodium <= 40000, f.name + ' sodium implausible: ' + n.sodium); // salt ~38,758
    assert(n.potassium <= 20000, f.name + ' potassium implausible: ' + n.potassium);
    assert(n.phosphorus <= 5000, f.name + ' phosphorus implausible: ' + n.phosphorus);
  });
});

/* ------------------------------------------------------------------ *
 * Spot-checks against published USDA values
 *
 * Catches a whole-file regeneration silently binding names to wrong records —
 * the "Meatloaf -> Meatballs, meatless" class of error, which no schema check
 * would notice.
 * ------------------------------------------------------------------ */

test('known foods carry their published values', function () {
  var expect = {
    'Banana':                  { energy: 89,  potassium: 358, phosphorus: 22 },
    'Potato, baked with skin': { energy: 93,  potassium: 535, phosphorus: 70 },
    'Chicken breast, roasted': { energy: 165, potassium: 256, phosphorus: 228 },
    'Whole milk':              { energy: 61,  potassium: 132, phosphorus: 84 },
    'Spinach, raw':            { energy: 23,  potassium: 558, phosphorus: 49 },
    'Apple, with skin':        { energy: 52,  potassium: 107, phosphorus: 11 }
  };
  Object.keys(expect).forEach(function (name) {
    var f = ALL.filter(function (x) { return x.name === name; })[0];
    assert(f, 'missing food: ' + name);
    Object.keys(expect[name]).forEach(function (k) {
      var got = f.nutrients[k];
      var want = expect[name][k];
      assert(Math.abs(got - want) <= Math.max(2, want * 0.05),
        name + '.' + k + ' = ' + got + ', expected ~' + want);
    });
  });
});

test('high-potassium foods are not quietly mis-bound to low ones', function () {
  // A silent record swap would most likely show up as a food landing in the
  // wrong order of magnitude.
  var mustBeHigh = ['Potato, baked with skin', 'Banana', 'Spinach, raw', 'Avocado'];
  mustBeHigh.forEach(function (name) {
    var f = ALL.filter(function (x) { return x.name === name; })[0];
    assert(f && f.nutrients.potassium > 300,
      name + ' should be high-potassium, got ' + (f && f.nutrients.potassium));
  });

  var mustBeLow = ['Hard candy', 'Sugar, white', 'Olive oil'];
  mustBeLow.forEach(function (name) {
    var f = ALL.filter(function (x) { return x.name === name; })[0];
    assert(f && f.nutrients.potassium < 60,
      name + ' should be low-potassium, got ' + (f && f.nutrients.potassium));
  });
});

test('cooked foods are not bound to their dry form', function () {
  /*
   * Regression guard. "Oatmeal, cooked" was originally bound to dry oats and
   * "Lemonade" to the dry powder — off by roughly 5x and 25x. This is the
   * single most damaging silent error in a food database, because the name
   * looks right.
   */
  var cooked = {
    'Oatmeal, cooked': 120,       // cooked cereal is mostly water
    'Lemonade, from powder': 60,  // prepared drink, not the mix
    'White rice, cooked': 200,
    'Spaghetti, cooked': 220,
    'Grits, cooked': 120
  };
  Object.keys(cooked).forEach(function (name) {
    var f = ALL.filter(function (x) { return x.name === name; })[0];
    assert(f, 'missing: ' + name);
    assert(f.nutrients.energy < cooked[name],
      name + ' looks like a dry/concentrated record: ' + f.nutrients.energy +
      ' kcal/100 g (expected < ' + cooked[name] + ')');
  });
});

test('a food whose name says dry is allowed to be energy-dense', function () {
  // The inverse check, so the guard above cannot be satisfied by dropping
  // legitimately concentrated foods.
  var g = ALL.filter(function (x) { return x.name === 'Brown gravy mix, dry'; })[0];
  assert(g && g.nutrients.energy > 200, 'dry mix should be energy-dense');
  assert(/dry/i.test(g.name), 'a dry record must say so in its name');
});

/* ------------------------------------------------------------------ *
 * Portions
 * ------------------------------------------------------------------ */

test('portions are plausible and labelled', function () {
  ALL.forEach(function (f) {
    f.portions.forEach(function (p) {
      assert(p.grams > 0 && p.grams <= 900, f.name + ' portion ' + p.grams + ' g');
      assert(typeof p.label === 'string' && p.label.length > 0, f.name + ' unlabelled portion');
    });
  });
});

test('most foods offer at least one household portion', function () {
  // Typing a gram weight is the worst path for a population where numeracy
  // cannot be assumed, so this should be the exception.
  var withPortions = ALL.filter(function (f) { return f.portions.length > 0; });
  var ratio = withPortions.length / ALL.length;
  assert(ratio > 0.9, 'only ' + Math.round(ratio * 100) + '% have household portions');
});

test('portion labels contain no database jargon', function () {
  /*
   * "NLEA serving" is the Nutrition Labeling and Education Act reference
   * amount. It is standard in USDA data and meaningless to a reader, and this
   * audience cannot be assumed to decode acronyms.
   */
  var jargon = /NLEA|gtin|fdc|\bref\b|not further specified|guideline amount/i;
  ALL.forEach(function (f) {
    f.portions.forEach(function (p) {
      assert(!jargon.test(p.label), f.name + ' has jargon in a portion: "' + p.label + '"');
    });
  });
});

test('the default portion is a sensible household amount', function () {
  /*
   * Whatever sorts first becomes the default. USDA's own order often leads
   * with a tiny unit, which produced a default of "fl oz (31 g)" for milk —
   * an eighth of a glass, silently under-recording anyone who tapped through.
   */
  var expect = {
    'Whole milk': [200, 300],              // a cup, not a fluid ounce
    'White bread': [20, 40],               // a slice
    'Potato, baked with skin': [100, 320], // a potato
    'Cheddar cheese, sliced': [15, 40]     // a slice
  };
  Object.keys(expect).forEach(function (name) {
    var f = ALL.filter(function (x) { return x.name === name; })[0];
    assert(f, 'missing: ' + name);
    var lo = expect[name][0], hi = expect[name][1];
    assert(f.servingGrams >= lo && f.servingGrams <= hi,
      name + ' defaults to ' + f.servingGrams + ' g, expected ' + lo + '-' + hi);
  });
});

test('no food offers more than three built-in portions', function () {
  // More than a handful of chips is a wall of choices on a phone.
  ALL.forEach(function (f) {
    assert(f.portions.length <= 3, f.name + ' has ' + f.portions.length + ' portions');
  });
});

test('servingGrams matches the first portion when one exists', function () {
  ALL.forEach(function (f) {
    if (f.portions.length) {
      assert(f.servingGrams === f.portions[0].grams, 'mismatch on ' + f.name);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

test('search finds foods by plain name', function () {
  assert(C.search('banana').length >= 1);
  assert(C.search('CHICKEN').length >= 2, 'must be case-insensitive');
  assert(C.search('  milk  ').length >= 1, 'must trim');
});

test('search prefers prefix matches', function () {
  // Typing "app" should surface Apple before Pineapple.
  var r = C.search('app');
  assert(r.length >= 2, 'expected several matches');
  assert(/^Apple/.test(r[0].name), 'prefix match should rank first, got ' + r[0].name);
});

test('search returns nothing for an empty or unmatched query', function () {
  assert(C.search('').length === 0);
  assert(C.search('   ').length === 0);
  assert(C.search('zzzzqqq').length === 0);
});

/* ------------------------------------------------------------------ *
 * Interop with the rest of the app
 * ------------------------------------------------------------------ */

test('a library food scales like any other food', function () {
  var banana = C.search('banana')[0];
  var half = Foods.scaleTo(banana, 50);
  assert(Math.abs(half.potassium - banana.nutrients.potassium / 2) < 0.01,
    'scaling must work through the normal path');
});

test('library foods report no ingredient scan, which is not the same as clean', function () {
  // A whole food has no ingredient list to read. Claiming scanned:true with no
  // findings would tell the user we checked and found nothing added.
  ALL.forEach(function (f) {
    assert(f.scan && f.scan.scanned === false, f.name + ' should be scanned:false');
    assert(f.scan.findings.length === 0);
  });
});

test('every food carries its verbatim USDA record for checking', function () {
  ALL.forEach(function (f) {
    assert(typeof f.usdaDescription === 'string' && f.usdaDescription.length > 2,
      'missing provenance: ' + f.name);
  });
});

test('the library is small enough to ship in an offline PWA', function () {
  var bytes = require('fs').statSync(require.resolve('../js/commonfoods.js')).size;
  assert(bytes < 120 * 1024, 'commonfoods.js is ' + Math.round(bytes / 1024) + ' KB');
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
