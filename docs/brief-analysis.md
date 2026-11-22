# Brief analysis

> Step 1 of the pipeline. Written by the analyst agent from `docs/brief.md` using the skill crew-brief-analysis. **Limit: 30 minutes.**
> If we run out of time, we record assumptions and move on. Section order matters: the demo comes first.

## 1. Demo scenario (3 minutes)

What stakeholders (judges in event mode) will see so that we succeed. Scope is derived from here.

| Step | What the user does | What stakeholders see | Requirements |
|---|---|---|---|
| 1 | | | R1 |
| 2 | | | R2, R3 |
| 3 | | | |

**Wow moment:** <one phrase — what will be remembered>
**Fallback plan if something does not work live:** <video / mocks / prepared data>

## 2. Requirements

IDs are stable: tasks in the PRD reference them (`req: [R1]`).

| ID | Requirement (from the brief, in your own words) | Priority | In the demo? | Source in the brief |
|---|---|---|---|---|
| R1 | | must | yes | "quote of up to 15 words" |
| R2 | | must | no | |
| R3 | | should | | |
| R4 | | could | | |

Priority rules:
- **on the demo path** → `must`, its tasks are `risk:high` and done first;
- **a brief `must` but not in the demo** → done in a simplified way (a minimal working version);
- **everything else** → `should`/`could`, as time allows; in the pitch — "planned".

## 3. Constraints

- Stack / mandatory technologies:
- Partner/sponsor APIs (do we have keys? limits?):
- Deployment and delivery format:
- Rules (AI, prebuilt code, disclosure):

## 4. Stakeholder criteria (judging criteria in event mode) → how we satisfy them

| Criterion | Weight | How we satisfy it | Where it is visible in the demo |
|---|---|---|---|
| | | | step N |

## 5. Ambiguities

| # | Question | Whom to ask | Assumption until there is an answer |
|---|---|---|---|
| Q1 | | the brief's authors / organizers | we assume that … |

## 6. Risks

| Risk | Probability | What we do if it happens |
|---|---|---|
| A partner API is unstable | | mocks + recorded responses |

## 7. What we deliberately do NOT do

-
