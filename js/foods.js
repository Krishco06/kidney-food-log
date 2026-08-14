/*
 * foods.js — food lookup across USDA FoodData Central and Open Food Facts
 *
 * THE CENTRAL RULE OF THIS FILE
 * -----------------------------
 * A missing nutrient is `null`, never 0.
 *
 * Every commercial renal app gets this wrong, and it is the single largest
 * source of the "wildly inaccurate" complaints in their reviews: a packaged
 * food with no phosphorus value gets treated as containing zero phosphorus,
 * silently, and the day's total reads far lower than the truth. Since only
 * ~1.45% of branded records carry phosphorus and ~5.7% carry potassium, that
 * bug is not an edge case — it is most of the database.
 *
 * So `null` propagates all the way to the screen, where it prints as "no data"
 * and is counted in a separate "unknown" tally. See log.js.
 *
 * SOURCES, AND WHY EACH IS USED WHERE IT IS
 *
 *   USDA FoodData Central — used for ALL text search.
 *     Foundation / SR Legacy / FNDDS are laboratory-analyzed and are the only
 *     place trustworthy phosphorus and potassium numbers come from. Branded
 *     records mostly lack both minerals BUT do carry the printed `ingredients`
 *     string, which is what the additive scanner needs. CORS-clean.
 *
 *   Open Food Facts — used ONLY for barcode lookup.
 *     Verified against the live API: the product/barcode endpoint sends CORS
 *     headers, but every OFF *search* endpoint (cgi/search.pl, api/v2/search,
 *     search.openfoodfacts.org) returns no Access-Control-Allow-Origin and is
 *     therefore unusable from a browser page. Text search via OFF would require
 *     a server-side proxy, which v1 deliberately does not have — this app is a
 *     static site with no backend and no running costs.
 *
 * A worked example of why this app exists, straight from a live USDA Branded
 * record (Kroger "DELI SHAVED TURKEY", gtin 011110966551): the record carries
 * NO phosphorus value and NO potassium value, while its own ingredient list
 * reads "...SODIUM ERYTHORBATE, SODIUM PHOSPHATE...". A tracker that sums
 * database columns scores that food as 0 mg phosphorus. We score it as unknown,
 * and flag the added phosphate.
 */

(function (root) {
  'use strict';

  var Scanner = root.RenalScanner ||
    (typeof require !== 'undefined' ? require('./scanner.js') : null);

  /* ------------------------------------------------------------------ *
   * Normalized food record
   * ------------------------------------------------------------------ */

  /**
   * @typedef {object} Nutrients
   * All values per 100 g (or per 100 mL for liquids). `null` means UNKNOWN.
   * @property {number|null} energy      kcal
   * @property {number|null} protein     g
   * @property {number|null} sodium      mg
   * @property {number|null} potassium   mg
   * @property {number|null} phosphorus  mg
   */

  function emptyNutrients() {
    return {
      energy: null, protein: null, sodium: null,
      potassium: null, phosphorus: null
    };
  }

  /* Guard every value that enters a nutrient field. Rejects NaN, negatives and
   * the empty string, all of which appear in crowdsourced data, while allowing
   * a genuine analytical zero (sodium in a raw banana really is 0 mg). */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n) || n < 0) return null;
    return n;
  }

  function makeFood(fields) {
    return {
      id: fields.id,
      source: fields.source,            // 'usda' | 'off' | 'custom'
      name: fields.name || 'Unnamed food',
      brand: fields.brand || '',
      barcode: fields.barcode || '',
      dataType: fields.dataType || '',
      nutrients: fields.nutrients || emptyNutrients(),
      ingredientsText: fields.ingredientsText || '',
      additivesTags: fields.additivesTags || [],
      servingGrams: fields.servingGrams || null,
      servingLabel: fields.servingLabel || '',
      isLiquid: !!fields.isLiquid,
      scan: fields.scan || null
    };
  }

  /* ------------------------------------------------------------------ *
   * USDA FoodData Central
   * ------------------------------------------------------------------ */

  var USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

  /* DEMO_KEY works out of the box but is rate-limited to ~30 requests/hour and
   * 50/day per IP. Users paste their own free key (api.data.gov) in Settings. */
  var DEFAULT_USDA_KEY = 'DEMO_KEY';

  function usdaKey() {
    try {
      return localStorage.getItem('rl:usdaKey') || DEFAULT_USDA_KEY;
    } catch (e) {
      return DEFAULT_USDA_KEY;
    }
  }

  var USDA_NUTRIENT = {
    1008: 'energy',      // Energy, kcal
    1003: 'protein',     // Protein, g
    1093: 'sodium',      // Sodium, Na, mg
    1092: 'potassium',   // Potassium, K, mg
    1091: 'phosphorus'   // Phosphorus, P, mg
  };

  function usdaNutrients(food) {
    var out = emptyNutrients();
    var list = food.foodNutrients || [];
    list.forEach(function (n) {
      // The search endpoint uses `nutrientId`; the detail endpoint nests it
      // under `nutrient.id`. Accept either so both call sites work.
      var id = n.nutrientId || (n.nutrient && n.nutrient.id);
      var key = USDA_NUTRIENT[id];
      if (!key) return;
      var v = num(n.value !== undefined ? n.value : n.amount);
      if (v === null) return;

      /* Energy appears twice in some records (kcal and kJ). Take kcal only. */
      if (key === 'energy') {
        var unit = String(n.unitName || (n.nutrient && n.nutrient.unitName) || '').toUpperCase();
        if (unit && unit !== 'KCAL') return;
      }
      out[key] = v;
    });
    return out;
  }

  /*
   * api.data.gov does not always answer with JSON. A rate-limited or malformed
   * request can come back as an nginx HTML error page (observed: a 400 with
   * content-type text/html). Calling res.json() on that throws a SyntaxError
   * that surfaces to the user as a meaningless "Unexpected token '<'", so every
   * response is read as text and parsed defensively.
   */
  function usdaJson(res) {
    if (res.status === 429) throw new Error('USDA_RATE_LIMIT');
    if (res.status === 403) throw new Error('USDA_BAD_KEY');
    return res.text().then(function (body) {
      var data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        throw new Error('USDA_HTTP_' + res.status);
      }
      if (!res.ok) throw new Error('USDA_HTTP_' + res.status);
      return data;
    });
  }

  function usdaToFood(f) {
    var ingredients = f.ingredients || '';
    return makeFood({
      id: 'usda:' + f.fdcId,
      source: 'usda',
      name: cleanUsdaName(f.description),
      brand: f.brandOwner || f.brandName || '',
      barcode: f.gtinUpc || '',
      dataType: f.dataType || '',
      nutrients: usdaNutrients(f),
      ingredientsText: ingredients,
      servingGrams: num(f.servingSize),
      servingLabel: f.servingSizeUnit ? (f.servingSize + ' ' + f.servingSizeUnit) : '',
      isLiquid: String(f.servingSizeUnit || '').toLowerCase() === 'ml',
      /* Branded records carry the printed ingredient list, so the additive scan
       * runs here too — this is where most additive findings actually come from
       * now that OFF search is unavailable. */
      scan: Scanner.scan(ingredients)
    });
  }

  /*
   * One request covering both the analyzed datasets (real phosphorus and
   * potassium) and Branded (ingredient lists, but usually no minerals). A single
   * call matters: the shared DEMO_KEY allows only ~30 requests/hour, so spending
   * two per search would halve an already tight budget.
   */
  function usdaSearch(query, opts) {
    opts = opts || {};
    var types = opts.dataTypes ||
      ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];
    var url = USDA_BASE + '/foods/search' +
      '?query=' + encodeURIComponent(query) +
      '&pageSize=' + (opts.pageSize || 50) +
      '&dataType=' + encodeURIComponent(types.join(',')) +
      '&api_key=' + encodeURIComponent(usdaKey());

    return fetch(url)
      .then(usdaJson)
      .then(function (data) { return (data.foods || []).map(usdaToFood); });
  }

  /* Barcode fallback when Open Food Facts does not have the product. */
  function usdaBarcode(code) {
    return usdaSearch(String(code).replace(/\D/g, ''), {
      dataTypes: ['Branded'], pageSize: 5
    }).then(function (foods) {
      var digits = String(code).replace(/\D/g, '');
      var hit = foods.filter(function (f) {
        return String(f.barcode).replace(/\D/g, '') === digits;
      });
      return hit.length ? hit[0] : null;
    });
  }

  /* USDA descriptions are ALL CAPS in some datasets and comma-inverted
   * ("Bananas, raw"). Left mostly intact — reordering risks changing meaning —
   * but the shouting is toned down for readability. */
  function cleanUsdaName(desc) {
    if (!desc) return 'Unnamed food';
    var s = String(desc).trim();
    if (s === s.toUpperCase() && s.length > 3) {
      s = s.toLowerCase().replace(/(^|[\s,(\-])([a-z])/g, function (m, p, c) {
        return p + c.toUpperCase();
      });
    }
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Open Food Facts
   * ------------------------------------------------------------------ */

  var OFF_BASE = 'https://world.openfoodfacts.org';
  var OFF_FIELDS = [
    'code', 'product_name', 'brands', 'ingredients_text', 'additives_tags',
    'nutriments', 'serving_size', 'serving_quantity', 'quantity', 'categories_tags'
  ].join(',');

  /*
   * OFF stores potassium, sodium and phosphorus in GRAMS per 100 g, not
   * milligrams — verified against live data (a pretzel returning
   * potassium_100g = 0.107 means 107 mg). Treating that number as mg would
   * under-report potassium by 1000x. This conversion is load-bearing.
   */
  function offMineralMg(nutriments, key) {
    var v = num(nutriments[key + '_100g']);
    if (v === null) return null;
    var unit = String(nutriments[key + '_unit'] || 'g').toLowerCase();
    if (unit === 'mg') return v;
    if (unit === 'µg' || unit === 'ug' || unit === 'mcg') return v / 1000;
    return v * 1000; // grams (the OFF default)
  }

  function offNutrients(n) {
    n = n || {};
    var out = emptyNutrients();
    out.energy = num(n['energy-kcal_100g']);
    out.protein = num(n.proteins_100g);
    out.sodium = offMineralMg(n, 'sodium');
    out.potassium = offMineralMg(n, 'potassium');
    out.phosphorus = offMineralMg(n, 'phosphorus'); // almost always null
    return out;
  }

  function offToFood(p) {
    var scan = Scanner.scan(p.ingredients_text, { additivesTags: p.additives_tags });
    var cats = (p.categories_tags || []).join(' ');
    return makeFood({
      id: 'off:' + p.code,
      source: 'off',
      name: (p.product_name || '').trim() || 'Unnamed product',
      brand: (p.brands || '').split(',')[0].trim(),
      barcode: p.code || '',
      nutrients: offNutrients(p.nutriments),
      ingredientsText: p.ingredients_text || '',
      additivesTags: p.additives_tags || [],
      servingGrams: num(p.serving_quantity),
      servingLabel: p.serving_size || '',
      isLiquid: /beverage|drink|water|juice|soda|milk/.test(cats),
      scan: scan
    });
  }

  function offBarcode(code) {
    var url = OFF_BASE + '/api/v2/product/' +
      encodeURIComponent(String(code).trim()) + '.json?fields=' + OFF_FIELDS;
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('OFF_HTTP_' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.status !== 1 || !data.product) return null; // genuinely not found
        return offToFood(data.product);
      });
  }

  /*
   * NOTE: there is deliberately no offSearch().
   *
   * Every Open Food Facts text-search endpoint was tested from a browser origin
   * and all three are blocked by CORS (no Access-Control-Allow-Origin):
   *   /cgi/search.pl, /api/v2/search, and search.openfoodfacts.org/search.
   * Only the per-product/barcode endpoint above sends CORS headers.
   *
   * Adding OFF text search would require a proxy. See README for that trade-off.
   */

  /**
   * Look up a barcode. Open Food Facts first (much larger barcode coverage,
   * and richer ingredient text), USDA Branded as a fallback.
   */
  function barcode(code) {
    return offBarcode(code)
      .catch(function () { return null; })
      .then(function (food) {
        if (food) return food;
        return usdaBarcode(code).catch(function () { return null; });
      });
  }

  /* ------------------------------------------------------------------ *
   * Combined search
   * ------------------------------------------------------------------ */

  /*
   * Text search. Results are ranked by how useful the record actually is to a
   * renal user, which is NOT the same as search relevance: a lab-analyzed
   * generic food that reports phosphorus is worth more than a branded product
   * that reports neither mineral, even if the brand matches the query better.
   *
   * A failure must not blank the screen — this user population is not served by
   * an error page — so errors are returned alongside whatever did load.
   */
  function search(query, opts) {
    var errors = [];
    return usdaSearch(query, opts)
      .catch(function (e) {
        errors.push({ source: 'usda', code: e.message });
        return [];
      })
      .then(function (foods) {
        foods.forEach(function (f, i) {
          var score = 0;
          if (f.nutrients.phosphorus !== null) score += 4;
          if (f.nutrients.potassium !== null) score += 2;
          if (f.scan && f.scan.scanned) score += 1;
          f._rank = score;
          f._order = i;
        });
        foods.sort(function (a, b) {
          return (b._rank - a._rank) || (a._order - b._order);
        });
        return { foods: foods, errors: errors };
      });
  }

  /* ------------------------------------------------------------------ *
   * Portion scaling
   * ------------------------------------------------------------------ */

  /**
   * Scale a food's per-100g nutrients to an actual portion.
   * `null` stays `null` — an unknown value scaled by any amount is still
   * unknown, and must never become 0.
   *
   * @param {object} food
   * @param {number} grams
   * @returns {Nutrients}
   */
  function scaleTo(food, grams) {
    var factor = (num(grams) || 0) / 100;
    var out = emptyNutrients();
    Object.keys(out).forEach(function (k) {
      var v = food.nutrients[k];
      out[k] = v === null ? null : v * factor;
    });
    return out;
  }

  var api = {
    emptyNutrients: emptyNutrients,
    makeFood: makeFood,
    scaleTo: scaleTo,
    search: search,
    usdaSearch: usdaSearch,
    usdaBarcode: usdaBarcode,
    barcode: barcode,
    offBarcode: offBarcode,
    usdaToFood: usdaToFood,
    offToFood: offToFood,
    offMineralMg: offMineralMg,
    usdaNutrients: usdaNutrients,
    num: num,
    usdaKey: usdaKey,
    DEFAULT_USDA_KEY: DEFAULT_USDA_KEY
  };

  root.RenalFoods = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
