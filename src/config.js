// In Forge runtime, environment variables are set via `forge variables set`.
// For local CLI usage, `dotenv` can be loaded from the CLI entry point (src/index.js).

const REGIONS = {
  us: 'https://xray.cloud.getxray.app',
  eu: 'https://eu.xray.cloud.getxray.app',
  au: 'https://au.xray.cloud.getxray.app',
};

function getConfig() {
  const region = (process.env.XRAY_REGION || 'us').toLowerCase();
  const baseUrl = REGIONS[region];

  if (!baseUrl) {
    throw new Error(`Invalid XRAY_REGION "${region}". Must be one of: us, eu, au`);
  }

  if (!process.env.XRAY_CLIENT_ID || !process.env.XRAY_CLIENT_SECRET) {
    throw new Error(
      'Missing XRAY_CLIENT_ID or XRAY_CLIENT_SECRET. ' +
      'Set them via `forge variables set --encrypt` or in a .env file for local use.'
    );
  }

  return {
    clientId: process.env.XRAY_CLIENT_ID,
    clientSecret: process.env.XRAY_CLIENT_SECRET,
    baseUrl,
    graphqlUrl: `${baseUrl}/api/v2/graphql`,
    authUrl: `${baseUrl}/api/v2/authenticate`,
    projectKey: process.env.JIRA_PROJECT_KEY || null,
  };
}

module.exports = { getConfig };
