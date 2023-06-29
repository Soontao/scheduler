/* eslint-disable no-unused-vars */
/* eslint-disable no-inner-declarations */
const { Worker, isMainThread, parentPort, threadId } = require('node:worker_threads');
const cds = require("@sap/cds");
const { createPool } = require("generic-pool");
const { cpus } = require('node:os');

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
  async function handle_task(job, task) {
    const worker = await pool.acquire();

    return new Promise((resolve, reject) => {
      // TODO: timeout
      // TODO: live time message

      worker.once('message', (msg) => {
        const { data, error } = msg;
        if (error) {
          reject(error);
        }
        else {
          resolve(data);
        }
        pool.release(worker).catch(logger.error);
      });

      worker.postMessage({ context_id: cds.context.id, job, task });

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
  const { newQuickJSAsyncWASMModule } = require("quickjs-emscripten");

  parentPort.on("message", async (message = {}) => {
    const { context_id, task, job } = message;
    try {
      const param = JSON.parse(task.param ?? "{}");

      logger.debug("executing task", task.name, "of job", job.name);
      cds.context = undefined;
      cds.context = { id: context_id }; // restore context id

      const quickjs = await newQuickJSAsyncWASMModule();
      const runtime = quickjs.newRuntime({
        memoryLimitBytes: (cds.env.jobs?.vm?.mem?.max ?? 30) * 2 ** 10 * 2 ** 10// MB
      });
      const vm = runtime.newContext();

      const result = await vm.evalCodeAsync("1+1");

      if (result.error) {
        throw vm.dump(result.error);
      } else {
        logger.info("vm execution result is", vm.dump(result.value));
      }

      vm.dispose();
      runtime.dispose();

      parentPort.postMessage({ data: [] });

    } catch (error) {
      logger.error('failed to handle task', task.name);
      parentPort.postMessage({ error });
    }
  });

} 