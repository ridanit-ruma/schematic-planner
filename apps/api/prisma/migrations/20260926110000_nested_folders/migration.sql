-- Folders nest within a project. Null is the project's own top level, which is
-- where every folder made before this stays.
ALTER TABLE "Folder" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Folder_projectId_parentId_idx" ON "Folder"("projectId", "parentId");

-- Cascaded: only a real deletion reaches this (the trash only marks), and a
-- subtree whose root is destroyed has nowhere left to hang. Plans in it fall
-- back to the project's top level through their own SET NULL.
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
