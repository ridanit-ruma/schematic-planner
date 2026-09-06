CREATE TABLE "PlanChange" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanChange_planId_createdAt_idx" ON "PlanChange"("planId", "createdAt");

ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
