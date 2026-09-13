import {compileContributions} from './contribution-compiler.mjs';

export function comparePreviousMinor(previousSource, currentSource) {
  const previous = compileContributions(previousSource);
  const current = compileContributions(currentSource);
  const semantic = (value) => JSON.stringify({
    routes: value.routes.map(({id, path, access}) => ({id, path, access})),
    navigation: value.navigation.map(({id, routeId, region}) => ({id, routeId, region})),
    commands: value.commands.map(({id, scope}) => ({id, scope})),
  });
  if (semantic(previous) !== semantic(current)) {
    return {compatible: false, diagnostics: [{
      code: 'E_UI_COMPATIBILITY', message: 'Previous-minor Shell contributions changed public semantics.',
    }]};
  }
  return {compatible: true, diagnostics: []};
}

export function assessPublicOverride(overrideId) {
  return {compatible: false, review: 'manual', diagnostics: [{
    code: 'E_UI_OVERRIDE_REVIEW_REQUIRED',
    message: `Public Override ${overrideId} requires manual compatibility review.`,
  }]};
}
