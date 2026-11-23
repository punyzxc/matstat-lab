import { createEngine, advance, finish, retainedBytes, transferBuffers, ENGINE_VERSION, LIMITS } from './engine.mjs';

let active = null, sequence = 0, token = 0, timer = null, channel = null, queued = null;
const post = (type, extra = {}, transfers = []) => globalThis.postMessage({ type, runId: active.id, sequence: ++sequence, engineVersion: ENGINE_VERSION, ...extra }, transfers);
function clearSchedule() {
  token++;
  if (timer !== null) clearTimeout(timer);
  timer = null; queued = null;
  if (channel) { channel.port1.close(); channel.port2.close(); channel = null; }
}
function schedule() {
  const expected = token;
  const callback = () => { timer = null; if (expected === token && active?.status === 'running') pump(); };
  // MessageChannel alone can drain its own task source and starve incoming control messages.
  // Yield through a timer at least every fourth chunk, including the first dispatch.
  if (active.scheduler === 'message' && active.chunks % 4 !== 0) {
    if (!channel) { channel = new MessageChannel(); channel.port1.onmessage = () => { const next = queued; queued = null; next?.(); }; }
    queued = callback; channel.port2.postMessage(null);
  } else timer = setTimeout(callback, 0);
}
function progress() { return { processed: active.core?.processed || 0, total: active.spec.n * active.spec.repetitions, retainedBytes: retainedBytes(active.core) }; }
function pump() {
  try {
    const done = advance(active.core, active.batchSize, performance.now() + 4);
    active.chunks++;
    if (done) {
      const result = finish(active.core), transfers = transferBuffers(result);
      active.core = null; active.status = 'completed'; clearSchedule();
      post('completed', { result, processed: result.processed, retainedBytes: 0 }, transfers);
    } else {
      const now = performance.now();
      if (now - active.lastProgress >= 16) { post('progress', progress()); active.lastProgress = now; }
      schedule();
    }
  } catch (error) {
    active.core = null; active.status = 'failed'; clearSchedule();
    post('failed', { code: error.code || 'WORKER_ERROR', message: error.message, retainedBytes: 0 });
  }
}

globalThis.onmessage = ({ data }) => {
  if (data?.type === 'start') {
    clearSchedule(); sequence = 0;
    active = { id: data.runId, core: null, status: 'starting' };
    try {
      if (typeof data.runId !== 'string' || !data.runId.length) throw Object.assign(new Error('runId is required'), { code: 'INVALID_INPUT' });
      const batchSize = data.batchSize ?? 256;
      if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > LIMITS.workerBatch || !['timeout', 'message'].includes(data.scheduler ?? 'timeout')) throw Object.assign(new Error('Invalid scheduling fixture'), { code: 'INVALID_INPUT' });
      active.core = createEngine(data.spec); active.spec = active.core.spec;
      active.batchSize = batchSize; active.scheduler = data.scheduler || 'timeout'; active.lastProgress = -Infinity; active.chunks = 0; active.status = 'running';
      post('running', progress()); schedule();
    } catch (error) { active.core = null; active.status = 'failed'; post('failed', { code: error.code || 'INVALID_INPUT', message: error.message, retainedBytes: 0 }); }
    return;
  }
  if (!active || data?.runId !== active.id) return;
  if (data.type === 'pause' && active.status === 'running') {
    clearSchedule(); active.status = 'paused'; post('paused', progress());
  } else if (data.type === 'resume' && active.status === 'paused') {
    active.status = 'running'; post('running', progress()); schedule();
  } else if (data.type === 'cancel') {
    clearSchedule(); active.core = null; active.status = 'cancelled'; post('cancelled', { retainedBytes: 0 });
  }
};
