const { requestJira, route } = require('@forge/api');
const { processImportBatch, extractIssueKeyFromJiraJsonField } = require('./importer');
const { graphqlRequestRaw } = require('./graphql');
const { fetchTests } = require('./retriever');

/**
 * Creates a Jira issue link between two issues using the Forge Jira REST API.
 * Only runs inside the Forge deployed environment.
 */
async function addJiraIssueLink(fromIssueKey, toIssueKey, typeName) {
  const response = await requestJira(route`/rest/api/3/issueLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: { name: typeName },
      inwardIssue: { key: fromIssueKey },
      outwardIssue: { key: toIssueKey },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to link ${fromIssueKey} -> ${toIssueKey} (${typeName}): ${response.status} ${text}`
    );
  }
}

/**
 * Maps a processImportBatch result to an HTTP response.
 * Returns 207 Multi-Status when any item failed, 200 when all succeeded.
 */
function toHttpResponse(result) {
  const hasFailures = result.failed > 0;
  return {
    statusCode: hasFailures ? 207 : 200,
    headers: { 'Content-Type': ['application/json'] },
    body: JSON.stringify({ ok: !hasFailures, ...result }),
  };
}

/**
 * GET handler — retrieves test details from Xray by issueId.
 *
 * Usage: GET <trigger-url>?issueIds=10001,10002
 *    or: GET <trigger-url>?issueIds=PROJ-1,PROJ-2
 *
 * Supports comma-separated values or repeated params (?issueIds=A&issueIds=B).
 * Auto-detects format: all-numeric → issueIds filter; any non-numeric → JQL.
 * Maximum 100 IDs per request.
 */
async function handleGet(request) {
  const qp = request.queryParameters || {};
  const raw = Array.isArray(qp.issueIds) ? qp.issueIds : (qp.issueIds ? [qp.issueIds] : []);
  const issueIds = raw
    .flatMap((v) => v.split(','))
    .map((id) => id.trim())
    .filter(Boolean);

  if (issueIds.length === 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': ['application/json'] },
      body: JSON.stringify({
        error: 'Query parameter "issueIds" is required. Pass one or more Jira issue IDs or keys, e.g. ?issueIds=10001,10002 or ?issueIds=PROJ-1,PROJ-2',
      }),
    };
  }

  if (issueIds.length > 100) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': ['application/json'] },
      body: JSON.stringify({
        error: `Too many issue IDs (${issueIds.length}). Maximum is 100 per request.`,
      }),
    };
  }

  const tests = await fetchTests(issueIds);
  return {
    statusCode: 200,
    headers: { 'Content-Type': ['application/json'] },
    body: JSON.stringify(tests),
  };
}

/**
 * Forge web trigger handler — routes by HTTP method.
 *
 * GET  → Retrieve test details from Xray (see handleGet)
 * POST → Import test definitions into Xray (see processImportBatch)
 */
exports.handler = async (request) => {
  try {
    if (request.method === 'GET') {
      return await handleGet(request);
    }

    // POST: import test definitions
    if (!request.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': ['application/json'] },
        body: JSON.stringify({ error: 'Request body is required. POST a JSON array of test definitions.' }),
      };
    }

    const parsed = JSON.parse(request.body);
    const tests = Array.isArray(parsed) ? parsed : [parsed];

    if (tests.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': ['application/json'] },
        body: JSON.stringify({ error: 'No test definitions found in request body.' }),
      };
    }

    const results = await processImportBatch(tests, {
      callXrayGraphql: graphqlRequestRaw,
      addJiraIssueLink,
      extractIssueKeyFromJiraJsonField,
    });

    return toHttpResponse(results);
  } catch (error) {
    console.error('Xray import error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': ['application/json'] },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
