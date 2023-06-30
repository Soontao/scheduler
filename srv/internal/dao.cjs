const cds = require("@sap/cds");
const { _now } = require("./utils");

/**
 * perform auto commit query
 * 
 * @param {*} query 
 * @returns {Promise<any>}
 */
function _run(query) {
  return cds.tx((tx) => tx.run(query));
}


/**
 * @param {Partial<TaskExecution>} task_exec_data 
 * @returns {Promise<TaskExecution>}
 */
async function _create_task_exec(task_exec_data) {
  const task_exec_id = cds.utils.uuid();
  const merged_data = {
    ID: task_exec_id,
    ...task_exec_data
  };
  await _run(INSERT.into("TaskExecution").entries(merged_data));
  return merged_data;
}

/**
 * 
 * @param {Partial<JobExecution>} job_exec_data 
 * @returns {Promise<JobExecution>}
 */
async function _create_job_exec(job_exec_data) {
  const job_exec_id = cds.utils.uuid();
  const merged_data = {
    ID: job_exec_id,
    ...job_exec_data
  };
  await _run(INSERT.into("JobExecution").entries(merged_data));
  return merged_data;
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
  return _run(
    INSERT.into("LogEntry").entries(
      ...entries.map(
        entry => ({
          timestamp: _now(),
          ...entry
        })
      )
    )
  );
}


module.exports = { _create_task_exec, _create_job_exec, _update_job_exec_status, _update_task_exec_status, _insert_log_entries, _run };