// Snapshots (#114): a saved experiment state, overlaid as a ghost on the live chart.
// A draw is fully determined by its parameters and seed, so a snapshot stores only those and is replayed on load;
// that is also what makes it fit in the address.

/** At most four snapshots, each in its own slot (and colour). */
export const SNAP_SLOTS = ['A', 'B', 'C', 'D'];

/**
 * One snapshot in the address: `[-]<slot><seed>~key:value~…~key'text`, `-` when it is hidden.
 * Example: `A7~n:10~law:0` is snapshot A, seed 7, n = 10, law 0, shown.
 */
export function encodeSnap(s) {
  const nums = Object.entries(s.params).map(([k, v]) => `~${k}:${v}`);
  const texts = Object.entries(s.texts ?? {}).map(([k, v]) => `~${k}'${encodeURIComponent(v).replace(/~/g, '%7E')}`);
  return `${s.hidden ? '-' : ''}${s.slot}${s.seed}${nums.join('')}${texts.join('')}`;
}

const KEY = /^[A-Za-z_][\w]*$/;
const NUMBER = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i;

/** The snapshot an address entry names, or null when it is not one. Parameters are returned as written. */
export function decodeSnap(code) {
  const m = /^(-?)([A-D])(\d{1,10})((?:~[^~]*)*)$/.exec(String(code ?? ''));
  if (!m || Number(m[3]) > 4294967295) return null;
  const params = {}, texts = {};
  for (const field of m[4].split('~').slice(1)) {
    const colon = field.indexOf(':'), quote = field.indexOf("'");
    if (colon > 0 && (quote < 0 || colon < quote)) {
      const k = field.slice(0, colon), v = field.slice(colon + 1);
      if (KEY.test(k) && NUMBER.test(v) && Number.isFinite(Number(v))) params[k] = Number(v);
    } else if (quote > 0) {
      const k = field.slice(0, quote);
      let v;
      try {
        v = decodeURIComponent(field.slice(quote + 1));
      } catch {
        continue;
      }
      if (KEY.test(k) && v.length <= 200) texts[k] = v;
    }
  }
  return { slot: m[2], seed: Number(m[3]), params, texts, hidden: m[1] === '-' };
}

/** Snapshots from the address: valid ones only, one per slot, in slot order. */
export function decodeSnaps(codes) {
  const out = [];
  for (const c of codes ?? []) {
    const s = decodeSnap(c);
    if (s && !out.some((o) => o.slot === s.slot)) out.push(s);
  }
  return out.sort((a, b) => SNAP_SLOTS.indexOf(a.slot) - SNAP_SLOTS.indexOf(b.slot));
}

/** The first free slot, or null when all four are taken. */
export function freeSlot(snaps) {
  return SNAP_SLOTS.find((slot) => !snaps.some((s) => s.slot === slot)) ?? null;
}

/** Same experiment and seed: taking a second snapshot of it adds nothing. */
export const sameSnap = (a, b) =>
  a.seed === b.seed && JSON.stringify(a.params) === JSON.stringify(b.params) && JSON.stringify(a.texts ?? {}) === JSON.stringify(b.texts ?? {});

/**
 * The ghost of a snapshot's result on the live chart: its observed series (default tone, not bands or markers),
 * recoloured to the slot. Theory curves are left out: they are the live chart's own reference.
 */
export function ghostSeries(result, slot, label) {
  const observed = result.series.filter((s) => (s.tone ?? 'default') === 'default' && s.kind !== 'band' && s.kind !== 'rule' && s.x.length > 0);
  return observed.map((s, i) => ({
    id: `ghost-${slot}-${s.id}`,
    kind: s.kind,
    x: s.x,
    y: s.y,
    tone: `ghost-${slot.toLowerCase()}`,
    ...(i === 0 ? { label } : {}),
  }));
}

/** A ghost is drawn only on the same picture: the same axes (a snapshot of another view would mean nothing there). */
export const sameAxes = (a, b) => (a?.x ?? '') === (b?.x ?? '') && (a?.y ?? '') === (b?.y ?? '');
