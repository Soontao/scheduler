import cds from "@sap/cds";
import path from "path";
import { fileURLToPath } from "url";

describe("CAP Base Test Suite", () => {

  const { axios } = cds.test(path.join(fileURLToPath(import.meta.url), "../.."));

  it('should support retrieve metadata', async () => {
    const response = await axios.get("/api/v1/job/$metadata");
    expect(response.data).toMatch(/Jobs/);
  });

});