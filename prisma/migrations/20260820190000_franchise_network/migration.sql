-- Franchise multi-boutiques : network + memberships

CREATE TYPE "NetworkMemberRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER');

CREATE TABLE "FranchiseNetwork" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hqRestaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseNetwork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRestaurant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" "NetworkMemberRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRestaurant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "networkId" TEXT;

CREATE UNIQUE INDEX "UserRestaurant_userId_restaurantId_key" ON "UserRestaurant"("userId", "restaurantId");
CREATE INDEX "UserRestaurant_restaurantId_idx" ON "UserRestaurant"("restaurantId");
CREATE INDEX "UserRestaurant_userId_idx" ON "UserRestaurant"("userId");
CREATE INDEX "Restaurant_networkId_idx" ON "Restaurant"("networkId");
CREATE INDEX "FranchiseNetwork_hqRestaurantId_idx" ON "FranchiseNetwork"("hqRestaurantId");

ALTER TABLE "FranchiseNetwork" ADD CONSTRAINT "FranchiseNetwork_hqRestaurantId_fkey" FOREIGN KEY ("hqRestaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserRestaurant" ADD CONSTRAINT "UserRestaurant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRestaurant" ADD CONSTRAINT "UserRestaurant_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "FranchiseNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Memberships pour tous les users existants (home store)
INSERT INTO "UserRestaurant" ("id", "userId", "restaurantId", "role", "createdAt")
SELECT
  'ur_' || substr(md5(random()::text || u.id), 1, 22),
  u.id,
  u."restaurantId",
  'OWNER'::"NetworkMemberRole",
  NOW()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "UserRestaurant" ur
  WHERE ur."userId" = u.id AND ur."restaurantId" = u."restaurantId"
);

-- Networks pour les restaurants plan Franchise sans network
DO $$
DECLARE
  r RECORD;
  nid TEXT;
BEGIN
  FOR r IN
    SELECT id, name FROM "Restaurant"
    WHERE plan = 'reseau' AND "networkId" IS NULL
  LOOP
    nid := 'fn_' || substr(md5(random()::text || r.id), 1, 22);
    INSERT INTO "FranchiseNetwork" ("id", "name", "hqRestaurantId", "createdAt", "updatedAt")
    VALUES (nid, r.name || ' — Réseau', r.id, NOW(), NOW());
    UPDATE "Restaurant" SET "networkId" = nid WHERE id = r.id;
  END LOOP;
END $$;
