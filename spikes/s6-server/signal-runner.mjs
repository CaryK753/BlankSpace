import { fork } from 'node:child_process';

import { BUDGETS } from './constants.mjs';

export function runRealSignal(signal) {
  return new Promise((resolve, reject) => {
    const child = fork(new URL('./signal-child.mjs', import.meta.url), [], {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let report = null;
    let stderr = '';
    let repeated = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`S6 ${signal} child exceeded the parent harness deadline.`));
    }, BUDGETS.harnessDeadlineMs);

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('message', message => {
      if (message?.type === 'ready') child.kill(signal);
      if (message?.type === 'stopping' && !repeated) {
        repeated = true;
        child.kill(signal);
      }
      if (message?.type === 'terminal') report = message.report;
    });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, exitSignal) => {
      clearTimeout(timer);
      if (report === null || code !== 0 || exitSignal !== null || stderr.trim() !== '') {
        reject(new Error(`S6 ${signal} child failed (code=${code}, signal=${exitSignal}, stderr=${stderr.trim()}).`));
        return;
      }
      resolve(report);
    });
  });
}

export async function runSignalCorpus() {
  if (process.platform === 'win32') {
    return {
      schemaVersion: '1',
      environment: { platform: process.platform, arch: process.arch, node: process.version },
      support: 'unsupported-by-node',
      signals: [],
    };
  }
  return {
    schemaVersion: '1',
    environment: { platform: process.platform, arch: process.arch, node: process.version },
    support: 'posix',
    signals: await Promise.all(['SIGTERM', 'SIGINT'].map(runRealSignal)),
  };
}
