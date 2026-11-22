# STATUM LAB design direction

**Sci-fi instrumentation, ASCII data, and purposeful motion.** The first view opens directly into a statistical workspace. The participant can choose a distribution, set a seed, run an experiment and read the empirical results against theory.

## Design system

Use near-black for the shell, charcoal for instruments, and silver for secondary text. Reserve one icy-violet accent for selected controls and sampled data. White and dashed marks distinguish the theoretical series independently of color. Use a clear proportional face for reading and a monospace face with tabular numbers for seed, parameters, axes and telemetry. Thin rules and corner accents establish the compact scientific grid.

Separate focal roles. The entry scene uses an original particle lattice or ASCII field to suggest a density surface. The actual experiment presents a histogram, a step ECDF, and a character-based view derived from identical bin counts. Show meaningful axis units, binning and any observations beyond the visible range. Retain a textual or tabular alternative.

Use a short reveal on entry and a small change in opacity or position when swapping data views. Preserve the axis and focus while the values change. Avoid unattended, indefinite animation. Under reduced motion, render updates immediately. Keep the parameter panel and result view keyboard-operable. Narrow screens stack controls and charts. Projector mode prioritizes legibility.

## Current iteration

The first validation covers the experiment shell, reusable surfaces and controls, two numeric chart views, ASCII output, and a single seed-based research loop. Future labs are shown as upcoming within the shell. The prototype informs the final build after Discovery and the reviewed PRD.

| Issue | Parallel research |
| --- | --- |
| [#1](https://github.com/punyzxc/matstat-lab/issues/1) | Shell and runnable workspace |
| [#2](https://github.com/punyzxc/matstat-lab/issues/2) | Tokens, theme and visual states |
| [#3](https://github.com/punyzxc/matstat-lab/issues/3) | Motion patterns and reduced motion |
| [#4](https://github.com/punyzxc/matstat-lab/issues/4) | Distribution Explorer scientific encoding |
| [#5](https://github.com/punyzxc/matstat-lab/issues/5) | ASCII and particle art |
| [#6](https://github.com/punyzxc/matstat-lab/issues/6) | Keyboard, projector and responsive verification |

[Reference set](references/README.md) · [Project brief](brief.md) · [Discovery plan](discovery.md) · [Initial PRD draft](prd.md)

