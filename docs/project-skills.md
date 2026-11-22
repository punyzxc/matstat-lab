# STATUM LAB project skill specifications

These four skills extend the shared project workflow. Maintain their reviewed sources under `agents/skills/<name>/SKILL.md` through the owner and harness maintainer. After approved changes land, `crew adapters build` generates host-specific copies and `crew adapters build --check` validates the generated committed files. Verify both hosts and a fresh crew worktree on the pinned version.

## statistical-correctness

Activate for distributions, estimators, confidence intervals and numerical changes. Require a reviewed formula and parameter contract, identified exact and approximate quantities, deterministic reference fixtures from pinned NumPy/SciPy, and explicit assumptions about independence, supported domains and moments. Review instability, small n and boundary probabilities. Require analytically checkable fixtures where available, and document tolerances for the function and scale. A review records the covered domains, fixture provenance and any remaining numerical limitations.

## simulation-engineering

Activate for workers, random streams, batching, run controls and replay. Require explicit versioned seed and run settings, a stable draw order, lifecycle tests across Pause, Resume, Reset and worker errors, deterministic stream partitioning if parallelized, and stale-run message rejection. Benchmark batch cadence, cancellation latency, memory and responsiveness on the agreed classroom configuration. A review includes a replay record and lifecycle test evidence.

## scientific-dataviz

Activate for plots, comparison, export and projector mode. Require labeled units, semantically correct axes, matching histogram and theoretical scales, consistent comparison domains, and uncertainty accessible through text or table. Use shape, dash or direct labels alongside color. Verify consistency of charts and tables against a shared snapshot, mode changes, reduced motion and projector legibility. A review records expected series and numeric data for one fixture.

## pedagogical-lab-design

Activate for lessons, guided experiments and interpretation. Require a learning outcome, prediction before execution, one purposeful parameter change, an observable result, and an interpretation question that distinguishes outcomes of a single run from a repeated-sampling property. State prerequisites and method assumptions. Cite primary course material when supplied and check replay with the teacher's seed. A review identifies a plausible misconception and the observable evidence that addresses it.
