import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {compileContributions, readContributionSource} from './contribution-compiler.mjs';
import {chromium, firefox, webkit} from '@playwright/test';

const require = createRequire(import.meta.url);
function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

async function packageVersion(name) {
  let directory = dirname(require.resolve(name));
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (manifest.name === name) return manifest.version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    directory = dirname(directory);
  }
  throw new Error(`Cannot resolve S8 package version for ${name}.`);
}

async function hashFile(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

async function browserExecutables() {
  const revisions = {chromium: '1243', firefox: '1543', webkit: '2359'};
  return Object.fromEntries(await Promise.all(Object.entries({chromium, firefox, webkit})
    .map(async ([name, browser]) => {
      const path = browser.executablePath();
      const marker = `${name}-${revisions[name]}`;
      const markerIndex = path.lastIndexOf(marker);
      if (markerIndex < 0) throw new Error(`Unexpected ${name} executable path: ${path}`);
      return [name, {installationPath: path.slice(markerIndex), sha256: await hashFile(path)}];
    })));
}

export async function createTranscript() {
  const fixture = compileContributions(await readContributionSource());
  const lock = await readFile(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8');
  const sources = await Promise.all([
    'compatibility.mjs', 'contribution-compiler.mjs', 'playwright.config.mjs', 'tests/shells.spec.ts',
    'fixture/src/app.tsx', 'fixture/src/default-shell.tsx', 'fixture/src/workbench-shell.tsx',
    'fixture/src/nav.tsx', 'fixture/src/palette.tsx', 'fixture/src/screen-state.tsx',
    'fixture/src/styles.css', 'fixture/src/theme.css', 'fixture/contributions.json',
    'fixture/previous-minor-contributions.json',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  const matrix = {shells: 2, states: 8, viewports: 3, browserProjects: 3,
    behaviorChecks: 45, accessibilityScans: 144, visualComparisons: 20};
  const environment = {
    platform: process.platform, arch: process.arch, node: process.version,
    packages: Object.fromEntries(await Promise.all(['react', 'react-dom', 'react-router', 'react-aria-components',
      '@playwright/test', '@axe-core/playwright', 'axe-core', '@fontsource-variable/inter']
      .map(async (name) => [name, await packageVersion(name)]))),
    browsers: {chromium: '1243', firefox: '1543', webkit: '2359'},
    browserExecutables: await browserExecutables(),
  };
  const sourceHash = hash(sources.join('\n'));
  const base = {schemaVersion: '1', environment, sourceRevision: `worktree:${sourceHash}`,
    lockHash: hash(lock), fixtureHash: hash(fixture), matrix, diagnostics: []};
  const ci = process.env.GITHUB_ACTIONS === 'true' ? {
    sourceCommit: process.env.GITHUB_SHA,
    runnerOS: process.env.RUNNER_OS,
    runnerArch: process.env.RUNNER_ARCH,
    imageOS: process.env.ImageOS,
    imageVersion: process.env.ImageVersion,
  } : undefined;
  return {...base, ...(ci ? {ci} : {}), matrixHash: hash(base)};
}

export async function writeTranscript(targetFile) {
  const transcript = await createTranscript();
  const file = targetFile ?? join(new URL('./transcripts/', import.meta.url).pathname,
    `${process.platform}-${process.arch}.json`);
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, `${JSON.stringify(transcript, null, 2)}\n`);
  return file;
}
