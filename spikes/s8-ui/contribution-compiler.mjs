import {readFile} from 'node:fs/promises';

export const contributionUrl = new URL('./fixture/contributions.json', import.meta.url);

export async function readContributionSource() {
  return JSON.parse(await readFile(contributionUrl, 'utf8'));
}

export function compileContributions(source) {
  assertShape(source);
  const enabled = (entry) => source.kits[entry.kit] === true;
  const routes = stable(source.routes.filter(enabled));
  const routeIds = uniqueIds(routes, 'route');
  const navigation = stable(source.navigation.filter(enabled));
  uniqueIds(navigation, 'navigation');
  const commands = stable(source.commands.filter(enabled));
  uniqueIds(commands, 'command');
  for (const entry of navigation) {
    if (!routeIds.has(entry.routeId)) fail('E_UI_ROUTE_IDENTITY', `Navigation ${entry.id} references missing route ${entry.routeId}.`);
  }
  for (const collection of [routes, navigation, commands]) {
    if (collection.some((entry) => entry.kit === 'billing')) {
      fail('E_UI_DISABLED_CAPABILITY', 'Disabled billing contribution escaped compilation.');
    }
  }
  return {schemaVersion: '1', routes, navigation, commands};
}

function stable(entries) {
  return [...entries].sort((left, right) =>
    (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id));
}

function uniqueIds(entries, kind) {
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) fail('E_UI_CONTRIBUTION_MISMATCH', `Duplicate ${kind} ID ${entry.id}.`);
    ids.add(entry.id);
  }
  return ids;
}

function assertShape(source) {
  if (source?.schemaVersion !== '1' || !source.kits || !Array.isArray(source.routes)
    || !Array.isArray(source.navigation) || !Array.isArray(source.commands)) {
    fail('E_UI_CONTRIBUTION_MISMATCH', 'Contribution source does not match schema version 1.');
  }
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
