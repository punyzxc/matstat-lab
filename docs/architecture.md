# Architecture

> Step 2 of the pipeline, written together with the PRD (planner/architect). In short: one page.
> At the demo or review this is the answer to "how is it built" — keep it current.

## Diagram

```
[web: React] ──HTTP──► [api: FastAPI/Node] ──► [DB]
                              └──► [external APIs / LLM]
```

## Stack and areas

| Area (`area:*`) | Technologies | Folder |
|---|---|---|
| web | | `web/` |
| api | | `api/` |
| contracts | OpenAPI 3.1 | `contracts/` |
| e2e | Playwright | `tests/e2e/` |
| infra | hosting, CI | `infra/`, `.github/` |

## Contracts (draft)

| Method | Path | Purpose | Demo step |
|---|---|---|---|
| POST | /auth/login | | 1 |

The full version is `contracts/api.yaml` (a task with `area:contracts`).

## Data

Main entities and fields.

## Deployment

Where the running app lives, how main is deployed, who provided access.

## Decisions and why

- <decision> — <why this and not another>
