/*
 * app.js — view controller
 *
 * Presentation rules that are not negotiable, because they are what makes this
 * app honest rather than just another renal tracker:
 *
 *  1. A total is never rendered without its coverage. If 5 of 11 items had no
 *     phosphorus value, the screen says so next to the number, every time.
 *  2. "No data" is rendered in its own color and its own words, never as 0.
 *  3. Nothing is ever compared to a limit, target or threshold. No alerts.
 *     No "high"/"low" verdicts on the user's totals. No food recommendations.
 *     See the regulatory boundary note in log.js.
 *  4. Additive severity words describe the COMPOUND ("absorbed almost
 *     completely"), never the user's intake ("you have had too much").
 */

(function () {
  'use strict';

  var Scanner = window.RenalScanner;
  var Units = window.RenalUnits;
  var Foods = window.RenalFoods;
  var Log = window.RenalLog;
  var CommonFoods = window.RenalCommonFoods;

  var state = {
    screen: 'today',
    unit: 'mg',
    fluidUnit: 'ml',
    results: [],
    pending: null,   // food awaiting a portion choice
    grams: 100
  };

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ------------------------------------------------------------------ *
   * Preferences
   * ------------------------------------------------------------------ */

  function loadPrefs() {
    try {
      state.unit = localStorage.getItem('rl:unit') || 'mg';
      state.fluidUnit = localStorage.getItem('rl:fluidUnit') || 'ml';
    } catch (e) { /* private mode */ }
  }
  function savePref(k, v) {
    try { localStorage.setItem('rl:' + k, v); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */

  var SCREENS = ['today', 'add', 'portion', 'history', 'more'];

  function show(name) {
    state.screen = name;
    SCREENS.forEach(function (s) {
      var node = $('screen-' + s);
      if (node) node.hidden = (s !== name);
    });
    document.querySelectorAll('nav.tabs button').forEach(function (b) {
      var target = b.getAttribute('data-screen');
      // The portion picker is a sub-screen of Add, so Add stays highlighted.
      var active = target === name || (name === 'portion' && target === 'add');
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (name === 'today') renderToday();
    if (name === 'history') renderHistory();
  }

  /* ------------------------------------------------------------------ *
   * TODAY
   * ------------------------------------------------------------------ */

  var NUTRIENT_LABELS = {
    phosphorus: 'Phosphorus',
    potassium: 'Potassium',
    sodium: 'Sodium',
    protein: 'Protein',
    energy: 'Calories'
  };

  /* Renal minerals first — they are the reason the user is here. */
  var DISPLAY_ORDER = ['phosphorus', 'potassium', 'sodium', 'protein', 'energy'];

  /* Reads inside a sentence ("...has no calorie data"), so it is not simply the
   * lowercased display label — "no calories data" is wrong. */
  var COVERAGE_LABELS = {
    phosphorus: 'phosphorus', potassium: 'potassium', sodium: 'sodium',
    protein: 'protein', energy: 'calorie'
  };

  function formatNutrient(key, mg) {
    if (key === 'energy') return Units.formatEnergy(mg);
    if (key === 'protein') return Units.formatProtein(mg);
    if (key === 'sodium') return Units.format(mg, 'sodium', 'mg');
    return Units.format(mg, key, state.unit);
  }

  function renderNutrient(key, stat) {
    var wrap = el('div', 'nutrient');

    var row = el('div', 'row');
    row.appendChild(el('div', 'label', NUTRIENT_LABELS[key]));

    var total = stat.known + stat.unknown;
    var hasAny = stat.known > 0;

    /*
     * The qualifier is the honest part. With missing data the number is a floor,
     * not a total, so it is labelled "at least" — a factual statement about our
     * data, not a judgement about the user's intake.
     */
    if (hasAny && !stat.complete) {
      row.appendChild(el('div', 'qual', 'at least'));
    }

    var val = el('div', 'value ' + (hasAny ? (stat.complete ? '' : 'partial') : 'none'));
    val.textContent = hasAny ? formatNutrient(key, stat.sum) : 'No data';
    row.appendChild(val);
    wrap.appendChild(row);

    if (total > 0) {
      var cov = el('div', 'coverage');
      var bar = el('div', 'coverage-bar' + (hasAny ? '' : ' empty'));
      var fill = el('span');
      fill.style.width = Math.round((stat.known / total) * 100) + '%';
      bar.appendChild(fill);
      cov.appendChild(bar);

      var note = el('div', 'coverage-note' + (stat.complete ? '' : ' warn'),
        Log.coverageNote(stat, COVERAGE_LABELS[key]));
      cov.appendChild(note);
      wrap.appendChild(cov);
    }

    return wrap;
  }

  function renderToday() {
    var key = Log.dateKey();
    $('headerDate').textContent = Log.prettyDate(key);

    var entries = Log.read(key);
    var t = Log.totals(entries);

    var host = $('totals');
    clear(host);

    if (!entries.length) {
      host.appendChild(el('div', 'empty', 'Nothing logged yet today. Tap "Add" to start.'));
    } else {
      DISPLAY_ORDER.forEach(function (k) {
        host.appendChild(renderNutrient(k, t.totals[k]));
      });

      // Fluid has no "unknown" concept — the user enters the volume directly.
      var fluid = el('div', 'nutrient');
      var frow = el('div', 'row');
      frow.appendChild(el('div', 'label', 'Fluid'));
      frow.appendChild(el('div', 'value', Units.formatFluid(t.fluidMl, state.fluidUnit)));
      fluid.appendChild(frow);
      fluid.appendChild(el('div', 'coverage-note',
        'Only drinks you logged. Soup, gelatin, ice cream and ice also count as fluid.'));
      host.appendChild(fluid);
    }

    renderAdditives(t.additives);
    renderEntries(entries);
  }

  /*
   * Two independent badges, deliberately never merged:
   *   loadBadge       — HOW MUCH of the mineral the ingredient plausibly adds
   *   absorptionBadge — HOW WELL that mineral is absorbed
   *
   * Collapsing them into one "severity" would teach the wrong thing. Milk
   * protein concentrate is a large phosphorus load but only ~40-60% absorbed;
   * potassium sorbate is fully available but present only in traces.
   *
   * Both describe the COMPOUND, never the user's intake — no verdicts.
   */
  function loadBadge(load) {
    var map = {
      high:     { cls: 'high', icon: '●', text: 'Large amount' },
      moderate: { cls: 'med',  icon: '◐', text: 'Some' },
      low:      { cls: 'low',  icon: '○', text: 'Usually a trace' }
    };
    var m = map[load] || map.low;
    var b = el('span', 'badge ' + m.cls);
    b.appendChild(el('span', null, m.icon));
    b.appendChild(el('span', null, m.text));
    return b;
  }

  function absorptionBadge(organic) {
    var b = el('span', 'badge ' + (organic ? 'low' : 'high'));
    b.textContent = organic
      ? 'Natural — about half absorbed'
      : 'Added — almost fully absorbed';
    return b;
  }

  function mineralBadge(minerals) {
    var b = el('span', 'badge low');
    b.textContent = minerals.map(function (m) {
      return m === 'phosphorus' ? 'Phosphorus' : 'Potassium';
    }).join(' + ');
    return b;
  }

  function renderAdditives(additives) {
    var card = $('additiveCard');
    var host = $('additiveList');
    clear(host);

    if (!additives.length) { card.hidden = true; return; }
    card.hidden = false;

    additives.forEach(function (a) {
      var node = el('div', 'additive');

      var name = el('div', 'name');
      name.appendChild(el('span', null, a.name));
      name.appendChild(mineralBadge(a.minerals));
      name.appendChild(loadBadge(a.load));
      name.appendChild(absorptionBadge(a.organic));
      if (a.confidence === 'possible') {
        var q = el('span', 'badge unknown');
        q.textContent = '? Not certain';
        name.appendChild(q);
      }
      node.appendChild(name);

      var full = window.RenalAdditives.byId[a.id];
      if (full) node.appendChild(el('div', 'note', full.note));

      node.appendChild(el('div', 'where', 'In: ' + a.foods.join(', ')));
      host.appendChild(node);
    });
  }

  function renderEntries(entries) {
    var host = $('entries');
    clear(host);

    if (!entries.length) {
      host.appendChild(el('div', 'empty', 'No items yet.'));
      return;
    }

    entries.slice().reverse().forEach(function (e) {
      var row = el('div', 'entry');
      var main = el('div', 'main');
      main.appendChild(el('div', 'name', e.name + (e.brand ? ' — ' + e.brand : '')));
      main.appendChild(el('div', 'meta', e.portionLabel));

      if (e.type === 'fluid') {
        main.appendChild(el('div', 'nums', Units.formatFluid(e.ml, state.fluidUnit)));
      } else {
        var n = e.nutrients || {};
        var parts = ['phosphorus', 'potassium', 'sodium'].map(function (k) {
          var v = n[k];
          return NUTRIENT_LABELS[k] + ' ' +
            (v === null || v === undefined ? 'no data' : formatNutrient(k, v));
        });
        main.appendChild(el('div', 'nums', parts.join('  ·  ')));

        var findings = (e.scan && e.scan.findings) || [];
        if (findings.length) {
          var badges = el('div', 'badges');
          var b = el('span', 'badge med');
          b.textContent = '⚠ ' + findings.length +
            (findings.length === 1 ? ' additive' : ' additives');
          badges.appendChild(b);
          main.appendChild(badges);
        }
      }
      row.appendChild(main);

      var del = el('button', 'link', 'Remove');
      del.setAttribute('aria-label', 'Remove ' + e.name);
      del.addEventListener('click', function () {
        Log.remove(e.id);
        renderToday();
      });
      row.appendChild(del);

      host.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------ *
   * SEARCH
   * ------------------------------------------------------------------ */

  function dataQualityBadges(food) {
    var out = el('div', 'badges');
    var n = food.nutrients;

    if (n.phosphorus !== null) {
      var p = el('span', 'badge ok');
      p.textContent = '✓ Phosphorus known';
      out.appendChild(p);
    } else {
      var pn = el('span', 'badge unknown');
      pn.textContent = '? No phosphorus data';
      out.appendChild(pn);
    }

    if (n.potassium === null) {
      var kn = el('span', 'badge unknown');
      kn.textContent = '? No potassium data';
      out.appendChild(kn);
    }

    if (food.scan && food.scan.scanned && food.scan.findings.length) {
      var a = el('span', 'badge med');
      var pCount = food.scan.phosphorus.length;
      var kCount = food.scan.potassium.length;
      var bits = [];
      if (pCount) bits.push(pCount + ' phosphate');
      if (kCount) bits.push(kCount + ' potassium');
      a.textContent = '⚠ ' + bits.join(', ') + ' added';
      out.appendChild(a);
    }

    return out;
  }

  /* One row renderer for every list, so a built-in food and a searched food
   * look and behave identically. */
  function foodRow(food) {
    var btn = el('button', 'result');
    btn.appendChild(el('div', 'name', food.name));

    var meta = [];
    if (food.brand) meta.push(food.brand);
    if (food.source === 'usda') {
      meta.push('USDA' + (food.dataType ? ' · ' + food.dataType : ''));
    } else if (food.source === 'off') {
      meta.push('Open Food Facts');
    }
    btn.appendChild(el('div', 'meta', meta.join(' · ')));
    btn.appendChild(dataQualityBadges(food));

    btn.addEventListener('click', function () { openPortion(food); });
    return btn;
  }

  /**
   * Append at most one error notice. Returns true if it added one.
   *
   * `resultCount` matters: when the built-in library already answered the
   * query, a failed online lookup is a footnote, not a failure — so the wording
   * has to change rather than telling someone staring at ten usable results
   * that nothing could be found.
   */
  function renderSearchErrors(host, errors, resultCount) {
    /*
     * At most ONE notice, even when several sources failed.
     *
     * Search fans out to two sources, so a single outage can produce two errors
     * and previously stacked two red boxes — with the only actionable one at the
     * bottom. Stacked errors are bad for any audience and worse for this one, so
     * the codes are ranked by how actionable they are and the best wins. A rate
     * limit tells the user something they can do; "check your connection" is the
     * fallback when nothing more specific is known.
     */
    var codes = (errors || []).map(function (e) { return e.code; });
    var pick = ['USDA_BAD_KEY', 'USDA_RATE_LIMIT'].filter(function (c) {
      return codes.indexOf(c) !== -1;
    })[0] || (codes.length ? 'GENERIC' : null);

    if (pick) {
      var n = el('div', 'notice strong');
      /* Softened when the built-in list already answered: the search worked,
       * we just could not add the online extras. */
      if (resultCount) {
        n.className = 'notice';
        n.appendChild(el('h3', null, 'Could not also search online'));
        n.appendChild(el('p', null,
          'The foods above are from the built-in list and are ready to use. ' +
          'Online brands and packaged foods are not available right now.'));
        host.appendChild(n);
        return true;
      }
      if (pick === 'USDA_RATE_LIMIT') {
        n.appendChild(el('h3', null, 'The shared food database key is busy'));
        n.appendChild(el('p', null,
          'The free key everyone shares only allows about 30 searches an hour, ' +
          'and it has run out for now. Wait a few minutes, or get your own free ' +
          'key — see "Food data source" under More. Barcode scanning still works.'));
      } else if (pick === 'USDA_BAD_KEY') {
        n.appendChild(el('h3', null, 'That food database key did not work'));
        n.appendChild(el('p', null,
          'Check the key under More, or clear the box to go back to the shared key.'));
      } else {
        n.appendChild(el('h3', null, 'Could not reach the food database'));
        n.appendChild(el('p', null,
          'Check your internet connection and try again. Barcode scanning may ' +
          'still work, and your log is safe on this device.'));
      }
      host.appendChild(n);
      return true;
    }

    if (!resultCount) {
      host.appendChild(el('div', 'empty',
        'No foods found. Try a simpler word, like "chicken" or "milk".'));
    }
    return false;
  }

  function renderResults(foods, errors) {
    var host = $('results');
    clear(host);
    toggleCommon(false);
    if (foods.length) {
      foods.forEach(function (food) { host.appendChild(foodRow(food)); });
    }
    renderSearchErrors(host, errors, foods.length);
  }

  /* ------------------------------------------------------------------ *
   * SEARCH
   *
   * Two tiers, deliberately. The built-in library answers instantly with no
   * network at all, so typing always produces something; the online sources are
   * an explicit second step. Before this, a rate-limited key or a dead proxy
   * meant typing a food and getting nothing back, which reads as a broken app
   * rather than a missing connection.
   * ------------------------------------------------------------------ */

  var searchDebounce = null;

  function sectionHeading(text, hint) {
    var wrap = el('div', 'section-head');
    wrap.appendChild(el('h3', null, text));
    if (hint) wrap.appendChild(el('p', 'hint', hint));
    return wrap;
  }

  /* Runs on every keystroke against ~149 local rows. No network, no spinner. */
  function renderLocalMatches(q) {
    var host = $('results');
    clear(host);
    if (q.length < 2) { toggleCommon(true); return; }

    var local = CommonFoods.search(q);
    toggleCommon(false);

    if (local.length) {
      host.appendChild(sectionHeading(
        local.length + ' built-in ' + (local.length === 1 ? 'food' : 'foods'),
        'Ready to add now. Press Search to also look online for brands.'));
      local.forEach(function (f) { host.appendChild(foodRow(f)); });
    } else {
      host.appendChild(el('div', 'empty',
        'Nothing in the built-in list matches. Press Search to look online.'));
    }
  }

  function doSearch() {
    var q = $('q').value.trim();
    if (!q) return;
    var host = $('results');
    toggleCommon(false);
    clear(host);

    /* Show the local hits immediately and keep them on screen while the network
     * call runs, rather than replacing a useful list with a spinner. */
    var local = CommonFoods.search(q);
    if (local.length) {
      host.appendChild(sectionHeading(local.length + ' built-in ' +
        (local.length === 1 ? 'food' : 'foods')));
      local.forEach(function (f) { host.appendChild(foodRow(f)); });
    }
    var spinner = el('div', 'spinner', 'Looking online…');
    host.appendChild(spinner);

    Foods.search(q).then(function (r) {
      state.results = r.foods;
      if (spinner.parentNode) spinner.parentNode.removeChild(spinner);

      /* Drop online copies of foods already shown from the built-in list. */
      var seen = {};
      local.forEach(function (f) { seen[f.id] = true; });
      var online = r.foods.filter(function (f) { return !seen[f.id]; });

      if (online.length) {
        host.appendChild(sectionHeading(online.length + ' more from online'));
        online.forEach(function (f) { host.appendChild(foodRow(f)); });
      }
      renderSearchErrors(host, r.errors, local.length + online.length);
    }).catch(function () {
      if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
      renderSearchErrors(host, [{ code: 'GENERIC' }], local.length);
    });
  }

  /* ------------------------------------------------------------------ *
   * COMMON FOODS BROWSER
   * ------------------------------------------------------------------ */

  var commonCat = 'All';

  function toggleCommon(visible) {
    var card = $('commonCard');
    if (card) card.hidden = !visible;
  }

  /*
   * The browse list is capped on first paint.
   *
   * At 789 foods, rendering every row builds roughly 3,000 DOM nodes, which
   * measured ~40 ms on a desktop and would be several times that on the old
   * phones this audience actually uses. Nobody scrolls 789 rows anyway — the
   * search box above is the real way in — so show a screenful and put the rest
   * behind one tap.
   */
  var BROWSE_LIMIT = 60;
  var commonShowAll = false;

  function renderCommonList() {
    var host = $('commonList');
    clear(host);
    var foods = commonCat === 'All' ? CommonFoods.all() : CommonFoods.byCategory(commonCat);
    var shown = commonShowAll ? foods : foods.slice(0, BROWSE_LIMIT);
    shown.forEach(function (f) { host.appendChild(foodRow(f)); });

    if (foods.length > shown.length) {
      var more = el('button', 'link');
      more.style.width = '100%';
      more.textContent = 'Show all ' + foods.length +
        (commonCat === 'All' ? ' foods' : ' in ' + commonCat);
      more.addEventListener('click', function () {
        commonShowAll = true;
        renderCommonList();
      });
      host.appendChild(more);
    }
  }

  function renderCommonBrowser() {
    var cats = ['All'].concat(CommonFoods.CATEGORIES);
    renderChipGroup($('commonCats'), cats,
      function (c) { return c; },
      function (c) { return c === commonCat; },
      function (c) { commonCat = c; commonShowAll = false; renderCommonBrowser(); });
    renderCommonList();
  }

  /* ------------------------------------------------------------------ *
   * BARCODE
   *
   * Two decoders, one behaviour. Chrome and Android WebView expose a native
   * BarcodeDetector; Safari does not, and Safari is a large share of this
   * audience. The bundled decoder in barcode.js covers that gap, so camera
   * scanning works everywhere rather than degrading to "type 13 digits" on
   * iPhone — which in practice means people stop logging packaged food, and
   * packaged food is exactly where the phosphate additives are.
   *
   * Typed entry always stays available underneath.
   * ------------------------------------------------------------------ */

  var scan = {
    stream: null,
    timer: null,
    votes: null,
    running: false
  };

  /* Barcodes are checksum-protected, but a checksum still passes 1 time in 10
   * on a misread, so a code must be seen twice before we act on it. A wrong
   * barcode silently logs the wrong food; a slow scan just costs a second. */
  var REQUIRED_VOTES = 2;
  var SCAN_INTERVAL_MS = 120;

  function openBarcode() {
    $('barcodeCard').hidden = false;

    var area = $('scanArea');
    clear(area);
    scan.votes = Object.create(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      area.appendChild(el('p', 'hint',
        'This browser cannot use the camera. Type the numbers printed under ' +
        'the barcode instead.'));
      $('barcodeInput').focus();
      return;
    }

    var video = el('video');
    video.setAttribute('playsinline', ''); // required for inline playback on iOS
    video.muted = true;
    video.style.width = '100%';
    video.style.borderRadius = '10px';
    video.style.background = '#000';
    area.appendChild(video);

    var status = el('p', 'hint', 'Point the camera at the barcode.');
    area.appendChild(status);

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    }).then(function (stream) {
      scan.stream = stream;
      video.srcObject = stream;
      return video.play();
    }).then(function () {
      scan.running = true;
      startScanLoop(video, status);
    }).catch(function () {
      clear(area);
      area.appendChild(el('p', 'hint',
        'We could not open the camera. You may need to allow camera access, ' +
        'or you can type the numbers under the barcode instead.'));
      $('barcodeInput').focus();
    });
  }

  function startScanLoop(video, status) {
    var native = null;
    if ('BarcodeDetector' in window) {
      try {
        native = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
        });
      } catch (e) {
        native = null; // constructed but unsupported formats
      }
    }

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var started = Date.now();
    var nudged = false;

    function accept(raw) {
      var code = String(raw).replace(/\D/g, '');
      if (!code) return false;
      scan.votes[code] = (scan.votes[code] || 0) + 1;
      if (scan.votes[code] < REQUIRED_VOTES) return false;
      lookupBarcode(code);
      return true;
    }

    function nudge() {
      /* After a while, stop letting the user fight the camera in silence. */
      if (!nudged && Date.now() - started > 12000) {
        nudged = true;
        status.textContent =
          'Having trouble? Try more light, or type the numbers under the barcode below.';
      }
    }

    function scheduleNext() {
      if (scan.running) scan.timer = setTimeout(tick, SCAN_INTERVAL_MS);
    }

    function decodeWithBundled() {
      if (!video.videoWidth) return null;
      /* Downscale to ~640px wide: plenty for a barcode, and it keeps each pass
       * cheap enough to run several times a second on an older phone. */
      var scaleFactor = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scaleFactor);
      canvas.height = Math.round(video.videoHeight * scaleFactor);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return window.RenalBarcode.decodeImageData(frame);
    }

    function tick() {
      if (!scan.running) return;
      nudge();

      if (native) {
        native.detect(video).then(function (codes) {
          if (codes && codes.length && accept(codes[0].rawValue)) return;
          scheduleNext();
        }).catch(function () {
          /* Native detector failed at runtime — fall back permanently. */
          native = null;
          scheduleNext();
        });
        return;
      }

      var code = null;
      try {
        code = decodeWithBundled();
      } catch (e) {
        code = null;
      }
      if (code && accept(code)) return;
      scheduleNext();
    }

    tick();
  }

  function closeBarcode() {
    scan.running = false;
    if (scan.timer) { clearTimeout(scan.timer); scan.timer = null; }
    if (scan.stream) {
      scan.stream.getTracks().forEach(function (t) { t.stop(); });
      scan.stream = null;
    }
    scan.votes = null;
    clear($('scanArea'));
    $('barcodeCard').hidden = true;
  }

  function lookupBarcode(code) {
    closeBarcode();
    var host = $('results');
    clear(host);
    host.appendChild(el('div', 'spinner', 'Looking up ' + code + '…'));

    Foods.barcode(code).then(function (food) {
      clear(host);
      if (!food) {
        host.appendChild(el('div', 'empty',
          'That barcode is not in the database yet. Try searching by name instead.'));
        return;
      }
      renderResults([food], []);
    }).catch(function () {
      clear(host);
      host.appendChild(el('div', 'empty', 'Lookup failed. Check your internet connection.'));
    });
  }

  /* ------------------------------------------------------------------ *
   * FLUID QUICK-ADD
   *
   * Fluid is the other half of the dialysis diet problem — interdialytic weight
   * gain is driven by volume, and sodium-driven thirst ties it directly to the
   * food side. It gets a one-tap path because a user who has to search a
   * database for "water" will simply stop logging drinks.
   *
   * Nutrients are recorded as UNKNOWN, not zero. We know the volume the user
   * told us; we do not know what was in the cup, and inventing a number for
   * "1 cup of juice" would be exactly the false precision this app rejects.
   * ------------------------------------------------------------------ */

  var DRINKS = ['Water', 'Coffee', 'Tea', 'Juice', 'Soda', 'Milk', 'Soup', 'Other'];

  var SIZES = [
    { label: 'Small cup (4 oz)', ml: 118 },
    { label: 'Cup (8 oz)', ml: 237 },
    { label: 'Mug (12 oz)', ml: 355 },
    { label: 'Can (12 oz)', ml: 355 },
    { label: 'Bottle (16 oz)', ml: 473 },
    { label: 'Large (20 oz)', ml: 591 }
  ];

  var fluidChoice = { drink: 'Water', ml: 237 };

  function renderChipGroup(host, items, getLabel, isSelected, onPick) {
    clear(host);
    items.forEach(function (item) {
      var c = el('button', 'chip', getLabel(item));
      c.type = 'button';
      c.setAttribute('aria-pressed', String(isSelected(item)));
      c.addEventListener('click', function () {
        /*
         * Mark the selection BEFORE the callback. If onPick re-renders the
         * group (the category browser does), these nodes are replaced by fresh
         * ones that isSelected marks correctly — whereas doing it afterwards
         * compared the new chips against a detached `c`, matched nothing, and
         * left every chip aria-pressed="false" with no visible selection.
         */
        host.querySelectorAll('.chip').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === c));
        });
        onPick(item);
      });
      host.appendChild(c);
    });
  }

  function renderFluidControls() {
    renderChipGroup($('drinkChips'), DRINKS,
      function (d) { return d; },
      function (d) { return d === fluidChoice.drink; },
      function (d) { fluidChoice.drink = d; });

    renderChipGroup($('sizeChips'), SIZES,
      function (s) { return s.label; },
      function (s) { return s.ml === fluidChoice.ml; },
      function (s) { fluidChoice.ml = s.ml; });
  }

  /* ------------------------------------------------------------------ *
   * PORTION PICKER
   * ------------------------------------------------------------------ */

  /* Common household portions, so most logging is one tap rather than typing a
   * gram weight — numeracy cannot be assumed in this population. */
  var PORTION_CHIPS = [
    { label: 'Small (60 g)', grams: 60 },
    { label: 'Medium (100 g)', grams: 100 },
    { label: 'Large (170 g)', grams: 170 },
    { label: '1 cup (240 g)', grams: 240 },
    { label: '3 oz (85 g)', grams: 85 },
    { label: '4 oz (113 g)', grams: 113 }
  ];

  function openPortion(food) {
    state.pending = food;
    state.grams = food.servingGrams || 100;
    renderPortion();
    show('portion');
  }

  function renderPortion() {
    var food = state.pending;
    var host = $('portionBody');
    clear(host);
    if (!food) return;

    var card = el('div', 'card');
    card.appendChild(el('h2', null, food.name + (food.brand ? ' — ' + food.brand : '')));
    card.appendChild(dataQualityBadges(food));

    /* Show the verbatim USDA record behind a friendly name. The short name is
     * what makes the list usable; this is what makes it checkable. */
    if (food.usdaDescription && food.usdaDescription !== food.name) {
      card.appendChild(el('p', 'hint', 'USDA record: ' + food.usdaDescription));
    }

    var chips = el('div', 'chips');
    chips.style.marginTop = '14px';

    /*
     * Real USDA household portions first when we have them ("1 medium 136 g",
     * "1 cup sliced 150 g"). They are measured weights for THIS food, so they
     * beat the generic fallbacks — and "1 medium" is a far easier judgement for
     * someone to make than estimating grams.
     */
    var options = [];
    (food.portions || []).forEach(function (p) {
      options.push({ label: p.label + ' (' + p.grams + ' g)', grams: p.grams });
    });
    if (!options.length && food.servingGrams) {
      options.push({
        label: 'One serving' + (food.servingLabel ? ' (' + food.servingLabel + ')' : ''),
        grams: food.servingGrams
      });
    }
    PORTION_CHIPS.forEach(function (p) {
      if (!options.some(function (o) { return Math.abs(o.grams - p.grams) < 0.5; })) {
        options.push(p);
      }
    });

    options.forEach(function (o) {
      var c = el('button', 'chip', o.label);
      c.setAttribute('aria-pressed', String(Math.abs(o.grams - state.grams) < 0.5));
      c.addEventListener('click', function () {
        state.grams = o.grams;
        $('gramsInput').value = o.grams;
        renderPortionPreview();
        chips.querySelectorAll('.chip').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === c));
        });
      });
      chips.appendChild(c);
    });
    card.appendChild(chips);

    var field = el('div', 'field');
    field.style.marginTop = '14px';
    var lbl = el('label', null, 'Or type the weight in grams');
    lbl.setAttribute('for', 'gramsInput');
    field.appendChild(lbl);
    var input = el('input');
    input.type = 'number';
    input.id = 'gramsInput';
    input.min = '1';
    input.value = String(state.grams);
    input.addEventListener('input', function () {
      state.grams = parseFloat(input.value) || 0;
      renderPortionPreview();
    });
    field.appendChild(input);
    card.appendChild(field);

    var preview = el('div', 'card');
    preview.id = 'portionPreview';
    card.appendChild(preview);

    var addBtn = el('button', 'primary', 'Add to today');
    addBtn.style.width = '100%';
    addBtn.addEventListener('click', function () {
      if (!state.grams || state.grams <= 0) return;
      var label = Math.round(state.grams) + ' g';
      Log.addFood(food, state.grams, label);
      state.pending = null;
      $('q').value = '';
      clear($('results'));
      show('today');
    });
    card.appendChild(addBtn);

    host.appendChild(card);
    renderPortionPreview();
  }

  function renderPortionPreview() {
    var host = $('portionPreview');
    if (!host || !state.pending) return;
    clear(host);

    host.appendChild(el('h3', null, 'This portion has'));
    var scaled = Foods.scaleTo(state.pending, state.grams);

    DISPLAY_ORDER.forEach(function (k) {
      var row = el('div', 'entry');
      var main = el('div', 'main');
      main.appendChild(el('div', 'name', NUTRIENT_LABELS[k]));
      row.appendChild(main);

      var v = scaled[k];
      if (v === null) {
        var unk = el('span', 'badge unknown');
        unk.textContent = '? No data';
        row.appendChild(unk);
      } else {
        row.appendChild(el('div', null, formatNutrient(k, v)));
      }
      host.appendChild(row);
    });

    var scan = state.pending.scan;
    if (scan && scan.scanned && scan.findings.length) {
      host.appendChild(el('h3', null, 'Added phosphate and potassium'));
      scan.findings.forEach(function (f) {
        var node = el('div', 'additive');
        var name = el('div', 'name');
        name.appendChild(el('span', null, f.name));
        name.appendChild(mineralBadge(f.minerals));
        name.appendChild(loadBadge(f.load));
        name.appendChild(absorptionBadge(f.organic));
        node.appendChild(name);
        node.appendChild(el('div', 'note', f.note));
        node.appendChild(el('div', 'src', 'Found in the ingredients: ' + f.sources.join('; ')));
        host.appendChild(node);
      });
    } else if (scan && scan.scanned) {
      host.appendChild(el('p', 'hint',
        'We read the ingredient list and found no added phosphate or potassium.'));
    } else {
      host.appendChild(el('p', 'hint',
        'No ingredient list was available for this food, so we could not check for additives.'));
    }
  }

  /* ------------------------------------------------------------------ *
   * HISTORY
   * ------------------------------------------------------------------ */

  function renderHistory() {
    var host = $('historyList');
    clear(host);

    var dates = Log.allDates();
    if (!dates.length) {
      host.appendChild(el('div', 'empty', 'No days logged yet.'));
      return;
    }

    dates.forEach(function (key) {
      var entries = Log.read(key);
      var t = Log.totals(entries);

      var card = el('div', 'card');
      card.appendChild(el('h2', null, Log.prettyDate(key)));
      card.appendChild(el('div', 'meta',
        entries.length + (entries.length === 1 ? ' item' : ' items')));

      ['phosphorus', 'potassium'].forEach(function (k) {
        var stat = t.totals[k];
        var line = el('div', 'coverage-note' + (stat.complete ? '' : ' warn'));
        line.textContent = NUTRIENT_LABELS[k] + ': ' +
          (stat.known ? (stat.complete ? '' : 'at least ') + formatNutrient(k, stat.sum)
                      : 'no data') +
          (stat.unknown ? ' (' + stat.unknown + ' item' + (stat.unknown === 1 ? '' : 's') +
                          ' missing data)' : '');
        card.appendChild(line);
      });

      host.appendChild(card);
    });
  }

  function exportCSV() {
    var csv = Log.toCSV(Log.allDates());
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'kidney-food-log-' + Log.dateKey() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  function init() {
    loadPrefs();

    document.querySelectorAll('nav.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-screen')); });
    });

    $('searchBtn').addEventListener('click', doSearch);
    $('q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    });

    /* Instant local matches while typing. Debounced only enough to avoid
     * re-rendering mid-keystroke; there is no network call on this path. */
    $('q').addEventListener('input', function () {
      clearTimeout(searchDebounce);
      var q = $('q').value.trim();
      searchDebounce = setTimeout(function () { renderLocalMatches(q); }, 120);
    });

    renderCommonBrowser();

    $('scanBtn').addEventListener('click', openBarcode);
    $('barcodeClose').addEventListener('click', closeBarcode);
    $('barcodeGo').addEventListener('click', function () {
      var v = $('barcodeInput').value.replace(/\D/g, '');
      if (v) lookupBarcode(v);
    });
    $('barcodeInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('barcodeGo').click(); }
    });

    renderFluidControls();
    $('addFluidBtn').addEventListener('click', function () {
      Log.addFluid(fluidChoice.drink, fluidChoice.ml);
      show('today');
    });

    $('portionBack').addEventListener('click', function () {
      state.pending = null;
      show('add');
    });

    $('unitSel').value = state.unit;
    $('unitSel').addEventListener('change', function () {
      state.unit = this.value;
      savePref('unit', this.value);
      renderToday();
    });

    $('fluidSel').value = state.fluidUnit;
    $('fluidSel').addEventListener('change', function () {
      state.fluidUnit = this.value;
      savePref('fluidUnit', this.value);
      renderToday();
    });

    try {
      var k = localStorage.getItem('rl:usdaKey');
      if (k) $('usdaKeyInput').value = k;
    } catch (e) { /* ignore */ }

    $('saveKeyBtn').addEventListener('click', function () {
      var v = $('usdaKeyInput').value.trim();
      try {
        if (v) localStorage.setItem('rl:usdaKey', v);
        else localStorage.removeItem('rl:usdaKey');
        $('keyStatus').textContent = v ? 'Saved. Your key will be used from now on.'
                                       : 'Cleared. The shared key will be used.';
      } catch (e) {
        $('keyStatus').textContent = 'Could not save — storage is blocked in this browser.';
      }
    });

    $('exportBtn').addEventListener('click', exportCSV);

    $('clearBtn').addEventListener('click', function () {
      if (!window.confirm('Delete every food log on this device? This cannot be undone.')) return;
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf('rl:') === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* ignore */ }
      show('today');
    });

    show('today');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline is a bonus */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
