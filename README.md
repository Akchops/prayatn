# Prayatn

The website for Prayatn, a registered Public Charitable Trust in Kalkaji, New
Delhi, working since 1992. Concept: **The Durrie**. The signature moment is
**The Weave**: the hero photograph is woven from its own threads as you scroll.

## Run it

```bash
npm install
npm run build      # rug + responsive images + static site into dist/
npm run preview    # http://localhost:4173
npm run budget     # first-load gate (100 kB gzip)
```

## See it with every animation running

**Online preview (recommended).** `.github/workflows/preview.yml` builds a
pre-launch copy (noindex, with a "Pre-launch preview" bar) on every push. To
publish it, switch on GitHub Pages once: repository **Settings → Pages →
Build and deployment → Source: GitHub Actions**. The preview then appears at
`https://<owner>.github.io/prayatn/`. GitHub Pages on a private repository
needs a paid plan.

**On your computer.** `npm install && npm run build && npm run preview`, then
open http://localhost:4173.

**Single files.** `npm run preview-files` writes self-contained copies of every
page into `preview/`. Open them in Chrome, Safari or Firefox. Some in-app file
viewers block scripts; there you will only see the still version.

`dist/` is a plain static site and can be served by any host. Point 404s at `/404.html`.

## Where things are

| | |
|---|---|
| `docs/VERIFIED-FACTS.md` | every fact on the site and its status, plus the **launch blockers** |
| `docs/ASSET-MANIFEST.md` | every photo, who is in it, and its consent status |
| `docs/QA-REPORT.md` | QA verdict, punch list, page weight, evidence in `docs/qa/` |
| `docs/CONCEPTS.md` | the three Phase 2 concepts |
| `src/data/site.json` | contact details, cheque and 80G lines, **bank details slot** |
| `src/data/photos.json` | which photos are used, alt text, crops |
| `uploads/` | the owner's photos (the only image source) |
| `src/weave/` | The Weave: probe, WebGL tier, Canvas 2D tier, scroll layer |
| `src/ui.js`, `src/motion.js` | gallery filter, lightbox, map, project previews; reveals and the photo strip |
| pages | `/`, `/about/`, `/healthcare/`, `/education/`, `/women-development/`, `/gallery/`, `/get-involved/`, `/404.html` |

## Adding the partners

Put each confirmed partner in `src/data/partners.json`:

```json
"partners": [ { "name": "…", "what": "optional line, e.g. what they support", "url": "optional", "logo": "optional-file.png" } ]
```

Logos go in `public/partners/`. While the list is empty the section does not
appear. Once filled it shows on the home page (above "Three ways in") and on About.

## Page openings

The first time a visitor opens About, Healthcare, Education, Women development,
Get involved or the Gallery in a visit, the header photo is built full-screen
out of tiles, each page in its own way (`src/opening.js`), and then flies into
the header. A tap, a key or a scroll skips it. It does not play with reduced
motion, without JavaScript, or again on the same page in the same visit. To
see it again, add `?opening` to the address, e.g. `/healthcare/?opening`.

## If something doesn't animate on a phone

Open the page with `?debug` on the end, for example
`https://akchops.github.io/prayatn/gallery/?debug`, wait five seconds, and
screenshot the black box at the bottom. It shows which version of each
animation is running and why the gallery didn't start, if it didn't.

## Adding the bank details

Fill in `bank` in `src/data/site.json`:

```json
"bank": { "accountName": "…", "accountNumber": "…", "ifsc": "…", "bank": "…", "branch": "…" }
```

Then run `npm run build`. The donate sections on the home page and on
Get involved switch from "call or email us for bank details" to the details,
each with a Copy button.

Also in `site.json`, all hidden until filled:

- `bankQr`: a QR image **issued by the bank for this account**, put in `public/` (e.g. `"bank-qr.png"`). There is no UPI, so this is only for a bank-issued code.
- `eightyG`: `{ "number": "…", "validity": "…" }` shows the 80G registration under the tax line.
- `receiptLine`: the sentence about receipts in step 3.
