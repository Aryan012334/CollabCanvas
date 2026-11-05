import { assessDeploymentRisk } from "../risk";

describe("deployment risk engine", () => {
  it("produces reproducible evidence-based scores", () => {
    const input = {
      changedFiles: [
        "packages/db/prisma/migrations/20260101_add_index/migration.sql",
        "apps/http-backend/src/auth/middleware.ts",
        "apps/http-backend/src/auth/middleware.test.ts",
      ],
      diff: "ALTER TABLE User ADD COLUMN emailVerified BOOLEAN;",
    };

    expect(assessDeploymentRisk(input)).toEqual(assessDeploymentRisk(input));
    expect(assessDeploymentRisk(input)).toMatchObject({
      score: 45,
      level: "medium",
      insufficientEvidence: false,
    });
  });

  it("raises risk for destructive infrastructure changes", () => {
    const result = assessDeploymentRisk({
      changedFiles: ["terraform/main.tf"],
      diff: "- resource x\n+ terraform destroy",
    });

    expect(result.level).toBe("critical");
    expect(result.signals.map((signal) => signal.ruleId)).toContain("destructive-operation");
  });

  it("reports missing evidence without inventing a low-risk assessment", () => {
    expect(assessDeploymentRisk({ changedFiles: [] })).toMatchObject({
      score: 0,
      level: "low",
      insufficientEvidence: true,
    });
  });
});
