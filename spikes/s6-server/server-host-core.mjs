import Fastify from 'fastify';

import { BUDGETS, SERVER_OPTIONS, deferred, diagnostic } from './constants.mjs';

function fixtureError(code) {
  const error = new Error('Fixture failure.');
  error.code = code;
  return error;
}

export class ServerHost {
  #activeRequests = new Set();
  #backgroundGate;
  #beforeReadyGate;
  #closeGate;
  #diagnostics = [];
  #fastify;
  #onListening;
  #registrationError = null;
  #slowGate;
  #stopTask = null;

  constructor(options = {}) {
    this.behavior = options;
    this.state = 'idle';
    this.readyCount = 0;
    this.listenCount = 0;
    this.serverCloseCount = 0;
    this.stopInvocationCount = 0;
    this.entryStopCounts = { A: 0, B: 0 };
    this.trace = [];
    this.#slowGate = options.slowGate ?? deferred();
    this.#backgroundGate = options.backgroundGate ?? null;
    this.#beforeReadyGate = options.beforeReadyGate ?? null;
    this.#closeGate = options.closeGate ?? null;
    this.#onListening = options.onListening ?? (() => {});
    this.#fastify = Fastify(SERVER_OPTIONS);
    this.#registerRoutes();
  }

  get port() {
    const address = this.#fastify.server.address();
    return typeof address === 'object' && address !== null ? address.port : null;
  }

  get diagnostics() {
    return this.#diagnostics.map(item => ({ ...item }));
  }

  get activeRequestCount() {
    return this.#activeRequests.size;
  }

  get pendingOwners() {
    const owners = [...this.#activeRequests];
    if (this.behavior.backgroundStuck) owners.push('entry:B/background:fixture');
    return owners.sort();
  }

  async start({ port = 0 } = {}) {
    if (this.#registrationError !== null) {
      this.state = 'failed';
      throw this.#registrationError;
    }
    this.state = 'starting';
    this.trace.push('start:entry:A', 'start:entry:B', 'server:listen');
    try {
      await this.#fastify.listen({ host: '127.0.0.1', port });
      this.listenCount += 1;
    } catch (error) {
      this.state = 'failed';
      const normalized = diagnostic('E_SERVER_LISTEN', {
        phase: 'start', ownerId: 'server:fastify', operation: 'listen', causeCode: error?.code,
      });
      this.#diagnostics.push(normalized);
      await this.#stopEntries();
      throw normalized;
    }

    await this.#onListening(this);
    if (this.#beforeReadyGate !== null) await this.#beforeReadyGate.promise;
    if (this.state !== 'starting') {
      this.#diagnostics.push(diagnostic('E_SERVER_START_ABORTED', {
        phase: 'start', ownerId: 'server:fastify', operation: 'runtime-stop',
      }));
      return { status: 'stopped-before-ready' };
    }
    this.state = 'ready';
    this.readyCount += 1;
    this.trace.push('runtime:ready');
    return { status: 'ready' };
  }

  requestStop(trigger = 'api') {
    this.stopInvocationCount += 1;
    if (this.#stopTask !== null) return this.#stopTask;
    this.#stopTask = this.#boundedStop(trigger);
    return this.#stopTask;
  }

  releaseSlowRequest() {
    this.#slowGate.resolve();
  }

  releaseCloseBarrier() {
    this.#closeGate?.release.resolve();
  }

  snapshot(outcome, exitClassification) {
    return {
      outcome,
      state: this.state,
      readyCount: this.readyCount,
      listenCount: this.listenCount,
      serverCloseCount: this.serverCloseCount,
      stopInvocationCount: this.stopInvocationCount,
      entryStopCounts: { ...this.entryStopCounts },
      diagnostics: this.diagnostics,
      trace: [...this.trace],
      activeRequestCount: this.activeRequestCount,
      pendingOwners: this.pendingOwners,
      resourceBalance: this.pendingOwners.length,
      exitClassification,
    };
  }

  async #boundedStop(trigger) {
    this.state = 'stopping';
    this.trace.push(`runtime:stopping:${trigger}`);
    let timer;
    const timedOut = Symbol('timed-out');
    const deadline = new Promise(resolve => {
      timer = setTimeout(() => resolve(timedOut), BUDGETS.shutdownDeadlineMs);
    });
    const result = await Promise.race([this.#cleanStop(), deadline]);
    clearTimeout(timer);
    if (result === timedOut) {
      this.state = 'timed-out';
      const pendingOwners = this.pendingOwners;
      this.#diagnostics.push(diagnostic('E_SERVER_SHUTDOWN_TIMEOUT', {
        phase: 'terminate', ownerId: 'host:process', operation: 'host-terminate', trigger,
        deadlineMs: BUDGETS.shutdownDeadlineMs,
        activeRequestCount: this.activeRequestCount,
        pendingOwners,
      }));
      this.trace.push('host:shutdown-timeout');
      return { status: 'timeout', pendingOwners };
    }
    this.state = 'stopped';
    this.trace.push('runtime:stopped');
    return { status: 'stopped' };
  }

  async #cleanStop() {
    await this.#closeServer();
    if (this.#backgroundGate !== null) {
      this.trace.push('stop:entry:B/background:fixture');
      await this.#backgroundGate.promise;
    }
    await this.#stopEntries();
  }

  async #stopEntries() {
    for (const id of ['B', 'A']) {
      this.entryStopCounts[id] += 1;
      this.trace.push(`stop:entry:${id}`);
    }
  }

  async #closeServer() {
    this.serverCloseCount += 1;
    this.trace.push('server:close');
    try {
      await this.#fastify.close();
    } catch (error) {
      this.#diagnostics.push(diagnostic('E_SERVER_CLOSE_FAILED', {
        phase: 'stop', ownerId: 'server:fastify', operation: 'server-close', causeCode: error?.code,
      }));
    }
  }

  #registerRoutes() {
    try {
      this.#fastify.get('/health/live', async () => ({ status: 'live' }));
      this.#fastify.get('/health/ready', async (_request, reply) => {
        if (this.state !== 'ready') return reply.code(503).send({ status: 'not-ready' });
        return { status: 'ready' };
      });
      this.#fastify.get('/fixtures/slow', async () => {
        const owner = 'request:slow-1';
        this.#activeRequests.add(owner);
        this.trace.push(`request:start:${owner}`);
        this.behavior.onSlowEntered?.();
        try {
          await this.#slowGate.promise;
          return { status: 'released' };
        } finally {
          this.#activeRequests.delete(owner);
          this.trace.push(`request:end:${owner}`);
        }
      });
      this.#fastify.get('/fixtures/fail', async () => { throw fixtureError('FIXTURE_HANDLER_FAILURE'); });
      this.#fastify.setErrorHandler((error, _request, reply) => {
        if (error?.code === 'FIXTURE_HANDLER_FAILURE') {
          this.#diagnostics.push(diagnostic('E_SERVER_HANDLER_FAILED', {
            phase: 'ready', ownerId: 'route:fixtures/fail', operation: 'request', causeCode: error.code,
          }));
        }
        return reply.code(500).send({ code: 'E_INTERNAL' });
      });
      if (this.#closeGate !== null) {
        this.#fastify.addHook('preClose', async () => {
          this.#closeGate.entered.resolve();
          await this.#closeGate.release.promise;
        });
      }
      if (this.behavior.closeFailure) {
        this.#fastify.addHook('onClose', async () => { throw fixtureError('FIXTURE_CLOSE_FAILURE'); });
      }
      if (this.behavior.duplicateRoute) {
        this.#fastify.get('/fixtures/conflict', async () => ({}));
        this.#fastify.get('/fixtures/conflict', async () => ({}));
      }
    } catch (error) {
      const normalized = diagnostic('E_SERVER_ROUTE_REGISTER', {
        phase: 'register', ownerId: 'server:fastify', operation: 'route-register', causeCode: error?.code,
      });
      this.#diagnostics.push(normalized);
      this.#registrationError = normalized;
    }
  }
}
