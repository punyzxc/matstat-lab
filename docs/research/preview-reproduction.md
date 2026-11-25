# Clean-clone preview reproduction — #20

## Scope and pinned sources

**Fact:** this audit covers the two URLs in the [team launch instructions](https://github.com/punyzxc/matstat-lab/blob/702d6c259a23a3b0080c0c8dabe27c95721df349/docs/team-preview.md), at preview commit `702d6c259a23a3b0080c0c8dabe27c95721df349`. It does not audit the newer `main` scene, production scientific correctness, or Worker lifecycle behavior. The moving `preview/discovery` branch must not be treated as identical to `main`.

**Fact (local observation, 2026-11-25):** an independent HTTPS clone was created with `git clone --single-branch --branch preview/discovery https://github.com/punyzxc/matstat-lab.git clean-preview`. Its common Git directory was `.git`, not the executor's worktree Git directory. Its tracked status remained clean after the checks. No files, dependencies, API keys, or running servers were borrowed from another checkout. npm used the machine's ordinary package cache. GitHub authentication for repository access is separate from preview runtime requirements.

**Fact (local observation):** host Windows 11 Pro, build 26200; host Node 24.15.0 / npm 11.12.1; both servers and the acceptance runner used downloaded **Node 22.18.0** through `npm exec --yes --package=node@22.18.0 -- node ...`. `npm ci` was also repeated using Node 22.18.0 with the installed npm CLI. Browser: installed Google Chrome **158.0.8127.37**, controlled headlessly through the clone's locked Playwright dependency. This is one Windows/Chrome environment, not a cross-platform claim.

## Reproduce without a pre-existing worktree

**Fact:** the following is the clean-clone equivalent of the launch document's fetch/worktree procedure. A separate worktree is useful for contributors, but the preview itself has no runtime dependency on one.

```powershell
git clone --single-branch --branch preview/discovery https://github.com/punyzxc/matstat-lab.git clean-preview
cd clean-preview
git switch --detach 702d6c259a23a3b0080c0c8dabe27c95721df349
node --version # Node 22.18.0 or newer
cd spikes/visual-foundation
npm ci
npm run dev -- --host 127.0.0.1 --port 4181 --strictPort
```

**Fact:** this opens the main preview at <http://127.0.0.1:4181/> and Distribution Explorer at <http://127.0.0.1:4181/#module/distribution>. Keep the terminal running. In a second terminal, from the same clone's root:

```powershell
node spikes/orbital-atmosphere/serve.mjs
```

**Fact:** the separate study opens at <http://127.0.0.1:4178/>. Its [server](https://github.com/punyzxc/matstat-lab/blob/702d6c259a23a3b0080c0c8dabe27c95721df349/spikes/orbital-atmosphere/serve.mjs) serves local files using Node built-ins; it needs no npm install of its own. Neither preview needs a backend or `.env` secrets. Repository/package downloads need network access during setup. The observed browser run made zero non-local requests, including fonts.

## Acceptance evidence

**Fact:** the executable [acceptance runner](../../spikes/preview-reproduction/reproduce.test.mjs) was committed before the report. With no servers running it failed with `ECONNREFUSED 127.0.0.1:4181`. With both fresh-clone servers running, it passed on Node 22.18.0. It resolves Playwright from `PREVIEW_ROOT`, uses a new browser context, and closes its browser. It neither starts nor silently reuses a server of its own; the operator must start the servers from the pinned clone above.

```powershell
# Run from the task checkout containing this report, while both servers run.
$env:PREVIEW_ROOT = (Resolve-Path '../clean-preview').Path # adapt to your clone
node --test spikes/preview-reproduction/reproduce.test.mjs
```

| Criterion | Observed result (facts from the runner/local commands) |
| --- | --- |
| Both preview URLs open | HTTP 200 on ports 4181 and 4178; main Distribution Explorer heading visible; separate study heading, six instrument links, and a non-empty canvas present. |
| Replay a seeded sample | Default model/settings, seed changed to **312**, **512** observations: displayed sample mean **-0.010**. Two completed runs exported byte-identical **19,159-byte CSVs**. This is displayed precision, not the exact mathematical mean. |
| Return to the observatory | Distribution window had `data-saved=true` and accessible provenance `seed 312, 512 observations`. After page reload and reopening the window, seed 312 and identical CSV remained. |
| Runtime dependencies | Zero page errors and zero external browser requests across both previews in the checked flow. |
| Port already occupied | Second main server exited nonzero with `Port 4181 is already in use`; second study server exited nonzero with `EADDRINUSE ... 127.0.0.1:4178`. |
| Browser unavailable | An explicitly nonexistent executable path produced Playwright's `executable doesn't exist` failure; both HTTP endpoints still returned 200. This simulates a missing executable; Chrome was not uninstalled. |

**Fact:** teammates can manually repeat the supported subset: open Distribution Explorer, set seed 312, choose **Run simulation**, export CSV, run again without changing any parameters, and compare the files. Return using **Orbital laboratory**, reload, then reopen Distribution Explorer. The local result should retain the seed and sample. The separate study can be opened with `/?paused=1&time=6` for a fixed decorative frame. Its readouts are explicitly synthetic fixtures ([study README](https://github.com/punyzxc/matstat-lab/blob/702d6c259a23a3b0080c0c8dabe27c95721df349/spikes/orbital-atmosphere/README.md)); they do not demonstrate completed scientific modules.

**Fact:** persistence uses browser localStorage ([source](https://github.com/punyzxc/matstat-lab/blob/702d6c259a23a3b0080c0c8dabe27c95721df349/spikes/visual-foundation/src/last-results.ts)). Scheme, hostname, and port identify its origin. Switching between `localhost` and `127.0.0.1`, changing the port, clearing site data, or using another browser profile gives different storage. This is local preview retention, not a shared research journal.

## Diagnose setup failures

**Fact (local observation):** rerunning `npm ci` while the Windows Vite server was running failed with `EPERM ... unlink ... esbuild.exe`, because its executable was in use. Stopping this audit's own Vite server and then repeating `npm ci` on Node 22.18.0 succeeded (49 packages, zero reported audit vulnerabilities); restarting Vite and rerunning the browser acceptance also passed. Stop your own dev server before reinstalling dependencies. Administrator access was not needed for this recovery.

**Fact:** `--strictPort` prevents Vite from silently selecting another port. Inspect the process before stopping anything; it may belong to another teammate or task:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 4181,4178 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
Get-Process -Id <OwningProcess>
```

**Fact (source-supported alternatives):** choose an unused lab port with `npm run dev -- --host 127.0.0.1 --port 4183 --strictPort`. For the separate study use `$env:PORT='4184'; node spikes/orbital-atmosphere/serve.mjs` in its terminal. Open the matching URL; remove the override afterward with `Remove-Item Env:PORT`. Set `LAB_URL` and `STUDY_URL` to these URLs when using this audit runner. The alternate-port recipes follow the CLI/server implementation; this audit reproduced conflicts on the documented ports rather than claiming an alternate-port browser run.

**Fact:** a regular browser is needed to view the app, but **Playwright and its browser configuration are checking dependencies**, not services required by the app. Main-preview `npm ci` installs the declared dev dependency `@playwright/test`; it does not guarantee that Chrome exists. The pinned [Playwright config](https://github.com/punyzxc/matstat-lab/blob/702d6c259a23a3b0080c0c8dabe27c95721df349/spikes/visual-foundation/playwright.config.mjs) explicitly uses channel `chrome` and port **4175**, independently of the team preview's **4181**. Installing generic Chromium alone does not satisfy that Chrome channel. If Chrome is absent, install it through your normal approved method (Playwright's `npx playwright install chrome` is one option), then rerun the browser check. A successful HTTP request alone does not prove the scene rendered.

**Fact:** the standalone study's optional checker additionally needs a resolvable Playwright module. Its [README](https://github.com/punyzxc/matstat-lab/blob/702d6c259a23a3b0080c0c8dabe27c95721df349/spikes/orbital-atmosphere/README.md) documents `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHANNEL`, and `STUDY_URL`; a module-resolution error is different from a missing Chrome executable. Neither is a requirement to run the study server. The audit runner above instead resolves the main preview's installed `@playwright/test`, avoiding a global Playwright installation.

## Position

**Fact:** the full task-worktree `crew check` reported `green: true`, **`verified: false`**: all standard web/API/acceptance steps were skipped because those product paths do not exist in Discovery. The passing browser acceptance above is a separately executed spike check; this report does not count the skipped crew steps as executed tests.

**Position:** the pinned two-preview launch is reproducible in an independent Windows clone on the stated Node minimum, with same-seed CSV replay and local result retention verified. Keep the commit pin, explicit ports, and browser/runtime distinction alongside team launch instructions. Use this report as setup evidence; scientific acceptance and Worker integration have their own tasks.

**Assumptions / remaining uncertainty:** other operating systems, browser engines, offline first installation, private-mode storage restrictions, and newer preview/main commits were not tested here. The branch name may advance. The nonexistent-executable trial verifies the failure diagnosis, not the complete experience of a machine with no browser installed. No general convergence, inference, performance, or production-readiness claim follows from these checks.
