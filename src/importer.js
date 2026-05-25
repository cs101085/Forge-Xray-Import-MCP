const { graphqlRequest } = require('./graphql');
const { getConfig } = require('./config');

const CREATE_TEST_MUTATION = `
  mutation CreateTest(
    $testType: UpdateTestTypeInput,
    $steps: [CreateStepInput],
    $unstructured: String,
    $gherkin: String,
    $preconditionIssueIds: [String],
    $folderPath: String,
    $jira: JSON!
  ) {
    createTest(
      testType: $testType,
      steps: $steps,
      unstructured: $unstructured,
      gherkin: $gherkin,
      preconditionIssueIds: $preconditionIssueIds,
      folderPath: $folderPath,
      jira: $jira
    ) {
      test {
        issueId
        testType {
          name
        }
        jira(fields: ["key", "summary"])
      }
      warnings
    }
  }
`;

/**
 * Imports a single test case to Xray via GraphQL.
 */
async function importTest(testDef) {
  const config = getConfig();
  const projectKey = testDef.projectKey || config.projectKey;

  if (!projectKey) {
    throw new Error(
      'No project key specified. Set JIRA_PROJECT_KEY in .env or provide "projectKey" in the test JSON.'
    );
  }

  // Build the jira fields object
  const jiraFields = {
    summary: testDef.summary,
    project: { key: projectKey },
  };

  if (testDef.description) {
    jiraFields.description = testDef.description;
  }
  if (testDef.labels) {
    jiraFields.labels = testDef.labels;
  }
  if (testDef.priority) {
    jiraFields.priority = { name: testDef.priority };
  }
  if (testDef.components) {
    jiraFields.components = testDef.components.map((c) => ({ name: c }));
  }

  // Build variables for the mutation
  const variables = {
    jira: { fields: jiraFields },
  };

  // Test type (Manual, Generic, Cucumber)
  if (testDef.testType) {
    variables.testType = { name: testDef.testType };
  }

  // Steps for manual tests
  if (testDef.steps && testDef.steps.length > 0) {
    variables.steps = testDef.steps.map((step) => ({
      action: step.action || '',
      data: step.data || undefined,
      result: step.result || undefined,
    }));
  }

  // Unstructured definition for Generic tests
  if (testDef.unstructured) {
    variables.unstructured = testDef.unstructured;
  }

  // Gherkin definition for Cucumber tests
  if (testDef.gherkin) {
    variables.gherkin = testDef.gherkin;
  }

  // Preconditions
  if (testDef.preconditionIssueIds) {
    variables.preconditionIssueIds = testDef.preconditionIssueIds;
  }

  // Folder path in test repository
  if (testDef.folderPath) {
    variables.folderPath = testDef.folderPath;
  }

  const data = await graphqlRequest(CREATE_TEST_MUTATION, variables);
  return data.createTest;
}

function getJiraKey(jira) {
  if (!jira) {
    return null;
  }

  if (typeof jira === 'string') {
    return JSON.parse(jira).key;
  }

  if (typeof jira === 'object') {
    return jira.key || null;
  }

  return null;
}

/**
 * Imports multiple test cases from a JSON array.
 * Returns a summary of results.
 */
async function importTests(tests) {
  const results = {
    total: tests.length,
    successful: 0,
    failed: 0,
    details: [],
  };

  for (let i = 0; i < tests.length; i++) {
    const testDef = tests[i];
    const label = testDef.summary || `Test #${i + 1}`;

    try {
      const result = await importTest(testDef);
      results.successful++;
      results.details.push({
        index: i + 1,
        summary: label,
        status: 'success',
        issueId: result.test?.issueId,
        key: getJiraKey(result.test?.jira),
        warnings: result.warnings || [],
      });
      console.log(`  [${i + 1}/${tests.length}] ✓ Created: ${label}`);
    } catch (error) {
      results.failed++;
      results.details.push({
        index: i + 1,
        summary: label,
        status: 'failed',
        error: error.message,
      });
      console.error(`  [${i + 1}/${tests.length}] ✗ Failed: ${label} - ${error.message}`);
    }
  }

  return results;
}

module.exports = { importTest, importTests };
