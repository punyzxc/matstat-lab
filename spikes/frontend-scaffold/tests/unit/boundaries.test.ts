import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../src/functional');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
const areaOf = (file: string) => relative(root, file).split(sep)[0];

describe('functional area boundaries (docs/architecture.md)', () => {
  it('functional packages never import React, CSS or the app shell', () => {
    for (const file of files(root)) {
      for (const spec of imports(file)) {
        expect(spec, `${relative(root, file)} imports ${spec}`).not.toMatch(/^react|\.css$|\/app\//);
      }
    }
  });

  it('only the adapters reach into research-data; statistics imports no other area', () => {
    for (const file of files(root)) {
      const area = areaOf(file);
      for (const spec of imports(file)) {
        if (area === 'statistics') expect(spec, relative(root, file)).not.toMatch(/\.\.\/\.\.\/(simulation|inference|research-data|adapters)\//);
        if (area !== 'adapters' && area !== 'research-data') expect(spec, relative(root, file)).not.toMatch(/research-data\//);
      }
    }
  });
});
