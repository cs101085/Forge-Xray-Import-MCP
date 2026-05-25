To Deploy:
# 1. Register your app (first time only — replaces REPLACE_WITH_YOUR_APP_ID in manifest.yml)
forge register

# 2. Set encrypted environment variables
forge variables set --encrypt XRAY_CLIENT_ID <your-client-id>
forge variables set --encrypt XRAY_CLIENT_SECRET <your-client-secret>
forge variables set XRAY_REGION us
forge variables set JIRA_PROJECT_KEY COMPTEST

# 3. Deploy
forge deploy

# 4. Install on your Jira site
forge install -s your-site.atlassian.net -p jira

# 5. Generate the web trigger URL
forge webtrigger create --functionKey xray-import-trigger

Then POST your JSON tests to the generated URL:
curl -X POST "https://5ed8d793-1ca2-4c0c-89a4-eb0aa54d06fb.webtrigger.atlassian.app/public/X5R6XyKfkEyB5FNeN_kGQqro0cM" `
  -H "Content-Type: application/json" `
  --data-binary "@sample-tests.json"