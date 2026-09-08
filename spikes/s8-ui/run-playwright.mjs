import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {writeTranscript} from './transcript.mjs';

const require = createRequire(import.meta.url);
const retainedOutput = process.env.S8_ARTIFACT_DIR;
const output = retainedOutput
  ? resolve(retainedOutput)
  : await mkdtemp(join(tmpdir(), 'blankspace-s8-'));
if (retainedOutput) await mkdir(output, {recursive: true});
const server = await createServer({configFile: new URL('./vite.config.mjs', import.meta.url).pathname});

try {
  await server.listen(0);
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('S8 fixture did not bind a random loopback port.');
  const cli = require.resolve('@playwright/test/cli');
  const requestedArgs = process.argv.slice(2);
  const args = [cli, 'test', '--config', new URL('./playwright.config.mjs', import.meta.url).pathname, ...requestedArgs];
  const status = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: import.meta.dirname,
      stdio: 'inherit',
      env: {...process.env, S8_BASE_URL: `http://127.0.0.1:${address.port}`, S8_OUTPUT_DIR: output},
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
  if (status === 0 && requestedArgs.every((argument) => argument === '--update-snapshots')) await writeTranscript();
  process.exitCode = status;
} finally {
  await server.close();
  if (!retainedOutput) await rm(output, {recursive: true, force: true});
}
