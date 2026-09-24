# Handoff: WellVoy — preventive health journeys through India

## Overview
A marketing and booking site for international travellers. It sells one three-leg journey: **Diagnose** (preventive screening at JCI/NABH hospitals, base: Taj MG Road, Bengaluru), then **Restore** (Ayurveda at tulåh, Calicut, Kerala), then **Realign** (yoga at LaRiSa, Ashwem, Goa, or Havelock, Andaman). Guests only see what's included, where, for how long, and the price. WellVoy handles all logistics.

There are five views: Home (scroll narrative), Build Your Journey (configurator plus AI concierge), Signature Journey detail, How It Works, and Contact. A Care Advisor drawer (callback, WhatsApp, message) is reachable from every view.

## About the design files
`prototype/WellVoy.dc.html` is a **design reference built in HTML**. It is a working prototype of the intended look, copy and behaviour, not production code. Rebuild it in the stack below. Open it directly in a browser (keep `support.js` next to it). Hash routes: `#/home`, `#/build`, `#/package`, `#/how`, `#/contact`.

## Fidelity
**High-fidelity.** Colours, type, spacing, copy, motion timings and interactions are final. Recreate them exactly. Prices, doctors and testimonials are **sample content**.

---

## Recommended stack (optimised for "instant, relaxed, 60fps")

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro 5** + **React 19 islands** + TypeScript | Content pages ship almost no JS. Only the configurator, concierge, advisor drawer and scroll rail hydrate. |
| Content | **Astro Content Collections** loading `content/*.json`, validated with **Zod** | All data is external and typed. Bad data fails the build, not the UI. The same schema can later point at a headless CMS (Sanity or Storyblok) with no UI changes. |
| Shared state | **Nanostores** (`@nanostores/react`), persisted to `localStorage` + URL query | One `journey` store shared by the configurator, summary, concierge, package page and advisor prefill. Shareable URLs like `/build?d=advanced.bengaluru&r=14.garden&y=andaman.7.vinyasa`. |
| Pricing and itinerary | `reference/engine.ts`, a pure TS module with a leg-plugin registry | Runs identically on server and client. Unit-test with **Vitest**. |
| Page transitions | Astro **View Transitions** (cross-fade 250ms) | Native, GPU-cheap, respects reduced motion. |
| Motion | CSS transitions + one `IntersectionObserver` reveal utility. **No animation library required.** If one is needed, use `motion` (motion.dev) `animate()`, which is about 3kb. | Keeps the main thread free. |
| Images | `astro:assets` `<Image>` producing AVIF/WebP with `srcset`, `loading="lazy"`, and `fetchpriority="high"` on the hero poster only | Better LCP. |
| Video | **Mux** or **Cloudflare Stream** (HLS, auto-poster, adaptive bitrate). Self-host every partner file; do not hotlink. | The prototype hotlinks partner sites, which is slow and fragile. |
| Concierge AI | Astro server endpoint `/api/concierge` calling the **Claude API** (`claude-haiku-4-5`) | The API key stays on the server. The rules engine decides the journey; the model only writes the 2–3 sentence note. |
| Forms | Server actions to CRM (HubSpot/Zoho) + WhatsApp Business API; callback via Cal.com embed or API | |
| Hosting | Vercel or Cloudflare Pages (static + edge functions) | |
| Quality gates | Lighthouse CI (Perf ≥ 95, CLS < 0.05, LCP < 2.0s on 4G), axe accessibility, Vitest for the engine | |

### Suggested repo layout
```
src/
  content/            ← copy /content from this bundle; config.ts holds the Zod schemas
    legs/diagnose.json restore.json realign.json
    packages.json faqs.json concierge.json site.json media.json
  lib/journey/        ← engine.ts, types.ts, recommend.ts, url.ts (encode/decode config)
  stores/journey.ts   ← nanostore + persistence
  components/
    chrome/  Nav, MobileMenu, Footer, AdvisorFab, AdvisorDrawer
    home/    Hero, PromiseStrip, FeelingTiles, Chapter, TransferNote, TierMatrix, TreatmentGrid, DestinationCards, ManagedBand, PackageCards, CareTeam, Testimonials, Accreditations, FinalCta, ChapterRail
    build/   ConciergeLauncher, Step (generic accordion), TierPicker, CityChips, AddonList, DurationSegmented, RoomCards, DestinationPicker, PracticeList, LegToggle, Summary, MobileTotalBar
    concierge/ ConciergeSheet, Transcript, QuestionChips, Recommendation
    ui/      Button, Chip, Switch, Radio, Checkbox, Field, Media (image/video with poster + in-view play)
  pages/ index.astro build.astro journeys/[id].astro how-it-works.astro contact.astro api/concierge.ts
```

---

## Making it pluggable: how to extend without touching UI

All values live in `/content`. Components only render what the data provides.

- **New screening tier, add-on or city:** add an entry to `legs/diagnose.json`. The tier cards, matrix columns, city chips and add-on groups are all generated from it. Matrix rows come from `tests[].byTier`.
- **New Ayurveda duration or room:** add it to `legs/restore.json` `durations` / `rooms`.
- **New sea destination (e.g. Kovalam):** add it to `legs/realign.json` `destinations`, with `rateUSD`, `stay`, `airport`, `arriveFromRestoreHub`, and a `media` id.
- **New signature journey:** add an object to `packages.json`. It automatically appears in the home cards, "How would you like to feel" (if `feeling` is set), and `/journeys/[id]`.
- **New leg (e.g. "Retreat 4: Himalaya"):** add `legs/<id>.json` with a unique `order`, then register one `LegPlugin` in `engine.ts`. The configurator renders one `<Step>` per leg in `order`. The summary bar, legend and itinerary are leg-agnostic.
- **Concierge logic:** questions, budget bands and recommendation rules are data (`concierge.json` → `rules.patches`, evaluated in order, then `budgetFitSteps` until the total fits the band). Editors can tune them without a deploy (if moved to the CMS).
- **Transfers:** today they are strings on each leg. Next step: a `transfers.json` matrix `{ from, to, mode, duration, copy }` so any leg order works.
- **Currencies:** `site.json` → `currencies`. Prices are stored in USD and converted plus rounded to 10 at render time (`formatPrice`).
- **Media:** components reference media by **id** (`media.json`). Swap a file in one place. The registry also tracks rights status.

Keep the UI stable as data grows:
- Every list-driven component must handle 1–N items. Grids use `repeat(auto-fit, minmax(min(100%, X), 1fr))`.
- Tier cards wrap from 3 to N columns. The matrix scrolls horizontally inside its card when there are more than 4 tiers (`overflow-x:auto`, sticky first column).
- Long names clamp to 2 lines. Prices use `tabular-nums`.
- Add a Storybook story per component with min, typical and max data.

---

## Screens

### Global chrome
- **Nav**: fixed, 72px tall, max-width 1320, side padding `clamp(20px,4vw,48px)`. Over the home hero it is transparent with bone text. After 40px of scroll it becomes `rgba(245,241,234,.97)` with a 1px `rgba(29,33,30,.08)` bottom border, transitioning over 0.3s. Logo: "WellVoy" in Newsreader 26/400 plus "INDIA" mono 10px, 0.16em. Links in Instrument Sans 14; the active link has a 1px currentColor underline. Buttons: "Speak to an advisor" (outline pill, 13px, padding 10×18) and "Build your journey" (solid pill; bone on the hero, green elsewhere). **Below 1140px** the links and advisor button hide and a two-line hamburger (44×44) opens a full-screen green menu with 36px serif links.
- **Advisor FAB**: fixed bottom-right `clamp(16px,2.5vw,28px)`, bone pill, green 8px "online" dot, shadow `0 6px 24px rgba(21,42,33,.12)`, lifts 2px on hover. On `/build` below 1000px it sits above the mobile total bar (88px + safe area).
- **Advisor drawer**: right sheet `min(460px,100vw)`, slides in over 0.4s `cubic-bezier(.2,.7,.2,1)` (0s under reduced motion), backdrop `rgba(21,42,33,.35)`. Segmented tabs (Callback / WhatsApp / Message) on a sand track.
  - Callback: 7 next-day tiles, 5 slots (local time), phone. Validation: day and slot required; phone must have at least 7 digits.
  - WhatsApp: shows the prefilled text from the current journey and deep-links to `wa.me`.
  - Message: name (required), email (regex), message (required). Errors appear inline in `#9A3B2E` with the border turning the same colour.
- **Footer**: `#152A21`, 4 auto-fit columns.

### Home
1. **Hero**: min-height `max(100svh,640px)`, top padding 104px so content never sits under the nav. Background video (tulåh film) with the LaRiSa still as poster; parallax `translateY(scrollY*0.22)` only while in view, disabled under reduced motion. Bottom gradient to `rgba(21,42,33,.72)`. Eyebrow in mono 11 / 0.16em `#E7DDCC`. H1 "Know your body. Then restore it." in Newsreader 300 at `clamp(44px,min(8.4vw,13vh),120px)`, line-height 0.98, letter-spacing -0.02em, max 11ch. Paragraph max 520px. Two CTAs. A 3-column "01 Diagnose / 02 Restore / 03 Realign" row with a top rule.
2. **Promise strip**: sand `#EDE6DA`, four items with 5px gold dots.
3. **Chapter rail**: a fixed pill at top 84px, centred, visible only while the three chapters are in view. The active leg is filled green. A 2px gold progress bar (`scaleX` = scroll progress through the chapters) runs along the bottom. Clicking smooth-scrolls to that chapter.
4. **Intro statement**: serif 300 `clamp(28px,3.8vw,52px)`, max 22ch, plus three large-number stats.
5. **Feeling tiles** ("How would you like to feel when you fly home?"): three 3:4 media tiles (Certain / Rested / Renewed) linking to packages. They lift 4px on hover.
6. **Chapter 01 Diagnose**: 78vh media band with a bone title card, then two columns: copy with accreditation chips, and the **tier matrix** card (7 test rows × 3 tiers; ● included, — not, or a label; "From" row in currency).
7. **Transfer note**: 1px × 56px vertical rule plus a mono line.
8. **Chapter 02 Restore**: green section, 90vh video band, then a pull quote and a 6-item treatment grid (roman numerals, serif 26 titles).
9. **Chapter 03 Realign**: 90vh video band with bone text, two destination cards (4:3 media) that preselect the destination and open the configurator, then a 6-cell practice grid.
10. **Managed band**: `#152A21`, promise list.
11. **Signature journeys**: cards generated from `packages.json`, each with a leg-proportion bar.
12. **Care team**: 4 portraits (placeholders).
13. **Testimonials** (serif italic 24) and an accreditation row.
14. **Final CTA** card.

### Build Your Journey
- Concierge launcher banner (green).
- Two-column grid `minmax(0,1fr) 400px` at 1000px and above; the summary is `position:sticky; top:96px`. Below that it stacks, and a fixed bottom bar shows the total plus "View itinerary" (scrolls to the summary).
- **Progressive disclosure**: generic `<Step>` accordion, one per leg plus Add-ons. Steps past `maxStep` are locked at 45% opacity. Continue opens the next step. A collapsed step shows a one-line summary plus "Edit". Loading from the concierge or a package unlocks all steps.
- Leg `Switch` (40×24). At least one leg must remain on. Turning Diagnose off clears add-ons.
- The **summary** updates live: total (serif 40), day count, a proportional leg bar (flex-grow animates over 0.35s), price lines, "Logistics & coordinator: Included", and the day-by-day itinerary with leg-coloured dots.
- A "Reserve" button opens the advisor drawer with the message prefilled.

### Concierge (full-screen sheet)
- Sticky header with avatar, "Question n of 6" and a gold progress line (width transition 0.4s).
- Answered questions stay above as a transcript (question in serif 22 grey, answer as a sand pill on the right, plus "Edit").
- The current question is serif `clamp(28px,4vw,40px)`. Chips are 46px tall. Single-select auto-advances after 260ms (0ms under reduced motion). Multi-select needs Continue; goals must have at least one pick. The concerns step has an optional textarea.
- Result: the AI note (fallback string if the call fails or times out after 12s), a recommendation card (title, price, days, leg bar, reasons), and actions: Open in configurator / Discuss with an advisor / Start again. Disclaimer: "A suggestion, not medical advice."

### Signature Journey detail (`/journeys/[id]`)
- 72vh video hero with package tabs, a 4-cell facts strip (Duration, Route, Screening, Per person), the line in serif 30, inclusions per leg, a day-by-day card with price breakdown, and CTAs: Customise (loads config into the store and goes to `/build`) and Speak to an advisor.

### How It Works
- Five numbered steps as rows, plus an FAQ accordion (one open at a time; "+" rotates 45° over 0.25s).

### Contact
- A channel list (WhatsApp link, callback opens the drawer, email) and the inline message form, which shares state with the drawer form.

---

## Interactions and motion
- **Reveal**: elements marked for reveal start at `opacity 0, translate3d(0,18px,0)` and transition over 0.7s `cubic-bezier(.2,.7,.2,1)` on intersection (rootMargin `0 0 -8% 0`). Each element reveals once.
- **Video**: autoplay only while in view (IO rootMargin 200px) and pause when out. Frame-only card videos use `preload="none"` and load when within 400px. The hero preloads `auto` and has a poster. Under `prefers-reduced-motion` nothing autoplays and posters show.
- **Hover**: cards lift 3–4px (0.25–0.35s); pills change background (0.2s). There are no scale bounces or shadows beyond the FAB.
- **Scroll**: one passive listener throttled with rAF. It writes transforms directly to refs and only calls setState when the nav's scrolled state, the active leg or the in-journey flag actually changes.
- Everything animates only `transform` and `opacity` (plus colour for small pills).

## State (single journey store)
```
journey: JourneyConfig          // see reference/types.ts; null leg = excluded
ui: { openStep, maxStep }
concierge: { step, answers, freeText, phase: 'ask'|'thinking'|'done', recommendation, note }
advisor: { open, tab, form, errors, sent, callback{day,slot,phone}, callbackSent }
prefs: { currency }
```
Derived: `plan = planJourney(journey, content)`. Do not store it; memoise it.

## Design tokens
**Colour**
- bone `#F5F1EA` (page) · paper `#FBF9F5` (cards) · sand `#EDE6DA` · sand-2 `#E7DDCC` · sand-3 `#D6C8B0`
- ink `#1D211E` · ink-2 `#3F433E` · muted `#5F625C` · faint `#B5B1A8`
- green `#1E3A2E` · green-deep `#152A21` · gold `#A6864A` · gold-text `#8A6D36` · gold-light `#C9B68E`
- leg colours: diagnose `#8FA39A`, restore `#1E3A2E`, realign `#A6864A`
- error `#9A3B2E` · online `#4E8A63`
- lines `rgba(29,33,30,.07 / .10 / .14 / .18 / .25)`

**Type**
- Newsreader (300/400; italic 300): display and headings.
- Instrument Sans (400/500/600): UI and body.
- JetBrains Mono 400: eyebrows and labels, 10–11px, uppercase, 0.12–0.16em letter-spacing.
- Scale:
  - H1: `clamp(44px, min(8.4vw,13vh), 120px)`/0.98
  - Chapter H2: `clamp(40px,6.4vw,92px)`/1
  - Section H2: `clamp(34px,4.6vw,60px)`/1.04
  - Card titles: serif 22–32
  - Body: 15–18/1.6
  - Small: 12–14

**Radius**: 4px (media), 6px (cards), 999px (pills and chips). **Shadow**: only the FAB, `0 6px 24px rgba(21,42,33,.12)`. **Container**: 1320 max, padding `clamp(20px,4vw,48px)`. **Section rhythm**: `clamp(80px,11vw,150px)` vertical. **Hit targets**: at least 44px.

## Assets
See `content/media.json`. Partner video and imagery is mirrored locally under `/media` (`media/video/*.mp4|webm`, `media/image/*.avif`) so the prototype and any local dev server load instantly without reaching partner domains. `media.json` `src` fields point at these local, root-relative paths (`/media/video/tulah-film.mp4`, etc.), and the prototype HTML references them the same way.

**Rights on every mirrored file are still PENDING.** The local copies exist only to make development and design review fast — obtain written permission from tulåh, IHCL/Taj and LaRiSa before any of this ships to production. Once permission is granted, replace the local files with the licensed masters and move hosting to Mux/Cloudflare Stream as described in the recommended stack above; `media.json`'s `rights` field on each entry tracks this status.

Still missing entirely: Andaman imagery, real clinician portraits (with consent), partner hospital photography, and a tulåh still for the hero poster (it currently uses a LaRiSa image).

## Files in this bundle
- `prototype/WellVoy.dc.html` + `prototype/support.js`: the interactive design reference.
- `content/*.json`: all pluggable data extracted from the prototype.
- `reference/engine.ts`, `reference/types.ts`: journey engine and content types to port directly.
- `media/video/*.mp4|webm`, `media/image/*.avif`: local mirrors of the partner video and imagery referenced by `content/media.json`, so the prototype and any local dev server load without reaching partner domains. Rights are PENDING — see Assets above.
