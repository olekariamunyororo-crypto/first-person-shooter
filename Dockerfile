# Match .meteor/release (METEOR@3.0.3)
FROM geoffreybooth/meteor-base:3.0.3

# Copy the full app source first so Meteor can resolve everything
COPY . $APP_SOURCE_FOLDER/

# Install npm dependencies with meteor npm (works without package-lock.json)
RUN cd $APP_SOURCE_FOLDER && meteor npm install
RUN cd $APP_SOURCE_FOLDER && meteor npm run build

# Build the Meteor production bundle
RUN bash $SCRIPTS_FOLDER/build-meteor-bundle.sh

# Runtime image — Meteor 3.x uses Node 20
FROM node:20-alpine

ENV APP_BUNDLE_FOLDER=/opt/bundle
ENV SCRIPTS_FOLDER=/docker

RUN apk --no-cache add \
    bash \
    ca-certificates

# Copy entrypoint scripts and the built bundle from the builder stage
COPY --from=0 $SCRIPTS_FOLDER $SCRIPTS_FOLDER/
COPY --from=0 $APP_BUNDLE_FOLDER/bundle $APP_BUNDLE_FOLDER/bundle/

# Install production npm dependencies for the server
RUN bash $SCRIPTS_FOLDER/build-meteor-npm-dependencies.sh

# Render injects PORT; default to 3000 for local runs
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/docker/entrypoint.sh"]
CMD ["node", "main.js"]
