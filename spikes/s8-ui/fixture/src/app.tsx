import {useEffect, useMemo, useRef} from 'react';
import {createBrowserRouter, RouterProvider, useLocation, useMatches} from 'react-router';
import {DefaultShell} from './default-shell.js';
import {ScreenStateView} from './screen-state.js';
import type {ContributionSet, RouteContribution, ScreenState, ShellId} from './model.js';
import {states} from './model.js';
import {WorkbenchShell} from './workbench-shell.js';

function routeElement(contributions: ContributionSet, route: RouteContribution) {
  return <RouteScreen contributions={contributions} route={route}/>;
}

export function App({contributions}: {contributions: ContributionSet}) {
  const router = useMemo(() => createBrowserRouter(contributions.routes.map((route) => ({
    id: route.id, path: route.path, handle: route, element: routeElement(contributions, route),
  }))), [contributions]);
  return <RouterProvider router={router}/>;
}

function RouteScreen({contributions, route}: {contributions: ContributionSet; route: RouteContribution}) {
  const location = useLocation();
  const matches = useMatches();
  const live = useRef<HTMLParagraphElement>(null);
  const query = new URLSearchParams(location.search);
  const requestedState = query.get('state');
  const state: ScreenState = states.find((value) => value === requestedState) ?? 'ready';
  const shell: ShellId = query.get('shell') === 'workbench-shell' ? 'workbench-shell' : 'default-shell';
  useEffect(() => {
    document.title = `${route.title} · Blankspace`;
    document.querySelector<HTMLElement>('h1')?.focus();
    if (live.current) live.current.textContent = `${route.title} loaded`;
  }, [location.pathname, route.title]);
  const content = <>
    <p className="route-meta">Route <code>{matches.at(-1)?.id}</code> · Fixed synthetic data</p>
    <ScreenStateView state={state}/>
    <p ref={live} className="sr-only" aria-live="polite"/>
  </>;
  return shell === 'workbench-shell'
    ? <WorkbenchShell contributions={contributions} route={route}>{content}</WorkbenchShell>
    : <DefaultShell contributions={contributions} route={route}>{content}</DefaultShell>;
}
