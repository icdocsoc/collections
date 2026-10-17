import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Create a Prisma client for the collection DB, using the `pg` driver adapter (required since Prisma 7).
 *
 * The connection URL is passed to `pg` unchanged, so it follows `pg`'s connection string format:
 * https://node-postgres.com/features/connecting#connection-uri
 *
 * @param connectionString Database URL, defaults to `COLLECTION_DATABASE_URL`
 */
export function createPrismaClient(connectionString = process.env.COLLECTION_DATABASE_URL) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
