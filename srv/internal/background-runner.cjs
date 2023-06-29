const cds = require("@sap/cds");
const logger = cds.log("bg-runner");
const cron = require("cron");
const { handle_task } = require("./worker.cjs");


/**
 * 
 * perform auto commit query
 * 
 * @param {*} query 
 * @returns {Promise<any>}
 */
function _run(query) {
  return cds.tx((tx) => tx.run(query));
}

async function _restore_processing_execution() {
  // failed original execution
  // if retry enabled, retry
}

function _start_sync_job() {
  const spawnEmitter = cds.spawn(
    {
      every: cds.env.jobs?.sync_interval ?? 1000
    },
    _sync_jobs
  );
  _start_sync_job.timer = spawnEmitter.timer;
}

function _create_job_tick(job_ID) {
  return async function _job_tick() {
    // TODO: out of transaction
    const job = await _run(SELECT.from("Job").where({ ID: job_ID, active: true }));
    if (job === null) {
      // not existed or not active
      return;
    }
    const tasks = await _run(SELECT.from("Task").where({ job_ID })) ?? [];

    const jobExecution = await _run(INSERT.into("JobExecution").entries({
      job_ID,
      logs: [
        {
          message: "start executing job"
        }
      ],
    }));

    // TODO: limit
    const allResults = await Promise.allSettled(
      tasks.map(
        async function _execute_task(task) {
          const taskExecution = await _run(INSERT.into("TaskExecution").entries({
            jobExecution_ID: jobExecution.ID,
            task_ID: task.ID,
            logs: [
              {
                message: "start executing job"
              }
            ],
          }));
          try {
            const logs = await handle_task(job, task);
            if (logs.length > 0) {
              await _run(INSERT.into("LogEntry").entries(
                ...logs.map(log => ({ ...log, parent_ID: taskExecution.ID }))
              ));
            }
            await _run(
              UPDATE.entity("TaskExecution").where({ ID: taskExecution.ID }).set({
                status: "SUCCESS"
              })
            );
            return;
          } catch (error) {
            await _run(INSERT.into("LogEntry").entries(
              {
                parent_ID: taskExecution.ID,
                severity: "ERROR",
                message: error?.message ?? String(error)
              }
            ));
            await _run(
              UPDATE.entity("TaskExecution").where({ ID: taskExecution.ID }).set({
                status: "FAILED"
              })
            );
            throw new Error(`task ${task.name} failed by error ${error?.message}`);
          }
        }
      )
    );

    const failedTasks = allResults.filter(r => r.status === 'rejected');
    if (failedTasks.length > 0) {
      await _run(INSERT.into("LogEntry").entries(
        {
          parent_ID: jobExecution.ID,
          message: 'job exeution finished'
        }
      ));
      await _run(
        UPDATE
          .entity("JobExecution")
          .where({ ID: jobExecution.ID })
          .set({ status: "SUCCESS" })
      );
    }
    else {
      await _run(INSERT.into("LogEntry").entries(
        ...failedTasks.map(r => ({
          parent_ID: jobExecution.ID,
          severity: "ERROR",
          message: r.reason?.message ?? String(r.reason)
        }))
      ));
      await _run(
        UPDATE
          .entity("JobExecution")
          .where({ ID: jobExecution.ID })
          .set({ status: "FAILED" })
      );
    }
  };
}

/**
 * @type {Map<string,cron.CronJob>}
 */
const _in_mem_jobs = new Map();

async function _sync_jobs() {
  try {
    const query = await _run(SELECT.from("Job").where({ active: true }));
    const _in_mem_job_keys = Array.from(_in_mem_jobs.keys());
    if (_in_mem_job_keys.length > 0) {
      const inactive_jobs = await _run(
        SELECT
          .from("Job")
          .columns("ID", "name")
          .where({ active: false, ID: { in: _in_mem_job_keys } })
      );
      for (const inactive_job of inactive_jobs) {
        logger.debug("job", inactive_job, "was removed from in mem job runner");
        _in_mem_jobs.get(inactive_job.ID)?.stop();
        _in_mem_jobs.delete(inactive_job.ID);
      }
      query.where("ID", "not in", _in_mem_job_keys);
    }
    const new_jobs = await _run(query);

    for (const new_job of new_jobs) {
      const _new_mem_job = new cron.CronJob({
        cronTime: new_job.cron ?? new_job.nextTimeScheduled,
        onTick: _create_job_tick(new_job.ID)
      });
      _in_mem_jobs.set(new_job.ID, _new_mem_job);
      _new_mem_job.start();
      logger.debug("job", new_job, "added from in mem job runner");
    }

  }
  catch (error) {
    logger.error("internal error", error);
  }
}

/**
 * bg runner, sync jobs from database
 */
async function start_bg_runner() {
  // TODO: multi tenancy
  logger.info("background runner is enabled");

  await _restore_processing_execution();
  _start_sync_job();
}

function stop_bg_runner() {
  if (_start_sync_job.timer) {
    clearInterval(_start_sync_job.timer);
  }
  for (const in_mem_job of _in_mem_jobs) {
    in_mem_job.stop();
  }
}


module.exports = { start_bg_runner, stop_bg_runner };