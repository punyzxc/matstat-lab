// Text with inline formulas: `$…$` marks TeX, `\$` is a literal dollar sign.
// Plain module (no imports) so that `node --test` and the kernels' consumers can use it directly.

/** Splits text into plain and math parts. An unmatched `$` is kept as plain text. */
export function splitMath(text) {
  const parts = [];
  let plain = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === '$') {
      plain += '$';
      i += 2;
      continue;
    }
    if (c === '$') {
      let j = i + 1;
      while (j < text.length && !(text[j] === '$' && text[j - 1] !== '\\')) j++;
      if (j < text.length && j > i + 1) {
        if (plain) parts.push({ math: false, value: plain });
        plain = '';
        parts.push({ math: true, value: text.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
    }
    plain += c;
    i++;
  }
  if (plain) parts.push({ math: false, value: plain });
  return parts;
}

const SYMBOLS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', varepsilon: 'ε', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', varphi: 'φ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Phi: 'Φ', Omega: 'Ω', Sigma: 'Σ',
  sum: 'Σ', prod: 'Π', int: '∫', infty: '∞', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼',
  to: '→', rightarrow: '→', Rightarrow: '⇒', iff: '⇔', Leftrightarrow: '⇔', pm: '±', mp: '∓', cdot: '·', times: '×', ldots: '…', dots: '…',
  cdots: '⋯', cup: '∪', cap: '∩', bigcup: '∪', bigcap: '∩', in: '∈', subset: '⊂', mid: '|', lvert: '|', rvert: '|', vert: '|',
  partial: '∂', prime: '′', emptyset: '∅', varnothing: '∅', quad: ' ', qquad: '  ', ',': ' ', ';': ' ', ':': ' ', '!': '',
  ell: 'ℓ', sup: 'sup', inf: 'inf', lim: 'lim', max: 'max', min: 'min', exp: 'exp', ln: 'ln', lg: 'lg', log: 'log', sin: 'sin', cos: 'cos',
  arctg: 'arctg', operatorname: '', mathrm: '', mathbf: '', mathit: '', text: '', textrm: '', displaystyle: '', left: '', right: '',
  big: '', Big: '', bigl: '', bigr: '', Bigl: '', Bigr: '', limits: '', '{': '{', '}': '}', '%': '%', '#': '#', '&': '&', _: '_',
};
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', i: 'ⁱ', k: 'ᵏ', m: 'ᵐ', n: 'ⁿ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', x: 'ˣ', '*': '*', '′': '′' };

/** Reads one TeX argument at `i`: a {group} or a single token. Returns [text, next index]. */
function arg(tex, i) {
  while (tex[i] === ' ') i++;
  if (tex[i] === '{') {
    let depth = 1;
    let j = i + 1;
    while (j < tex.length && depth) {
      if (tex[j] === '\\') j++;
      else if (tex[j] === '{') depth++;
      else if (tex[j] === '}') depth--;
      j++;
    }
    return [tex.slice(i + 1, j - 1), j];
  }
  if (tex[i] === '\\') {
    const m = /^\\([A-Za-z]+|.)/.exec(tex.slice(i));
    return [m[0], i + m[0].length];
  }
  return [tex[i] ?? '', i + 1];
}

const script = (s, map, mark) => {
  const flat = plain(s);
  return [...flat].every((c) => map[c]) ? [...flat].map((c) => map[c]).join('') : `${mark}(${flat})`;
};
const wrap = (s) => (/^[\w.′]+$/u.test(s) || /^\(.*\)$/.test(s) ? s : `(${s})`);

function plain(tex) {
  let out = '';
  let i = 0;
  while (i < tex.length) {
    const c = tex[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(tex.slice(i));
      const name = m[1];
      i += m[0].length;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [a, j] = arg(tex, i);
        const [b, k] = arg(tex, j);
        out += `${wrap(plain(a))}/${wrap(plain(b))}`;
        i = k;
      } else if (name === 'sqrt') {
        const [a, j] = arg(tex, i);
        out += `√${wrap(plain(a))}`;
        i = j;
      } else if (name === 'bar' || name === 'overline') {
        const [a, j] = arg(tex, i);
        out += [...plain(a)].map((ch) => ch + '̄').join('');
        i = j;
      } else if (name === 'hat' || name === 'tilde') {
        const [a, j] = arg(tex, i);
        out += plain(a) + (name === 'hat' ? '̂' : '̃');
        i = j;
      } else if (name === 'binom') {
        const [a, j] = arg(tex, i);
        const [b, k] = arg(tex, j);
        out += `C(${plain(a)}, ${plain(b)})`;
        i = k;
      } else if (name in SYMBOLS) {
        if ((name === 'sum' || name === 'prod' || name === 'int') && out && !/[\s(]$/.test(out)) out += ' ';
        out += SYMBOLS[name];
      } else out += name;
    } else if (c === '_' || c === '^') {
      const [a, j] = arg(tex, i + 1);
      out += c === '_' ? script(a, SUB, '_') : script(a, SUP, '^');
      i = j;
    } else if (c === '{' || c === '}') i++;
    else if (c === '~') {
      out += ' ';
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** A readable Unicode version of a TeX formula, for aria labels, titles and `<option>` text. */
export function texToPlain(tex) {
  return plain(tex).replace(/\s+/g, ' ').trim();
}

/** Text with `$…$` formulas as plain Unicode text. */
export function mathToPlain(text) {
  if (typeof text !== 'string' || !text.includes('$')) return text;
  return splitMath(text).map((p) => (p.math ? texToPlain(p.value) : p.value)).join('');
}
