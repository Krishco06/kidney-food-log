/*
 * Contrast tests for the palette.
 *
 * Run: node test/contrast.test.js
 *
 * app.css opens by claiming ">= 7:1 for body text (WCAG AAA), >= 4.5:1 for
 * large text", and until now nothing checked it. A comment asserting an
 * accessibility property is not an accessibility property — and this palette
 * has been edited repeatedly (dark mode, badge tiers, the desktop layout), any
 * one of which could have quietly dropped a pair below threshold.
 *
 * The audience makes this load-bearing rather than pedantic: roughly half the
 * US dialysis population is over 65, and diabetes is the leading cause of
 * ESKD, so diabetic retinopathy is common. Low contrast is not a matter of
 * taste here.
 */

'use strict';

var fs = require('fs');
var path = require('path');

var passed = 0;
var failed = [];

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed.push({ name: name, message: err.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

var css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

/* Pull the six-digit hex custom properties out of one declaration block. */
function tokensIn(block) {
  var out = {};
  var re = /(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g;
  var m;
  while ((m = re.exec(block))) out[m[1]] = m[2];
  return out;
}

var darkAt = css.indexOf('@media (prefers-color-scheme: dark)');
var light = tokensIn(css.slice(css.indexOf(':root {'), darkAt));
var darkBlock = css.slice(darkAt);
var dark = tokensIn(darkBlock.slice(0, darkBlock.indexOf('\n}')));

/* WCAG 2.1 relative luminance and contrast ratio. */
function luminance(hex) {
  var ch = [1, 3, 5].map(function (i) {
    var v = parseInt(hex.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a, b) {
  var l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/*
 * Only pairs that genuinely render together. Testing every combination would
 * fail on colours that never touch, which teaches people to ignore the test.
 */
var PAIRS = [
  ['--text',      '--bg',            7.0, 'body text on the page'],
  ['--text',      '--surface',       7.0, 'body text on a card'],
  ['--text-soft', '--surface',       4.5, 'hint text on a card'],
  ['--text-soft', '--bg',            4.5, 'hint text on the page'],
  ['--accent',    '--surface',       4.5, 'accent / link on a card'],
  ['--flag-high', '--flag-high-bg',  4.5, 'high badge'],
  ['--flag-med',  '--flag-med-bg',   4.5, 'medium badge'],
  ['--flag-low',  '--flag-low-bg',   4.5, 'low badge'],
  ['--unknown',   '--unknown-bg',    4.5, 'unknown badge'],
  ['--ok',        '--ok-bg',         4.5, 'ok badge'],
  ['--unknown',   '--surface',       4.5, 'the "No data" value, which must be readable']
];

[['light', light], ['dark', dark]].forEach(function (pair) {
  var themeName = pair[0], theme = pair[1];

  test(themeName + ' theme declares every token the layout uses', function () {
    PAIRS.forEach(function (p) {
      assert(theme[p[0]], themeName + ' is missing ' + p[0]);
      assert(theme[p[1]], themeName + ' is missing ' + p[1]);
    });
  });

  PAIRS.forEach(function (p) {
    var fg = p[0], bg = p[1], min = p[2], label = p[3];
    test(themeName + ': ' + label + ' meets ' + min + ':1', function () {
      var r = contrast(theme[fg], theme[bg]);
      assert(r >= min,
        fg + ' on ' + bg + ' is ' + r.toFixed(2) + ':1, needs ' + min + ':1');
    });
  });
});

test('status is never carried by colour alone', function () {
  /*
   * The other half of the accessibility claim in app.css: every badge pairs a
   * colour with an icon and a word, because colour vision deficits and
   * retinopathy are both common in this population. loadBadge() is the one
   * that could regress to a bare coloured dot.
   */
  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  var m = app.match(/function loadBadge\(load\) \{[\s\S]*?\n  \}/);
  assert(m, 'loadBadge() not found');
  ['Large amount', 'Some', 'Usually a trace'].forEach(function (word) {
    assert(m[0].indexOf(word) !== -1,
      'loadBadge lost its word for one of the levels: expected "' + word + '"');
  });
});

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
