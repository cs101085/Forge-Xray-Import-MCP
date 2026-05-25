const { getConfig } = require('./config');

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Authenticates with Xray Cloud and returns a bearer token.
 * Tokens are cached and reused until expiry.
 */
async function authenticate() {
  // Xray tokens are valid for a limited time; re-auth if expired
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const config = getConfig();

  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Xray authentication failed (${response.status}): ${errorText}`
    );
  }

  // The authenticate endpoint returns a raw token string (quoted)
  const token = (await response.text()).replace(/"/g, '');

  // Cache token for 55 minutes (tokens typically expire in 1 hour)
  cachedToken = token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;

  return token;
}

module.exports = { authenticate };
