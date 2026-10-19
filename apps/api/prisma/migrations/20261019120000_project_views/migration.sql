-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "views" JSONB,
ADD COLUMN     "viewsVersion" INTEGER NOT NULL DEFAULT 0;
