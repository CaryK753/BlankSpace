import {NavLink, useLocation} from 'react-router';
import type {ContributionSet} from './model.js';

function pathFor(contributions: ContributionSet, routeId: string) {
  const path = contributions.routes.find((route) => route.id === routeId)?.path ?? '/app';
  return path.replace(':projectId', 'alpha');
}

export function Navigation({contributions, mobile = false}: {contributions: ContributionSet; mobile?: boolean}) {
  const {search} = useLocation();
  const items = contributions.navigation.filter((entry) => mobile
    ? entry.region.startsWith('mobile-')
    : !entry.region.startsWith('mobile-'));
  return <nav aria-label={mobile ? 'Mobile navigation' : 'Workspace navigation'} className={mobile ? 'mobile-nav' : 'side-nav'}>
    {items.map((entry) => <NavLink key={entry.id} to={`${pathFor(contributions, entry.routeId)}${search}`}
      data-contribution-id={entry.id} className={({isActive}) => isActive ? 'active' : undefined}>
      <span aria-hidden="true" className="nav-mark">{entry.label.slice(0, 1)}</span><span>{entry.label}</span>
    </NavLink>)}
  </nav>;
}
