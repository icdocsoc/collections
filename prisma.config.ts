import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env files automatically; this repo keeps its settings in .env.local
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: { path: "prisma/migrations" },
    // Not env("COLLECTION_DATABASE_URL"): that throws when the variable is unset,
    // which would break `prisma generate` in the Docker build (no DB needed for generate)
    datasource: { url: process.env.COLLECTION_DATABASE_URL ?? "" },
});
