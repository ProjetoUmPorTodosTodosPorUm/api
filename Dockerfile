###################
# BASE IMAGE
###################
FROM node:21.7-alpine AS base-image

# Create APP directory
# be aware WORKDIR creates directories as root instead of USER 
# https://github.com/moby/moby/issues/36677
WORKDIR /usr/src/app

# Install Dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

# Copy Necessary Files
COPY . . 

# Creates Production Bundle
RUN npx prisma generate && npm run build && npm prune --production

# Needed for seeding
RUN chown -R node:node ./node_modules/.prisma
RUN chown -R node:node ./node_modules/@prisma

###################
# PREVIEW IMAGE
###################
FROM node:21.7-alpine AS preview-image
WORKDIR /usr/src/app
ENV NODE_ENV preview
ENV TZ America/Sao_Paulo

# Creates files dir 
RUN mkdir files && chown node:node files

# Needed Files
COPY --from=base-image --chown=node:node /usr/src/app/package.json ./
COPY --from=base-image --chown=node:node /usr/src/app/dist ./dist
COPY --from=base-image --chown=node:node /usr/src/app/prisma ./prisma
COPY --from=base-image --chown=node:node /usr/src/app/node_modules ./node_modules

USER node:node
EXPOSE 3000
CMD npx prisma migrate deploy; npx prisma db seed; node dist/main.js

###################
# PROD IMAGE
###################
FROM node:21.7-alpine AS prod-image
WORKDIR /usr/src/app
ENV NODE_ENV production
ENV TZ America/Sao_Paulo

# Creates files dir
RUN mkdir files && chown node:node files

# Needed Files
COPY --from=base-image --chown=node:node /usr/src/app/package.json ./
COPY --from=base-image --chown=node:node /usr/src/app/dist ./dist
COPY --from=base-image --chown=node:node /usr/src/app/prisma ./prisma
COPY --from=base-image --chown=node:node /usr/src/app/node_modules ./node_modules

USER node:node
EXPOSE 3000
CMD npx prisma migrate deploy; npx prisma db seed; node dist/main.js
