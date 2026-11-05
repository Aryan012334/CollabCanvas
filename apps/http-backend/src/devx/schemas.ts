import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const RiskLevelSchema = SeveritySchema;

export const FindingSchema = z.object({
  title: z.string().min(1).max(200),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  category: z.enum([
    "bug",
    "security",
    "correctness",
    "concurrency",
    "performance",
    "maintainability",
    "test_gap",
  ]),
  filePath: z.string().min(1).max(500).optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  evidence: z.string().min(1).max(2000),
  explanation: z.string().min(1).max(2000),
  suggestion: z.string().min(1).max(2000),
  fingerprint: z.string().min(1).max(128),
});

export const PullRequestReviewSchema = z.object({
  summary: z.string().min(1).max(4000),
  riskLevel: RiskLevelSchema,
  findings: z.array(FindingSchema).max(30),
  testRecommendations: z.array(z.string().min(1).max(500)).max(20),
  overallRecommendations: z.array(z.string().min(1).max(500)).max(20),
});

export const CiFailureCategorySchema = z.enum([
  "COMPILATION_ERROR",
  "TYPE_ERROR",
  "TEST_FAILURE",
  "DEPENDENCY_FAILURE",
  "CONFIGURATION_ERROR",
  "DATABASE_FAILURE",
  "NETWORK_FAILURE",
  "CONTAINER_FAILURE",
  "INFRASTRUCTURE_FAILURE",
  "PERMISSION_ERROR",
  "RESOURCE_EXHAUSTION",
  "UNKNOWN",
]);

export const CiDiagnosisSchema = z.object({
  failureCategory: CiFailureCategorySchema,
  summary: z.string().min(1).max(2000),
  likelyRootCause: z.string().min(1).max(3000),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(1).max(1000)).max(10),
  relatedFiles: z.array(z.string().min(1).max(500)).max(20),
  suggestedActions: z.array(z.string().min(1).max(500)).max(12),
  possibleRegression: z.boolean(),
  requiresHumanInvestigation: z.boolean(),
});

export const GeneratedTestSchema = z.object({
  targetFile: z.string().min(1).max(500),
  targetFunction: z.string().min(1).max(200),
  scenario: z.string().min(1).max(1000),
  expectedBehavior: z.string().min(1).max(1000),
  code: z.string().min(1).max(8000),
  validationState: z.enum(["GENERATED", "SYNTAX_VALID", "SYNTAX_INVALID"]),
  executionState: z.literal("SANDBOX_UNAVAILABLE"),
});

export const TestGenerationResultSchema = z.object({
  summary: z.string().min(1).max(3000),
  tests: z.array(GeneratedTestSchema).max(8),
});

export const RiskSignalSchema = z.object({
  ruleId: z.string().min(1).max(100),
  severity: SeveritySchema,
  weight: z.number().int().min(0).max(100),
  evidence: z.string().min(1).max(1000),
  explanation: z.string().min(1).max(1500),
  recommendedValidation: z.string().min(1).max(1000),
});

export const DeploymentRiskSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: RiskLevelSchema,
  signals: z.array(RiskSignalSchema).max(20),
  explanation: z.string().min(1).max(3000),
  recommendedChecks: z.array(z.string().min(1).max(500)).max(20),
  insufficientEvidence: z.boolean(),
});

export const PullRequestInputSchema = z.object({
  repository: z.string().min(1).max(200),
  pullRequestNumber: z.number().int().positive(),
  commitSha: z.string().min(7).max(64),
  diff: z.string().min(1).max(120_000),
});

export const CiFailureInputSchema = z.object({
  jobName: z.string().min(1).max(300),
  buildNumber: z.number().int().positive(),
  buildStatus: z.string().min(1).max(50),
  failedStage: z.string().max(300).optional(),
  consoleOutput: z.string().min(1).max(200_000),
  commitSha: z.string().max(64).optional(),
  pullRequestUrl: z.string().url().max(2000).optional(),
});

export const TestGenerationInputSchema = z.object({
  diff: z.string().min(1).max(120_000),
  changedFiles: z.array(z.string().min(1).max(500)).min(1).max(100),
  testConventions: z.string().max(5000).optional(),
});

export const DeploymentRiskInputSchema = z.object({
  changedFiles: z.array(z.string().min(1).max(500)).max(200),
  diff: z.string().max(120_000).optional(),
});

export type Finding = z.infer<typeof FindingSchema>;
export type PullRequestReview = z.infer<typeof PullRequestReviewSchema>;
export type CiFailureCategory = z.infer<typeof CiFailureCategorySchema>;
export type CiDiagnosis = z.infer<typeof CiDiagnosisSchema>;
export type GeneratedTest = z.infer<typeof GeneratedTestSchema>;
export type TestGenerationResult = z.infer<typeof TestGenerationResultSchema>;
export type DeploymentRisk = z.infer<typeof DeploymentRiskSchema>;
