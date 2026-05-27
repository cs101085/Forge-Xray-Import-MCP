const { graphqlRequestRaw } = require('./graphql');

// -------- Normalization helpers --------

function toNonEmptyString(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  return s;
}

function toStringOrEmpty(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstNonEmpty(...values) {
  for (const v of values) {
    const s = toNonEmptyString(v);
    if (s) return s;
  }
  return '';
}

function extractLinkedRequirementsFromUpdate(updateBlock) {
  const issueLinks = toArray(updateBlock?.issuelinks);
  const keys = [];
  for (const link of issueLinks) {
    const k = toNonEmptyString(link?.add?.outwardIssue?.key);
    if (k) keys.push(k);
  }
  return keys;
}

function normalizeSteps(steps) {
  return toArray(steps).map((s) => {
    const step = {
      action: toStringOrEmpty(s?.action),
      data: toStringOrEmpty(s?.data),
      result: toStringOrEmpty(s?.result),
    };
    const callTestIssueId = toNonEmptyString(s?.callTestIssueId);
    if (callTestIssueId) step.callTestIssueId = callTestIssueId;
    const stepCustomFields = toArray(s?.customFields)
      .map((cf) => ({ id: toNonEmptyString(cf?.id), value: toNonEmptyString(cf?.value) }))
      .filter((cf) => cf.id);
    if (stepCustomFields.length > 0) step.customFields = stepCustomFields;
    return step;
  });
}

/**
 * Accepts both:
 * 1) App payload shape (testtype + fields + update + steps)
 * 2) Legacy flat shape (summary + projectKey + testType + ...)
 */
function normalizeIncomingTest(raw) {
  const summary = firstNonEmpty(raw?.fields?.summary, raw?.summary);
  const description = firstNonEmpty(raw?.fields?.description, raw?.description);

  const projectKey = firstNonEmpty(
    raw?.fields?.project?.key,
    raw?.projectKey
  );

  const testType = firstNonEmpty(raw?.testtype, raw?.testType) || 'Manual';

  const priority = firstNonEmpty(
    raw?.fields?.priority?.name,
    raw?.priority
  ) || '2';

  const labels =
    toArray(raw?.fields?.labels).length > 0
      ? toArray(raw?.fields?.labels).map((x) => toNonEmptyString(x)).filter(Boolean)
      : toArray(raw?.labels).map((x) => toNonEmptyString(x)).filter(Boolean);

  const fixVersionsRaw =
    toArray(raw?.fields?.fixVersions).length > 0
      ? toArray(raw?.fields?.fixVersions)
      : toArray(raw?.fixVersions);

  const fixVersions = fixVersionsRaw
    .map((v) => ({ name: toNonEmptyString(v?.name || v) }))
    .filter((v) => v.name);

  const linkedRequirementsFromUpdate = extractLinkedRequirementsFromUpdate(raw?.update);
  const linkedRequirementsFromFlat = toArray(raw?.linkedRequirements)
    .map((k) => toNonEmptyString(k))
    .filter(Boolean);

  const linkedRequirements =
    linkedRequirementsFromUpdate.length > 0
      ? linkedRequirementsFromUpdate
      : linkedRequirementsFromFlat;

  const steps = normalizeSteps(raw?.steps);

  // Legacy-only fields — no fields.* variant for these
  const unstructured = toNonEmptyString(raw?.unstructured) || undefined;
  const gherkin = toNonEmptyString(raw?.gherkin) || undefined;
  const preconditionIssueIds = toArray(raw?.preconditionIssueIds).filter(Boolean);
  const folderPath = toNonEmptyString(raw?.folderPath) || undefined;

  // issuetype: { id?, name? }
  const issuetypeRaw = raw?.fields?.issuetype || raw?.issuetype;
  const issuetype = issuetypeRaw
    ? {
        ...(toNonEmptyString(issuetypeRaw?.id) ? { id: toNonEmptyString(issuetypeRaw.id) } : {}),
        ...(toNonEmptyString(issuetypeRaw?.name) ? { name: toNonEmptyString(issuetypeRaw.name) } : {}),
      }
    : undefined;

  // assignee / reporter: Jira Cloud uses accountId surfaced as { id }
  const assigneeRaw = raw?.fields?.assignee || raw?.assignee;
  const assigneeId = firstNonEmpty(
    assigneeRaw?.accountId,
    assigneeRaw?.id,
    typeof assigneeRaw === 'string' ? assigneeRaw : ''
  );
  const assignee = assigneeId ? { id: assigneeId } : undefined;

  const reporterRaw = raw?.fields?.reporter || raw?.reporter;
  const reporterId = firstNonEmpty(
    reporterRaw?.accountId,
    reporterRaw?.id,
    typeof reporterRaw === 'string' ? reporterRaw : ''
  );
  const reporter = reporterId ? { id: reporterId } : undefined;

  // components: [{ id?, name? }]
  const componentsRawArr =
    toArray(raw?.fields?.components).length > 0
      ? toArray(raw?.fields?.components)
      : toArray(raw?.components);
  const components = componentsRawArr
    .map((c) => ({
      ...(toNonEmptyString(c?.id) ? { id: toNonEmptyString(c.id) } : {}),
      ...(toNonEmptyString(c?.name) ? { name: toNonEmptyString(c.name) } : {}),
    }))
    .filter((c) => c.id || c.name);

  // versions (affects versions): [{ id?, name? }]
  const versionsRawArr =
    toArray(raw?.fields?.versions).length > 0
      ? toArray(raw?.fields?.versions)
      : toArray(raw?.versions);
  const versions = versionsRawArr
    .map((v) => ({
      ...(toNonEmptyString(v?.id) ? { id: toNonEmptyString(v.id) } : {}),
      ...(toNonEmptyString(v?.name || (typeof v === 'string' ? v : '')) ? { name: toNonEmptyString(v?.name || v) } : {}),
    }))
    .filter((v) => v.id || v.name);

  // duedate: "YYYY-MM-DD"
  const duedate = toNonEmptyString(raw?.fields?.duedate || raw?.duedate) || undefined;

  // environment
  const environment = toNonEmptyString(raw?.fields?.environment || raw?.environment) || undefined;

  // timetracking: { originalEstimate?, remainingEstimate? }
  const timetrackingRaw = raw?.fields?.timetracking || raw?.timetracking;
  const timetracking =
    timetrackingRaw &&
    (toNonEmptyString(timetrackingRaw?.originalEstimate) || toNonEmptyString(timetrackingRaw?.remainingEstimate))
      ? {
          ...(toNonEmptyString(timetrackingRaw.originalEstimate) ? { originalEstimate: toNonEmptyString(timetrackingRaw.originalEstimate) } : {}),
          ...(toNonEmptyString(timetrackingRaw.remainingEstimate) ? { remainingEstimate: toNonEmptyString(timetrackingRaw.remainingEstimate) } : {}),
        }
      : undefined;

  // security: { id }
  const securityRaw = raw?.fields?.security || raw?.security;
  const securityId = toNonEmptyString(securityRaw?.id || (typeof securityRaw === 'string' ? securityRaw : ''));
  const security = securityId ? { id: securityId } : undefined;

  // parent: { key?, id? } — for subtasks / hierarchical issue types
  const parentRaw = raw?.fields?.parent || raw?.parent;
  const parentKey = toNonEmptyString(parentRaw?.key);
  const parentId = toNonEmptyString(parentRaw?.id);
  const parent =
    parentKey || parentId
      ? {
          ...(parentKey ? { key: parentKey } : {}),
          ...(parentId ? { id: parentId } : {}),
        }
      : undefined;

  // customJiraFields: any customfield_* keys from fields object or flat raw
  const customJiraFields = {};
  for (const key of Object.keys(raw?.fields || {})) {
    if (key.startsWith('customfield_')) customJiraFields[key] = raw.fields[key];
  }
  for (const key of Object.keys(raw || {})) {
    if (key.startsWith('customfield_') && !(key in customJiraFields)) {
      customJiraFields[key] = raw[key];
    }
  }

  return {
    summary,
    description,
    projectKey,
    testType,
    priority,
    labels,
    fixVersions,
    linkedRequirements,
    steps,
    unstructured,
    gherkin,
    preconditionIssueIds,
    folderPath,
    issuetype,
    assignee,
    reporter,
    components,
    versions,
    duedate,
    environment,
    timetracking,
    security,
    parent,
    customJiraFields,
  };
}

function validateNormalizedTest(t, index) {
  const errors = [];

  if (!toNonEmptyString(t.summary)) {
    errors.push('summary is required');
  }
  if (!toNonEmptyString(t.projectKey)) {
    errors.push('projectKey is required');
  }
  if (!Array.isArray(t.steps)) {
    errors.push('steps must be an array');
  }
  if (Array.isArray(t.steps)) {
    t.steps.forEach((s, i) => {
      if (typeof s.action !== 'string') errors.push(`steps[${i}].action must be a string`);
      if (typeof s.data !== 'string') errors.push(`steps[${i}].data must be a string`);
      if (typeof s.result !== 'string') errors.push(`steps[${i}].result must be a string`);
    });
  }

  return {
    ok: errors.length === 0,
    error: errors.length ? `Item ${index + 1} invalid: ${errors.join('; ')}` : '',
  };
}

// -------- GraphQL mutation --------

const CREATE_TEST_MUTATION = `
  mutation CreateTest(
    $testType: UpdateTestTypeInput
    $steps: [CreateStepInput!]
    $unstructured: String
    $gherkin: String
    $preconditionIssueIds: [String]
    $folderPath: String
    $jira: JSON!
  ) {
    createTest(
      testType: $testType
      steps: $steps
      unstructured: $unstructured
      gherkin: $gherkin
      preconditionIssueIds: $preconditionIssueIds
      folderPath: $folderPath
      jira: $jira
    ) {
      test {
        issueId
        jira(fields: ["key", "summary"])
      }
      warnings
    }
  }
`;

function buildCreateTestVariables(t) {
  const jiraFields = {
    summary: t.summary,
    project: { key: t.projectKey },
    description: t.description || '',
    labels: t.labels || [],
    priority: { name: String(t.priority || '2') },
  };

  // issuetype — explicit issue type override (required by some Jira project configurations)
  if (t.issuetype && (t.issuetype.id || t.issuetype.name)) {
    jiraFields.issuetype = t.issuetype;
  }

  // Assignee / reporter (Jira Cloud accountId surfaced as { id })
  if (t.assignee) jiraFields.assignee = t.assignee;
  if (t.reporter) jiraFields.reporter = t.reporter;

  // Components and version arrays
  if (Array.isArray(t.components) && t.components.length > 0) jiraFields.components = t.components;
  if (Array.isArray(t.fixVersions) && t.fixVersions.length > 0) jiraFields.fixVersions = t.fixVersions;
  if (Array.isArray(t.versions) && t.versions.length > 0) jiraFields.versions = t.versions;

  // Date / time fields
  if (t.duedate) jiraFields.duedate = t.duedate;
  if (t.timetracking) jiraFields.timetracking = t.timetracking;

  // Environment string
  if (t.environment) jiraFields.environment = t.environment;

  // Security level
  if (t.security) jiraFields.security = t.security;

  // Parent (subtasks / hierarchy)
  if (t.parent) jiraFields.parent = t.parent;

  // Arbitrary custom Jira fields (customfield_*)
  if (t.customJiraFields && Object.keys(t.customJiraFields).length > 0) {
    Object.assign(jiraFields, t.customJiraFields);
  }

  const variables = {
    testType: { name: t.testType || 'Manual' },
    steps: t.steps || [],
    jira: { fields: jiraFields },
  };

  if (t.unstructured) variables.unstructured = t.unstructured;
  if (t.gherkin) variables.gherkin = t.gherkin;
  if (Array.isArray(t.preconditionIssueIds) && t.preconditionIssueIds.length > 0) {
    variables.preconditionIssueIds = t.preconditionIssueIds;
  }
  if (t.folderPath) variables.folderPath = t.folderPath;

  return variables;
}

function buildIssueLinkOperations(t, createdIssueKey) {
  return (t.linkedRequirements || []).map((reqKey) => ({
    fromIssueKey: createdIssueKey,
    toIssueKey: reqKey,
    typeName: 'Tests',
  }));
}

function extractIssueKeyFromJiraJsonField(jiraField) {
  if (!jiraField) return null;
  if (typeof jiraField === 'string') {
    try {
      return JSON.parse(jiraField).key || null;
    } catch {
      return null;
    }
  }
  if (typeof jiraField === 'object') return jiraField.key || null;
  return null;
}

// -------- Batch processor --------

/**
 * Processes a batch of raw test items with partial-failure reporting.
 *
 * deps shape:
 *   callXrayGraphql(query, variables)  → { data, errors }
 *   addJiraIssueLink(fromKey, toKey, typeName)  [optional]
 *   extractIssueKeyFromJiraJsonField(jiraField)  [optional, defaults to module fn]
 */
async function processImportBatch(rawItems, deps) {
  const resolveKey = deps.extractIssueKeyFromJiraJsonField || extractIssueKeyFromJiraJsonField;
  const items = Array.isArray(rawItems) ? rawItems : [];
  const details = [];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const normalized = normalizeIncomingTest(raw);

    // Structured log: source tracing (presence only, no sensitive values)
    const summarySource = raw?.fields?.summary != null ? 'fields.summary' : 'flat.summary';
    const projectKeySource = raw?.fields?.project?.key != null ? 'fields.project.key' : 'flat.projectKey';
    console.log(
      `[importer] item ${i + 1}: summary from ${summarySource} (length=${normalized.summary.length}),` +
      ` projectKey from ${projectKeySource} (length=${normalized.projectKey.length})`
    );

    const validation = validateNormalizedTest(normalized, i);
    if (!validation.ok) {
      failed++;
      details.push({
        index: i + 1,
        summary: normalized.summary || 'unknown',
        status: 'failed',
        error: validation.error,
      });
      console.error(`[importer] item ${i + 1} validation failed: ${validation.error}`);
      continue;
    }

    try {
      const variables = buildCreateTestVariables(normalized);
      const gqlResult = await deps.callXrayGraphql(CREATE_TEST_MUTATION, variables);

      const gqlErrors = Array.isArray(gqlResult?.errors) ? gqlResult.errors : [];
      if (gqlErrors.length > 0) {
        const errDetail = gqlErrors
          .map((e) => `${e?.path ? e.path.join('.') + ': ' : ''}${e?.message || 'unknown'}`)
          .join(' | ');
        console.error(`[importer] item ${i + 1} GraphQL errors: ${errDetail}`);
        failed++;
        details.push({
          index: i + 1,
          summary: normalized.summary,
          status: 'failed',
          error: `GraphQL errors: ${errDetail}`,
        });
        continue;
      }

      const testNode = gqlResult?.data?.createTest?.test;
      if (!testNode) {
        failed++;
        details.push({
          index: i + 1,
          summary: normalized.summary,
          status: 'failed',
          error: 'createTest returned no test object',
        });
        continue;
      }

      // Optional: link requirements after create
      if (typeof deps.addJiraIssueLink === 'function' && normalized.linkedRequirements.length > 0) {
        const createdIssueKey = resolveKey(testNode?.jira);
        if (createdIssueKey) {
          const ops = buildIssueLinkOperations(normalized, createdIssueKey);
          for (const op of ops) {
            await deps.addJiraIssueLink(op.fromIssueKey, op.toIssueKey, op.typeName);
          }
        }
      }

      successful++;
      details.push({
        index: i + 1,
        summary: normalized.summary,
        status: 'success',
        issueId: testNode.issueId,
        key: resolveKey(testNode.jira),
        warnings: gqlResult?.data?.createTest?.warnings || [],
      });
      console.log(`[importer] item ${i + 1} created: summary length=${normalized.summary.length}`);
    } catch (err) {
      failed++;
      details.push({
        index: i + 1,
        summary: normalized.summary,
        status: 'failed',
        error: `Exception: ${err?.message || String(err)}`,
      });
      console.error(`[importer] item ${i + 1} exception: ${err?.message || String(err)}`);
    }
  }

  return { total: items.length, successful, failed, details };
}

/**
 * Imports multiple test cases from a JSON array.
 * Wraps processImportBatch with real GraphQL deps for CLI / non-Forge usage.
 */
async function importTests(tests) {
  return processImportBatch(tests, {
    callXrayGraphql: graphqlRequestRaw,
    extractIssueKeyFromJiraJsonField,
  });
}

module.exports = { importTests, processImportBatch, extractIssueKeyFromJiraJsonField };
