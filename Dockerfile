# This template uses Automatically Copying Traced Files feature
# so you need to setup your Next Config file to use `output: 'standalone'`
# Please read this for more information https://nextjs.org/docs/pages/api-reference/next-config-js/output
FROM node:20-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /build

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Generate Prisma Client (needed to be included in build)
RUN npx prisma generate
# Build the collection code
RUN npm run build

# Production image, copy all the files and run next
FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

# Set the correct permission for prerender cache
RUN mkdir /app/.next
RUN chown node:node /app/.next

COPY --from=builder /build/next.config.js ./
COPY --from=builder /build/public ./public
COPY --from=builder /build/.next/standalone ./
COPY --from=builder /build/.next/static ./.next/static
COPY --from=builder /build/entry.sh ./entry.sh
COPY --from=builder --chown=node:node /build/prisma ./prisma


# RUN npm i sharp
RUN chown -R node:node .

USER node
EXPOSE 3000
# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry.
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["./entry.sh"]
