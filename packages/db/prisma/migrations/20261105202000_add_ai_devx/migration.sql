CREATE TABLE "DevxAnalysisRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "repository" TEXT,
    "pullRequestNumber" INTEGER,
    "commitSha" TEXT,
    "providerMode" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevxAnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevxAnalysisRun_kind_createdAt_idx"
    ON "DevxAnalysisRun"("kind", "createdAt");
CREATE INDEX "DevxAnalysisRun_repository_pullRequestNumber_commitSha_idx"
    ON "DevxAnalysisRun"("repository", "pullRequestNumber", "commitSha");

CREATE TABLE "DevxWebhookDelivery" (
    "deliveryId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DevxWebhookDelivery_pkey" PRIMARY KEY ("deliveryId")
);

CREATE INDEX "DevxWebhookDelivery_createdAt_idx"
    ON "DevxWebhookDelivery"("createdAt");
