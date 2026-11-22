# contracts/

The source of truth for APIs between areas (web ↔ api ↔ external services).

- `api.yaml` — OpenAPI 3.1. The architect writes it in the first hour, **before** parallel work starts.
- Types and clients are generated from the contract (e.g. `openapi-typescript` for web, pydantic models for api).
- Until the backend is ready, the frontend works against mocks from the contract (e.g. Prism: `npx @stoplight/prism-cli mock contracts/api.yaml`).
- The contract may only be changed by a separate task with the label `area:contracts` and human review.
