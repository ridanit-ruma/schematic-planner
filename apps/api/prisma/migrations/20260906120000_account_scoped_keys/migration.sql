-- A key belongs to a person, not to a workspace.
--
-- Someone who works across several workspaces had to issue, paste and revoke a
-- key for each of them, and an agent holding one could not see the others exist.
-- The column stays so an older narrower key keeps working, but nothing issued
-- from now on sets it.

ALTER TABLE "ApiKey" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- The keys that exist were all issued against the model being replaced. Widening
-- them to their owner's account is the change, applied to what is already there
-- rather than leaving two behaviours in the same table.
UPDATE "ApiKey" SET "workspaceId" = NULL;
