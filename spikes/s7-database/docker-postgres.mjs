import {execFile} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import pg from 'pg';
import {BUDGETS, DATABASE, IMAGE_DIGEST, IMAGE_RUNTIME, USER} from './constants.mjs';

const execFileAsync = promisify(execFile);
let sequence = 0;

async function docker(args, timeout = 30_000) {
  const {stdout} = await execFileAsync('docker', args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout.trim();
}

export async function inspectImage() {
  const raw = await docker(['image', 'inspect', IMAGE_RUNTIME]);
  const [image] = JSON.parse(raw);
  if (!image.RepoDigests?.some((value) => value.endsWith(`@${IMAGE_DIGEST}`))) {
    throw new Error('S7_IMAGE_DIGEST_MISMATCH');
  }
  if (image.Os !== 'linux' || !['amd64', 'arm64'].includes(image.Architecture)) {
    throw new Error('S7_IMAGE_PLATFORM_UNSUPPORTED');
  }
  return {architecture: image.Architecture, os: image.Os};
}

export async function withPostgres(scenarioId, execute) {
  sequence += 1;
  const token = `${process.pid}-${sequence}`;
  const prefix = `blankspace-s7-${token}`;
  const names = {container: `${prefix}-db`, network: `${prefix}-net`, volume: `${prefix}-data`};
  const label = `blankspace.s7.run=${token}`;
  const temp = await mkdtemp(join(tmpdir(), 'blankspace-s7-'));
  const secret = join(temp, 'postgres-password');
  const password = `s7-${token}-fixture-only`;
  const acquired = [];
  let pool;
  try {
    await writeFile(secret, `${password}\n`, {mode: 0o600});
    await docker(['network', 'create', '--label', label, names.network]);
    acquired.push(['network', names.network]);
    await docker(['volume', 'create', '--label', label, names.volume]);
    acquired.push(['volume', names.volume]);
    await docker([
      'create', '--name', names.container, '--label', label, '--network', names.network,
      '-p', '127.0.0.1::5432', '-e', `POSTGRES_DB=${DATABASE}`, '-e', `POSTGRES_USER=${USER}`,
      '-e', 'POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password', '-e', 'TZ=UTC',
      '--mount', `type=volume,src=${names.volume},dst=/var/lib/postgresql`,
      '--mount', `type=bind,src=${secret},dst=/run/secrets/postgres-password,readonly`, IMAGE_RUNTIME,
    ]);
    acquired.push(['container', names.container]);
    await docker(['start', names.container], BUDGETS.containerStartupDeadlineMs);
    const port = await waitUntilReady(names.container);
    pool = new pg.Pool({
      host: '127.0.0.1', port, database: DATABASE, user: USER, password,
      max: 4, connectionTimeoutMillis: BUDGETS.connectionDeadlineMs,
      idleTimeoutMillis: 1_000, allowExitOnIdle: true,
    });
    await waitForDriver(pool, Date.now() + BUDGETS.connectionDeadlineMs);
    const result = await execute({pool, names, token});
    return {...result, resources: {acquired: 4, released: 4, balance: 0}};
  } catch (error) {
    const logs = acquired.some(([kind]) => kind === 'container')
      ? await docker(['logs', '--tail', '40', names.container]).catch(() => '')
      : '';
    throw new Error(`S7 scenario ${scenarioId} failed.${logs ? `\n${logs}` : ''}`, {cause: error});
  } finally {
    if (pool) await pool.end().catch(() => {});
    await docker(['rm', '-f', names.container]).catch(() => {});
    await docker(['volume', 'rm', names.volume]).catch(() => {});
    await docker(['network', 'rm', names.network]).catch(() => {});
    await rm(temp, {recursive: true, force: true});
  }
}

async function waitForDriver(pool, deadline) {
  let lastError;
  while (Date.now() < deadline) {
    try {
      await pool.query('SELECT 1');
      const version = await pool.query('SHOW server_version');
      if (!version.rows[0].server_version.startsWith('18.6')) throw new Error('S7_POSTGRES_VERSION_MISMATCH');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError ?? new Error('S7_DRIVER_READINESS_TIMEOUT');
}

async function waitUntilReady(container) {
  const deadline = Date.now() + BUDGETS.containerStartupDeadlineMs;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      await docker(['exec', container, 'pg_isready', '-U', USER, '-d', DATABASE], 5_000);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!ready) throw new Error('S7_POSTGRES_STARTUP_TIMEOUT');
  const mapping = await docker(['port', container, '5432/tcp']);
  const match = mapping.match(/127\.0\.0\.1:(\d+)/);
  if (!match) throw new Error('S7_LOOPBACK_PORT_MISSING');
  return Number(match[1]);
}

export async function assertNoS7Resources() {
  const [containers, volumes, networks] = await Promise.all([
    docker(['ps', '-aq', '--filter', 'label=blankspace.s7.run']),
    docker(['volume', 'ls', '-q', '--filter', 'label=blankspace.s7.run']),
    docker(['network', 'ls', '-q', '--filter', 'label=blankspace.s7.run']),
  ]);
  const leftovers = [containers, volumes, networks].flatMap((value) => value ? value.split('\n') : []);
  if (leftovers.length > 0) throw new Error(`S7_RESOURCE_LEAK:${leftovers.length}`);
}
