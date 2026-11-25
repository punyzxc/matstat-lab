import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const home = fileURLToPath(new URL('.', import.meta.url));
const report = JSON.parse(readFileSync(new URL('results/report.json', import.meta.url), 'utf8'));
const cases = [];
function walk(suite) {
  for (const spec of suite.specs ?? []) for (const t of spec.tests) {
    cases.push({ title: spec.title, status: t.status, expectedStatus: t.expectedStatus,
      results: t.results.map(r => ({ status: r.status, retry: r.retry, durationMs: r.duration,
        errors: r.errors, attachments: r.attachments.filter(a => a.contentType === 'application/json').map(a => ({
          name: a.name, value: JSON.parse(a.body ? Buffer.from(a.body, 'base64').toString('utf8') : readFileSync(a.path, 'utf8')),
        })) })) });
    for (const r of t.results) for (const a of r.attachments) if (a.name === 'fixture-at-1280.png') {
      mkdirSync(new URL('evidence/', import.meta.url), { recursive: true });
      writeFileSync(new URL('evidence/fixture-at-1280.png', import.meta.url), a.body ? Buffer.from(a.body, 'base64') : readFileSync(a.path));
    }
  }
  for (const nested of suite.suites ?? []) walk(nested);
}
for (const suite of report.suites) walk(suite);
const geometry = cases.flatMap(c => c.results.flatMap(r => r.attachments.filter(a => a.name === 'geometry.json').flatMap(a => a.value)));
const evidence = {
  subject: 'Independent one-scene audit, issue #56',
  testedSource: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: home, encoding: 'utf8' }).trim(),
  playwright: JSON.parse(readFileSync(new URL('../visual-foundation/node_modules/@playwright/test/package.json', import.meta.url))).version,
  startTime: report.stats.startTime, durationMs: report.stats.duration,
  counts: { expected: report.stats.expected, unexpected: report.stats.unexpected, skipped: report.stats.skipped, flaky: report.stats.flaky,
    routeViewportPairs: geometry.length, routes: [...new Set(geometry.map(g => g.route))].length,
    pendingKernelRoutes: [...new Set(geometry.filter(g => g.pendingKernel).map(g => g.route))],
    stationAlerts: geometry.filter(g => g.stationAlerts.length).map(g => ({ route: g.route, alerts: g.stationAlerts })),
  },
  limits: ['Single installed Edge browser on Windows; English UI; reduced motion.',
    'Rendered visibility is a geometry/style check, not a pixel occlusion or accessibility certification.',
    'Internal clipped/scrolling panels and aria-hidden decoration excluded from horizontal element overflow; root dimensions and scrolling checked separately.',
    'Hidden deep links have no opener card; tested title focus and Escape, not return to a nonexistent opener.',
    'Default station parameters only, plus three explicit contract-fixture replay combinations. Pending kernels are host-shell coverage only.'],
  cases,
};
writeFileSync(new URL('evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence.counts, null, 2));
if (evidence.counts.unexpected || evidence.counts.skipped || evidence.counts.flaky) process.exitCode = 1;
