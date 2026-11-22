---
name: crew-brief-analysis
description: Step 1 of a project - analyze the brief in docs/brief.md into docs/brief-analysis.md - demo scenario, requirements R1..Rn with priorities, constraints, stakeholder criteria (judging criteria in event mode), ambiguities, risks. Use first after receiving the brief and whenever the brief changes.
---
# Brief analysis

Input: `docs/brief.md` (the project brief / problem statement). Output: `docs/brief-analysis.md`, following the template. **Time limit: 30 minutes** - if you run out, record your assumptions and hand it in.

## Steps
1. Read `docs/brief.md` in full, including the stakeholder criteria (judging criteria in event mode) and mandatory conditions.
2. **Demo scenario first** (section 1): 3-6 steps that stakeholders (judges in event mode) will see in 3 minutes. Ask yourself: "what shows that we solved the problem better than the alternatives?". One wow moment. A fallback plan in case the live demo fails.
3. **Requirements** (section 2): each requirement in the brief is a separate row with an ID `R1, R2...`, in your own words, with a short source quote. Never reuse or renumber IDs - tasks reference them.
4. **Priorities from the demo:** a requirement on the demo path -> `must`; a brief `must` outside the demo -> `must`, but "simplified"; everything else `should`/`could`.
5. **Stakeholder criteria** (section 4; judging criteria in event mode): for each criterion, how we satisfy it and at which demo step it is visible. A criterion with no answer is a signal to change the demo.
6. **Ambiguities** (section 5): question + whom to ask + assumption. Do not wait for an answer - work from the assumption.
7. **Risks** (section 6): especially external APIs, data, deployment.
8. **Stack** (the "Stack" section at the end of the analysis): does the preset from `crew.config.json -> stack` fit (`web-node` / `web-fastapi`: React + API). One of three conclusions:
   - fits - change nothing;
   - fits with additions - which libraries inside the preset (SQLite/Postgres database, WebSocket, LLM API calls, charts) and in which area;
   - does not fit (bot, mobile, ML, game) - what is needed and why; the captain decides, before the skeleton.
   Do not invent exotic choices for the sake of "scaling": it matters more that agents know the stack and the checks are already set up.
9. If the ECC skills `product-lens`, `market-research` are available, you may use them to sanity-check the idea, within the time limit.

## Check before handing in
- [ ] A demo scenario exists, and every step has requirements R*.
- [ ] Every requirement in the brief has an ID and a priority.
- [ ] Every stakeholder criterion has a "how we satisfy it".
- [ ] Every ambiguity has an assumption.
- [ ] The "NOT doing" section is not empty.
- [ ] "Stack" section: preset fits / additions / another one needed - with a reason.

Next: the planner writes `docs/prd.md` and `docs/architecture.md` (skill crew-kickoff). If the brief changes along the way, update the analysis **without changing old IDs** (new requirements get new numbers, removed ones are marked "dropped") and tell the planner.
