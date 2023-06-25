using {Job} from '../db/model';

@path: '/api/v1/job'
service JobService {

  @Capabilities: {
    Deletable: false,
    Updatable: false,
  }
  entity Jobs as projection on Job;

}
