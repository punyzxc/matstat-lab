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
export type StoryText = string | { en: string; ru: string };
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
  layers?: Partial<Record<'intuition' | 'definition' | 'formula' | 'details', StoryText>>;
  whatIf?: { label: StoryText; params: Record<string, number>; seed?: number }[];
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
  beats?: { id: string; step: number; label: StoryText; experiment: Experiment }[];
};
export type Scientist = { slug: string; name: string; years: string; lectures: number[]; contribution: string };

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const SLUG = /^[a-z][a-z0-9-]*$/;
const SEED_MAX = 4294967295;

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStoryText = (v: unknown): v is StoryText => isText(v) || (isObject(v) && isText(v.en) && isText(v.ru));

export function usesStory(lecture: Lecture): boolean {
  return lecture.beats !== undefined || lecture.steps.some((step) => step.layers !== undefined || step.whatIf !== undefined);
}

export function experimentForStep(lecture: Lecture, index1based: number): Experiment | null {
  if (!Number.isInteger(index1based) || index1based < 1 || index1based > lecture.steps.length) return null;
  const experiment = lecture.beats?.find((beat) => beat.step === index1based)?.experiment ?? lecture.steps[index1based - 1].experiment;
  return experiment ? { ...experiment, ...(experiment.params === undefined ? {} : { params: { ...experiment.params } }) } : null;
}

export function storyText(value: StoryText, lang: 'en' | 'ru'): string {
  return typeof value === 'string' ? value : value[lang];
}

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
  const checkSeed = (seed: unknown, at: string) => {
    if (seed !== undefined && (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > SEED_MAX)) errors.push(`${at}: seed must be an integer from 0 to ${SEED_MAX}`);
  };
  const checkParams = (params: unknown, at: string) => {
    if (!isObject(params)) { errors.push(`${at}: params must be an object`); return; }
    for (const [k, v] of Object.entries(params)) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) errors.push(`${at}: parameter name "${k}" is not allowed`);
      if (k === 'seed' || k === 'lecture' || k === 'step' || k === 'present') errors.push(`${at}: "${k}" is reserved; use experiment.seed`);
      if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${at}: parameter "${k}" must be a finite number`);
    }
  };
  const checkExperiment = (experiment: unknown, at: string, strict = false) => {
    if (!isObject(experiment)) { errors.push(`${at}: experiment must be an object`); return; }
    if (!isText(experiment.station)) errors.push(`${at}: experiment.station must be a station id`);
    else if (known.stations && !known.stations.includes(experiment.station)) errors.push(`${at}: unknown station "${experiment.station}"`);
    if (strict ? experiment.seed !== undefined : experiment.seed != null) checkSeed(experiment.seed, at);
    if (strict ? experiment.params !== undefined : experiment.params != null) checkParams(experiment.params, at);
    if ((strict ? experiment.label !== undefined : experiment.label != null) && !isText(experiment.label)) errors.push(`${at}: experiment.label must be text`);
  };
  if (l.beats !== undefined) {
    if (!Array.isArray(l.beats)) errors.push('beats must be a list');
    else {
      const ids = new Set<string>();
      const steps = new Set<number>();
      l.beats.forEach((beat, i) => {
        const at = `beat ${i + 1}`;
        if (!isObject(beat)) { errors.push(`${at}: not an object`); return; }
        if (!isText(beat.id)) errors.push(`${at}: id must be text`);
        else if (ids.has(beat.id)) errors.push(`${at}: duplicate id "${beat.id}"`);
        else ids.add(beat.id);
        if (!Number.isInteger(beat.step) || (beat.step as number) < 1 || (beat.step as number) > l.steps.length) errors.push(`${at}: step must refer to a lecture step`);
        else if (steps.has(beat.step as number)) errors.push(`${at}: duplicate step`);
        else steps.add(beat.step as number);
        if (!isStoryText(beat.label)) errors.push(`${at}: label must be text or bilingual text`);
        checkExperiment(beat.experiment, at, true);
      });
    }
  }
  l.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return errors.push(`${at}: not an object`);
    if (!isText(s.title)) errors.push(`${at}: title must be a non-empty string`);
    if (!isText(s.idea)) errors.push(`${at}: idea must be a non-empty string`);
    if (s.formula != null && (!Array.isArray(s.formula) || !s.formula.every(isText))) errors.push(`${at}: formula must be a list of text lines`);
    if (s.example != null && !isText(s.example)) errors.push(`${at}: example must be text`);
    if (s.notes != null && !isText(s.notes)) errors.push(`${at}: notes must be text`);
    slugRef(at, s.scientists);
    if (Array.isArray(s.scientists) && Array.isArray(l.scientists)) {
      for (const slug of s.scientists) if (!l.scientists.includes(slug)) errors.push(`${at}: "${slug}" is missing from the lecture's scientists`);
    }
    if (s.experiment != null) checkExperiment(s.experiment, at);
    if (s.layers !== undefined) {
      if (!isObject(s.layers)) errors.push(`${at}: layers must be an object`);
      else for (const [key, value] of Object.entries(s.layers)) {
        if (!['intuition', 'definition', 'formula', 'details'].includes(key)) errors.push(`${at}: unknown layer "${key}"`);
        if (!isStoryText(value)) errors.push(`${at}: layer "${key}" must be text or bilingual text`);
      }
    }
    if (s.whatIf !== undefined) {
      if (!Array.isArray(s.whatIf)) errors.push(`${at}: whatIf must be a list`);
      else s.whatIf.forEach((item, j) => {
        const where = `${at}: whatIf ${j + 1}`;
        if (!isObject(item)) { errors.push(`${where}: not an object`); return; }
        if (!isStoryText(item.label)) errors.push(`${where}: label must be text or bilingual text`);
        checkParams(item.params, where);
        checkSeed(item.seed, where);
      });
    }
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
