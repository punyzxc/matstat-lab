import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(import.meta.dirname, '../../src');
const functional = join(src, 'functional');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

/** Every module specifier: `import x from`, `export … from`, bare `import 'x'` and dynamic `import('x')`. */
export function specifiers(code: string): string[] {
  const patterns = [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g];
  return patterns.flatMap((p) => [...code.matchAll(p)].map((m) => m[1]));
}

/** The functional area a path belongs to, or 'outside' for anything not under src/functional. */
const areaOf = (path: string) => {
  const rel = relative(functional, path);
  return rel.startsWith('..') ? 'outside' : rel.split(sep)[0];
};

type Edge = { from: string; fromArea: string; spec: string; target?: string; targetArea?: string };
const edges = (): Edge[] =>
  files(functional).flatMap((file) =>
    specifiers(readFileSync(file, 'utf8')).map((spec) => {
      const base = { from: relative(src, file), fromArea: areaOf(file), spec };
      if (!spec.startsWith('.')) return base;
      const target = resolve(dirname(file), spec);
      return { ...base, target: relative(src, target), targetArea: areaOf(target) };
    }),
  );

describe('functional area boundaries (docs/architecture.md)', () => {
  it('the scanner sees every import form', () => {
    expect(specifiers(`import './a.css'; import b from "b"; export { c } from '../c'; const d = () => import('d');`)).toEqual(
      ['b', '../c', './a.css', 'd'],
    );
  });

  it('functional packages import no React, CSS or anything outside src/functional', () => {
    for (const e of edges()) {
      const label = `${e.from} imports ${e.spec}`;
      expect(e.spec, label).not.toMatch(/^(react|react-dom)(\/|$)/);
      expect(e.spec, label).not.toMatch(/\.(css|scss|sass|less)(\?|$)/);
      if (e.targetArea) expect(e.targetArea, label).not.toBe('outside');
    }
  });

  it('statistics imports no other area; only adapters reach research-data', () => {
    for (const e of edges()) {
      if (!e.targetArea || e.targetArea === e.fromArea) continue;
      const label = `${e.from} imports ${e.spec}`;
      if (e.fromArea === 'statistics') expect.fail(`${label}: statistics must not import ${e.targetArea}`);
      if (e.targetArea === 'research-data') expect(e.fromArea, label).toBe('adapters');
    }
  });
});
