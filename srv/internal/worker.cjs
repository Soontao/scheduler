/* eslint-disable no-unused-vars */
/* eslint-disable no-inner-declarations */
const { Worker, isMainThread, parentPort, threadId } = require('node:worker_threads');
const cds = require("@sap/cds");
const { createPool } = require("generic-pool");
const { cpus } = require('node:os');
const { run_task } = require('./tasks.cjs');
const { _update_task_exec_status } = require('./dao.cjs');

if (isMainThread) {

  const logger = cds.log("worker");
  const pool = createPool(
    {
      create: async () => {
        const worker = new Worker(__filename);

        worker.on('error', err => {
          logger.error("worker", worker.threadId, "error", err);
          pool.destroy(worker).catch(logger.error);
        });

        worker.on('exit', (code) => {
          logger.error("worker", worker.threadId, "crashed", code);
          pool.destroy(worker).catch(logger.error);
        });

        return worker;
      },
      destroy: (worker) => worker.terminate()
    },
    {
      min: 1,
      max: cds.env.jobs?.worker?.max ?? cpus().length,
      autostart: true
    }
  );

  // TODO: cpu based semaphore
  /**
   * 
   * @param {any} job 
   * @param {any} task 
   * @returns {Promise<Array<import('./background-runner.cjs').LogEntry>>}
   */
  async function handle_task(job, task, task_exec_id) {
    const worker = await pool.acquire();
    await _update_task_exec_status(task_exec_id, "PROCESSING");

    return new Promise((resolve, reject) => {
      // TODO: timeout
      // TODO: live time message

      worker.once('message', (msg) => {
        const { logs, error } = msg;
        if (error) {
          reject(error);
        }
        else {
          resolve(logs);
        }
        pool.release(worker).catch(logger.error);
      });

      worker.postMessage({ context_id: cds.context.id, job, task, task_exec_id });

    });
  };

  async function destroy_pool() {
    await pool.drain();
    await pool.clear();
  }

  module.exports = { handle_task, destroy_pool };
}
else {
  const logger = cds.log(`worker-${threadId}|worker`);

  parentPort.on("message", async (message = {}) => {
    const { context_id, task, job, task_exec_id } = message;
    try {

      logger.debug("executing task", task.name, "of job", job.name);
      cds.context = undefined;
      cds.context = { id: context_id }; // restore context id

      const task_ctx = await run_task(task, job, task_exec_id);

      parentPort.postMessage({ logs: task_ctx.logs });

    } catch (error) {
      logger.error('failed to handle task', task.name);
      parentPort.postMessage({ error });
    }
  });

} 