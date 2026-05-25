// Load dotenv only for local CLI usage (not used in Forge runtime)
try { require('dotenv').config(); } catch (e) { /* dotenv optional in Forge */ }

const fs = require('fs');
const path = require('path');
const { importTests } = require('./importer');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Xray Test Importer - Import test cases to Jira Xray via GraphQL API

Usage:
  node src/index.js <json-file>

Options:
  --help, -h    Show this help message

Environment Variables (set in .env):
  XRAY_CLIENT_ID      Xray API client ID (required)
  XRAY_CLIENT_SECRET  Xray API client secret (required)
  XRAY_REGION         API region: us, eu, or au (default: us)
  JIRA_PROJECT_KEY    Default Jira project key

JSON File Format:
  The input file should contain an array of test objects:
  [
    {
      "summary": "Test name",
      "testType": "Manual",
      "projectKey": "PROJ",
      "steps": [
        { "action": "Do something", "data": "input", "result": "expected" }
      ]
    }
  ]
`);
    process.exit(0);
  }

  const filePath = path.resolve(args[0]);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  let tests;
  try {
    const parsed = JSON.parse(fileContent);
    // Support both a single test object and an array of tests
    tests = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`Error parsing JSON: ${err.message}`);
    process.exit(1);
  }

  if (tests.length === 0) {
    console.error('Error: JSON file contains no test definitions.');
    process.exit(1);
  }

  console.log(`\nXray Test Importer`);
  console.log(`==================`);
  console.log(`File: ${filePath}`);
  console.log(`Tests to import: ${tests.length}\n`);

  try {
    const results = await importTests(tests);

    console.log(`\n--- Import Summary ---`);
    console.log(`Total:      ${results.total}`);
    console.log(`Successful: ${results.successful}`);
    console.log(`Failed:     ${results.failed}`);

    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`\nFatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
