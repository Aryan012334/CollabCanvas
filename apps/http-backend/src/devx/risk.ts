import {
  DeploymentRisk,
  DeploymentRiskInputSchema,
  DeploymentRiskSchema,
} from "./schemas";

interface RiskRule {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  weight: number;
  matches: (files: string[], diff: string) => boolean;
  evidence: string;
  explanation: string;
  recommendedValidation: string;
}

const rules: RiskRule[] = [
  {
    id: "database-migration",
    severity: "high",
    weight: 25,
    matches: (files) => files.some((file) => /(^|[/\\])migrations?([/\\]|$)/i.test(file)),
    evidence: "The change includes a database migration.",
    explanation: "Schema changes can affect existing data and rollback safety.",
    recommendedValidation: "Test the migration and rollback against representative data.",
  },
  {
    id: "authentication-or-authorization",
    severity: "high",
    weight: 20,
    matches: (files) => files.some((file) => /(auth|permission|role|policy|middleware)/i.test(file)),
    evidence: "The change touches authentication or authorization code.",
    explanation: "Access-control regressions can expose protected actions or data.",
    recommendedValidation: "Run positive and negative authorization tests.",
  },
  {
    id: "infrastructure",
    severity: "high",
    weight: 18,
    matches: (files) => files.some((file) => /(^|[/\\])(k8s|terraform|infra|infrastructure)([/\\]|$)|\.(tf|yaml|yml)$/i.test(file)),
    evidence: "The change includes infrastructure or deployment configuration.",
    explanation: "Operational configuration changes may affect availability or access.",
    recommendedValidation: "Review the deployment plan and verify rollback behavior.",
  },
  {
    id: "destructive-operation",
    severity: "critical",
    weight: 80,
    matches: (_, diff) => /\b(drop\s+table|drop\s+column|terraform\s+destroy|delete\s+namespace)\b/i.test(diff),
    evidence: "The diff contains a destructive database or infrastructure operation.",
    explanation: "The operation may permanently remove data or infrastructure.",
    recommendedValidation: "Require a human-reviewed backup and recovery plan before applying.",
  },
  {
    id: "dependency-update",
    severity: "medium",
    weight: 10,
    matches: (files) => files.some((file) => /(^|[/\\])(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/i.test(file)),
    evidence: "The change updates dependency manifests or lockfiles.",
    explanation: "Dependency updates can change runtime behavior or introduce supply-chain risk.",
    recommendedValidation: "Review the dependency diff and run the complete relevant test suite.",
  },
  {
    id: "api-contract",
    severity: "medium",
    weight: 10,
    matches: (files) => files.some((file) => /(routes?|controllers?|api)/i.test(file)),
    evidence: "The change touches API routes or controllers.",
    explanation: "API changes can break clients or alter validation and authorization behavior.",
    recommendedValidation: "Run API contract and compatibility tests.",
  },
  {
    id: "missing-test-change",
    severity: "low",
    weight: 5,
    matches: (files) =>
      files.some((file) => /\.(ts|tsx|js|jsx)$/.test(file) && !/(\.test\.|\.spec\.|__tests__)/i.test(file)) &&
      !files.some((file) => /(\.test\.|\.spec\.|__tests__)/i.test(file)),
    evidence: "Source code changed without a corresponding test file in the supplied file list.",
    explanation: "A regression may not be caught automatically.",
    recommendedValidation: "Add or update a focused regression test for the changed behavior.",
  },
];

function riskLevel(score: number): DeploymentRisk["level"] {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function assessDeploymentRisk(input: unknown): DeploymentRisk {
  const parsed = DeploymentRiskInputSchema.parse(input);
  const diff = parsed.diff ?? "";
  const signals = rules
    .filter((rule) => rule.matches(parsed.changedFiles, diff))
    .map((rule) => ({
      ruleId: rule.id,
      severity: rule.severity,
      weight: rule.weight,
      evidence: rule.evidence,
      explanation: rule.explanation,
      recommendedValidation: rule.recommendedValidation,
    }));
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0));
  const insufficientEvidence = parsed.changedFiles.length === 0;
  const level = riskLevel(score);
  const recommendedChecks = [...new Set(signals.map((signal) => signal.recommendedValidation))];

  return DeploymentRiskSchema.parse({
    score,
    level,
    signals,
    explanation: insufficientEvidence
      ? "Insufficient change metadata was provided for a meaningful assessment."
      : `${signals.length} deterministic risk rule(s) matched; the score is the capped sum of their weights.`,
    recommendedChecks,
    insufficientEvidence,
  });
}
