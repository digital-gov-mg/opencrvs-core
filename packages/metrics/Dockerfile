ARG  VERSION=prod
FROM siecm/ocrvs-base2:${VERSION}

USER node

WORKDIR /app/packages/metrics
COPY --chown=node:node packages/metrics /app/packages/metrics
RUN yarn install --frozen-lockfile && yarn build

CMD ["yarn", "start:prod"]