import { AiProvider } from "../provider";
import {
  generateTests,
  reviewPullRequest,
} from "../analysis";

describe("AI analysis boundaries", () => {
  it("keeps only deduplicated findings mapped to changed lines", async () => {
    const provider: AiProvider = {
      mode: "mock",
      async complete<T>(_task, _context, schema) {
        return {
          data: schema.parse({
            summary: "Review complete.",
            riskLevel: "medium",
            findings: [
              {
                title: "Handle invalid input",
                severity: "high",
                confidence: 0.9,
                category: "correctness",
                filePath: "src/example.ts",
                startLine: 2,
                endLine: 2,
                evidence: "throw new Error('bad')",
                explanation: "This operation may fail for invalid input.",
                suggestion: "Validate the value before using it.",
                fingerprint: "model-fingerprint",
              },
              {
                title: "Handle invalid input",
                severity: "high",
                confidence: 0.9,
                category: "correctness",
                filePath: "src/example.ts",
                startLine: 2,
                endLine: 2,
                evidence: "throw new Error('bad')",
                explanation: "This operation may fail for invalid input.",
                suggestion: "Validate the value before using it.",
                fingerprint: "another-model-fingerprint",
              },
              {
                title: "Invented location",
                severity: "low",
                confidence: 0.6,
                category: "bug",
                filePath: "src/missing.ts",
                startLine: 30,
                evidence: "not in the diff",
                explanation: "The claimed issue cannot be located.",
                suggestion: "Check the file.",
                fingerprint: "invalid",
              },
            ],
            testRecommendations: [],
            overallRecommendations: [],
          }),
        };
      },
    };

    const { review } = await reviewPullRequest(
      {
        repository: "owner/repo",
        pullRequestNumber: 3,
        commitSha: "abcdef012345",
        diff: [
          "diff --git a/src/example.ts b/src/example.ts",
          "--- a/src/example.ts",
          "+++ b/src/example.ts",
          "@@ -1 +1,2 @@",
          " const existing = 1;",
          "+throw new Error('bad');",
        ].join("\n"),
      },
      provider,
    );

    expect(review.findings).toHaveLength(1);
    expect(review.findings[0].startLine).toBe(2);
    expect(review.findings[0].fingerprint).not.toBe("model-fingerprint");
    expect(review.overallRecommendations[0]).toContain("2 proposed finding(s)");
  });

  it("syntax-checks proposed test code without executing it", async () => {
    const provider: AiProvider = {
      mode: "mock",
      async complete<T>(_task, _context, schema) {
        return {
          data: schema.parse({
            summary: "One candidate test.",
            tests: [
              {
                targetFile: "src/service.ts",
                targetFunction: "saveItem",
                scenario: "Reject an empty identifier",
                expectedBehavior: "The function rejects the request.",
                code: 'describe("saveItem", () => { it("rejects empty ids", () => { expect(true).toBe(true); }); });',
                validationState: "GENERATED",
                executionState: "SANDBOX_UNAVAILABLE",
              },
            ],
          }),
        };
      },
    };

    const { result } = await generateTests(
      {
        changedFiles: ["src/service.ts"],
        diff: "+export function saveItem() {}",
      },
      provider,
    );

    expect(result.tests[0]).toMatchObject({
      validationState: "SYNTAX_VALID",
      executionState: "SANDBOX_UNAVAILABLE",
    });
  });

  it("rejects test proposals targeting paths outside the supplied changes", async () => {
    const provider: AiProvider = {
      mode: "mock",
      async complete<T>(_task, _context, schema) {
        return {
          data: schema.parse({
            summary: "Candidate",
            tests: [
              {
                targetFile: "../outside.ts",
                targetFunction: "saveItem",
                scenario: "reject invalid data",
                expectedBehavior: "reject",
                code: "expect(true).toBe(true);",
                validationState: "GENERATED",
                executionState: "SANDBOX_UNAVAILABLE",
              },
            ],
          }),
        };
      },
    };

    await expect(
      generateTests(
        { changedFiles: ["src/service.ts"], diff: "+change" },
        provider,
      ),
    ).rejects.toThrow("outside the supplied changed-file list");
  });
});
