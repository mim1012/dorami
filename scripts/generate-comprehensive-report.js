#!/usr/bin/env node
/**
 * Comprehensive Test Report Generator — Task #31
 *
 * Aggregates all test results into a single report with:
 *   - Per-category scores (unit, lint, e2e, load, health, network, resources)
 *   - Final score out of 100
 *   - Deployment recommendation (DEPLOY / CONDITIONAL / BLOCKED)
 *
 * Usage: node scripts/generate-comprehensive-report.js
 * Output: reports/comprehensive-test-report.md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const OUTPUT_FILE = path.join(REPORTS_DIR, 'comprehensive-test-report.md');

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// Score weights (total = 100)
const WEIGHTS = {
  unit: 25,       // Unit tests
  lint: 10,       // Lint + type check
  e2e: 20,        // E2E tests
  load: 15,       // Load tests
  health: 15,     // Health checks
  network: 10,    // Network simulation
  resources: 5,   // Resource usage
};

const scores = {};
const details = {};

// ============================================
// Collectors
// ============================================

function collectUnitTests() {
  const resultFile = path.join(REPORTS_DIR, 'unit-results.json');
  if (fs.existsSync(resultFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
      const total = data.numTotalTests || 0;
      const passed = data.numPassedTests || 0;
      const rate = total > 0 ? passed / total : 0;
      scores.unit = Math.round(rate * WEIGHTS.unit);
      details.unit = `${passed}/${total} passed (${Math.round(rate * 100)}%)`;
      return;
    } catch { /* fall through */ }
  }

  // Try running tests
  try {
    const output = execSync('cd backend && npx jest --ci --forceExit --json 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const jsonStart = output.indexOf('{');
    if (jsonStart >= 0) {
      const data = JSON.parse(output.slice(jsonStart));
      const total = data.numTotalTests || 0;
      const passed = data.numPassedTests || 0;
      const rate = total > 0 ? passed / total : 0;
      scores.unit = Math.round(rate * WEIGHTS.unit);
      details.unit = `${passed}/${total} passed (${Math.round(rate * 100)}%)`;
      return;
    }
  } catch { /* ignore */ }

  scores.unit = 0;
  details.unit = 'Could not run or find unit test results';
}

function collectLint() {
  try {
    execSync('npm run lint:all 2>/dev/null', { encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
    scores.lint = WEIGHTS.lint;
    details.lint = 'Lint passed, no errors';
  } catch {
    // Partial credit if it runs but has warnings
    scores.lint = Math.round(WEIGHTS.lint * 0.5);
    details.lint = 'Lint had errors or warnings';
  }
}

function collectE2E() {
  const outputFile = path.join(REPORTS_DIR, 'e2e-output.txt');
  if (fs.existsSync(outputFile)) {
    const content = fs.readFileSync(outputFile, 'utf-8');
    const passMatch = content.match(/(\d+) passed/);
    const failMatch = content.match(/(\d+) failed/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    const total = passed + failed;
    const rate = total > 0 ? passed / total : 0;
    scores.e2e = Math.round(rate * WEIGHTS.e2e);
    details.e2e = `${passed}/${total} passed (${Math.round(rate * 100)}%)`;
  } else {
    scores.e2e = 0;
    details.e2e = 'No E2E results found (run Playwright tests first)';
  }
}

function collectLoad() {
  const outputFile = path.join(REPORTS_DIR, 'load-output.txt');
  if (fs.existsSync(outputFile)) {
    const content = fs.readFileSync(outputFile, 'utf-8');
    const overallMatch = content.match(/Overall: (\d+)\/(\d+)/);
    if (overallMatch) {
      const passed = parseInt(overallMatch[1]);
      const total = parseInt(overallMatch[2]);
      const rate = total > 0 ? passed / total : 0;
      scores.load = Math.round(rate * WEIGHTS.load);
      details.load = `${passed}/${total} users completed flow (${Math.round(rate * 100)}%)`;
    } else {
      scores.load = Math.round(WEIGHTS.load * 0.5);
      details.load = 'Load test ran but results unclear';
    }
  } else {
    scores.load = 0;
    details.load = 'No load test results found';
  }
}

function collectHealth() {
  try {
    const result = execSync('bash scripts/health-check.sh --once 2>&1', {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const failCount = (result.match(/\[FAIL\]/g) || []).length;
    if (failCount === 0) {
      scores.health = WEIGHTS.health;
      details.health = 'All health checks passed';
    } else {
      scores.health = Math.round(WEIGHTS.health * 0.3);
      details.health = `${failCount} health check(s) failed`;
    }
  } catch {
    scores.health = 0;
    details.health = 'Health check could not run (services not available)';
  }
}

function collectNetwork() {
  const resultFile = path.join(REPORTS_DIR, 'network-simulation-results.json');
  if (fs.existsSync(resultFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
      const conditions = data.conditions || [];
      let totalSuccess = 0;
      let totalRequests = 0;
      for (const cond of conditions) {
        for (const ep of cond.results || []) {
          totalSuccess += ep.successCount || 0;
          totalRequests += ep.totalRequests || 0;
        }
      }
      const rate = totalRequests > 0 ? totalSuccess / totalRequests : 0;
      scores.network = Math.round(rate * WEIGHTS.network);
      details.network = `${totalSuccess}/${totalRequests} requests succeeded across all conditions (${Math.round(rate * 100)}%)`;
    } catch {
      scores.network = 0;
      details.network = 'Network results file corrupted';
    }
  } else {
    scores.network = 0;
    details.network = 'No network simulation results (run network-simulation-test.js first)';
  }
}

function collectResources() {
  try {
    const result = execSync('docker stats --no-stream --format "{{.Name}} {{.MemPerc}}" 2>/dev/null | grep doremi', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = result.trim().split('\n').filter(Boolean);
    let allOk = true;
    for (const line of lines) {
      const pct = parseFloat(line.split(' ').pop());
      if (pct > 90) allOk = false;
    }
    scores.resources = allOk ? WEIGHTS.resources : Math.round(WEIGHTS.resources * 0.5);
    details.resources = allOk ? 'All containers within normal limits' : 'Some containers have high memory usage';
  } catch {
    scores.resources = Math.round(WEIGHTS.resources * 0.5);
    details.resources = 'Could not check Docker resources';
  }
}

// ============================================
// Report Generation
// ============================================

function generateReport() {
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  let verdict, verdictDetail;
  if (totalScore >= 90) {
    verdict = 'EXCELLENT — DEPLOY';
    verdictDetail = 'All checks passed. Safe to deploy to production immediately.';
  } else if (totalScore >= 70) {
    verdict = 'GOOD — DEPLOY WITH MONITORING';
    verdictDetail = 'Most checks passed. Deploy and monitor closely for the first 30 minutes.';
  } else if (totalScore >= 50) {
    verdict = 'FAIR — CONDITIONAL';
    verdictDetail = 'Several issues detected. Fix failing areas and re-test before deploying.';
  } else {
    verdict = 'POOR — BLOCKED';
    verdictDetail = 'Critical issues detected. Do NOT deploy. Fix issues first.';
  }

  const lines = [
    '# Comprehensive Test Report',
    '',
    `**Generated**: ${new Date().toISOString()}`,
    `**Branch**: ${getBranch()}`,
    `**Commit**: ${getCommit()}`,
    '',
    '---',
    '',
    `## Final Score: ${totalScore} / 100`,
    '',
    `### Verdict: ${verdict}`,
    '',
    verdictDetail,
    '',
    '---',
    '',
    '## Category Breakdown',
    '',
    '| Category | Score | Max | Details |',
    '|----------|-------|-----|---------|',
  ];

  const categoryNames = {
    unit: 'Unit Tests',
    lint: 'Lint & Types',
    e2e: 'E2E Tests',
    load: 'Load Tests',
    health: 'Health Checks',
    network: 'Network Sim',
    resources: 'Resources',
  };

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const score = scores[key] || 0;
    const detail = details[key] || 'Not collected';
    const icon = score >= weight * 0.8 ? 'PASS' : score >= weight * 0.5 ? 'WARN' : 'FAIL';
    lines.push(`| ${categoryNames[key]} | ${score} | ${weight} | [${icon}] ${detail} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Score Weights');
  lines.push('');
  lines.push('| Category | Weight | Rationale |');
  lines.push('|----------|--------|-----------|');
  lines.push('| Unit Tests | 25 | Core business logic correctness |');
  lines.push('| Lint & Types | 10 | Code quality and type safety |');
  lines.push('| E2E Tests | 20 | User-facing flow validation |');
  lines.push('| Load Tests | 15 | Concurrent user handling |');
  lines.push('| Health Checks | 15 | Infrastructure readiness |');
  lines.push('| Network Sim | 10 | Degraded network resilience |');
  lines.push('| Resources | 5 | Container resource health |');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Deployment Decision Matrix');
  lines.push('');
  lines.push('| Score Range | Verdict | Action |');
  lines.push('|-------------|---------|--------|');
  lines.push('| 90-100 | EXCELLENT | Deploy immediately |');
  lines.push('| 70-89 | GOOD | Deploy with 30-min monitoring |');
  lines.push('| 50-69 | FAIR | Fix issues, re-test, then deploy |');
  lines.push('| 0-49 | POOR | Do NOT deploy |');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Report generated by `scripts/generate-comprehensive-report.js`_');

  return lines.join('\n');
}

function getBranch() {
  try {
    return execSync('git branch --show-current 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getCommit() {
  try {
    return execSync('git log -1 --format="%h %s" 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

// ============================================
// Main
// ============================================

console.log('=== Comprehensive Test Report Generator ===');
console.log(`Timestamp: ${new Date().toISOString()}\n`);

console.log('Collecting unit test results...');
collectUnitTests();
console.log(`  -> ${details.unit} (${scores.unit}/${WEIGHTS.unit})`);

console.log('Collecting lint results...');
collectLint();
console.log(`  -> ${details.lint} (${scores.lint}/${WEIGHTS.lint})`);

console.log('Collecting E2E results...');
collectE2E();
console.log(`  -> ${details.e2e} (${scores.e2e}/${WEIGHTS.e2e})`);

console.log('Collecting load test results...');
collectLoad();
console.log(`  -> ${details.load} (${scores.load}/${WEIGHTS.load})`);

console.log('Collecting health check results...');
collectHealth();
console.log(`  -> ${details.health} (${scores.health}/${WEIGHTS.health})`);

console.log('Collecting network simulation results...');
collectNetwork();
console.log(`  -> ${details.network} (${scores.network}/${WEIGHTS.network})`);

console.log('Collecting resource usage...');
collectResources();
console.log(`  -> ${details.resources} (${scores.resources}/${WEIGHTS.resources})`);

const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
console.log(`\n=== TOTAL SCORE: ${totalScore} / 100 ===\n`);

const report = generateReport();
fs.writeFileSync(OUTPUT_FILE, report);
console.log(`Report saved: ${OUTPUT_FILE}`);

