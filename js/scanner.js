/*
 * scanner.js — ingredient-string additive scanner
 *
 * Takes the printed ingredient list off a package and reports which added
 * phosphate and potassium compounds appear in it.
 *
 * Design rules, in priority order:
 *
 *  1. NO NUMBERS. This module never produces a milligram estimate. Ingredient
 *     lists are ordered by weight but not quantified; any mg figure derived
 *     from one would be invented. We report presence and plausibility only.
 *
 *  2. LONGEST MATCH WINS. "sodium tripolyphosphate" must report as STPP, not
 *     as three overlapping hits including the generic "phosphate".
 *
 *  3. GENERICS ONLY FILL GAPS. The catch-all 'phosphate' / 'potassium' entries
 *     are suppressed wherever a specific entry already covered that text.
 *
 *  4. ATTRIBUTE TO THE INGREDIENT. Users trust a flag they can verify against
 *     the package, so every finding carries the ingredient phrase it came from.
 */

(function (root) {
  'use strict';

  var Additives = root.RenalAdditives ||
    (typeof require !== 'undefined' ? require('./additives.js') : null);

  /* ------------------------------------------------------------------ *
   * Normalization
   * ------------------------------------------------------------------ */

  /*
   * Ingredient text arrives with unicode dashes, accents, asterisks, footnote
   * markers, percentages and inconsistent E-number spellings ("E 450", "E-450",
   * "INS 450"). Flatten all of it to lowercase alphanumerics separated by single
   * spaces so patterns only have to describe the words.
   */
  function normalize(text) {
    if (!text) return '';
    var s = String(text).toLowerCase();

    // Strip accents (jalapeño -> jalapeno) without needing a lookup table.
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');

    // Unify every dash-like character to a plain hyphen first.
    s = s.replace(/[‐-―−]/g, '-');

    // Collapse E-number / INS spellings: "e 450", "e-450", "ins 450" -> "e450".
    s = s.replace(/\b(?:e|ins)[\s-]*(\d{3,4}[a-z]?)\b/g, 'e$1');

    // Everything that is not a letter or digit becomes a separator.
    s = s.replace(/[^a-z0-9]+/g, ' ');

    return s.trim();
  }

  /*
   * Split an ingredient list into individual ingredient phrases so findings can
   * be attributed. Parentheses are treated as separators too, which means
   * "Sodium Phosphates (Sodium Tripolyphosphate, Tetrasodium Pyrophosphate)"
   * yields three phrases and each sub-compound is reported on its own. That is
   * the behavior we want — the sub-compounds are the specific, actionable ones.
   */
  function splitIngredients(text) {
    if (!text) return [];
    return String(text)
      .split(/[,;()\[\]{}]|\band\b|\bcontains\b|\bplus\b|\.\s|\n/i)
      .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return s.length > 1; });
  }

  /* ------------------------------------------------------------------ *
   * Pattern compilation
   * ------------------------------------------------------------------ */

  /*
   * A pattern is authored as plain words ("sodium tripolyphosphate"). We compile
   * it against the NORMALIZED string, so:
   *   - spaces become \s+ (already single spaces, but keeps us tolerant)
   *   - the final word gets an optional plural 's'
   *   - \b anchors prevent "potassium" matching inside a longer word
   *
   * E-numbers are normalized to e450 form before this runs, so 'e450' is a
   * literal match.
   */
  function compile(pattern) {
    var words = normalize(pattern).split(' ').filter(Boolean);
    if (!words.length) return null;
    var body = words.map(function (w, i) {
      var esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return i === words.length - 1 ? esc + 's?' : esc;
    }).join('\\s+');
    return new RegExp('\\b' + body + '\\b', 'g');
  }

  var COMPILED = null;
  function compiled() {
    if (COMPILED) return COMPILED;
    COMPILED = [];
    Additives.all.forEach(function (add) {
      add.patterns.forEach(function (p) {
        var re = compile(p);
        if (re) COMPILED.push({ additive: add, source: p, re: re });
      });
    });
    return COMPILED;
  }

  /* ------------------------------------------------------------------ *
   * Core scan
   * ------------------------------------------------------------------ */

  function matchesIn(normalizedPhrase) {
    var hits = [];
    compiled().forEach(function (entry) {
      entry.re.lastIndex = 0;
      var m;
      while ((m = entry.re.exec(normalizedPhrase)) !== null) {
        hits.push({
          additive: entry.additive,
          start: m.index,
          end: m.index + m[0].length,
          text: m[0]
        });
        if (m[0].length === 0) entry.re.lastIndex++; // paranoia against zero-width
      }
    });
    return hits;
  }

  /*
   * Resolve overlaps. Sort by span length descending, then keep a hit only if
   * its span is not already covered by an accepted longer hit.
   *
   * Two hits from DIFFERENT additives that merely touch are both kept — only
   * true containment suppresses. This is what makes "potassium phosphate"
   * report once as the dual-mineral compound rather than as
   * "potassium" + "phosphate".
   */
  function resolveOverlaps(hits) {
    var sorted = hits.slice().sort(function (a, b) {
      var lenDiff = (b.end - b.start) - (a.end - a.start);
      if (lenDiff !== 0) return lenDiff;
      // Specific entries beat generic ones at equal length.
      if (!!a.additive.generic !== !!b.additive.generic) return a.additive.generic ? 1 : -1;
      return a.start - b.start;
    });

    var kept = [];
    sorted.forEach(function (hit) {
      var covered = kept.some(function (k) {
        return hit.start >= k.start && hit.end <= k.end;
      });
      if (!covered) kept.push(hit);
    });
    return kept;
  }

  /**
   * Scan an ingredient string.
   *
   * @param {string} ingredientsText  the printed ingredient list
   * @param {object} [opts]
   * @param {string[]} [opts.additivesTags]  pre-parsed E-number tags (e.g. from
   *        Open Food Facts, "en:e451"). Used as a supplementary signal only —
   *        they are appended to the text so they run through the same matcher.
   * @returns {{
   *   scanned: boolean,          false when there was no ingredient list to read
   *   findings: Array,           one entry per distinct additive found
   *   phosphorus: Array,         findings contributing phosphorus
   *   potassium: Array,          findings contributing potassium
   *   uncertain: Array,          findings whose confidence is 'possible'
   *   ingredientCount: number
   * }}
   */
  function scan(ingredientsText, opts) {
    opts = opts || {};

    var text = ingredientsText || '';
    if (opts.additivesTags && opts.additivesTags.length) {
      // "en:e451" -> "e451"; harmless if the tags are already bare.
      text += ', ' + opts.additivesTags
        .map(function (t) { return String(t).replace(/^[a-z]{2}:/, ''); })
        .join(', ');
    }

    if (!String(text).trim()) {
      return {
        scanned: false,
        findings: [],
        phosphorus: [],
        potassium: [],
        uncertain: [],
        ingredientCount: 0
      };
    }

    var phrases = splitIngredients(text);
    var byId = Object.create(null);

    phrases.forEach(function (phrase) {
      var norm = normalize(phrase);
      if (!norm) return;
      resolveOverlaps(matchesIn(norm)).forEach(function (hit) {
        var add = hit.additive;
        if (!byId[add.id]) {
          byId[add.id] = {
            id: add.id,
            name: add.name,
            minerals: add.minerals,
            confidence: add.confidence,
            load: add.load,
            organic: !!add.organic,
            note: add.note,
            generic: !!add.generic,
            sources: []
          };
        }
        if (byId[add.id].sources.indexOf(phrase) === -1) {
          byId[add.id].sources.push(phrase);
        }
      });
    });

    /*
     * Cross-phrase generic suppression. A generic hit is dropped if ANY specific
     * additive for the same mineral was found anywhere in the list. Without
     * this, "Sodium Phosphates (Sodium Tripolyphosphate)" reports the generic
     * from phrase 1 alongside the specific from phrase 2, which reads as two
     * separate additives to the user.
     */
    var found = Object.keys(byId).map(function (k) { return byId[k]; });
    var specificMinerals = Object.create(null);
    found.forEach(function (f) {
      if (!f.generic) f.minerals.forEach(function (m) { specificMinerals[m] = true; });
    });
    found = found.filter(function (f) {
      if (!f.generic) return true;
      return !f.minerals.every(function (m) { return specificMinerals[m]; });
    });

    // Most concerning first: high load, then definite confidence.
    var loadRank = { high: 0, moderate: 1, low: 2 };
    var confRank = { definite: 0, likely: 1, possible: 2 };
    found.sort(function (a, b) {
      return (loadRank[a.load] - loadRank[b.load]) ||
             (confRank[a.confidence] - confRank[b.confidence]) ||
             a.name.localeCompare(b.name);
    });

    var has = function (mineral) {
      return found.filter(function (f) { return f.minerals.indexOf(mineral) !== -1; });
    };

    return {
      scanned: true,
      findings: found,
      phosphorus: has('phosphorus'),
      potassium: has('potassium'),
      uncertain: found.filter(function (f) { return f.confidence === 'possible'; }),
      ingredientCount: phrases.length
    };
  }

  /**
   * Plain-language one-line summary of a scan, for list rows.
   * Deliberately descriptive, never directive — it says what is in the food,
   * not what the user should do about it.
   */
  function summarize(result) {
    if (!result.scanned) return 'No ingredient list available to check.';
    if (!result.findings.length) return 'No added phosphate or potassium found in the ingredients.';

    var parts = [];
    var p = result.phosphorus.filter(function (f) { return f.confidence !== 'possible'; }).length;
    var k = result.potassium.filter(function (f) { return f.confidence !== 'possible'; }).length;
    if (p) parts.push(p + ' phosphorus ' + (p === 1 ? 'additive' : 'additives'));
    if (k) parts.push(k + ' potassium ' + (k === 1 ? 'additive' : 'additives'));
    if (!parts.length && result.uncertain.length) return 'Possible added phosphate — the label is not specific.';
    return 'Found ' + parts.join(' and ') + '.';
  }

  var api = {
    scan: scan,
    summarize: summarize,
    normalize: normalize,
    splitIngredients: splitIngredients
  };

  root.RenalScanner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
