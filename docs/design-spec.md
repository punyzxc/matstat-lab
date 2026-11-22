# STATUM LAB design specification

## Workspace

On laptop and larger viewports, use a compact lab navigation rail, a parameter panel and a data workspace. The data workspace starts with the experiment title, run state and comparison controls. Chart panels share the result revision, with a compact summary table beneath. Put lesson prompts and research notes in an adjacent tab or drawer. On narrow screens use one column with chart panels above their data tables and keep run actions reachable. For projector mode, increase chart labels and contrast, enlarge numerical summaries and collapse secondary navigation.

Use a neutral light theme with cool off-white surfaces and a neutral dark theme with deep blue-gray surfaces. Reserve series colors for data. Use a solid empirical series and a contrasting dashed theory series, with direct labels. Comparison runs have distinct marks and labels in both themes. Start with Inter for interface text and tabular figures for measurements. Define shared tokens for surface, border, text, focus, series roles, type scale, spacing and motion. Validate text contrast, chart differentiation and projected legibility in both themes during Discovery.

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
