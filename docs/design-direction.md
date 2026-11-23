# STATUM LAB design direction

**A monochrome statistical observatory centred on Earth.** Each module window is a route to an experiment and a preview of its latest completed result. Curved trajectories, anchor points and local signals join the windows to the planet. The paths carry orientation and focus feedback. A new session shows clearly identified examples, and personal snapshots update as experiments complete.

## Design system

Use black as continuous space, white for primary text, and neutral grey for structure. Use monochrome ASCII illustrations, a seeded star field and small beacons for atmospheric depth. Keep focus and active traces distinct with shape, stroke and contrast. Thin rule fragments, directional labels and measured ASCII draw on the reference archive. Combine proportional grotesque titles, the existing serif treatment for an editorial counterpoint, and tabular monospace measurements. Narrow screens keep the planet prominent and give every destination a readable hit target in logical order.

Use one motion policy for the globe, connections and result transitions. Manual pause and reduced motion keep navigation and all values available. Treat background pauses as presentation state. Tie updates to completed scientific results so an interrupted animation still settles on the stored value.

## Current iteration

[PR #9](https://github.com/punyzxc/matstat-lab/pull/9) carries the integrated prototype. Research in the seven issue workstreams can proceed independently using fixture data and separate deliverables. The design specification describes the interface boundaries. The build phase follows reviewed Discovery evidence and PRD approval.

| Issue | Research output | Area |
| --- | --- | --- |
| [#11](https://github.com/punyzxc/matstat-lab/issues/11) | Earth composition, slot and orbital projection algorithms | web · GredesCerber |
| [#12](https://github.com/punyzxc/matstat-lab/issues/12) | Compositing glyphs, stars, beacons and satellite sprites | web · Jumalinova |
| [#2](https://github.com/punyzxc/matstat-lab/issues/2) | Reusable module windows and entry states | design |
| [#4](https://github.com/punyzxc/matstat-lab/issues/4) | Result snapshot and scientific preview encodings | contracts |
| [#3](https://github.com/punyzxc/matstat-lab/issues/3) | Motion language and interruption rules | web |
| [#5](https://github.com/punyzxc/matstat-lab/issues/5) | Scientific graphics, HUD and ASCII | design |
| [#6](https://github.com/punyzxc/matstat-lab/issues/6) | Scale, usability, accessibility and performance | e2e |

[Design specification](design-spec.md) · [Reference set](references/README.md) · [Project brief](brief.md) · [Discovery plan](discovery.md) · [Initial PRD draft](prd.md)
