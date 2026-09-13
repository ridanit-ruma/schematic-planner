-- An invitation can now be turned down, which is different from never answered.
ALTER TABLE "Invite" ADD COLUMN "declinedAt" TIMESTAMP(3);
