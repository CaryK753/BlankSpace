import { deferred } from './constants.mjs';
import { ServerHost } from './server-host-core.mjs';

let host;
let handled = 0;
let terminalSent = false;
const closeGate = { entered: deferred(), release: deferred() };

async function handleSignal(signal) {
  handled += 1;
  const stopping = host.requestStop(signal);
  if (handled === 1) {
    process.send?.({ type: 'stopping', signal });
    await closeGate.entered.promise;
  } else {
    closeGate.release.resolve();
  }
  const terminal = await stopping;
  if (terminalSent) return;
  terminalSent = true;
  const report = {
    signal,
    handlerInvocationCount: handled,
    ...host.snapshot(terminal.status, 'zero'),
  };
  process.send?.({ type: 'terminal', report }, error => {
    if (error) process.exit(2);
    process.exitCode = 0;
    process.disconnect?.();
  });
}

process.on('SIGTERM', () => { void handleSignal('SIGTERM'); });
process.on('SIGINT', () => { void handleSignal('SIGINT'); });

host = new ServerHost({ closeGate });
await host.start();
process.send?.({ type: 'ready' });
