/*
 * Tests for the bundled offline food library.
 *
 * Run: node test/commonfoods.test.js
 *
 * This is shipped DATA, not logic, and the user acts on it directly, so the
 * tests are mostly invariants about the data itself. The failure that matters
 * is a plausible-looking wrong number: nobody can eyeball 6,010 potassium values,
 * so the guards have to.
 */

'use strict';

var C = require('../js/commonfoods.js');
/*
 * The verbatim USDA descriptions live in a companion file that the browser
 * loads lazily on the portion screen. Requiring it here registers it with the
 * library, so these tests see the same data a user does once that screen has
 * been opened — and the provenance assertions below still have something to
 * assert against.
 */
require('../js/commonfoods-desc.js');
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
  assert(C.count >= 5950, 'expected a useful library, got ' + C.count);
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
    /* A category with a handful of entries reads as broken when tapped, so
     * each group has to be substantial enough to browse. */
    assert(C.byCategory(cat).length >= 20,
      'thin category: ' + cat + ' has only ' + C.byCategory(cat).length);
  });
  /* Rows store a category INDEX, not the string, so go through the decoder —
   * which is also what exercises the interning on every read. */
  var counted = 0;
  C.CATEGORIES.forEach(function (cat) { counted += C.byCategory(cat).length; });
  assert(counted === C.count,
    'categories cover ' + counted + ' of ' + C.count + ' foods');
});

test('the compressed row format round-trips', function () {
  /*
   * Rows intern their category and portion labels and store 0 for a USDA
   * description identical to the name. That cut the file by a fifth, but a
   * decoding slip would silently mislabel every portion — so check the
   * decoded shape rather than trusting the byte count.
   */
  ALL.forEach(function (f) {
    assert(typeof f.usdaDescription === 'string' && f.usdaDescription.length > 1,
      'description did not decode: ' + f.name);
    assert(f.dataType === 'FNDDS' || f.dataType === 'SR Legacy',
      'bad dataType on ' + f.name + ': ' + f.dataType);
    f.portions.forEach(function (p) {
      assert(typeof p.label === 'string' && p.label.length > 0,
        'portion label did not decode on ' + f.name + ': ' + JSON.stringify(p));
      assert(!/^\d+$/.test(p.label),
        'portion label looks like a raw index on ' + f.name + ': ' + p.label);
    });
  });

  var banana = ALL.filter(function (x) { return x.name === 'Banana'; })[0];
  assert(banana.usdaDescription === 'Bananas, raw',
    'expected the verbatim USDA record, got ' + banana.usdaDescription);
  assert(banana.portions[0].label.indexOf('large') !== -1 ||
         banana.portions[0].label.indexOf('cup') !== -1,
    'banana portion label did not decode: ' + banana.portions[0].label);
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

test('composite dishes come from FNDDS, whole foods from SR Legacy', function () {
  /*
   * SR Legacy is an ingredient database — it has ground beef and flour but no
   * shepherd's pie. Three expansions failed to find lasagna, gyros, sushi or
   * pot pie for exactly that reason. FNDDS is the "as consumed" survey
   * database, and its values are for the dish as eaten, which is what someone
   * logging dinner actually needs.
   */
  var dishes = ['Shepherd\'s pie', 'Gyro sandwich', 'Sushi', 'Pho', 'Tamale', 'Pierogi'];
  dishes.forEach(function (name) {
    var f = ALL.filter(function (x) { return x.name === name; })[0];
    assert(f, 'missing composite dish: ' + name);
    assert(f.dataType === 'FNDDS', name + ' should come from FNDDS, got ' + f.dataType);
  });

  var whole = ['Banana', 'Chicken breast, roasted', 'Whole milk'];
  whole.forEach(function (name) {
    var f = ALL.filter(function (x) { return x.name === name; })[0];
    assert(f && f.dataType === 'SR Legacy', name + ' should come from SR Legacy');
  });
});

test('canned and home-recipe versions of a dish are both kept, and distinguishable', function () {
  /*
   * Not accidental duplicates. Canned condensed soup carries roughly twice the
   * sodium of the home-recipe version, and sodium is one of the five tracked
   * nutrients — so both ship and each name says which it is.
   */
  var pairs = [['Beef noodle soup, canned', 'Beef noodle soup, home recipe'],
               ['Minestrone soup, canned', 'Minestrone soup, home recipe']];
  pairs.forEach(function (pair) {
    var canned = ALL.filter(function (x) { return x.name === pair[0]; })[0];
    var home = ALL.filter(function (x) { return x.name === pair[1]; })[0];
    assert(canned && home, 'missing one of ' + pair.join(' / '));
    assert(canned.nutrients.sodium > home.nutrients.sodium,
      pair[0] + ' (' + canned.nutrients.sodium + ') should out-salt ' +
      pair[1] + ' (' + home.nutrients.sodium + ')');
  });
});

test('every food carries its verbatim USDA record for checking', function () {
  ALL.forEach(function (f) {
    assert(typeof f.usdaDescription === 'string' && f.usdaDescription.length > 2,
      'missing provenance: ' + f.name);
  });
});

test('the library is small enough to ship in an offline PWA', function () {
  /*
   * This budget was rewritten when the library moved to on-demand loading.
   *
   * It used to guard COLD START: the file was parsed on every launch, so its
   * size was paid by everyone including people who only wanted to look at
   * yesterday's total. app.js now fetches it the first time the Add screen is
   * opened, so what it costs is the delay on that one deliberate tap — and
   * offline that is a service-worker cache read, not a download.
   *
   * The ceiling is therefore much higher than before, but it is not infinite:
   * a slow phone still has to parse this before the food list appears.
   */
  /*
   * 400 KB was a guess. 600 KB was an extrapolation. This is a measurement.
   *
   * Measured at 605 KB / 5,552 foods: 29 ms to parse, 6 ms to decode every
   * row, 1.2 ms per search, 158 KB gzipped over the wire. The extrapolation
   * predicted 22 ms at 600 KB, so parse is slightly WORSE than linear —
   * which is the useful part of checking.
   *
   * 650 KB is set from that measurement with headroom, not to accommodate a
   * round that overshot. Bytes remain the coarse guard; the decode assertion
   * below is the real one, because what matters is how long the Add screen
   * takes to appear, not how many bytes it is.
   *
   * THE STRUCTURAL FIX IS NOW DONE. `usdaDescription` was ~26% of this file
   * and is read on exactly one screen for one food at a time, so it moved to
   * commonfoods-desc.js, which the portion picker loads on demand. That took
   * the library from 605 KB to 471 KB and the parse from 29 ms to 15 ms
   * without dropping a single food.
   *
   * So this ceiling now has real headroom, and the next expansion can spend
   * it. When it runs out again the answer is NOT another split — it is that
   * the library has outgrown a JS literal and wants a binary format or an
   * index, which is a different piece of work.
   */
  var bytes = require('fs').statSync(require.resolve('../js/commonfoods.js')).size;
  assert(bytes < 650 * 1024,
    'commonfoods.js is ' + Math.round(bytes / 1024) + ' KB raw; past ~650 KB, split ' +
    'usdaDescription into a lazily-loaded file instead of raising this again');

  /*
   * Decoding every row is what the Add screen does on first open. A budget of
   * 400 ms is deliberately loose — this is a guard against an accidental
   * quadratic decode, not a benchmark, and it must not flake on a busy
   * machine. Anything near it means the row format regressed, not that the
   * library grew.
   */
  var t0 = Date.now();
  C.all().forEach(function (f) { return f.nutrients.potassium; });
  var ms = Date.now() - t0;
  assert(ms < 400, 'decoding ' + C.count + ' rows took ' + ms + ' ms');
});

test('descriptions are a separate file, off the search path', function () {
  /*
   * The whole point of the split. If commonfoods-desc.js ever gets a script
   * tag, or gets concatenated back into the library, the 163 KB it holds
   * returns to the Add screen's parse cost to support one line on the portion
   * screen — and it would do so silently, because nothing would break.
   */
  var fs = require('fs');
  var path = require('path');

  var descPath = path.join(__dirname, '..', 'js', 'commonfoods-desc.js');
  assert(fs.existsSync(descPath), 'commonfoods-desc.js should be generated');

  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(!/<script[^>]*commonfoods-desc/i.test(html),
    'index.html must not load the descriptions eagerly');

  var lib = fs.readFileSync(require.resolve('../js/commonfoods.js'), 'utf8');
  assert(lib.indexOf('usdaDescription: row[') === -1,
    'the library must not carry descriptions in its rows again');

  /* Offline it must still be reachable, or the provenance line vanishes on
   * exactly the connection this app was built for. */
  var sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert(sw.indexOf('js/commonfoods-desc.js') !== -1,
    'sw.js must precache the descriptions file');
});

test('app.js actually fetches the descriptions when a portion opens', function () {
  /*
   * The split is only worth anything if the second file still arrives. I tried
   * to verify this in the browser and got a false negative twice: the page was
   * running a disk-cached app.js, so the loader I had just written was not the
   * loader executing. Testing the logic here instead means the disk cache
   * cannot lie about it.
   *
   * This lifts the real loader out of app.js and runs it against a stub
   * document, checking that it injects the right file and resolves with the
   * library once that file registers itself.
   */
  var fs = require('fs');
  var path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

  var m = src.match(/var descPromise = null;[\s\S]*?\n  \}\n/);
  assert(m, 'loadDescriptions() not found in app.js');
  assert(/loadDescriptions\(\)\.then/.test(src),
    'openPortion must call loadDescriptions(), or the provenance line never appears');

  /*
   * Everything below is synchronous on purpose. The test harness is
   * `try { fn(); passed++; }`, so a test that returns a promise is counted as
   * passing before its assertions run — the first version of this test was a
   * false green for exactly that reason. A Promise executor runs synchronously,
   * so the appendChild has already happened by the time loadDescriptions()
   * returns, and that is the part worth asserting.
   */
  /*
   * A FRESH library instance, because this file requires the descriptions at
   * the top and the loader correctly short-circuits when they are already
   * registered. Handing it the module-level `C` tested nothing — it took the
   * early-return path every time.
   */
  delete require.cache[require.resolve('../js/commonfoods.js')];
  var fresh = require('../js/commonfoods.js');
  assert(!fresh.descriptionsLoaded(), 'a fresh library should start without descriptions');

  var appended = null;
  var doc = {
    createElement: function () { return {}; },
    head: { appendChild: function (s) { appended = s; } }
  };
  var loadDescriptions =
    new Function('CommonFoods', 'document', m[0] + '; return loadDescriptions;')(fresh, doc);

  loadDescriptions();
  assert(appended, 'loadDescriptions() injected nothing');
  assert(appended.src === 'js/commonfoods-desc.js',
    'should inject the descriptions file, got ' + appended.src);
  assert(typeof appended.onload === 'function' && typeof appended.onerror === 'function',
    'both handlers must be set, or a missing file hangs the portion screen');

  /* And the file it asks for must actually register descriptions back. */
  assert(C.descriptionsLoaded(), 'descriptions should be registered by now');
  assert(C.describe(173944) === 'Bananas, raw',
    'describe() should return the verbatim USDA record, got ' + C.describe(173944));
});

test('the library is NOT loaded at startup', function () {
  /*
   * The contract that makes the size limit generous: index.html must not have
   * a script tag for commonfoods.js, because app.js fetches it on the first
   * visit to the Add screen. Re-adding the tag would silently put the largest
   * asset back on the cold-start path, where everyone pays for it including
   * people who only opened the app to read yesterday's total.
   *
   * The service worker must still precache it, or the on-demand fetch becomes
   * a network round trip and the app stops working offline.
   */
  var fs = require('fs');
  var path = require('path');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var scriptTags = html.match(/<script[^>]*src=["'][^"']*commonfoods[^"']*["'][^>]*>/gi) || [];
  assert(scriptTags.length === 0,
    'index.html loads commonfoods.js eagerly: ' + scriptTags.join(' '));

  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert(/js\/commonfoods\.js/.test(app), 'app.js no longer fetches the library on demand');

  var sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert(/js\/commonfoods\.js/.test(sw),
    'sw.js must precache the library, or on-demand loading breaks offline');
});

test('parsing the whole library is fast enough to open the Add screen', function () {
  // The real guard behind the size limit. Re-require with a busted cache so
  // this measures an actual parse, not a memoised module lookup.
  var path = require.resolve('../js/commonfoods.js');
  delete require.cache[path];
  var t0 = Date.now();
  require('../js/commonfoods.js');
  var ms = Date.now() - t0;
  assert(ms < 250, 'library took ' + ms + ' ms to parse');
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
