src/forge.js      ← Forge web trigger handler (HTTP, deployed)
       │
       └─► src/importer.js  ← domain logic, GraphQL mutation builder
                 │
                 ├─► src/graphql.js  ← thin GraphQL client (auth + error handling)
                 │         │
                 │         └─► src/auth.js   ← Xray token acquisition + in-memory cache
                 │
                 └─► src/config.js   ← env-driven config, fail-fast validation

# Codebase Guide for AI Coding Agents

This project is a **Node.js Forge app** for importing test definitions into Xray Cloud (Jira) using Xray's GraphQL API.

**For full deployment, setup, and usage instructions, always refer to [README.md](README.md).**

---

## Architecture Overview

**Entry Points:**

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

---

## Key Commands

| Purpose              | Command                                             |
|----------------------|-----------------------------------------------------|
| Import tests (local) | `node src/index.js <file.json>` or `npm start <file.json>` |
| Deploy to Forge      | `forge deploy` or `npm run deploy`                  |
| Local dev tunnel     | `forge tunnel` or `npm run tunnel`                  |
| Help / env docs      | `node src/index.js --help`                          |

**Node.js ≥ 18 required.** For local runs, copy environment variables into a `.env` file (see [README.md](README.md)).

---

## Environment Variables

| Variable             | Required | Default | Description                        |
|----------------------|----------|---------|------------------------------------|
| `XRAY_CLIENT_ID`     | Yes      | —       | Xray Cloud API client ID           |
| `XRAY_CLIENT_SECRET` | Yes      | —       | Xray Cloud API client secret       |
| `XRAY_REGION`        | No       | `us`    | Region: `us`, `eu`, or `au`        |
| `JIRA_PROJECT_KEY`   | No       | —       | Fallback Jira project key for tests|

Set these on Forge with `forge variables set --encrypt XRAY_CLIENT_ID <value>`. See [README.md](README.md) for details.

---

## Test Input Format

Test definitions must be provided as a JSON array or single object. See [sample-tests.json](sample-tests.json) for examples and [README.md](README.md) for the full field reference.

Two payload shapes are accepted and can be mixed in the same batch:
- **Flat shape** — top-level keys: `summary`, `projectKey`, `testType`, `description`, `priority`, `labels`, `fixVersions`, `linkedRequirements`, `folderPath`, `preconditionIssueIds`, `steps`, `gherkin`, `unstructured`
- **App-payload shape** — Jira-style `fields` object, `testtype`, `update.issuelinks`, `steps`

Supported test types: `Manual` (steps-based), `Generic` (unstructured), `Cucumber` (gherkin).

### Jira fields (all optional except summary + project)

| Field | Flat key | App payload key |
|---|---|---|
| Summary | `summary` | `fields.summary` |
| Project | `projectKey` | `fields.project.key` |
| Issue type | `issuetype` | `fields.issuetype` |
| Description | `description` | `fields.description` |
| Priority | `priority` | `fields.priority.name` |
| Labels | `labels` | `fields.labels` |
| Assignee | `assignee` | `fields.assignee.accountId` |
| Reporter | `reporter` | `fields.reporter.accountId` |
| Components | `components` | `fields.components` |
| Fix versions | `fixVersions` | `fields.fixVersions` |
| Affects versions | `versions` | `fields.versions` |
| Due date | `duedate` | `fields.duedate` |
| Environment | `environment` | `fields.environment` |
| Time tracking | `timetracking` | `fields.timetracking` |
| Security level | `security` | `fields.security` |
| Parent issue | `parent` | `fields.parent` |
| Linked requirements | `linkedRequirements` | `update.issuelinks[].add.outwardIssue.key` |
| Custom fields | `customfield_*` | `fields.customfield_*` |

### Step fields

Each step in the `steps` array supports: `action`, `data`, `result`, `callTestIssueId` (issue ID of a called test), `customFields` (`[{ "id": "...", "value": "..." }]`).

---


## Permissions & Linking Pitfalls

- **Forge app service account permissions:** For cross-project issue linking to work, the Forge app's service account (created automatically on install, named after the app) must have at least "Browse Projects" and "Edit Issues" permissions in all relevant Jira projects. Add it via Project Settings → People. If links fail with "issue does not exist" or "link type not found", this is the likely cause.
- **Link type name:** The link type used for requirements is hardcoded as `"Tests"` by default. If your Jira instance uses a different name, set the `XRAY_LINK_TYPE_NAME` environment variable to override it.

## Critical Conventions & Pitfalls

- **Forge handler reference:** In `manifest.yml`, the function handler must be `forge.handler` (module name without `src/`). The module name maps directly to the file basename. (Common mistake: using `src/forge.handler`.)
- **Sequential imports:** `importTests()` in `src/importer.js` processes tests one at a time (no parallel calls) to avoid Xray API rate limits.
- **Token cache:** `src/auth.js` caches the Xray bearer token for 55 minutes. Local runs back-to-back will reuse the cached token.
- **Environment variables:** For local development, ensure `.env` is present and matches the variables required above.

---

## External Services

- **Xray Cloud GraphQL API:** `https://xray.cloud.getxray.app/api/v2/graphql` (or `eu.`/`au.` subdomain)
- **Xray Cloud Auth:** `https://xray.cloud.getxray.app/api/v2/authenticate`

All three regional base URLs are allowlisted in `manifest.yml` under `permissions.external.fetch.backend`.

---

## Troubleshooting & Agent Tips

- Always check [README.md](README.md) for up-to-date deployment and usage steps.
- For test input examples, see [sample-tests.json](sample-tests.json).
- If you encounter authentication or rate-limit issues, verify environment variables and ensure imports are not parallelized.
- When updating handlers or environment variables, redeploy with `forge deploy`.
- For new conventions or changes, update this file to keep agents productive.

---

**This file is for AI coding agents. Keep it concise, actionable, and up-to-date. Link to other docs instead of duplicating content.**
