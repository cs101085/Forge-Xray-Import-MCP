const { requestJira } = require('@forge/api');
const { processImportBatch, extractIssueKeyFromJiraJsonField } = require('./importer');
const { graphqlRequestRaw } = require('./graphql');

/**
 * Creates a Jira issue link between two issues using the Forge Jira REST API.
 * Only runs inside the Forge deployed environment.
 */
async function addJiraIssueLink(fromIssueKey, toIssueKey, typeName) {
  const response = await requestJira('/rest/api/3/issueLink', {
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
 * Forge web trigger handler.
 * Receives a JSON payload of test definitions and imports them to Xray via GraphQL.
 *
 * Usage: POST the JSON array of tests to the web trigger URL.
 */
exports.handler = async (request) => {
  try {
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
