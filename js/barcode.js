/*
 * barcode.js — retail 1D barcode decoder (EAN-13, UPC-A, EAN-8, UPC-E)
 *
 * WHY THIS EXISTS
 * ---------------
 * The native BarcodeDetector API is unimplemented in Safari, which is a large
 * share of this app's audience. Without it, an iPhone user has to read 13 digits
 * off a package and type them in — which in practice means they stop logging
 * packaged food, and packaged food is precisely where the phosphate additives
 * are. Barcode scanning is not a convenience feature here; it is the path to
 * the ingredient list.
 *
 * WHY HAND-WRITTEN RATHER THAN A LIBRARY
 * ZXing/Quagga are more robust in bad conditions, but they are ~250-300 KB of
 * unauditable minified code, and this project has no build step and no
 * dependencies. Retail food packaging uses exactly four symbologies, all of
 * which are simple, fixed-length and checksum-protected. That narrow scope fits
 * in ~350 lines that can be unit-tested deterministically in Node — which
 * matters more here than raw decode rate, because a wrong barcode silently logs
 * the wrong food.
 *
 * Every result is validated against its check digit, and the caller is expected
 * to require two agreeing reads before acting. Manual entry stays available.
 *
 * SCOPE: EAN-13, UPC-A (a 12-digit EAN-13 with a leading zero), EAN-8 and UPC-E
 * (the compressed form on cans and small packages). No 2D codes, no Code 128 —
 * neither appears on consumer food packaging.
 */

(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Symbol tables
   *
   * Each digit occupies 7 modules rendered as 4 alternating runs. Run WIDTHS
   * are what we match on, because widths survive blur and scaling while exact
   * pixel patterns do not.
   *
   * A useful identity keeps these tables small:
   *   R-code is the bitwise complement of L-code, so their run widths are
   *   identical (only the bar/space roles swap, which position already tells us).
   *   G-code is the reverse of R-code, so G widths are L widths reversed.
   * ------------------------------------------------------------------ */

  /* L-code run widths, as [space, bar, space, bar], summing to 7. */
  var L_RUNS = [
    [3, 2, 1, 1], // 0  0001101
    [2, 2, 2, 1], // 1  0011001
    [2, 1, 2, 2], // 2  0010011
    [1, 4, 1, 1], // 3  0111101
    [1, 1, 3, 2], // 4  0100011
    [1, 2, 3, 1], // 5  0110001
    [1, 1, 1, 4], // 6  0101111
    [1, 3, 1, 2], // 7  0111011
    [1, 2, 1, 3], // 8  0110111
    [3, 1, 1, 2]  // 9  0001011
  ];

  var G_RUNS = L_RUNS.map(function (p) { return p.slice().reverse(); });
  var R_RUNS = L_RUNS; // identical widths; only the colour roles differ

  /* Parity of the six left-hand digits encodes EAN-13's first digit. 0=L, 1=G. */
  var PARITY_TO_FIRST = {
    '000000': 0, '001011': 1, '001101': 2, '001110': 3, '010011': 4,
    '011001': 5, '011100': 6, '010101': 7, '010110': 8, '011010': 9
  };

  /* UPC-E parity patterns for number system 0, indexed by check digit.
   * Number system 1 uses the bitwise complement of these. */
  var UPCE_PARITY = [
    '111000', '110100', '110010', '110001', '101100',
    '100110', '100011', '101010', '101001', '100101'
  ];

  var START_GUARD = [1, 1, 1];       // bar space bar
  var MIDDLE_GUARD = [1, 1, 1, 1, 1]; // space bar space bar space
  var UPCE_END_GUARD = [1, 1, 1, 1, 1, 1];

  /* ------------------------------------------------------------------ *
   * Check digits
   * ------------------------------------------------------------------ */

  /**
   * Standard GS1 modulo-10 check digit. Weights alternate 3,1,3,1... starting
   * from the RIGHTMOST data digit, which makes one function correct for EAN-13
   * (12 data digits), UPC-A (11) and EAN-8 (7) alike.
   */
  function checkDigit(digits) {
    var sum = 0;
    var weight = 3;
    for (var i = digits.length - 1; i >= 0; i--) {
      sum += digits[i] * weight;
      weight = weight === 3 ? 1 : 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  function isValid(code) {
    if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
    var digits = code.split('').map(Number);
    var expected = checkDigit(digits.slice(0, digits.length - 1));
    return expected === digits[digits.length - 1];
  }

  /* ------------------------------------------------------------------ *
   * Pattern matching
   * ------------------------------------------------------------------ */

  /*
   * Compare observed run widths against an ideal pattern, scale-invariantly.
   * Returns a variance score (lower is better) or Infinity if any single run is
   * too far off. Mirrors the approach used by mature decoders: normalise by the
   * implied module width, then reject on per-run deviation rather than only on
   * the total, so one badly-blurred run cannot be averaged away.
   */
  function patternVariance(counters, offset, pattern, maxIndividual) {
    var n = pattern.length;
    var total = 0;
    var patternTotal = 0;
    var i;
    for (i = 0; i < n; i++) {
      total += counters[offset + i];
      patternTotal += pattern[i];
    }
    if (total < patternTotal) return Infinity; // fewer pixels than modules

    var unit = total / patternTotal;
    var maxVariance = unit * maxIndividual;
    var totalVariance = 0;
    for (i = 0; i < n; i++) {
      var scaled = pattern[i] * unit;
      var variance = Math.abs(counters[offset + i] - scaled);
      if (variance > maxVariance) return Infinity;
      totalVariance += variance;
    }
    return totalVariance / total;
  }

  function matchesGuard(runs, offset, pattern) {
    if (offset + pattern.length > runs.length) return false;
    return patternVariance(runs, offset, pattern, 0.7) !== Infinity;
  }

  /*
   * Structural sanity check — the single most important guard against a WRONG
   * decode, which is far worse than a failed one because it silently logs the
   * wrong food.
   *
   * Guard patterns and digit patterns alone are too weak: random image noise
   * regularly produces run sequences that satisfy them and then pass the
   * checksum by chance (~1 in 10). But a genuine symbol also has a fixed total
   * width — EAN-13 is exactly 95 modules, EAN-8 is 67, UPC-E is 51 — so the
   * module width implied by the whole symbol must agree with the module width
   * measured from the start guard. Noise almost never satisfies both at once.
   *
   * Tolerance is deliberately wide (0.72-1.38) so blur and perspective still
   * decode; the constraint is doing structural work, not sub-pixel work.
   */
  function widthIsConsistent(runs, start, end, expectedModules) {
    var guardWidth = runs[start] + runs[start + 1] + runs[start + 2];
    if (guardWidth <= 0) return false;
    var guardModule = guardWidth / 3;

    var total = 0;
    for (var i = start; i < end; i++) total += runs[i];
    var impliedModule = total / expectedModules;

    var ratio = impliedModule / guardModule;
    return ratio > 0.72 && ratio < 1.38;
  }

  /*
   * A symbol is preceded by a quiet zone. Requiring even a modest one discards
   * most noise-driven start-guard candidates for free. A symbol flush against
   * the start of the line is accepted, because crops and tight packaging
   * routinely clip the quiet zone away entirely.
   */
  function hasQuietZone(runs, start) {
    if (start === 0) return true;
    var guardModule = (runs[start] + runs[start + 1] + runs[start + 2]) / 3;
    return runs[start - 1] >= guardModule * 1.5;
  }

  /*
   * A symbol must also be followed by blank space. Every symbology here ends on
   * a bar, so the next run is necessarily the trailing quiet zone. Cheap, and it
   * removes most of the remaining noise-driven candidates, which tend to sit in
   * the middle of a dense run sequence with no blank space after them.
   */
  function hasTrailingQuietZone(runs, start, end) {
    if (end >= runs.length) return true; // symbol runs to the end of the line
    var guardModule = (runs[start] + runs[start + 1] + runs[start + 2]) / 3;
    return runs[end] >= guardModule * 1.5;
  }

  /*
   * Best-matching digit for 4 run widths.
   *
   * The thresholds are deliberately tighter than a general-purpose decoder's.
   * Loose tolerances let random image noise satisfy the digit patterns, and
   * since a UPC-E payload is only six digits with a one-in-ten checksum, noise
   * then produces a valid-looking code roughly often enough to matter. A missed
   * scan costs a retry; a wrong scan logs the wrong food.
   */
  var DIGIT_MAX_INDIVIDUAL = 0.48;
  var DIGIT_MAX_VARIANCE = 0.32;

  function matchDigit(runs, offset, table) {
    var best = -1;
    var bestVariance = DIGIT_MAX_VARIANCE;
    for (var d = 0; d < 10; d++) {
      var v = patternVariance(runs, offset, table[d], DIGIT_MAX_INDIVIDUAL);
      if (v < bestVariance) { bestVariance = v; best = d; }
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * Luminance line -> runs
   * ------------------------------------------------------------------ */

  /*
   * Adaptive block-based threshold, midway between the local min and max.
   *
   * A single global threshold fails on the common case of a phone held over a
   * curved package under overhead light: one end of the symbol is dimmer than
   * the other end's bars, so the whole end reads as black.
   *
   * A local *mean* threshold seems like the fix but is subtly wrong, and was
   * the first version of this function. Inside a wide uniform bar the local
   * mean equals the pixel value, so the middle of a thick bar falls on the
   * wrong side of the threshold and splits into three runs. Local min/max has
   * no such degenerate case, provided the window is wide enough to span at
   * least one bar and one space — hence blocks sized off the line length, and
   * a three-block neighbourhood.
   *
   * Low-contrast neighbourhoods resolve to white so that flat background does
   * not speckle into thousands of phantom runs.
   */
  function binarize(line) {
    var n = line.length;
    if (n < 32) return null;

    var min = 255, max = 0, i;
    for (i = 0; i < n; i++) {
      if (line[i] < min) min = line[i];
      if (line[i] > max) max = line[i];
    }
    /* No barcode crosses this line — bail before wasting work. */
    if (max - min < 24) return null;

    var blockSize = Math.max(8, Math.round(n / 24));
    var blocks = Math.ceil(n / blockSize);
    var bMin = new Float64Array(blocks);
    var bMax = new Float64Array(blocks);
    for (i = 0; i < blocks; i++) { bMin[i] = 255; bMax[i] = 0; }

    for (i = 0; i < n; i++) {
      var b = (i / blockSize) | 0;
      if (line[i] < bMin[b]) bMin[b] = line[i];
      if (line[i] > bMax[b]) bMax[b] = line[i];
    }

    var out = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      var blk = (i / blockSize) | 0;
      var lo = blk > 0 ? blk - 1 : 0;
      var hi = blk < blocks - 1 ? blk + 1 : blocks - 1;
      var localMin = 255, localMax = 0;
      for (var k = lo; k <= hi; k++) {
        if (bMin[k] < localMin) localMin = bMin[k];
        if (bMax[k] > localMax) localMax = bMax[k];
      }
      if (localMax - localMin < 24) {
        out[i] = 0; // flat neighbourhood: treat as background
      } else {
        out[i] = line[i] < (localMin + localMax) / 2 ? 1 : 0;
      }
    }
    return out;
  }

  /** Run-length encode a binarized line. Returns { widths, firstIsBlack }. */
  function toRuns(bits) {
    var widths = [];
    var current = bits[0];
    var count = 0;
    for (var i = 0; i < bits.length; i++) {
      if (bits[i] === current) {
        count++;
      } else {
        widths.push(count);
        current = bits[i];
        count = 1;
      }
    }
    widths.push(count);
    return { widths: widths, firstIsBlack: bits[0] === 1 };
  }

  /* ------------------------------------------------------------------ *
   * Symbology decoders
   *
   * Each takes the run widths and the index of the start guard's first (black)
   * run, and returns a digit string or null. Run bookkeeping:
   *   EAN-13  3 guard + 24 left + 5 middle + 24 right + 3 end = 59 runs
   *   EAN-8   3 + 16 + 5 + 16 + 3 = 43 runs
   *   UPC-E   3 + 24 + 6 = 33 runs
   * ------------------------------------------------------------------ */

  function decodeEANLike(runs, start, digitsPerSide) {
    var idx = start + START_GUARD.length;
    var left = [];
    var parity = '';
    var i, d;

    for (i = 0; i < digitsPerSide; i++) {
      if (idx + 4 > runs.length) return null;
      var lDigit = matchDigit(runs, idx, L_RUNS);
      var gDigit = digitsPerSide === 6 ? matchDigit(runs, idx, G_RUNS) : -1;

      if (lDigit < 0 && gDigit < 0) return null;

      /* When both tables match, keep whichever fits better. */
      if (lDigit >= 0 && gDigit >= 0) {
        var lv = patternVariance(runs, idx, L_RUNS[lDigit], DIGIT_MAX_INDIVIDUAL);
        var gv = patternVariance(runs, idx, G_RUNS[gDigit], DIGIT_MAX_INDIVIDUAL);
        if (gv < lv) { left.push(gDigit); parity += '1'; }
        else { left.push(lDigit); parity += '0'; }
      } else if (lDigit >= 0) {
        left.push(lDigit); parity += '0';
      } else {
        left.push(gDigit); parity += '1';
      }
      idx += 4;
    }

    if (!matchesGuard(runs, idx, MIDDLE_GUARD)) return null;
    idx += MIDDLE_GUARD.length;

    var right = [];
    for (i = 0; i < digitsPerSide; i++) {
      if (idx + 4 > runs.length) return null;
      d = matchDigit(runs, idx, R_RUNS);
      if (d < 0) return null;
      right.push(d);
      idx += 4;
    }

    if (!matchesGuard(runs, idx, START_GUARD)) return null;
    idx += START_GUARD.length;

    /* 95 modules for EAN-13, 67 for EAN-8. */
    var expectedModules = digitsPerSide === 6 ? 95 : 67;
    if (!widthIsConsistent(runs, start, idx, expectedModules)) return null;
    if (!hasTrailingQuietZone(runs, start, idx)) return null;

    var code;
    if (digitsPerSide === 6) {
      var first = PARITY_TO_FIRST[parity];
      if (first === undefined) return null; // impossible parity => misread
      code = String(first) + left.join('') + right.join('');
    } else {
      code = left.join('') + right.join('');
    }
    return isValid(code) ? code : null;
  }

  /**
   * Expand a 6-digit UPC-E payload to its 12-digit UPC-A equivalent.
   * The final payload digit selects which zero-run the compression removed.
   */
  function expandUPCE(ns, payload, check) {
    var d = payload.split('');
    var last = d[5];
    var mid;
    if (last === '0' || last === '1' || last === '2') {
      mid = d[0] + d[1] + last + '0000' + d[2] + d[3] + d[4];
    } else if (last === '3') {
      mid = d[0] + d[1] + d[2] + '00000' + d[3] + d[4];
    } else if (last === '4') {
      mid = d[0] + d[1] + d[2] + d[3] + '00000' + d[4];
    } else {
      mid = d[0] + d[1] + d[2] + d[3] + d[4] + '0000' + last;
    }
    return String(ns) + mid + String(check);
  }

  function decodeUPCE(runs, start) {
    var idx = start + START_GUARD.length;
    var payload = [];
    var parity = '';

    for (var i = 0; i < 6; i++) {
      if (idx + 4 > runs.length) return null;
      var lDigit = matchDigit(runs, idx, L_RUNS);
      var gDigit = matchDigit(runs, idx, G_RUNS);
      if (lDigit < 0 && gDigit < 0) return null;

      if (lDigit >= 0 && gDigit >= 0) {
        var lv = patternVariance(runs, idx, L_RUNS[lDigit], DIGIT_MAX_INDIVIDUAL);
        var gv = patternVariance(runs, idx, G_RUNS[gDigit], DIGIT_MAX_INDIVIDUAL);
        if (gv < lv) { payload.push(gDigit); parity += '1'; }
        else { payload.push(lDigit); parity += '0'; }
      } else if (lDigit >= 0) {
        payload.push(lDigit); parity += '0';
      } else {
        payload.push(gDigit); parity += '1';
      }
      idx += 4;
    }

    if (!matchesGuard(runs, idx, UPCE_END_GUARD)) return null;
    idx += UPCE_END_GUARD.length;

    /* UPC-E is 51 modules. This check matters most here: UPC-E needs only 33
     * runs and its end guard is a weak pattern, so it was by far the largest
     * source of noise-driven false positives before the width constraint. */
    if (!widthIsConsistent(runs, start, idx, 51)) return null;
    if (!hasTrailingQuietZone(runs, start, idx)) return null;

    var check = UPCE_PARITY.indexOf(parity);
    var ns = 0;
    if (check < 0) {
      var flipped = parity.split('').map(function (b) { return b === '0' ? '1' : '0'; }).join('');
      check = UPCE_PARITY.indexOf(flipped);
      ns = 1;
      if (check < 0) return null;
    }

    var code = expandUPCE(ns, payload.join(''), check);
    return isValid(code) ? code : null;
  }

  /* ------------------------------------------------------------------ *
   * Line decoding
   * ------------------------------------------------------------------ */

  function decodeRuns(runs, firstIsBlack) {
    /* Candidate start guards are black runs; step by 2 to stay on black. */
    var first = firstIsBlack ? 0 : 1;
    for (var i = first; i + START_GUARD.length <= runs.length; i += 2) {
      if (!matchesGuard(runs, i, START_GUARD)) continue;
      if (!hasQuietZone(runs, i)) continue;
      var code = decodeEANLike(runs, i, 6) ||  // EAN-13 / UPC-A
                 decodeEANLike(runs, i, 4) ||  // EAN-8
                 decodeUPCE(runs, i);          // UPC-E
      if (code) return code;
    }
    return null;
  }

  /**
   * Decode one horizontal slice of luminance values.
   * Tries the line as given, then reversed — a package held upside down
   * produces exactly the reversed pixel order, so one extra pass covers 180°
   * rotation without any special-case decoding logic.
   *
   * @param {ArrayLike<number>} line luminance samples, 0-255
   * @returns {string|null} a checksum-valid code, or null
   */
  function decodeLine(line) {
    var bits = binarize(line);
    if (!bits) return null;

    var runs = toRuns(bits);
    if (runs.widths.length < 30) return null; // too few transitions to be a barcode

    var code = decodeRuns(runs.widths, runs.firstIsBlack);
    if (code) return code;

    var reversedWidths = runs.widths.slice().reverse();
    /* Reversing the run list flips which end we start from, so the first run's
     * colour becomes the last run's colour. */
    var lastIsBlack = (runs.widths.length % 2 === 1) ? runs.firstIsBlack : !runs.firstIsBlack;
    return decodeRuns(reversedWidths, lastIsBlack);
  }

  /* ------------------------------------------------------------------ *
   * Frame decoding
   * ------------------------------------------------------------------ */

  function luminanceAt(data, i) {
    /* Rec. 601 luma. Green dominates perceived brightness, and print contrast
     * on packaging is usually strongest there. */
    return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }

  /**
   * Scan an ImageData for a barcode.
   *
   * Samples horizontal rows AND vertical columns: users hold phones in both
   * orientations, and a barcode perpendicular to every scan line is invisible
   * no matter how good the decoder is. Rows are tried first because that is the
   * common case.
   *
   * @param {ImageData} imageData
   * @param {{rows?: number, cols?: number}} [opts]
   * @returns {string|null}
   */
  function decodeImageData(imageData, opts) {
    opts = opts || {};
    var w = imageData.width;
    var h = imageData.height;
    var data = imageData.data;
    var rows = opts.rows || 15;
    var cols = opts.cols || 9;
    var i, j, code;

    /* Concentrate on the middle band: users centre the barcode, and the frame
     * edges are where distortion and vignetting are worst. */
    var line = new Uint8ClampedArray(Math.max(w, h));

    for (i = 0; i < rows; i++) {
      var y = Math.round(h * (0.15 + 0.7 * (rows === 1 ? 0.5 : i / (rows - 1))));
      if (y < 0 || y >= h) continue;
      var rowBase = y * w * 4;
      for (j = 0; j < w; j++) line[j] = luminanceAt(data, rowBase + j * 4);
      code = decodeLine(line.subarray(0, w));
      if (code) return code;
    }

    for (i = 0; i < cols; i++) {
      var x = Math.round(w * (0.15 + 0.7 * (cols === 1 ? 0.5 : i / (cols - 1))));
      if (x < 0 || x >= w) continue;
      for (j = 0; j < h; j++) line[j] = luminanceAt(data, (j * w + x) * 4);
      code = decodeLine(line.subarray(0, h));
      if (code) return code;
    }

    return null;
  }

  /* ------------------------------------------------------------------ *
   * Encoder — used by the tests, and small enough to keep alongside
   * ------------------------------------------------------------------ */

  var L_BITS = ['0001101','0011001','0010011','0111101','0100011',
                '0110001','0101111','0111011','0110111','0001011'];
  var G_BITS = L_BITS.map(function (b) { return b.split('').reverse().join('')
    .split('').map(function (c) { return c === '0' ? '1' : '0'; }).join(''); });
  var R_BITS = L_BITS.map(function (b) {
    return b.split('').map(function (c) { return c === '0' ? '1' : '0'; }).join('');
  });

  /** Render a code to a module bit string ('1' = bar). Supports EAN-13/UPC-A/EAN-8. */
  function encodeBits(code) {
    var digits = code.split('').map(Number);
    if (digits.length === 12) return encodeBits('0' + code); // UPC-A -> EAN-13

    if (digits.length === 13) {
      var parity = Object.keys(PARITY_TO_FIRST).filter(function (k) {
        return PARITY_TO_FIRST[k] === digits[0];
      })[0];
      var out = '101';
      for (var i = 1; i <= 6; i++) {
        out += (parity[i - 1] === '1' ? G_BITS : L_BITS)[digits[i]];
      }
      out += '01010';
      for (i = 7; i <= 12; i++) out += R_BITS[digits[i]];
      return out + '101';
    }

    if (digits.length === 8) {
      var o = '101';
      for (var k = 0; k < 4; k++) o += L_BITS[digits[k]];
      o += '01010';
      for (k = 4; k < 8; k++) o += R_BITS[digits[k]];
      return o + '101';
    }

    throw new Error('encodeBits: unsupported length ' + digits.length);
  }

  /** Render a UPC-E payload (number system + 6 digits + check) to module bits. */
  function encodeUPCEBits(ns, payload, check) {
    var parity = UPCE_PARITY[check];
    if (ns === 1) {
      parity = parity.split('').map(function (b) { return b === '0' ? '1' : '0'; }).join('');
    }
    var out = '101';
    for (var i = 0; i < 6; i++) {
      out += (parity[i] === '1' ? G_BITS : L_BITS)[Number(payload[i])];
    }
    return out + '010101';
  }

  /**
   * Render module bits to a luminance line, with quiet zones.
   * @param {string} bits
   * @param {number} scale pixels per module
   * @param {number} quiet quiet-zone width in modules
   */
  function bitsToLine(bits, scale, quiet) {
    scale = scale || 3;
    quiet = quiet === undefined ? 10 : quiet;
    var line = [];
    var i, j;
    for (i = 0; i < quiet * scale; i++) line.push(255);
    for (i = 0; i < bits.length; i++) {
      var v = bits[i] === '1' ? 0 : 255;
      for (j = 0; j < scale; j++) line.push(v);
    }
    for (i = 0; i < quiet * scale; i++) line.push(255);
    return line;
  }

  var api = {
    decodeLine: decodeLine,
    decodeImageData: decodeImageData,
    checkDigit: checkDigit,
    isValid: isValid,
    encodeBits: encodeBits,
    encodeUPCEBits: encodeUPCEBits,
    expandUPCE: expandUPCE,
    bitsToLine: bitsToLine,
    binarize: binarize,
    toRuns: toRuns
  };

  root.RenalBarcode = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

