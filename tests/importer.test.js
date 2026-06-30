'use strict';

const { processImportBatch } = require('../src/importer');

// Builds a mock callXrayGraphql that resolves a successful createTest response.
function makeSuccessGql(issueId = 'TEST-001') {
  return jest.fn().mockResolvedValue({
    data: {
      createTest: {
        test: {
          issueId,
          jira: { key: issueId },
        },
        warnings: [],
      },
    },
    errors: undefined,
  });
}

describe('processImportBatch', () => {
  test('app payload shape (fields.* + testtype + update) passes', async () => {
    const callXrayGraphql = makeSuccessGql('APP-1');

    const items = [
      {
        testtype: 'Manual',
        fields: {
          summary: 'App payload test',
          project: { key: 'APP' },
          description: 'A test created from app payload',
          priority: { name: 'High' },
          labels: ['smoke'],
          fixVersions: [{ name: '1.0' }],
        },
        update: {
          issuelinks: [{ add: { outwardIssue: { key: 'REQ-10' } } }],
        },
        steps: [{ action: 'Click login', data: 'admin/pass', result: 'Dashboard shown' }],
      },
    ];

    const result = await processImportBatch(items, { callXrayGraphql });

    expect(result.total).toBe(1);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.details[0].status).toBe('success');
    expect(result.details[0].summary).toBe('App payload test');

    // Verify the GQL call received normalized values
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.summary).toBe('App payload test');
    expect(variables.jira.fields.project.key).toBe('APP');
    expect(variables.testType.name).toBe('Manual');
    expect(variables.jira.fields.priority.name).toBe('High');
    expect(variables.jira.fields.labels).toEqual(['smoke']);
    expect(variables.jira.fields.fixVersions).toEqual([{ name: '1.0' }]);
    expect(variables.steps[0].action).toBe('Click login');
  });

  test('legacy flat payload (summary + projectKey + testType) passes', async () => {
    const callXrayGraphql = makeSuccessGql('FLAT-1');

    const items = [
      {
        summary: 'Flat payload test',
        projectKey: 'FLAT',
        testType: 'Generic',
        description: 'A flat test',
        priority: 'Low',
        labels: ['regression'],
        fixVersions: [{ name: '2.0' }],
        linkedRequirements: ['REQ-20'],
        steps: [{ action: 'Run script', data: '', result: 'Exits 0' }],
        folderPath: '/Automated',
      },
    ];

    const result = await processImportBatch(items, { callXrayGraphql });

    expect(result.total).toBe(1);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.details[0].status).toBe('success');

    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.summary).toBe('Flat payload test');
    expect(variables.jira.fields.project.key).toBe('FLAT');
    expect(variables.testType.name).toBe('Generic');
    expect(variables.jira.fields.priority.name).toBe('Low');
    expect(variables.jira.fields.labels).toEqual(['regression']);
    expect(variables.folderPath).toBe('/Automated');
  });

  test('missing summary fails with clear validation error', async () => {
    const callXrayGraphql = makeSuccessGql();

    const items = [
      {
        // no summary field at all
        projectKey: 'PROJ',
        steps: [{ action: 'Do thing', data: '', result: 'Works' }],
      },
    ];

    const result = await processImportBatch(items, { callXrayGraphql });

    expect(result.total).toBe(1);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(1);
    expect(callXrayGraphql).not.toHaveBeenCalled();

    const detail = result.details[0];
    expect(detail.status).toBe('failed');
    expect(detail.error).toContain('summary is required');
    expect(detail.error).toMatch(/Item 1 invalid/);
  });

  test('issuetype is passed through from fields.issuetype', async () => {
    const callXrayGraphql = makeSuccessGql('ISO-1');
    const items = [
      {
        fields: {
          summary: 'Issuetype test',
          project: { key: 'ISO' },
          issuetype: { name: 'Test' },
        },
        testtype: 'Manual',
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.issuetype).toEqual({ name: 'Test' });
  });

  test('issuetype passed as flat field with id', async () => {
    const callXrayGraphql = makeSuccessGql('ISO-2');
    const items = [
      {
        summary: 'Issuetype by id',
        projectKey: 'ISO',
        issuetype: { id: '10001' },
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.issuetype).toEqual({ id: '10001' });
  });

  test('assignee and reporter are passed through', async () => {
    const callXrayGraphql = makeSuccessGql('AR-1');
    const items = [
      {
        fields: {
          summary: 'Assignee/reporter test',
          project: { key: 'AR' },
          assignee: { accountId: 'user-abc' },
          reporter: { id: 'user-xyz' },
        },
        testtype: 'Manual',
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.assignee).toEqual({ id: 'user-abc' });
    expect(variables.jira.fields.reporter).toEqual({ id: 'user-xyz' });
  });

  test('components and versions are passed through', async () => {
    const callXrayGraphql = makeSuccessGql('CV-1');
    const items = [
      {
        summary: 'Components/versions test',
        projectKey: 'CV',
        components: [{ name: 'Backend' }, { id: '10002' }],
        versions: [{ name: '1.0.0' }],
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.components).toEqual([{ name: 'Backend' }, { id: '10002' }]);
    expect(variables.jira.fields.versions).toEqual([{ name: '1.0.0' }]);
  });

  test('fixVersions supports both id and name (edge case: id-only)', async () => {
    const callXrayGraphql = makeSuccessGql('FV-1');
    const items = [
      {
        summary: 'Fix versions by id test',
        projectKey: 'FV',
        fixVersions: [{ id: '10100' }, { name: '2.0' }, { id: '10101', name: '2.1' }],
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.fixVersions).toEqual([
      { id: '10100' },
      { name: '2.0' },
      { id: '10101', name: '2.1' },
    ]);
  });

  test('fixVersions filters out empty objects', async () => {
    const callXrayGraphql = makeSuccessGql('FV-2');
    const items = [
      {
        summary: 'Empty fixVersions test',
        projectKey: 'FV',
        fixVersions: [{ name: '1.0' }, {}, { id: '' }, { name: '' }],
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    // Only the first valid object should remain
    expect(variables.jira.fields.fixVersions).toEqual([{ name: '1.0' }]);
  });

  test('duedate, environment, timetracking, security, parent are passed through', async () => {
    const callXrayGraphql = makeSuccessGql('DT-1');
    const items = [
      {
        summary: 'Extra fields test',
        projectKey: 'DT',
        duedate: '2026-12-31',
        environment: 'Staging',
        timetracking: { originalEstimate: '2h', remainingEstimate: '1h' },
        security: { id: '10001' },
        parent: { key: 'DT-1' },
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.duedate).toBe('2026-12-31');
    expect(variables.jira.fields.environment).toBe('Staging');
    expect(variables.jira.fields.timetracking).toEqual({ originalEstimate: '2h', remainingEstimate: '1h' });
    expect(variables.jira.fields.security).toEqual({ id: '10001' });
    expect(variables.jira.fields.parent).toEqual({ key: 'DT-1' });
  });

  test('custom Jira fields (customfield_*) are passed through from fields and flat', async () => {
    const callXrayGraphql = makeSuccessGql('CF-1');
    const items = [
      {
        fields: {
          summary: 'Custom fields test',
          project: { key: 'CF' },
          customfield_10001: 'custom-value',
          customfield_10002: { value: 'option-a' },
        },
        customfield_10003: 'flat-custom',
        testtype: 'Manual',
        steps: [],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.jira.fields.customfield_10001).toBe('custom-value');
    expect(variables.jira.fields.customfield_10002).toEqual({ value: 'option-a' });
    expect(variables.jira.fields.customfield_10003).toBe('flat-custom');
  });

  test('step callTestIssueId and customFields are passed through', async () => {
    const callXrayGraphql = makeSuccessGql('SC-1');
    const items = [
      {
        summary: 'Step extras test',
        projectKey: 'SC',
        steps: [
          {
            action: 'Call sub-test',
            data: '',
            result: '',
            callTestIssueId: 'SC-99',
            customFields: [{ id: 'field-1', value: 'val-1' }],
          },
        ],
      },
    ];
    const result = await processImportBatch(items, { callXrayGraphql });
    expect(result.successful).toBe(1);
    const [, variables] = callXrayGraphql.mock.calls[0];
    expect(variables.steps[0].callTestIssueId).toBe('SC-99');
    expect(variables.steps[0].customFields).toEqual([{ id: 'field-1', value: 'val-1' }]);
  });

  test('mixed batch returns partial success correctly', async () => {
    // Item 1: valid (has summary + projectKey)
    // Item 2: invalid (missing projectKey)
    const callXrayGraphql = makeSuccessGql('MIX-1');

    const items = [
      {
        summary: 'Valid test',
        projectKey: 'MIX',
        steps: [{ action: 'Step 1', data: '', result: 'OK' }],
      },
      {
        summary: 'Missing project key',
        // no projectKey
        steps: [],
      },
    ];

    const result = await processImportBatch(items, { callXrayGraphql });

    expect(result.total).toBe(2);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);

    // GraphQL called once only (for the valid item)
    expect(callXrayGraphql).toHaveBeenCalledTimes(1);

    const successDetail = result.details.find((d) => d.status === 'success');
    expect(successDetail).toBeDefined();
    expect(successDetail.summary).toBe('Valid test');
    expect(successDetail.index).toBe(1);

    const failDetail = result.details.find((d) => d.status === 'failed');
    expect(failDetail).toBeDefined();
    expect(failDetail.index).toBe(2);
    expect(failDetail.error).toContain('projectKey is required');
  });
});
