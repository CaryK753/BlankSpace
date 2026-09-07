import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import { BUDGETS, CORE_SCENARIO_IDS } from './constants.mjs';

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fastifyPackageVersion() {
  const require = createRequire(import.meta.url);
  const entry = require.resolve('fastify');
  return require(join(dirname(entry), 'package.json')).version;
}

function expectedExitCode(id) {
  return [
    'listen-address-in-use',
    'route-registration-failure',
    'request-drain-timeout',
    'background-stop-timeout',
  ].includes(id) ? 1 : 0;
}

export function runScenarioChild(id) {
  return new Promise((resolve, reject) => {
    const child = fork(new URL('./scenario-child.mjs', import.meta.url), [id], {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let report = null;
    let runnerError = null;
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`S6 scenario ${id} exceeded the parent harness deadline.`));
    }, BUDGETS.harnessDeadlineMs);

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('message', message => {
      if (message?.type === 'report') report = message.report;
      if (message?.type === 'runner-error') runnerError = message.error;
    });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (runnerError !== null) {
        reject(new Error(`S6 scenario ${id} failed: ${runnerError.name}: ${runnerError.message}`));
        return;
      }
      if (report === null) {
        reject(new Error(`S6 scenario ${id} exited without a report (code=${code}, signal=${signal}, stderr=${stderr.trim()}).`));
        return;
      }
      if (code !== expectedExitCode(id) || signal !== null) {
        reject(new Error(`S6 scenario ${id} exit mismatch (code=${code}, signal=${signal}).`));
        return;
      }
      if (stderr.trim() !== '') {
        reject(new Error(`S6 scenario ${id} wrote unexpected stderr: ${stderr.trim()}`));
        return;
      }
      resolve(report);
    });
  });
}

async function execute(order) {
  const entries = [];
  for (const id of order) entries.push(await runScenarioChild(id));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  return CORE_SCENARIO_IDS.map(id => byId.get(id));
}

export async function runServerMatrix() {
  const forward = await execute(CORE_SCENARIO_IDS);
  const reverse = await execute([...CORE_SCENARIO_IDS].reverse());
  if (stableJson(forward) !== stableJson(reverse)) {
    throw new Error('S6 output changed between forward and reverse enumeration.');
  }
  return {
    schemaVersion: '1',
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      fastify: fastifyPackageVersion(),
      undici: process.versions.undici,
    },
    budgets: { ...BUDGETS },
    matrix: { runCount: 2, scenarioCount: forward.length },
    matrixHash: sha256(stableJson(forward)),
    scenarios: forward,
  };
}
