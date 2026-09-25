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
| `src/ui.js`, `src/motion.js` | gallery filter, lightbox, map; photo reveals, timeline thread, partner cards, reading thread |
| `src/opening.js` | the full-screen opening on each inner page |
| `src/bandfx.js` | the brushable woven header (WebGL) on each inner page |
| `src/story.js` | the pinned photo story on the programme pages, with each page's own transition |
| `src/about.js` | About: project photos that follow the mouse, the mission, the loom, the trustee ring |
| `src/loom/` | the Gallery's draggable tapestry |
| pages | `/`, `/about/`, `/healthcare/`, `/education/`, `/women-development/`, `/gallery/`, `/get-involved/`, `/404.html` |

## Adding the partners

Put each confirmed partner in `src/data/partners.json`:

```json
"partners": [ { "name": "…", "what": "optional line, e.g. what they support", "url": "optional", "logo": "optional-file.png" } ]
```

Logos go in `public/partners/`. While the list is empty the section does not
appear. Once filled it shows on the home page (above "Three ways in") and on About.

## Page openings

Each time a visitor opens About, Healthcare, Education, Women development,
Get involved or the Gallery, the header photo is built full-screen
out of tiles, each page in its own way (`src/opening.js`), and then flies into
the header. A tap, a key or a scroll skips it. It does not play with reduced
motion or without JavaScript.

## Switchable features

Three features can each be switched off on their own, in `src/data/site.json`
under `features`, then `npm run build`:

| Switch | What it is | Where it lives |
|---|---|---|
| `pageWeave` | threads close over the page when you follow a link, and pull apart on the next | `src/features/page-weave.*` |
| `whereMap` | the woven map of where we work, on About (off: the plain list of areas) | `src/features/where-map.*`, `whereMap()` in `vite.config.js` |
| `giftSlider` | "what your gift can do" beside the donate steps | `src/features/gift.*`, `giftBlock()` in `vite.config.js` |

Each was also added in its own commit, so `git revert <commit>` removes one
completely without touching the others.

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
