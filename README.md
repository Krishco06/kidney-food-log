# Kidney Food Log

A food log for people on dialysis. Static PWA — plain HTML/CSS/JS, no build step,
no backend, no accounts, no running costs. Runs from GitHub Pages or any static host.

**This is the v1 recommended by the feasibility briefing: a log-and-total wellness
tool whose hero feature is ingredient-level additive scanning, not nutrient
precision.**

---

## The problem it actually solves

Phosphorus is not a mandatory US Nutrition Facts nutrient. Potassium only became
mandatory with the 2016 rule (compliance 2020–21). The consequence, measured
against the USDA Branded Foods database (239,089 products; Picard et al.,
*J Renal Nutr* 2023 and *Semin Dial* 2024):

| Nutrient | Branded records that carry a value |
|---|---|
| Phosphorus | **1.45%** |
| Potassium | **5.7%** |

No app can fix that — the data does not exist to license. Every renal tracker on
the market handles it the same way: it treats a missing value as **zero** and
silently under-reports the day. That is the single most common complaint in their
reviews ("wildly inaccurate").

This app does two things differently.

**1. Unknown is never zero.** A missing nutrient is `null` all the way from the
API to the screen, where the daily total reads:

> **Phosphorus — at least 26 mg**
> From 1 of 4 items. 3 items have no phosphorus data, so the real amount is higher.

**2. It reads the ingredient list, which is always printed.** A live example from
the app: Kraft Singles White American (barcode `0021000615278`) has **no
phosphorus value in any database**, while its ingredient list yields four
phosphorus findings — calcium phosphate, sodium phosphate, milk protein
concentrate and modified food starch.

The standard clinical advice is "look for PHOS on the label." That misses the two
most common phosphate additives in the US food supply — **lecithin (32% of
products)** and **modified starches (10%)** — per Dunford & Calvo, *AJCN* 2025
(39,937 products, 56% containing a phosphate additive). The dictionary here is
built to catch those, plus the potassium salts that replace sodium in
"reduced-sodium" products (+44% potassium on average; Parpia et al., *JAND* 2018).

---

## Two axes, never merged

The dictionary rates each ingredient on two **independent** axes, because
collapsing them into one "severity" score misteaches the core fact:

- **Load** — how much of the mineral it plausibly contributes (`high`/`moderate`/`low`)
- **Absorption** — inorganic added phosphate (~90–100% absorbed) vs. organic,
  protein-bound phosphorus (~40–60%)

Milk protein concentrate is high-load but organic. Potassium sorbate is inorganic
but a trace. The UI shows both badges separately.

It also never converts findings to milligrams. Ingredient lists are ordered by
weight but not quantified, so any mg figure derived from one would be invented —
the exact false precision this app exists to reject.

---

## Data sources

| Use | Source | Why |
|---|---|---|
| Text search | USDA FoodData Central (Foundation, SR Legacy, FNDDS, Branded) | Analyzed datasets carry real P and K; Branded carries the `ingredients` string. CORS-clean. Public domain. |
| Barcode | Open Food Facts, falling back to USDA Branded `gtinUpc` | Largest barcode coverage and richest ingredient text. |

**Open Food Facts text search is not used, and cannot be.** All three OFF search
endpoints (`/cgi/search.pl`, `/api/v2/search`, `search.openfoodfacts.org`) return
no `Access-Control-Allow-Origin` header and are blocked from any browser origin —
verified live. Only the per-product/barcode endpoint sends CORS headers. Adding OFF
text search would require a proxy; see *Known gaps*.

### USDA API key

Works out of the box with the shared `DEMO_KEY`, but that key allows only about
**30 requests/hour across all users of it**, so it runs out constantly. A free
personal key from [api.data.gov](https://api.data.gov/signup/) takes a minute and
is pasted into **More → Food data source**. Stored in `localStorage`, never
transmitted anywhere but USDA.

---

## What this deliberately does NOT do

Not an oversight — a regulatory boundary. FDA's 2022 final CDS guidance removed
patient-facing decision support from the non-device carve-out (§520(o)(1)(E)), so
each of these is a step toward being a regulated medical device:

- ❌ No patient-specific numeric limits or targets
- ❌ No alerts or warnings when a total is "high"
- ❌ No food recommendations or substitutions
- ❌ No serum lab prediction

`test/log.test.js` contains a test that fails if any function named `limit`,
`target`, `threshold`, `alert`, `recommend`, `predict`, etc. is ever added to the
log module. Adding these features requires regulatory counsel first, not just code.

The app is positioned as **complementary to the facility renal dietitian** — CMS
Conditions for Coverage require one at every US dialysis facility. The CSV export
exists to hand them a structured week instead of a chairside recall. Unknowns
export as `?`, never as blank or `0`.

---

## Running it

```bash
python -m http.server 8741 -d renal-log
```

Then open <http://localhost:8741>. Already wired into `.claude/launch.json` as
`renal-log`.

## Barcode scanning

Camera scanning works on **every** browser, including Safari. Chrome and Android
WebView use the native `BarcodeDetector`; everywhere else falls back to the
bundled decoder in `js/barcode.js` — no library, no build step, ~500 lines.

Supports the four symbologies that appear on food packaging: **EAN-13, UPC-A,
EAN-8 and UPC-E**. UPC-A and UPC-E are normalised to 13-digit EAN-13, which is
what Open Food Facts indexes.

The design bias throughout is that **a wrong scan is far worse than a failed
one** — a failed scan costs a retry, a wrong scan silently logs the wrong food.
So on top of the check digit there are three structural filters:

- **Total-width consistency** — a real symbol is exactly 95 modules (EAN-13),
  67 (EAN-8) or 51 (UPC-E), so the module width implied by the whole symbol must
  agree with the one measured from the start guard.
- **Quiet zones** required on both sides.
- **Two agreeing reads** before the code is acted on, since a check digit still
  passes 1 misread in 10.

These were not theoretical. The first version decoded *random image noise* as
valid 12-digit UPC-E codes; the test suite caught it, and the width constraint is
what fixed it. `barcode.test.js` includes 200 random-noise frames plus regular
stripes, truncated symbols and corrupted guards, all of which must return `null`.

Binarization uses local min/max over blocks rather than a local mean. A local
*mean* threshold looks correct but degenerates inside a wide uniform bar — the
mean equals the pixel value there, so the middle of a thick bar splits into three
runs. That bug is fixed and the block approach also handles the lighting
gradients you get holding a phone over a curved package.

## Tests

```bash
node test/scanner.test.js && node test/log.test.js && node test/barcode.test.js
```

93 tests. The scanner and barcode suites are the highest-value ones — both test
*both directions*, because a miss and a false positive fail the user in different
ways. The barcode suite renders known codes and degrades them the way a phone
camera would (blur, sensor noise, lighting gradient, low contrast, missing quiet
zone, 180° rotation) and requires an exact round-trip.

## Layout

```
index.html              screens: Today / Add / Portion / Days / More
css/app.css             accessibility-first (19px base, AAA contrast, 44px targets)
js/additives.js         the curated dictionary — 38 entries, the core IP
js/scanner.js           matching engine: normalize, longest-match, generic suppression
js/barcode.js           EAN-13 / UPC-A / EAN-8 / UPC-E decoder + encoder
js/foods.js             USDA + OFF clients; "unknown is null" enforced here
js/log.js               storage, honest totals, CSV export, regulatory boundary
js/units.js             mg / mmol / mEq, salt↔sodium, mL↔fl oz
js/app.js               view controller
sw.js                   offline shell, stale-while-revalidate
test/                   93 tests
```

---

## Known gaps

1. **The decoder has not been tested against a real camera.** It is verified
   against synthetic frames with realistic degradation, and through the browser's
   own canvas/`getImageData` path, but camera capture is blocked in the dev
   environment. Real-world decode rate on a phone, at an angle, under fluorescent
   dialysis-unit lighting, is unmeasured. If it disappoints, vendoring ZXing
   remains the fallback — the decoder is behind a single call site
   (`RenalBarcode.decodeImageData`) and swapping it is a contained change.
2. **No restaurant data.** Nutritionix is the strongest source and costs ~$1,850/mo.
   Out of scope for a $0 v1.
3. **OFF text search needs a proxy** (a small Cloudflare Worker would do it, and
   would also let us cache USDA responses to sidestep the rate limit).
4. **Portion estimation is coarse.** Gram chips plus manual entry; no photo
   estimation, which the briefing flags as a major error source anyway.
5. **No caregiver/proxy accounts** yet, though the briefing calls for them.
6. **The dictionary needs a renal dietitian's review before any real user sees
   it.** It is built from the cited literature, but it has not been clinically
   validated, and its `load` ratings are reasoned estimates, not measurements.

## Disclaimer

Not a medical device. Does not provide medical advice. Food data is frequently
missing or wrong, which is the entire premise of the app. Nothing here has been
clinically validated or reviewed by a regulator.
