
type UUID = string;

interface LogEntry {
  ID?: UUID;
  parent_ID: UUID;
  message: string;
  severity: Severity;
  timestamp: string;
}

interface exec_track {
  startAt?: string;
  finishedAt?: string;
  status: ExecStatus;
}

interface JobExecution extends exec_track {
  ID?: UUID;
  job_ID: UUID;
  logs?: Array<LogEntry>;
}

interface TaskExecution extends exec_track {
  ID?: UUID;
  jobExecution_ID: UUID;
  task_ID: UUID;
  logs?: Array<LogEntry>;
}

type ExecStatus = 'SUCCESS' | 'PENDING' | 'PROCESSING' | 'FAILED'

type Severity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'