# Lecture walkthrough host

Research for `lecture-walkthrough-host` (#50). Owner: punyzxc (captain). Date: 2026-11-24.

**Question.** Which in-scene step player, step format and presenter mode let a teacher run each lecture and open its experiment with preset parameters?

**Answer.** A "Lectures" drawer in the scene header, a step player that opens in the same dock as the stations, one JSON script per lecture, and a presenter mode that hides the scene chrome. All of it is built in the spike `spikes/visual-foundation` on top of the scene host (#37, PR #49, merged into this branch). The URL hash holds the lecture, the step and the presenter flag.

## Sources

- **Fact.** The request and acceptance criteria: issue #50 (owner request, 2026-11-24).
- **Fact.** The host, its routes, `stationHash` and the kernel contract: `docs/research/scene-module-host.md` and `spikes/visual-foundation/src/stations/*` (PR #49).
- **Fact.** Lecture sections, stations and the people the lectures name: `docs/research/lecture-module-map.md` (#36, PR #48).
- **Fact.** The lecture PDFs (Russian, held by the owner, never committed: the repository is public). The scientist roster was checked against their extracted text: a person is listed for a lecture when the lecture names them. The draft scripts come from the lecture map; the script tasks #51–#53 check them against the PDFs.

## What was built

| Acceptance criterion | Where | Evidence |
| --- | --- | --- |
| "Lectures" in the header opens a quiet drawer with 12 lectures. The document never scrolls. | `LabHeader` link `#lectures`; `LectureList` in `src/lectures/player.tsx`, shown in an end-side `SceneDock`. | `tests/lectures.spec.mjs`, the first test |
| A script per lecture opens as steps: one idea, a formula as text, an optional example. Arrows and buttons move, and the hash is `#lecture/<n>/<step>`. | `lectures/L01.json` … `L12.json`; `LecturePlayer`; route grammar in `src/stations/route.ts`. Formulas are Unicode lines in local math fonts (`Cambria Math`, `STIX Two Math`, then the bundled mono font). No network fonts. | Tests 2 and 7. Test 7 opens all 12 lectures and records no external requests. |
| "Open experiment" opens the station with the step's seed and parameters. "Back to lecture" returns to the same step. | `stationHash(id, seed, params, from)` adds `lecture=<n>&step=<k>[&present=1]`. The station dock shows "← Back to lecture n, step k". Esc and the close button also return to the step. Kernel reruns keep the way back. | Tests 3 and 4 |
| Presenter mode: large type, reduced chrome, the step counter and keys visible. | `P`, or the "Presenter" button, toggles `?present=1`. The dock fills the viewport, and the orbit switcher, header tools, globe and station cards are hidden. Body text is `clamp(20px, 2vw, 30px)`, and teacher `notes` show only here. PageUp/PageDown work, so a presentation clicker drives the steps. | Test 5: font ≥ 20 px, chrome hidden, counter and keys visible, no scroll, state kept through a station round trip |
| `public/portraits/<slug>.txt` renders in a fixed slot. A missing file shows a placeholder with the name, years and contribution. | `Portrait` fetches the file and fits it with `fitPortrait` to 40 columns × 20 lines. An empty file, a 404 or the dev server's HTML fallback each show the placeholder (initials, file name, name, years, one line). | Test 6 and the node test for `fitPortrait` |
| A roster entry for every scientist the lectures name, and a README on where to put the art. | `lectures/scientists.json` (25 people), `public/portraits/<slug>.txt` (one empty slot file each), `public/portraits/README.md`. | `tests/lectures.test.mjs`: each name in a script is in the roster, the roster entry lists that lecture, and each slug has a slot file |

## Lecture-step presets on legacy stations

**Fact (found in the code).** The six prototype stations read only `?seed` from the hash and took sample size, scale and distribution from `localStorage` (the last run). A lecture link could not set them.

**Fix.** `legacySettings` in `src/main.tsx` reads `n`, `scale` and `dist` (0 normal, 1 uniform, 2 exponential) from the hash and clamps them to the station sliders (64 … 2048 in steps of 64, 0.5 … 2.5 in steps of 0.05). When the hash pins any of them, the station ignores the stored last result. Test 3 checks that `#station/distribution?seed=506&dist=2&n=1024` opens with Exponential, seed 506 and n = 1024.

## Script format (for #51–#53)

The contract for the script tasks is `spikes/visual-foundation/lectures/README.md`. The validator is `src/lectures/script.ts` (`validateLecture`, `validateRoster`), and `npm test` runs it on every file.

- One file per lecture. JSON, because the program reads it without a parser and every reference (station id, scientist slug, seed range, numeric params) is checked by a test.
- One idea per step, formulas as plain Unicode lines, an optional example and optional teacher notes.
- `experiment: { station, seed?, params?, label? }`. Parameters are numbers only, because the hash and the kernel contract carry numbers only.
- `status: "draft"` until a script task checks the lecture against its PDF. The drawer marks drafts.

The 12 files on this branch are **drafts**. They are written from the lecture map so that every lecture opens and the player can be tested. The steps link to stations whose kernels (#38–#47) mostly have not landed yet, and those stations show the "kernel in progress" panel. Kernel parameter keys are left out until each kernel declares them.

## Limits and open points

- **Language.** The interface and the draft scripts are in English, while the lectures are in Russian. The lesson language is still open in `docs/decisions.md`. The format does not depend on it.
- **Roster.** The 25 names are every person the 12 lectures name (Pascal, Fermat, Newton, Gauss, Glivenko and Snedecor were missing from the lecture map). A name the lectures spell differently could slip through a text search; #51–#53 add anyone their scripts name: one roster entry and one empty `.txt` each.
- **Formula rendering.** Unicode text is enough for the formulas in the lecture map. Fractions and integrals with limits read as linear text. If the owner wants typeset math later, MathML Core renders natively in Chromium and Firefox with system fonts. It would be one optional `mathml` field per step, with no change to the player.
- **Portrait slot.** The slot is 40 × 20 characters at 7 px (10 px in presenter mode). The owner may change `PORTRAIT` in `script.ts`, and the README states the same numbers.
- **Reserved names.** `lecture`, `step` and `present` in a station hash are the way back to a lecture, so no kernel may declare a parameter with those keys. No kernel does today.
- **Independent check** (a separate agent, before the PR) found no blocking defects. Fixed after it: a malformed step in the address (`#lecture/3/abc`, `#lecture/3`) is rewritten to the real step; a script with no steps shows a message instead of failing; a portrait that failed to load on a network error is fetched again on the next visit.
- **Visual polish** of the drawer, player and placeholders is the owner's.
- The production version follows the PRD. These are discovery spikes, and the route grammar and the script format are the parts worth keeping.

## Evidence

In `spikes/visual-foundation`:

- `npm test`: 12 node tests pass. Six are new: the scripts, the validator, the roster and the portrait fitting.
- `PORT=4199 npx playwright test`: 32 pass. These are the 25 host tests from #37 and 7 new lecture tests.
- `npm run build` (tsc and vite) passes.

## Position

- Keep the lecture player as a dock of the one scene and keep its state in the hash (`#lecture/<n>/<step>?present=1`). A teacher can bookmark or share a step, and a projector browser reopens the same view.
- Keep the scripts as data, one validated JSON file per lecture. #51–#53 only edit `lectures/*.json` and the roster, with no UI work.
- Link experiments with `stationHash` plus a return reference, so the same mechanism serves kernel and legacy stations.
- Unsure: whether teachers need a second screen, with notes on the laptop and slides on the projector. The current presenter mode is single-screen. A two-window mode could sync over `BroadcastChannel` later without changing the format.
