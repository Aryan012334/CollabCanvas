import { createHash } from "node:crypto";
import { Script } from "node:vm";
import { AiProvider } from "./provider";
import {
  Finding,
  GeneratedTest,
  PullRequestInputSchema,
  PullRequestReview,
  PullRequestReviewSchema,
  TestGenerationInputSchema,
  TestGenerationResult,
  TestGenerationResultSchema,
} from "./schemas";
import { redactSecrets } from "./ci";

const MAX_REVIEW_DIFF_CHARS = 48_000;

function changedLinesByFile(diff: string): Map<string, Set<number>> {
  const changedLines = new Map<string, Set<number>>();
  let currentFile: string | undefined;
  let newLine = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6).trim();
      if (currentFile !== "/dev/null" && !changedLines.has(currentFile)) {
        changedLines.set(currentFile, new Set());
      }
      continue;
    }

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (!currentFile || !changedLines.has(currentFile)) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.get(currentFile)?.add(newLine);
      newLine += 1;
    } else if (line.startsWith(" ")) {
      newLine += 1;
    }
  }

  return changedLines;
}

function findingFingerprint(finding: Finding): string {
  return createHash("sha256")
    .update(
      [
        finding.category,
        finding.title.trim().toLowerCase(),
        finding.filePath ?? "",
        finding.startLine ?? "",
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 32);
}

function keepMappedFindings(findings: Finding[], diff: string): Finding[] {
  const changedLines = changedLinesByFile(diff);
  const unique = new Map<string, Finding>();

  for (const finding of findings) {
    if (!finding.filePath || !finding.startLine) continue;
    const validLines = changedLines.get(finding.filePath);
    if (!validLines?.has(finding.startLine)) continue;
    const normalized = { ...finding, fingerprint: findingFingerprint(finding) };
    if (!unique.has(normalized.fingerprint)) unique.set(normalized.fingerprint, normalized);
  }

  return [...unique.values()];
}

export async function reviewPullRequest(
  input: unknown,
  provider: AiProvider,
): Promise<{ review: PullRequestReview; providerMode: AiProvider["mode"] }> {
  const parsed = PullRequestInputSchema.parse(input);
  if (parsed.diff.length > MAX_REVIEW_DIFF_CHARS) {
    throw new Error(`Diff exceeds the ${MAX_REVIEW_DIFF_CHARS}-character review limit`);
  }

  const safeDiff = redactSecrets(parsed.diff);
  const response = await provider.complete(
    "pull-request-review",
    {
      repository: parsed.repository,
      pullRequestNumber: parsed.pullRequestNumber,
      commitSha: parsed.commitSha,
      diff: safeDiff,
    },
    PullRequestReviewSchema,
  );
  const mappedFindings = keepMappedFindings(response.data.findings, safeDiff);
  const unmappedCount = response.data.findings.length - mappedFindings.length;
  const review = PullRequestReviewSchema.parse({
    ...response.data,
    findings: mappedFindings,
    overallRecommendations:
      unmappedCount > 0
        ? [
            ...response.data.overallRecommendations,
            `${unmappedCount} proposed finding(s) were omitted because they did not map to a changed line.`,
          ].slice(0, 20)
        : response.data.overallRecommendations,
  });

  return { review, providerMode: provider.mode };
}

function normalizeRepoPath(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    return undefined;
  }
  return normalized;
}

function validateCandidate(test: GeneratedTest, changedFiles: Set<string>): GeneratedTest {
  const targetFile = normalizeRepoPath(test.targetFile);
  if (!targetFile || !changedFiles.has(targetFile)) {
    throw new Error("Generated test references a file outside the supplied changed-file list");
  }

  let validationState: GeneratedTest["validationState"] = "SYNTAX_VALID";
  try {
    new Script(test.code, { filename: "generated-test.js" });
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    validationState = "SYNTAX_INVALID";
  }

  return {
    ...test,
    targetFile,
    validationState,
    executionState: "SANDBOX_UNAVAILABLE",
  };
}

export async function generateTests(
  input: unknown,
  provider: AiProvider,
): Promise<{ result: TestGenerationResult; providerMode: AiProvider["mode"] }> {
  const parsed = TestGenerationInputSchema.parse(input);
  const changedFiles = new Set(
    parsed.changedFiles.map(normalizeRepoPath).filter((file): file is string => Boolean(file)),
  );
  if (changedFiles.size !== parsed.changedFiles.length) {
    throw new Error("Changed-file list contains an invalid or duplicate repository path");
  }

  const response = await provider.complete(
    "test-generation",
    {
      changedFiles: [...changedFiles],
      diff: redactSecrets(parsed.diff.slice(0, MAX_REVIEW_DIFF_CHARS)),
      testConventions: parsed.testConventions,
    },
    TestGenerationResultSchema,
  );
  const tests = response.data.tests.map((test) => validateCandidate(test, changedFiles));
  const result = TestGenerationResultSchema.parse({ ...response.data, tests });

  return { result, providerMode: provider.mode };
}
