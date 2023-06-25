const cds = require("@sap/cds");
const path = require("path");

describe("CAP Base Test Suite", () => {

  const { axios } = cds.test(path.join(__dirname, ".."));
  axios.defaults.validateStatus = () => true;

  it('should support retrieve metadata', async () => {
    const response = await axios.get("/api/v1/job/$metadata");
    expect(response.data).toMatch(/Jobs/);
    expect(response.data).toMatch(/Tasks/);
  });

  it('should support create job', async () => {
    const response = await axios.post("/api/v1/job/Jobs", {
      name: "test_job_1",
      active: false,
      cron: "*/2 * * * *",
      tasks: [
        {
          name: "test_task_1"
        }
      ]
    });

    expect(response.status).toBe(201);

  });

  it('should support reject wrong cron pattern', async () => {
    const response = await axios.post("/api/v1/job/Jobs", {
      name: "test_job_2",
      active: false,
      cron: "*/2 * 40 * *",
      tasks: [
        {
          name: "test_task_2"
        }
      ]
    });

    expect(response.status).toBe(400);
    expect(response.data?.error).toMatchSnapshot();

  });

});