import { collectEvidence } from './evidence.mjs';
export async function runBrowserEvidence() {
  const evidence = await collectEvidence(() => new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }));
  return { capturedAt: new Date().toISOString(), runtime: navigator.userAgent, logicalProcessorsReported: navigator.hardwareConcurrency, ...evidence };
}
window.simulationEvidence = runBrowserEvidence;
document.querySelector('#run').addEventListener('click', async event => {
  event.target.disabled = true;
  document.querySelector('#status').textContent = 'Running real Worker comparisons and lifecycle measurements…';
  try { document.querySelector('#status').textContent = JSON.stringify(await runBrowserEvidence(), null, 2); }
  catch (error) { document.querySelector('#status').textContent = `FAILED: ${error.message}`; }
  finally { event.target.disabled = false; }
});
