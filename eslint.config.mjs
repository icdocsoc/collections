import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    ...nextVitals,
    ...nextTs,
    prettier,
    globalIgnores([".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"]),
    {
        // Rule tweaks carried over from the old .eslintrc.json (originally from plugin:@nx/typescript)
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/no-empty-function": "error",
            "@typescript-eslint/no-inferrable-types": "error",
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            // New React Compiler rule in eslint-plugin-react-hooks v7 (via eslint-config-next 16).
            // Existing components trip it; kept as a warning until they are refactored.
            "react-hooks/set-state-in-effect": "warn",
        },
    },
    {
        files: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.spec.js", "**/*.spec.jsx"],
        languageOptions: {
            globals: {
                describe: "readonly",
                it: "readonly",
                expect: "readonly",
                jest: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
            },
        },
    },
]);
