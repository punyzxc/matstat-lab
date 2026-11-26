# L4–L9 walkthrough research (#52)

Proposed Russian scripts with English identifiers; discovery data, not a replacement for the shipped lecture stories.
Read [the research report](../../docs/research/lecture-walkthroughs-random-variables.md) for the original-PDF inventory,
explicit omissions, source corrections, teaching activities and independent verification.

- `scripts/L04.json` … `L09.json`: 74 steps, class questions/answers, source pages and audit reference IDs.
- `evidence.json`: all 23 proposed presets, resolved numeric defaults, expected readouts and full-result hashes.
- `record.mjs --check`: verify frozen evidence; `--write` deliberately records a new baseline only after review.
- `walkthroughs.test.mjs`: host schema, source-page/audit coverage, unclamped presets, replay and KaTeX.
- `check_math.py`: independent SciPy/rational/enumeration checks; never imports a project kernel.

From the repository root, after `npm ci` in `spikes/visual-foundation`:

```sh
node --test spikes/lecture-walkthroughs-random-variables/walkthroughs.test.mjs
node spikes/lecture-walkthroughs-random-variables/record.mjs --check
python spikes/lecture-walkthroughs-random-variables/check_math.py
```

The script format extends the existing host data with research-only `id`, `source`, `auditIds`, `expected`,
`checks` and `skipped` metadata. The host validator accepts the underlying lecture/step/experiment fields.
Top-level check questions must be adapted into the existing lesson flow by the assigned integration task;
the current player does not automatically render this research metadata.
Russian text is authorial teaching **proposal**; its mathematical facts are traced by source pages, the
report's links and the existing worked-example audit. Keep `status: draft` until independent review and integration.
No course PDFs or extracted source text belong in this folder.
