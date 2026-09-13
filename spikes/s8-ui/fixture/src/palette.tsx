import {useEffect, useRef} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent} from 'react';
import {Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay} from 'react-aria-components';
import type {ContributionSet} from './model.js';

export function CommandPalette({contributions}: {contributions: ContributionSet}) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        trigger.current?.focus();
        trigger.current?.click();
      }
    };
    window.addEventListener('keydown', open);
    return () => window.removeEventListener('keydown', open);
  }, []);
  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const current = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % buttons.length
        : (current - 1 + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
  };
  return <DialogTrigger>
    <Button ref={trigger} className="command-trigger">Commands <kbd>⌘K</kbd></Button>
    <ModalOverlay className="modal-overlay" isDismissable>
      <Modal className="modal"><Dialog className="dialog">
        {({close}) => <>
          <Heading slot="title">Command palette</Heading>
          <div className="command-list" onKeyDown={moveFocus}>{contributions.commands.map((command) =>
            <Button key={command.id} data-contribution-id={command.id}>{command.label}<small>{command.scope}</small></Button>)}</div>
          <Button onPress={close}>Close</Button>
        </>}
      </Dialog></Modal>
    </ModalOverlay>
  </DialogTrigger>;
}
