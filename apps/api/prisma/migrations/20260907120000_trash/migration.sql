-- A delete moves a plan or a project to the trash instead of destroying it.
-- Everything that lists them filters on `deletedAt IS NULL`; the trash screen is
-- the only place that looks for rows where it is set.

ALTER TABLE "Plan" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Plan" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Plan_projectId_deletedAt_idx" ON "Plan"("projectId", "deletedAt");
CREATE INDEX "Project_workspaceId_deletedAt_idx" ON "Project"("workspaceId", "deletedAt");

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
