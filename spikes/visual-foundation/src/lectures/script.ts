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
export type Step = {
  title: string;
  /** One idea, a sentence or a short paragraph. */
  idea: string;
  /** Formula lines as plain Unicode text (no LaTeX, no network fonts). */
  formula?: string[];
  /** An optional worked example, plain text; lines are kept. */
  example?: string;
  /** Slugs from `lectures/scientists.json` mentioned in this step. */
  scientists?: string[];
  experiment?: Experiment;
  /** Optional notes for the teacher; shown only in presenter mode. */
  notes?: string;
};
export type Lecture = {
  lecture: number;
  title: string;
  /** Slugs of every scientist the lecture names. */
  scientists?: string[];
  /** "draft" until the script task (#51–#53) fills it in. */
  status?: 'draft' | 'ready';
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
export function validateLecture(value: unknown, known: { stations?: string[]; scientists?: string[] } = {}): string[] {
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
  if (!Array.isArray(l.steps) || l.steps.length === 0) {
    errors.push('steps must be a non-empty list');
    return errors;
  }
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

/** The portrait slot: the owner's art is clipped to this many columns and lines. */
export const PORTRAIT = { columns: 40, lines: 20 } as const;

/** Plain-text art fitted to the slot; null when the file is empty or is not plain text (e.g. an HTML fallback page). */
export function fitPortrait(text: string | null | undefined): string | null {
  if (text == null) return null;
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  if (!clean.trim()) return null;
  if (/^\s*<(!doctype|html|head|body)/i.test(clean)) return null;
  const lines = clean.replace(/\n+$/, '').split('\n').slice(0, PORTRAIT.lines);
  return lines.map((line) => Array.from(line).slice(0, PORTRAIT.columns).join('')).join('\n');
}
