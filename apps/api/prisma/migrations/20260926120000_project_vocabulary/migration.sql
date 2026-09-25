-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "vocabulary" JSONB,
ADD COLUMN     "vocabularyVersion" INTEGER NOT NULL DEFAULT 0;
