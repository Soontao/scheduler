// @ts-nocheck
const cds = require("@sap/cds");
const { start_bg_runner, stop_bg_runner } = require("./internal/runner.cjs");

cds.on("served", async () => {
  await start_bg_runner();
});

cds.on("shutdown", async () => {
  await stop_bg_runner();
});

module.exports = cds.server;