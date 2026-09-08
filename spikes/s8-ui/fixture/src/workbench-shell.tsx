import type {ReactNode} from 'react';
import {Button} from 'react-aria-components';
import {Navigation} from './nav.js';
import {CommandPalette} from './palette.js';
import type {ContributionSet, RouteContribution} from './model.js';

interface Props {children: ReactNode; contributions: ContributionSet; route: RouteContribution}

export function WorkbenchShell({children, contributions, route}: Props) {
  return <div className="workbench-shell" data-shell="workbench-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="workbench-header">
      <a className="brand" href="/app" aria-label="Blankspace home"><span>[ ]</span> blankspace</a>
      <div className="workspace-title"><small>Product studio</small><h1 tabIndex={-1}>{route.title}</h1></div>
      <CommandPalette contributions={contributions}/>
    </header>
    <aside className="command-rail" aria-label="Workbench tools">
      <Button aria-label="Compose">C</Button><Button aria-label="Inspect">I</Button><Button aria-label="Extend">E</Button>
    </aside>
    <main id="main-content">{children}</main>
    <aside className="inspector" aria-label="Inspector">
      <span className="eyebrow">Inspector</span><h2>Route contract</h2>
      <dl><dt>Route ID</dt><dd>{route.id}</dd><dt>Access</dt><dd>{route.access}</dd></dl>
      <Navigation contributions={contributions}/>
    </aside>
    <Navigation contributions={contributions} mobile/>
  </div>;
}
