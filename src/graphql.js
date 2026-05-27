const { getConfig } = require('./config');
const { authenticate } = require('./auth');

/**
 * Executes a GraphQL query/mutation against the Xray Cloud API.
 */
async function graphqlRequest(query, variables = {}) {
  const config = getConfig();
  const token = await authenticate();

  const response = await fetch(config.graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GraphQL request failed (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    const messages = result.errors.map((e) => e.message).join('; ');
    throw new Error(`GraphQL errors: ${messages}`);
  }

  return result.data;
}

/**
 * Like graphqlRequest but returns the raw { data, errors } object without throwing
 * on GraphQL-level errors. Only throws on HTTP transport errors.
 * Use this when the caller needs to inspect partial errors per item.
 */
async function graphqlRequestRaw(query, variables = {}) {
  const config = getConfig();
  const token = await authenticate();

  const response = await fetch(config.graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GraphQL request failed (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

module.exports = { graphqlRequest, graphqlRequestRaw };
