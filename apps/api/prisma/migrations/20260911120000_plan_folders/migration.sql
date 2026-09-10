-- A drawer inside a project. Folders do not nest: `project > folder > plan` is
-- the whole depth, and every level past that is another place a plan can be
-- hiding without a new way to find it.
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Folder_projectId_idx" ON "Folder"("projectId");
CREATE INDEX "Folder_projectId_deletedAt_idx" ON "Folder"("projectId", "deletedAt");

ALTER TABLE "Folder" ADD CONSTRAINT "Folder_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Null is the project's own top level, which is where every plan drawn before
-- folders existed stays. Emptied rather than cascaded on delete: losing a
-- folder must not lose the plans that were in it.
ALTER TABLE "Plan" ADD COLUMN "folderId" TEXT;
CREATE INDEX "Plan_folderId_idx" ON "Plan"("folderId");
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
