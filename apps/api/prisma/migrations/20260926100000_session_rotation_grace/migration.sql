-- A rotated refresh token is marked replaced instead of deleted, and names the
-- session it became. Presented again within the grace period, while that
-- successor is still unused, it is exchanged once more: the response carrying
-- the successor may never have reached the browser.
ALTER TABLE "Session" ADD COLUMN "replacedAt" TIMESTAMP(3),
ADD COLUMN "replacedById" TEXT;
