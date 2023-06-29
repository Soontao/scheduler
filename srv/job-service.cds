using {
  Job,
  Task,
  JobExecution,
  TaskExecution
} from '../db/model';

@impl: './job-service.cjs'
@path: '/api/v1/job'
service JobService {

  @Capabilities: {  
    Deletable: false,
    Updatable: false,
  }
  entity Jobs           as projection on Job;

  entity Tasks          as projection on Task;

  @readonly
  entity JobExecutions  as projection on JobExecution;

  @readonly
  entity TaskExecutions as projection on TaskExecution;

}
