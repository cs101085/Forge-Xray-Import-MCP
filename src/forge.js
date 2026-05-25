const { importTests } = require('./importer');

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

    const results = await importTests(tests);

    return {
      statusCode: 200,
      headers: { 'Content-Type': ['application/json'] },
      body: JSON.stringify(results),
    };
  } catch (error) {
    console.error('Xray import error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': ['application/json'] },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
