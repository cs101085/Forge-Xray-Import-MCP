const { graphqlRequest } = require('./graphql');

// -------- GraphQL query --------

const GET_TESTS_QUERY = `
  query GetTests($issueIds: [String], $jql: String, $limit: Int!) {
    getTests(issueIds: $issueIds, jql: $jql, limit: $limit) {
      total
      results {
        issueId
        testType {
          name
        }
        steps {
          action
          data
          result
          customfields {
            id
            value
          }
        }
        unstructured
        gherkin
        folder {
          path
        }
        dataset {
          parameters {
            name
          }
          rows {
            values
          }
        }
        jira(fields: ["key", "summary", "description", "status", "project", "labels", "components", "fixVersions", "priority"])
      }
    }
  }
`;

// -------- Query variable builder --------

/**
 * Builds variables for GET_TESTS_QUERY.
 * Auto-detects input format:
 *   - All numeric IDs → uses issueIds array (single efficient call)
 *   - Any non-numeric → uses JQL `issue in (KEY-1, KEY-2, ...)`
 * Limit is capped at 100 (Xray API maximum).
 */
function buildGetTestsVariables(issueIds) {
  const limit = Math.min(issueIds.length, 100);
  const allNumeric = issueIds.every((id) => /^\d+$/.test(id));
  if (allNumeric) {
    return { issueIds, jql: null, limit };
  }
  const keyList = issueIds.map((id) => `"${id}"`).join(', ');
  return { issueIds: null, jql: `issue in (${keyList})`, limit };
}

// -------- Response mapper --------

/**
 * Maps a single Xray getTests result to the flat shape used in sample-tests.json.
 * Adds issueId, issueKey, status, and dataset fields beyond the import shape.
 */
function mapTestToFlat(xrayTest) {
  const jira = xrayTest.jira || {};

  const mapped = {
    issueId: xrayTest.issueId,
    issueKey: jira.key || null,
    summary: jira.summary || '',
    description: jira.description || '',
    status: jira.status ? (jira.status.name || String(jira.status)) : null,
    testType: xrayTest.testType ? xrayTest.testType.name : 'Manual',
    projectKey: jira.project ? jira.project.key : '',
    folderPath: xrayTest.folder ? xrayTest.folder.path : null,
    priority: jira.priority ? jira.priority.name : null,
    labels: Array.isArray(jira.labels) ? jira.labels : [],
    components: Array.isArray(jira.components)
      ? jira.components.map((c) => ({ name: c.name })).filter((c) => c.name)
      : [],
    fixVersions: Array.isArray(jira.fixVersions)
      ? jira.fixVersions.map((v) => ({ name: v.name })).filter((v) => v.name)
      : [],
  };

  if (Array.isArray(xrayTest.steps) && xrayTest.steps.length > 0) {
    mapped.steps = xrayTest.steps.map((s) => {
      const step = {
        action: s.action || '',
        data: s.data || '',
        result: s.result || '',
      };
      if (Array.isArray(s.customfields) && s.customfields.length > 0) {
        step.customFields = s.customfields;
      }
      return step;
    });
  }

  if (xrayTest.unstructured) mapped.unstructured = xrayTest.unstructured;
  if (xrayTest.gherkin) mapped.gherkin = xrayTest.gherkin;
  if (xrayTest.dataset) mapped.dataset = xrayTest.dataset;

  return mapped;
}

// -------- Public API --------

/**
 * Fetches one or more Xray tests by issueId and returns them in the flat shape.
 *
 * @param {string[]} issueIds - Numeric Jira issue IDs (e.g. ["10001"]) or issue keys (e.g. ["PROJ-1"]).
 *   Format is auto-detected: all-numeric uses the issueIds filter; any non-numeric uses JQL.
 * @returns {Promise<object[]>} Array of test objects in the flat sample-tests.json shape.
 */
async function fetchTests(issueIds) {
  const variables = buildGetTestsVariables(issueIds);
  const data = await graphqlRequest(GET_TESTS_QUERY, variables);
  const results = (data && data.getTests && data.getTests.results) || [];
  return results.map(mapTestToFlat);
}

module.exports = { fetchTests, buildGetTestsVariables, mapTestToFlat };
