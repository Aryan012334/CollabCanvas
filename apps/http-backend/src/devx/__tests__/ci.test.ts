import { classifyCiFailure, diagnoseCiFailure, sanitizeBuildLog } from "../ci";
import { MockAiProvider } from "../provider";

describe("CI failure analysis", () => {
  it("removes common credentials and ANSI terminal codes", () => {
    const log =
      "\u001b[31mAuthorization: Bearer abc123\u001b[0m\n" +
      "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456";

    expect(sanitizeBuildLog(log)).toBe(
      "Authorization: Bearer [REDACTED]\nGITHUB_TOKEN=[REDACTED]",
    );
  });

  it.each([
    ["src/index.ts(1,1): error TS2345", "TYPE_ERROR"],
    ["Test suite failed: expected 200, received 500", "TEST_FAILURE"],
    ["Error: EACCES permission denied", "PERMISSION_ERROR"],
    ["unrecognized build output", "UNKNOWN"],
  ] as const)("classifies %s", (log, expected) => {
    expect(classifyCiFailure(log)).toBe(expected);
  });

  it("keeps diagnosis evidence sanitized and requires human investigation", async () => {
    const result = await diagnoseCiFailure(
      {
        jobName: "web",
        buildNumber: 12,
        buildStatus: "FAILURE",
        consoleOutput: "Error: password=secret123\nTests failed in room.test.ts",
        commitSha: "abcdef012345",
      },
      new MockAiProvider(),
    );

    expect(result.providerMode).toBe("mock");
    expect(result.diagnosis.failureCategory).toBe("TEST_FAILURE");
    expect(result.diagnosis.evidence.join(" ")).not.toContain("secret123");
    expect(result.diagnosis.requiresHumanInvestigation).toBe(true);
    expect(result.diagnosis.possibleRegression).toBe(true);
  });
});
