/*
 * log.js — the food log and the daily totals
 *
 * THE HONEST TOTAL
 * ----------------
 * A renal app's daily total is a lie if it silently sums only the foods that
 * happened to have data. If you log 11 foods and 5 of them have no phosphorus
 * value, "412 mg" is not the answer — "at least 412 mg, from 6 of 11 foods"
 * is. Every total this module produces carries its own coverage with it, and
 * the UI is required to display both together.
 *
 * REGULATORY BOUNDARY — READ BEFORE ADDING FEATURES
 * ------------------------------------------------
 * This module deliberately does NOT and MUST NOT:
 *   - store or apply a patient-specific numeric limit
 *   - compare a total against any target or threshold
 *   - raise an alert or warning when a total is "high"
 *   - recommend foods, swaps or substitutions
 *   - estimate or predict a serum lab value
 *
 * Those turn a wellness logbook into patient-facing clinical decision support.
 * FDA's 2022 final CDS guidance removed patient-directed CDS from the non-device
 * carve-out (§520(o)(1)(E)), so each of them is a step toward being a regulated
 * medical device. v1 logs and totals; the care team interprets.
 *
 * Entries snapshot their nutrient values at log time, so a later database
 * correction never silently rewrites a user's history.
 */

(function (root) {
  'use strict';

  var Foods = root.RenalFoods ||
    (typeof require !== 'undefined' ? require('./foods.js') : null);

  var NUTRIENTS = ['energy', 'protein', 'sodium', 'potassium', 'phosphorus'];
  var KEY_PREFIX = 'rl:day:';

  /* ------------------------------------------------------------------ *
   * Dates
   * ------------------------------------------------------------------ */

  /* Local date, not UTC — a 9pm snack must land on today, not tomorrow. */
  function dateKey(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function prettyDate(key) {
    var parts = String(key).split('-');
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return d.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  /* ------------------------------------------------------------------ *
   * Storage
   * ------------------------------------------------------------------ */

  function read(key) {
    try {
      var raw = localStorage.getItem(KEY_PREFIX + key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function write(key, entries) {
    try {
      localStorage.setItem(KEY_PREFIX + key, JSON.stringify(entries));
      return true;
    } catch (e) {
      return false; // quota or private-mode; caller surfaces it
    }
  }

  function allDates() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(KEY_PREFIX) === 0) out.push(k.slice(KEY_PREFIX.length));
      }
    } catch (e) { /* storage unavailable */ }
    return out.sort().reverse();
  }

  /* ------------------------------------------------------------------ *
   * Entries
   * ------------------------------------------------------------------ */

  function newId() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* Condensed snapshot of a scan, so the log stays small but the day view can
   * still show which additives the user ate without re-fetching anything. */
  function condenseScan(scan) {
    if (!scan || !scan.scanned) return { scanned: false, findings: [] };
    return {
      scanned: true,
      findings: scan.findings.map(function (f) {
        return {
          id: f.id, name: f.name, minerals: f.minerals,
          load: f.load, confidence: f.confidence, organic: !!f.organic
        };
      })
    };
  }

  /**
   * Add a food portion to a day.
   * @param {object} food   normalized food record (see foods.js)
   * @param {number} grams  portion weight in grams
   * @param {string} [portionLabel]  what the user picked, e.g. "1 medium (118 g)"
   * @param {string} [key]  date key, defaults to today
   */
  function addFood(food, grams, portionLabel, key) {
    key = key || dateKey();
    var entries = read(key);
    entries.push({
      id: newId(),
      ts: Date.now(),
      type: 'food',
      foodId: food.id,
      source: food.source,
      name: food.name,
      brand: food.brand || '',
      grams: grams,
      portionLabel: portionLabel || (Math.round(grams) + ' g'),
      nutrients: Foods.scaleTo(food, grams),
      scan: condenseScan(food.scan)
    });
    write(key, entries);
    return entries;
  }

  /**
   * Add a drink. Fluid is tracked separately from food because interdialytic
   * weight gain is driven by volume, and soups, gelatin and ice all count.
   */
  function addFluid(name, ml, nutrients, key) {
    key = key || dateKey();
    var entries = read(key);
    entries.push({
      id: newId(),
      ts: Date.now(),
      type: 'fluid',
      name: name,
      ml: ml,
      portionLabel: Math.round(ml) + ' mL',
      nutrients: nutrients || Foods.emptyNutrients(),
      scan: { scanned: false, findings: [] }
    });
    write(key, entries);
    return entries;
  }

  function remove(entryId, key) {
    key = key || dateKey();
    var entries = read(key).filter(function (e) { return e.id !== entryId; });
    write(key, entries);
    return entries;
  }

  /* ------------------------------------------------------------------ *
   * Totals
   * ------------------------------------------------------------------ */

  /**
   * Total a day's entries.
   *
   * @returns {{
   *   totals: Object<string, {
   *     sum: number,          sum of the entries that HAVE a value
   *     known: number,        how many entries contributed
   *     unknown: number,      how many entries had no value for this nutrient
   *     complete: boolean,    true only when nothing is missing
   *     unknownNames: string[]
   *   }>,
   *   fluidMl: number,
   *   entryCount: number,
   *   additives: Array   distinct additives eaten today, with a count each
   * }}
   */
  function totals(entries) {
    var out = {};
    NUTRIENTS.forEach(function (n) {
      out[n] = { sum: 0, known: 0, unknown: 0, complete: true, unknownNames: [] };
    });

    var fluidMl = 0;
    var additiveMap = Object.create(null);

    entries.forEach(function (e) {
      if (e.type === 'fluid') fluidMl += (e.ml || 0);

      NUTRIENTS.forEach(function (n) {
        var v = e.nutrients ? e.nutrients[n] : null;
        if (v === null || v === undefined || isNaN(v)) {
          /* An unknown must never be coerced to 0. This is the whole point. */
          out[n].unknown++;
          out[n].complete = false;
          if (out[n].unknownNames.indexOf(e.name) === -1) {
            out[n].unknownNames.push(e.name);
          }
        } else {
          out[n].sum += v;
          out[n].known++;
        }
      });

      if (e.scan && e.scan.findings) {
        e.scan.findings.forEach(function (f) {
          if (!additiveMap[f.id]) {
            additiveMap[f.id] = {
              id: f.id, name: f.name, minerals: f.minerals,
              load: f.load, confidence: f.confidence, organic: !!f.organic,
              count: 0, foods: []
            };
          }
          additiveMap[f.id].count++;
          if (additiveMap[f.id].foods.indexOf(e.name) === -1) {
            additiveMap[f.id].foods.push(e.name);
          }
        });
      }
    });

    var loadRank = { high: 0, moderate: 1, low: 2 };
    var additives = Object.keys(additiveMap)
      .map(function (k) { return additiveMap[k]; })
      .sort(function (a, b) {
        return (loadRank[a.load] - loadRank[b.load]) || (b.count - a.count);
      });

    return {
      totals: out,
      fluidMl: fluidMl,
      entryCount: entries.length,
      additives: additives
    };
  }

  /**
   * Plain-language coverage sentence for one nutrient. This is the string that
   * makes the app honest, so it is generated here rather than in the view.
   * Descriptive only — it says what we know, never what the number means.
   */
  function coverageNote(stat, nutrientLabel) {
    if (stat.known === 0 && stat.unknown === 0) return '';
    if (stat.complete) {
      return 'All ' + stat.known + ' ' + (stat.known === 1 ? 'item has' : 'items have') +
             ' ' + nutrientLabel + ' data.';
    }
    if (stat.known === 0) {
      return 'None of your ' + stat.unknown + ' ' +
             (stat.unknown === 1 ? 'item has' : 'items have') + ' ' + nutrientLabel +
             ' data. This total is not known.';
    }
    return 'From ' + stat.known + ' of ' + (stat.known + stat.unknown) +
           ' items. ' + stat.unknown + ' ' + (stat.unknown === 1 ? 'item has' : 'items have') +
           ' no ' + nutrientLabel + ' data, so the real amount is higher.';
  }

  /* ------------------------------------------------------------------ *
   * Export — for the facility dietitian
   * ------------------------------------------------------------------ */

  /*
   * The strategic point of the export: every US dialysis facility is required
   * by CMS Conditions for Coverage to staff a renal dietitian. This app is not
   * trying to replace them — it hands them a structured week of food logs that
   * they otherwise have to reconstruct from memory in a 15-minute chairside
   * visit. "?" marks an unknown, never a blank, so the reader cannot mistake a
   * missing value for a zero.
   */
  function toCSV(dateKeys) {
    var rows = [[
      'Date', 'Time', 'Item', 'Brand', 'Portion',
      'Energy (cal)', 'Protein (g)', 'Sodium (mg)',
      'Potassium (mg)', 'Phosphorus (mg)', 'Fluid (mL)',
      'Phosphate additives', 'Potassium additives', 'Source'
    ]];

    dateKeys.forEach(function (key) {
      read(key).forEach(function (e) {
        var n = e.nutrients || {};
        var cell = function (v, dp) {
          return (v === null || v === undefined || isNaN(v))
            ? '?' : String(Math.round(v * Math.pow(10, dp || 0)) / Math.pow(10, dp || 0));
        };
        var byMineral = function (m) {
          return ((e.scan && e.scan.findings) || [])
            .filter(function (f) { return f.minerals.indexOf(m) !== -1; })
            .map(function (f) { return f.name; }).join('; ');
        };
        rows.push([
          key,
          new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          e.name, e.brand || '', e.portionLabel || '',
          cell(n.energy), cell(n.protein, 1), cell(n.sodium),
          cell(n.potassium), cell(n.phosphorus),
          e.type === 'fluid' ? Math.round(e.ml) : '',
          byMineral('phosphorus'), byMineral('potassium'),
          e.source || ''
        ]);
      });
    });

    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c === null || c === undefined ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
  }

  var api = {
    NUTRIENTS: NUTRIENTS,
    dateKey: dateKey,
    prettyDate: prettyDate,
    read: read,
    write: write,
    allDates: allDates,
    addFood: addFood,
    addFluid: addFluid,
    remove: remove,
    totals: totals,
    coverageNote: coverageNote,
    toCSV: toCSV,
    condenseScan: condenseScan
  };

  root.RenalLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
