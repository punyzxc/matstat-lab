# STATUM LAB design specification

## Workspace

Distribution Explorer puts parameters alongside a chart on large screens and in one column on small screens. Projector mode increases chart area. Annotate partial runs and preserve scale as the experiment progresses. Encode empirical observations with solid marks and theoretical curves with dashed lines. Preserve axis values and provide accessible numeric alternatives. The shared type system uses Space Grotesk, Instrument Serif italic and IBM Plex Mono. [Current design direction](design-direction.md) · [Prototype and visual review](https://github.com/punyzxc/matstat-lab/pull/9)

## Orbital home

The point-cloud Earth is the central scene. Each visible module links a declared globe or orbit anchor to a window in the layout. Links and HUD accents use neutral grey. Use varied monochrome ASCII figures in the surrounding scene and small star, beacon and satellite layers. Document where a simulated object may travel, and keep interactive windows, the globe controls, and scientific readouts clear in all viewport modes. A static SVG layer provides structure when motion is paused. Use fragment frames, measured coordinates, and optional scientific annotations in the same vocabulary as the archived references.

A module window is one semantic link. Its name, summary, provenance and destination are readable at rest, including keyboard focus. Promote saved results as the latest use and label a deterministic default as an example. A preview displays the state from that module's completed run. A model change, draft, or background animation does not save a result. Resume the saved settings when the user opens a module. Compact view keeps Earth first, follows with the same logical link order, and simplifies routes to a readable spine.

### Interfaces and ownership

| Primitive | Responsibility |
| --- | --- |
| Module registry | Stable ID, route, title, scientific preview kind and anchor slot. Adding an entry does not modify the window renderer or persistence logic. |
| Layout and link layer | Derive routes from screen coordinates and registered anchors. Own static traces, active connection and fallback position. Keep decorative SVG out of keyboard navigation. |
| Window presentation | Semantic link, label, accessible summary, state affordances and miniature chart viewport. Render a typed preview without computing a simulation. |
| Result snapshot | Completed settings, module ID and method parameters such as the analyzed prefix. Resolve personal, demo or unavailable independently for each module. |
| Preview adapter | Compute exact values and stable series from a snapshot before rendering. Supply an accessible summary and mark theoretical references separately. |
| Motion policy | Shared rotation, signal, graph reveal and numeric transition timing. Pause or stop decoration when hidden and honor reduced motion. |
| Atmosphere renderer | Composite projected decor and ASCII assets with shared pause and visibility rules. Keep variants, density and layering adjustable without changing scene geometry. |

For the browser-only build, keep a versioned local schema. Validate model, seed, sample count, scenario settings and schema version before replaying. Scope records by module so unrelated runs cannot overwrite each other. Store bounded parameters or bounded aggregates, rather than saving every animated frame. An unsupported or corrupt saved record falls back to a clearly labeled example. Decide versioning of the simulation algorithm before promising that seeds replay across releases.

### Scientific previews

| Module | Evidence visible before entry |
| --- | --- |
| Distribution Explorer | Binned result and sample size with an explicit histogram encoding. |
| Convergence | Running mean against observation count with theoretical mean as reference. |
| Estimation | Estimate and the explicitly named standard error or estimator quantity. |
| Confidence Intervals | Interval endpoints, method, nominal coverage and observed center. |
| Hypothesis Testing | Test statistic or p-value, test model, threshold and the corresponding decision. |
| Randomness | Sign or run sequence for the recorded sample and its run count. |

The prototype can demonstrate all six module windows using documented demo inputs. Under the current release brief, Distribution Explorer is the first fully supported laboratory. Confirm the later milestones in the PRD. Check end-to-end navigation and result persistence before integrating motion refinements. Validate the larger registry against real labels, narrow touch targets and classroom projector sizes before making additional nodes visible by default.

## Components

| Component | Behavior and evidence |
| --- | --- |
| Experiment navigation | Current lab and visible page title, logical focus order, keyboard access. |
| Parameter form | Labeled distribution, parameter units, sample size, repetitions, and seed. Preserve draft settings while displaying the settings associated with the selected result. Show field errors and accepted ranges near the fields. |
| Simulation controls | Start, pause, resume and reset track the worker's acknowledged state. Show completed repetitions and announce key state changes via a polite live region. Keyboard focus stays on the initiating control where possible. |
| Chart panel | Axis labels and units, text summary, visible legend, accessible values table, export state. All critical information is reachable without hover. |
| Run comparison | Pin two runs, display their independent settings and keep comparable axes and bins aligned. Label independently scaled views when comparison on one scale lacks meaning. |
| Journal | Access prior runs and notes, replay with recorded settings, export retained data, confirm destructive deletion and show storage errors. |
| Lesson panel | Introduce a question, invite a prediction, guide a small and larger trial, and close with an interpretation prompt and assumptions. |

## Scientific graphics and motion

- Normalize histograms and model overlays to a matching scale. Distinguish counts, probability mass and density. Show empirical CDFs as step functions and include enough information to reproduce binning.
- Render uncertainty with numeric labels and a textual equivalent. For coverage, show the number of successful intervals and repetitions with the observed proportion, nominal level and method.
- Update charts from the same snapshot. Keep axes stable during a run unless the user requests another viewport or the chart clearly reports a domain change. Animate meaningful data updates with short interruptible transitions. Reduced-motion mode renders the new state without positional interpolation.
- Use shadcn primitives for form fields, dialogs, tabs and popovers after checking up-to-date component APIs. ECharts handles most charts. D3 is available for specialized visual encodings after Discovery validates a need. Use KaTeX for formulas with readable text equivalents.

## Design acceptance

Check a keyboard-only run from configuration to export, focus return from dialogs, meaningful chart tables, identical values in reduced-motion mode, and visible errors for invalid inputs and storage failure. Inspect two-run comparison on narrow and laptop sizes and at the classroom projector's scaling. Review data semantics and motion behavior together. [Web Interface Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) · [shadcn/ui](https://ui.shadcn.com/) · [Emil Design Engineering](https://github.com/emilkowalski/skills) · [Scientific Visualization](https://github.com/K-Dense-AI/scientific-agent-skills/tree/main/skills/scientific-visualization)
