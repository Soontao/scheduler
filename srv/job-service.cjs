const { isEmpty } = require("@newdash/newdash/isEmpty");
const cds = require("@sap/cds");
const parser = require("cron-parser");

function _validateCron(req) {
  if (req.data.cron) {
    const result = parser.parseString(req.data.cron); // should not error
    if (!isEmpty(result.errors)) {
      return req.reject(400, Object.values(result.errors)[0]?.message, "cron");
    }
  }
}

module.exports = class JobServiceImpl extends cds.ApplicationService {

  async init() {
    this.before("SAVE", 'Jobs', this.beforeSaveJobs);
    await super.init();
  }


  /**
   * 
   * @param {import("@sap/cds/apis/services").Request} req 
   */
  beforeSaveJobs(req) {
    _validateCron(req);
  }

};