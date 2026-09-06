import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function pnpmInvocation(arguments_) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath?.endsWith('.cjs') || npmExecPath?.endsWith('.js')) {
    return { executable: process.execPath, arguments: [npmExecPath, ...arguments_] };
  }
  if (process.platform === 'win32') {
    return {
      executable: process.env.ComSpec ?? 'cmd.exe',
      arguments: ['/d', '/s', '/c', 'pnpm', ...arguments_],
    };
  }
  return { executable: 'pnpm', arguments: arguments_ };
}

async function runPnpm(arguments_) {
  const invocation = pnpmInvocation(arguments_);
  return execFileAsync(invocation.executable, invocation.arguments, { encoding: 'utf8' });
}

async function installFixture(checkout, store) {
  await runPnpm([
    '--dir', checkout,
    'install',
    '--offline',
    '--ignore-scripts',
    '--frozen-lockfile=false',
    '--config.confirmModulesPurge=false',
    '--store-dir', store,
  ]);
}

export async function withFixtureMatrix(source, run) {
  const sessionRoot = await mkdtemp(join(tmpdir(), 'blankspace-s2-'));
  const variants = [
    { checkout: join(sessionRoot, 'checkout-a'), store: join(sessionRoot, 'store-a') },
    { checkout: join(sessionRoot, 'nested', 'checkout-b'), store: join(sessionRoot, 'store-b') },
  ];

  try {
    for (const variant of variants) {
      await mkdir(variant.checkout, { recursive: true });
      await cp(source, variant.checkout, { recursive: true });
      await installFixture(variant.checkout, variant.store);
    }
    return await run({ sessionRoot, variants });
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
}

export async function readPnpmVersion() {
  const { stdout } = await runPnpm(['--version']);
  return stdout.trim();
}
