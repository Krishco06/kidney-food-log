/*
 * Source-hygiene tests.
 *
 * Run: node test/source.test.js
 *
 * These guard mistakes whose failure mode is SILENT — the file parses, the app
 * boots, and a regex quietly means something other than what it reads as. Every
 * one of them has actually happened while building this app, more than once.
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

var ROOT = path.join(__dirname, '..');

function sourceFiles() {
  var out = [];
  (function walk(d) {
    fs.readdirSync(d).forEach(function (f) {
      if (f === 'node_modules' || f === '.git') return;
      var p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) return walk(p);
      if (/\.(js|css|html|json|webmanifest|md|svg)$/.test(f)) out.push(p);
    });
  })(ROOT);
  return out;
}

/* ------------------------------------------------------------------ *
 * Stray control characters
 * ------------------------------------------------------------------ */

/*
 * Writing a regex through a shell heredoc collapses a doubled backslash, so
 * `\b` — a word boundary — arrives as byte 0x08, a literal backspace. The file
 * still parses. `/\b1\b/` becomes `/<BS>1<BS>/`, which matches a string almost
 * nothing ever contains, and a negative lookahead built the same way silently
 * matches everything instead of nothing.
 *
 * This bug shipped into this repo three separate times before it was caught by
 * eye with `cat -A`. It costs nothing to catch mechanically, so it is caught
 * mechanically. Tab, LF and CR are the only sub-0x20 bytes any of these files
 * has a reason to contain.
 */
test('no source file contains a stray control character', function () {
  var bad = [];
  sourceFiles().forEach(function (p) {
    var s = fs.readFileSync(p, 'utf8');
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
        bad.push(path.relative(ROOT, p) + ':' + s.slice(0, i).split('\n').length +
                 ' contains 0x' + c.toString(16).padStart(2, '0'));
      }
    }
  });
  assert(bad.length === 0,
    'stray control characters (a \\b written through a shell heredoc becomes ' +
    'byte 0x08 and silently changes what the regex matches):\n  ' + bad.join('\n  '));
});

/* A BOM ahead of an IIFE is harmless in a browser but breaks `node -e` style
 * harnesses and shows up as a phantom character in diffs. */
test('no source file starts with a byte-order mark', function () {
  var bad = sourceFiles().filter(function (p) {
    return fs.readFileSync(p, 'utf8').charCodeAt(0) === 0xFEFF;
  }).map(function (p) { return path.relative(ROOT, p); });
  assert(bad.length === 0, 'byte-order mark in: ' + bad.join(', '));
});

/* ------------------------------------------------------------------ *
 * The regulatory boundary, restated as a repo-wide check
 * ------------------------------------------------------------------ */

/*
 * log.test.js already gates log.js against limit/target/threshold functions.
 * The boundary is not a property of one file though: a "your phosphorus is
 * high" string in the view layer crosses it just as surely as a function that
 * computes the comparison. This checks the words that would only ever appear
 * in user-facing copy that judges an intake.
 */
test('no user-facing copy tells the user their intake is too high or too low', function () {
  var VERDICTS = [
    /\btoo (?:high|low|much|many)\b/i,
    /\byour (?:phosphorus|potassium|sodium) is (?:high|low)\b/i,
    /\b(?:over|under) your (?:limit|target|goal)\b/i,
    /\byou should (?:eat|avoid|limit|cut)\b/i,
    /\b(?:exceeds?|exceeded) (?:your|the) \w*\s*(?:limit|target|allowance)\b/i
  ];
  /*
   * Two exemptions, both necessary rather than convenient.
   *
   * Comments: the source has to be able to explain the boundary. app.js opens by
   * documenting that badges describe the compound and "never the user's intake
   * ('you have had too much')" — quoting the forbidden phrasing is how the rule
   * is written down.
   *
   * Negations: the on-screen disclaimer says the app "will never tell you your
   * limit, warn you that you have had too much". A check that fires on its own
   * disclaimer is a check nobody keeps. Every one of those three is what this
   * lint scored against the codebase on its first run, and a lint with no
   * precision is one that gets muted rather than obeyed.
   */
  var NEGATED = /\b(?:never|not|no|won't|will not|does not|doesn't|cannot|can't|without)\b/i;
  var isComment = function (l) {
    return /^\s*(?:\/\/|\/?\*|<!--)/.test(l);
  };

  var hits = [];
  ['index.html', 'js/app.js', 'js/log.js', 'js/scanner.js', 'js/additives.js']
    .forEach(function (rel) {
      var p = path.join(ROOT, rel);
      if (!fs.existsSync(p)) return;
      var lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach(function (line, i) {
        if (isComment(line)) return;
        VERDICTS.forEach(function (re) {
          if (!re.test(line)) return;
          /* Look at the neighbouring line too — the disclaimer wraps mid-clause. */
          var context = (lines[i - 1] || '') + ' ' + line + ' ' + (lines[i + 1] || '');
          if (NEGATED.test(context)) return;
          hits.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
        });
      });
    });
  assert(hits.length === 0,
    'this app describes what the data says and never judges an intake — ' +
    'that boundary is what keeps it out of medical-device territory:\n  ' +
    hits.join('\n  '));
});

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

console.log('\n  ' + passed + ' passed' +
  (failed.length ? ', ' + failed.length + ' FAILED' : ''));
failed.forEach(function (f) {
  console.log('\n  x ' + f.name + '\n      ' + f.message);
});
if (failed.length) process.exit(1);
