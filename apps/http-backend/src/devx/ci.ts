import { createHash } from "node:crypto";
import {
  CiDiagnosis,
  CiDiagnosisSchema,
  CiFailureCategory,
  CiFailureCategorySchema,
  CiFailureInputSchema,
} from "./schemas";
import { AiProvider } from "./provider";

const MAX_SANITIZED_LOG_CHARS = 60_000;

export function redactSecrets(value: string): string {
  return value
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[REDACTED]")
    .replace(/((?:aws_secret_access_key|client_secret|password|token|api[_-]?key)\s*[=:]\s*)["']?[^\s"',;]+/gi, "$1[REDACTED]")
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1[REDACTED]@");
}

export function sanitizeBuildLog(log: string): string {
  const sanitized = redactSecrets(log.replace(/\r\n?/g, "\n"));
  return sanitized.length > MAX_SANITIZED_LOG_CHARS
    ? sanitized.slice(-MAX_SANITIZED_LOG_CHARS)
    : sanitized;
}

const failureRules: Array<[CiFailureCategory, RegExp]> = [
  ["PERMISSION_ERROR", /permission denied|access denied|unauthorized|forbidden|eacces\b/i],
  ["RESOURCE_EXHAUSTION", /out of memory|oomkilled|heap out of memory|no space left on device/i],
  ["TYPE_ERROR", /type error|\berror\s+ts\d{4}\b|\bts\d{4}\b|typescript error|typecheck failed/i],
  ["COMPILATION_ERROR", /compilation failed|failed to compile|syntaxerror|build failed/i],
  ["TEST_FAILURE", /test suite failed|tests? failed|assertionerror|expect\(.*\)\.to/i],
  ["DEPENDENCY_FAILURE", /unable to resolve dependency|package not found|pnpm.*err|npm err|could not resolve/i],
  ["DATABASE_FAILURE", /database.*(connection|timeout|refused)|prisma.*(error|failed)|sqlstate/i],
  ["NETWORK_FAILURE", /enotfound|econnreset|etimedout|network is unreachable|socket hang up/i],
  ["CONTAINER_FAILURE", /docker.*(failed|error)|container.*(exited|failed)|image pull/i],
  ["INFRASTRUCTURE_FAILURE", /terraform.*(error|failed)|kubectl.*(error|failed)|provisioning failed/i],
  ["CONFIGURATION_ERROR", /missing environment variable|configuration error|invalid configuration/i],
];

export function classifyCiFailure(log: string): CiFailureCategory {
  for (const [category, pattern] of failureRules) {
    if (pattern.test(log)) return category;
  }
  return "UNKNOWN";
}

function extractEvidence(log: string): string[] {
  const lines = log.split("\n");
  const selected = lines.filter((line) =>
    /\b(error|failed|failure|exception|denied|timed out|timeout|fatal)\b/i.test(line),
  );
  return [...new Set(selected.slice(-10).map((line) => line.trim()).filter(Boolean))]
    .map((line) => line.slice(0, 1000));
}

export async function diagnoseCiFailure(
  input: unknown,
  provider: AiProvider,
): Promise<{ diagnosis: CiDiagnosis; providerMode: AiProvider["mode"] }> {
  const parsed = CiFailureInputSchema.parse(input);
  const log = sanitizeBuildLog(parsed.consoleOutput);
  const category = CiFailureCategorySchema.parse(classifyCiFailure(log));
  const evidence = extractEvidence(log);
  const response = await provider.complete(
    "ci-diagnosis",
    {
      jobName: parsed.jobName,
      buildNumber: parsed.buildNumber,
      buildStatus: parsed.buildStatus,
      failedStage: parsed.failedStage,
      commitSha: parsed.commitSha,
      failureCategory: category,
      evidence,
      sanitizedLog: log,
    },
    CiDiagnosisSchema,
  );

  const diagnosis = CiDiagnosisSchema.parse({
    ...response.data,
    failureCategory: category,
    evidence,
    relatedFiles: [],
    possibleRegression: Boolean(parsed.commitSha),
    requiresHumanInvestigation: true,
  });
  return { diagnosis, providerMode: provider.mode };
}

export function stableFailureFingerprint(input: {
  jobName: string;
  buildNumber: number;
  commitSha?: string;
}): string {
  return createHash("sha256")
    .update(`${input.jobName}:${input.buildNumber}:${input.commitSha ?? ""}`)
    .digest("hex");
}
