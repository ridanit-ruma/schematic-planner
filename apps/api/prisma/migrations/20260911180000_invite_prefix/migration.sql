-- Which link is which. A workspace may have several invitations open at the
-- same role, and without this they are indistinguishable in a list -- which
-- makes withdrawing the right one guesswork.
--
-- Empty on rows issued before the list existed: only the hash of those was
-- ever kept, so there is nothing to backfill from.
ALTER TABLE "Invite" ADD COLUMN "prefix" TEXT NOT NULL DEFAULT '';
