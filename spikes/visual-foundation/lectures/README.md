# Lecture scripts

One file per lecture, `L01.json` … `L12.json`. The scene's "Lectures" drawer and the step player read them at build time.
The files here are **drafts** (`"status": "draft"`) written from the lecture map; the script tasks replace them:
L1–L3 #51, L4–L9 #52, L10–L12 #53. Set `"status": "ready"` when a lecture is checked against its PDF.

## Format

```json
{
  "lecture": 3,
  "title": "The Bernoulli scheme and its approximations",
  "status": "draft",
  "scientists": ["bernoulli-jacob", "de-moivre"],
  "steps": [
    {
      "title": "Bernoulli formula",
      "idea": "One idea per step: a sentence or a short paragraph.",
      "formula": ["P_n(k) = C_n^k\\, p^k q^{\\,n-k}, \\qquad q = 1 - p"],
      "example": "Optional worked example. Line breaks are kept.",
      "scientists": ["bernoulli-jacob"],
      "notes": "Optional teacher notes, shown only in presenter mode.",
      "experiment": { "station": "bernoulli", "seed": 7, "params": { "n": 7, "p": 0.5 }, "label": "Open the Bernoulli station" }
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `lecture` | 1 … 12, matches the file name. |
| `title`, `steps[].title`, `steps[].idea` | Required text. Inline formulas go between dollar signs: `rare events with $np = \lambda$` (write `\$` for a literal dollar). |
| `formula` | Optional list of lines in TeX, typeset with KaTeX as display formulas (fractions `\dfrac{a}{b}`, `\sum_{i=1}^{n}`, `\int_a^b`, `\sqrt{n}`, `x_i`, `\bar{x}`, `\xrightarrow[n\to\infty]{P}`). Words go in `\text{…}`. KaTeX and its fonts are bundled, nothing loads from the network. `npm test` fails on any line KaTeX cannot typeset. In JSON every backslash is doubled. |
| `example`, `notes` | Optional text, with inline `$…$` formulas like the other text fields. |
| `scientists` | Slugs from `scientists.json`. Every slug a step names must also be in the lecture's list, and the roster entry must list this lecture. |
| `experiment.station` | A station id from `src/stations/catalog.ts` (`urn`, `frequency`, `darts`, `bayes`, `bernoulli`, `distribution`, `moments`, `transform`, `scatter`, `convolution`, `convergence`, `lln`, `clt`, `sample`, `fit`, `estimation`, `confidence`, `homogeneity`, `testing`, `randomness`). |
| `experiment.seed` | Optional integer 0 … 4294967295. |
| `experiment.params` | Optional numbers only. Kernel stations: the keys their `kernel.mjs` declares for that station (`stations[id].params`, else `meta.params`) (out-of-range values are clamped to the slider). Legacy stations (`distribution`, `convergence`, `testing`, `randomness`): `n` (64 … 2048), `scale` (0.5 … 2.5), `dist` (0 normal, 1 uniform, 2 exponential). `seed`, `lecture`, `step` and `present` are reserved. |

Check your files: `npm test` in `spikes/visual-foundation` (runs `tests/lectures.test.mjs`). Preview: `npm run dev`, then open `#lecture/<n>/1`.

## Player keys

← → or PageUp/PageDown (presentation clickers): previous and next step · Home/End: first and last step · P: presenter mode · Esc: close.
Links: `#lectures` (the list), `#lecture/3/2` (lecture 3, step 2), `#lecture/3/2?present=1` (presenter mode).
