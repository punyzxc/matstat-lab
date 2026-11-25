/**
 * The lecture script format (docs/research/lecture-walkthrough-host.md).
 * One JSON file per lecture: `spikes/visual-foundation/lectures/LNN.json`.
 * This module has no imports so that `node --test` can load it directly (Node strips the types).
 */
export type Experiment = {
  /** A station id from `src/stations/catalog.ts`. */
  station: string;
  /** 0 … 4294967295. Omit to use the station's default seed. */
  seed?: number;
  /** Station parameters, numbers only. Legacy stations read `n`, `scale` and `dist` (0 normal, 1 uniform, 2 exponential). */
  params?: Record<string, number>;
  /** Button text. Default: "Open experiment". */
  label?: string;
};
/** A live figure state for a story step (#110). Steps without one keep the previous step's figure and beat. */
export type FigureRef = { id: string; beat: string; params?: Record<string, number> };
/** A "what if?" invitation: one click sets these figure parameters. */
export type WhatIf = { label: string; params: Record<string, number> };
/** Layered explanation: the reader opens as much depth as they want. Text with inline `$…$`. */
export type Layers = { intuition?: string; definition?: string; details?: string };
/** A math portal (#138): a related step of another lecture, previewed live without leaving this one. */
export type Portal = { lecture: number; step: number };
export type Step = {
  title: string;
  /** One idea, a sentence or a short paragraph. */
  idea: string;
  /** Formula lines in TeX (KaTeX subset), each typeset as a display formula. Text fields may hold inline `$…$` TeX. */
  formula?: string[];
  /** An optional worked example, plain text; lines are kept. */
  example?: string;
  /** Slugs from `lectures/scientists.json` mentioned in this step. */
  scientists?: string[];
  experiment?: Experiment;
  /** Optional notes for the teacher; shown only in presenter mode. */
  notes?: string;
  /** Story lectures: what the live figure shows while this step is read. */
  figure?: FigureRef;
  /** Live formula lines: TeX with \\lv{key}{…}, \\lval{key}, \\lres{key} bound to the figure (#109). */
  live?: string[];
  layers?: Layers;
  whatIf?: WhatIf[];
  portals?: Portal[];
};
export type Lecture = {
  lecture: number;
  title: string;
  /** Slugs of every scientist the lecture names. */
  scientists?: string[];
  /** "draft" until the script task (#51–#53) fills it in. */
  status?: 'draft' | 'ready';
  /** true: the lecture reads as one scrolling story next to a live figure (#110). */
  story?: boolean;
  steps: Step[];
};
export type Scientist = { slug: string; name: string; years: string; lectures: number[]; contribution: string };

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const SLUG = /^[a-z][a-z0-9-]*$/;
const SEED_MAX = 4294967295;

/**
 * Checks one lecture script. Returns a list of problems; an empty list means the script is valid.
 * `stations` and `scientists` are the known ids; pass them to check references.
 */
type KnownFigure = { beats: string[]; params: Record<string, { min: number; max: number }>; vars: Record<string, unknown> };
type Known = {
  stations?: string[];
  scientists?: string[];
  /** Figure specs (src/lectures/figures/specs.mjs) to check story steps against. */
  figures?: Record<string, KnownFigure>;
  /** Extracts the keys of a live formula (src/lectures/live-tex.mjs liveTexKeys); throws on bad syntax. */
  liveKeys?: (tex: string) => { symbols: Set<string>; values: Set<string>; results: Set<string> };
  /** Number of steps of every lecture, to check that portal targets exist. */
  lectureSteps?: Record<number, number>;
};
export function validateLecture(value: unknown, known: Known = {}): string[] {
  const errors: string[] = [];
  const l = value as Lecture;
  if (!l || typeof l !== 'object') return ['the script is not an object'];
  if (!Number.isInteger(l.lecture) || l.lecture < 1 || l.lecture > 12) errors.push('lecture must be an integer from 1 to 12');
  if (!isText(l.title)) errors.push('title must be a non-empty string');
  if (l.status != null && l.status !== 'draft' && l.status !== 'ready') errors.push('status must be "draft" or "ready"');
  const slugRef = (where: string, list: unknown) => {
    if (list == null) return;
    if (!Array.isArray(list)) return errors.push(`${where}: scientists must be a list of slugs`);
    for (const s of list) {
      if (typeof s !== 'string' || !SLUG.test(s)) errors.push(`${where}: "${String(s)}" is not a slug`);
      else if (known.scientists && !known.scientists.includes(s)) errors.push(`${where}: unknown scientist "${s}"`);
    }
  };
  slugRef('lecture', l.scientists);
  if (l.story != null && typeof l.story !== 'boolean') errors.push('story must be true or false');
  if (!Array.isArray(l.steps) || l.steps.length === 0) {
    errors.push('steps must be a non-empty list');
    return errors;
  }
  if (l.story && !l.steps[0]?.figure) errors.push('step 1: a story lecture starts with a figure');
  let figure: KnownFigure | null = null;
  l.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    if (!s || typeof s !== 'object') return errors.push(`${at}: not an object`);
    if (!isText(s.title)) errors.push(`${at}: title must be a non-empty string`);
    if (!isText(s.idea)) errors.push(`${at}: idea must be a non-empty string`);
    if (s.formula != null && (!Array.isArray(s.formula) || !s.formula.every(isText))) errors.push(`${at}: formula must be a list of text lines`);
    if (s.example != null && !isText(s.example)) errors.push(`${at}: example must be text`);
    if (s.notes != null && !isText(s.notes)) errors.push(`${at}: notes must be text`);
    slugRef(at, s.scientists);
    if (Array.isArray(s.scientists) && Array.isArray(l.scientists)) {
      for (const slug of s.scientists) if (!l.scientists.includes(slug)) errors.push(`${at}: "${slug}" is missing from the lecture's scientists`);
    }
    if (!l.story && (s.figure || s.live || s.whatIf || s.portals)) errors.push(`${at}: figure, live, whatIf and portals need "story": true`);
    if (s.figure != null) {
      const f = s.figure;
      if (!f || typeof f !== 'object' || !isText(f.id) || !isText(f.beat)) errors.push(`${at}: figure needs an id and a beat`);
      else if (known.figures) {
        figure = known.figures[f.id] ?? null;
        if (!figure) errors.push(`${at}: unknown figure "${f.id}"`);
        else if (!figure.beats.includes(f.beat)) errors.push(`${at}: figure "${f.id}" has no beat "${f.beat}"`);
      }
    }
    const paramsOk = (where: string, params: unknown) => {
      if (params == null) return;
      if (typeof params !== 'object' || Array.isArray(params)) return errors.push(`${at}: ${where} must be an object`);
      for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${at}: ${where} "${k}" must be a finite number`);
        else if (figure) {
          const p = figure.params[k];
          if (!p) errors.push(`${at}: ${where} "${k}" is not a parameter of the figure`);
          else if (v < p.min || v > p.max) errors.push(`${at}: ${where} "${k}" = ${v} is outside ${p.min} … ${p.max}`);
        }
      }
    };
    paramsOk('figure.params', s.figure?.params);
    if (s.live != null) {
      if (!Array.isArray(s.live) || !s.live.every(isText)) errors.push(`${at}: live must be a list of TeX lines`);
      else if (known.liveKeys)
        for (const line of s.live) {
          try {
            const keys = known.liveKeys(line);
            if (figure) {
              for (const k of keys.values) if (!figure.params[k]) errors.push(`${at}: \\lval{${k}} is not a parameter of the figure`);
              for (const k of [...keys.symbols, ...keys.results]) if (!figure.vars[k] && !figure.params[k]) errors.push(`${at}: "${k}" is not a variable of the figure`);
            }
          } catch (err) {
            errors.push(`${at}: ${(err as Error).message}`);
          }
        }
    }
    if (s.layers != null) {
      if (typeof s.layers !== 'object' || Array.isArray(s.layers)) errors.push(`${at}: layers must be an object`);
      else
        for (const [k, v] of Object.entries(s.layers)) {
          if (!['intuition', 'definition', 'details'].includes(k)) errors.push(`${at}: unknown layer "${k}"`);
          else if (!isText(v)) errors.push(`${at}: layer "${k}" must be text`);
        }
    }
    if (s.whatIf != null) {
      if (!Array.isArray(s.whatIf)) errors.push(`${at}: whatIf must be a list`);
      else
        s.whatIf.forEach((w, j) => {
          if (!w || !isText(w.label)) errors.push(`${at}: whatIf ${j + 1} needs a label`);
          if (!w?.params || !Object.keys(w.params).length) errors.push(`${at}: whatIf ${j + 1} needs params`);
          else paramsOk(`whatIf ${j + 1}`, w.params);
        });
    }
    if (s.portals != null) {
      if (!Array.isArray(s.portals) || !s.portals.length) errors.push(`${at}: portals must be a non-empty list`);
      else
        s.portals.forEach((p, j) => {
          if (!p || !Number.isInteger(p.lecture) || !Number.isInteger(p.step) || p.step < 1) return errors.push(`${at}: portal ${j + 1} needs a lecture and a step`);
          if (p.lecture === l.lecture) errors.push(`${at}: portal ${j + 1} points into its own lecture`);
          const steps = known.lectureSteps?.[p.lecture];
          if (known.lectureSteps && (steps == null || p.step > steps)) errors.push(`${at}: portal ${j + 1} points to lecture ${p.lecture}, step ${p.step}, which does not exist`);
        });
    }
    const e = s.experiment;
    if (e == null) return;
    if (!isText(e.station)) errors.push(`${at}: experiment.station must be a station id`);
    else if (known.stations && !known.stations.includes(e.station)) errors.push(`${at}: unknown station "${e.station}"`);
    if (e.seed != null && (!Number.isInteger(e.seed) || e.seed < 0 || e.seed > SEED_MAX)) errors.push(`${at}: seed must be an integer from 0 to ${SEED_MAX}`);
    if (e.params != null) {
      if (typeof e.params !== 'object' || Array.isArray(e.params)) errors.push(`${at}: params must be an object`);
      else
        for (const [k, v] of Object.entries(e.params)) {
          if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) errors.push(`${at}: parameter name "${k}" is not allowed`);
          if (k === 'seed' || k === 'lecture' || k === 'step' || k === 'present') errors.push(`${at}: "${k}" is reserved; use experiment.seed`);
          if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${at}: parameter "${k}" must be a finite number`);
        }
    }
    if (e.label != null && !isText(e.label)) errors.push(`${at}: experiment.label must be text`);
  });
  return errors;
}

export function validateRoster(value: unknown): string[] {
  const errors: string[] = [];
  const list = (value as { scientists?: Scientist[] })?.scientists;
  if (!Array.isArray(list)) return ['scientists must be a list'];
  const seen = new Set<string>();
  list.forEach((s, i) => {
    const at = `scientist ${i + 1}`;
    if (!s || !SLUG.test(s.slug)) return errors.push(`${at}: slug must be lower-case letters, digits and dashes`);
    if (seen.has(s.slug)) errors.push(`${at}: duplicate slug "${s.slug}"`);
    seen.add(s.slug);
    if (!isText(s.name)) errors.push(`${s.slug}: name is required`);
    if (!isText(s.years)) errors.push(`${s.slug}: years are required`);
    if (!isText(s.contribution)) errors.push(`${s.slug}: contribution is required`);
    if (!Array.isArray(s.lectures) || !s.lectures.length || !s.lectures.every((n) => Number.isInteger(n) && n >= 1 && n <= 12))
      errors.push(`${s.slug}: lectures must list numbers from 1 to 12`);
  });
  return errors;
}

/** The portrait slot: art up to this size shows at full size; larger art is scaled down to fit, never wrapped. */
export const PORTRAIT = { columns: 40, lines: 20 } as const;
/** Beyond this the file is surely not a portrait; the rest is cut so a pasted log cannot freeze the page. */
export const PORTRAIT_LIMIT = { columns: 200, lines: 100 } as const;

/** Plain-text art, whole lines kept; null when the file is empty or is not plain text (e.g. an HTML fallback page). */
export function fitPortrait(text: string | null | undefined): string | null {
  if (text == null) return null;
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  if (!clean.trim()) return null;
  if (/^\s*<(!doctype|html|head|body)/i.test(clean)) return null;
  const lines = clean.replace(/\n+$/, '').split('\n').slice(0, PORTRAIT_LIMIT.lines);
  return lines.map((line) => Array.from(line).slice(0, PORTRAIT_LIMIT.columns).join('').replace(/\s+$/, '')).join('\n');
}

/** Columns and lines of fitted art, and the scale (at most 1) that fits it into the slot. */
export function portraitScale(art: string) {
  const rows = art.split('\n');
  const columns = Math.max(1, ...rows.map((r) => Array.from(r).length));
  const lines = rows.length;
  return { columns, lines, scale: Math.min(1, PORTRAIT.columns / columns, PORTRAIT.lines / lines) };
}

/**
 * The typewriter reveal at frame `k`: a diagonal sweep, so every line types at once from the left and lower
 * lines start a little later. Hidden characters become spaces, so the art never shifts while it appears.
 * Returns the art itself once `k` passes the last character.
 */
export function revealPortrait(art: string, k: number): string {
  const rows = art.split('\n');
  if (k >= revealFrames(art)) return art;
  return rows.map((row, r) => Array.from(row).map((ch, c) => (c + 2 * r < k ? ch : ' ')).join('').replace(/\s+$/, '')).join('\n');
}
/** Frames until the sweep has typed every character. */
export const revealFrames = (art: string) => {
  const rows = art.split('\n');
  return Math.max(0, ...rows.map((row, r) => Array.from(row).length + 2 * r));
};
