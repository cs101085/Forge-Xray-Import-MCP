# Codebase Guide for AI Agents

This is a **Node.js Forge app** that imports test definitions into Xray Cloud (Jira) via Xray's GraphQL API. See [README.md](README.md) for full deployment and setup steps.

## Architecture

Two entry points share the same core import stack:

```
src/index.js      ← CLI runner (local, file-based)
src/forge.js      ← Forge web trigger handler (HTTP, deployed)
       │
       └─► src/importer.js  ← domain logic, GraphQL mutation builder
                 │
                 ├─► src/graphql.js  ← thin GraphQL client (auth + error handling)
                 │         │
                 │         └─► src/auth.js   ← Xray token acquisition + in-memory cache
                 │
                 └─► src/config.js   ← env-driven config, fail-fast validation
```

## Key Commands

| Purpose | Command |
|---|---|
| Import tests (local) | `node src/index.js <file.json>` or `npm start <file.json>` |
| Deploy to Forge | `forge deploy` or `npm run deploy` |
| Local dev tunnel | `forge tunnel` or `npm run tunnel` |
| Help / env docs | `node src/index.js --help` |

Requires Node ≥ 18 (uses global `fetch`). For local runs, copy env vars into a `.env` file (loaded via `dotenv` in `src/index.js`).

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `XRAY_CLIENT_ID` | Yes | — | Xray Cloud API client ID |
| `XRAY_CLIENT_SECRET` | Yes | — | Xray Cloud API client secret |
| `XRAY_REGION` | No | `us` | Region: `us`, `eu`, or `au` |
| `JIRA_PROJECT_KEY` | No | — | Fallback Jira project key for all tests |

Set on Forge with `forge variables set --encrypt XRAY_CLIENT_ID <value>` (see [README.md](README.md)).

## Test Input Format

Input is a JSON array (or single object) of test definitions. See [sample-tests.json](sample-tests.json) for examples. Each test supports:
- `steps` — manual step-based test
- `unstructured` — generic/free-form test  
- `gherkin` — Cucumber/BDD test

Optional per-test fields: `projectKey`, `folderPath`, `preconditionIssueIds`.

## Critical Conventions

- **Forge handler reference**: In `manifest.yml`, the function handler must be `forge.handler` (module name without `src/`), not `src/forge.handler`. The module name maps directly to the file basename.
- **Sequential imports**: `importTests()` in `src/importer.js` imports tests one at a time (no parallel calls) — intentional to avoid rate-limit issues with the Xray API.
- **Token cache**: `src/auth.js` caches the Xray bearer token for 55 minutes. Tests running locally back-to-back reuse the cached token.

## External Services

- **Xray Cloud GraphQL API** — `https://xray.cloud.getxray.app/api/v2/graphql` (or `eu.`/`au.` subdomain)
- **Xray Cloud Auth** — `https://xray.cloud.getxray.app/api/v2/authenticate`

All three regional base URLs are explicitly allowlisted in `manifest.yml` under `permissions.external.fetch.backend`.
