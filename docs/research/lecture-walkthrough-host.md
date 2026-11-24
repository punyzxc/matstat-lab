# Lecture walkthrough host (WIP)

Research for `lecture-walkthrough-host` (#50). Owner: punyzxc. Date: 2026-11-24. **Status: in progress, over budget is not yet reached; the player UI is not built yet.**

Builds on the scene host (#37, PR #49), merged into this branch.

## Done so far
- Scientist roster: `spikes/visual-foundation/lectures/scientists.json` (slug, name, years, lectures, one-line contribution). **Assumption:** names come from `lecture-module-map.md` (#36), not from the PDFs; #51–#53 confirm and extend.
- Portrait slots: `spikes/visual-foundation/public/portraits/<slug>.txt`, one empty file per scientist, plus a README with the slot limits (40 × 20). An empty file means "placeholder".

## Lecture script format (for #51–#53)
One file per lecture: `spikes/visual-foundation/lectures/LNN.json` (`L01` … `L12`).

```json
{
  "lecture": 3,
  "title": "Bernoulli scheme and its approximations",
  "scientists": ["bernoulli-jacob", "de-moivre", "laplace", "poisson"],
  "steps": [
    {
      "title": "Bernoulli formula",
      "idea": "One sentence or a short paragraph: the idea of this step.",
      "formula": ["Pₙ(k) = Cₙᵏ pᵏ qⁿ⁻ᵏ"],
      "example": "Optional worked example in plain text.",
      "scientists": ["bernoulli-jacob"],
      "experiment": { "station": "bernoulli", "seed": 7, "params": { "n": 7, "p": 0.5 }, "label": "Open the Bernoulli station" }
    }
  ]
}
```

Rules: formulas are Unicode text lines (no LaTeX, no network fonts); `station` is an id from `src/stations/catalog.ts`; `params` keys are the station's declared kernel params (numbers only); `seed` is 0…4294967295; one idea per step. Legacy stations take `n` (sample size), `scale` and `dist` (`normal`, `uniform`, `exponential`).

## Planned player design (not built yet)
- Routes: `#lectures` (quiet drawer listing 12 lectures), `#lecture/<n>/<step>`. "Open experiment" goes to `stationHash(id, seed, params)` plus `lecture=<n>&step=<k>`, so the dock shows "Back to lecture".
- Arrow keys and buttons move between steps; `P` toggles presenter mode (large type, reduced chrome, visible counter and keys).
- Fix needed: legacy stations read only `?seed` from the URL and take the rest from localStorage; they must honour `n`, `scale`, `dist` from the hash.
- Tests: Playwright spec for each acceptance criterion, a node test validating every script and the roster.

## Left to do
Player, drawer, presenter mode, legacy params fix, tests, `crew check`, PR, cross-vendor review.
