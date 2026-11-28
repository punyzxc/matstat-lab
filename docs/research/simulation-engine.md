# Deterministic Worker execution and convergence evidence

**Fact — scope:** this answers [Discovery task #14](https://github.com/GredesCerber/matstat-lab/issues/14), assigned to @Jumalinova after the visual handoff. The [standalone execution fixture](../../spikes/simulation-engine/) changes no product, shared contract, protected configuration or owner-managed visual component. The statistical engine and final stream/sampler selection remain with [#13](https://github.com/GredesCerber/matstat-lab/issues/13).

## Source-backed facts and implications

- **Fact:** JavaScript jobs execute to completion; worker messages and scheduled callbacks are processed through an event loop. A control message cannot interrupt the middle of the currently executing synchronous job. **Inference:** cooperative pause requires bounded work and yielding; neither the API nor a chunk label supplies a real-time latency guarantee. [MDN execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model), [HTML worker processing model](https://html.spec.whatwg.org/multipage/workers.html#run-a-worker).
- **Fact:** Worker termination discards pending tasks and stops execution; it is not a successful scientific completion or a graceful pause. [HTML termination algorithm](https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker).
- **Fact:** normal Worker messages use structured cloning; a transferred ArrayBuffer changes ownership and detaches the sender's buffer. **Inference:** transfer bounded completed arrays rather than repeatedly cloning full growing samples. [MDN Worker.postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage), [MDN transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).
- **Fact:** ECMAScript specifies `Math.log1p` using an implementation-approximated result. **Inference:** a pinned seed and sampler name do not imply universal bit-for-bit replay across different JavaScript engines or versions. [ECMAScript Math.log1p](https://tc39.es/ecma262/2024/multipage/numbers-and-dates.html#sec-math.log1p).
- **Fact:** under the i.i.d. finite-variance assumptions used here, a mean has expectation μ and variance σ²/n; LLN describes convergence of averages and CLT the asymptotic standardized sampling distribution. These are sufficient assumptions for this study, not a claim that every LLN requires finite variance. [University of Washington STAT 512 notes](https://faculty.washington.edu/yenchic/20A_stat512/Lec3_Expectation.html).
- **Fact:** the ideal Uniform(0,1) model has μ=1/2 and σ²=1/12; the rate-one Exponential model has μ=1 and σ²=1. [NIST Uniform](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3662.htm), [NIST Exponential](https://www.itl.nist.gov/div898/handbook/apr/section1/apr161.htm).

## Executable replay comparison

**Fact — implementation:** `simulation-fixture-v1` performs every draw and online reduction in a fixed replicate/index order. Work is paused only between chunks; it is never reduced by message arrival order. Its scientific result is separate from progress sequences, timing and lifecycle metadata. Each replay compares the complete canonical scientific payload, including retained arrays, histogram counts, summary, versions and spec. [Engine](../../spikes/simulation-engine/engine.mjs), [comparison runner](../../spikes/simulation-engine/evidence.mjs).

**Fact — recorded cases:** both Node and browser ran seven real-Worker comparisons: rate-one Exponential CLT at batches 1/7/2048, Uniform LLN at 7/64, and a maximum-uint32-seed CLT at 17/2048, using timeout and hybrid message scheduling. Seeds include 0, 2048 and 2³²−1. Every Worker result exactly matched the pure reference in its own runtime. This is execution replay evidence with a fixture RNG, not validation of a production PRNG. [Node data](assets/simulation-engine/node-evidence.json), [browser data](assets/simulation-engine/browser-evidence.json).

**Fact — cross-runtime limit:** comparing the seven replay payloads and four convergence payloads between Node 24.15.0 and Chrome 157.0.8103.79 examined 1,100 numeric values. Five of eleven complete payload hashes were identical; the largest absolute difference was 2.220446049250313×10⁻¹⁶ and relative difference 2.6469226970563616×10⁻¹⁶. All values met the predeclared comparator `abs(a-b) <= 1e-12 + 1e-12*max(abs(a),abs(b))`. Within the bounded integer domains, that tolerance is below one, so an unequal integer counter cannot pass. [Cross-runtime comparison](assets/simulation-engine/cross-runtime.json).

**Assumption — recommended replay promise:** exact results require the complete RunSpec, engine/RNG versions, reduction order and a supported pinned runtime. For a different runtime, use reviewed function-specific comparators; the observed bound and the provisional 1e-12 comparator do not establish a universal numerical guarantee. Cross-Firefox/Safari/ARM replay was not measured.

**Fact — scheduling scope:** these comparisons use one compute Worker per run with different chunk boundaries and task-source scheduling. They do not implement a pool of concurrently completing Workers. **Assumption:** future parallel execution must merge by replicate identity in a canonical order; indexed streams alone do not establish deterministic floating-point reduction.

### Numeric and resource limits in this fixture

| Fact: validated boundary | Value / behavior |
|---|---|
| Seed | Integer 0 through 2³²−1, inclusive |
| Total draws n×R | At most 2,000,000; integers validated before allocation |
| LLN | One trajectory, R=1; at most 64 increasing checkpoints |
| CLT | Separate replicate-indexed streams; at most 256 retained means |
| Worker chunk | At most 2048 draws; check a 4 ms deadline every 64 draws |
| Intermediate numeric representation | JavaScript Number / Float64; stable per-draw online mean and centered second moment |
| Uniform input grid | `(uint32 + 0.5)/2^32`, hence 2⁻³³ through 1−2⁻³³ |
| Exponential transform | `-Math.log1p(-u)`, finite on that grid; upper bound 33·ln(2), approximately 22.873857 |
| Variance denominator | n−1 across draws for LLN; R−1 across replicate means for CLT; null for a singleton |

**Fact — important distinction:** the grid/truncated transform is an execution fixture, not an exact continuous distribution sampler. The theoretical values below refer to the ideal named continuous model. [Request validation, fixture draw and result encoding](../../spikes/simulation-engine/engine.mjs).

## Worker lifecycle, stale messages and observed failure

**Fact — states exercised:** `idle → starting → running → pausing → paused → resuming → running → cancelled`, followed by a replacement run through `starting → running → completed`. State transitions and processed counts are retained in the eight trials per runtime. A paused run retains its bounded accumulator buffers but does no additional draws. The controller retains at most the last committed result while the next run is in progress. [Controller](../../spikes/simulation-engine/controller.mjs), [raw lifecycle traces](assets/simulation-engine/browser-evidence.json).

**Fact — policy scope:** the fixture pauses computation only on an explicit control request. It does not couple scientific execution to decorative motion, reduced motion or document visibility, and it does not implement persisted crash/unload recovery. **Assumption:** the product owner must define those behaviors separately from this execution experiment.

**Fact — stale-event gate:** a new start, cancel or disposal invalidates the prior epoch before an old event can commit. Incoming scientific messages must match the active run ID, engine version, allowed message type and an increasing safe-integer sequence. Completed/cancelled/failed states reject further scientific events. The allowlist is checked before advancing the accepted sequence, so a rejected event cannot poison later revisions. Old-run and stale-revision messages are explicitly injected after replacement completion; they do not overwrite the committed result. These injections are controlled fault tests, not a claim that native message order spontaneously changes. [Boundary tests](../../spikes/simulation-engine/boundary.test.mjs), [Worker tests](../../spikes/simulation-engine/worker.test.mjs).

**Fact — observed failed experiment:** an initial message-only scheduler allowed a 2048-draw loop to finish all 2,000,000 draws while pause was pending, and the controller subsequently timed out waiting for a paused state that could no longer occur. The preserved [baseline log](assets/simulation-engine/baseline-message-starvation.jsonl) records the failure on this workstation. A single short chunk therefore did not establish fair service of a different control-message source.

**Fact — correction:** hybrid message scheduling now yields through a timer on the first dispatch and after each group of four chunks. The controller settles a pending pause with a typed `RUN_FINISHED` outcome when completion wins the race, rather than leaving the waiter until timeout. Both failure modes were reproduced by regression tests before the corrections; they now pass. [Scheduler regressions](../../spikes/simulation-engine/scheduler.test.mjs), [Worker policy](../../spikes/simulation-engine/worker.mjs).

**Assumption — scheduling recommendation:** use explicit cooperative work budgets and periodic host-task yields instead of relying on a perpetually self-posting message source. Four chunks and 4 ms are provisional experiment settings. A real sampler may have very different per-draw cost; the reviewed production policy should be benchmarked with #13's actual kernels and classroom devices.

**Fact — cancellation policy:** the controller invalidates the old run immediately, requests cooperative cancellation, and terminates that Worker after acknowledgement. A one-second timer invokes termination if acknowledgement is missing; this is a fallback deadline request, not a guaranteed one-second response. The missing-ack test reports `acknowledged=false` and `workerRetainedBytes=null`, preserving the distinction between measured release and an unobserved old state. In Node the cancellation duration includes awaiting the terminate exit promise; in the browser it includes invoking synchronous `terminate()`. OS memory reclamation is not timed. [Controller and cancellation fallback test](../../spikes/simulation-engine/boundary.test.mjs).

## Measured response latency on named hardware

**Fact — test host and method:** Windows 11 Pro; Intel Core i5-12500H, 12 physical cores / 16 logical processors, 15.7 GiB RAM. Node 24.15.0 and headless Chrome 157.0.8103.79 ran sequentially on 2026-11-23; raw records timestamp the sessions around 16:08 UTC. Each runtime ran eight lifecycle trials over batches 1, 64, 256, 2048 and both schedulers. Every pause was requested after nonzero progress on an unfinished run. Every pause held its processed count stable for 20 ms; all measured cancels acknowledged zero retained Worker numeric bytes and invoked termination. [Node records](assets/simulation-engine/node-evidence.json), [browser records](assets/simulation-engine/browser-evidence.json).

| Fact: main-side elapsed duration, median / maximum of 8 trials | Node worker_threads | Browser module Worker |
|---|---:|---:|
| Start to running acknowledgement | 30.65 / 36.26 ms | 8.30 / 15.30 ms |
| Pause request to paused acknowledgement | 7.75 / 19.39 ms | 0.25 / 1.00 ms |
| Resume request to running acknowledgement | 0.40 / 0.50 ms | 0.25 / 0.40 ms |
| Cancel request through acknowledgement and termination call | 1.91 / 3.25 ms | 0.20 / 0.30 ms |
| Replacement start to running acknowledgement | 28.32 / 33.68 ms | 8.50 / 15.10 ms |

**Fact — responsiveness observation:** 301 main-thread 10 ms timer callbacks occurred during the browser evidence run. This establishes that the main thread continued servicing tasks during this experiment; it is not a frame-rate, input-latency or background-tab guarantee.

**Assumption — measurement limits:** the sample is small, cached/headless and taken on one laptop. Sub-millisecond browser values reflect the available clock resolution and this local setup. Scheduling, CPU contention, power state, slow transforms and hidden-tab throttling can change latency. No phone, thermal, memory-pressure or tail-latency SLA claim follows from these observations.

## Retention and memory accounting

**Fact — measured numeric buffers:** each paused large-run trial retained 576 bytes (64 Float64 means and 16 Uint32 histogram bins), independent of its draw count. The replacement result retained 312 numeric bytes (31 means plus histogram); disposal reduced controller-owned result-buffer bytes to zero in every trial. The full 4096-replicate CLT fixtures retained 256 means plus the complete histogram, 2,112 bytes. The 65,536-draw LLN fixtures retained 17 prefix counts/means, 204 bytes. No raw draw vector grows with n. [Allocation/accounting source](../../spikes/simulation-engine/engine.mjs), [raw evidence](assets/simulation-engine/node-evidence.json).

**Fact — semantics:** summaries and the CLT histogram use all repetitions, while the optional means array is the first k means, explicitly tagged `first-k-means-and-complete-summary`; it is not the entire sampling distribution or an unbiased reservoir. Result ArrayBuffers are transferred at completion, the active Worker core is cleared, and the controller requests Worker termination. History is capped at 64 metadata entries. No journal/persistence policy is implemented by this study.

**Assumption — accounting limit:** these counts are instrumented ArrayBuffer byte lengths, not JavaScript heap, process RSS, browser overhead, object/string allocation, or proof of immediate garbage collection. Keeping a previous committed result while replacing a run adds another bounded result; immediate supersession can briefly overlap terminating/starting Workers. The production design needs a total-memory budget covering those components, not just the tiny fixture arrays.

## LLN and CLT fixtures

**Fact — arithmetic distinction:** the fixed-row test uses rows `[0,1,0,1]`, `[0,0,0,1]`, `[1,1,1,0]`. Its LLN view is the first row's prefixes `[0, 1/2, 1/3, 1/2]`; its CLT input consists of the three separate complete row means `[1/2, 1/4, 3/4]`. The rational 1/3 comparison allows 1e-15 roundoff. These fixed numbers check encoding/reduction and are not themselves an empirical proof of independence or a theorem. [Arithmetic fixture test](../../spikes/simulation-engine/engine.test.mjs).

**Assumption — stream/model interpretation:** the fake counter mixer addresses each draw by seed, experiment namespace, replicate index and within-replicate index; it shares no advancing cursor across replicates. That avoids scheduling-dependent consumption, but it does not certify statistical independence of this mixer. The theoretical comparisons assume i.i.d. draws from the ideal named finite-variance model. A validated production PRNG/stream construction is still #13's responsibility.

### One LLN trajectory per model, seed 2048

| Fact: prefix n | Uniform running mean | Exponential running mean |
|---:|---:|---:|
| 1 | 0.923090469 | 2.565125470 |
| 4 | 0.440719109 | 0.915550738 |
| 16 | 0.489998135 | 0.932581937 |
| 64 | 0.493285143 | 0.984601602 |
| 256 | 0.506125716 | 1.035095729 |
| 1,024 | 0.505894382 | 1.013604922 |
| 4,096 | 0.505676747 | 1.017878888 |
| 16,384 | 0.497854853 | 0.991991526 |
| 65,536 | 0.500866811 | 1.003530810 |

**Fact — interpretation:** a trajectory can move away from μ at intermediate prefixes; these traces are illustrative finite samples. The fixture stores all 17 power-of-two checkpoints, not just the selected rows above. [Complete Node fixture output](assets/simulation-engine/node-evidence.json).

### CLT: 4096 separate replicate means, each n=32

| Fact: seed 2048 fixture | Uniform | Exponential |
|---|---:|---:|
| Ideal μ | 0.5 | 1 |
| Ideal Var(mean)=σ²/n | 0.002604166667 | 0.03125 |
| Observed mean of replicate means | 0.500440728 | 1.001163294 |
| Observed sample variance of replicate means | 0.002500900764 | 0.030991194234 |
| Absolute mean deviation in Monte Carlo SE units | 0.5527 | 0.4212 |

**Fact — predeclared diagnostic:** the runner checks the overall mean against a six-SE band with SE=`sqrt(σ²/(nR))` for CLT and `sqrt(σ²/n)` for LLN. All four fixtures passed. It records variance and complete standardized-mean histogram counts with underflow/overflow; it does not tune a variance threshold or a normality test after seeing the results. [Runner and diagnostic definition](../../spikes/simulation-engine/evidence.mjs).

**Assumption — theoretical limits:** μ and σ²/n are finite-n i.i.d. moment statements; normal shape is an asymptotic approximation, not an exact n=32 result or a universal sample-size rule. The finite grid, provisional mixer and fixed seeds mean the six-SE check is an execution-fixture diagnostic conditional on an i.i.d. ideal-model interpretation. It is not a PRNG certification, p-value, coverage guarantee or proof of LLN/CLT.

## Verification and handoff

**Fact — executed:** eleven Node tests pass, including real worker_threads execution, fixed-row arithmetic, resource/version limits, bounded numeric retention, stale events and three regressions. Seven replay cases, eight lifecycle trials and four convergence fixtures pass independently in both Node and the browser; cross-runtime comparison stays within the declared comparator. The first task commit `e006d85` contains the initial seven test cases before implementation; later regression tests reproduce the additional failures found during the experiment. [Tests](../../spikes/simulation-engine/), [reproduction instructions](../../spikes/simulation-engine/README.md).

**Fact — harness limit:** the full `crew check` remains a separate mandatory command. The repository's current Discovery preset has no product checks or `tests/acceptance/` files to execute; it does not discover spike tests. Research tests stay under the permitted `spikes/` path. A skipped preset is not evidence that product tests passed, and no protected checks were changed to include or skip this study.

| Acceptance criterion | Fact: executable evidence |
|---|---|
| Same seed/version, batch and scheduler changes, numeric limits | Seven real-Worker replay cases per runtime, canonical payload comparison, seed endpoints and version/resource tests, cross-runtime report |
| Pause, cancel, restart, stale events, memory and named-hardware latency | Eight active-run trials per runtime, lifecycle histories, stale injections, missing-ack and terminal-race tests, instrumented buffer bytes and hardware/timing table |
| Running means versus independent replicate means and theory assumptions | Fixed-row arithmetic test, complete prefix arrays and CLT mean/histogram fixtures, μ and σ²/n, explicit provisional-RNG and i.i.d./finite-variance assumptions |

## Position

**Assumption — recommendation:** adopt a versioned full RunSpec, deterministic replicate/index addressing and canonical reduction order; separate scientific snapshots from transport timing. Use a bounded Worker loop with explicit fair yielding, acknowledgement-based pause, early run invalidation on cancel/restart, terminal-state outcomes and a termination fallback. Keep bounded summaries/checkpoints and tagged retained subsets rather than unbounded raw draws.

**Assumption — unresolved production decisions:** confirm the production PRNG and stream derivation with #13; agree on request/result schemas and statistic tags, per-function cross-runtime tolerances, resumable checkpoint serialization, total-memory budgets and classroom-device latency targets. Validate failure recovery and rendering/integration separately. This report is evidence for the captain's plan, not a change to that plan or an approved public contract.
