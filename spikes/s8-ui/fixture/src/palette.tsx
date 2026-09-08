import {useEffect, useRef} from 'react';
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
  return <DialogTrigger>
    <Button ref={trigger} className="command-trigger">Commands <kbd>⌘K</kbd></Button>
    <ModalOverlay className="modal-overlay" isDismissable>
      <Modal className="modal"><Dialog className="dialog">
        {({close}) => <>
          <Heading slot="title">Command palette</Heading>
          <div className="command-list">{contributions.commands.map((command) =>
            <Button key={command.id} data-contribution-id={command.id}>{command.label}<small>{command.scope}</small></Button>)}</div>
          <Button onPress={close}>Close</Button>
        </>}
      </Dialog></Modal>
    </ModalOverlay>
  </DialogTrigger>;
}
