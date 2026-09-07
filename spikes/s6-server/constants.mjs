export const SERVER_OPTIONS = Object.freeze({
  logger: false,
  trustProxy: false,
  return503OnClosing: true,
  forceCloseConnections: 'idle',
  bodyLimit: 1_048_576,
  requestTimeout: 5_000,
  handlerTimeout: 5_000,
  keepAliveTimeout: 1_000,
});

export const BUDGETS = Object.freeze({
  startupDeadlineMs: 5_000,
  shutdownDeadlineMs: 1_000,
  clientRequestDeadlineMs: 2_000,
  harnessDeadlineMs: 15_000,
});

export const CORE_SCENARIO_IDS = Object.freeze([
  'normal-start-stop',
  'listen-address-in-use',
  'route-registration-failure',
  'signal-shared-stop',
  'slow-request-drain',
  'request-drain-timeout',
  'background-stop-timeout',
  'repeated-concurrent-stop',
  'stop-before-ready',
  'handler-failure',
]);

const ALLOWED_CAUSE_CODES = new Set([
  'EADDRINUSE',
  'FST_ERR_DUPLICATED_ROUTE',
  'FIXTURE_HANDLER_FAILURE',
  'FIXTURE_CLOSE_FAILURE',
]);

const MESSAGES = Object.freeze({
  E_SERVER_ROUTE_REGISTER: 'Server route registration failed.',
  E_SERVER_LISTEN: 'Server listen failed.',
  E_SERVER_HANDLER_FAILED: 'Server request handler failed.',
  E_SERVER_CLOSE_FAILED: 'Server close failed.',
  E_SERVER_START_ABORTED: 'Server start was aborted before Runtime became ready.',
  E_SERVER_SHUTDOWN_TIMEOUT: 'Server host shutdown exceeded its deadline.',
});

export function diagnostic(code, fields) {
  const causeCode = ALLOWED_CAUSE_CODES.has(fields.causeCode) ? fields.causeCode : undefined;
  return {
    code,
    severity: 'error',
    phase: fields.phase,
    ownerId: fields.ownerId,
    operation: fields.operation,
    message: MESSAGES[code],
    ...(causeCode === undefined ? {} : { causeCode }),
    ...(fields.trigger === undefined ? {} : { trigger: fields.trigger }),
    ...(fields.deadlineMs === undefined ? {} : { deadlineMs: fields.deadlineMs }),
    ...(fields.activeRequestCount === undefined ? {} : { activeRequestCount: fields.activeRequestCount }),
    ...(fields.pendingOwners === undefined ? {} : { pendingOwners: [...fields.pendingOwners].sort() }),
  };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
