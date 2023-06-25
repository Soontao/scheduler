using {
  cuid,
  managed
} from '@sap/cds/common';

using {Kind} from './type';

entity Job : cuid, managed {
  kind : Kind default 'ONE_TIME';
}
