import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

const root = resolve(import.meta.dirname, '..');
const uiRoot = join(root, 'docs', 'schemas', 'proposed', 'ui');
const fixtureRoot = join(uiRoot, 'fixtures');
const ajv = new Ajv2020({ strict: true });
ajv.addKeyword({ keyword: 'x-semanticConstraints', schemaType: 'array' });

function semanticErrors(document) {
  const errors = [];
  const routeIds = document.routes.map(route => route.id);
  const navigationIds = document.navigation.map(item => item.id);
  const templateIds = document.templates.map(template => template.id);
  if (new Set(routeIds).size !== routeIds.length) errors.push('duplicate route ID');
  if (new Set(navigationIds).size !== navigationIds.length) errors.push('duplicate navigation ID');
  if (new Set(templateIds).size !== templateIds.length) errors.push('duplicate template ID');

  const routeSet = new Set(routeIds);
  if (document.routes.some(route => route.index === true ? route.path !== undefined : route.path === undefined)) {
    errors.push('index/path route shape mismatch');
  }
  if (document.navigation.some(item => !routeSet.has(item.routeId))) errors.push('dangling navigation route');
  if (document.routes.some(route => route.parentId !== undefined && !routeSet.has(route.parentId))) {
    errors.push('dangling route parent');
  }

  const parents = new Map(document.routes.map(route => [route.id, route.parentId]));
  for (const routeId of routeIds) {
    const seen = new Set();
    let current = routeId;
    while (current !== undefined) {
      if (seen.has(current)) {
        errors.push('route parent cycle');
        break;
      }
      seen.add(current);
      current = parents.get(current);
    }
  }

  if (document.navigation.filter(item => item.region === 'mobile-primary').length > 5) {
    errors.push('mobile-primary exceeds five entries');
  }
  const supportedRegions = new Set(document.templates.flatMap(template => template.supportedRegions));
  if (document.navigation.some(item => !supportedRegions.has(item.region))) errors.push('unsupported navigation region');
  return errors;
}

let passed = 0;
const validators = new Map();
for (const name of readdirSync(fixtureRoot).filter(file => file.endsWith('.json')).sort()) {
  const fixture = JSON.parse(readFileSync(join(fixtureRoot, name), 'utf8'));
  const schemaPath = join(dirname(fixtureRoot), fixture.schema);
  if (!validators.has(schemaPath)) {
    validators.set(schemaPath, ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8'))));
  }
  const validate = validators.get(schemaPath);
  const schemaValid = validate(fixture.document);
  const errors = schemaValid ? semanticErrors(fixture.document) : [];
  const actual = schemaValid && errors.length === 0;
  if (actual !== fixture.valid) {
    const details = schemaValid ? errors.join(', ') : ajv.errorsText(validate.errors);
    throw new Error(`${name}: expected valid=${fixture.valid}, got ${actual}: ${details}`);
  }
  passed += 1;
}

console.log(`validated ${passed} proposed UI contract fixtures`);
