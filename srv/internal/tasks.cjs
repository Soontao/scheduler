/* eslint-disable no-unsafe-optional-chaining */
/* eslint-disable no-case-declarations */
const cds = require("@sap/cds");
const { newQuickJSAsyncWASMModule } = require("quickjs-emscripten");
const { message4, _now } = require("./utils.js");
const logger = cds.log('tasks');

class TaskContext {
  constructor(task_exec_id) {
    /**
     * @type {Array<import("./background-runner.cjs").LogEntry>}
     * @private
     */
    this._logs = [];

    this._task_exec_ID = task_exec_id;

    this._hasError = false;
  }
  /**
   * 
   * @param {Array<string|any>} parts 
   * @param {import("./background-runner.cjs").Severity} severity 
   */
  _log(parts, severity) {
    this._logs.push({ message: message4(parts), severity, timestamp: _now(), parent_ID: this._task_exec_ID });
  }
  debug(...parts) {
    this._log(parts, "DEBUG");
  }
  info(...parts) {
    this._log(parts, "INFO");
  }
  warn(...parts) {
    this._log(parts, "WARN");
  }
  error(...parts) {
    this._hasError = true;
    logger.error(...parts);
    this._log(parts, "ERROR");
  }

  get logs() {
    return this._logs;
  }

}

async function run_task(task, job, task_exec_id) {
  const param = JSON.parse(task.param ?? "{}");
  const kind = task.kind;

  const ctx = new TaskContext(task_exec_id);

  try {
    ctx.info("start execution");
    switch (kind) {
      case 'NOTHING':
        ctx.info("nothing to do in fact");
        break;
      case 'CALLBACK_REST':
        ctx.warn("rest callback task still not implemented");
        break;
      case 'CUSTOM_SCRIPT':
        const script_result = await run_script_with_vm(param.script, ctx);
        ctx.info("script result is", script_result);
        break;
      default:
        break;
    }
  } catch (error) {
    ctx.error("task execution failed", error);
  } finally {
    ctx.info("end execution");
  }


  return ctx;
}


/**
 * 
 * @param {import("quickjs-emscripten").QuickJSAsyncContext} vm 
 * @param {TaskContext} ctx 
 */
function _setup_vm_functions(vm, ctx) {
  const consoleHandle = vm.newObject();
  vm.setProp(vm.global, "console", consoleHandle);

  for (const name of ['debug', 'info', 'log', 'warn', 'error']) {
    const handle = vm.newFunction(name, (...args) => {
      const nativeArgs = args.map(vm.dump);
      (ctx?.[name] ?? ctx?.info).call(ctx, "vm:", ...nativeArgs);
    });
    vm.setProp(consoleHandle, name, handle);
    handle.dispose();
  }

  consoleHandle.dispose();
}

/**
 * 
 * @param {string} script 
 * @param {TaskContext} ctx
 */
async function run_script_with_vm(script, ctx) {
  const quickjs = await newQuickJSAsyncWASMModule();
  const runtime = quickjs.newRuntime({
    memoryLimitBytes: (cds.env.jobs?.vm?.mem?.max ?? 30) * 2 ** 10 * 2 ** 10// MB
  });
  const vm = runtime.newContext();
  _setup_vm_functions(vm, ctx);

  try {
    const result = await vm.evalCodeAsync(script);
    if (result.error) {
      throw vm.dump(result.error);
    } else {
      return vm.dump(result.value);
    }
  }
  finally {
    vm.dispose();
    runtime.dispose();
  }
}

module.exports = { run_task };