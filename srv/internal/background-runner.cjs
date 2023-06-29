// @ts-nocheck
const cds = require("@sap/cds");
const logger = cds.log("runner");
const cron = require("cron");
const { handle_task, destroy_pool } = require("./worker.cjs");

/**
 * @typedef ExecStatus
 * @type {'SUCCESS'|'PENDING'|'PROCESSING'|'FAILED'}
 */

/**
 * @typedef LogEntry
 * @type {{
 *  ID?: string;
 *  parent_ID: string;
 *  message: string;
 *  severity: string;
 *  timestamp: string;
 * }}
 */

/**
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
    _sync_mem_jobs
  );
  _start_sync_job.timer = spawnEmitter.timer;
}

function _create_job_tick(job_ID) {
  return async function _job_tick() {
    // TODO: out of transaction
    const job = await _run(SELECT.one.from("Job").where({ ID: job_ID, active: true }));
    if (job === null) {
      // not existed or not active
      return;
    }
    const tasks = await _run(SELECT.from("Task").where({ job_ID })) ?? [];

    const jobExecution_ID = cds.utils.uuid();
    await _run(INSERT.into("JobExecution").entries({
      ID: jobExecution_ID,
      job_ID,
      logs: [
        {
          message: "start executing job"
        }
      ],
    }));

    // TODO: limit
    const allResults = await Promise.allSettled(
      tasks.map(task => _execute_task(job, jobExecution_ID, task))
    );

    const failedTasks = allResults.filter(r => r.status === 'rejected');

    try {
      if (failedTasks.length === 0) {
        await _insert_log_entries({
          parent_ID: jobExecution_ID,
          message: 'job exeution finished'
        });
        await _update_job_exec_status(jobExecution_ID, "SUCCESS");
      }
      else {
        await _insert_log_entries(...failedTasks.map(r => ({
          parent_ID: jobExecution_ID,
          severity: "ERROR",
          message: r.reason?.message ?? String(r.reason)
        })));
        await _update_job_exec_status(jobExecution_ID, "FAILED");
      }
    } catch (error) {
      logger.error("failed save job status", error);
    }

  };
}

async function _execute_task(job, jobExecution_ID, task) {
  const taskExecution_ID = cds.utils.uuid();

  await _run(INSERT.into("TaskExecution").entries({
    ID: taskExecution_ID,
    jobExecution_ID,
    task_ID: task.ID,
    logs: [
      {
        message: "start executing job"
      }
    ],
  }));

  try {
    const logs = await handle_task(job, task);
    await _insert_log_entries(...logs.map(log => ({ ...log, parent_ID: taskExecution_ID })));
    await _update_task_exec_status(taskExecution_ID, "SUCCESS");
    logger.debug("finish task", task.name, 'of job', job.name);
    return;
  } catch (error) {
    logger.error("failed to execute task", task.name, 'of job', job.name);
    await _insert_log_entries({
      parent_ID: taskExecution_ID,
      severity: "ERROR",
      message: error?.message ?? String(error)
    });
    await _update_task_exec_status(taskExecution_ID, "FAILED");
    throw new Error(`task ${task.name} failed by error ${error?.message}`);
  }
}

/**
 * 
 * @param {string} jobExecution_ID 
 * @param {ExecStatus} status 
 * @returns 
 */
function _update_job_exec_status(jobExecution_ID, status) {
  return _run(
    UPDATE
      .entity("JobExecution")
      .where({ ID: jobExecution_ID })
      .set({ status })
  );
}

/**
 * 
 * @param {string} taskExecution_ID 
 * @param {ExecStatus} status 
 * @returns 
 */
function _update_task_exec_status(taskExecution_ID, status) {
  return _run(
    UPDATE.entity("TaskExecution").where({ ID: taskExecution_ID }).set({ status })
  );
}

/**
 * 
 * @param  {...LogEntry} entries 
 * @returns 
 */
function _insert_log_entries(...entries) {
  if (entries.length === 0) { return; }
  return _run(INSERT.into("LogEntry").entries(...entries));
}


/**
 * @type {Map<string,cron.CronJob>}
 */
const _in_mem_jobs = new Map();



/**
 * sync database configuration to mem job
 */
async function _sync_mem_jobs() {
  try {
    const query = SELECT.from("Job").where({ active: true });
    const _in_mem_job_keys = Array.from(_in_mem_jobs.keys());
    if (_in_mem_job_keys.length > 0) {
      await _clear_in_active_mem_jobs(_in_mem_job_keys);
      query.where({ ID: { 'not in': _in_mem_job_keys } });
    }
    const new_jobs = await _run(query);

    for (const new_job of new_jobs) {
      // TODO: sync configuration - cron/parallel
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

async function _clear_in_active_mem_jobs(_in_mem_job_keys) {
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

async function stop_bg_runner() {
  if (_start_sync_job.timer) {
    clearInterval(_start_sync_job.timer);
  }
  for (const in_mem_job of _in_mem_jobs.values()) {
    in_mem_job.stop();
  }
  await destroy_pool();
}


module.exports = { start_bg_runner, stop_bg_runner };