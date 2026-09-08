import assert from 'node:assert/strict';
import test from 'node:test';
import {compileContributions, readContributionSource} from './contribution-compiler.mjs';

test('S8 compiler emits the frozen enabled contribution set', async () => {
  const compiled = compileContributions(await readContributionSource());
  assert.deepEqual(compiled.routes.map(({id}) => id), [
    'help', 'home', 'project-detail', 'project-edit', 'projects', 'settings',
  ]);
  assert.deepEqual(compiled.navigation.map(({id}) => id), [
    'nav.home', 'nav.mobile.home', 'nav.mobile.projects', 'nav.projects',
    'nav.settings', 'nav.help', 'nav.mobile.more',
  ]);
  assert.deepEqual(compiled.commands.map(({id}) => id), [
    'command.edit-project', 'command.help', 'command.new-project', 'command.search',
  ]);
  assert.equal(JSON.stringify(compiled).includes('billing'), false);
});

test('S8 compiler rejects duplicate public IDs before rendering', async () => {
  const source = await readContributionSource();
  source.routes.push({...source.routes[0]});
  assert.throws(() => compileContributions(source), {code: 'E_UI_CONTRIBUTION_MISMATCH'});
});
