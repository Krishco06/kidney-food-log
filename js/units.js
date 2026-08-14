/*
 * units.js — unit conversion and display formatting
 *
 * Unit confusion in renal nutrition is a patient-safety issue, not a nicety.
 * Potassium is quoted in mg, mmol AND mEq depending on who is speaking; labs
 * come back in mg/dL in the US and mmol/L elsewhere; sodium is quoted as
 * sodium (mg) but discussed as salt (g). We convert explicitly and always
 * print the unit next to the number.
 */

(function (root) {
  'use strict';

  /* Atomic / molar weights */
  var MW = {
    potassium: 39.0983,   // K
    phosphorus: 30.9738,  // P
    sodium: 22.9898       // Na
  };

  var SALT_TO_SODIUM = 0.3934; // 1 g table salt (NaCl) ~= 393.4 mg sodium
  var ML_PER_FL_OZ = 29.5735;
  var ML_PER_CUP = 236.588;
  var G_PER_OZ = 28.3495;

  /* Potassium and sodium are monovalent, so 1 mmol = 1 mEq for both.
   * Phosphorus has no meaningful mEq at physiological pH — phosphate carries a
   * mixed charge — so we deliberately do NOT offer mEq for phosphorus. */
  function mgToMmol(mg, mineral) { return mg / MW[mineral]; }
  function mmolToMg(mmol, mineral) { return mmol * MW[mineral]; }
  function mgToMeq(mg, mineral) {
    if (mineral === 'phosphorus') return null; // not a valid conversion
    return mg / MW[mineral];
  }
  function saltGToSodiumMg(g) { return g * SALT_TO_SODIUM * 1000; }
  function sodiumMgToSaltG(mg) { return mg / 1000 / SALT_TO_SODIUM; }
  function flOzToMl(oz) { return oz * ML_PER_FL_OZ; }
  function mlToFlOz(ml) { return ml / ML_PER_FL_OZ; }
  function cupsToMl(c) { return c * ML_PER_CUP; }
  function ozToG(oz) { return oz * G_PER_OZ; }

  /*
   * Rounding rules. We round to a precision the underlying data can actually
   * support — food composition values are themselves +/- a good deal — so we
   * never print a decimal on a milligram figure.
   */
  function round(n, dp) {
    var f = Math.pow(10, dp || 0);
    return Math.round(n * f) / f;
  }

  /**
   * Format a nutrient amount with its unit.
   * @param {number|null} mg
   * @param {string} mineral  'potassium' | 'phosphorus' | 'sodium'
   * @param {string} unit     'mg' | 'mmol' | 'mEq'
   */
  function format(mg, mineral, unit) {
    if (mg === null || mg === undefined || isNaN(mg)) return '—';
    switch (unit) {
      case 'mmol':
        return round(mgToMmol(mg, mineral), 1) + ' mmol';
      case 'mEq': {
        var v = mgToMeq(mg, mineral);
        return v === null ? round(mg) + ' mg' : round(v, 1) + ' mEq';
      }
      default:
        return round(mg) + ' mg';
    }
  }

  function formatFluid(ml, unit) {
    if (ml === null || ml === undefined || isNaN(ml)) return '—';
    return unit === 'oz' ? round(mlToFlOz(ml), 1) + ' fl oz' : round(ml) + ' mL';
  }

  function formatEnergy(kcal) {
    if (kcal === null || kcal === undefined || isNaN(kcal)) return '—';
    return round(kcal) + ' cal';
  }

  function formatProtein(g) {
    if (g === null || g === undefined || isNaN(g)) return '—';
    return round(g, 1) + ' g';
  }

  var api = {
    MW: MW,
    mgToMmol: mgToMmol,
    mmolToMg: mmolToMg,
    mgToMeq: mgToMeq,
    saltGToSodiumMg: saltGToSodiumMg,
    sodiumMgToSaltG: sodiumMgToSaltG,
    flOzToMl: flOzToMl,
    mlToFlOz: mlToFlOz,
    cupsToMl: cupsToMl,
    ozToG: ozToG,
    round: round,
    format: format,
    formatFluid: formatFluid,
    formatEnergy: formatEnergy,
    formatProtein: formatProtein
  };

  root.RenalUnits = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
