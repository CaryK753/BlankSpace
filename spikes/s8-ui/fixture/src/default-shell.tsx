import type {ReactNode} from 'react';
import {Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay} from 'react-aria-components';
import {Navigation} from './nav.js';
import {CommandPalette} from './palette.js';
import type {ContributionSet, RouteContribution} from './model.js';

interface Props {children: ReactNode; contributions: ContributionSet; route: RouteContribution}

export function DefaultShell({children, contributions, route}: Props) {
  return <div className="default-shell" data-shell="default-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar">
      <a className="brand" href="/app" aria-label="Blankspace home"><span>[ ]</span> blankspace</a>
      <Navigation contributions={contributions}/>
      <p className="sidebar-note">Modular product foundation</p>
    </aside>
    <header className="topbar">
      <DialogTrigger>
        <Button className="menu-button" aria-label="Open navigation">Menu</Button>
        <ModalOverlay className="modal-overlay drawer-overlay" isDismissable><Modal className="drawer">
          <Dialog>{({close}) => <><Heading slot="title">Workspace navigation</Heading>
            <Navigation contributions={contributions}/><Button onPress={close}>Close navigation</Button></>}</Dialog>
        </Modal></ModalOverlay>
      </DialogTrigger>
      <div><span className="breadcrumb">Workspace / {route.title}</span><h1 tabIndex={-1}>{route.title}</h1></div>
      <CommandPalette contributions={contributions}/>
    </header>
    <main id="main-content">{children}</main>
    <Navigation contributions={contributions} mobile/>
  </div>;
}
