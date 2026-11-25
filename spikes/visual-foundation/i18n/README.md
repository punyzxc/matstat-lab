# Translations

The Orbital laboratory speaks **Russian by default**; the **EN** switch in the top bar shows English and back, at once,
without a reload. The choice is remembered in the browser (`statum-lab:lang`); `?lang=en` or `?lang=ru` in the address
overrides it for a visit.

English stays the source language of the code: kernels, lecture scripts and components are written in English, and
Russian comes from here.

| What | Where the English is | Where the Russian is |
|---|---|---|
| Scene, stations, player, tooltips | the components (`src/**/*.tsx`): `t('English', 'Русский')` | next to the English, same call |
| Station kernels (`spikes/<id>/kernel.mjs`) | readouts, labels, notes, axes the kernel returns | `ru/kernels/<id>.json`, shared words in `ru/kernels/_common.json` |
| Lecture scripts (`lectures/LNN.json`) | title, steps, examples, teacher notes, formula lines with words in `\text{…}` | `ru/lectures/LNN.json` |
| Scientists (`lectures/scientists.json`) | name, contribution | `ru/scientists.json` |

## Dictionaries

A dictionary maps English text to Russian. Text a kernel computes uses numbered holes `[[1]]`, `[[2]]`, … for
the parts that change; the Russian puts the same holes where its grammar needs them, in any order:

```json
{ "Relative frequency after $n = [[1]]$, first sequence": "Относительная частота после $n = [[1]]$, первая серия" }
```

A hole's text is translated again on its own (a law's name inserted into a sentence), numbers stay as they are.
Every number then gets the Russian decimal comma automatically (`0,5`; in TeX `0{,}5`, with `;` between listed
numbers), so dictionaries keep the decimal point.

Formulas stay in textbook notation: everything between `$…$` is TeX, and Russian words inside a formula go into
`\text{…}`.

## Checks

`npm test` runs `tests/i18n.test.mjs`: every text every kernel shows (defaults, every choice, random settings),
every lecture text and every scientist must have a Russian translation without English words left, with valid TeX,
and no dictionary entry may be unused. When a kernel's text changes, list what is left to translate:

```
node tests/i18n-kernel-texts.mjs lecture-limit-theorems
```
