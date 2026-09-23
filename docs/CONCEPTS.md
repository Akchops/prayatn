# Phase 2: Creative direction

The concepts are built on what the 86 uploaded photos actually show:
- women sitting in circles on patterned durries (Women Development, Mahila Panchayat, legal awareness)
- children holding up yellow health cards in the School Health Clinic
- nurses measuring height and weight in Swaasthya Kendra
- blackboards with dates written in chalk
- event banners

The photos are honest phone photography, mostly 650–1280px. No single photo can
hold a 1920px full-bleed hero at full sharpness. Each concept is designed so the
photos carry emotional weight without being blown up past their resolution.

---

## Concept 1: The Durrie (recommended)

**Idea.** Prayatn is many hands weaving one floor that a whole neighbourhood can
sit on together.

**Why this comes from the work.** In nearly every women's-programme photo, the
meeting happens on the floor, on a patterned cotton durrie, in a circle with no
head of the table. Prayatn was founded by several people, not one. Weaving
carries both facts without a line of copy.

**Palette**

| Name | HEX | Role |
|---|---|---|
| Khadi | `#F3ECDF` | page ground (warm unbleached cotton) |
| Indigo ink | `#1E2440` | text, dark bands |
| Marigold | `#E2A019` | the three actions (donate / volunteer / contact); indigo text on it |
| Rani | `#C22F66` | accent threads; women's programme |
| Neem | `#1D6E62` | links, health programme |

**Type.** Bricolage Grotesque for display (OFL, variable, humanist and slightly
irregular, so it reads as hand-made rather than corporate). Hind for body text
(OFL, highly legible on low-DPI Android, and it has Devanagari, so Hindi can be
added later without changing fonts). Both are self-hosted, subset woff2 files.

**Mood.** Floor-level in a Kalkaji meeting room at eleven in the morning: a tube
light and a turning ceiling fan, saturated cotton on a patterned rug, a register
open on someone's knee. The page feels like cloth. It is warm and busy in the
way a good meeting is busy. Photos sit inside woven borders the way prints get
pinned to a wall, never stretched edge to edge.

**Signature moment: "The Weave".** The first screen is loose coloured threads.
Their colours are sampled from a real photo of a Mahila Panchayat circle. As the
visitor scrolls, weft passes through warp, the threads close up, and the
photograph assembles thread by thread until the women leading their own meeting
are plainly visible. The woven edge then peels away to become the border that
frames the next section (Swaasthya Kendra), so the weave runs down the page as
the thread connecting the three programmes. On the pass list it is the
**immersive-motion-qa pass condition 2: an object assembling under scroll**.
At 320px the phone sees the same assembly, full-screen.

**Real-time vs pre-rendered: real-time, raw WebGL (a few kB, no three.js).**
The effect is flat 2D, one texture and one fragment shader, which is trivially
60fps on a mid-range Android. Pre-rendering would ship 1–2 MB of frames over
mobile data to reproduce something a shader draws exactly, and it would need
re-encoding for every aspect ratio. The fallbacks:
- Canvas 2D draws the same assembly from a 64px sample of the photo.
- The photo itself sits in the HTML beneath for no-JS, no-WebGL and reduced-motion visitors.

**Dignity.** The picture that assembles shows adults running their own meeting.
Nobody is being helped in it.

---

## Concept 2: The Health Card

**Idea.** Every child is a whole person on a yellow card, not a number in a report.

**From the work.** Children proudly holding up yellow health cards. Nurses
measuring height, weight, eyes and teeth in the School Health Clinic.

**Palette.** Card yellow `#F1C232` · Uniform slate `#4E5D73` · Clinic white
`#F6F4F8` · Register ink `#1C1F26` · Signboard red `#C8372D`.

**Type.** Archivo (variable width) for display. IBM Plex Sans and Plex Mono for
form fields and dates.

**Mood.** Official paperwork made warm: ruled lines, rubber-stamped dates, the
red clinic signboard, bright and orderly.

**Signature: "Fill the card".** In a pinned sequence a yellow card fills in field
by field: Height, then Weight, then Eyes, then Teeth. As each field fills, it
opens full-screen into the photo of that check happening, then folds back into
the card. The finished card becomes the school section. This is
**pass condition 5: a full-screen morph between sections**.

**Real-time (DOM with GSAP clip-path), with nothing pre-rendered.** The source is
still photographs, so there is nothing to render offline.

**Risks.**
- It centres children heavily.
- It covers health well but leaves little room for women's and legal work.
- A form with empty fields invites numbers we do not have and must not invent.

---

## Concept 3: The Blackboard

**Idea.** Written by hand, every day, since 1992.

**From the work.** Chalk on real boards: "Health check-ups 2.9.25",
"23 March Certificate Distribution", "Happy Republic Day", a Hindi punctuation lesson.

**Palette.** Board `#1F2A24` · Chalk `#ECE9E1` · Chalk yellow `#E6C75A` ·
Brick `#A4432F` · Wall violet `#5B3F74`.

**Type.** Fraunces for display, Kalam for chalk notes only, Inter for body.

**Mood.** Dusty classroom light, photos pinned to a board, dates chalked beside them.

**Signature: "Wipe the board".** A finger or cursor wipes chalk dust off the
board to uncover the photos underneath, and the dust slowly settles back. This
is **pass condition 3: shader-based pointer interaction**.

**Real-time WebGL, because it has to be.** It answers the pointer, so it cannot
be pre-rendered.

**Risks.**
- A dark green board with a big outlined year is too close to the old site,
  and the brief says not to reuse it.
- On phones, wiping competes with scrolling.
- Wipe-to-reveal is a toy gesture.

---

## Recommendation: Concept 1, The Durrie

- It is the only concept that holds all three programmes and the
  community-first audience in one image.
- It expresses "founded by many" without inventing a story.
- It is the lightest on mobile data.
- The signature is the same at 320px as on a desktop.

## Site structure under the recommendation (kept small)

1. **Home**, one continuous scroll:
   - The Weave
   - a strip that says what the visitor can come to Prayatn for, with the phone number (communities first)
   - three programmes on a woven thread: health, school, women
   - since 1992
   - three equal actions: Donate, Volunteer, Contact
2. **About**: mission, approach, history, the seven trustees, credits.
3. **Get involved**: bank details (once supplied) and the cheque line, then
   volunteer and contact by phone and email. The 80G line appears in grey,
   verbatim, under the donate details.

Tech: static HTML built by Vite. All content is in the HTML, readable with JS
off. A small entry script loads the raw WebGL weave and GSAP lazily. There is no
three.js, because nothing on the page needs a 3D scene.
