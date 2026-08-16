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

    /*
     * Nucleotide additives are printed as "disodium 5'-inosinate" with a
     * prime, an apostrophe, or a right single quote depending on the
     * typesetter. Strip the position marker so all three spellings collapse
     * onto the same token before matching.
     */
    s = s.replace(/\b(\d)\s*['’ʹ′]\s*-?\s*/g, '');

    /*
     * British spelling appears on imported and bilingual labels. "Sodium
     * aluminium phosphate" and "potassium metabisulphite" are the same
     * additives as their American spellings and must not need duplicate
     * patterns in the dictionary.
     */
    s = s.replace(/\baluminium\b/g, 'aluminum')
         .replace(/sulph/g, 'sulf')
         .replace(/\boxidised\b/g, 'oxidized');

    // Collapse E-number / INS spellings: "e 450", "e-450", "ins 450" -> "e450".
    s = s.replace(/\b(?:e|ins)[\s-]*(\d{3,4}[a-z]?)\b/g, 'e$1');

    /*
     * Roman-numeral sub-forms: "E450(i)" and "E 450 i" both mean SAPP, and
     * the dictionary keys them as "e450i".
     */
    s = s.replace(/\b(e\d{3,4})\s*\(?\s*(i{1,3}|iv|v)\s*\)?(?![a-z])/g, '$1$2');

    // Everything that is not a letter or digit becomes a separator.
    s = s.replace(/[^a-z0-9]+/g, ' ');

    return s.trim();
  }

  /*
   * Remove allergen and advisory blocks before matching.
   *
   * A package carries text that LOOKS like an ingredient list and is not:
   *   "Contains: Milk, Soy."
   *   "May contain traces of peanuts."
   *   "Manufactured in a facility that also processes wheat."
   * Scanning those would attribute an additive to a food that does not contain
   * it — a false positive of the worst kind, because the user can check the
   * package and see we were wrong.
   *
   * The cut is deliberately anchored to the START of a clause, so a genuine
   * "soy lecithin" sitting in the real ingredient list is untouched. Only the
   * advisory clause itself is dropped, not the rest of the label.
   */
  var ADVISORY = /(^|[.;\n])\s*(?:contains\s*:|may contain|manufactured (?:in|on)|produced in|packed in|processed in|allergen(?:s)?\s*:|allergy (?:advice|information))\b[^.;\n]*/gi;

  function stripAdvisory(text) {
    if (!text) return '';
    return String(text).replace(ADVISORY, '$1 ');
  }

  /*
   * Split an ingredient list into individual ingredient phrases so findings can
   * be attributed. Parentheses are treated as separators too, which means
   * "Sodium Phosphates (Sodium Tripolyphosphate, Tetrasodium Pyrophosphate)"
   * yields three phrases and each sub-compound is reported on its own. That is
   * the behavior we want — the sub-compounds are the specific, actionable ones.
   *
   * Note what is NOT split away: the contents of parentheses are retained as
   * scannable tokens. 21 CFR 101.4(b)(2) puts compound-ingredient sub-lists
   * there — "enriched flour (wheat flour, ..., monocalcium phosphate)" — and
   * discarding them would miss a whole class of additives.
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

    var scannable = stripAdvisory(text);

    /*
     * 21 CFR 101.4(a)(2) lets a manufacturer group everything under 2% (or
     * 1.5 / 1.0 / 0.5%) at the end of the list, out of descending-weight
     * order. Everything before that phrase is ranked by weight; everything
     * after it is explicitly NOT. Recording where the boundary falls is what
     * lets the caller say "this was one of the first ingredients" honestly,
     * and stay silent when the ordering carries no information.
     *
     * The phrase itself is not removed — additives are routinely listed
     * inside it, and this is exactly the construction the naive scanner
     * misses.
     */
    var minorMatch = scannable.match(/contains?\s*(?:less than\s*)?(?:2|1\.5|1|0\.5)\s*(?:%|percent)\s*or\s*less/i);
    var minorAt = minorMatch ? minorMatch.index : -1;

    /*
     * Process indicators run against the WHOLE text, not the tokenized
     * phrases, because the phrases they live in get torn apart by the
     * splitter: "Contains up to 12% solution of water" is split on both
     * "contains" and the comma, and the percentage sits in the middle of the
     * phrase so a fixed word pattern cannot match it either.
     *
     * USDA (9 CFR 381.118) permits these claims on meat and poultry without
     * itemising the solution's salts, so on these products the ingredient
     * list can genuinely understate what was injected. That is worth saying
     * even though it is not an ingredient match.
     */
    var PROCESS = [
      [/\b(?:contain(?:s|ing)?|enhanced|marinated|injected)\s+(?:with\s+)?up to\s*\d+(?:\.\d+)?\s*(?:%|percent)\s*(?:of\s*)?(?:a\s*)?solution/i, 'meat-solution'],
      [/\bself[\s-]?bast(?:ing|ed)\b/i, 'meat-solution'],
      [/\b(?:injected|pumped)\s+with\b/i, 'meat-solution'],
      [/\b\d+(?:\.\d+)?\s*(?:%|percent)\s*solution\b/i, 'meat-solution']
    ];
    var processHits = Object.create(null);
    PROCESS.forEach(function (pair) {
      var m = scannable.match(pair[0]);
      if (m) processHits[pair[1]] = m[0].replace(/\s+/g, ' ').trim();
    });

    var phrases = splitIngredients(scannable);
    var byId = Object.create(null);

    phrases.forEach(function (phrase, index) {
      var norm = normalize(phrase);
      if (!norm) return;
      /* Is this phrase inside the "2% or less" tail? */
      var at = scannable.indexOf(phrase);
      var isMinor = minorAt >= 0 && at >= minorAt;

      resolveOverlaps(matchesIn(norm)).forEach(function (hit) {
        var add = hit.additive;
        if (!byId[add.id]) {
          byId[add.id] = {
            id: add.id,
            name: add.name,
            minerals: add.minerals,
            klass: add.klass,
            confidence: add.confidence,
            load: add.load,
            organic: !!add.organic,
            eNumber: add.eNumber || null,
            note: add.note,
            generic: !!add.generic,
            /* 1-based position of the earliest phrase this additive was found
             * in. Earlier means more of it, per the descending-order rule —
             * but only above the 2% boundary. */
            position: index + 1,
            minorGrouping: isMinor,
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
    /* Fold in whole-text process indicators alongside the ingredient matches. */
    Object.keys(processHits).forEach(function (id) {
      var add = Additives.byId[id];
      if (!add || byId[id]) return;
      byId[id] = {
        id: add.id, name: add.name, minerals: add.minerals, klass: add.klass,
        confidence: add.confidence, load: add.load, organic: !!add.organic,
        eNumber: add.eNumber || null, note: add.note, generic: false,
        position: 0, minorGrouping: false, sources: [processHits[id]]
      };
    });

    var found = Object.keys(byId).map(function (k) { return byId[k]; });

    /*
     * Non-phosphate modified starches carry no minerals. They exist in the
     * dictionary only to win the longest-match race against "modified starch"
     * so that an octenyl succinate starch does not raise a phosphorus flag.
     * Having done that job, they are not findings and must not be shown.
     */
    found = found.filter(function (f) { return f.minerals.length > 0; });

    /*
     * Suppression is scoped to the CLASS, not just the mineral.
     *
     * The first version keyed on mineral alone, and a processed-cheese label
     * reading "Milk Protein Concentrate, ..., Calcium Phosphate, ..., Sodium
     * Phosphate" reported ONE finding: the milk protein concentrate, being
     * non-generic and phosphorus-bearing, silently suppressed both actual
     * phosphate salts. That is the worst failure this scanner can have — a
     * missed inorganic phosphate is the whole reason the tool exists.
     *
     * A family-level entry ("sodium phosphate") should only give way to a
     * more specific entry of the SAME kind ("sodium tripolyphosphate"), never
     * to an unrelated organic-phosphorus ingredient.
     */
    var specificByClass = Object.create(null);
    found.forEach(function (f) {
      if (!f.generic) specificByClass[f.klass] = true;
    });
    found = found.filter(function (f) {
      return !f.generic || !specificByClass[f.klass];
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

    /*
     * THE TIER SPLIT — the single most important thing this scanner does for
     * potassium.
     *
     * A naive "potassium" scan fires on potassium sorbate and potassium
     * iodide. Sorbate is 26% potassium BY MASS, which sounds alarming, and is
     * used at under 0.3% of the product — a few milligrams. Iodised salt
     * carries potassium iodide in micrograms. Flagging those as "added
     * potassium" next to potassium chloride, which is 52.5% potassium and is
     * replacing sodium across the reformulated food supply, would teach
     * someone that the flag means nothing.
     *
     * So `potassium` stays the complete list for anyone who wants it, and
     * `materialPotassium` is the one a summary should count.
     */
    /*
     * "Material" is defined as potassium-bearing and NOT a trace preservative,
     * rather than as membership of the material-potassium class.
     *
     * The difference matters for the potassium phosphates. Monopotassium
     * phosphate is 28.7% potassium and dipotassium phosphate is 44.9% — both
     * are material potassium by any standard — but they are classed as
     * inorganic-phosphate because that is what they are chemically. Keying the
     * tier off the class dropped them from the potassium tally entirely, which
     * the corpus caught as a recall miss. Dual-mineral additives have to count
     * on both axes; that is the whole reason they are dual-mineral.
     */
    var isTrivialK = function (f) { return f.klass === 'trivial-potassium'; };
    var isMaterialK = function (f) { return !isTrivialK(f); };

    return {
      scanned: true,
      findings: found,
      phosphorus: has('phosphorus'),
      potassium: has('potassium'),

      /* Tiered views. */
      inorganicPhosphate: found.filter(function (f) {
        return f.klass === 'inorganic-phosphate';
      }),
      organicPhosphorus: found.filter(function (f) {
        return f.klass === 'organic-phosphorus';
      }),
      materialPotassium: has('potassium').filter(isMaterialK),
      trivialPotassium: has('potassium').filter(isTrivialK),
      processIndicators: found.filter(function (f) {
        return f.klass === 'process-indicator';
      }),

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

    /*
     * The headline counts only what is materially absorbed:
     *   - inorganic phosphate salts (~90-100% absorbed)
     *   - material potassium salts, not preservatives
     *
     * Organic phosphorus — lecithin, the nucleotides — is real but is used at
     * levels that do not move a product's phosphorus, and Picard et al. (2023)
     * found lecithin-only products had LOWER phosphorus than products with no
     * additive at all. Counting it in the headline alongside sodium phosphate
     * is how a flag stops meaning anything.
     */
    var parts = [];
    var p = result.inorganicPhosphate.filter(function (f) {
      return f.confidence !== 'possible';
    }).length;
    var k = result.materialPotassium.filter(function (f) {
      return f.confidence !== 'possible';
    }).length;
    if (p) parts.push(p + ' phosphorus ' + (p === 1 ? 'additive' : 'additives'));
    if (k) parts.push(k + ' potassium ' + (k === 1 ? 'additive' : 'additives'));
    if (parts.length) return 'Found ' + parts.join(' and ') + '.';

    if (result.processIndicators.length) {
      return 'This has an added solution, which usually contains phosphate.';
    }
    if (result.uncertain.length) return 'Possible added phosphate — the label is not specific.';
    if (result.organicPhosphorus.length) {
      return 'Only small amounts of phosphorus, from ingredients your body absorbs less easily.';
    }
    if (result.trivialPotassium.length) return 'Only trace potassium from a preservative.';
    return 'No added phosphate or potassium found in the ingredients.';
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
