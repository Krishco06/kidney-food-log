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
| **Built-in library** | **USDA SR Legacy + FNDDS, bundled (`js/commonfoods.js`)** | **6,010 everyday foods that need no network, key or proxy. Every one has a lab-measured P *and* K.** |
| Text search | USDA FoodData Central (Foundation, SR Legacy, FNDDS, Branded) | Analyzed datasets carry real P and K; Branded carries the `ingredients` string. CORS-clean. Public domain. |
| Text search | Open Food Facts, **via the proxy Worker** | USDA Branded coverage of everyday supermarket products is patchy, and OFF carries far richer ingredient text. |
| Barcode | Open Food Facts, falling back to USDA Branded `gtinUpc` | Largest barcode coverage and richest ingredient text. |

**Open Food Facts text search cannot be called from a browser.** All three OFF
search endpoints (`/cgi/search.pl`, `/api/v2/search`, `search.openfoodfacts.org`)
return no `Access-Control-Allow-Origin` header — verified live. Only the
per-product/barcode endpoint sends CORS headers. It therefore runs through
`worker/`, and is simply unavailable if no proxy is configured (search degrades
to USDA-only rather than failing).

This is not a nice-to-have. Without it, packaged foods are findable only by
barcode — so the additive scanner, the app's whole reason to exist, is out of
reach for anyone who does not have the package in their hand.

### The built-in library

Search needs a network, a key and a working proxy. This audience includes people
on dialysis-unit wifi, on old phones, on metered data, three days a week for four
hours. A food log that cannot record a banana without a round trip is not usable —
and while the proxy was undeployed, searching a brand returned nothing at all,
which reads as a broken app rather than a missing connection.

So 6,010 everyday foods ship with the app. They appear **as you type**, with no
network call, and are browsable by category. Branded is not the source, because
it is label-derived: every entry here has a real measured phosphorus *and*
potassium value, which is exactly what 98.55% of branded records lack. Records
with an incomplete panel were dropped rather than shipped with gaps.

**Two USDA datasets, for two different jobs:**

| Dataset | Rows | What it is | Why both |
|---|---|---|---|
| **SR Legacy** | 1,143 | Laboratory-analysed whole foods | Bananas, chicken breast, cheddar — the ingredients |
| **FNDDS** | 1,050 | The "as consumed" survey database + packaged goods | Shepherd's pie, gyros, sushi, cereals, chips, condiments |

SR Legacy is an ingredient database. It has ground beef and flour but no
shepherd's pie, which is why three expansions in a row failed to find lasagna,
gyros, sushi, quiche, gumbo or pot pie — every one of those misses was the same
structural gap, not a pattern-writing mistake. FNDDS carries them, already
plainly named, with 100% complete nutrient panels, and its values are for the
dish **as eaten** — which is what someone logging dinner actually needs.

Where a dish exists in both, both ship, because they are not the same food:

| | Sodium |
|---|---|
| Beef noodle soup, **canned** (SR) | 653 mg |
| Beef noodle soup, **home recipe** (FNDDS) | 325 mg |

Search results show which dataset a number came from, so the difference is
visible rather than blended away.

The list deliberately spans the full potassium and phosphorus range — potatoes,
bananas, chocolate, processed cheese — rather than being skewed "kidney-friendly".
This is a logbook: a log you cannot record your actual dinner in is useless, and
what the user ate is not the app's judgment to make.

**Two caps keep a library this size usable on a phone**, both added because
growth broke something measurable:

- The browse list renders **60 rows** behind a "Show all" tap. A full render of
  every row builds thousands of DOM nodes; at 789 foods that already took a
  category switch from ~1 ms to ~40 ms on a desktop, and far worse on the
  phones this audience uses.
- Type-ahead renders **25 matches** and reports the true total. At 6,010 foods a
  short prefix matches dozens — "chic" hits 55 — and a wall of rows re-rendered
  on every keystroke is not scannable. The hint tells you to type one more
  letter, which is the right move anyway.

Search is the real way in; browsing is for orientation.

**The row format is compressed, which is what paid for the last expansion.**
At 1,411 foods the file hit 186 KB against a 200 KB limit — a limit that guards
cold-start *parse* cost, the thing an old phone actually pays. Measuring where
the bytes went found three kinds of pure repetition:

| Waste | Fix |
|---|---|
| 2,235 portion labels drawn from 503 distinct strings — `"cup"` alone 593 times | interned into `LABELS`, rows store an index |
| 11 category strings written out for every row | interned into `CATEGORIES` |
| 36% of rows repeated the display name as their USDA description | stored as `0`, falls back to the name |

That returned ~35 KB losslessly and dropped the cost to **102 bytes per food**.
A test decodes every row and asserts no portion label survives as a raw index,
because a decoding slip would silently mislabel every portion in the app.

**The library is loaded on demand, not at startup** — and that is what removed
the size ceiling rather than deferring it. It is the largest asset in the app,
and the Today screen, the one that opens on launch, never touches it. `app.js`
fetches it the first time the Add screen is opened, so cold start no longer
scales with the library at all; what its size costs is a delay on one
deliberate tap, and offline that is a service-worker cache read (~190 ms
measured, uncached). A test asserts `index.html` has no script tag for it and
that `sw.js` still precaches it, because re-adding the tag would silently put
the largest asset back on the launch path.

Regenerate with `tools/gen-common.js` against the two USDA bulk downloads (no
API key needed; needs `node --max-old-space-size=6144`, the SR JSON is 210 MB):

```bash
node --max-old-space-size=6144 tools/gen-common.js /path/to/sr_legacy.json /path/to/survey.json
```

Entries are matched by regex against the shortest matching USDA description,
which is fast but silently wrong sometimes — and **a wrong record under a
plausible name is the worst defect this file can carry**, because nobody can
eyeball 6,010 bindings. So the generator warns on three patterns, each modelled
on a real bug found by reading output rather than by anything crashing:

| Guard | The bug it was written for |
|---|---|
| **Name mismatch** — no significant word of the display name appears in the bound record | "Meatloaf" matched *"Meatballs, meatless"* |
| **Dry-vs-prepared** — name says cooked, record says dry/powder/unprepared | "Oatmeal, cooked" matched dry oats, "Lemonade" the powder (~5x and ~25x out) |
| **Raw-vs-cooked** — name and record disagree | different food, different values |

They only warn, since a false alarm is cheap and a silent mis-binding is not.
Genuine synonyms (ketchup/catsup, bok choy/pak-choi, kielbasa/Polish sausage)
are whitelisted individually after review. Tuning matters: `"dry heat"` is a
cooking method, and the first version flagged every baked fish in the list.

Every entry also ships its verbatim USDA description, shown in the portion
picker, so any number is checkable against the source. Foods with no
complete-panel record in SR Legacy were dropped rather than bound to something
approximate — that removed brownies, cheesecake, buttermilk, lima beans and a
dozen others.

**Adding foods, systematically.** Four rounds of hand-guessing dish names hit
its limit. FNDDS ships its own taxonomy (WWEIA food categories) and its own
convention for the generic average of a food — a description ending in `, NFS`
(Not Further Specified). `tools/mine-fndds.js` walks the taxonomy and takes the
most generic unused record from each dish category, which is exactly what a
built-in library wants: the average taco rather than one particular taco.

It is deliberately restricted to **dish-like categories**. An unrestricted
sweep immediately offered "Apple, raw" and "Banana, raw" beside the SR Legacy
apples and bananas already shipped — near-duplicate whole foods with slightly
different numbers, which is confusing rather than useful. SR owns ingredients;
FNDDS owns dishes, and the mapping table enforces that.

Its output still needs reading. Of 168 candidates, 41 were rejected: `Big Mac`
and `Spam sandwich` (trademarks), `Topping from cheese pizza` (a survey
artifact — the topping scraped off, not a food anyone logs), `Frozen dinner`
and `Barbecue meat` (averages too broad to mean anything), and three
near-identical bread variants of the same sandwich.

**Adding foods by hand.** Writing patterns blind wastes a round on ones that
match nothing (42 of them, once). `tools/suggest-foods.js` probes the dataset
first and emits ready-to-paste lines anchored to descriptions that are known to
exist with a full panel:

```bash
node --max-old-space-size=6144 tools/suggest-foods.js /path/to/sr_legacy.json
```

It skips fdcIds already in the library and filters out brand-shouted and
hyper-specific cuts. **Read its output before pasting** — the probe optimises
for "shortest description that matches", which is right most of the time and
occasionally absurd. Real suggestions it made that were rejected on review:

| Wanted | Probe suggested | |
|---|---|---|
| Tamari | *Tamarinds, raw* | a fruit |
| Sweet and sour chicken | *Salad dressing, sweet and sour* | a dressing |
| Nacho cheese sauce | *Snacks, tortilla chips, nacho cheese* | chips |
| Champagne | *GEROLSTEINER … sparkling mineral water* | water |
| Agave syrup | *Agave, raw (Southwest)* | the plant |
| Canned clams | *clam, canned, liquid* | clam juice |
| Nutritional yeast | *yeast, baker's, active dry* | a different yeast |
| Chicken chow mein | *Noodles, chinese, chow mein* | the noodles |

The probe also favours "with salt" preparations when both exist, because those
descriptions are shorter. Sodium is one of the five tracked nutrients, so greens
and beans are repointed at the unsalted record by hand.

### USDA API key and the proxy Worker

A static page has nowhere to hide a key: anything in the bundle is public, and
anything in this repo is scraped within days. But the shared `DEMO_KEY` allows
only about **30 requests/hour across every app on earth that uses it**, so search
is broken for most visitors. Those two facts are in direct conflict, and
`worker/` resolves them.

Requests resolve in this order:

| Order | Path | When | Rate |
|---|---|---|---|
| 1 | Direct to USDA with the user's own key | They saved one in **More → Food data source** | 1,000/hr, theirs alone |
| 2 | Via the proxy Worker | Default for everyone else | 1,000/hr shared, mostly served from cache |
| 3 | Direct with `DEMO_KEY` | Only if the Worker is unreachable | ~30/hr globally; expected to fail |

The Worker (`worker/src/index.js`) holds the key as a Cloudflare secret, so it
never reaches a browser. **Caching is the point, not an optimisation** — food
composition data is effectively immutable, so responses cache at the edge for 7
days. Without it a few hundred users would exhaust 1,000 req/hour and we would be
back to a broken search. Queries are lowercased, whitespace-collapsed and
`dataType`-sorted before becoming a cache key, so `"Banana Raw"` and
`" banana  raw "` share one entry.

It is deliberately **not** a general proxy: only `/usda/search` and `/off/search`,
only `GET`, only known origins, `pageSize` capped, and unknown `dataType` values
dropped rather than forwarded. An upstream 403 is reported as a 502 and its body
is never echoed, because a bad-key error from USDA can quote the key back.

**Retries and stale-on-error are load-bearing, not polish.** Measured against
the live OFF search endpoint: it returns its "Page temporarily unavailable" 503
about **half the time**, independent of the query. Over 10 real searches,
first-attempt success was 5/10 and 3 attempts got 10/10, averaging 1.70
attempts. Without retries, half of all packaged-food searches would fail.

Entries are retained for 30 days but considered *fresh* for 7 days (USDA) or 24
hours (OFF), tracked via our own `X-Fetched-At` rather than `Cache-Control`,
because an expired entry is evicted and cannot be served stale. When the
upstream is down and a retained copy exists, it is served with `X-Cache: STALE`
— week-old composition data beats an error message, since a banana's potassium
has not changed. A `200` carrying HTML (OFF's overload page, api.data.gov's
nginx error page) is treated as a failure rather than passed through, which is
what stops the user seeing `Unexpected token '<'`.

OFF text search uses the **US-scoped** host. Verified side by side: `world`
returns Spanish, Bulgarian and French deli meat for "turkey breast"; `us`
returns Hillshire Farm and Applegate. A result the user cannot buy is worse than
no result. Barcode lookup still uses the world database, since a scanned UPC is
unambiguous and coverage matters more there.

Deploying it (one time):

```bash
cd worker && npx wrangler login && npx wrangler deploy && npx wrangler secret put USDA_API_KEY
```

`secret put` prompts for the value interactively — the key is never written to a
file, a command line, or this repo. Then set `PROXY_BASE` in `js/foods.js` to the
deployed `*.workers.dev` URL. If `PROXY_BASE` is left empty the app still works,
falling straight through to step 3.

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
`renal-log`. Port 8741 is in the Worker's `ALLOWED_ORIGINS`, so proxied search
works locally too.

All tests:

```bash
npm test
```

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
npm test
```

160 tests across five suites (scanner 36, log 27, barcode 30, common foods 25, worker 42).

The scanner and barcode suites are the highest-value ones — both test *both
directions*, because a miss and a false positive fail the user in different
ways. The barcode suite renders known codes and degrades them the way a phone
camera would (blur, sensor noise, lighting gradient, low contrast, missing quiet
zone, 180° rotation) and requires an exact round-trip. It also feeds 200 frames
of random noise through and requires zero decodes: a failed scan costs a retry,
a *wrong* scan silently logs the wrong food.

The worker suite is weighted toward the two things carrying real risk — the API
key never appearing in any response body, header, or cache key, and query
normalisation actually collapsing equivalent searches into one cache entry.

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
js/commonfoods.js       GENERATED: 6,010 offline foods, SR Legacy + FNDDS (516 KB, 146 KB gzipped; descriptions split into commonfoods-desc.js)
                        loaded on demand, NOT at startup
test/                   160 tests (incl. worker/test)
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
3. ~~**OFF text search needs a proxy.**~~ Done — `worker/` proxies both OFF
   search and USDA, and caches each at the edge. Packaged foods are now findable
   by name, not only by barcode.
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
