// G50 — read a vitest JSON report and refuse a run that proves nothing.
//
// A runner whose include pattern matches no files exits 0 ("the linter that linted zero
// files"), and a suite that quietly skipped because its database was missing looks green.
// This fails the job unless: at least --min-files files and --min-tests tests ran, none
// failed, and none were skipped. It also writes the counts to the job summary.
//
//   node .github/scripts/assert-test-count.mjs <report.json> <label> --min-files N --min-tests N
import fs from 'node:fs';

const [, , reportPath, label = 'suite', ...rest] = process.argv;
const opt = (name, dflt) => {
  const i = rest.indexOf(name);
  return i === -1 ? dflt : Number(rest[i + 1]);
};
const minFiles = opt('--min-files', 1);
const minTests = opt('--min-tests', 1);

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`::error::${label}: no readable test report at ${reportPath} (${err.message})`);
  process.exit(1);
}

const files = (report.testResults || []).length;
const total = report.numTotalTests ?? 0;
const passed = report.numPassedTests ?? 0;
const failed = report.numFailedTests ?? 0;
const skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);

const line = `${label}: ${files} test files, ${total} tests (${passed} passed, ${failed} failed, ${skipped} skipped)`;
console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${line}\n`);
}

const problems = [];
if (files < minFiles) problems.push(`${files} test files ran, expected at least ${minFiles}`);
if (total < minTests) problems.push(`${total} tests ran, expected at least ${minTests}`);
if (failed > 0) problems.push(`${failed} tests failed`);
if (skipped > 0) problems.push(`${skipped} tests were skipped; CI must run every test`);
for (const p of problems) console.error(`::error::${label}: ${p}`);
process.exit(problems.length ? 1 : 0);
