-- Standing in the instance, as distinct from standing in a workspace.
CREATE TYPE "InstanceRole" AS ENUM ('OWNER', 'MEMBER');

ALTER TABLE "User" ADD COLUMN "instanceRole" "InstanceRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "invitedViaId" TEXT;

-- An instance that already has accounts has no owner, and nobody could ever
-- become one from inside the product. The oldest account is the one that would
-- have been made first, so it is the one that would have been owner.
UPDATE "User" SET "instanceRole" = 'OWNER'
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);

CREATE TABLE "SignupInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignupInvite_tokenHash_key" ON "SignupInvite"("tokenHash");
CREATE INDEX "SignupInvite_createdById_idx" ON "SignupInvite"("createdById");
CREATE INDEX "User_invitedViaId_idx" ON "User"("invitedViaId");

ALTER TABLE "SignupInvite" ADD CONSTRAINT "SignupInvite_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_invitedViaId_fkey"
    FOREIGN KEY ("invitedViaId") REFERENCES "SignupInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
