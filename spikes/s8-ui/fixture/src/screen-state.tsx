import {Button} from 'react-aria-components';
import type {ScreenState} from './model.js';

const copy: Record<ScreenState, {title: string; detail: string; action: string}> = {
  loading: {title: 'Loading workspace', detail: 'Fetching the latest project data.', action: 'Cancel'},
  empty: {title: 'No projects yet', detail: 'Create a project to begin composing your product.', action: 'Create project'},
  ready: {title: 'Quarterly launch', detail: '12 modules · Updated January 15, 2026', action: 'Open project'},
  refreshing: {title: 'Quarterly launch', detail: 'Refreshing while existing content remains available.', action: 'Stop refresh'},
  error: {title: 'Project could not load', detail: 'Reference UI-204. Your navigation remains available.', action: 'Try again'},
  'permission-denied': {title: 'Access unavailable', detail: 'Ask an administrator for the required access.', action: 'Return home'},
  offline: {title: 'You are offline', detail: 'Saved content remains available until you reconnect.', action: 'Retry connection'},
  unsupported: {title: 'Renderer unavailable', detail: 'This screen needs a capability that is not installed.', action: 'View supported screens'},
};

export function ScreenStateView({state}: {state: ScreenState}) {
  const value = copy[state];
  return <section className={`state state-${state}`} aria-busy={state === 'loading' || state === 'refreshing'}>
    <span className="eyebrow">{state.replace('-', ' ')}</span>
    <h2>{value.title}</h2>
    <p>{value.detail}</p>
    {state === 'ready' || state === 'refreshing' ? <div className="project-grid" role="group" aria-label="Project summary">
      <div><strong>68%</strong><span>Launch readiness</span></div>
      <div><strong>24</strong><span>Open decisions</span></div>
      <div><strong>4</strong><span>Contributors</span></div>
    </div> : null}
    <Button className="primary-action">{value.action}</Button>
  </section>;
}
