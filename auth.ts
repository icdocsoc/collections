import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import MicrosoftEntraIDProfile from "next-auth/providers/microsoft-entra-id";

// AUTH_OVERRIDE: test-only, remove before prod (see lib/auth-override.ts)
import { AUTH_OVERRIDE_PROVIDER_ID, getAuthOverrideProviders } from "./lib/auth-override";
import { getCommitteeMember } from "./lib/crud/committee";

const providers: Provider[] = [
    MicrosoftEntraIDProfile({
        clientId: process.env.MS_ENTRA_CLIENT_ID,
        clientSecret: process.env.MS_ENTRA_CLIENT_SECRET,
        // next-auth v5 betas after beta.20 dropped `tenantId`: the tenant is now part of the issuer URL
        issuer: process.env.MS_ENTRA_TENANT_ID
            ? `https://login.microsoftonline.com/${process.env.MS_ENTRA_TENANT_ID}/v2.0/`
            : undefined,
        authorization: {
            params: {
                scope: "offline_access openid profile email User.Read",
            },
        },
        name: "Imperial SSO",
    }),
    ...getAuthOverrideProviders(), // AUTH_OVERRIDE: test-only, remove before prod (see lib/auth-override.ts)
];

export const providerMap = providers.map((provider) => {
    if (typeof provider === "function") {
        const providerData = provider();
        return { id: providerData.id, name: providerData.name };
    } else {
        return { id: provider.id, name: provider.name };
    }
});

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers,
    callbacks: {
        async signIn({ profile, account }) {
            // AUTH_OVERRIDE: test-only, remove before prod (see lib/auth-override.ts)
            if (account?.provider === AUTH_OVERRIDE_PROVIDER_ID) return true; // AUTH_OVERRIDE
            console.log(profile);
            const { email } = profile as any;
            // Docsoc can always login

            if (typeof email !== "string") {
                return false;
            }

            if (email === process.env.ROOT_USER_EMAIL) {
                return true;
            }

            const user = await getCommitteeMember(email);

            if (!user) {
                return false;
            } else {
                return true;
            }
        },
    },
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
});
