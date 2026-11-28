# Independent scientific acceptance and Worker budgets

Issue: [#6](https://github.com/GredesCerber/matstat-lab/issues/6). Owner: `adekin06` (`area:e2e`). Research budget: 3 hours. Recorded: 2026-11-23.

## Scope and evidence status

This answers the current issue title and all three acceptance criteria; the historical filename does not make this a visual redesign. It proposes independently verifiable scientific inputs, bounded Worker tests, and saved/exported-result checks. It changes no product code, production contract, PRD, or CI configuration.

**Facts observed on this checkout:** base `d8715b6` has scaffold documents, no production schema, no web package, and no scientific implementation. `crew.config.json` is in discovery. The committed Actions workflows run `crew adapters build --check`, a full `crew check`, compliance, and a separate `crew-guard`. Context7 and Playwright MCP are disabled. There is no completed product whose speed or scientific accuracy can be certified here.

**Executed evidence:** the disposable [reference fixtures](../../spikes/visual-accessibility/reference.json) contain ten analytical cases and two seeded eight-word RNG vectors. Their [Python generator](../../spikes/visual-accessibility/generate_reference.py) has no application or third-party imports. The [five Node checks](../../spikes/visual-accessibility/reference.test.mjs) test numerical anchors, RNG mapping, provenance, and typed-equality mutation sensitivity. These establish independent inputs and an oracle specimen, **not passing product acceptance tests**.

**Assumptions/proposals:** every budget and future test below is a recommendation for the captain and area owners, not an already approved architecture or measured performance claim. Use temporary fixtures until the scientific and persistence contracts land. Copying spike code into the product is not an implementation plan; build-phase tests must be written in the approved task and location.

## AC1: independent scientific inputs

### Versions and reproduction

The generator was executed with CPython **3.12.14**, standard-library `math` and `statistics`, on Windows x64. SciPy and NumPy are **not installed or executed**; their metadata are explicitly `null`. Analytical identities satisfy the issue's “SciPy or analytical” option. Distribution mappings below were cross-checked against the SciPy **1.18.0** documentation retrieved on 2026-11-23, not against a claimed SciPy run.

Run from the repository root with the recorded Python interpreter:

```text
python spikes/visual-accessibility/generate_reference.py --check
node --test spikes/visual-accessibility/reference.test.mjs
```

`--check` compares the checked-in output without rewriting it. Generating anew requires omitting `--check` and reviewing all numerical/provenance changes. The generator records its actual Python version. Last-bit libm differences on another OS require review against the declared tolerance; do not casually regenerate the golden file to fit a failing implementation. Do not generate expected values with the production library, RNG, codec, or Worker.

### Parameter mappings

| Lab meaning | Independent reference convention | Domain/boundary checks to require |
|---|---|---|
| Uniform endpoints `a,b` | `uniform(loc=a, scale=b-a)` | Finite `a < b`; CDF below/at/above each endpoint. Compare PDF on the interior; endpoint density conventions do not affect probability. |
| Normal mean `mu`, standard deviation `sigma` | `norm(loc=mu, scale=sigma)` | Finite `sigma > 0`; never pass variance as scale. Reject nonfinite inputs. |
| Exponential rate `lambda` | `expon(loc=0, scale=1/lambda)` | Finite `lambda > 0`; negative x has CDF 0; x=0 has CDF 0. |
| Binomial trials `n`, probability `p` | `binom(n=n,p=p,loc=0)` | Integer `n >= 0`, `0 <= p <= 1`; integer support 0..n; degenerate p=0/1; CDF uses floor(k), PMF is zero off the integer support. |
| Poisson intensity `lambda` | `poisson(mu=lambda,loc=0)` | Finite `lambda >= 0`; lambda=0 is mass at zero; integer support, negative-k CDF 0. |
| Sample variance | `sum((xi-mean)^2)/(n-1)` | `n>=2`, explicitly `ddof=1`; population variance uses n. Empty, one-item and constant samples need declared outcomes, not accidental NaN. |
| One-sample t, two-sided | `ttest_1samp(sample,popmean=mu0,alternative='two-sided')` | `df=n-1`, statistic `(mean-mu0)/(s/sqrt(n))`; mean CI uses Student-t, not z. Constant samples are a defined error/degenerate status. |

Sources: SciPy [uniform](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.uniform.html), [normal](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norm.html), [exponential](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.expon.html), [binomial](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binom.html), [Poisson](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.poisson.html), [one-sample t](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_1samp.html). The proposed app rejection policies are stricter contract choices, not claims that every reference library rejects identical inputs.

### Committed cases and tolerances

Compare finite scalars with `abs(actual-reference) <= atol + rtol*abs(reference)`. Default: `atol=1e-12`, `rtol=1e-10`, unrounded internal values. Counts, degrees of freedom, integer RNG words, schema versions and array lengths require exact equality. Presentation rounding is tested separately. Never round reference and result to the same displayed digits before comparing.

| Fixture ID | Input | Independent expected anchor |
|---|---|---|
| `uniform-shifted` | a=2,b=6,x=3 | PDF=0.25, CDF=0.25 |
| `normal-shifted` | mu=10,sigma=4,x=10 | PDF=0.09973557010035818, CDF=0.5 |
| `normal-central-95` | mu=0,sigma=1,alpha=0.05 | q(.975)=1.9599639845400536 |
| `normal-right-tail-eight` | standard normal,x=8 | SF=6.220960574271819e-16; `atol=1e-28`, `rtol=1e-10` |
| `exponential-rate-two` | rate=2,x=1 | CDF=0.8646647167633873, mean=0.5, variance=0.25 |
| `binomial-ten-quarter` | n=10,p=.25,k=3 | PMF=0.25028228759765625, CDF=0.7758750915527344 |
| `poisson-two` | rate=2,k=3 | PMF=0.1804470443154836, CDF=0.8571234604985472 |
| `summary-five` | [1,2,3,4,5] | mean=3, population variance=2, sample variance=2.5 |
| `t-df-one` | [0,2],mu0=0 | df=1,t=1,p(two-sided)=0.5, 95% mean CI=[-11.706204736174696,13.706204736174696] |
| `t-df-four` | [1,2,3,4,5],mu0=0 | df=4,t=4.242640687119285,p=0.013235599563682587, CI=[1.0367568385224428,4.963243161477557] |

The two t oracles use closed-form CDFs. For df=1, the Cauchy quantile is `tan(pi*(p-.5))`; for df=4, `F(t)=.5+(3s-s^3)/4`, `s=t/sqrt(t^2+4)`, then bisection for q(.975). Small PMF/CDF cases use elementary finite sums. The tail case uses `erfc(x/sqrt(2))/2` to avoid `1-cdf` cancellation. CPython documents [`NormalDist`, variance and related functions](https://docs.python.org/3.12/library/statistics.html). These few anchors do not validate every possible distribution, tail or sample size.

Add independent cases for both CI endpoints, p exactly at/around alpha, one-sided alternatives, and every later approved method before that method can ship. For future extreme tails compare log-SF with a separately justified tolerance rather than loosening a global tolerance until tests pass.

### Reproducible RNG vectors

Temporary algorithm ID: `xorshift32-13-17-5/open-midpoint-v1`. This is an **oracle protocol specimen**, not a recommendation to standardize the production RNG or evidence of statistical quality. The xorshift family originates in [Marsaglia, 2003](https://www.jstatsoft.org/article/view/v008i14). The recurrence and uniform mapping are explicit here so another implementation can reproduce it:

```text
state = unsigned32(nonzero seed)
state ^= (state << 13) & 0xffffffff
state ^= state >> 17                 # logical unsigned right shift
state ^= (state << 5) & 0xffffffff
state &= 0xffffffff
u = (state + 0.5) / 4294967296       # strictly 0 < u < 1
```

Seed 1, first five words: `270369,67634689,2647435461,307599695,2398689233`. The JSON records eight words and exact binary64 uniforms for seeds 1 and 4294967295. Its proposed zero-seed policy is rejection; this generator has no public seed-input API and does not test product input validation. Test seeds 0,1,2^32-1, negative, fractional, blank and out-of-range inputs against the eventual contract; never silently invent a seed during replay.

Raw integer vectors compare exactly. Do not compare JS samples to `scipy.stats.*.rvs(seed=...)`: identical seeds in different RNGs/transforms do not promise identical samples. Once the owner selects the RNG, freeze its ID/version, integer seed encoding, reset/state semantics, transform ID/version, uniform interval and consumption order (including cached normals), then add independent vectors for that exact protocol. Test replay across Worker chunk sizes and schedules: changing chunk boundaries must not change scientific output. Math transforms use the stated tolerance; raw words remain exact. Never use `Math.random()` as the deterministic test input.

### LLN/CLT and statistical quality

Do not assert that absolute sample-mean error decreases at every n or that every run's nominal 95% CI contains the true mean. Both create scientifically false/flaky gates. For LLN views check seeded prefix sums against a separate high-precision/compensated reference; for CLT views check the explicit normalization `(sum-n*mu)/(sigma*sqrt(n))` on fixed arrays and degenerate-variance errors. These are deterministic arithmetic/formula tests: they do **not** demonstrate LLN convergence or a CLT distribution, and a broken sampler could pass them. Separately collect convergence and distribution diagnostics with predeclared seeds, sample sizes, summary statistics and thresholds. For a binomial quality audit include a predeclared significance threshold with multiple-comparison handling. Keep these diagnostics separate from deterministic PR correctness gates; do not keep reseeding until a p-value passes.

## AC2: Worker, responsiveness and retained-data budgets

### Named baseline and measurement protocol

**B1-local candidate:** Windows x64 build 10.0.28000, Intel Core i5-13420H, 12 logical CPUs, 16 GiB RAM; Node 26.13.1; available Playwright **1.62.1**; installed Microsoft Edge **158.0.4370.33**. Hardware/runtime versions were observed, but **no browser/product performance measurement was executed**. This is the named environment for initial calibration, not a portable hardware guarantee. Run the production preview (not Vite dev), 1280x800 viewport, headless Edge, one browser/test worker, AC power, no tracing or video during timing, no CPU throttling, and no other workloads. Record exact commit, OS, CPU, RAM, node, lockfile, Playwright/browser versions and power settings with results.

Proposed post-calibration CI baseline **B2-ci**: dedicated Linux x64 runner, Ubuntu 24.04, 4 vCPU, 8 GiB RAM, Node 22.x pinned to an exact patch in the approved lock/toolchain record; Playwright 1.62.1 with its matching Chromium installed by that version. Record browser version and runner image each run. B2 has not been provisioned or measured. `ubuntu-latest` on a shared runner is not a stable hardware performance baseline. Semantic lifecycle and data-size assertions run on ordinary CI; strict timing requires a named calibrated runner. Do not change protected CI from this task.

Timing budgets below are **initial hypotheses** for B1. Before making them mandatory, the e2e and engine owners run one warm-up and five fresh-page repetitions per scenario, store every measurement, and inspect outliers; report the maximum and median of the five. Do not claim a five-run p95. No retries may convert a performance failure into a pass. Capture an untimed trace after failure for diagnosis. Cross-browser semantic tests include Firefox/WebKit when provisioned; do not apply Edge heap diagnostics as universal browser assertions.

### Concrete proposed scenarios

| Test ID | Workload and action | Required observable assertions / initial B1 timing budget |
|---|---|---|
| `W-small` | N=10,000, fixed seed; complete | One accepted terminal result, exact processed count, fixtures/replay agreement; finite progress is monotone in [0,1]. Finish <=2 s after accepted start. |
| `W-big` | N=1,000,000 continuous draws; interact during computation | Real Worker start observed; DOM input/keyboard feedback <=100 ms; a 20 ms main-thread heartbeat's maximum lateness <=100 ms over >=20 ticks; complete <=10 s. Assert each separately, not just Playwright's overall timeout. |
| `W-cancel` | N=10,000,000 (summary-only), cancel after first progress event | Cancel visible <=100 ms; Worker `close` observed <=500 ms; no accepted later progress/result for cancelled ID; idle within 1 s. Observe for another 1 s and inject queued late events deterministically in unit tests. A run must still be active when cancellation is sent. |
| `W-overlap` | Start A (large), wait for first progress, then start B (small, different seed) | A disposed, B's ID/parameters/output are the only accepted state. Inject A progress/result/error after B begins and after B completes: zero visible/store/history/download mutation; B result equals its independent reference. |
| `W-repeat` | 20 start/cancel or complete cycles; navigate away/back | At most one live compute Worker, return to zero within 500 ms of each terminal/dispose; no growing listeners, object URLs, timers or retained input/result buffers. No unhandled error/rejection. |
| `W-error` | Simulated Worker startup error, `error`, `messageerror`, malformed payload | Visible recoverable error, owned buffers/references cleared, no partial “completed” record, new run succeeds. No unhandled page error and no stale-run error replacing a successful B. |

Run all workloads with valid contract parameters. A max-size request above the accepted N limit must be rejected **before allocation** with a visible error; never assume the product permits N=10,000,000. If that is outside its contract, use a deterministic slow-test Worker for cancellation/overlap and test the real maximum separately. Default Playwright test timeout proposal: 30 s small, 60 s big/repeated; assertion timeout 2 s, except the explicit smaller budgets measured with monotonic page timestamps. These broad test timeouts are deadlock guards, not the performance thresholds.

### Peak retained data and accounting

Proposed bounds for a single active result at N=1,000,000:

- Raw binary64 sample payload <=8,000,000 bytes. Streaming-only runs retain no full sample. The contract must explicitly distinguish full-sample and summary-only results; no silent truncation.
- A transfer chunk <=65,536 values (524,288 bytes), with at most two outstanding chunks (1,048,576 bytes); require credit/ack backpressure. Histogram <=512 bins, plot/ASCII preview <=2,000 values, convergence series <=2,000 points. Scientific summaries use all N, never just the preview.
- **Peak app-owned retained numerical data <=16 MiB across main and Worker**, counting each live ArrayBuffer once, queued messages, previews, histogram arrays, cached results and serialization staging. Peak must be tracked across the run, not sampled only after completion. Object/JSON overhead is not included in that number and must be measured separately. Export streaming may have at most two bounded chunks; a giant JSON string plus duplicated arrays is not “free”.
- After cancel/dispose: zero active-run-owned buffers and listeners in the ownership ledger, allowing an explicitly retained completed result/history item only if it is a different record. Budget one in-memory completed raw result; older journal entries load from storage on demand. Do not retain all historical samples in React state. This caching policy needs the persistence owner's agreement.

Test instrumentation must allocate/register/transfer/release with byte counts and record the peak, including receiver adoption; transfer does not free the receiver's memory. Combine the ledger with Chromium heap/retainer inspection as a diagnostic (look for detached views still held in closures, chart copies and duplicate JSON arrays). A self-reported counter alone does not prove absence of leaks. Browser RSS, `performance.memory`, and nondeterministic GC are not cross-browser scientific pass/fail oracles. Record whole-process/heap trends after 20 cycles as diagnostic evidence; do not assert immediate RSS shrinkage after `terminate()`.

### Cancellation and stale-event oracle

The [HTML Worker standard](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate) defines immediate termination, not a guaranteed final result/cleanup acknowledgment. A cancellation message cannot interrupt an uninterrupted synchronous Worker loop; chunk/yield cooperatively or terminate from the main thread. In unit tests use controlled message delivery, not arbitrary sleeps.

Proposed envelope fields: session ID, unique run ID, sequence, kind, payload. Session/run generation belongs to the owner; IDs must not be reused across reset/reload. For the active generation accept only valid ordered messages in running state; after terminal state, cancellation, replacement or unmount reject every old/duplicate/malformed event. If sequence gaps are permitted for throttled progress, specify that explicitly; do not confuse an allowed gap with an out-of-order event. Assert exactly one terminal transition and no later writes to samples, summary, plot, journal, live announcement or export selection. Abort listeners and revoke object URLs on every disposal path.

[Structured-transfer rules](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializewithtransfer) explain why sender and receiver need separate ownership assertions: after transferring an ArrayBuffer the sender is detached (`byteLength===0`) while the receiver has the original bytes. Test contents/type/length at receipt; termination alone proves neither buffer release nor rejection of already queued callbacks. Use Playwright's [Worker lifecycle](https://playwright.dev/docs/api/class-worker) for real workers and a deterministic injected harness for adversarial event order. Real-worker tests and reducer fakes complement each other.

## AC3: persistence/export across reload

### Temporary typed witness and independent equality

Until #4's production contract lands, propose a test-only `ReferenceSnapshotV1`: `schemaVersion`, experiment kind/parameters, seed text and RNG/transform versions, processed N, completion status, full-precision numerical result (or explicit summary-only encoding), and stable provenance. Volatile UI timestamps, progress and Worker IDs are outside this scientific record; exclusion must be an explicit allowlist, not “ignore every differing field”. Do not invent production fields or change `contracts/` in this task.

Keep expected records in immutable, manually reviewed fixtures generated outside the app. For each saved/exported record:

1. Validate the independently written test schema at the boundary; reject wrong types, unknown versions and invalid domains. A TypeScript `as ReferenceSnapshotV1` cast is not validation.
2. Compare exact field presence/key sets (key order irrelevant), primitive types, nesting, array order/length, enums, seed/algorithm IDs and integer counts. Test a nested numeric value where the string form differs (`2` vs `"2"`) and adjacent binary64 values (`1` vs `1.0000000000000002`).
3. Compare every finite stored number with `Object.is` after decoding to the contract type. Storage/export is an identity check and does **not** use the scientific-computation tolerance. For binary payloads verify element type/endian/version, byte length and all values. If -0 is meaningful, encode its sign; otherwise explicitly normalize it at the contract boundary and use normalized expected values. The temporary witness rejects unsupported nonfinite numbers.
4. For small golden records compare the complete result. For a large streamed export independently parse each typed element, check order/count and a digest over a specified canonical binary representation; derive the expected digest from independent input. Do not compare app-produced checksum with itself or use JSON.stringify string equality. A hash of rounded display text is not a scientific digest.

The discovery equality specimen has mutation tests that reject changed version/seed types, reordered or rounded values, null substitution, extra/missing nested keys and cancelled status. It intentionally demonstrates detection of JSON loss for NaN, Infinity, -0 and undefined; it is not a production codec. [ECMA-262 JSON serialization](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify) specifies the conversion behavior. Prefer finite JSON numbers, decimal strings for seeds/integers above the safe integer range, and explicit error/degenerate statuses. Dates, Maps and typed arrays do not acquire a portable application schema merely by using JSON.

### Browser acceptance sequence

| Test ID | Given / When | Independent expected result |
|---|---|---|
| `P-roundtrip` | Complete a fixed seeded experiment; save; wait for committed storage transaction; reload same origin/context; open record | Typed record equals frozen fixture, same scientific output/seed/versions; UI reflects stored full precision; no Worker recomputation used as the equality oracle. |
| `P-offline-reload` | Saved result; block external network; reload and reopen | Local scientific record loads unchanged, or explicit unsupported/offline state if contract requires network. No fabricated replacement result. Choose the behavior when architecture is approved. |
| `P-export` | Select the saved record after reload; trigger JSON/CSV download | Register download wait **before** click, await completion, read actual bytes using a parser independent of the app, compare typed values/provenance. Filename alone or download event alone is insufficient. |
| `P-csv` | Known decimals, scientific notation, quotes, commas, newline, Unicode label | Explicit delimiter/quote/UTF-8/decimal-dot policy and header/order match; round-trip numbers unrounded. If CSV cannot encode the whole snapshot, label it a sample/summary export and require a metadata companion or JSON for replay. Protect spreadsheet text fields from formula execution under an agreed policy. |
| `P-storage-errors` | Quota exceeded, unavailable storage, aborted transaction or invalid stored JSON | Visible actionable failure; no false “saved”; existing good record unchanged; reload never turns partial/cancelled data into complete. |
| `P-import-errors` | If import is in approved scope: truncated/oversized file, missing/extra keys, wrong number types, nonfinite or unsafe integer coercion, unknown/newer version, corrupt digest | Atomic rejection before replacement/allocation; stable error; old good record preserved. Migration only for explicitly supported versions with independent before/after fixtures. |
| `P-race` | Save/export selected completed A while B starts or finishes; cancel or reload during write | Bound to the selected immutable snapshot, not “whatever active result is now”; last committed complete record preserved, partial transaction absent. |

The [Playwright Download API](https://playwright.dev/docs/api/class-download) distinguishes download start from successful completion; preserve bytes before closing the browser context. For IndexedDB wait for transaction completion, not just a single request success. For JSON use a strict test schema plus recursive typed equality; CSV needs a separate standards-aware parser, not the exporter's own reader. Do not implement import, migrations or a new database merely to complete this research task.

## Required checks and handoff

Proposed future Vitest cases (owned by e2e/scientific acceptance tasks): all AC1 fixtures + support/domain/degenerate cases; versioned RNG/transform replay; LLN/CLT fixed-array identities; exact typed snapshot comparison and mutation cases; Worker state-machine reorder/duplicate/cancel/error tests; transfer ownership and allocation-limit tests. Use [`toStrictEqual`](https://vitest.dev/api/expect.html#tostrictequal) or explicit recursive assertions for structure and a custom absolute/relative predicate for scientific numbers. A UI snapshot cannot replace a scientific expected value.

Proposed future Playwright cases: `W-small`, `W-big`, `W-cancel`, `W-overlap`, `W-repeat`, `W-error`, and applicable `P-*` cases above against built preview. Assert DOM-visible state and accessible keyboard feedback; real Worker close/result suppression; actual persisted and downloaded values. No `waitForTimeout`-based synchronization, no caught test errors, no snapshot updates merely to accept a regression. Configure zero retries for the dedicated calibrated timing job; retries in diagnostic jobs must retain/report the original failure ([Playwright retries](https://playwright.dev/docs/test-retries)).

**Existing required Actions contexts:** `check` and `crew-guard`, as documented by the committed workflows; verify actual branch protection through crew rather than setting it here. Full `crew check` was executed for this research and returned `status: warning`, `green: true`, `verified: false`: there is no web/api package or executable acceptance test, so every configured step was skipped. The five standalone Node checks and Python regeneration check passed separately. This is not proof that Vitest/Playwright or scientific acceptance ran. Future build tasks must wire actual Vitest/Playwright commands and browser installation through the authorized harness/infra path, with lockfiles and exact runtime versions, failure artifacts and an explicit zero-test failure. Do not rely on `--if-present` as evidence of a test that does not exist. The independent fixture check can be a separate approved check with pinned Python; do not regenerate golden fixtures in CI.

### Acceptance evidence map

| Issue criterion | Reviewable evidence in this task | Still required in build phase |
|---|---|---|
| Independent cases, versions, parameters, tolerances, RNG | AC1 tables; `reference.json`; no-dependency Python generator; numerical/RNG/provenance checks | Adapter from approved engine/contract to these independent inputs; wider method/tail coverage |
| Big/cancel/overlap budgets and named environment | AC2 B1/B2 definitions, timings, exact retained-byte bounds, disposal and stale-event assertions | Measured calibration and real-worker/browser acceptance on the product |
| Typed equality, errors, required checks across reload/export | AC3 oracle specimen, mutation checks, `P-*` matrix and Actions/Vitest/Playwright handoff | Production-schema conformance, real storage/download checks and authorized CI wiring |

## Position and open questions

Recommend deterministic independent fixtures plus event-order/ownership assertions as mandatory correctness gates, and calibrated performance measurement as a separate gate. Freeze scientific and serialization semantics before building visual polish. Preserve full-precision results and seed/RNG/transform provenance; cap preview and in-flight data explicitly. Prefer a single active compute Worker with immutable completed snapshots for the first implementation, subject to the engine owner's design.

Unresolved for owners/captain: the production RNG/transform and seed semantics; max N and full-sample vs summary-only modes; persistence schema/migration versions and export formats (#4); the calibrated runner and final budget approval; minimum browser/hardware support; whether import/offline behavior is in scope. Current assumptions are written above so they can be accepted or replaced without blocking independent fixture preparation. This document is a proposal; it does not approve the PRD, change the common plan or certify an unbuilt app.
