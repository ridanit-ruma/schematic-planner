-- Groups the entries written by one act, so a call that added forty nodes reads
-- as one line rather than forty. Null for everything recorded before this.
ALTER TABLE "PlanChange" ADD COLUMN "batchId" TEXT;

CREATE INDEX "PlanChange_batchId_idx" ON "PlanChange"("batchId");
