//@ts-check

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
    turbopack: {
        rules: {
            // Import *.svg files as React components via SVGR.
            // Imports ending in ?url (*.svg?url) skip this rule and get the default asset URL instead.
            "*.svg": {
                condition: { not: { query: /[?&]url(?=&|$)/ } },
                loaders: ["@svgr/webpack"],
                as: "*.js",
            },
        },
    },
    output: "standalone",
};

module.exports = nextConfig;
