import { validateSpec, ENGINE_VERSION, SimulationError } from './engine.mjs';

let nextRun = 0;
function numericBytes(value, buffers = new Set()) {
  if (!value || typeof value !== 'object') return 0;
  if (ArrayBuffer.isView(value)) { buffers.add(value.buffer); return 0; }
  for (const child of Object.values(value)) numericBytes(child, buffers);
  return [...buffers].reduce((total, buffer) => total + buffer.byteLength, 0);
}

export class RunController {
  constructor(workerFactory) {
    this.factory = workerFactory; this.worker = null; this.epoch = 0; this.runId = null;
    this.state = 'idle'; this.sequence = 0; this.processed = 0; this.workerRetainedBytes = 0;
    this.committed = null; this.rejectedEvents = 0; this.history = []; this.waiters = [];
    this.pending = null; this.cancelling = null;
    this.terminationErrors = [];
  }
  stop(worker) {
    const report = error => { this.terminationErrors.push(String(error.message || error)); this.terminationErrors = this.terminationErrors.slice(-8); this.record('termination-error'); return false; };
    try { return Promise.resolve(worker?.terminate()).then(() => true, report); }
    catch (error) { return Promise.resolve(report(error)); }
  }
  record(event) {
    this.history.push({ event, state: this.state, processed: this.processed, atMs: performance.now() });
    if (this.history.length > 64) this.history.shift();
  }
  transition(state) {
    this.state = state; this.record(state);
    for (const waiter of [...this.waiters]) if (waiter.state === state) {
      clearTimeout(waiter.timer); this.waiters.splice(this.waiters.indexOf(waiter), 1); waiter.resolve(this.snapshot());
    }
    if (['completed', 'failed', 'cancelled'].includes(state)) {
      for (const waiter of this.waiters) {
        clearTimeout(waiter.timer);
        waiter.reject(new SimulationError(state === 'completed' ? 'RUN_FINISHED' : 'RUN_ABORTED', `Run ${state} before ${waiter.state} was acknowledged`));
      }
      this.waiters = [];
    }
  }
  rejectPending(message) {
    const error = new SimulationError('RUN_ABORTED', message);
    this.pending?.reject(error); this.pending = null;
    for (const waiter of this.waiters) { clearTimeout(waiter.timer); waiter.reject(error); }
    this.waiters = [];
  }
  start(input, options = {}) {
    const spec = validateSpec(input); // validation leaves an existing committed result untouched
    this.finishCancel(false);
    this.stop(this.worker); this.rejectPending('Run superseded by a replacement');
    const epoch = ++this.epoch;
    this.runId = `fixture-${++nextRun}`; this.sequence = 0; this.processed = 0; this.workerRetainedBytes = 0;
    const completion = new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
    completion.catch(() => {}); // callers still receive the original rejecting promise
    this.worker = this.factory();
    this.worker.onmessage = event => this.accept(event.data, epoch);
    this.worker.onerror = error => {
      if (epoch !== this.epoch) return;
      this.rejectPending(error.message || 'Worker error'); this.stop(this.worker); this.worker = null;
      this.workerRetainedBytes = 0; this.transition('failed');
    };
    this.transition('starting');
    this.worker.postMessage({ type: 'start', runId: this.runId, spec, batchSize: options.batchSize ?? 256, scheduler: options.scheduler ?? 'timeout' });
    return { runId: this.runId, completion };
  }
  accept(message, epoch) {
    const cancelled = this.cancelling;
    if (cancelled && epoch === cancelled.epoch && message?.runId === cancelled.runId && message.type === 'cancelled' && message.engineVersion === ENGINE_VERSION && Number.isSafeInteger(message.sequence) && message.sequence > 0 && message.retainedBytes === 0) {
      this.finishCancel(true, message.retainedBytes); return true;
    }
    const knownType = ['progress', 'running', 'paused', 'completed', 'failed'].includes(message?.type);
    if (!knownType || epoch !== this.epoch || message?.runId !== this.runId || message.engineVersion !== ENGINE_VERSION || !Number.isSafeInteger(message.sequence) || message.sequence <= this.sequence || ['completed', 'cancelled', 'failed'].includes(this.state)) {
      this.rejectedEvents++; return false;
    }
    this.sequence = message.sequence;
    this.processed = message.processed ?? this.processed;
    this.workerRetainedBytes = message.retainedBytes ?? this.workerRetainedBytes;
    if (message.type === 'progress') this.record('progress');
    else if (message.type === 'completed') {
      this.committed = message.result; this.transition('completed');
      this.pending?.resolve(message.result); this.pending = null;
      this.stop(this.worker); this.worker = null;
    } else if (message.type === 'failed') {
      this.rejectPending(`${message.code}: ${message.message}`); this.transition('failed');
      this.stop(this.worker); this.worker = null;
    } else if (['running', 'paused'].includes(message.type)) this.transition(message.type);
    return true;
  }
  waitFor(state, timeoutMs = 3000) {
    if (this.state === state) return Promise.resolve(this.snapshot());
    return new Promise((resolve, reject) => {
      const waiter = { state, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => { this.waiters = this.waiters.filter(w => w !== waiter); reject(new SimulationError('TIMEOUT', `Timed out waiting for ${state}`)); }, timeoutMs);
      this.waiters.push(waiter);
    });
  }
  pause() {
    if (this.state !== 'running') return Promise.reject(new SimulationError('INVALID_TRANSITION', 'Pause requires a running Worker'));
    const ack = this.waitFor('paused'); this.transition('pausing');
    this.worker.postMessage({ type: 'pause', runId: this.runId }); return ack;
  }
  resume() {
    if (this.state !== 'paused') return Promise.reject(new SimulationError('INVALID_TRANSITION', 'Resume requires a paused Worker'));
    const ack = this.waitFor('running'); this.transition('resuming');
    this.worker.postMessage({ type: 'resume', runId: this.runId }); return ack;
  }
  cancel() {
    if (!this.worker) return Promise.resolve({ acknowledged: false, terminated: true, workerRetainedBytes: 0, latencyMs: 0 });
    const worker = this.worker, epoch = this.epoch, runId = this.runId, start = performance.now();
    this.epoch++; this.worker = null; this.runId = null;
    this.rejectPending('Run cancelled'); this.transition('cancelled');
    return new Promise(resolve => {
      const timer = setTimeout(() => this.finishCancel(false), 1000);
      this.cancelling = { worker, epoch, runId, start, timer, resolve };
      worker.postMessage({ type: 'cancel', runId });
    });
  }
  finishCancel(acknowledged, bytes = null) {
    if (!this.cancelling) return;
    const old = this.cancelling; this.cancelling = null; clearTimeout(old.timer);
    this.workerRetainedBytes = 0;
    this.stop(old.worker).then(terminated => old.resolve({ acknowledged, terminated, workerRetainedBytes: bytes, latencyMs: performance.now() - old.start }));
    this.record(acknowledged ? 'cancel-acknowledged' : 'cancel-terminated-after-deadline');
  }
  snapshot() {
    return { state: this.state, runId: this.runId, epoch: this.epoch, sequence: this.sequence, processed: this.processed, workerRetainedBytes: this.workerRetainedBytes, committedNumericBytes: numericBytes(this.committed), rejectedEvents: this.rejectedEvents, terminationErrors: [...this.terminationErrors], history: this.history.map(event => ({ ...event })) };
  }
  dispose() {
    this.epoch++; this.finishCancel(false); this.stop(this.worker); this.worker = null;
    this.rejectPending('Controller disposed'); this.committed = null; this.workerRetainedBytes = 0; this.transition('idle');
  }
}
