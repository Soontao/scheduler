using {
  cuid,
  managed
} from '@sap/cds/common';

using {
  Kind,
  exec_track,
  Status,
  Severity,
  CreatedAt
} from './type';

@assert.unique: {code: [name]}
entity Job : cuid, managed {
  @Core.Immutable
  name              : String(255) not null;

  @Core.Immutable
  kind              : Kind not null default 'ONE_TIME';

  priority          : Integer not null default 0; // higher priority, easy to pick

  retryOnFailed     : Integer not null default 0; // use 0 disable retry
  active            : Boolean not null default true;
  singleton         : Boolean default true; // avoid parallel execution for single job
  parallelTasks     : Boolean default false; // perform tasks in parallel or sequence
  cron              : String(100);
  nextTimeScheduled : Timestamp default null;

  tasks             : Composition of many Task
                        on tasks.job = $self;

  executions        : Association to many JobExecution
                        on executions.job = $self;
}

@assert.unique: {code: [
  job,
  name
]}
entity Task : cuid {
  @Core.Immutable
  name  : String(255) not null;

  // optional if the job `parallelTasks` is false
  // higher `order` task will be executed firstly
  order : Integer default 0;
  param : LargeString; // optional parameters for task, should be a json string
  job   : Association to one Job;
}


entity JobExecution : cuid, managed, exec_track {
  status         : Status;

  logs           : Composition of many LogEntry
                     on logs.parent_ID = ID;

  taskExecutions : Composition of many TaskExecution
                     on taskExecutions.jobExecution = $self;
  job            : Association to one Job;
}

entity TaskExecution : cuid, managed, exec_track {
  logs         : Composition of many LogEntry
                   on logs.parent_ID = ID;

  jobExecution : Association to one JobExecution;
  task         : Association to one Task;
}

entity LogEntry : cuid {
  parent_ID : UUID not null;
  message   : String(500);
  severity  : Severity;
  timestamp : CreatedAt;
}
