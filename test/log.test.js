/*
 * Tests for totals, unit conversion and export.
 *
 * Run: node test/log.test.js
 *
 * The behavior under test is the one every competitor gets wrong: an unknown
 * nutrient value must never be counted as zero, and the daily total must carry
 * its own coverage so the user can see how much of it is missing.
 */

'use strict';

/* Minimal localStorage stub — log.js is browser code. */
var store = Object.create(null);
global.localStorage = {
  getItem: function (k) { return k in store ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  key: function (i) { return Object.keys(store)[i] || null; },
  clear: function () { store = Object.create(null); },
  get length() { return Object.keys(store).length; }
};

var Foods = require('../js/foods.js');
var Log = require('../js/log.js');
var Units = require('../js/units.js');

var passed = 0;
var failed = [];

function test(name, fn) {
  try { store = Object.create(null); fn(); passed++; }
  catch (err) { failed.push({ name: name, message: err.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function close(a, b, tol, msg) {
  assert(Math.abs(a - b) <= (tol || 0.01), (msg || 'expected ' + b) + ', got ' + a);
}

function food(name, nutrients, scan) {
  return Foods.makeFood({
    id: 'test:' + name, source: 'usda', name: name,
    nutrients: Object.assign(Foods.emptyNutrients(), nutrients),
    scan: scan || null
  });
}

/* ------------------------------------------------------------------ *
 * The core invariant: unknown is not zero
 * ------------------------------------------------------------------ */

test('a missing nutrient is null, not zero, on a fresh record', function () {
  var n = Foods.emptyNutrients();
  Log.NUTRIENTS.forEach(function (k) {
    assert(n[k] === null, k + ' should start null, got ' + n[k]);
  });
});

test('scaling preserves null — an unknown scaled by a portion is still unknown', function () {
  var f = food('Mystery bar', { energy: 400, potassium: 200 }); // phosphorus null
  var scaled = Foods.scaleTo(f, 50);
  close(scaled.energy, 200, 0.01, 'energy should halve');
  close(scaled.potassium, 100, 0.01, 'potassium should halve');
  assert(scaled.phosphorus === null, 'phosphorus must stay null, got ' + scaled.phosphorus);
});

test('scaling by zero grams still yields null, not 0, for unknowns', function () {
  var scaled = Foods.scaleTo(food('X', { energy: 100 }), 0);
  assert(scaled.energy === 0, 'known value scaled to 0 g is genuinely 0');
  assert(scaled.phosphorus === null, 'unknown must not become 0');
});

test('a genuine analytical zero is kept as 0, not treated as missing', function () {
  // Raw banana really does contain 0 mg sodium. That is data, not absence.
  var scaled = Foods.scaleTo(food('Banana', { sodium: 0, potassium: 326 }), 100);
  assert(scaled.sodium === 0, 'real zero must survive');
  var t = Log.totals([{ name: 'Banana', nutrients: scaled }]);
  assert(t.totals.sodium.known === 1, 'a real zero counts as known');
  assert(t.totals.sodium.unknown === 0);
});

test('daily total reports coverage, and does not sum unknowns as zero', function () {
  Log.addFood(food('Banana', { potassium: 326, phosphorus: 22 }), 100, '1 medium');
  Log.addFood(food('Protein bar', { potassium: 200 }), 100, '1 bar'); // no phosphorus
  Log.addFood(food('Frozen dinner', {}), 300, '1 tray');              // nothing at all

  var t = Log.totals(Log.read(Log.dateKey()));

  close(t.totals.phosphorus.sum, 22, 0.01, 'only the known phosphorus is summed');
  assert(t.totals.phosphorus.known === 1, 'known count');
  assert(t.totals.phosphorus.unknown === 2, 'unknown count');
  assert(t.totals.phosphorus.complete === false, 'must be flagged incomplete');
  assert(t.totals.phosphorus.unknownNames.length === 2, 'names the foods with no data');

  close(t.totals.potassium.sum, 526, 0.01);
  assert(t.totals.potassium.unknown === 1);
});

test('coverage note tells the user the real amount is higher', function () {
  var t = Log.totals([
    { name: 'A', nutrients: { phosphorus: 100 } },
    { name: 'B', nutrients: { phosphorus: null } }
  ]);
  var note = Log.coverageNote(t.totals.phosphorus, 'phosphorus');
  assert(/2 items/.test(note), 'should state the denominator: ' + note);
  assert(/higher/.test(note), 'should say the real amount is higher: ' + note);
});

test('coverage note handles the all-unknown case without claiming a total', function () {
  var t = Log.totals([{ name: 'A', nutrients: { phosphorus: null } }]);
  var note = Log.coverageNote(t.totals.phosphorus, 'phosphorus');
  assert(/not known/.test(note), 'should say the total is not known: ' + note);
});

test('coverage note is clean when everything is known', function () {
  var t = Log.totals([{ name: 'A', nutrients: { phosphorus: 100 } }]);
  assert(t.totals.phosphorus.complete === true);
  assert(/All 1 item has/.test(Log.coverageNote(t.totals.phosphorus, 'phosphorus')));
});

/* ------------------------------------------------------------------ *
 * Date labels
 * ------------------------------------------------------------------ */

/* History is a log someone keeps for years. Without the year, a card from
 * 2025-08-19 and one from 2026-08-19 both read "Tuesday, August 19". */
test('a date in another year is labelled with its year', function () {
  var s = Log.prettyDate('2025-08-19', 2026);
  assert(/2025/.test(s), 'expected the year in "' + s + '"');
});

test('a date in the current year is not cluttered with the year', function () {
  var s = Log.prettyDate('2026-08-19', 2026);
  assert(!/2026/.test(s), 'the Today header should not carry the year: "' + s + '"');
});

test('two same-day dates in different years render differently', function () {
  assert(Log.prettyDate('2025-08-19', 2026) !== Log.prettyDate('2026-08-19', 2026),
    'August 19 of two different years must not render identically');
});

test('the date label round-trips the day it was given', function () {
  /* Guards the off-by-one that month-indexing invites. */
  assert(/\b1\b/.test(Log.prettyDate('2026-01-01', 2026)), 'Jan 1 lost its day');
  assert(/January/.test(Log.prettyDate('2026-01-01', 2026)), 'Jan 1 lost its month');
  assert(/February 29/.test(Log.prettyDate('2024-02-29', 2024)), 'leap day mangled');
});

/* ------------------------------------------------------------------ *
 * Entries, fluid, additive rollup
 * ------------------------------------------------------------------ */

test('fluid is totalled separately from food', function () {
  Log.addFluid('Coffee', 240);
  Log.addFluid('Water', 500);
  var t = Log.totals(Log.read(Log.dateKey()));
  close(t.fluidMl, 740, 0.01);
  assert(t.entryCount === 2);
});

/*
 * Water was the loudest false alarm in the app. Six glasses of it — an entirely
 * ordinary dialysis day — turned the day's phosphorus into "at least 20 mg,
 * from 1 of 7 items", and the "which items have no phosphorus data?" list
 * answered "Water". A coverage counter that cries wolf on water trains the user
 * to ignore it on the frozen dinner, which is the one that actually matters.
 */
test('water does not count as missing potassium or phosphorus data', function () {
  Log.addFluid('Water', 237);
  var t = Log.totals(Log.read(Log.dateKey()));
  ['potassium', 'phosphorus'].forEach(function (n) {
    assert(t.totals[n].unknown === 0,
      'water should not be missing ' + n + ' data, got unknown=' + t.totals[n].unknown);
    assert(t.totals[n].complete, n + ' should read as complete with only water logged');
    assert(t.totals[n].unknownNames.indexOf('Water') === -1,
      'water must not appear in the "no ' + n + ' data" list');
  });
});

/* The other half of the same fix: water's sodium really is unknown. Municipal
 * sodium varies by source, and an ion-exchange softener trades calcium for
 * sodium and can add 100+ mg/L. Zeroing it would be the opposite error. */
test('water still counts as missing sodium data', function () {
  Log.addFluid('Water', 237);
  var t = Log.totals(Log.read(Log.dateKey()));
  assert(t.totals.sodium.unknown === 1,
    'water sodium should stay unknown, got unknown=' + t.totals.sodium.unknown);
  assert(!t.totals.sodium.complete, 'sodium should not read as complete');
});

/* Everything that is not water stays fully unknown, and that is the point:
 * "Juice" could be 500 mg of potassium, "Milk" is ~230 mg of phosphorus a cup,
 * "Soda" could be a dark cola carrying phosphoric acid. Volume is all we know. */
test('drinks other than water stay unknown on every nutrient', function () {
  ['Coffee', 'Tea', 'Juice', 'Soda', 'Milk', 'Soup', 'Other'].forEach(function (d) {
    store = Object.create(null);
    Log.addFluid(d, 237);
    var t = Log.totals(Log.read(Log.dateKey()));
    Log.NUTRIENTS.forEach(function (n) {
      assert(t.totals[n].unknown === 1,
        d + ' should be unknown for ' + n + ', got unknown=' + t.totals[n].unknown);
    });
  });
});

/* The volume-only fluid entries must not silently become a nutrient source
 * either — a real food logged alongside water is still the only contributor. */
test('water contributes no phosphorus to the sum it is counted in', function () {
  Log.addFood(food('Apple', { phosphorus: 11, potassium: 107 }), 100, '1 medium');
  Log.addFluid('Water', 237);
  var t = Log.totals(Log.read(Log.dateKey()));
  close(t.totals.phosphorus.sum, 11, 0.01, 'water added phosphorus to the total');
  assert(t.totals.phosphorus.known === 2, 'both entries should count as known');
  assert(t.totals.phosphorus.complete, 'the day should read as complete');
});

test('entries snapshot their values, so a later data change cannot rewrite history', function () {
  var f = food('Yogurt', { phosphorus: 150 });
  Log.addFood(f, 100, '1 cup');
  f.nutrients.phosphorus = 999; // database "correction" after the fact
  var t = Log.totals(Log.read(Log.dateKey()));
  close(t.totals.phosphorus.sum, 150, 0.01, 'logged value must not change');
});

test('additives roll up across the day with counts', function () {
  var scan = {
    scanned: true,
    findings: [
      { id: 'tripolyphosphate', name: 'STPP', minerals: ['phosphorus'], load: 'high', confidence: 'definite' },
      { id: 'potassium-sorbate', name: 'K sorbate', minerals: ['potassium'], load: 'low', confidence: 'definite' }
    ]
  };
  Log.addFood(food('Chicken', { phosphorus: 200 }, scan), 100, '4 oz');
  Log.addFood(food('Ham', { phosphorus: 180 }, scan), 100, '3 oz');

  var t = Log.totals(Log.read(Log.dateKey()));
  assert(t.additives.length === 2, 'two distinct additives');
  assert(t.additives[0].load === 'high', 'highest load sorts first');
  assert(t.additives[0].count === 2, 'counted in both foods');
  assert(t.additives[0].foods.length === 2, 'lists both foods');
});

test('removing an entry updates the total', function () {
  var entries = Log.addFood(food('A', { potassium: 100 }), 100, '1');
  Log.addFood(food('B', { potassium: 50 }), 100, '1');
  Log.remove(entries[0].id);
  var t = Log.totals(Log.read(Log.dateKey()));
  close(t.totals.potassium.sum, 50, 0.01);
});

/* ------------------------------------------------------------------ *
 * Unit conversions — a patient-safety surface
 * ------------------------------------------------------------------ */

test('potassium mg <-> mmol <-> mEq', function () {
  close(Units.mgToMmol(391, 'potassium'), 10.0, 0.01, '391 mg K = 10 mmol');
  close(Units.mmolToMg(10, 'potassium'), 390.98, 0.01);
  // Potassium is monovalent, so mmol and mEq are numerically equal.
  close(Units.mgToMeq(391, 'potassium'), Units.mgToMmol(391, 'potassium'), 0.001);
});

test('phosphorus mg -> mmol', function () {
  close(Units.mgToMmol(100, 'phosphorus'), 3.229, 0.001, '100 mg P = 3.23 mmol');
});

test('phosphorus has no mEq, and asking for one falls back to mg', function () {
  // Phosphate carries mixed valence at physiological pH; an mEq figure would be
  // meaningless, so we refuse rather than print a wrong number.
  assert(Units.mgToMeq(100, 'phosphorus') === null, 'must refuse the conversion');
  assert(Units.format(100, 'phosphorus', 'mEq') === '100 mg', 'must fall back to mg');
});

test('salt grams <-> sodium mg', function () {
  close(Units.saltGToSodiumMg(1), 393.4, 0.1, '1 g salt = 393 mg sodium');
  close(Units.sodiumMgToSaltG(2300), 5.846, 0.01);
});

test('fluid volumes', function () {
  close(Units.flOzToMl(8), 236.6, 0.1, '8 fl oz = 237 mL');
  close(Units.cupsToMl(1), 236.6, 0.1);
});

test('formatting never prints a bare number without its unit', function () {
  assert(Units.format(326, 'potassium', 'mg') === '326 mg');
  assert(Units.format(326, 'potassium', 'mmol') === '8.3 mmol');
  assert(Units.format(326, 'potassium', 'mEq') === '8.3 mEq');
});

test('formatting an unknown shows a dash, never 0', function () {
  assert(Units.format(null, 'phosphorus', 'mg') === '—', 'null must render as a dash');
  assert(Units.format(undefined, 'potassium', 'mg') === '—');
  assert(Units.formatFluid(null) === '—');
});

/* ------------------------------------------------------------------ *
 * Open Food Facts unit handling — a 1000x bug if wrong
 * ------------------------------------------------------------------ */

test('OFF gram-based minerals convert to mg', function () {
  // Verified against live OFF data: potassium_100g = 0.10714 with unit "g"
  // means 107 mg per 100 g. Reading it as mg would under-report 1000-fold.
  var mg = Foods.offMineralMg({ potassium_100g: 0.10714, potassium_unit: 'g' }, 'potassium');
  close(mg, 107.14, 0.01);
});

test('OFF values already in mg are not double-converted', function () {
  close(Foods.offMineralMg({ potassium_100g: 107, potassium_unit: 'mg' }, 'potassium'), 107, 0.01);
});

test('OFF missing mineral yields null, not 0', function () {
  assert(Foods.offMineralMg({}, 'phosphorus') === null);
  assert(Foods.offMineralMg({ phosphorus_100g: '' }, 'phosphorus') === null);
});

test('junk values are rejected rather than becoming 0', function () {
  assert(Foods.num('abc') === null);
  assert(Foods.num(-5) === null, 'negative nutrient is bad data');
  assert(Foods.num(0) === 0, 'zero is a legitimate value');
});

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

test('CSV marks unknowns with ? so they cannot be read as zero', function () {
  Log.addFood(food('Frozen dinner', { potassium: 400 }), 300, '1 tray'); // P unknown
  var csv = Log.toCSV([Log.dateKey()]);
  var line = csv.split('\n')[1];
  assert(line.indexOf('?') !== -1, 'unknown phosphorus must appear as ?: ' + line);
  assert(line.indexOf('Frozen dinner') !== -1);
});

test('CSV escapes commas in food names', function () {
  Log.addFood(food('Bananas, raw', { potassium: 326 }), 100, '1');
  var csv = Log.toCSV([Log.dateKey()]);
  assert(csv.indexOf('"Bananas, raw"') !== -1, 'name with a comma must be quoted');
});

test('CSV lists the additives found in each item', function () {
  Log.addFood(food('Ham', { phosphorus: 200 }, {
    scanned: true,
    findings: [{ id: 'tripolyphosphate', name: 'STPP', minerals: ['phosphorus'], load: 'high', confidence: 'definite' }]
  }), 100, '3 oz');
  assert(Log.toCSV([Log.dateKey()]).indexOf('STPP') !== -1);
});

test('CSV keeps additive tiers apart instead of lumping them by mineral', function () {
  /*
   * The export is the surface a dietitian actually acts on, so it is the worst
   * place to lose the tier distinction — and it did, for a while. Two columns
   * filled by mineral produced:
   *
   *   Sodium phosphate; Lecithin  |  Potassium chloride; Potassium sorbate
   *
   * which reads as two phosphate additives and two potassium additives of
   * equal standing. Sodium phosphate is a bulk inorganic salt absorbed at
   * ~100%; lecithin is organic, trace, and per Picard 2023 not associated with
   * higher product phosphorus. Potassium chloride is 52.5% potassium used in
   * bulk; potassium sorbate is a preservative under 0.3% of the product.
   */
  var scan = {
    scanned: true,
    findings: [
      { id: 'sodium-phosphate', name: 'Sodium phosphate', minerals: ['phosphorus'],
        klass: 'inorganic-phosphate', load: 'high', confidence: 'definite' },
      { id: 'modified-starch', name: 'Modified food starch', minerals: ['phosphorus'],
        klass: 'phosphated-starch', load: 'low', confidence: 'possible' },
      { id: 'lecithin', name: 'Lecithin', minerals: ['phosphorus'],
        klass: 'organic-phosphorus', load: 'low', confidence: 'definite', organic: true },
      { id: 'potassium-chloride', name: 'Potassium chloride', minerals: ['potassium'],
        klass: 'material-potassium', load: 'high', confidence: 'definite' },
      { id: 'potassium-sorbate', name: 'Potassium sorbate', minerals: ['potassium'],
        klass: 'trivial-potassium', load: 'low', confidence: 'definite' }
    ]
  };
  Log.addFood(food('Tiered turkey', { phosphorus: 100 }, scan), 100, '2 slices');

  var lines = Log.toCSV([Log.dateKey()]).split('\n');
  var head = lines[0].split(',');
  var row = lines.filter(function (l) { return l.indexOf('Tiered turkey') !== -1; })[0];
  assert(row, 'exported row not found');

  function cell(colName) {
    var i = head.indexOf(colName);
    assert(i !== -1, 'no column named ' + colName + ' in: ' + head.join('|'));
    /* Naive split is fine — none of these cells contain a comma. */
    return row.split(',')[i];
  }

  assert(cell('Added phosphate (absorbed ~100%)').indexOf('Sodium phosphate') !== -1,
    'the inorganic salt belongs in the added-phosphate column');
  assert(cell('Added phosphate (absorbed ~100%)').indexOf('Lecithin') === -1,
    'lecithin must NOT sit beside an added phosphate salt');
  assert(cell('Phosphorus from ingredients').indexOf('Lecithin') !== -1,
    'lecithin belongs in the organic column');
  /*
   * Both directions. Asserting only "the right thing is here" passes happily
   * when a column ALSO collects things that do not belong — which is exactly
   * how the columns got mixed in the first place.
   */
  assert(cell('Phosphorus from ingredients').indexOf('Sodium phosphate') === -1,
    'an added phosphate salt must not also appear as organic phosphorus');
  assert(cell('Trace potassium').indexOf('Potassium chloride') === -1,
    'a bulk potassium salt must not also appear as trace');
  assert(cell('Possible added phosphate').indexOf('Sodium phosphate') === -1,
    'a confirmed salt must not also appear as merely possible');
  assert(cell('Possible added phosphate').indexOf('Modified food starch') !== -1,
    'an unconfirmed starch belongs in its own column');
  assert(cell('Added potassium').indexOf('Potassium chloride') !== -1);
  assert(cell('Added potassium').indexOf('Potassium sorbate') === -1,
    'a trace preservative must never read as added potassium');
  assert(cell('Trace potassium').indexOf('Potassium sorbate') !== -1);
});

test('CSV still exports pre-tier entries rather than dropping them', function () {
  /*
   * Entries logged before the dictionary carried a class have klass
   * undefined. They must still export — less specifically, but truthfully —
   * because they are already in someone's history.
   */
  Log.addFood(food('Old entry', { phosphorus: 50 }, {
    scanned: true,
    findings: [{ id: 'x', name: 'Legacy phosphate', minerals: ['phosphorus'],
                 load: 'high', confidence: 'definite' }]
  }), 100, '1');
  var csv = Log.toCSV([Log.dateKey()]);
  assert(csv.indexOf('Legacy phosphate') !== -1,
    'a finding with no class must still appear somewhere in the export');
});

/* ------------------------------------------------------------------ *
 * Regulatory boundary — these must NOT exist in v1
 * ------------------------------------------------------------------ */

test('the log module exposes no limits, targets, alerts or lab prediction', function () {
  var forbidden = ['limit', 'target', 'goal', 'threshold', 'alert', 'warn',
                   'recommend', 'suggest', 'predict', 'estimateSerum'];
  var names = Object.keys(Log).map(function (k) { return k.toLowerCase(); });
  forbidden.forEach(function (word) {
    names.forEach(function (n) {
      assert(n.indexOf(word) === -1,
        'log.js must not expose "' + n + '" — patient-specific decision support ' +
        'moves this app toward FDA device regulation');
    });
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
