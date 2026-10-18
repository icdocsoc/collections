-- Replace the collected flag with a collection state: collected items become COLLECTED, everything else UNCOLLECTED
CREATE TYPE "CollectionState" AS ENUM ('UNCOLLECTED', 'COLLECTED', 'FORFEITED', 'REFUNDED');

ALTER TABLE "OrderItem" ADD COLUMN "state" "CollectionState" NOT NULL DEFAULT 'UNCOLLECTED';

UPDATE "OrderItem" SET "state" = 'COLLECTED' WHERE "collected" = true;

ALTER TABLE "OrderItem" DROP COLUMN "collected";
