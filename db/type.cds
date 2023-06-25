type Severity  : String(10) enum {
  DEBUG;
  INFO;
  WARN;
  ERROR;
} default 'INFO';

/**
 * status
 */
type Status    : String(20) enum {
  /**
   * succssfully processed
   */
  SUCCESS;
  /**
   * waiting
   */
  PENDING;
  /**
   * in processing
   */
  PROCESSING;
  /**
   * process failed
   */
  FAILED;
} default 'PENDING';

/**
 * job kind
 */
type Kind      : String(10) enum {
  ONE_TIME;
  RECURRING;
}

/**
 * job category
 */
type Category  : String(10) enum {
  BUSINESS;
  TECH;
} default 'TECH';

/**
 * created at field
 */
type CreatedAt : Timestamp @cds.on.insert: $now;
/**
 * updated at field
 */
type UpdatedAt : Timestamp  @cds.on.insert: $now  @cds.on.update: $now;

/**
 * fields used to track execution
 */
aspect exec_track {
  startAt    : Timestamp @cds.on.insert: $now;
  finishedAt : Timestamp @cds.on.update: $now;
  status     : Status default 'TIME_PENDING';
}
