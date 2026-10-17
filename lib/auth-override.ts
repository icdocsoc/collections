/**
 * ============================================================================
 * !!!  TEST-ONLY AUTH OVERRIDE — REMOVE BEFORE GOING TO PRODUCTION  !!!
 * ============================================================================
 *
 * Adds a "login as docsoc@ic.ac.uk" button to the login page that skips
 * Microsoft Entra SSO and the committee member check entirely, so the app can
 * be tested after the move out of the docsoc-tools monorepo without SSO set up.
 *
 * It is only active when the env var `AUTH_OVERRIDE_TEST_LOGIN=true` is set.
 *
 * To remove it (all places are tagged with `AUTH_OVERRIDE`, so
 * `grep -rn AUTH_OVERRIDE .` will find everything):
 * 1. Delete this file
 * 2. Delete the lines marked `AUTH_OVERRIDE` in `auth.ts` and `app/auth/login/page.tsx`
 * 3. Delete `AUTH_OVERRIDE_TEST_LOGIN` from `.env.local.template` and the README
 * ============================================================================
 */
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";

/** AUTH_OVERRIDE: the user everyone is logged in as when the override is used */
export const AUTH_OVERRIDE_EMAIL = "docsoc@ic.ac.uk";

/** AUTH_OVERRIDE: provider ID of the override, used to skip the committee check in `auth.ts` */
export const AUTH_OVERRIDE_PROVIDER_ID = "test-login-override";

/** AUTH_OVERRIDE: whether the override is turned on */
export const isAuthOverrideEnabled = () => process.env["AUTH_OVERRIDE_TEST_LOGIN"] === "true";

/** AUTH_OVERRIDE: providers to add to NextAuth (empty unless the override is enabled) */
export const getAuthOverrideProviders = (): Provider[] => {
    if (!isAuthOverrideEnabled()) {
        return [];
    }

    console.warn(
        "\n" +
            "=====================================================================\n" +
            `!!! AUTH_OVERRIDE ENABLED: anyone can log in as ${AUTH_OVERRIDE_EMAIL} !!!\n` +
            "!!! This is for testing only and MUST be removed before production !!!\n" +
            "=====================================================================\n",
    );

    const id = AUTH_OVERRIDE_PROVIDER_ID;
    const name = `⚠️ TEST OVERRIDE as ${AUTH_OVERRIDE_EMAIL} (remove before prod)`;
    return [
        {
            ...Credentials({
                id,
                name,
                credentials: {},
                authorize: async () => ({
                    id: AUTH_OVERRIDE_EMAIL,
                    name: "DoCSoc (test login override)",
                    email: AUTH_OVERRIDE_EMAIL,
                }),
            }),
            // Also set at the top level, as `providerMap` in `auth.ts` (used by the login page) reads these directly
            id,
            name,
        },
    ];
};
