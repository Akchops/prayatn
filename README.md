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

To check the site without a server, run `npm run preview-files` after the
build. It writes single-file copies of the three pages into `preview/`. Each
opens straight from disk and is marked "Pre-launch preview".

`dist/` is a plain static site and can be served by any host. Point 404s at `/404.html`.

## Where things are

| | |
|---|---|
| `docs/VERIFIED-FACTS.md` | every fact on the site and its status, plus the **launch blockers** |
| `docs/ASSET-MANIFEST.md` | every photo, with a consent checkbox per photo |
| `docs/QA-REPORT.md` | QA verdict, punch list, page weight, evidence in `docs/qa/` |
| `docs/CONCEPTS.md` | the three Phase 2 concepts |
| `src/data/site.json` | contact details, cheque and 80G lines, **bank details slot** |
| `src/data/photos.json` | which photos are used, alt text, crops |
| `uploads/` | the owner's photos (the only image source) |
| `src/weave/` | The Weave: probe, WebGL tier, Canvas 2D tier, scroll layer |

## Adding the bank details

Fill in `bank` in `src/data/site.json`:

```json
"bank": { "accountName": "…", "accountNumber": "…", "ifsc": "…", "bank": "…", "branch": "…" }
```

Then run `npm run build`. The donate sections on the home page and on
Get involved switch from "call or email us for bank details" to the details.
