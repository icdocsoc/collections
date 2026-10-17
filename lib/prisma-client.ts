import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** SSL params that Prisma's old Rust engine and node-postgres (`pg`) interpret differently */
const SSL_URL_PARAMS = ["sslmode", "sslcert", "sslkey", "sslrootcert", "sslaccept", "sslpassword"];

/**
 * Create a Prisma client for the collection DB.
 *
 * Since Prisma 7, queries go through the `pg` driver adapter rather than Prisma's own engine.
 * `pg` reads SSL params in the connection URL differently (e.g. `sslcert` is a *client* cert in
 * `pg`, but was the server CA for Prisma, and paths now resolve from the working directory),
 * so when `PG_CERT` is set we strip SSL params from the URL and pass the CA to `pg` directly.
 *
 * @param connectionString Database URL, defaults to `COLLECTION_DATABASE_URL`
 */
export function createPrismaClient(connectionString = process.env.COLLECTION_DATABASE_URL) {
    const caCert = process.env.PG_CERT;
    if (!caCert || !connectionString) {
        return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    }

    const url = new URL(connectionString);
    SSL_URL_PARAMS.forEach((param) => url.searchParams.delete(param));
    return new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.toString(), ssl: { ca: caCert } }),
    });
}
