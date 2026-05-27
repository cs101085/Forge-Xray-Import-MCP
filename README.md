# Forge-Xray-Import-MCP

MCP importer tool for Xray built on Forge.

## Deploy

1. Register your app (first time only; this replaces `REPLACE_WITH_YOUR_APP_ID` in `manifest.yml`):

  ```powershell
  forge register
  ```

2. Set encrypted environment variables:

  ```powershell
  forge variables set --encrypt XRAY_CLIENT_ID <your-client-id>
  forge variables set --encrypt XRAY_CLIENT_SECRET <your-client-secret>
  forge variables set XRAY_REGION us
  forge variables set JIRA_PROJECT_KEY COMPTEST
  ```

3. Deploy:

  ```powershell
  forge deploy
  ```

4. Install on your Jira site:

  ```powershell
  forge install -s your-site.atlassian.net -p jira
  ```

5. Generate the web trigger URL:

  ```powershell
  forge webtrigger create --functionKey xray-import-trigger
  ```

Then POST your JSON tests to the generated URL:

```powershell
curl -X POST "https://5ed8d793-1ca2-4c0c-89a4-eb0aa54d06fb.webtrigger.atlassian.app/public/X5R6XyKfkEyB5FNeN_kGQqro0cM" `
  -H "Content-Type: application/json" `
  --data-binary "@sample-tests.json"
```

---

## Test Input Format

Send a JSON array (or a single object) where each item represents one test. Two shapes are accepted and can be mixed in the same batch.

### Flat shape (simple)

```json
{
  "summary": "Login with valid credentials",
  "projectKey": "COMPTEST",
  "testType": "Manual",
  "description": "Verify login works",
  "priority": "High",
  "labels": ["smoke"],
  "folderPath": "/Regression",
  "steps": [
    { "action": "Navigate to login", "data": "", "result": "Login page shown" }
  ]
}
```

### App-payload shape (Jira-style `fields` object)

```json
{
  "testtype": "Manual",
  "fields": {
    "summary": "Login with valid credentials",
    "project": { "key": "COMPTEST" },
    "issuetype": { "name": "Test" },
    "description": "Verify login works",
    "priority": { "name": "High" },
    "labels": ["smoke"],
    "assignee": { "accountId": "5b109f2e9729b51b54dc274d" },
    "reporter": { "accountId": "5b10a2844c20165700ede21g" },
    "components": [{ "name": "Backend" }],
    "fixVersions": [{ "name": "1.0" }],
    "versions": [{ "name": "0.9" }],
    "duedate": "2026-12-31",
    "environment": "Staging",
    "timetracking": { "originalEstimate": "2h", "remainingEstimate": "1h" },
    "security": { "id": "10001" },
    "parent": { "key": "PROJ-1" },
    "customfield_10001": "custom-value",
    "customfield_10002": { "value": "option-a" }
  },
  "update": {
    "issuelinks": [{ "add": { "outwardIssue": { "key": "REQ-42" } } }]
  },
  "steps": [
    {
      "action": "Navigate to login",
      "data": "",
      "result": "Login page shown",
      "callTestIssueId": "PROJ-99",
      "customFields": [{ "id": "step-field-1", "value": "step-val" }]
    }
  ],
  "folderPath": "/Regression",
  "preconditionIssueIds": ["12345"],
  "gherkin": "",
  "unstructured": ""
}
```

### Supported fields reference

#### Xray-level fields

| Field | Both shapes | Description |
|---|---|---|
| `testType` / `testtype` | flat / app | Test type: `Manual`, `Generic`, `Cucumber` (default: `Manual`) |
| `steps` | both | Array of step objects (Manual tests) |
| `steps[].action` | — | Step action text |
| `steps[].data` | — | Step data/input text |
| `steps[].result` | — | Expected result text |
| `steps[].callTestIssueId` | — | Issue ID of a test to call from this step |
| `steps[].customFields` | — | `[{ "id": "...", "value": "..." }]` — Xray custom step fields |
| `gherkin` | flat only | Gherkin/Cucumber scenario text (Cucumber tests) |
| `unstructured` | flat only | Free-form definition (Generic tests) |
| `folderPath` | flat only | Xray test repository folder path, e.g. `/Folder/Subfolder` |
| `preconditionIssueIds` | flat only | Array of Xray precondition issue IDs |

#### Jira fields (inside `fields` for app shape, or flat keys)

| Jira field | App shape key | Flat key | Example value |
|---|---|---|---|
| Summary | `fields.summary` | `summary` | `"Login test"` |
| Project | `fields.project.key` | `projectKey` | `"COMPTEST"` |
| Issue type | `fields.issuetype` | `issuetype` | `{ "name": "Test" }` or `{ "id": "10001" }` |
| Description | `fields.description` | `description` | `"Plain text description"` |
| Priority | `fields.priority.name` | `priority` | `"High"` |
| Labels | `fields.labels` | `labels` | `["smoke", "regression"]` |
| Assignee | `fields.assignee.accountId` | `assignee.id` | `{ "accountId": "abc" }` |
| Reporter | `fields.reporter.accountId` | `reporter.id` | `{ "accountId": "xyz" }` |
| Components | `fields.components` | `components` | `[{ "name": "Backend" }]` |
| Fix versions | `fields.fixVersions` | `fixVersions` | `[{ "name": "1.0" }]` |
| Affects versions | `fields.versions` | `versions` | `[{ "name": "0.9" }]` |
| Due date | `fields.duedate` | `duedate` | `"2026-12-31"` |
| Environment | `fields.environment` | `environment` | `"Staging"` |
| Time tracking | `fields.timetracking` | `timetracking` | `{ "originalEstimate": "2h" }` |
| Security level | `fields.security` | `security` | `{ "id": "10001" }` |
| Parent issue | `fields.parent` | `parent` | `{ "key": "PROJ-1" }` |
| Linked requirements | `update.issuelinks[].add.outwardIssue.key` | `linkedRequirements` | `["REQ-1"]` |
| Custom fields | `fields.customfield_*` | `customfield_*` | any value |

> **Tip:** All Jira fields except `summary` and `project` are optional. Fields not provided are omitted from the API call entirely — Jira/Xray project defaults apply.
>
> **`issuetype` error:** If you see `issuetype: Specify a valid issue type`, your Jira project requires an explicit issue type. Add `"issuetype": { "name": "Test" }` to your payload.
