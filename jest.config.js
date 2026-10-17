// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextJest = require("next/jest");

const createJestConfig = nextJest({
    // Path to the Next.js app, so next.config.js and .env files are loaded in the test environment
    dir: "./",
});

/** @type {import('jest').Config} */
const config = {
    displayName: "collections",
    testEnvironment: "node",
    moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    coverageDirectory: "coverage",
};

module.exports = createJestConfig(config);
