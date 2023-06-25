const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const cds = require("@sap/cds")

if (isMainThread) {

  // TODO: cpu based semaphore
  function handle_task(job, task) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        __filename,
        { workerData: { context_id: cds.context.id, job, task } }
      );
      // TODO: live time message
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0)
          reject(new Error(`Worker failed with exit code ${code}`));
      });
    });
  };

  module.exports = { handle_task }
}
else {
  const { context_id, task, job } = workerData;
  cds.context = undefined
  cds.context = { id: context_id } // restore context id

  // TODO: implementation
  // parentPort.postMessage

} 