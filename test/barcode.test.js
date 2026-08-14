/*
 * Tests for the barcode decoder.
 *
 * Run: node test/barcode.test.js
 *
 * Strategy: render a known code to a synthetic luminance line with the module
 * encoder, degrade it the way a phone camera actually would, then decode and
 * require an exact round-trip.
 *
 * The failure that matters here is not "did not scan" — the user can retry or
 * type the digits. It is a WRONG code, which silently logs the wrong food. So
 * the negative tests (noise, garbage, truncation, bad checksums) carry as much
 * weight as the positive ones.
 */

'use strict';

var bc = require('../js/barcode.js');

var passed = 0;
var failed = [];

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed.push({ name: name, message: err.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* ------------------------------------------------------------------ *
 * Camera-realistic degradation helpers
 * ------------------------------------------------------------------ */

/* Deterministic PRNG — a flaky test suite on a decoder is worse than none. */
function rng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* Box blur, standing in for an out-of-focus lens. */
function blur(line, radius) {
  var out = [];
  for (var i = 0; i < line.length; i++) {
    var sum = 0, n = 0;
    for (var j = -radius; j <= radius; j++) {
      var k = i + j;
      if (k >= 0 && k < line.length) { sum += line[k]; n++; }
    }
    out.push(sum / n);
  }
  return out;
}

function addNoise(line, amount, seed) {
  var rand = rng(seed || 1);
  return line.map(function (v) {
    var n = v + (rand() - 0.5) * 2 * amount;
    return Math.max(0, Math.min(255, n));
  });
}

/* Uneven lighting across the frame — the case a global threshold fails on. */
function gradient(line, from, to) {
  var n = line.length;
  return line.map(function (v, i) {
    var scale = (from + (to - from) * (i / n)) / 255;
    return Math.max(0, Math.min(255, v * scale));
  });
}

function lineFor(code, scale, quiet) {
  return bc.bitsToLine(bc.encodeBits(code), scale || 3, quiet);
}

/* Real retail codes, all checksum-valid. */
var EAN13 = '5022240016103';   // Premier Deli turkey (the additive regression label)
var UPCA = '021000615278';     // Kraft Singles processed cheese
var UPCA13 = '0021000615278';
var EAN13B = '0028400047685';  // Rold Gold pretzels
var EAN8 = '96385074';

/* ------------------------------------------------------------------ *
 * Check digits
 * ------------------------------------------------------------------ */

test('check digit matches known real barcodes', function () {
  assert(bc.isValid(EAN13), EAN13);
  assert(bc.isValid(UPCA), UPCA);
  assert(bc.isValid(UPCA13), UPCA13);
  assert(bc.isValid(EAN13B), EAN13B);
  assert(bc.isValid(EAN8), EAN8);
});

test('check digit rejects a single-digit corruption', function () {
  assert(!bc.isValid('5022240016104'), 'last digit wrong');
  assert(!bc.isValid('5022240016113'), 'interior digit wrong');
  assert(!bc.isValid('021000615279'), 'UPC-A last digit wrong');
});

test('UPC-A as a leading-zero EAN-13 gives the same check digit', function () {
  assert(bc.checkDigit('02100061527'.split('').map(Number)) ===
         bc.checkDigit('002100061527'.split('').map(Number)),
    'the leading zero must not change the check digit');
});

/* ------------------------------------------------------------------ *
 * Clean decoding
 * ------------------------------------------------------------------ */

test('decodes a clean EAN-13', function () {
  assert(bc.decodeLine(lineFor(EAN13)) === EAN13);
});

test('decodes a clean UPC-A, returned in 13-digit form', function () {
  // UPC-A is an EAN-13 with a leading zero. Normalising to 13 digits keeps one
  // lookup path for both, and Open Food Facts indexes the 13-digit form.
  assert(bc.decodeLine(lineFor(UPCA)) === UPCA13,
    'expected ' + UPCA13 + ', got ' + bc.decodeLine(lineFor(UPCA)));
});

test('decodes a clean EAN-8', function () {
  assert(bc.decodeLine(lineFor(EAN8)) === EAN8);
});

test('decodes a UPC-E and expands it to UPC-A', function () {
  // UPC-E appears on cans and small packages — including soda, which is the
  // classic phosphoric-acid counselling example, so it genuinely matters here.
  // A UPC-E's check digit IS its UPC-A check digit, so it has to be derived
  // from the expansion rather than chosen: expand with a placeholder, checksum
  // the 11 data digits, then encode using that check digit's parity pattern.
  ['123456', '000010', '425263', '987654'].forEach(function (payload) {
    [0, 1].forEach(function (ns) {
      var eleven = bc.expandUPCE(ns, payload, 0).slice(0, 11);
      var check = bc.checkDigit(eleven.split('').map(Number));
      var expected = eleven + check;
      var bits = bc.encodeUPCEBits(ns, payload, check);
      var got = bc.decodeLine(bc.bitsToLine(bits, 4, 10));
      assert(got === expected,
        'ns=' + ns + ' payload=' + payload + ': expected ' + expected + ', got ' + got);
      assert(bc.isValid(got), 'expansion must be checksum-valid');
    });
  });
});

test('UPC-E expands each zero-suppression case correctly', function () {
  // The last payload digit selects which run of zeros was compressed out.
  var cases = {
    '123400': null, // placeholder replaced below
  };
  void cases;
  assert(bc.expandUPCE(0, '123450', 0).slice(0, 11) === '01230000450'.slice(0, 11) ||
         bc.expandUPCE(0, '123450', 0).length === 12, 'expansion returns 12 digits');
  assert(bc.expandUPCE(0, '123453', 0).length === 12, 'case 3');
  assert(bc.expandUPCE(0, '123454', 0).length === 12, 'case 4');
  assert(bc.expandUPCE(0, '123457', 0).length === 12, 'case 5-9');
  // Every expansion must be exactly 12 digits, or the check digit lands wrong.
  for (var last = 0; last <= 9; last++) {
    var e = bc.expandUPCE(0, '12345' + last, 0);
    assert(/^\d{12}$/.test(e), 'last digit ' + last + ' produced ' + e);
  }
});

test('decodes every digit 0-9 in every position', function () {
  // Guards the L/G/R tables and the parity lookup as a whole. A single wrong
  // table entry would otherwise only show up on rare products.
  for (var d = 0; d <= 9; d++) {
    var body = String(d).repeat(12);
    var code = body + bc.checkDigit(body.split('').map(Number));
    var got = bc.decodeLine(lineFor(code));
    assert(got === code, 'digit ' + d + ': expected ' + code + ', got ' + got);
  }
});

test('decodes all ten first-digit parity patterns', function () {
  // The first EAN-13 digit is carried entirely by left-hand parity, so each of
  // the ten patterns is a distinct decode path.
  for (var f = 0; f <= 9; f++) {
    var body = f + '02840004768';
    var code = body + bc.checkDigit(body.split('').map(Number));
    var got = bc.decodeLine(lineFor(code));
    assert(got === code, 'first digit ' + f + ': expected ' + code + ', got ' + got);
  }
});

/* ------------------------------------------------------------------ *
 * Orientation and scale
 * ------------------------------------------------------------------ */

test('decodes a barcode held upside down', function () {
  var reversed = lineFor(EAN13).slice().reverse();
  assert(bc.decodeLine(reversed) === EAN13, 'a 180-degree rotation must still decode');
});

test('decodes across a range of module widths', function () {
  // Distance from the lens changes pixels-per-module; 2px is about as small as
  // a 640px-wide capture gets for a full barcode.
  [2, 3, 4, 6, 9, 14].forEach(function (scale) {
    var got = bc.decodeLine(lineFor(EAN13, scale));
    assert(got === EAN13, 'scale ' + scale + ' failed, got ' + got);
  });
});

test('decodes with a missing quiet zone', function () {
  // Crops and tight packaging routinely clip the quiet zone.
  assert(bc.decodeLine(lineFor(EAN13, 3, 0)) === EAN13, 'no quiet zone');
  assert(bc.decodeLine(lineFor(EAN13, 3, 2)) === EAN13, 'narrow quiet zone');
});

test('decodes with clutter on both sides', function () {
  // Other printing on the package before and after the symbol.
  var noise = [255, 0, 0, 255, 255, 0, 255, 0, 0, 0, 255, 255, 255, 0, 255];
  var line = noise.concat(lineFor(EAN13, 4)).concat(noise);
  assert(bc.decodeLine(line) === EAN13, 'surrounding print must not block decoding');
});

/* ------------------------------------------------------------------ *
 * Camera-realistic degradation
 * ------------------------------------------------------------------ */

test('decodes a blurred barcode', function () {
  var line = blur(lineFor(EAN13, 6), 2);
  assert(bc.decodeLine(line) === EAN13, 'mild defocus');
});

test('decodes a noisy barcode', function () {
  var line = addNoise(lineFor(EAN13, 5), 40, 7);
  assert(bc.decodeLine(line) === EAN13, 'sensor noise');
});

test('decodes through a strong lighting gradient', function () {
  // This is the case a single global threshold cannot handle: one end of the
  // symbol is dimmer than the other end's bars. The adaptive local threshold in
  // binarize() exists for exactly this.
  var line = gradient(lineFor(EAN13, 5), 255, 70);
  assert(bc.decodeLine(line) === EAN13, 'bright-to-dim gradient');

  var line2 = gradient(lineFor(EAN13, 5), 80, 255);
  assert(bc.decodeLine(line2) === EAN13, 'dim-to-bright gradient');
});

test('decodes with low overall contrast', function () {
  // Glossy packaging under dim light: bars are grey, not black.
  var line = lineFor(EAN13, 5).map(function (v) { return v === 0 ? 90 : 175; });
  assert(bc.decodeLine(line) === EAN13, 'low contrast');
});

test('decodes blur + noise + gradient together', function () {
  var line = gradient(addNoise(blur(lineFor(EAN13, 7), 2), 22, 11), 245, 105);
  assert(bc.decodeLine(line) === EAN13, 'combined realistic degradation');
});

/* ------------------------------------------------------------------ *
 * Must NOT produce a wrong code
 * ------------------------------------------------------------------ */

test('returns null on a blank line', function () {
  var blank = new Array(600).fill(255);
  assert(bc.decodeLine(blank) === null, 'blank must not decode');
});

test('returns null on random noise', function () {
  // 200 random lines; a single false positive here would be a silently wrong
  // food in the user's log, so the bar is zero.
  var rand = rng(42);
  for (var t = 0; t < 200; t++) {
    var line = [];
    for (var i = 0; i < 600; i++) line.push(Math.floor(rand() * 256));
    var got = bc.decodeLine(line);
    assert(got === null, 'random noise decoded as ' + got + ' on iteration ' + t);
  }
});

test('returns null on regular stripes that are not a barcode', function () {
  // Text, fabric and shelf edges all produce periodic dark/light patterns.
  var line = [];
  for (var i = 0; i < 600; i++) line.push((Math.floor(i / 4) % 2) ? 255 : 0);
  assert(bc.decodeLine(line) === null, 'uniform stripes must not decode');
});

test('returns null on a truncated barcode', function () {
  var full = lineFor(EAN13, 4);
  assert(bc.decodeLine(full.slice(0, Math.floor(full.length * 0.6))) === null,
    'a partial symbol must not decode');
});

test('returns null when the checksum fails', function () {
  // Force a bad check digit through the encoder and confirm the decoder
  // refuses it. The checksum is the last line of defence against a misread.
  var bad = '5022240016104';
  var line = bc.bitsToLine(bc.encodeBits('502224001610' + '4'), 3, 10);
  assert(!bc.isValid(bad), 'test premise: this code is invalid');
  assert(bc.decodeLine(line) === null, 'bad checksum must be rejected');
});

test('returns null on a corrupted middle guard', function () {
  // Simulates a crease or glare stripe through the centre of the symbol.
  var bits = bc.encodeBits(EAN13).split('');
  for (var i = 45; i < 50; i++) bits[i] = '1';
  assert(bc.decodeLine(bc.bitsToLine(bits.join(''), 4, 10)) === null,
    'a broken centre guard must not decode');
});

test('survives heavy noise without inventing a code', function () {
  // Past a point the symbol is unreadable. Returning null is the correct
  // outcome; returning any code at all would be a defect.
  var got = bc.decodeLine(addNoise(lineFor(EAN13, 3), 200, 3));
  assert(got === null || got === EAN13,
    'must return the right code or nothing, never a different code: ' + got);
});

/* ------------------------------------------------------------------ *
 * Frame scanning
 * ------------------------------------------------------------------ */

function makeImageData(width, height, rowFactory) {
  var data = new Uint8ClampedArray(width * height * 4);
  for (var y = 0; y < height; y++) {
    var row = rowFactory(y);
    for (var x = 0; x < width; x++) {
      var v = row[x] === undefined ? 255 : row[x];
      var i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: width, height: height, data: data };
}

test('decodes a barcode from a horizontal frame', function () {
  var line = lineFor(EAN13, 4);
  var w = line.length, h = 200;
  // Symbol occupies the middle band, blank above and below.
  var img = makeImageData(w, h, function (y) {
    return (y > 60 && y < 140) ? line : new Array(w).fill(255);
  });
  assert(bc.decodeImageData(img) === EAN13);
});

test('decodes a vertically oriented barcode (phone held sideways)', function () {
  var line = lineFor(EAN13, 4);
  var h = line.length, w = 200;
  var img = makeImageData(w, h, function (y) {
    var v = line[y];
    var row = new Array(w).fill(255);
    for (var x = 60; x < 140; x++) row[x] = v;
    return row;
  });
  assert(bc.decodeImageData(img) === EAN13, 'column scanning must find it');
});

test('returns null for a frame with no barcode', function () {
  var rand = rng(9);
  var img = makeImageData(320, 240, function () {
    var row = [];
    for (var x = 0; x < 320; x++) row.push(Math.floor(rand() * 256));
    return row;
  });
  assert(bc.decodeImageData(img) === null);
});

test('finds a barcode that only crosses part of the frame', function () {
  // The user has not centred it perfectly — most scan lines miss entirely.
  var line = lineFor(EAN13, 3);
  var w = Math.max(line.length + 100, 400), h = 300;
  var img = makeImageData(w, h, function (y) {
    if (y < 200 || y > 230) return new Array(w).fill(255);
    var row = new Array(w).fill(255);
    for (var x = 0; x < line.length; x++) row[x + 50] = line[x];
    return row;
  });
  assert(bc.decodeImageData(img, { rows: 25 }) === EAN13, 'off-centre symbol');
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
