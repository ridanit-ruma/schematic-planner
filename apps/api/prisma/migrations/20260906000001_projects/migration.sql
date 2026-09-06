-- Workspace > Project > Plan.
--
-- The middle level is new. Every plan that already exists is moved into a
-- "General" project inside the workspace it already belonged to, so nothing is
-- orphaned and no plan link changes: a plan is still addressed by its own id.

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one project per workspace that currently holds plans.
INSERT INTO "Project" ("id", "workspaceId", "slug", "name", "description", "createdAt", "updatedAt")
SELECT 'proj' || w."id", w."id", 'general', 'General', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace" w
WHERE EXISTS (SELECT 1 FROM "Plan" p WHERE p."workspaceId" = w."id");

-- Move every plan into its workspace's new project.
ALTER TABLE "Plan" ADD COLUMN "projectId" TEXT;
UPDATE "Plan" SET "projectId" = 'proj' || "workspaceId";
ALTER TABLE "Plan" ALTER COLUMN "projectId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_workspaceId_fkey";

-- DropIndex
DROP INDEX "Plan_workspaceId_idx";

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "workspaceId";

-- CreateIndex
CREATE INDEX "Plan_projectId_idx" ON "Plan"("projectId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
