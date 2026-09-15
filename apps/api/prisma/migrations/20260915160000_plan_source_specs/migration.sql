-- Which Plans a Plan was written from.
--
-- An array rather than a join table. The rule this serves is that a source
-- which is destroyed keeps its id here and is reported as missing: a foreign
-- key could only cascade, which would edit the citing plan's own record of
-- where it came from, or null the column, which loses the id it was told to
-- keep. Validity is therefore computed when the plan is read, never stored.
ALTER TABLE "Plan" ADD COLUMN "sourceSpecIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Plan" SET "sourceSpecIds" = ARRAY[]::TEXT[] WHERE "sourceSpecIds" IS NULL;
ALTER TABLE "Plan" ALTER COLUMN "sourceSpecIds" SET NOT NULL;

-- Answers the reverse question — which plans cite this spec — without a second
-- table and without a scan.
CREATE INDEX "Plan_sourceSpecIds_idx" ON "Plan" USING GIN ("sourceSpecIds");
