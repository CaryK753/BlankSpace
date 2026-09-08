import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {assessPublicOverride, comparePreviousMinor} from './compatibility.mjs';
import {readContributionSource} from './contribution-compiler.mjs';

test('previous-minor Shell consumes the unchanged public contribution contract', async () => {
  const [previous, current] = await Promise.all([
    readFile(new URL('./fixture/previous-minor-contributions.json', import.meta.url), 'utf8').then(JSON.parse),
    readContributionSource(),
  ]);
  assert.deepEqual(comparePreviousMinor(previous, current), {compatible: true, diagnostics: []});
});

test('Public Override is never promoted without manual review', () => {
  assert.deepEqual(assessPublicOverride('product.brand-shell'), {
    compatible: false,
    review: 'manual',
    diagnostics: [{
      code: 'E_UI_OVERRIDE_REVIEW_REQUIRED',
      message: 'Public Override product.brand-shell requires manual compatibility review.',
    }],
  });
});
